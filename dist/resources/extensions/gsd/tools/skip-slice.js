/**
 * skip-slice handler — the core operation behind gsd_skip_slice.
 *
 * Marks a slice as skipped and cascades the skip to every non-closed task in
 * that slice. Without the task cascade the deep-check in
 * executeCompleteMilestone reports pending tasks inside the skipped slice and
 * blocks milestone completion (see #4375).
 *
 * This function performs DB writes only. The MCP wrapper in
 * bootstrap/db-tools.ts handles state-cache invalidation and STATE.md rebuild.
 */
import { getSlice, getSliceTasks, isDbAvailable, transaction, updateSliceStatus, updateTaskStatus, } from "../gsd-db.js";
import { isClosedStatus } from "../status-guards.js";
/**
 * Mark a slice as "skipped" and cascade the skip to every non-closed task in
 * that slice. Runs as a single transaction so slice status and task statuses
 * are always consistent.
 *
 * Behaviour summary:
 * - Unknown slice → returns {@link SkipSliceResult} with `error`.
 * - Slice already complete/done → returns `error` (cannot un-complete).
 * - Slice already skipped → still cascades leftover non-closed tasks
 *   (heals inconsistent historical state from projects that ran older
 *   versions before the #4375 cascade fix).
 * - Tasks in closed status (complete/done/skipped) are never downgraded.
 */
export function handleSkipSlice(params) {
    const base = {
        milestoneId: params.milestoneId,
        sliceId: params.sliceId,
        tasksSkipped: 0,
        wasAlreadySkipped: false,
        reason: params.reason,
    };
    // Fail loudly on a closed DB so a `null` from getSlice() inside the
    // transaction unambiguously means "slice not found", never "DB unavailable".
    // The MCP wrapper in bootstrap/db-tools.ts runs ensureDbOpen() before calling
    // this helper; this guard protects direct callers (tests, future code).
    if (!isDbAvailable()) {
        throw new Error("handleSkipSlice: GSD database is not available");
    }
    // ── Guards + DB writes inside a single transaction (prevents TOCTOU) ────
    let guardError = null;
    let guardCode = null;
    let wasAlreadySkipped = false;
    let tasksSkipped = 0;
    transaction(() => {
        const slice = getSlice(params.milestoneId, params.sliceId);
        if (!slice) {
            guardError = `Slice ${params.sliceId} not found in milestone ${params.milestoneId}`;
            guardCode = "slice_not_found";
            return;
        }
        if (slice.status === "complete" || slice.status === "done") {
            guardError = `Slice ${params.sliceId} is already complete — cannot skip.`;
            guardCode = "already_complete";
            return;
        }
        wasAlreadySkipped = slice.status === "skipped";
        if (!wasAlreadySkipped) {
            updateSliceStatus(params.milestoneId, params.sliceId, "skipped");
        }
        // Cascade: mark every non-closed task as skipped so milestone completion
        // doesn't trip the deep-task guard (#4375). Closed tasks (complete/done/
        // skipped) are left untouched — we never downgrade.
        const tasks = getSliceTasks(params.milestoneId, params.sliceId);
        for (const task of tasks) {
            if (!isClosedStatus(task.status)) {
                updateTaskStatus(params.milestoneId, params.sliceId, task.id, "skipped");
                tasksSkipped++;
            }
        }
    });
    if (guardError) {
        return { ...base, error: guardError, errorCode: guardCode ?? undefined };
    }
    return { ...base, tasksSkipped, wasAlreadySkipped };
}
