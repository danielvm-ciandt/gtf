/**
 * Models.json resolution with fallback to ~/.pi/agent/models.json
 *
 * GSD uses ~/.gsd/agent/models.json, but for a smooth migration/development
 * experience, this module provides resolution logic that:
 *
 * 1. Reads ~/.gsd/agent/models.json if it exists
 * 2. Falls back to ~/.pi/agent/models.json if GSD file doesn't exist
 * 3. Merges both files if both exist (GSD takes precedence)
 */
/**
 * Resolve the path to models.json with fallback logic.
 *
 * Priority:
 * 1. ~/.gsd/agent/models.json (exists) → return this path
 * 2. ~/.pi/agent/models.json (exists) → return this path (fallback)
 * 3. Neither exists → return GSD path (will be created)
 *
 * @returns The path to use for models.json
 */
export declare function resolveModelsJsonPath(): string;
