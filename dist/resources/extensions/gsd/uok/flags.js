import { loadEffectiveGSDPreferences } from "../preferences.js";
function envForcesLegacyFallback() {
    const raw = process.env.GSD_UOK_FORCE_LEGACY ?? process.env.GSD_UOK_LEGACY_FALLBACK;
    if (!raw)
        return false;
    const normalized = raw.trim().toLowerCase();
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
export function resolveUokFlags(prefs) {
    const uok = prefs?.uok;
    const legacyFallback = uok?.legacy_fallback?.enabled === true || envForcesLegacyFallback();
    const enabledByPreference = uok?.enabled ?? true;
    return {
        enabled: enabledByPreference && !legacyFallback,
        legacyFallback,
        gates: uok?.gates?.enabled ?? true,
        modelPolicy: uok?.model_policy?.enabled ?? true,
        executionGraph: uok?.execution_graph?.enabled ?? true,
        gitops: uok?.gitops?.enabled ?? true,
        gitopsTurnAction: uok?.gitops?.turn_action ?? "commit",
        gitopsTurnPush: uok?.gitops?.turn_push === true,
        auditUnified: uok?.audit_unified?.enabled ?? true,
        planV2: uok?.plan_v2?.enabled ?? true,
    };
}
export function loadUokFlags() {
    const prefs = loadEffectiveGSDPreferences()?.preferences;
    return resolveUokFlags(prefs);
}
