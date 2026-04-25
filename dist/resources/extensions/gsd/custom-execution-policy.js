/**
 * custom-execution-policy.ts — ExecutionPolicy for custom workflows.
 *
 * Delegates verification to the step-level verification module which reads
 * the frozen DEFINITION.yaml and dispatches to the appropriate policy handler.
 *
 * Observability:
 * - verify() returns the outcome from runCustomVerification() — four policies
 *   are supported: content-heuristic, shell-command, prompt-verify, human-review.
 * - selectModel() returns null — defers to loop defaults.
 * - recover() returns retry — simple default recovery strategy.
 */
import { runCustomVerification } from "./custom-verification.js";
import { parseUnitId } from "./unit-id.js";
export class CustomExecutionPolicy {
    runDir;
    constructor(runDir) {
        this.runDir = runDir;
    }
    /** No workspace preparation needed for custom workflows. */
    async prepareWorkspace(_basePath, _milestoneId) {
        // No-op — custom workflows don't need worktree setup
    }
    /** Defer model selection to loop defaults. */
    async selectModel(_unitType, _unitId, _context) {
        return null;
    }
    /**
     * Verify step output by dispatching to the step's configured verification policy.
     *
     * Extracts the step ID from unitId (format: "<workflowName>/<stepId>")
     * and calls runCustomVerification() which reads the frozen DEFINITION.yaml
     * to determine which policy to apply.
     */
    async verify(_unitType, unitId, _context) {
        const { milestone, slice, task } = parseUnitId(unitId);
        const stepId = task ?? slice ?? milestone;
        return runCustomVerification(this.runDir, stepId);
    }
    /** Default recovery: retry the step. */
    async recover(_unitType, _unitId, _context) {
        return { outcome: "retry", reason: "Default retry" };
    }
    /** No-op closeout — no commits or artifact capture. */
    async closeout(_unitType, _unitId, _context) {
        return { committed: false, artifacts: [] };
    }
}
