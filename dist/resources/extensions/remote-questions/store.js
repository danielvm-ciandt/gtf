/**
 * Remote Questions — durable prompt store
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
function getGsdHome() {
    return process.env.GSD_HOME || join(homedir(), ".gsd");
}
function runtimeDir() {
    return join(getGsdHome(), "runtime", "remote-questions");
}
function recordPath(id) {
    return join(runtimeDir(), `${id}.json`);
}
export function createPromptRecord(prompt) {
    return {
        version: 1,
        id: prompt.id,
        createdAt: prompt.createdAt,
        updatedAt: Date.now(),
        status: "pending",
        channel: prompt.channel,
        timeoutAt: prompt.timeoutAt,
        pollIntervalMs: prompt.pollIntervalMs,
        questions: prompt.questions,
        context: prompt.context,
    };
}
export function writePromptRecord(record) {
    mkdirSync(runtimeDir(), { recursive: true });
    writeFileSync(recordPath(record.id), JSON.stringify(record, null, 2) + "\n", "utf-8");
}
export function readPromptRecord(id) {
    const path = recordPath(id);
    if (!existsSync(path))
        return null;
    try {
        return JSON.parse(readFileSync(path, "utf-8"));
    }
    catch {
        return null;
    }
}
export function updatePromptRecord(id, updates) {
    const current = readPromptRecord(id);
    if (!current)
        return null;
    const merged = {
        ...current,
        ...updates,
        updatedAt: Date.now(),
    };
    // After spreading, the merged object satisfies one of the union members
    // but TypeScript can't prove it statically. The invariant is maintained
    // by callers: once `ref` is set via markPromptDispatched it is never removed.
    const next = merged;
    writePromptRecord(next);
    return next;
}
export function markPromptDispatched(id, ref) {
    return updatePromptRecord(id, { ref, status: "pending" });
}
export function markPromptAnswered(id, response) {
    return updatePromptRecord(id, { response, status: "answered", lastPollAt: Date.now() });
}
export function markPromptStatus(id, status, lastError) {
    return updatePromptRecord(id, {
        status,
        lastPollAt: Date.now(),
        ...(lastError ? { lastError } : {}),
    });
}
