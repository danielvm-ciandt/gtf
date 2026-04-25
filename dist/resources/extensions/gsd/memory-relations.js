// GSD Memory Relations — knowledge-graph edges between memories
//
// Phase 4 companion to memory-store.ts. Edges live in the `memory_relations`
// table and are created by (a) explicit LINK actions emitted by the memory
// extractor, or (b) future `/gsd memory link` CLI commands. All writes go
// through the single-writer gate in `gsd-db.ts`.
import { _getAdapter, deleteMemoryRelationsFor, insertMemoryRelationRow, isDbAvailable, } from "./gsd-db.js";
export const VALID_RELATIONS = [
    "related_to",
    "depends_on",
    "contradicts",
    "elaborates",
    "supersedes",
];
// ─── Helpers ────────────────────────────────────────────────────────────────
export function isValidRelation(value) {
    return typeof value === "string" && VALID_RELATIONS.includes(value);
}
function clampConfidence(value) {
    if (typeof value !== "number" || !Number.isFinite(value))
        return 0.8;
    if (value < 0.1)
        return 0.1;
    if (value > 0.99)
        return 0.99;
    return value;
}
// ─── Mutations ──────────────────────────────────────────────────────────────
export function createMemoryRelation(from, to, rel, confidence) {
    if (!isDbAvailable())
        return false;
    if (!from || !to || from === to || !isValidRelation(rel))
        return false;
    const adapter = _getAdapter();
    if (!adapter)
        return false;
    try {
        // Verify both memories exist — relation rows without endpoints are useless.
        const fromRow = adapter.prepare("SELECT 1 FROM memories WHERE id = :id").get({ ":id": from });
        const toRow = adapter.prepare("SELECT 1 FROM memories WHERE id = :id").get({ ":id": to });
        if (!fromRow || !toRow)
            return false;
        insertMemoryRelationRow({
            fromId: from,
            toId: to,
            rel,
            confidence: clampConfidence(confidence),
            createdAt: new Date().toISOString(),
        });
        return true;
    }
    catch {
        return false;
    }
}
export function removeMemoryRelationsFor(memoryId) {
    if (!isDbAvailable() || !memoryId)
        return;
    try {
        deleteMemoryRelationsFor(memoryId);
    }
    catch {
        // non-fatal
    }
}
// ─── Queries ────────────────────────────────────────────────────────────────
export function listRelationsFor(memoryId) {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    try {
        const rows = adapter
            .prepare("SELECT from_id, to_id, rel, confidence, created_at FROM memory_relations WHERE from_id = :id OR to_id = :id")
            .all({ ":id": memoryId });
        return rows.map(rowToRelation);
    }
    catch {
        return [];
    }
}
export function traverseGraph(startId, depth) {
    const emptyResult = { nodes: [], edges: [] };
    if (!isDbAvailable() || !startId)
        return emptyResult;
    const adapter = _getAdapter();
    if (!adapter)
        return emptyResult;
    const hop = Math.max(0, Math.min(5, Math.floor(depth || 0)));
    try {
        const visited = new Set();
        const queue = [{ id: startId, hop: 0 }];
        const nodes = new Map();
        const edges = [];
        while (queue.length > 0) {
            const { id, hop: level } = queue.shift();
            if (visited.has(id))
                continue;
            visited.add(id);
            const nodeRow = adapter
                .prepare("SELECT id, category, content, confidence, superseded_by FROM memories WHERE id = :id")
                .get({ ":id": id });
            if (!nodeRow)
                continue;
            nodes.set(id, {
                id: nodeRow["id"],
                category: nodeRow["category"],
                content: nodeRow["content"],
                confidence: nodeRow["confidence"],
            });
            // Include supersedes edges from the base table so old graphs remain
            // connected even before the extractor starts emitting LINK actions.
            const successor = nodeRow["superseded_by"];
            if (successor && successor !== "CAP_EXCEEDED") {
                edges.push({
                    from: id,
                    to: successor,
                    rel: "supersedes",
                    confidence: 1,
                    createdAt: "",
                });
                if (!visited.has(successor) && level < hop) {
                    queue.push({ id: successor, hop: level + 1 });
                }
            }
            const predecessors = adapter
                .prepare("SELECT id FROM memories WHERE superseded_by = :id")
                .all({ ":id": id });
            for (const pred of predecessors) {
                const predId = pred["id"];
                edges.push({ from: predId, to: id, rel: "supersedes", confidence: 1, createdAt: "" });
                if (!visited.has(predId) && level < hop) {
                    queue.push({ id: predId, hop: level + 1 });
                }
            }
            if (level >= hop)
                continue;
            const outgoing = adapter
                .prepare("SELECT from_id, to_id, rel, confidence, created_at FROM memory_relations WHERE from_id = :id")
                .all({ ":id": id });
            for (const row of outgoing) {
                const edge = rowToRelation(row);
                edges.push(edge);
                if (!visited.has(edge.to))
                    queue.push({ id: edge.to, hop: level + 1 });
            }
            const incoming = adapter
                .prepare("SELECT from_id, to_id, rel, confidence, created_at FROM memory_relations WHERE to_id = :id")
                .all({ ":id": id });
            for (const row of incoming) {
                const edge = rowToRelation(row);
                edges.push(edge);
                if (!visited.has(edge.from))
                    queue.push({ id: edge.from, hop: level + 1 });
            }
        }
        return {
            nodes: [...nodes.values()],
            edges: dedupeEdges(edges),
        };
    }
    catch {
        return emptyResult;
    }
}
function rowToRelation(row) {
    const relRaw = row["rel"];
    const rel = isValidRelation(relRaw) ? relRaw : "related_to";
    return {
        from: row["from_id"],
        to: row["to_id"],
        rel,
        confidence: row["confidence"] ?? 0.8,
        createdAt: row["created_at"] ?? "",
    };
}
function dedupeEdges(edges) {
    const seen = new Set();
    const out = [];
    for (const e of edges) {
        const key = `${e.from}|${e.to}|${e.rel}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(e);
    }
    return out;
}
