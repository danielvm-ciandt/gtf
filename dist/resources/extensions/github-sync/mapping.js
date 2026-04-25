/**
 * Persistence layer for the GitHub sync mapping.
 *
 * The mapping lives at `.gsd/github-sync.json` and tracks which GSD
 * entities have been synced to which GitHub entities (issues, PRs,
 * milestones) along with their numbers and sync timestamps.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteSync } from "../gsd/atomic-write.js";
const MAPPING_FILENAME = "github-sync.json";
function mappingPath(basePath) {
    return join(basePath, ".gsd", MAPPING_FILENAME);
}
// ─── Load / Save ────────────────────────────────────────────────────────────
export function loadSyncMapping(basePath) {
    const path = mappingPath(basePath);
    if (!existsSync(path))
        return null;
    try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed?.version !== 1)
            return null;
        return parsed;
    }
    catch {
        return null;
    }
}
export function saveSyncMapping(basePath, mapping) {
    const path = mappingPath(basePath);
    atomicWriteSync(path, JSON.stringify(mapping, null, 2) + "\n");
}
export function createEmptyMapping(repo) {
    return {
        version: 1,
        repo,
        milestones: {},
        slices: {},
        tasks: {},
    };
}
// ─── Accessors ──────────────────────────────────────────────────────────────
export function getMilestoneRecord(mapping, mid) {
    return mapping.milestones[mid] ?? null;
}
export function getSliceRecord(mapping, mid, sid) {
    return mapping.slices[`${mid}/${sid}`] ?? null;
}
export function getTaskRecord(mapping, mid, sid, tid) {
    return mapping.tasks[`${mid}/${sid}/${tid}`] ?? null;
}
export function getTaskIssueNumber(mapping, mid, sid, tid) {
    const record = getTaskRecord(mapping, mid, sid, tid);
    return record?.issueNumber ?? null;
}
// ─── Mutators ───────────────────────────────────────────────────────────────
export function setMilestoneRecord(mapping, mid, record) {
    mapping.milestones[mid] = record;
}
export function setSliceRecord(mapping, mid, sid, record) {
    mapping.slices[`${mid}/${sid}`] = record;
}
export function setTaskRecord(mapping, mid, sid, tid, record) {
    mapping.tasks[`${mid}/${sid}/${tid}`] = record;
}
