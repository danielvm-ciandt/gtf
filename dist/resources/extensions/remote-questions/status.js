/**
 * Remote Questions — status helpers
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readPromptRecord } from "./store.js";
function getGsdHome() {
    return process.env.GSD_HOME || join(homedir(), ".gsd");
}
export function getLatestPromptSummary() {
    const runtimeDir = join(getGsdHome(), "runtime", "remote-questions");
    if (!existsSync(runtimeDir))
        return null;
    const files = readdirSync(runtimeDir).filter((f) => f.endsWith(".json"));
    if (files.length === 0)
        return null;
    let latest = null;
    for (const file of files) {
        const record = readPromptRecord(file.replace(/\.json$/, ""));
        if (!record)
            continue;
        if (!latest || record.updatedAt > latest.updatedAt) {
            latest = { id: record.id, status: record.status, updatedAt: record.updatedAt };
        }
    }
    return latest;
}
