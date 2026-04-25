// GSD Extension — Layer 2 Event Emitter Bridge
//
// Holds a module-scoped reference to the ExtensionAPI so deeply-nested code
// (auto-loop, git-service callers, verification, budget) can emit Layer 2
// events without having to thread `pi` through every function signature.
//
// Set once from `registerGsdExtension`. All emitters are best-effort — a
// missing `pi` (e.g. in standalone unit tests) silently becomes a no-op.
let _pi;
export function setHookEmitter(pi) {
    _pi = pi;
}
export function clearHookEmitter() {
    _pi = undefined;
}
// ─── Notification ──────────────────────────────────────────────────────────
export async function emitNotification(kind, message, details) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "notification", kind, message, details });
}
// ─── Git Lifecycle ─────────────────────────────────────────────────────────
export async function emitBeforeCommit(args) {
    if (!_pi)
        return undefined;
    return (await _pi.emitExtensionEvent({
        type: "before_commit",
        ...args,
    }));
}
export async function emitCommit(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "commit", ...args });
}
export async function emitBeforePush(args) {
    if (!_pi)
        return undefined;
    return (await _pi.emitExtensionEvent({
        type: "before_push",
        ...args,
    }));
}
export async function emitPush(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "push", ...args });
}
export async function emitBeforePr(args) {
    if (!_pi)
        return undefined;
    return (await _pi.emitExtensionEvent({
        type: "before_pr",
        ...args,
    }));
}
export async function emitPrOpened(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "pr_opened", ...args });
}
// ─── Verification ──────────────────────────────────────────────────────────
export async function emitBeforeVerify(args) {
    if (!_pi)
        return undefined;
    return (await _pi.emitExtensionEvent({
        type: "before_verify",
        ...args,
    }));
}
export async function emitVerifyResult(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "verify_result", ...args });
}
// ─── Budget ────────────────────────────────────────────────────────────────
export async function emitBudgetThreshold(args) {
    if (!_pi)
        return undefined;
    return (await _pi.emitExtensionEvent({
        type: "budget_threshold",
        fraction: args.fraction,
        spent: args.spent,
        limit: args.limit,
        currency: "USD",
    }));
}
// ─── Orchestrator Boundaries ───────────────────────────────────────────────
export async function emitMilestoneStart(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "milestone_start", ...args });
}
export async function emitMilestoneEnd(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "milestone_end", ...args });
}
export async function emitUnitStart(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "unit_start", ...args });
}
export async function emitUnitEnd(args) {
    if (!_pi)
        return;
    await _pi.emitExtensionEvent({ type: "unit_end", ...args });
}
