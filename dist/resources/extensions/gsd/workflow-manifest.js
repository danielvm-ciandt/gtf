import { _getAdapter, readTransaction, restoreManifest, } from "./gsd-db.js";
import { atomicWriteSync } from "./atomic-write.js";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
// ─── helpers ─────────────────────────────────────────────────────────────
function requireDb() {
    const db = _getAdapter();
    if (!db)
        throw new Error("workflow-manifest: No database open");
    return db;
}
/**
 * Coerce a raw DB value to a number, returning `fallback` for
 * null/undefined/non-numeric strings (e.g. "-", "N/A", "").
 * SQLite can store TEXT in INTEGER columns after migrations or manual inserts.
 */
export function toNumeric(value, fallback = null) {
    if (value === null || value === undefined)
        return fallback;
    if (typeof value === "number")
        return Number.isFinite(value) ? value : fallback;
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed === "" || trimmed === "-" || trimmed === "N/A")
            return fallback;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : fallback;
    }
    return fallback;
}
// ─── snapshotState ───────────────────────────────────────────────────────
/**
 * Capture complete DB state as a StateManifest.
 * Reads all rows from milestones, slices, tasks, decisions, verification_evidence.
 *
 * Note: rows returned from raw queries are plain objects with TEXT columns for
 * JSON arrays. We parse them into typed Row objects using the same logic as
 * gsd-db helper functions.
 */
export function snapshotState() {
    const db = requireDb();
    // Wrap all reads in a deferred transaction so the snapshot is consistent
    // (all SELECTs see the same DB state even if a concurrent write lands between them).
    return readTransaction(() => {
        const rawMilestones = db.prepare("SELECT * FROM milestones ORDER BY id").all();
        const milestones = rawMilestones.map((r) => ({
            id: r["id"],
            title: r["title"],
            status: r["status"],
            depends_on: JSON.parse(r["depends_on"] || "[]"),
            created_at: r["created_at"],
            completed_at: r["completed_at"] ?? null,
            vision: r["vision"] ?? "",
            success_criteria: JSON.parse(r["success_criteria"] || "[]"),
            key_risks: JSON.parse(r["key_risks"] || "[]"),
            proof_strategy: JSON.parse(r["proof_strategy"] || "[]"),
            verification_contract: r["verification_contract"] ?? "",
            verification_integration: r["verification_integration"] ?? "",
            verification_operational: r["verification_operational"] ?? "",
            verification_uat: r["verification_uat"] ?? "",
            definition_of_done: JSON.parse(r["definition_of_done"] || "[]"),
            requirement_coverage: r["requirement_coverage"] ?? "",
            boundary_map_markdown: r["boundary_map_markdown"] ?? "",
        }));
        const rawSlices = db.prepare("SELECT * FROM slices ORDER BY milestone_id, sequence, id").all();
        const slices = rawSlices.map((r) => ({
            milestone_id: r["milestone_id"],
            id: r["id"],
            title: r["title"],
            status: r["status"],
            risk: r["risk"],
            depends: JSON.parse(r["depends"] || "[]"),
            demo: r["demo"] ?? "",
            created_at: r["created_at"],
            completed_at: r["completed_at"] ?? null,
            full_summary_md: r["full_summary_md"] ?? "",
            full_uat_md: r["full_uat_md"] ?? "",
            goal: r["goal"] ?? "",
            success_criteria: r["success_criteria"] ?? "",
            proof_level: r["proof_level"] ?? "",
            integration_closure: r["integration_closure"] ?? "",
            observability_impact: r["observability_impact"] ?? "",
            sequence: toNumeric(r["sequence"], 0),
            replan_triggered_at: r["replan_triggered_at"] ?? null,
            is_sketch: toNumeric(r["is_sketch"], 0),
            sketch_scope: r["sketch_scope"] ?? "",
        }));
        const rawTasks = db.prepare("SELECT * FROM tasks ORDER BY milestone_id, slice_id, sequence, id").all();
        const tasks = rawTasks.map((r) => ({
            milestone_id: r["milestone_id"],
            slice_id: r["slice_id"],
            id: r["id"],
            title: r["title"],
            status: r["status"],
            one_liner: r["one_liner"] ?? "",
            narrative: r["narrative"] ?? "",
            verification_result: r["verification_result"] ?? "",
            duration: r["duration"] ?? "",
            completed_at: r["completed_at"] ?? null,
            blocker_discovered: r["blocker_discovered"] === 1,
            deviations: r["deviations"] ?? "",
            known_issues: r["known_issues"] ?? "",
            key_files: JSON.parse(r["key_files"] || "[]"),
            key_decisions: JSON.parse(r["key_decisions"] || "[]"),
            full_summary_md: r["full_summary_md"] ?? "",
            description: r["description"] ?? "",
            estimate: r["estimate"] ?? "",
            files: JSON.parse(r["files"] || "[]"),
            verify: r["verify"] ?? "",
            inputs: JSON.parse(r["inputs"] || "[]"),
            expected_output: JSON.parse(r["expected_output"] || "[]"),
            observability_impact: r["observability_impact"] ?? "",
            full_plan_md: r["full_plan_md"] ?? "",
            sequence: toNumeric(r["sequence"], 0),
            blocker_source: r["blocker_source"] ?? "",
            escalation_pending: toNumeric(r["escalation_pending"], 0),
            escalation_awaiting_review: toNumeric(r["escalation_awaiting_review"], 0),
            escalation_artifact_path: r["escalation_artifact_path"] ?? null,
            escalation_override_applied_at: r["escalation_override_applied_at"] ?? null,
        }));
        const rawDecisions = db.prepare("SELECT * FROM decisions ORDER BY seq").all();
        const decisions = rawDecisions.map((r) => ({
            seq: toNumeric(r["seq"], 0),
            id: r["id"],
            when_context: r["when_context"] ?? "",
            scope: r["scope"] ?? "",
            decision: r["decision"] ?? "",
            choice: r["choice"] ?? "",
            rationale: r["rationale"] ?? "",
            revisable: r["revisable"] ?? "",
            made_by: r["made_by"] ?? "agent",
            source: r["source"] ?? "discussion",
            superseded_by: r["superseded_by"] ?? null,
        }));
        const rawEvidence = db.prepare("SELECT * FROM verification_evidence ORDER BY id").all();
        const verification_evidence = rawEvidence.map((r) => ({
            id: r["id"],
            task_id: r["task_id"],
            slice_id: r["slice_id"],
            milestone_id: r["milestone_id"],
            command: r["command"],
            exit_code: toNumeric(r["exit_code"]),
            verdict: r["verdict"] ?? "",
            duration_ms: toNumeric(r["duration_ms"]),
            created_at: r["created_at"],
        }));
        const result = {
            version: 1,
            exported_at: new Date().toISOString(),
            milestones,
            slices,
            tasks,
            decisions,
            verification_evidence,
        };
        return result;
    });
}
// ─── restore ─────────────────────────────────────────────────────────────
//
// The actual restore() implementation lives in gsd-db.ts (single-writer
// invariant). This module only orchestrates reading the manifest file
// and handing it to the writer.
// ─── writeManifest ───────────────────────────────────────────────────────
/**
 * Write current DB state to .gsd/state-manifest.json via atomicWriteSync.
 * Uses JSON.stringify with 2-space indent for git three-way merge friendliness.
 */
export function writeManifest(basePath) {
    const manifest = snapshotState();
    const json = JSON.stringify(manifest, null, 2);
    const dir = join(basePath, ".gsd");
    mkdirSync(dir, { recursive: true });
    atomicWriteSync(join(dir, "state-manifest.json"), json);
}
// ─── readManifest ────────────────────────────────────────────────────────
/**
 * Read state-manifest.json and return parsed manifest, or null if not found.
 */
export function readManifest(basePath) {
    const manifestPath = join(basePath, ".gsd", "state-manifest.json");
    if (!existsSync(manifestPath)) {
        return null;
    }
    const raw = readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    if (parsed.version !== 1) {
        throw new Error(`Unsupported manifest version: ${parsed.version}`);
    }
    // Validate required fields to avoid cryptic errors during restore
    if (!Array.isArray(parsed.milestones) || !Array.isArray(parsed.slices) ||
        !Array.isArray(parsed.tasks) || !Array.isArray(parsed.decisions) ||
        !Array.isArray(parsed.verification_evidence)) {
        throw new Error("Malformed manifest: missing or invalid required arrays");
    }
    return parsed;
}
// ─── bootstrapFromManifest ──────────────────────────────────────────────
/**
 * Read state-manifest.json and restore DB state from it.
 * Returns true if bootstrap succeeded, false if manifest file doesn't exist.
 */
export function bootstrapFromManifest(basePath) {
    const manifest = readManifest(basePath);
    if (!manifest) {
        return false;
    }
    restoreManifest(manifest);
    return true;
}
