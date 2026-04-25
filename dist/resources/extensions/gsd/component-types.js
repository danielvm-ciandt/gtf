/**
 * Unified Component Type Definitions
 *
 * Shared metadata for installable/discoverable skills and agents.
 *
 * Replaces the separate type systems in:
 * - packages/pi-coding-agent/src/core/skills.ts (SkillFrontmatter, Skill)
 * - src/resources/extensions/subagent/agents.ts (AgentConfig)
 *
 * Legacy skill and agent formats are supported via backward-compatible loading.
 */
// ============================================================================
// Validation
// ============================================================================
/** Max name length per spec */
export const MAX_NAME_LENGTH = 64;
/** Max description length per spec */
export const MAX_DESCRIPTION_LENGTH = 1024;
/** Valid name pattern: lowercase a-z, 0-9, hyphens, no leading/trailing/consecutive hyphens */
export const NAME_PATTERN = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
/**
 * Validate a component name.
 * @returns Array of error messages (empty if valid).
 */
export function validateComponentName(name) {
    const errors = [];
    if (!name || name.trim() === '') {
        errors.push('name is required');
        return errors;
    }
    if (name.length > MAX_NAME_LENGTH) {
        errors.push(`name exceeds ${MAX_NAME_LENGTH} characters (${name.length})`);
    }
    if (name.includes('--')) {
        errors.push('name must not contain consecutive hyphens');
    }
    if (!NAME_PATTERN.test(name)) {
        if (/[A-Z]/.test(name)) {
            errors.push('name must be lowercase');
        }
        else if (name.startsWith('-') || name.endsWith('-')) {
            errors.push('name must not start or end with a hyphen');
        }
        else if (!name.includes('--')) {
            errors.push('name must contain only lowercase a-z, 0-9, and hyphens');
        }
    }
    return errors;
}
/**
 * Validate a component description.
 * @returns Array of error messages (empty if valid).
 */
export function validateComponentDescription(description) {
    const errors = [];
    if (!description || description.trim() === '') {
        errors.push('description is required');
    }
    else if (description.length > MAX_DESCRIPTION_LENGTH) {
        errors.push(`description exceeds ${MAX_DESCRIPTION_LENGTH} characters (${description.length})`);
    }
    return errors;
}
/**
 * Compute the canonical ID for a component.
 */
export function computeComponentId(name, namespace) {
    return namespace ? `${namespace}:${name}` : name;
}
