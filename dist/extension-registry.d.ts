/**
 * Extension Registry — manages manifest reading, registry persistence, and enable/disable state.
 *
 * Extensions without manifests always load (backwards compatible).
 * A fresh install has an empty registry — all extensions enabled by default.
 * The only way an extension stops loading is an explicit `gsd extensions disable <id>`.
 */
export interface ExtensionManifest {
    id: string;
    name: string;
    version: string;
    description: string;
    tier: "core" | "bundled" | "community";
    requires: {
        platform: string;
    };
    provides?: {
        tools?: string[];
        commands?: string[];
        hooks?: string[];
        shortcuts?: string[];
    };
    dependencies?: {
        extensions?: string[];
        runtime?: string[];
    };
}
export interface ExtensionRegistryEntry {
    id: string;
    enabled: boolean;
    source: "bundled" | "user" | "project";
    disabledAt?: string;
    disabledReason?: string;
    version?: string;
    installedFrom?: string;
    installType?: "npm" | "git" | "local";
}
export interface ExtensionRegistry {
    version: 1;
    entries: Record<string, ExtensionRegistryEntry>;
}
export declare function getRegistryPath(): string;
export declare function loadRegistry(): ExtensionRegistry;
export declare function saveRegistry(registry: ExtensionRegistry): void;
/** Returns true if the extension is enabled (missing entries default to enabled). */
export declare function isExtensionEnabled(registry: ExtensionRegistry, id: string): boolean;
export declare function enableExtension(registry: ExtensionRegistry, id: string): void;
/**
 * Disable an extension. Returns an error string if the extension is core (cannot disable),
 * or null on success.
 */
export declare function disableExtension(registry: ExtensionRegistry, id: string, manifest: ExtensionManifest | null, reason?: string): string | null;
/** Read extension-manifest.json from a directory. Returns null if missing or invalid. */
export declare function readManifest(extensionDir: string): ExtensionManifest | null;
/**
 * Given an entry path (e.g. `.../extensions/browser-tools/index.ts`),
 * resolve the parent directory and read its manifest.
 */
export declare function readManifestFromEntryPath(entryPath: string): ExtensionManifest | null;
/** Scan all subdirectories of extensionsDir for manifests. Returns a Map<id, manifest>. */
export declare function discoverAllManifests(extensionsDir: string): Map<string, ExtensionManifest>;
/**
 * Auto-populate registry entries for newly discovered extensions.
 * Extensions already in the registry are left untouched.
 */
export declare function ensureRegistryEntries(extensionsDir: string): void;
