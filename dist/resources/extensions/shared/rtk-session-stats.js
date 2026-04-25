import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatTokenCount } from "./format-utils.js";
import { buildRtkEnv, isRtkEnabled, resolveRtkBinaryPath } from "./rtk.js";
const SESSION_BASELINES_FILE = "rtk-session-baselines.json";
const CURRENT_SUMMARY_TTL_MS = 15_000;
const CURRENT_SUMMARY_TIMEOUT_MS = 5_000;
const MAX_BASELINE_SESSIONS = 200;
let cachedSummary = null;
function getRuntimeDir(basePath) {
    return join(basePath, ".gsd", "runtime");
}
function getBaselinesPath(basePath) {
    return join(getRuntimeDir(basePath), SESSION_BASELINES_FILE);
}
function defaultStore() {
    return { version: 1, sessions: {} };
}
function loadBaselineStore(basePath) {
    const path = getBaselinesPath(basePath);
    if (!existsSync(path))
        return defaultStore();
    try {
        const parsed = JSON.parse(readFileSync(path, "utf-8"));
        if (parsed.version !== 1 || typeof parsed.sessions !== "object" || parsed.sessions === null) {
            return defaultStore();
        }
        return {
            version: 1,
            sessions: parsed.sessions,
        };
    }
    catch {
        return defaultStore();
    }
}
function saveBaselineStore(basePath, store) {
    const runtimeDir = getRuntimeDir(basePath);
    mkdirSync(runtimeDir, { recursive: true });
    const entries = Object.entries(store.sessions)
        .sort((left, right) => right[1].updatedAt.localeCompare(left[1].updatedAt))
        .slice(0, MAX_BASELINE_SESSIONS);
    const normalized = {
        version: 1,
        sessions: Object.fromEntries(entries),
    };
    writeFileSync(getBaselinesPath(basePath), JSON.stringify(normalized, null, 2), "utf-8");
}
function normalizeSummary(raw) {
    if (!raw || typeof raw !== "object")
        return null;
    const summary = raw;
    return {
        totalCommands: Number(summary.total_commands ?? 0),
        totalInput: Number(summary.total_input ?? 0),
        totalOutput: Number(summary.total_output ?? 0),
        totalSaved: Number(summary.total_saved ?? 0),
        avgSavingsPct: Number(summary.avg_savings_pct ?? 0),
        totalTimeMs: Number(summary.total_time_ms ?? 0),
        avgTimeMs: Number(summary.avg_time_ms ?? 0),
    };
}
export function readCurrentRtkGainSummary(env = process.env) {
    if (!isRtkEnabled(env))
        return null;
    const binaryPath = resolveRtkBinaryPath({ env });
    if (!binaryPath)
        return null;
    if (cachedSummary &&
        cachedSummary.binaryPath === binaryPath &&
        Date.now() - cachedSummary.at < CURRENT_SUMMARY_TTL_MS) {
        return cachedSummary.summary;
    }
    const result = spawnSync(binaryPath, ["gain", "--all", "--format", "json"], {
        encoding: "utf-8",
        env: buildRtkEnv(env),
        stdio: ["ignore", "pipe", "ignore"],
        timeout: CURRENT_SUMMARY_TIMEOUT_MS,
        // .cmd/.bat wrappers (used by fake-rtk in tests) require shell:true on Windows
        shell: /\.(cmd|bat)$/i.test(binaryPath),
    });
    if (result.error || result.status !== 0) {
        cachedSummary = { at: Date.now(), binaryPath, summary: null };
        return null;
    }
    try {
        const parsed = JSON.parse(result.stdout ?? "{}");
        const summary = normalizeSummary(parsed.summary ?? null);
        cachedSummary = { at: Date.now(), binaryPath, summary };
        return summary;
    }
    catch {
        cachedSummary = { at: Date.now(), binaryPath, summary: null };
        return null;
    }
}
function computeSavingsDelta(current, baseline) {
    const commands = Math.max(0, current.totalCommands - baseline.totalCommands);
    const inputTokens = Math.max(0, current.totalInput - baseline.totalInput);
    const outputTokens = Math.max(0, current.totalOutput - baseline.totalOutput);
    const savedTokens = Math.max(0, current.totalSaved - baseline.totalSaved);
    const totalTimeMs = Math.max(0, current.totalTimeMs - baseline.totalTimeMs);
    const avgTimeMs = commands > 0 ? Math.round(totalTimeMs / commands) : 0;
    const savingsPct = inputTokens > 0 ? (savedTokens / inputTokens) * 100 : 0;
    return {
        commands,
        inputTokens,
        outputTokens,
        savedTokens,
        savingsPct,
        totalTimeMs,
        avgTimeMs,
        updatedAt: new Date().toISOString(),
    };
}
export function ensureRtkSessionBaseline(basePath, sessionId, env = process.env) {
    if (!sessionId)
        return null;
    const current = readCurrentRtkGainSummary(env);
    if (!current)
        return null;
    const store = loadBaselineStore(basePath);
    const existing = store.sessions[sessionId];
    if (existing)
        return existing.summary;
    const now = new Date().toISOString();
    store.sessions[sessionId] = {
        summary: current,
        createdAt: now,
        updatedAt: now,
    };
    saveBaselineStore(basePath, store);
    return current;
}
export function getRtkSessionSavings(basePath, sessionId, env = process.env) {
    if (!sessionId)
        return null;
    const current = readCurrentRtkGainSummary(env);
    if (!current)
        return null;
    const store = loadBaselineStore(basePath);
    const existing = store.sessions[sessionId];
    if (!existing) {
        const now = new Date().toISOString();
        store.sessions[sessionId] = {
            summary: current,
            createdAt: now,
            updatedAt: now,
        };
        saveBaselineStore(basePath, store);
        return computeSavingsDelta(current, current);
    }
    if (current.totalCommands < existing.summary.totalCommands ||
        current.totalInput < existing.summary.totalInput ||
        current.totalSaved < existing.summary.totalSaved) {
        const now = new Date().toISOString();
        store.sessions[sessionId] = {
            summary: current,
            createdAt: existing.createdAt,
            updatedAt: now,
        };
        saveBaselineStore(basePath, store);
        return computeSavingsDelta(current, current);
    }
    existing.updatedAt = new Date().toISOString();
    saveBaselineStore(basePath, store);
    return computeSavingsDelta(current, existing.summary);
}
export function clearRtkSessionBaseline(basePath, sessionId) {
    if (!sessionId)
        return;
    const store = loadBaselineStore(basePath);
    if (!(sessionId in store.sessions))
        return;
    delete store.sessions[sessionId];
    saveBaselineStore(basePath, store);
}
export function formatRtkSavingsLabel(savings) {
    if (!savings)
        return null;
    if (savings.commands <= 0)
        return "rtk: waiting for shell usage";
    if (savings.inputTokens <= 0 && savings.outputTokens <= 0) {
        return `rtk: active (${savings.commands} cmd${savings.commands === 1 ? "" : "s"})`;
    }
    return `rtk: ${formatTokenCount(savings.savedTokens)} saved (${Math.round(savings.savingsPct)}%)`;
}
