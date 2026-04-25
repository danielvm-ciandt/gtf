// GSD2 — Ecosystem Extension API wrapper
// Wraps pi's ExtensionAPI to expose typed GSD context (phase + active unit)
// to extensions loaded from `./.gsd/extensions/`. The wrapper intercepts only
// `on("before_agent_start", ...)` so GSD can dispatch ecosystem handlers AFTER
// refreshing state — fixing the load-order race where third-party
// `.pi/extensions/` handlers see a stale module-level snapshot (#3338).
//
// SINGLE-SESSION INVARIANT: the module-level `_snapshot` is per-process.
// Worktree or project switches do NOT reload extensions, matching pi's
// `.pi/extensions/` behavior. Only re-launching the CLI rebinds the snapshot.
import { isGSDActive, getCurrentPhase } from "../../shared/gsd-phase-state.js";
import { logWarning } from "../workflow-logger.js";
// ─── Auto-loop phase mapping ────────────────────────────────────────────
const AUTO_LOOP_PHASE_MAP = {
    "plan-milestone": "planning",
    "plan-slice": "planning",
    "research": "researching",
    "discuss": "discussing",
    "execute-task": "executing",
    "verify": "verifying",
    "summarize-task": "summarizing",
    "summarize-slice": "summarizing",
    "advance": "advancing",
    "validate-milestone": "validating-milestone",
    "complete-milestone": "completing-milestone",
    "replan-slice": "replanning-slice",
};
/** Exposed for unit tests. Returns null for unknown keys (does NOT default). */
export function mapAutoLoopPhase(raw) {
    return AUTO_LOOP_PHASE_MAP[raw] ?? null;
}
function resolvePhase(state) {
    if (!state)
        return null;
    if (isGSDActive()) {
        const raw = getCurrentPhase();
        if (raw != null) {
            const mapped = AUTO_LOOP_PHASE_MAP[raw];
            if (mapped)
                return mapped;
            logWarning("ecosystem", `unknown auto-loop phase: ${raw}`);
            // FALL THROUGH to state.phase rather than defaulting to "executing".
        }
    }
    return state.phase;
}
function resolveActiveUnit(state) {
    if (!state)
        return null;
    const m = state.activeMilestone;
    const s = state.activeSlice;
    const t = state.activeTask;
    if (!m || !s || !t)
        return null;
    return {
        milestoneId: m.id,
        milestoneTitle: m.title,
        sliceId: s.id,
        sliceTitle: s.title,
        taskId: t.id,
        taskTitle: t.title,
    };
}
let _snapshot = { phase: null, activeUnit: null };
/** Refresh the snapshot from a freshly derived GSDState (or null on failure). */
export function updateSnapshot(state) {
    _snapshot = {
        phase: resolvePhase(state),
        activeUnit: resolveActiveUnit(state),
    };
}
export function getSnapshotPhase() {
    return _snapshot.phase;
}
export function getSnapshotActiveUnit() {
    return _snapshot.activeUnit;
}
/** Test-only: reset the snapshot to its initial empty state. */
export function _resetSnapshot() {
    _snapshot = { phase: null, activeUnit: null };
}
// ─── Wrapper factory ────────────────────────────────────────────────────
/**
 * Build a GSDExtensionAPI by manually delegating every ExtensionAPI method
 * to the underlying pi instance, except `on("before_agent_start", ...)`
 * which is captured into `sharedHandlers` for GSD-owned dispatch.
 *
 * Uses `satisfies GSDExtensionAPI` (NOT `as`) so TypeScript catches drift
 * when pi adds new ExtensionAPI methods.
 */
export function createGSDExtensionAPI(pi, sharedHandlers) {
    const wrapper = {
        // ── Event subscription (single intercept point) ────────────────────
        on(event, handler) {
            if (event === "before_agent_start") {
                sharedHandlers.push(handler);
                return;
            }
            pi.on(event, handler);
        },
        // ── Event emission ─────────────────────────────────────────────────
        emitBeforeModelSelect: (...args) => pi.emitBeforeModelSelect(...args),
        emitAdjustToolSet: (...args) => pi.emitAdjustToolSet(...args),
        emitExtensionEvent: (...args) => pi.emitExtensionEvent(...args),
        // ── Tool / command / shortcut / flag registration ──────────────────
        registerTool: ((tool) => pi.registerTool(tool)),
        registerCommand: (...args) => pi.registerCommand(...args),
        registerBeforeInstall: (...args) => pi.registerBeforeInstall(...args),
        registerAfterInstall: (...args) => pi.registerAfterInstall(...args),
        registerBeforeRemove: (...args) => pi.registerBeforeRemove(...args),
        registerAfterRemove: (...args) => pi.registerAfterRemove(...args),
        registerShortcut: (...args) => pi.registerShortcut(...args),
        registerFlag: (...args) => pi.registerFlag(...args),
        getFlag: (...args) => pi.getFlag(...args),
        // ── Message rendering ──────────────────────────────────────────────
        registerMessageRenderer: ((customType, renderer) => pi.registerMessageRenderer(customType, renderer)),
        // ── Actions ────────────────────────────────────────────────────────
        sendMessage: ((message, options) => pi.sendMessage(message, options)),
        sendUserMessage: (...args) => pi.sendUserMessage(...args),
        retryLastTurn: () => pi.retryLastTurn(),
        appendEntry: ((customType, data) => pi.appendEntry(customType, data)),
        // ── Session metadata ───────────────────────────────────────────────
        setSessionName: (...args) => pi.setSessionName(...args),
        getSessionName: () => pi.getSessionName(),
        setLabel: (...args) => pi.setLabel(...args),
        exec: (...args) => pi.exec(...args),
        getActiveTools: () => pi.getActiveTools(),
        getAllTools: () => pi.getAllTools(),
        setActiveTools: (...args) => pi.setActiveTools(...args),
        getCommands: () => pi.getCommands(),
        // ── Model & thinking ───────────────────────────────────────────────
        setModel: (...args) => pi.setModel(...args),
        getThinkingLevel: () => pi.getThinkingLevel(),
        setThinkingLevel: (...args) => pi.setThinkingLevel(...args),
        // ── Provider registration ──────────────────────────────────────────
        registerProvider: (...args) => pi.registerProvider(...args),
        unregisterProvider: (...args) => pi.unregisterProvider(...args),
        // ── Shared event bus (passthrough property) ────────────────────────
        events: pi.events,
        // ── GSD-specific additions ─────────────────────────────────────────
        getPhase: () => _snapshot.phase,
        getActiveUnit: () => _snapshot.activeUnit,
    };
    return wrapper;
}
