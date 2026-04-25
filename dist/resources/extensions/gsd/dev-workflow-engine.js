/**
 * dev-workflow-engine.ts — DevWorkflowEngine implementation.
 *
 * Implements WorkflowEngine by delegating to existing GSD state derivation
 * and dispatch logic. This is the "dev" engine — it wraps the current GSD
 * auto-mode behavior behind the engine-polymorphic interface.
 */
import { deriveState } from "./state.js";
import { resolveDispatch } from "./auto-dispatch.js";
import { loadEffectiveGSDPreferences } from "./preferences.js";
// ─── Bridge: DispatchAction → EngineDispatchAction ────────────────────────
/**
 * Map a GSD-specific DispatchAction (which carries `matchedRule`, `unitType`,
 * etc.) to the engine-generic EngineDispatchAction discriminated union.
 *
 * Exported for unit testing.
 */
export function bridgeDispatchAction(da) {
    switch (da.action) {
        case "dispatch":
            return {
                action: "dispatch",
                step: {
                    unitType: da.unitType,
                    unitId: da.unitId,
                    prompt: da.prompt,
                },
            };
        case "stop":
            return {
                action: "stop",
                reason: da.reason,
                level: da.level,
            };
        case "skip":
            return { action: "skip" };
    }
}
// ─── DevWorkflowEngine ───────────────────────────────────────────────────
export class DevWorkflowEngine {
    engineId = "dev";
    async deriveState(basePath) {
        const gsd = await deriveState(basePath);
        return {
            phase: gsd.phase,
            currentMilestoneId: gsd.activeMilestone?.id ?? null,
            activeSliceId: gsd.activeSlice?.id ?? null,
            activeTaskId: gsd.activeTask?.id ?? null,
            isComplete: gsd.phase === "complete",
            raw: gsd,
        };
    }
    async resolveDispatch(state, context) {
        const gsd = state.raw;
        const mid = gsd.activeMilestone?.id ?? "";
        const midTitle = gsd.activeMilestone?.title ?? "";
        const loaded = loadEffectiveGSDPreferences();
        const prefs = loaded?.preferences ?? undefined;
        const dispatchCtx = {
            basePath: context.basePath,
            mid,
            midTitle,
            state: gsd,
            prefs,
        };
        const result = await resolveDispatch(dispatchCtx);
        return bridgeDispatchAction(result);
    }
    async reconcile(state, _completedStep) {
        return {
            outcome: state.isComplete ? "milestone-complete" : "continue",
        };
    }
    getDisplayMetadata(state) {
        return {
            engineLabel: "GSD Dev",
            currentPhase: state.phase,
            progressSummary: `${state.currentMilestoneId ?? "no milestone"} / ${state.activeSliceId ?? "—"} / ${state.activeTaskId ?? "—"}`,
            stepCount: null,
        };
    }
}
