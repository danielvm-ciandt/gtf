const sessionOverrides = new Map();
function normalizeSessionId(sessionId) {
    return typeof sessionId === "string" ? sessionId.trim() : "";
}
export function setSessionModelOverride(sessionId, override) {
    const key = normalizeSessionId(sessionId);
    if (!key)
        return;
    sessionOverrides.set(key, {
        provider: override.provider,
        id: override.id,
    });
}
export function getSessionModelOverride(sessionId) {
    const key = normalizeSessionId(sessionId);
    if (!key)
        return undefined;
    return sessionOverrides.get(key);
}
export function clearSessionModelOverride(sessionId) {
    const key = normalizeSessionId(sessionId);
    if (!key)
        return;
    sessionOverrides.delete(key);
}
