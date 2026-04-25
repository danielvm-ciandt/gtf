// GSD Extension — Unit Ownership
// Opt-in per-unit ownership claims for multi-agent safety.
//
// An agent can claim a unit (task, slice) before working on it.
// complete-task and complete-slice enforce ownership when claims exist.
// Claims are stored in SQLite (.gsd/unit-claims.db) for atomic
// first-writer-wins semantics via INSERT OR IGNORE.
//
// Unit key format:
//   task:  "<milestoneId>/<sliceId>/<taskId>"
//   slice: "<milestoneId>/<sliceId>"
//
// Copyright (c) 2026 Jeremy McSpadden <jeremy@fluxlabs.net>
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const _require = createRequire(import.meta.url);
let providerName = null;
let providerModule = null;
let loadAttempted = false;
function suppressSqliteWarning() {
    const origEmit = process.emit;
    // Override via loose cast: Node's overloaded emit signature is not directly assignable.
    process.emit = function (event, ...args) {
        if (event === "warning" &&
            args[0] &&
            typeof args[0] === "object" &&
            "name" in args[0] &&
            args[0].name === "ExperimentalWarning" &&
            "message" in args[0] &&
            typeof args[0].message === "string" &&
            args[0].message.includes("SQLite")) {
            return false;
        }
        return origEmit.apply(process, [event, ...args]);
    };
}
function loadProvider() {
    if (loadAttempted)
        return;
    loadAttempted = true;
    try {
        suppressSqliteWarning();
        const mod = _require("node:sqlite");
        if (mod.DatabaseSync) {
            providerModule = mod;
            providerName = "node:sqlite";
            return;
        }
    }
    catch {
        // unavailable
    }
    try {
        const mod = _require("better-sqlite3");
        if (typeof mod === "function" || (mod && mod.default)) {
            providerModule = mod.default || mod;
            providerName = "better-sqlite3";
            return;
        }
    }
    catch {
        // unavailable
    }
}
function normalizeRow(row) {
    if (row == null)
        return undefined;
    if (Object.getPrototypeOf(row) === null) {
        return { ...row };
    }
    return row;
}
function openRawDb(path) {
    loadProvider();
    if (!providerModule || !providerName)
        return null;
    if (providerName === "node:sqlite") {
        const { DatabaseSync } = providerModule;
        return new DatabaseSync(path);
    }
    const Database = providerModule;
    return new Database(path);
}
function wrapDb(rawDb) {
    const db = rawDb;
    return {
        exec(sql) { db.exec(sql); },
        prepare(sql) {
            const raw = db.prepare(sql);
            return {
                run(...params) { return raw.run(...params); },
                get(...params) {
                    return normalizeRow(raw.get(...params));
                },
            };
        },
        close() { db.close(); },
    };
}
// ─── Per-basePath DB pool ────────────────────────────────────────────────
const dbPool = new Map();
function claimsDbPath(basePath) {
    return join(basePath, ".gsd", "unit-claims.db");
}
function getDb(basePath) {
    const existing = dbPool.get(basePath);
    if (existing)
        return existing;
    return null;
}
// ─── Key Builders ────────────────────────────────────────────────────────
export function taskUnitKey(milestoneId, sliceId, taskId) {
    return `${milestoneId}/${sliceId}/${taskId}`;
}
export function sliceUnitKey(milestoneId, sliceId) {
    return `${milestoneId}/${sliceId}`;
}
// ─── Lifecycle ───────────────────────────────────────────────────────────
/**
 * Initialize the ownership SQLite database for a given basePath.
 * Creates .gsd/ directory and unit-claims.db with the unit_claims table.
 * Safe to call multiple times (idempotent).
 */
export function initOwnershipTable(basePath) {
    if (dbPool.has(basePath))
        return;
    const dir = join(basePath, ".gsd");
    mkdirSync(dir, { recursive: true });
    const raw = openRawDb(claimsDbPath(basePath));
    if (!raw) {
        throw new Error("No SQLite provider available for unit-ownership");
    }
    const db = wrapDb(raw);
    db.exec("PRAGMA journal_mode=WAL");
    db.exec("PRAGMA busy_timeout = 5000");
    db.exec("PRAGMA synchronous = NORMAL");
    db.exec(`
    CREATE TABLE IF NOT EXISTS unit_claims (
      unit_key TEXT PRIMARY KEY,
      agent_name TEXT NOT NULL,
      claimed_at TEXT NOT NULL
    )
  `);
    dbPool.set(basePath, db);
}
/**
 * Close the ownership database for a given basePath.
 * Safe to call even if not initialized.
 */
export function closeOwnershipDb(basePath) {
    const db = dbPool.get(basePath);
    if (!db)
        return;
    try {
        db.close();
    }
    catch { /* swallow */ }
    dbPool.delete(basePath);
}
// ─── Public API ──────────────────────────────────────────────────────────
/**
 * Claim a unit for an agent.
 * Uses INSERT OR IGNORE for atomic first-writer-wins semantics.
 * Returns true if the claim was acquired (or the same agent already owns it).
 * Returns false if a different agent already owns the unit.
 */
export function claimUnit(basePath, unitKey, agentName) {
    const db = getDb(basePath);
    if (!db) {
        // Auto-init if not already initialized (backward compat)
        initOwnershipTable(basePath);
        return claimUnit(basePath, unitKey, agentName);
    }
    // INSERT OR IGNORE: if the row already exists, this is a no-op.
    // The PRIMARY KEY constraint on unit_key prevents duplicate claims.
    db.prepare("INSERT OR IGNORE INTO unit_claims (unit_key, agent_name, claimed_at) VALUES (?, ?, ?)").run(unitKey, agentName, new Date().toISOString());
    // Check who owns it now
    const row = db.prepare("SELECT agent_name FROM unit_claims WHERE unit_key = ?").get(unitKey);
    const owner = row?.agent_name;
    return owner === agentName;
}
/**
 * Release a unit claim (remove it from the claims table).
 */
export function releaseUnit(basePath, unitKey) {
    const db = getDb(basePath);
    if (!db)
        return;
    db.prepare("DELETE FROM unit_claims WHERE unit_key = ?").run(unitKey);
}
/**
 * Get the current owner of a unit, or null if unclaimed.
 */
export function getOwner(basePath, unitKey) {
    const db = getDb(basePath);
    if (!db)
        return null;
    const row = db.prepare("SELECT agent_name FROM unit_claims WHERE unit_key = ?").get(unitKey);
    return row?.agent_name ?? null;
}
/**
 * Check if an actor is authorized to operate on a unit.
 * Returns null if ownership passes (or is unclaimed).
 * Returns an error string if a different agent owns the unit.
 */
export function checkOwnership(basePath, unitKey, actorName) {
    if (!actorName)
        return null; // no actor identity provided — opt-in, so allow
    const owner = getOwner(basePath, unitKey);
    if (owner === null)
        return null; // unit unclaimed
    if (owner === actorName)
        return null; // actor is the owner
    return `Unit ${unitKey} is owned by ${owner}, not ${actorName}`;
}
