/**
 * dev-execution-policy.ts — DevExecutionPolicy implementation.
 *
 * Stub policy for the dev engine. All methods return safe defaults.
 * Real verification/closeout continues running through phases.ts via LoopDeps.
 * Wiring this policy into the loop is S04's responsibility.
 */
export class DevExecutionPolicy {
    async prepareWorkspace(_basePath, _milestoneId) {
        // no-op — workspace preparation handled by existing GSD logic
    }
    async selectModel(_unitType, _unitId, _context) {
        return null; // use default model selection
    }
    async verify(_unitType, _unitId, _context) {
        return "continue";
    }
    async recover(_unitType, _unitId, _context) {
        return { outcome: "retry" };
    }
    async closeout(_unitType, _unitId, _context) {
        return { committed: false, artifacts: [] };
    }
}
