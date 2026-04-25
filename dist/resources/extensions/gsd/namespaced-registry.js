/**
 * Namespaced Component Registry Module
 *
 * Provides the canonical identity model for imported plugin components.
 * Supports both namespaced (plugin:component) and flat (bare name) components,
 * detects collisions at registration time, and provides lookup by canonical name
 * or namespace listing.
 *
 * This registry serves as the bridge between S01's plugin discovery output
 * and Pi's internal component resolution system.
 */
// ============================================================================
// NamespacedRegistry Class
// ============================================================================
/**
 * Registry for namespaced plugin components.
 *
 * Features:
 * - Computes canonical names from namespace + name
 * - Detects and reports collisions at registration time
 * - First registration wins; subsequent duplicates return diagnostic
 * - Lookup by canonical name or namespace listing
 * - Compatible with both namespaced and flat (non-namespaced) components
 *
 * Usage:
 * ```typescript
 * const registry = new NamespacedRegistry();
 *
 * // Register a namespaced component
 * const diag = registry.register({
 *   name: 'code-review',
 *   namespace: 'my-plugin',
 *   type: 'skill',
 *   filePath: '/plugins/my-plugin/skills/code-review/SKILL.md',
 *   source: 'plugin:my-plugin',
 *   description: 'Reviews code for quality issues',
 *   metadata: { pluginVersion: '1.0.0' }
 * });
 *
 * // Lookup by canonical name
 * const skill = registry.getByCanonical('my-plugin:code-review');
 *
 * // List all components in a namespace
 * const allSkills = registry.getByNamespace('my-plugin');
 * ```
 */
export class NamespacedRegistry {
    /** Internal storage: canonicalName -> component */
    components = new Map();
    /** Internal storage: alias -> canonicalName */
    aliasMap = new Map();
    /** Collision diagnostics collected during registration */
    diagnostics = [];
    /**
     * Register a component in the registry.
     *
     * Computes the canonical name as `${namespace}:${name}` when namespace is present,
     * or bare `name` otherwise. Returns a diagnostic if the canonical name already exists.
     *
     * @param component - Component data (without canonicalName, which is computed)
     * @returns Diagnostic if collision detected, undefined otherwise
     */
    register(component) {
        // Compute canonical name
        const canonicalName = component.namespace
            ? `${component.namespace}:${component.name}`
            : component.name;
        // Create full component with canonical name
        const fullComponent = {
            ...component,
            canonicalName,
        };
        // Check for collision
        const existing = this.components.get(canonicalName);
        if (existing) {
            const diagnostic = {
                type: 'collision',
                message: `canonical name "${canonicalName}" collision`,
                collision: {
                    canonicalName,
                    winnerPath: existing.filePath,
                    loserPath: component.filePath,
                    winnerSource: existing.source,
                    loserSource: component.source,
                },
            };
            this.diagnostics.push(diagnostic);
            return diagnostic;
        }
        // Register the component
        this.components.set(canonicalName, fullComponent);
        return undefined;
    }
    /**
     * Get a component by its canonical name.
     *
     * @param canonicalName - The canonical name (e.g., "my-plugin:code-review" or "code-review")
     * @returns The component if found, undefined otherwise
     */
    getByCanonical(canonicalName) {
        return this.components.get(canonicalName);
    }
    /**
     * Get all components belonging to a specific namespace.
     *
     * @param namespace - The namespace to filter by (e.g., "my-plugin")
     * @returns Array of components in that namespace
     */
    getByNamespace(namespace) {
        const results = [];
        for (const component of this.components.values()) {
            if (component.namespace === namespace) {
                results.push(component);
            }
        }
        return results;
    }
    /**
     * Get all registered components.
     *
     * @returns Array of all components
     */
    getAll() {
        return Array.from(this.components.values());
    }
    /**
     * Get all diagnostics collected during registration.
     *
     * Returns deep copies to prevent external mutation of internal state.
     *
     * @returns Array of diagnostics (collisions, etc.)
     */
    getDiagnostics() {
        return this.diagnostics.map((d) => ({
            type: d.type,
            message: d.message,
            collision: { ...d.collision },
        }));
    }
    /**
     * Check if a canonical name is already registered.
     *
     * @param canonicalName - The canonical name to check
     * @returns true if registered, false otherwise
     */
    has(canonicalName) {
        return this.components.has(canonicalName);
    }
    /**
     * Get the count of registered components.
     *
     * @returns Number of components
     */
    get size() {
        return this.components.size;
    }
    // ============================================================================
    // Alias Management
    // ============================================================================
    /**
     * Register an alias for a canonical name.
     *
     * Validates:
     * 1. The target canonical name must exist
     * 2. The alias cannot shadow an existing canonical name
     * 3. The alias cannot already exist pointing to a different target
     *
     * @param alias - The short alias (e.g., "py3d")
     * @param canonicalName - The target canonical name (e.g., "python-tools:3d-visualizer")
     * @returns Result indicating success or failure with reason
     */
    registerAlias(alias, canonicalName) {
        // Check that target canonical name exists
        if (!this.components.has(canonicalName)) {
            return {
                success: false,
                reason: 'canonical-not-found',
                message: `Cannot create alias "${alias}": target canonical name "${canonicalName}" does not exist`,
            };
        }
        // Check that alias doesn't shadow an existing canonical name
        if (this.components.has(alias)) {
            return {
                success: false,
                reason: 'shadows-canonical',
                message: `Cannot create alias "${alias}": it shadows an existing canonical name`,
            };
        }
        // Check for duplicate alias pointing to different target
        const existingTarget = this.aliasMap.get(alias);
        if (existingTarget !== undefined && existingTarget !== canonicalName) {
            return {
                success: false,
                reason: 'duplicate-alias',
                message: `Cannot create alias "${alias}": already exists pointing to "${existingTarget}"`,
            };
        }
        // Register the alias (idempotent if same target)
        this.aliasMap.set(alias, canonicalName);
        return { success: true };
    }
    /**
     * Remove an alias.
     *
     * @param alias - The alias to remove
     * @returns true if the alias existed and was removed, false otherwise
     */
    removeAlias(alias) {
        return this.aliasMap.delete(alias);
    }
    /**
     * Resolve an alias to its canonical name.
     *
     * @param alias - The alias to resolve
     * @returns The canonical name if alias exists, undefined otherwise
     */
    resolveAlias(alias) {
        return this.aliasMap.get(alias);
    }
    /**
     * Get all registered aliases.
     *
     * @returns A copy of the alias map (alias -> canonicalName)
     */
    getAliases() {
        return new Map(this.aliasMap);
    }
    /**
     * Check if an alias exists.
     *
     * @param alias - The alias to check
     * @returns true if the alias exists, false otherwise
     */
    hasAlias(alias) {
        return this.aliasMap.has(alias);
    }
}
// ============================================================================
// Discovery Bridge Helper
// ============================================================================
/**
 * Convert a discovered plugin's inventory into registerable component entries.
 *
 * This helper bridges S01's discovery output (DiscoveredPlugin) with the
 * namespaced registry. It maps skill and agent directory names to component
 * entries with the plugin's namespace.
 *
 * @param plugin - A discovered plugin from S01's discovery process
 * @returns Array of registerable component entries (without canonicalName)
 */
export function componentsFromDiscovery(plugin) {
    const components = [];
    // Use the plugin's canonical name as the namespace
    const namespace = plugin.canonicalName;
    // Extract common metadata from the plugin
    const commonMetadata = {
        pluginVersion: plugin.version,
        pluginAuthor: plugin.author?.name,
        pluginHomepage: plugin.homepage,
        pluginCategory: plugin.category,
    };
    // Process skills
    for (const skillName of plugin.inventory.skills) {
        // Resolve the skill file path
        // Skills are in <plugin>/skills/<name>/SKILL.md or <plugin>/skills/<name>.md
        let filePath;
        if (plugin.resolvedPath) {
            const skillDirPath = `${plugin.resolvedPath}/skills/${skillName}`;
            // Prefer direct markdown file entries, otherwise directory with SKILL.md
            filePath = skillName.endsWith('.md')
                ? `${plugin.resolvedPath}/skills/${skillName}`
                : `${skillDirPath}/SKILL.md`;
        }
        else {
            // External plugin - use placeholder path
            filePath = `<external>/${namespace}/skills/${skillName}/SKILL.md`;
        }
        components.push({
            name: skillName.replace(/\.md$/, ''), // Strip .md if present
            namespace,
            type: 'skill',
            filePath,
            source: `plugin:${namespace}`,
            description: undefined, // Would require reading the file
            metadata: {
                ...commonMetadata,
                componentDir: skillName,
            },
        });
    }
    // Process agents
    for (const agentName of plugin.inventory.agents) {
        // Resolve the agent file path
        let filePath;
        if (plugin.resolvedPath) {
            const agentDirPath = `${plugin.resolvedPath}/agents/${agentName}`;
            filePath = agentName.endsWith('.md')
                ? `${plugin.resolvedPath}/agents/${agentName}`
                : `${agentDirPath}/AGENT.md`;
        }
        else {
            filePath = `<external>/${namespace}/agents/${agentName}/AGENT.md`;
        }
        components.push({
            name: agentName.replace(/\.md$/, ''), // Strip .md if present
            namespace,
            type: 'agent',
            filePath,
            source: `plugin:${namespace}`,
            description: undefined, // Would require reading the file
            metadata: {
                ...commonMetadata,
                componentDir: agentName,
            },
        });
    }
    return components;
}
// ============================================================================
// Exports
// ============================================================================
export default NamespacedRegistry;
