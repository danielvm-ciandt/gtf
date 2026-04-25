import { DefaultResourceLoader } from '@gsd/pi-coding-agent';
export { discoverExtensionEntryPaths } from './extension-discovery.js';
export declare function getExtensionKey(entryPath: string, extensionsDir: string): string;
export declare function readManagedResourceVersion(agentDir: string): string | null;
/**
 * Computes a content fingerprint of a resources directory (defaults to the
 * bundled resourcesDir).
 *
 * Walks all files under `rootDir` and hashes `${relativePath}:${sha256(contents)}`
 * for each one. Using the file *contents* — not size — is what distinguishes
 * this from the earlier implementation and closes #4787: a same-size edit
 * (e.g. swapping one word for another word of the same byte length) produces
 * a different file hash, bumps the aggregate fingerprint, and therefore
 * triggers a full resync in `initResources`. The old path+size approach
 * silently cached stale prompts across upgrades.
 *
 * Cost is ~1-2ms for a typical resources tree (~100 small .md files) —
 * still negligible at startup. Files are streamed via `readFileSync` but
 * bundled prompts are tiny so this is fine.
 *
 * Exported for unit tests and for callers that want to check a different
 * directory (e.g. pre-install verification).
 */
export declare function computeResourceFingerprint(rootDir?: string): string;
export declare function getNewerManagedResourceVersion(agentDir: string, currentVersion: string): string | null;
/**
 * Syncs a single bundled resource directory into the agent directory.
 *
 * 1. Makes the destination writable (handles Nix store read-only copies).
 * 2. Removes destination subdirs that exist in source to clear stale files,
 *    while preserving user-created directories.
 * 3. Copies source into destination.
 * 4. Makes the result writable for the next upgrade cycle.
 */
export declare function syncResourceDir(srcDir: string, destDir: string): void;
/** Check if any @gsd* scopes exist in internal but not in hoisted node_modules */
export declare function hasMissingWorkspaceScopes(hoisted: string, internal: string): boolean;
/**
 * Create a real node_modules directory containing symlinks from both the
 * hoisted root (external deps) and internal root (@gsd/* workspace packages).
 * Used for pnpm global installs where @gsd/* isn't hoisted.
 */
export declare function reconcileMergedNodeModules(agentNodeModules: string, hoisted: string, internal: string): void;
/** Build a cache fingerprint from packageRoot + sorted entry names of both directories */
export declare function mergedFingerprint(hoisted: string, internal: string): string;
/**
 * Syncs all bundled resources to agentDir (~/.gsd/agent/) on every launch.
 *
 * - extensions/ → ~/.gsd/agent/extensions/   (overwrite when version changes)
 * - agents/     → ~/.gsd/agent/agents/        (overwrite when version changes)
 * - GSD-WORKFLOW.md → ~/.gsd/agent/GSD-WORKFLOW.md (fallback for env var miss)
 *
 * Skills are NOT synced here. They are installed by the user via the
 * skills.sh CLI (`npx skills add <repo>`) into ~/.agents/skills/ — the
 * industry-standard Agent Skills ecosystem directory.
 *
 * Skips the copy when the managed-resources.json version matches the current
 * GSD version, avoiding ~128ms of synchronous cpSync on every startup.
 * After `npm update -g @glittercowboy/gsd`, versions will differ and the
 * copy runs once to land the new resources.
 *
 * Inspectable: `ls ~/.gsd/agent/extensions/`
 */
export declare function initResources(agentDir: string, skillsDir?: string): void;
export declare function hasStaleCompiledExtensionSiblings(extensionsDir: string, sourceDir?: string): boolean;
export declare function buildResourceLoader(agentDir: string): DefaultResourceLoader;
