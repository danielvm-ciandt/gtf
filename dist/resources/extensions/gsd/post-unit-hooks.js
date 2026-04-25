// GSD Extension — Hook Engine Facade
//
// Thin facade over RuleRegistry. All mutable state and logic lives in the
// registry instance; these exported functions delegate through getOrCreateRegistry()
// so existing call-sites and tests work without modification.
import { getOrCreateRegistry } from "./rule-registry.js";
// Re-export resolveHookArtifactPath so existing importers still work.
export { resolveHookArtifactPath } from "./rule-registry.js";
// ─── Post-Unit Hooks ───────────────────────────────────────────────────────
export function checkPostUnitHooks(completedUnitType, completedUnitId, basePath) {
    return getOrCreateRegistry().evaluatePostUnit(completedUnitType, completedUnitId, basePath);
}
export function getActiveHook() {
    return getOrCreateRegistry().getActiveHook();
}
export function isRetryPending() {
    return getOrCreateRegistry().isRetryPending();
}
export function consumeRetryTrigger() {
    return getOrCreateRegistry().consumeRetryTrigger();
}
export function resetHookState() {
    getOrCreateRegistry().resetState();
}
// ─── Pre-Dispatch Hooks ────────────────────────────────────────────────────
export function runPreDispatchHooks(unitType, unitId, prompt, basePath) {
    return getOrCreateRegistry().evaluatePreDispatch(unitType, unitId, prompt, basePath);
}
// ─── State Persistence ─────────────────────────────────────────────────────
export function persistHookState(basePath) {
    getOrCreateRegistry().persistState(basePath);
}
export function restoreHookState(basePath) {
    getOrCreateRegistry().restoreState(basePath);
}
export function clearPersistedHookState(basePath) {
    getOrCreateRegistry().clearPersistedState(basePath);
}
// ─── Status & Manual Trigger ───────────────────────────────────────────────
export function getHookStatus() {
    return getOrCreateRegistry().getHookStatus();
}
export function triggerHookManually(hookName, unitType, unitId, basePath) {
    return getOrCreateRegistry().triggerHookManually(hookName, unitType, unitId, basePath);
}
export function formatHookStatus() {
    return getOrCreateRegistry().formatHookStatus();
}
