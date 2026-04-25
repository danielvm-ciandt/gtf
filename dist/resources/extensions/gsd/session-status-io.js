/**
 * GSD Session Status I/O
 *
 * File-based IPC protocol for coordinator-worker communication in
 * parallel milestone orchestration. Each worker writes its status to a
 * file; the coordinator reads all status files to monitor progress.
 *
 * Atomic writes (write to .tmp, then rename) prevent partial reads.
 * Signal files let the coordinator send pause/resume/stop/rebase to workers.
 * Stale detection combines PID liveness checks with heartbeat timeouts.
 */
import { unlinkSync, readdirSync, mkdirSync, existsSync, } from "node:fs";
import { join } from "node:path";
import { gsdRoot } from "./paths.js";
import { loadJsonFileOrNull, writeJsonFileAtomic } from "./json-persistence.js";
// ─── Constants ─────────────────────────────────────────────────────────────
const PARALLEL_DIR = "parallel";
const STATUS_SUFFIX = ".status.json";
const SIGNAL_SUFFIX = ".signal.json";
const DEFAULT_STALE_TIMEOUT_MS = 30_000;
function isSessionStatus(data) {
    return data !== null && typeof data === "object" && "milestoneId" in data && "pid" in data;
}
function isSignalMessage(data) {
    return data !== null && typeof data === "object" && "signal" in data && "sentAt" in data;
}
// ─── Helpers ───────────────────────────────────────────────────────────────
function parallelDir(basePath) {
    return join(gsdRoot(basePath), PARALLEL_DIR);
}
function statusPath(basePath, milestoneId) {
    return join(parallelDir(basePath), `${milestoneId}${STATUS_SUFFIX}`);
}
function signalPath(basePath, milestoneId) {
    return join(parallelDir(basePath), `${milestoneId}${SIGNAL_SUFFIX}`);
}
function ensureParallelDir(basePath) {
    const dir = parallelDir(basePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
function isPidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
// ─── Status I/O ────────────────────────────────────────────────────────────
/** Write session status atomically (write to .tmp, then rename). */
export function writeSessionStatus(basePath, status) {
    ensureParallelDir(basePath);
    writeJsonFileAtomic(statusPath(basePath, status.milestoneId), status);
}
/** Read a specific milestone's session status. */
export function readSessionStatus(basePath, milestoneId) {
    return loadJsonFileOrNull(statusPath(basePath, milestoneId), isSessionStatus);
}
/** Read all session status files from .gsd/parallel/. */
export function readAllSessionStatuses(basePath) {
    const dir = parallelDir(basePath);
    if (!existsSync(dir))
        return [];
    const results = [];
    try {
        for (const entry of readdirSync(dir)) {
            if (!entry.endsWith(STATUS_SUFFIX))
                continue;
            const status = loadJsonFileOrNull(join(dir, entry), isSessionStatus);
            if (status)
                results.push(status);
        }
    }
    catch { /* non-fatal */ }
    return results;
}
/** Remove a milestone's session status file. */
export function removeSessionStatus(basePath, milestoneId) {
    try {
        const p = statusPath(basePath, milestoneId);
        if (existsSync(p))
            unlinkSync(p);
    }
    catch { /* non-fatal */ }
}
// ─── Signal I/O ────────────────────────────────────────────────────────────
/** Write a signal file for a worker to consume. */
export function sendSignal(basePath, milestoneId, signal) {
    ensureParallelDir(basePath);
    const msg = { signal, sentAt: Date.now(), from: "coordinator" };
    writeJsonFileAtomic(signalPath(basePath, milestoneId), msg);
}
/** Read and delete a signal file (atomic consume). Returns null if no signal pending. */
export function consumeSignal(basePath, milestoneId) {
    const p = signalPath(basePath, milestoneId);
    const msg = loadJsonFileOrNull(p, isSignalMessage);
    if (msg) {
        try {
            unlinkSync(p);
        }
        catch { /* non-fatal */ }
    }
    return msg;
}
// ─── Stale Detection ───────────────────────────────────────────────────────
/** Check whether a session is stale (PID dead or heartbeat timed out). */
export function isSessionStale(status, timeoutMs = DEFAULT_STALE_TIMEOUT_MS) {
    if (!isPidAlive(status.pid))
        return true;
    const elapsed = Date.now() - status.lastHeartbeat;
    return elapsed > timeoutMs;
}
/** Find and remove stale sessions. Returns the milestone IDs that were cleaned up. */
export function cleanupStaleSessions(basePath, timeoutMs = DEFAULT_STALE_TIMEOUT_MS) {
    const removed = [];
    const statuses = readAllSessionStatuses(basePath);
    for (const status of statuses) {
        if (isSessionStale(status, timeoutMs)) {
            removeSessionStatus(basePath, status.milestoneId);
            // Also clean up any lingering signal file
            try {
                const sig = signalPath(basePath, status.milestoneId);
                if (existsSync(sig))
                    unlinkSync(sig);
            }
            catch { /* non-fatal */ }
            removed.push(status.milestoneId);
        }
    }
    return removed;
}
