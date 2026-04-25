// GSD Memory Sources — CRUD for raw ingested content (notes, files, URLs, artifacts)
//
// Distinct from `memories`: a `memory_source` row is the preserved raw input
// that an extractor may (or may not) distill into one or more memories.
// Storing the source makes ingestion idempotent (content_hash) and gives the
// user a way to trace a memory back to its origin.
import { createHash, randomUUID } from "node:crypto";
import { _getAdapter, isDbAvailable, insertMemorySourceRow, deleteMemorySourceRow } from "./gsd-db.js";
function rowToSource(row) {
    const tagsRaw = typeof row["tags"] === "string" ? row["tags"] : "[]";
    let tags = [];
    try {
        const parsed = JSON.parse(tagsRaw);
        if (Array.isArray(parsed))
            tags = parsed.filter((t) => typeof t === "string");
    }
    catch {
        // leave tags empty
    }
    return {
        id: row["id"],
        kind: row["kind"],
        uri: row["uri"] ?? null,
        title: row["title"] ?? null,
        content: row["content"],
        content_hash: row["content_hash"],
        imported_at: row["imported_at"],
        scope: row["scope"] ?? "project",
        tags,
    };
}
export function hashContent(content) {
    return createHash("sha256").update(content).digest("hex");
}
export function newSourceId() {
    return `SRC-${randomUUID().slice(0, 8)}`;
}
/**
 * Insert a memory_source. Idempotent — if the content_hash already exists,
 * returns the existing source's id and duplicate=true instead of inserting.
 */
export function createMemorySource(opts) {
    if (!isDbAvailable())
        return null;
    const adapter = _getAdapter();
    if (!adapter)
        return null;
    try {
        const contentHash = hashContent(opts.content);
        const existing = adapter
            .prepare("SELECT id FROM memory_sources WHERE content_hash = :h")
            .get({ ":h": contentHash });
        if (existing && typeof existing["id"] === "string") {
            return { id: existing["id"], duplicate: true };
        }
        const id = newSourceId();
        insertMemorySourceRow({
            id,
            kind: opts.kind,
            uri: opts.uri ?? null,
            title: opts.title ?? null,
            content: opts.content,
            contentHash,
            importedAt: new Date().toISOString(),
            scope: opts.scope ?? "project",
            tags: opts.tags ?? [],
        });
        return { id, duplicate: false };
    }
    catch {
        return null;
    }
}
export function listMemorySources(limit = 50) {
    if (!isDbAvailable())
        return [];
    const adapter = _getAdapter();
    if (!adapter)
        return [];
    try {
        const rows = adapter
            .prepare("SELECT * FROM memory_sources ORDER BY imported_at DESC LIMIT :limit")
            .all({ ":limit": limit });
        return rows.map(rowToSource);
    }
    catch {
        return [];
    }
}
export function getMemorySource(id) {
    if (!isDbAvailable())
        return null;
    const adapter = _getAdapter();
    if (!adapter)
        return null;
    try {
        const row = adapter.prepare("SELECT * FROM memory_sources WHERE id = :id").get({ ":id": id });
        return row ? rowToSource(row) : null;
    }
    catch {
        return null;
    }
}
export function deleteMemorySource(id) {
    if (!isDbAvailable())
        return false;
    try {
        return deleteMemorySourceRow(id);
    }
    catch {
        return false;
    }
}
