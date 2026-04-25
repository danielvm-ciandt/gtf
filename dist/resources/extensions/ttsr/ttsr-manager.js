/**
 * Time Traveling Stream Rules (TTSR) Manager
 *
 * Manages rules that get injected mid-stream when their condition pattern matches
 * the agent's output. When a match occurs, the stream is aborted, the rule is
 * injected as a system reminder, and the request is retried.
 *
 * The regex hot-path is delegated to a native Rust RegexSet engine when
 * available, testing all patterns in a single DFA pass. Falls back to
 * per-rule JS RegExp iteration when the native module is not loaded.
 */
import { createRequire } from "node:module";
import { debugTime, debugCount, debugPeak } from "../gsd/debug-logger.js";
const _require = createRequire(import.meta.url);
const picomatch = _require("picomatch");
// ── Native TTSR engine (optional) ─────────────────────────────────────
let nativeTtsr = null;
try {
    // Dynamic import to avoid hard dependency — gracefully degrades to JS.
    const native = await import("@gsd/native");
    if (native.ttsrCompileRules && native.ttsrCheckBuffer && native.ttsrFreeRules) {
        nativeTtsr = {
            ttsrCompileRules: native.ttsrCompileRules,
            ttsrCheckBuffer: native.ttsrCheckBuffer,
            ttsrFreeRules: native.ttsrFreeRules,
        };
    }
}
catch {
    // Native module not available — JS fallback will be used.
}
const DEFAULT_SETTINGS = {
    enabled: true,
    contextMode: "discard",
    interruptMode: "always",
    repeatMode: "once",
    repeatGap: 10,
};
/** Cap per-stream buffer at 512KB to prevent unbounded memory growth. */
const MAX_BUFFER_BYTES = 512 * 1024;
/**
 * Minimum interval (ms) between JS-fallback regex checks on the same buffer.
 * Prevents CPU spinning when deltas arrive faster than regex evaluation (#468).
 */
const JS_FALLBACK_CHECK_INTERVAL_MS = 50;
const DEFAULT_SCOPE = {
    allowText: true,
    allowThinking: false,
    allowAnyTool: true,
    toolScopes: [],
};
export class TtsrManager {
    #settings;
    #rules = new Map();
    #injectionRecords = new Map();
    #buffers = new Map();
    /** Tracks last JS-fallback check time per buffer key to throttle CPU (#468). */
    #lastJsCheckAt = new Map();
    #messageCount = 0;
    #nativeHandle = null;
    #nativeDirty = false;
    constructor(settings) {
        this.#settings = { ...DEFAULT_SETTINGS, ...settings };
    }
    #canTrigger(ruleName) {
        const record = this.#injectionRecords.get(ruleName);
        if (!record)
            return true;
        if (this.#settings.repeatMode === "once")
            return false;
        const gap = this.#messageCount - record.lastInjectedAt;
        return gap >= this.#settings.repeatGap;
    }
    #compileConditions(rule) {
        const compiled = [];
        for (const pattern of rule.condition ?? []) {
            try {
                compiled.push(new RegExp(pattern));
            }
            catch (err) {
                console.warn(`[ttsr] Rule "${rule.name}": invalid regex "${pattern}" — ${err.message}`);
            }
        }
        return compiled;
    }
    #compileGlobalPathMatchers(globs) {
        if (!globs || globs.length === 0)
            return undefined;
        const matchers = globs
            .map((g) => g.trim())
            .filter((g) => g.length > 0)
            .map((g) => picomatch(g));
        return matchers.length > 0 ? matchers : undefined;
    }
    #parseToolScopeToken(token) {
        const match = /^(?:(?<prefix>tool)(?::(?<tool>[a-z0-9_-]+))?|(?<bare>[a-z0-9_-]+))(?:\((?<path>[^)]+)\))?$/i.exec(token);
        if (!match)
            return undefined;
        const groups = match.groups;
        const hasToolPrefix = groups?.prefix !== undefined;
        const toolName = (groups?.tool ?? (hasToolPrefix ? undefined : groups?.bare))?.trim().toLowerCase();
        const pathPattern = groups?.path?.trim();
        if (!pathPattern)
            return { toolName };
        return {
            toolName,
            pathPattern,
            pathMatcher: picomatch(pathPattern),
        };
    }
    #buildScope(rule) {
        if (!rule.scope || rule.scope.length === 0) {
            return {
                allowText: DEFAULT_SCOPE.allowText,
                allowThinking: DEFAULT_SCOPE.allowThinking,
                allowAnyTool: DEFAULT_SCOPE.allowAnyTool,
                toolScopes: [...DEFAULT_SCOPE.toolScopes],
            };
        }
        const scope = {
            allowText: false,
            allowThinking: false,
            allowAnyTool: false,
            toolScopes: [],
        };
        for (const rawToken of rule.scope) {
            const token = rawToken.trim();
            const normalized = token.toLowerCase();
            if (token.length === 0)
                continue;
            if (normalized === "text") {
                scope.allowText = true;
                continue;
            }
            if (normalized === "thinking") {
                scope.allowThinking = true;
                continue;
            }
            if (normalized === "tool" || normalized === "toolcall") {
                scope.allowAnyTool = true;
                continue;
            }
            const toolScope = this.#parseToolScopeToken(token);
            if (!toolScope)
                continue;
            if (!toolScope.toolName && !toolScope.pathMatcher) {
                scope.allowAnyTool = true;
                continue;
            }
            scope.toolScopes.push(toolScope);
        }
        return scope;
    }
    #hasReachableScope(scope) {
        return scope.allowText || scope.allowThinking || scope.allowAnyTool || scope.toolScopes.length > 0;
    }
    #bufferKey(context) {
        if (context.streamKey && context.streamKey.trim().length > 0)
            return context.streamKey;
        if (context.source !== "tool")
            return context.source;
        const toolName = context.toolName?.trim().toLowerCase();
        return toolName ? `tool:${toolName}` : "tool";
    }
    #normalizePath(pathValue) {
        return pathValue.replaceAll("\\", "/");
    }
    #matchesGlob(matcher, filePaths) {
        if (!filePaths || filePaths.length === 0)
            return false;
        for (const filePath of filePaths) {
            const normalized = this.#normalizePath(filePath);
            if (matcher(normalized))
                return true;
            const slashIndex = normalized.lastIndexOf("/");
            const basename = slashIndex === -1 ? normalized : normalized.slice(slashIndex + 1);
            if (basename !== normalized && matcher(basename))
                return true;
        }
        return false;
    }
    #matchesGlobalPaths(entry, context) {
        if (!entry.globalPathMatchers || entry.globalPathMatchers.length === 0)
            return true;
        for (const matcher of entry.globalPathMatchers) {
            if (this.#matchesGlob(matcher, context.filePaths))
                return true;
        }
        return false;
    }
    #matchesScope(entry, context) {
        if (context.source === "text")
            return entry.scope.allowText;
        if (context.source === "thinking")
            return entry.scope.allowThinking;
        if (entry.scope.allowAnyTool)
            return true;
        const toolName = context.toolName?.trim().toLowerCase();
        for (const toolScope of entry.scope.toolScopes) {
            if (toolScope.toolName && toolScope.toolName !== toolName)
                continue;
            if (toolScope.pathMatcher && !this.#matchesGlob(toolScope.pathMatcher, context.filePaths))
                continue;
            return true;
        }
        return false;
    }
    #matchesCondition(entry, streamBuffer) {
        for (const condition of entry.conditions) {
            condition.lastIndex = 0;
            if (condition.test(streamBuffer))
                return true;
        }
        return false;
    }
    /** Compile (or recompile) the native RegexSet from all current rules. */
    #compileNative() {
        if (!nativeTtsr || !this.#nativeDirty)
            return;
        // Free previous handle if any.
        if (this.#nativeHandle !== null) {
            try {
                nativeTtsr.ttsrFreeRules(this.#nativeHandle);
            }
            catch { /* ignore */ }
            this.#nativeHandle = null;
        }
        const ruleInputs = [];
        for (const [, entry] of this.#rules) {
            ruleInputs.push({
                name: entry.rule.name,
                conditions: entry.rule.condition,
            });
        }
        if (ruleInputs.length === 0) {
            this.#nativeDirty = false;
            return;
        }
        try {
            this.#nativeHandle = nativeTtsr.ttsrCompileRules(ruleInputs);
        }
        catch (err) {
            console.warn(`[ttsr] Native compilation failed, using JS fallback: ${err.message}`);
            this.#nativeHandle = null;
        }
        this.#nativeDirty = false;
    }
    /** Add a TTSR rule to be monitored. */
    addRule(rule) {
        if (this.#rules.has(rule.name))
            return false;
        const conditions = this.#compileConditions(rule);
        if (conditions.length === 0)
            return false;
        const scope = this.#buildScope(rule);
        if (!this.#hasReachableScope(scope))
            return false;
        const globalPathMatchers = this.#compileGlobalPathMatchers(rule.globs);
        this.#rules.set(rule.name, { rule, conditions, scope, globalPathMatchers });
        this.#nativeDirty = true;
        return true;
    }
    /**
     * Add a stream chunk to its scoped buffer and return matching rules.
     *
     * Buffers are isolated by source/tool key so matches don't bleed across
     * assistant prose, thinking text, and unrelated tool argument streams.
     *
     * When the native Rust engine is available, all regex conditions are tested
     * in a single DFA pass via RegexSet. Scope, glob, and repeat-gate checks
     * remain in JS as they are lightweight and context-dependent.
     */
    checkDelta(delta, context) {
        const stopTimer = debugTime("ttsr-check");
        const bufferKey = this.#bufferKey(context);
        let nextBuffer = `${this.#buffers.get(bufferKey) ?? ""}${delta}`;
        // Cap buffer size — keep the tail so patterns still match recent output
        if (nextBuffer.length > MAX_BUFFER_BYTES) {
            nextBuffer = nextBuffer.slice(-MAX_BUFFER_BYTES);
        }
        this.#buffers.set(bufferKey, nextBuffer);
        debugPeak("ttsrPeakBuffer", nextBuffer.length);
        // Lazily compile native engine if rules changed.
        if (this.#nativeDirty)
            this.#compileNative();
        // ── Native path: single-pass RegexSet match ───────────────────────
        if (nativeTtsr && this.#nativeHandle !== null) {
            const regexMatchedNames = nativeTtsr.ttsrCheckBuffer(this.#nativeHandle, nextBuffer);
            const regexMatchedSet = new Set(regexMatchedNames);
            const matches = [];
            for (const [name, entry] of this.#rules) {
                if (!regexMatchedSet.has(name))
                    continue;
                if (!this.#canTrigger(name))
                    continue;
                if (!this.#matchesScope(entry, context))
                    continue;
                if (!this.#matchesGlobalPaths(entry, context))
                    continue;
                matches.push(entry.rule);
            }
            debugCount("ttsrChecks");
            stopTimer({ bufferSize: nextBuffer.length, native: true, rulesChecked: this.#rules.size, matched: matches.map(m => m.name) });
            return matches;
        }
        // ── JS fallback: per-rule regex iteration ─────────────────────────
        // Throttle JS regex checks to prevent CPU spinning on fast token
        // streams — regex on a growing buffer is O(rules × buffer_size) (#468).
        const now = Date.now();
        const lastCheck = this.#lastJsCheckAt.get(bufferKey) ?? 0;
        if (now - lastCheck < JS_FALLBACK_CHECK_INTERVAL_MS) {
            stopTimer({ bufferSize: nextBuffer.length, throttled: true });
            return [];
        }
        this.#lastJsCheckAt.set(bufferKey, now);
        const matches = [];
        for (const [name, entry] of this.#rules) {
            if (!this.#canTrigger(name))
                continue;
            if (!this.#matchesScope(entry, context))
                continue;
            if (!this.#matchesGlobalPaths(entry, context))
                continue;
            if (!this.#matchesCondition(entry, nextBuffer))
                continue;
            matches.push(entry.rule);
        }
        debugCount("ttsrChecks");
        stopTimer({ bufferSize: nextBuffer.length, native: false, rulesChecked: this.#rules.size, matched: matches.map(m => m.name) });
        return matches;
    }
    /** Mark rules as injected (won't trigger again until conditions allow). */
    markInjected(rulesToMark) {
        this.markInjectedByNames(rulesToMark.map((r) => r.name));
    }
    /** Mark rule names as injected. */
    markInjectedByNames(ruleNames) {
        for (const rawName of ruleNames) {
            const ruleName = rawName.trim();
            if (ruleName.length === 0)
                continue;
            const record = this.#injectionRecords.get(ruleName);
            if (!record) {
                this.#injectionRecords.set(ruleName, { lastInjectedAt: this.#messageCount });
            }
            else {
                record.lastInjectedAt = this.#messageCount;
            }
        }
    }
    /** Get names of all injected rules (for persistence). */
    getInjectedRuleNames() {
        return Array.from(this.#injectionRecords.keys());
    }
    /** Restore injected state from a list of rule names. */
    restoreInjected(ruleNames) {
        for (const name of ruleNames) {
            this.#injectionRecords.set(name, { lastInjectedAt: 0 });
        }
    }
    /** Reset stream buffers (called on new turn). */
    resetBuffer() {
        this.#buffers.clear();
        this.#lastJsCheckAt.clear();
    }
    /** Check if any TTSR rules are registered. */
    hasRules() {
        return this.#rules.size > 0;
    }
    /** Increment message counter (call after each turn). */
    incrementMessageCount() {
        this.#messageCount++;
    }
    /** Get current message count. */
    getMessageCount() {
        return this.#messageCount;
    }
    /** Get settings. */
    getSettings() {
        return this.#settings;
    }
}
