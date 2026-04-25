// GSD Extension — Routing History (Adaptive Learning)
// Tracks success/failure per tier per unit-type pattern to improve
// classification accuracy over time.
import { join } from "node:path";
import { gsdRoot } from "./paths.js";
import { loadJsonFile, saveJsonFile } from "./json-persistence.js";
// ─── Constants ───────────────────────────────────────────────────────────────
const HISTORY_FILE = "routing-history.json";
const ROLLING_WINDOW = 50; // only consider last N entries per pattern
const FAILURE_THRESHOLD = 0.20; // >20% failure rate triggers tier bump
const FEEDBACK_WEIGHT = 2; // feedback signals count 2x vs automatic
// ─── In-Memory State ─────────────────────────────────────────────────────────
let history = null;
let historyBasePath = "";
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Initialize routing history for a project.
 */
export function initRoutingHistory(base) {
    historyBasePath = base;
    history = loadHistory(base);
}
/**
 * Reset routing history state.
 */
export function resetRoutingHistory() {
    history = null;
    historyBasePath = "";
}
/**
 * Record the outcome of a unit dispatch.
 *
 * @param unitType  The unit type (e.g. "execute-task")
 * @param tier      The tier that was used
 * @param success   Whether the unit completed successfully
 * @param tags      Optional tags from task metadata (e.g. ["docs", "test"])
 */
export function recordOutcome(unitType, tier, success, tags) {
    if (!history)
        return;
    // Record for the base unit type
    const basePattern = unitType;
    ensurePattern(basePattern);
    const outcome = history.patterns[basePattern][tier];
    if (success)
        outcome.success++;
    else
        outcome.fail++;
    // Record for tag-specific patterns (e.g. "execute-task:docs")
    if (tags && tags.length > 0) {
        for (const tag of tags) {
            const tagPattern = `${unitType}:${tag}`;
            ensurePattern(tagPattern);
            const tagOutcome = history.patterns[tagPattern][tier];
            if (success)
                tagOutcome.success++;
            else
                tagOutcome.fail++;
        }
    }
    // Apply rolling window — cap total entries per tier per pattern
    for (const pattern of Object.keys(history.patterns)) {
        const p = history.patterns[pattern];
        for (const t of ["light", "standard", "heavy"]) {
            const total = p[t].success + p[t].fail;
            if (total > ROLLING_WINDOW) {
                const scale = ROLLING_WINDOW / total;
                p[t].success = Math.round(p[t].success * scale);
                p[t].fail = Math.round(p[t].fail * scale);
            }
        }
    }
    history.updatedAt = new Date().toISOString();
    saveHistory(historyBasePath, history);
}
/**
 * Record user feedback for the last completed unit.
 */
export function recordFeedback(unitType, unitId, tier, rating) {
    if (!history)
        return;
    history.feedback.push({
        unitType,
        unitId,
        tier,
        rating,
        timestamp: new Date().toISOString(),
    });
    // Cap feedback array at 200 entries
    if (history.feedback.length > 200) {
        history.feedback = history.feedback.slice(-200);
    }
    // Apply feedback as weighted outcome
    const pattern = unitType;
    ensurePattern(pattern);
    if (rating === "over") {
        // User says this could have used a simpler model → record as success at current tier
        // and also as success at one tier lower (encourages more downgrading)
        const lower = tierBelow(tier);
        if (lower) {
            const outcomes = history.patterns[pattern][lower];
            outcomes.success += FEEDBACK_WEIGHT;
        }
    }
    else if (rating === "under") {
        // User says this needed a better model → record as failure at current tier
        const outcomes = history.patterns[pattern][tier];
        outcomes.fail += FEEDBACK_WEIGHT;
    }
    // "ok" = no adjustment needed
    history.updatedAt = new Date().toISOString();
    saveHistory(historyBasePath, history);
}
/**
 * Get the recommended tier adjustment for a given pattern.
 * Returns the tier to bump to if the failure rate exceeds threshold,
 * or null if no adjustment is needed.
 */
export function getAdaptiveTierAdjustment(unitType, currentTier, tags) {
    if (!history)
        return null;
    // Check tag-specific patterns first (more specific)
    if (tags && tags.length > 0) {
        for (const tag of tags) {
            const tagPattern = `${unitType}:${tag}`;
            const adjustment = checkPatternFailureRate(tagPattern, currentTier);
            if (adjustment)
                return adjustment;
        }
    }
    // Fall back to base pattern
    return checkPatternFailureRate(unitType, currentTier);
}
/**
 * Clear all routing history (user-triggered reset).
 */
export function clearRoutingHistory(base) {
    history = createEmptyHistory();
    saveHistory(base, history);
}
/**
 * Get current history data (for display/debugging).
 */
export function getRoutingHistory() {
    return history;
}
// ─── Internal ────────────────────────────────────────────────────────────────
function checkPatternFailureRate(pattern, tier) {
    if (!history?.patterns[pattern])
        return null;
    const outcomes = history.patterns[pattern][tier];
    const total = outcomes.success + outcomes.fail;
    if (total < 3)
        return null; // Not enough data
    const failureRate = outcomes.fail / total;
    if (failureRate > FAILURE_THRESHOLD) {
        // Bump to next tier
        return tierAbove(tier);
    }
    return null;
}
function tierAbove(tier) {
    switch (tier) {
        case "light": return "standard";
        case "standard": return "heavy";
        case "heavy": return null;
    }
}
function tierBelow(tier) {
    switch (tier) {
        case "light": return null;
        case "standard": return "light";
        case "heavy": return "standard";
    }
}
function ensurePattern(pattern) {
    if (!history)
        return;
    if (!history.patterns[pattern]) {
        history.patterns[pattern] = {
            light: { success: 0, fail: 0 },
            standard: { success: 0, fail: 0 },
            heavy: { success: 0, fail: 0 },
        };
    }
}
function createEmptyHistory() {
    return {
        version: 1,
        patterns: {},
        feedback: [],
        updatedAt: new Date().toISOString(),
    };
}
function historyPath(base) {
    return join(gsdRoot(base), HISTORY_FILE);
}
function isRoutingHistoryData(data) {
    return (typeof data === "object" &&
        data !== null &&
        data.version === 1 &&
        typeof data.patterns === "object" &&
        data.patterns !== null);
}
function loadHistory(base) {
    return loadJsonFile(historyPath(base), isRoutingHistoryData, createEmptyHistory);
}
function saveHistory(base, data) {
    saveJsonFile(historyPath(base), data);
}
