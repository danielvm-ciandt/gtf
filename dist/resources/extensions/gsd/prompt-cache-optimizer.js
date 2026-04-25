/**
 * Prompt Cache Optimizer — separates prompt content into cacheable static
 * prefixes and dynamic per-task suffixes to maximize provider cache hit rates.
 *
 * Anthropic caches by prefix match (up to 4 breakpoints, 90% savings).
 * OpenAI auto-caches prompts with 1024+ stable prefix tokens (50% savings).
 * Both benefit from placing static content first and dynamic content last.
 */
// ─── Label classification maps ───────────────────────────────────────────────
/** Labels that never change within a session */
const STATIC_LABELS = new Set([
    "system-prompt",
    "base-instructions",
    "executor-constraints",
]);
/** Prefix patterns for static labels (e.g. "template-*") */
const STATIC_PREFIXES = ["template-"];
/** Labels that change per-slice but not per-task */
const SEMI_STATIC_LABELS = new Set([
    "slice-plan",
    "decisions",
    "requirements",
    "roadmap",
    "prior-summaries",
    "project-context",
    "overrides",
    // KNOWLEDGE is milestone-scoped (stable within a session), so it belongs
    // in the cacheable prefix. See issue #4719.
    "knowledge",
    "project-knowledge",
]);
/** Labels that change per-task */
const DYNAMIC_LABELS = new Set([
    "task-plan",
    "task-instructions",
    "task-context",
    "file-contents",
    "diff-context",
    "verification-commands",
]);
// ─── Public API ──────────────────────────────────────────────────────────────
/**
 * Classify common GSD prompt sections by their caching potential.
 * Returns the appropriate ContentRole for a section label.
 */
export function classifySection(label) {
    if (STATIC_LABELS.has(label))
        return "static";
    if (STATIC_PREFIXES.some((p) => label.startsWith(p)))
        return "static";
    if (SEMI_STATIC_LABELS.has(label))
        return "semi-static";
    if (DYNAMIC_LABELS.has(label))
        return "dynamic";
    // Conservative default: unknown labels are treated as dynamic
    return "dynamic";
}
/**
 * Build a PromptSection from content with automatic role classification.
 *
 * @param label Section label (e.g., "slice-plan", "task-instructions")
 * @param content The section content
 * @param role Optional explicit role override
 */
export function section(label, content, role) {
    return {
        label,
        content,
        role: role ?? classifySection(label),
    };
}
/**
 * Optimize prompt sections for maximum cache hit rates.
 * Reorders sections: static first, then semi-static, then dynamic.
 * Preserves relative order within each role group.
 *
 * @param sections Array of labeled prompt sections
 * @returns Cache-optimized prompt with statistics
 */
export function optimizeForCaching(sections) {
    const groups = {
        static: [],
        "semi-static": [],
        dynamic: [],
    };
    for (const s of sections) {
        groups[s.role].push(s);
    }
    const ordered = [
        ...groups["static"],
        ...groups["semi-static"],
        ...groups["dynamic"],
    ];
    const prompt = ordered.map((s) => s.content).join("\n\n");
    const staticChars = groups["static"].reduce((sum, s) => sum + s.content.length, 0);
    const semiStaticChars = groups["semi-static"].reduce((sum, s) => sum + s.content.length, 0);
    // Account for separator characters between sections in the cacheable prefix
    const staticSeparators = groups["static"].length > 0
        ? (groups["static"].length - 1) * 2 // "\n\n" between static sections
        : 0;
    const semiStaticSeparators = groups["semi-static"].length > 0
        ? (groups["semi-static"].length - 1) * 2
        : 0;
    // Separator between static and semi-static groups
    const groupSeparator = groups["static"].length > 0 && groups["semi-static"].length > 0 ? 2 : 0;
    const cacheablePrefixChars = staticChars +
        semiStaticChars +
        staticSeparators +
        semiStaticSeparators +
        groupSeparator;
    const totalChars = prompt.length;
    const cacheEfficiency = totalChars > 0 ? cacheablePrefixChars / totalChars : 0;
    return {
        prompt,
        cacheablePrefixChars,
        totalChars,
        cacheEfficiency,
        sectionCounts: {
            static: groups["static"].length,
            "semi-static": groups["semi-static"].length,
            dynamic: groups["dynamic"].length,
        },
    };
}
/**
 * Estimate the cache savings for a given optimization result.
 * Based on provider pricing:
 * - Anthropic: 90% savings on cached tokens
 * - OpenAI: 50% savings on cached tokens
 *
 * @param result The cache-optimized prompt
 * @param provider Provider name for savings calculation
 * @returns Estimated savings as a decimal (0.0-1.0)
 */
export function estimateCacheSavings(result, provider) {
    switch (provider) {
        case "anthropic":
            return result.cacheEfficiency * 0.9;
        case "openai":
            return result.cacheEfficiency * 0.5;
        case "other":
            return 0;
    }
}
/**
 * Compute cache hit rate from token usage metrics.
 * Returns a percentage 0-100.
 */
export function computeCacheHitRate(usage) {
    const denominator = usage.cacheRead + usage.input;
    if (denominator === 0)
        return 0;
    return (usage.cacheRead / denominator) * 100;
}
