// Native GSD Parser Bridge
// Provides drop-in replacements for the JS parsing functions in files.ts,
// backed by the Rust native parser for better performance on large projects.
//
// Functions fall back to JS implementations if the native module is unavailable.
// Issue #453: auto-mode post-turn reconciliation must stay on the stable JS path
// unless the native parser is explicitly requested.
const NATIVE_GSD_PARSER_ENABLED = process.env.GSD_ENABLE_NATIVE_GSD_PARSER === "1";
let nativeModule = null;
let loadAttempted = false;
function loadNative() {
    if (loadAttempted)
        return nativeModule;
    loadAttempted = true;
    if (!NATIVE_GSD_PARSER_ENABLED)
        return nativeModule;
    try {
        // Dynamic import to avoid hard dependency - fails gracefully if native module not built
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mod = require('@gsd/native');
        if (mod.parseFrontmatter && mod.extractSection && mod.batchParseGsdFiles) {
            nativeModule = mod;
        }
    }
    catch {
        // Native module not available - all functions fall back to JS
    }
    return nativeModule;
}
/**
 * Native-backed frontmatter splitting.
 * Returns [parsedMetadata, body] where parsedMetadata is the parsed key-value map.
 */
export function nativeSplitFrontmatter(content) {
    const native = loadNative();
    if (!native)
        return null;
    const result = native.parseFrontmatter(content);
    return {
        metadata: JSON.parse(result.metadata),
        body: result.body,
    };
}
/** Sentinel value indicating the native module is not available. */
const NATIVE_UNAVAILABLE = Symbol('native-unavailable');
/**
 * Native-backed section extraction.
 * Returns section content, null if not found, or NATIVE_UNAVAILABLE symbol
 * if the native module isn't loaded.
 */
export function nativeExtractSection(content, heading, level = 2) {
    const native = loadNative();
    if (!native)
        return NATIVE_UNAVAILABLE;
    const result = native.extractSection(content, heading, level);
    return result.found ? result.content : null;
}
export { NATIVE_UNAVAILABLE };
/**
 * Native-backed roadmap parsing.
 * Returns a Roadmap object or null if native module unavailable.
 */
export function nativeParseRoadmap(content) {
    const native = loadNative();
    if (!native)
        return null;
    const result = native.parseRoadmapFile(content);
    return {
        title: result.title,
        vision: result.vision,
        successCriteria: result.successCriteria,
        slices: result.slices.map(s => ({
            id: s.id,
            title: s.title,
            risk: s.risk,
            depends: s.depends,
            done: s.done,
            demo: s.demo,
        })),
        boundaryMap: result.boundaryMap.map(b => ({
            fromSlice: b.fromSlice,
            toSlice: b.toSlice,
            produces: b.produces,
            consumes: b.consumes,
        })),
    };
}
/**
 * Batch-parse all .md files in a .gsd/ directory tree using the native parser.
 * Returns null if native module unavailable.
 */
export function nativeBatchParseGsdFiles(directory) {
    const native = loadNative();
    if (!native)
        return null;
    const result = native.batchParseGsdFiles(directory);
    return result.files.map(f => ({
        path: f.path,
        metadata: JSON.parse(f.metadata),
        body: f.body,
        sections: JSON.parse(f.sections),
        rawContent: f.rawContent,
    }));
}
/**
 * Check if the native parser is available.
 */
export function isNativeParserAvailable() {
    return loadNative() !== null;
}
/**
 * Native-backed directory tree scan of a .gsd/ directory.
 * Returns a flat list of all entries, or null if native module unavailable.
 */
export function nativeScanGsdTree(directory) {
    const native = loadNative();
    if (!native)
        return null;
    return native.scanGsdTree(directory);
}
/**
 * Native-backed JSONL tail parser. Reads the last `maxBytes` of a JSONL file
 * and parses up to `maxEntries` entries with constant memory usage.
 * Returns null if native module unavailable.
 */
export function nativeParseJsonlTail(filePath, maxBytes, maxEntries) {
    const native = loadNative();
    if (!native)
        return null;
    const result = native.parseJsonlTail(filePath, maxBytes, maxEntries);
    return {
        entries: JSON.parse(result.entries),
        count: result.count,
        truncated: result.truncated,
    };
}
/**
 * Native-backed plan file parser.
 * Returns structured plan data or null if native module unavailable.
 */
export function nativeParsePlanFile(content) {
    const native = loadNative();
    if (!native)
        return null;
    return native.parsePlanFile(content);
}
/**
 * Native-backed summary file parser.
 * Returns structured summary data or null if native module unavailable.
 */
export function nativeParseSummaryFile(content) {
    const native = loadNative();
    if (!native)
        return null;
    return native.parseSummaryFile(content);
}
