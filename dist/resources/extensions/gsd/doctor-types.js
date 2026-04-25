/**
 * Issue codes that represent global or completion-critical state.
 * These must NOT be auto-fixed when fixLevel is "task" — automated
 * post-task health checks must never delete external project state directories
 * or remove completed-unit keys (which causes state reversion / data loss).
 *
 * orphaned_completed_units: Removing completed-unit keys causes deriveState to
 * consider those tasks incomplete, reverting the user to an earlier slice and
 * effectively discarding all work past that point (#1809). This must only be
 * fixed by an explicit manual doctor run (fixLevel="all").
 */
export const GLOBAL_STATE_CODES = new Set([
    "orphaned_project_state",
    "orphaned_completed_units",
]);
