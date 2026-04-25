import { createHash, randomUUID } from "node:crypto";
import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteSync } from "./atomic-write.js";
import { withFileLockSync } from "./file-lock.js";
import { logWarning } from "./workflow-logger.js";
// ─── Session ID ───────────────────────────────────────────────────────────
/**
 * Engine-generated session ID — stable for the lifetime of this process.
 * Agents can reference this to correlate all events from one run.
 */
const ENGINE_SESSION_ID = randomUUID();
export function getSessionId() {
    return ENGINE_SESSION_ID;
}
// ─── appendEvent ─────────────────────────────────────────────────────────
/**
 * Append one event to .gsd/event-log.jsonl.
 * Computes a content hash from cmd+params (deterministic, independent of ts/actor/session).
 * Creates .gsd directory if needed.
 */
export function appendEvent(basePath, event) {
    const hash = createHash("sha256")
        .update(JSON.stringify({ cmd: event.cmd, params: event.params }))
        .digest("hex")
        .slice(0, 16);
    const fullEvent = {
        v: 2,
        ...event,
        hash,
        session_id: ENGINE_SESSION_ID,
    };
    const dir = join(basePath, ".gsd");
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, "event-log.jsonl"), JSON.stringify(fullEvent) + "\n", "utf-8");
}
// ─── readEvents ──────────────────────────────────────────────────────────
/**
 * Read all events from a JSONL file.
 * Returns empty array if file doesn't exist.
 * Corrupted lines are skipped with stderr warning.
 */
export function readEvents(logPath) {
    if (!existsSync(logPath)) {
        return [];
    }
    const content = readFileSync(logPath, "utf-8");
    const lines = content.split("\n").filter((l) => l.length > 0);
    const events = [];
    for (const line of lines) {
        try {
            events.push(JSON.parse(line));
        }
        catch {
            logWarning("event-log", `skipping corrupted event line (${line.length} bytes)`);
        }
    }
    return events;
}
// ─── findForkPoint ───────────────────────────────────────────────────────
/**
 * Find the index of the last common event between two logs by comparing hashes.
 * Returns -1 if the first events differ (completely diverged).
 * If one log is a prefix of the other, returns length of shorter - 1.
 */
export function findForkPoint(logA, logB) {
    const minLen = Math.min(logA.length, logB.length);
    let lastCommon = -1;
    for (let i = 0; i < minLen; i++) {
        if (logA[i].hash === logB[i].hash) {
            lastCommon = i;
        }
        else {
            break;
        }
    }
    return lastCommon;
}
// ─── compactMilestoneEvents ─────────────────────────────────────────────────
/**
 * Archive a milestone's events from the active log to a separate file.
 * Active log retains only events from other milestones.
 * Archived file is kept on disk for forensics.
 *
 * @param basePath - Project root (parent of .gsd/)
 * @param milestoneId - The milestone whose events should be archived
 * @returns { archived: number } — count of events moved to archive
 */
export function compactMilestoneEvents(basePath, milestoneId) {
    const logPath = join(basePath, ".gsd", "event-log.jsonl");
    const archivePath = join(basePath, ".gsd", `event-log-${milestoneId}.jsonl.archived`);
    return withFileLockSync(logPath, () => {
        const allEvents = readEvents(logPath);
        // Single-pass partition to halve the work (per reviewer agent)
        const toArchive = [];
        const remaining = [];
        for (const e of allEvents) {
            if (e.params.milestoneId === milestoneId) {
                toArchive.push(e);
            }
            else {
                remaining.push(e);
            }
        }
        if (toArchive.length === 0) {
            return { archived: 0 };
        }
        // Write archived events to .jsonl.archived file (crash-safe)
        atomicWriteSync(archivePath, toArchive.map((e) => JSON.stringify(e)).join("\n") + "\n");
        // Truncate active log to remaining events only
        atomicWriteSync(logPath, remaining.length > 0
            ? remaining.map((e) => JSON.stringify(e)).join("\n") + "\n"
            : "");
        return { archived: toArchive.length };
    });
}
