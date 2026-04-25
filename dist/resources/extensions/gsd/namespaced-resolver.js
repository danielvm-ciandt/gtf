/**
 * Namespaced Resolver Module
 *
 * Implements context-aware resolution with three-tier lookup precedence:
 * 1. Canonical (fully-qualified names with `:`)
 * 2. Local-first (caller namespace + bare name)
 * 3. Shorthand (bare name matched across all namespaces)
 *
 * This is the core logic for D003 (same-plugin local-first) and R007/R008 (safe shorthand).
 */
// ============================================================================
// NamespacedResolver Class
// ============================================================================
/**
 * Resolver for namespaced components with context-aware lookup.
 *
 * Implements four-tier resolution precedence:
 * 1. **Canonical**: If name contains `:`, try exact match → return canonical result
 * 2. **Alias**: If name is a registered alias → return alias result
 * 3. **Local-first**: If `context.callerNamespace` exists, try `${callerNamespace}:${name}` → return local-first result
 * 4. **Shorthand**: Scan all components for bare name match → single match returns shorthand, multiple returns ambiguous
 *
 * Usage:
 * ```typescript
 * const registry = new NamespacedRegistry();
 * // ... populate registry ...
 * // ... register aliases ...
 *
 * const resolver = new NamespacedResolver(registry);
 *
 * // Canonical lookup
 * const canon = resolver.resolve('farm:call-horse');
 * // canon.resolution === 'canonical'
 *
 * // Alias resolution
 * const alias = resolver.resolve('py3d');
 * // alias.resolution === 'alias', alias.canonicalName === 'python-tools:3d-visualizer'
 *
 * // Local-first resolution from caller context
 * const local = resolver.resolve('call-horse', { callerNamespace: 'farm' });
 * // local.resolution === 'local-first'
 *
 * // Unambiguous shorthand
 * const short = resolver.resolve('unique-skill');
 * // short.resolution === 'shorthand'
 *
 * // Ambiguous shorthand
 * const amb = resolver.resolve('common-skill');
 * // amb.resolution === 'ambiguous', amb.candidates has all matches
 * ```
 */
export class NamespacedResolver {
    /** The registry to resolve against */
    registry;
    /**
     * Create a new resolver for the given registry.
     *
     * @param registry - The namespaced registry to resolve against
     */
    constructor(registry) {
        this.registry = registry;
    }
    /**
     * Resolve a component name with context-aware lookup.
     *
     * Implements four-tier resolution precedence:
     * 1. **Canonical**: If name contains `:`, try exact match → return canonical result
     * 2. **Alias**: If name is a registered alias → return alias result
     * 3. **Local-first**: If `context.callerNamespace` exists, try `${callerNamespace}:${name}` → return local-first result
     * 4. **Shorthand**: Scan all components for bare name match → single match returns shorthand, multiple returns ambiguous
     *
     * @param name - The name to resolve (canonical or bare)
     * @param context - Optional resolution context with caller namespace
     * @param type - Optional type filter (skill or agent)
     * @returns Resolution result indicating how the match was found
     */
    resolve(name, context, type) {
        // Tier 1: Canonical lookup (name contains `:`)
        if (name.includes(':')) {
            const component = this.registry.getByCanonical(name);
            if (component && this.matchesType(component, type)) {
                return {
                    requestedName: name,
                    resolution: 'canonical',
                    component,
                };
            }
            // Canonical name not found
            return {
                requestedName: name,
                resolution: 'not-found',
            };
        }
        // Tier 2: Alias lookup (before local-first and shorthand)
        const aliasTarget = this.registry.resolveAlias(name);
        if (aliasTarget) {
            const component = this.registry.getByCanonical(aliasTarget);
            if (component && this.matchesType(component, type)) {
                return {
                    requestedName: name,
                    resolution: 'alias',
                    component,
                    alias: name,
                    canonicalName: aliasTarget,
                };
            }
        }
        // Tier 3: Local-first resolution (if caller namespace provided)
        if (context?.callerNamespace) {
            const localCanonical = `${context.callerNamespace}:${name}`;
            const component = this.registry.getByCanonical(localCanonical);
            if (component && this.matchesType(component, type)) {
                return {
                    requestedName: name,
                    resolution: 'local-first',
                    component,
                    matchedNamespace: context.callerNamespace,
                };
            }
        }
        // Tier 4: Shorthand resolution (scan all components)
        const candidates = this.findBareNameMatches(name, type);
        if (candidates.length === 0) {
            return {
                requestedName: name,
                resolution: 'not-found',
            };
        }
        if (candidates.length === 1) {
            return {
                requestedName: name,
                resolution: 'shorthand',
                component: candidates[0],
            };
        }
        // Multiple matches - ambiguous
        return {
            requestedName: name,
            resolution: 'ambiguous',
            candidates,
        };
    }
    /**
     * Find all components whose local name (without namespace) matches the given bare name.
     * Optionally filters by component type.
     *
     * @param bareName - The bare name to match
     * @param type - Optional type filter
     * @returns Array of matching components
     */
    findBareNameMatches(bareName, type) {
        const all = this.registry.getAll();
        return all.filter((component) => {
            // Match by local name (component.name)
            if (component.name !== bareName) {
                return false;
            }
            // Apply type filter if provided
            return this.matchesType(component, type);
        });
    }
    /**
     * Check if a component matches the optional type filter.
     *
     * @param component - The component to check
     * @param type - Optional type filter
     * @returns true if no filter or type matches
     */
    matchesType(component, type) {
        return type === undefined || component.type === type;
    }
}
// ============================================================================
// Exports
// ============================================================================
export default NamespacedResolver;
