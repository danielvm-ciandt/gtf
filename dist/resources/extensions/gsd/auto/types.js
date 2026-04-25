/**
 * auto/types.ts — Constants and types shared across auto-loop modules.
 *
 * Leaf node in the import DAG — no imports from auto/.
 */
/**
 * Maximum total loop iterations before forced stop. Prevents runaway loops
 * when units alternate IDs (bypassing the same-unit stuck detector).
 * A milestone with 20 slices × 5 tasks × 3 phases ≈ 300 units. 500 gives
 * generous headroom including retries and sidecar work.
 */
export const MAX_LOOP_ITERATIONS = 500;
/** Maximum characters of failure/crash context included in recovery prompts. */
export const MAX_RECOVERY_CHARS = 50_000;
/** Data-driven budget threshold notifications (descending). The 100% entry
 *  triggers special enforcement logic (halt/pause/warn); sub-100 entries fire
 *  a simple notification. */
export const BUDGET_THRESHOLDS = [
    { pct: 100, label: "Budget ceiling reached", notifyLevel: "error", cmuxLevel: "error" },
    { pct: 90, label: "Budget 90%", notifyLevel: "warning", cmuxLevel: "warning" },
    { pct: 80, label: "Approaching budget ceiling — 80%", notifyLevel: "warning", cmuxLevel: "warning" },
    { pct: 75, label: "Budget 75%", notifyLevel: "info", cmuxLevel: "progress" },
];
/** Max consecutive finalize timeouts before hard-stopping auto-mode. */
export const MAX_FINALIZE_TIMEOUTS = 3;
