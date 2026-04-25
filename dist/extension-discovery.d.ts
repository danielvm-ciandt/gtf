/**
 * Resolves the entry-point file(s) for a single extension directory.
 *
 * 1. If the directory contains a package.json with a `pi` manifest object,
 *    the manifest is authoritative:
 *    - `pi.extensions` array → resolve each entry relative to the directory.
 *    - `pi: {}` (no extensions) → return empty (library opt-out, e.g. cmux).
 * 2. Only when no `pi` manifest exists does it fall back to `index.ts` → `index.js`.
 */
export declare function resolveExtensionEntries(dir: string): string[];
/**
 * Discovers all extension entry-point paths under an extensions directory.
 *
 * - Top-level .ts/.js files are treated as standalone extension entry points.
 * - Subdirectories are resolved via `resolveExtensionEntries()` (package.json →
 *   pi.extensions, then index.ts/index.js fallback).
 */
export declare function discoverExtensionEntryPaths(extensionsDir: string): string[];
/**
 * Merge bundled and installed extension entry paths.
 * Installed extensions with the same manifest ID as a bundled extension take precedence (D-14).
 * Loader stays dumb — receives a pre-merged path list (D-15).
 */
export declare function mergeExtensionEntryPaths(bundledPaths: string[], installedExtDir: string): string[];
