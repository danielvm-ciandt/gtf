/**
 * GSD Slice Parallel Orchestrator — Engine for parallel slice execution
 * within a single milestone.
 *
 * Mirrors the existing parallel-orchestrator.ts pattern at slice scope
 * instead of milestone scope. Workers are separate processes spawned via
 * child_process, each running in its own git worktree with GSD_SLICE_LOCK
 * + GSD_MILESTONE_LOCK env vars set.
 *
 * Key differences from milestone-level parallelism:
 * - Scope: slices within one milestone, not milestones within a project
 * - Lock env: GSD_SLICE_LOCK (in addition to GSD_MILESTONE_LOCK)
 * - Conflict check: file overlap between slice plans (slice-parallel-conflict.ts)
 */
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gsdRoot } from "./paths.js";
import { createWorktree, worktreePath, removeWorktree } from "./worktree-manager.js";
import { writeSessionStatus, } from "./session-status-io.js";
import { hasFileConflict } from "./slice-parallel-conflict.js";
import { getErrorMessage } from "./error-utils.js";
import { selectConflictFreeBatch } from "./uok/execution-graph.js";
// ─── Module State ──────────────────────────────────────────────────────────
let sliceState = null;
// ─── Public API ────────────────────────────────────────────────────────────
/**
 * Check whether slice-level parallel is currently active.
 */
export function isSliceParallelActive() {
    return sliceState?.active === true;
}
/**
 * Get current slice orchestrator state (read-only snapshot).
 */
export function getSliceOrchestratorState() {
    return sliceState;
}
/**
 * Start parallel execution for eligible slices within a milestone.
 *
 * For each eligible slice: create a worktree, spawn `gsd --mode json --print "/gsd auto"`
 * with env GSD_SLICE_LOCK=<SID> + GSD_MILESTONE_LOCK=<MID> + GSD_PARALLEL_WORKER=1.
 */
export async function startSliceParallel(basePath, milestoneId, eligibleSlices, opts = {}) {
    // Prevent nesting: if already a parallel worker, refuse
    if (process.env.GSD_PARALLEL_WORKER) {
        return { started: [], errors: [{ sid: "all", error: "Cannot start slice-parallel from within a parallel worker" }] };
    }
    const maxWorkers = opts.maxWorkers ?? 2;
    const budgetCeiling = opts.budgetCeiling;
    // Initialize orchestrator state
    sliceState = {
        active: true,
        workers: new Map(),
        totalCost: 0,
        budgetCeiling,
        maxWorkers,
        startedAt: Date.now(),
        basePath,
    };
    const started = [];
    const errors = [];
    // Filter out conflicting slices (conservative: check all pairs)
    const safeSlices = filterConflictingSlices(basePath, milestoneId, eligibleSlices, opts.useExecutionGraph === true);
    // Limit to maxWorkers
    const toSpawn = safeSlices.slice(0, maxWorkers);
    for (const slice of toSpawn) {
        try {
            // Create worktree for this slice
            const wtBranch = `slice/${milestoneId}/${slice.id}`;
            const wtName = `${milestoneId}-${slice.id}`;
            const wtPath = worktreePath(basePath, wtName);
            if (!existsSync(wtPath)) {
                createWorktree(basePath, wtName, { branch: wtBranch });
            }
            // Create worker info
            const worker = {
                milestoneId,
                sliceId: slice.id,
                pid: 0,
                process: null,
                worktreePath: wtPath,
                startedAt: Date.now(),
                state: "running",
                completedUnits: 0,
                cost: 0,
            };
            sliceState.workers.set(slice.id, worker);
            // Spawn worker
            const spawned = spawnSliceWorker(basePath, milestoneId, slice.id);
            if (spawned) {
                started.push(slice.id);
            }
            else {
                errors.push({ sid: slice.id, error: "Failed to spawn worker process" });
                worker.state = "error";
            }
        }
        catch (err) {
            errors.push({ sid: slice.id, error: getErrorMessage(err) });
            // Best-effort cleanup of partially created worktree
            const wtName = `${milestoneId}-${slice.id}`;
            try {
                removeWorktree(basePath, wtName, { deleteBranch: true, force: true });
            }
            catch { /* ignore cleanup failures */ }
        }
    }
    // If nothing started, deactivate
    if (started.length === 0) {
        sliceState.active = false;
    }
    return { started, errors };
}
/**
 * Stop all slice-parallel workers and deactivate.
 */
export function stopSliceParallel() {
    if (!sliceState)
        return;
    for (const worker of sliceState.workers.values()) {
        if (worker.process) {
            try {
                worker.process.kill("SIGTERM");
            }
            catch { /* already dead */ }
        }
        worker.cleanup?.();
        worker.cleanup = undefined;
        worker.process = null;
        worker.state = "stopped";
        // Clean up worktree created for this worker
        const wtName = `${worker.milestoneId}-${worker.sliceId}`;
        try {
            removeWorktree(sliceState.basePath, wtName, { deleteBranch: true, force: true });
        }
        catch { /* best-effort cleanup */ }
    }
    sliceState.active = false;
}
/**
 * Get aggregate cost across all slice workers.
 */
export function getSliceAggregateCost() {
    if (!sliceState)
        return 0;
    let total = 0;
    for (const w of sliceState.workers.values()) {
        total += w.cost;
    }
    return total;
}
/**
 * Check if budget ceiling has been exceeded.
 */
export function isSliceBudgetExceeded() {
    if (!sliceState?.budgetCeiling)
        return false;
    return getSliceAggregateCost() >= sliceState.budgetCeiling;
}
/**
 * Reset module state (for testing).
 */
export function resetSliceOrchestrator() {
    if (sliceState) {
        for (const w of sliceState.workers.values()) {
            w.cleanup?.();
        }
    }
    sliceState = null;
}
// ─── Internal: Conflict Filtering ──────────────────────────────────────────
/**
 * Remove slices that have file conflicts with each other.
 * Greedy: add slices to the safe set in order; skip any that conflict
 * with an already-included slice.
 */
function filterConflictingSlices(basePath, milestoneId, slices, useExecutionGraph) {
    if (useExecutionGraph) {
        const selectedIds = selectConflictFreeBatch({
            orderedIds: slices.map((slice) => slice.id),
            maxParallel: slices.length,
            hasConflict: (candidate, existing) => hasFileConflict(basePath, milestoneId, candidate, existing),
        });
        const selected = new Set(selectedIds);
        return slices.filter((slice) => selected.has(slice.id));
    }
    const safe = [];
    for (const candidate of slices) {
        let conflictsWithSafe = false;
        for (const existing of safe) {
            if (hasFileConflict(basePath, milestoneId, candidate.id, existing.id)) {
                conflictsWithSafe = true;
                break;
            }
        }
        if (!conflictsWithSafe) {
            safe.push(candidate);
        }
    }
    return safe;
}
// ─── Internal: Worker Spawning ─────────────────────────────────────────────
/**
 * Resolve the GSD CLI binary path.
 * Same logic as parallel-orchestrator.ts resolveGsdBin().
 */
function resolveGsdBin() {
    if (process.env.GSD_BIN_PATH && existsSync(process.env.GSD_BIN_PATH)) {
        return process.env.GSD_BIN_PATH;
    }
    let thisDir;
    try {
        thisDir = dirname(fileURLToPath(import.meta.url));
    }
    catch {
        thisDir = process.cwd();
    }
    const candidates = [
        join(thisDir, "..", "..", "..", "loader.js"),
        join(thisDir, "..", "..", "..", "..", "dist", "loader.js"),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
/**
 * Spawn a worker process for a slice.
 * The worker runs `gsd --mode json --print "/gsd auto"` in the slice's worktree
 * with GSD_SLICE_LOCK, GSD_MILESTONE_LOCK, and GSD_PARALLEL_WORKER set.
 */
function spawnSliceWorker(basePath, milestoneId, sliceId) {
    if (!sliceState)
        return false;
    const worker = sliceState.workers.get(sliceId);
    if (!worker)
        return false;
    if (worker.process)
        return true;
    const binPath = resolveGsdBin();
    if (!binPath)
        return false;
    let child;
    try {
        child = spawn(process.execPath, [binPath, "--mode", "json", "--print", "/gsd auto"], {
            cwd: worker.worktreePath,
            env: {
                ...process.env,
                GSD_SLICE_LOCK: sliceId,
                GSD_MILESTONE_LOCK: milestoneId,
                GSD_PROJECT_ROOT: basePath,
                GSD_PARALLEL_WORKER: "1",
            },
            stdio: ["ignore", "pipe", "pipe"],
            detached: false,
        });
    }
    catch {
        return false;
    }
    child.on("error", () => {
        if (!sliceState)
            return;
        const w = sliceState.workers.get(sliceId);
        if (w) {
            w.process = null;
        }
    });
    worker.process = child;
    worker.pid = child.pid ?? 0;
    if (!child.pid) {
        worker.process = null;
        return false;
    }
    // ── NDJSON stdout monitoring ────────────────────────────────────────
    if (child.stdout) {
        let stdoutBuffer = "";
        child.stdout.on("data", (data) => {
            stdoutBuffer += data.toString();
            const lines = stdoutBuffer.split("\n");
            stdoutBuffer = lines.pop() || "";
            for (const line of lines) {
                processSliceWorkerLine(basePath, milestoneId, sliceId, line);
            }
        });
        child.stdout.on("close", () => {
            if (stdoutBuffer.trim()) {
                processSliceWorkerLine(basePath, milestoneId, sliceId, stdoutBuffer);
            }
        });
    }
    if (child.stderr) {
        child.stderr.on("data", (data) => {
            appendSliceWorkerLog(basePath, milestoneId, sliceId, data.toString());
        });
    }
    // Update session status
    writeSessionStatus(basePath, {
        milestoneId: `${milestoneId}/${sliceId}`,
        pid: worker.pid,
        state: "running",
        currentUnit: null,
        completedUnits: worker.completedUnits,
        cost: worker.cost,
        lastHeartbeat: Date.now(),
        startedAt: worker.startedAt,
        worktreePath: worker.worktreePath,
    });
    // Store cleanup function
    worker.cleanup = () => {
        child.stdout?.removeAllListeners();
        child.stderr?.removeAllListeners();
        child.removeAllListeners();
    };
    // Handle worker exit
    child.on("exit", (code) => {
        if (!sliceState)
            return;
        const w = sliceState.workers.get(sliceId);
        if (!w)
            return;
        w.cleanup?.();
        w.cleanup = undefined;
        w.process = null;
        if (w.state === "stopped")
            return;
        if (code === 0) {
            w.state = "stopped";
        }
        else {
            w.state = "error";
            appendSliceWorkerLog(basePath, milestoneId, sliceId, `\n[slice-orchestrator] worker exited with code ${code ?? "null"}\n`);
        }
        writeSessionStatus(basePath, {
            milestoneId: `${milestoneId}/${sliceId}`,
            pid: w.pid,
            state: w.state,
            currentUnit: null,
            completedUnits: w.completedUnits,
            cost: w.cost,
            lastHeartbeat: Date.now(),
            startedAt: w.startedAt,
            worktreePath: w.worktreePath,
        });
    });
    return true;
}
// ─── NDJSON Processing ──────────────────────────────────────────────────────
/**
 * Process a single NDJSON line from a slice worker's stdout.
 * Extracts cost from message_end events.
 */
function processSliceWorkerLine(_basePath, _milestoneId, sliceId, line) {
    if (!line.trim() || !sliceState)
        return;
    let event;
    try {
        event = JSON.parse(line);
    }
    catch {
        return;
    }
    const type = String(event.type ?? "");
    if (type === "message_end") {
        const worker = sliceState.workers.get(sliceId);
        if (worker) {
            const usage = event.usage;
            if (usage?.cost && typeof usage.cost === "number") {
                worker.cost += usage.cost;
                sliceState.totalCost += usage.cost;
            }
            worker.completedUnits++;
        }
    }
}
// ─── Logging ────────────────────────────────────────────────────────────────
function sliceLogDir(basePath) {
    return join(gsdRoot(basePath), "parallel", "slice-logs");
}
function appendSliceWorkerLog(basePath, milestoneId, sliceId, text) {
    const dir = sliceLogDir(basePath);
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, `${milestoneId}-${sliceId}.log`), text);
}
