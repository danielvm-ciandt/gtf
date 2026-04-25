// GSD Memory Store — CRUD, ranked queries, maintenance, and prompt formatting
//
// Storage layer for auto-learned project memories. Follows context-store.ts patterns.
// All functions degrade gracefully: return empty results when DB unavailable, never throw.
import { isDbAvailable, _getAdapter, transaction, insertMemoryRow, rewriteMemoryId, updateMemoryContentRow, incrementMemoryHitCount, supersedeMemoryRow, markMemoryUnitProcessed, decayMemoriesBefore, supersedeLowestRankedMemories, deleteMemoryEmbedding, deleteMemoryRelationsFor, } from './gsd-db.js';
import { createMemoryRelation, isValidRelation } from './memory-relations.js';
// ─── Category Display Order ─────────────────────────────────────────────────
const CATEGORY_PRIORITY = {
    gotcha: 0,
    convention: 1,
    architecture: 2,
    pattern: 3,
    environment: 4,
    preference: 5,
};
// ─── Row Mapping ────────────────────────────────────────────────────────────
function rowToMemory(row) {
    return {
        seq: row['seq'],
        id: row['id'],
        category: row['category'],
        content: row['content'],
        confidence: row['confidence'],
        source_unit_type: row['source_unit_type'] ?? null,
        source_unit_id: row['source_unit_id'] ?? null,
        created_at: row['created_at'],
        updated_at: row['updated_at'],
        superseded_by: row['superseded_by'] ?? null,
        hit_count: row['hit_count'],
        scope: row['scope'] ?? 'project',
        tags: parseTags(row['tags']),
        structured_fields: parseStructuredFields(row['structured_fields']),
    };
}
function parseStructuredFields(raw) {
    if (typeof raw !== 'string' || raw.length === 0)
        return null;
    try {
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
            ? parsed
            : null;
    }
    catch {
        return null;
    }
}
function parseTags(raw) {
    if (typeof raw !== 'string' || raw.length === 0)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((t) => typeof t === 'string') : [];
    }
    catch {
        return [];
    }
}
// ─── Query Functions ────────────────────────────────────────────────────────
/**
 * Get all memories where superseded_by IS NULL.
 * Returns [] if DB is not available. Never throws.
 */
export function getActiveMemories() {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    try {
        const rows = adapter.prepare('SELECT * FROM memories WHERE superseded_by IS NULL').all();
        return rows.map(rowToMemory);
    }
    catch {
        return [];
    }
}
/**
 * Get active memories ordered by ranking score: confidence * (1 + hit_count * 0.1).
 * Higher-scored memories are more relevant and frequently confirmed.
 */
export function getActiveMemoriesRanked(limit = 30) {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    try {
        const rows = adapter.prepare(`SELECT * FROM memories
       WHERE superseded_by IS NULL
       ORDER BY (confidence * (1.0 + hit_count * 0.1)) DESC
       LIMIT :limit`).all({ ':limit': limit });
        return rows.map(rowToMemory);
    }
    catch {
        return [];
    }
}
export function queryMemoriesRanked(opts) {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    const k = clampLimit(opts.k, 10);
    const rrfK = opts.rrfK ?? 60;
    const activeClause = opts.include_superseded === true ? '' : 'WHERE superseded_by IS NULL';
    const trimmedQuery = (opts.query ?? '').trim();
    // 1) Keyword hits — try FTS5 first, fall back to LIKE when unavailable.
    const keywordHits = trimmedQuery ? keywordSearch(adapter, trimmedQuery, activeClause, 50) : [];
    // 2) Semantic hits — cosine over memory_embeddings. Requires opts.queryVector.
    const semanticHits = opts.queryVector
        ? semanticSearch(adapter, opts.queryVector, activeClause, 50)
        : [];
    if (keywordHits.length === 0 && semanticHits.length === 0 && !trimmedQuery) {
        // No query at all — fall back to the existing ranked-by-score listing.
        return getActiveMemoriesRanked(k).map((memory) => ({
            memory,
            score: memory.confidence * (1 + memory.hit_count * 0.1),
            keywordRank: null,
            semanticRank: null,
            confidenceBoost: memory.confidence * (1 + memory.hit_count * 0.1),
            reason: 'ranked',
        })).filter((hit) => passesFilters(hit.memory, opts));
    }
    // 3) Reciprocal rank fusion — each hit contributes 1/(rrfK + rank).
    const fused = new Map();
    for (let i = 0; i < keywordHits.length; i++) {
        const hit = keywordHits[i];
        const existing = fused.get(hit.id);
        const rrf = 1 / (rrfK + i + 1);
        if (existing) {
            existing.kwRank = i + 1;
            existing.score += rrf;
        }
        else {
            fused.set(hit.id, { memory: hit, kwRank: i + 1, semRank: null, score: rrf });
        }
    }
    for (let i = 0; i < semanticHits.length; i++) {
        const hit = semanticHits[i];
        const existing = fused.get(hit.id);
        const rrf = 1 / (rrfK + i + 1);
        if (existing) {
            existing.semRank = i + 1;
            existing.score += rrf;
        }
        else {
            fused.set(hit.id, { memory: hit, kwRank: null, semRank: i + 1, score: rrf });
        }
    }
    // 4) Apply filters + confidence boost, then sort.
    const ranked = [];
    for (const entry of fused.values()) {
        if (!passesFilters(entry.memory, opts))
            continue;
        const boost = entry.memory.confidence * (1 + entry.memory.hit_count * 0.1);
        const reason = entry.kwRank != null && entry.semRank != null
            ? 'both'
            : entry.kwRank != null
                ? 'keyword'
                : 'semantic';
        ranked.push({
            memory: entry.memory,
            score: entry.score * boost,
            keywordRank: entry.kwRank,
            semanticRank: entry.semRank,
            confidenceBoost: boost,
            reason,
        });
    }
    ranked.sort((a, b) => b.score - a.score);
    return ranked.slice(0, k);
}
function clampLimit(value, fallback) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        return fallback;
    if (value < 1)
        return 1;
    if (value > 100)
        return 100;
    return Math.floor(value);
}
function passesFilters(memory, filters) {
    if (filters.category && memory.category.toLowerCase() !== filters.category.toLowerCase())
        return false;
    if (filters.scope && memory.scope !== filters.scope)
        return false;
    if (filters.tag) {
        const needle = filters.tag.toLowerCase();
        if (!memory.tags.map((t) => t.toLowerCase()).includes(needle))
            return false;
    }
    return true;
}
function keywordSearch(adapter, rawQuery, activeClause, limit) {
    const ftsAvailable = isFtsAvailable(adapter);
    if (ftsAvailable) {
        try {
            const matchExpr = toFtsMatchExpr(rawQuery);
            if (!matchExpr)
                return [];
            const activePart = activeClause ? `AND m.${activeClause.replace(/^WHERE\s+/i, '')}` : '';
            const rows = adapter.prepare(`SELECT m.*
         FROM memories_fts f
         JOIN memories m ON m.seq = f.rowid
         WHERE memories_fts MATCH :match
         ${activePart}
         ORDER BY bm25(memories_fts)
         LIMIT :limit`).all({ ':match': matchExpr, ':limit': limit });
            return rows.map(rowToMemory);
        }
        catch {
            // fall through to LIKE
        }
    }
    // LIKE fallback — scans the candidate pool.
    const terms = rawQuery
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((t) => t.length >= 2);
    if (terms.length === 0)
        return [];
    const rows = adapter.prepare(`SELECT * FROM memories ${activeClause}`).all();
    const scored = [];
    for (const row of rows) {
        const memory = rowToMemory(row);
        const lower = memory.content.toLowerCase();
        let score = 0;
        for (const term of terms) {
            const idx = lower.indexOf(term);
            if (idx === -1)
                continue;
            score += 1 + (term.length >= 5 ? 0.5 : 0);
        }
        if (score > 0)
            scored.push({ memory, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map((s) => s.memory);
}
function isFtsAvailable(adapter) {
    try {
        const row = adapter
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='memories_fts'")
            .get();
        return !!row;
    }
    catch {
        return false;
    }
}
function toFtsMatchExpr(query) {
    // Build a tolerant AND expression: quote each bare term with a trailing *.
    const tokens = query
        .toLowerCase()
        .split(/[^a-z0-9_]+/)
        .filter((t) => t.length >= 2)
        .slice(0, 8);
    if (tokens.length === 0)
        return null;
    return tokens.map((t) => `"${t.replace(/"/g, '""')}"*`).join(' OR ');
}
function semanticSearch(adapter, queryVector, activeClause, limit) {
    try {
        const rows = adapter
            .prepare(`SELECT m.*, e.vector as embedding_vector, e.dim as embedding_dim
         FROM memories m
         JOIN memory_embeddings e ON e.memory_id = m.id
         ${activeClause}`)
            .all();
        const scored = [];
        for (const row of rows) {
            const dim = row['embedding_dim'];
            if (dim !== queryVector.length)
                continue;
            const vector = unpackVector(row['embedding_vector'], dim);
            if (!vector)
                continue;
            const sim = cosine(queryVector, vector);
            if (sim <= 0)
                continue;
            scored.push({ memory: rowToMemory(row), sim });
        }
        scored.sort((a, b) => b.sim - a.sim);
        return scored.slice(0, limit).map((s) => s.memory);
    }
    catch {
        return [];
    }
}
function unpackVector(blob, dim) {
    if (!blob)
        return null;
    try {
        let view = null;
        if (blob instanceof Float32Array)
            return blob;
        if (blob instanceof Uint8Array)
            view = blob;
        else if (blob instanceof ArrayBuffer)
            view = new Uint8Array(blob);
        else if (blob.buffer && blob.byteLength != null) {
            const buf = blob;
            view = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        }
        else if (Array.isArray(blob)) {
            return new Float32Array(blob);
        }
        if (!view || view.byteLength % 4 !== 0)
            return null;
        const aligned = new ArrayBuffer(view.byteLength);
        new Uint8Array(aligned).set(view);
        const f32 = new Float32Array(aligned);
        return f32.length === dim ? f32 : null;
    }
    catch {
        return null;
    }
}
function cosine(a, b) {
    if (a.length === 0 || a.length !== b.length)
        return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i];
        const y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    if (na === 0 || nb === 0)
        return 0;
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
/**
 * Generate the next memory ID: MEM + zero-padded 3-digit from MAX(seq).
 * Returns MEM001 if no memories exist.
 *
 * NOTE: For race-safe creation, prefer createMemory() which inserts with a
 * placeholder ID then updates to the seq-derived ID atomically.
 */
export function nextMemoryId() {
    if (!isDbAvailable())
        return 'MEM001';
    const adapter = _getAdapter();
    if (!adapter)
        return 'MEM001';
    try {
        const row = adapter
            .prepare('SELECT MAX(seq) as max_seq FROM memories')
            .get();
        const maxSeq = row ? row['max_seq'] : null;
        if (maxSeq == null || isNaN(maxSeq))
            return 'MEM001';
        const next = maxSeq + 1;
        return `MEM${String(next).padStart(3, '0')}`;
    }
    catch {
        return 'MEM001';
    }
}
// ─── Mutation Functions ─────────────────────────────────────────────────────
/**
 * Insert a new memory with a race-safe auto-assigned ID.
 * Uses AUTOINCREMENT seq to derive the ID after insert, avoiding
 * the read-then-write race in concurrent scenarios (e.g. worktrees).
 * Returns the assigned ID, or null on failure.
 */
export function createMemory(fields) {
    if (!isDbAvailable())
        return null;
    const adapter = _getAdapter();
    if (!adapter)
        return null;
    try {
        const now = new Date().toISOString();
        // Insert with a temporary placeholder ID — seq is auto-assigned
        const placeholder = `_TMP_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        insertMemoryRow({
            id: placeholder,
            category: fields.category,
            content: fields.content,
            confidence: fields.confidence ?? 0.8,
            sourceUnitType: fields.source_unit_type ?? null,
            sourceUnitId: fields.source_unit_id ?? null,
            createdAt: now,
            updatedAt: now,
            scope: fields.scope ?? 'project',
            tags: fields.tags ?? [],
            structuredFields: fields.structuredFields ?? null,
        });
        // Derive the real ID from the assigned seq (SELECT is still fine via adapter)
        const row = adapter.prepare('SELECT seq FROM memories WHERE id = :id').get({ ':id': placeholder });
        if (!row)
            return placeholder; // fallback — should not happen
        const seq = row['seq'];
        const realId = `MEM${String(seq).padStart(3, '0')}`;
        rewriteMemoryId(placeholder, realId);
        return realId;
    }
    catch {
        return null;
    }
}
/**
 * Update a memory's content and optionally its confidence.
 */
export function updateMemoryContent(id, content, confidence) {
    if (!isDbAvailable())
        return false;
    try {
        updateMemoryContentRow(id, content, confidence, new Date().toISOString());
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Reinforce a memory: increment hit_count, update timestamp.
 */
export function reinforceMemory(id) {
    if (!isDbAvailable())
        return false;
    try {
        incrementMemoryHitCount(id, new Date().toISOString());
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Mark a memory as superseded by another.
 */
export function supersedeMemory(oldId, newId) {
    if (!isDbAvailable())
        return false;
    try {
        supersedeMemoryRow(oldId, newId, new Date().toISOString());
        return true;
    }
    catch {
        return false;
    }
}
// ─── Processed Unit Tracking ────────────────────────────────────────────────
/**
 * Check if a unit has already been processed for memory extraction.
 */
export function isUnitProcessed(unitKey) {
    if (!isDbAvailable())
        return false;
    const adapter = _getAdapter();
    if (!adapter)
        return false;
    try {
        const row = adapter.prepare('SELECT 1 FROM memory_processed_units WHERE unit_key = :key').get({ ':key': unitKey });
        return row != null;
    }
    catch {
        return false;
    }
}
/**
 * Record that a unit has been processed for memory extraction.
 */
export function markUnitProcessed(unitKey, activityFile) {
    if (!isDbAvailable())
        return false;
    try {
        markMemoryUnitProcessed(unitKey, activityFile, new Date().toISOString());
        return true;
    }
    catch {
        return false;
    }
}
// ─── Maintenance ────────────────────────────────────────────────────────────
/**
 * Reduce confidence for memories not updated within the last N processed units.
 * "Stale" = updated_at is older than the Nth most recent processed_at.
 * Returns the number of decayed memory IDs for observability.
 */
export function decayStaleMemories(thresholdUnits = 20) {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    try {
        // Find the timestamp of the Nth most recent processed unit (read-only SELECT)
        const row = adapter.prepare(`SELECT processed_at FROM memory_processed_units
       ORDER BY processed_at DESC
       LIMIT 1 OFFSET :offset`).get({ ':offset': thresholdUnits - 1 });
        if (!row)
            return []; // not enough processed units yet
        const cutoff = row['processed_at'];
        const affected = adapter.prepare(`SELECT id FROM memories
       WHERE superseded_by IS NULL AND updated_at < :cutoff AND confidence > 0.1`).all({ ':cutoff': cutoff }).map((r) => r['id']);
        decayMemoriesBefore(cutoff, new Date().toISOString());
        return affected;
    }
    catch {
        return [];
    }
}
/**
 * Supersede lowest-ranked memories when count exceeds cap. Cascades to the
 * embedding and relation rows so those tables don't grow unboundedly.
 */
export function enforceMemoryCap(max = 50) {
    if (!isDbAvailable())
        return;
    const adapter = _getAdapter();
    if (!adapter)
        return;
    try {
        const countRow = adapter.prepare('SELECT count(*) as cnt FROM memories WHERE superseded_by IS NULL').get();
        const count = countRow?.['cnt'] ?? 0;
        if (count <= max)
            return;
        const excess = count - max;
        // Capture the about-to-be-superseded IDs first so we can cascade cleanup.
        const victims = adapter.prepare(`SELECT id FROM memories
       WHERE superseded_by IS NULL
       ORDER BY (confidence * (1.0 + hit_count * 0.1)) ASC
       LIMIT :limit`).all({ ':limit': excess }).map((row) => row['id']);
        supersedeLowestRankedMemories(excess, new Date().toISOString());
        if (victims.length === 0)
            return;
        for (const id of victims) {
            try {
                deleteMemoryEmbedding(id);
            }
            catch { /* non-fatal */ }
            try {
                deleteMemoryRelationsFor(id);
            }
            catch { /* non-fatal */ }
        }
    }
    catch {
        // non-fatal
    }
}
// ─── Action Application ─────────────────────────────────────────────────────
/**
 * Process an array of memory actions in a transaction.
 * Calls enforceMemoryCap at the end.
 */
export function applyMemoryActions(actions, unitType, unitId) {
    if (!isDbAvailable() || actions.length === 0)
        return;
    try {
        transaction(() => {
            for (const action of actions) {
                switch (action.action) {
                    case 'CREATE':
                        createMemory({
                            category: action.category,
                            content: action.content,
                            confidence: action.confidence,
                            source_unit_type: unitType,
                            source_unit_id: unitId,
                            scope: action.scope,
                            tags: action.tags,
                            // ADR-013: forward structured payload through the action layer so
                            // bulk applyMemoryActions callers (extraction, ingestion) don't
                            // silently drop it.
                            structuredFields: action.structuredFields ?? null,
                        });
                        break;
                    case 'UPDATE':
                        updateMemoryContent(action.id, action.content, action.confidence);
                        break;
                    case 'REINFORCE':
                        reinforceMemory(action.id);
                        break;
                    case 'SUPERSEDE':
                        supersedeMemory(action.id, action.superseded_by);
                        break;
                    case 'LINK':
                        applyLinkAction(action);
                        break;
                }
            }
            enforceMemoryCap();
        });
    }
    catch {
        // non-fatal — transaction will have rolled back
    }
}
// ─── LINK action ────────────────────────────────────────────────────────────
function applyLinkAction(action) {
    try {
        if (!isValidRelation(action.rel))
            return;
        createMemoryRelation(action.from, action.to, action.rel, action.confidence);
    }
    catch {
        // Link failures should never break memory extraction.
    }
}
// ─── Prompt Formatting ──────────────────────────────────────────────────────
/**
 * Format memories as categorized markdown for system prompt injection.
 * Truncates to token budget (~4 chars per token).
 */
export function formatMemoriesForPrompt(memories, tokenBudget = 2000) {
    if (memories.length === 0)
        return '';
    const charBudget = tokenBudget * 4;
    const header = '## Project Memory (auto-learned)\n';
    let output = header;
    let remaining = charBudget - header.length;
    // Group by category
    const grouped = new Map();
    for (const m of memories) {
        const list = grouped.get(m.category) ?? [];
        list.push(m);
        grouped.set(m.category, list);
    }
    // Sort categories by priority
    const sortedCategories = [...grouped.keys()].sort((a, b) => (CATEGORY_PRIORITY[a] ?? 99) - (CATEGORY_PRIORITY[b] ?? 99));
    for (const category of sortedCategories) {
        const items = grouped.get(category);
        const catHeader = `\n### ${category.charAt(0).toUpperCase() + category.slice(1)}\n`;
        if (remaining < catHeader.length + 10)
            break;
        output += catHeader;
        remaining -= catHeader.length;
        for (const item of items) {
            const bullet = `- ${item.content}\n`;
            if (remaining < bullet.length)
                break;
            output += bullet;
            remaining -= bullet.length;
        }
    }
    return output.trimEnd();
}
