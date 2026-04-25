/**
 * Apply user-configured security overrides from global settings.json and env vars.
 *
 * Both overrides are global-only (not project-level) because the threat model is
 * malicious project-level config in cloned repos. Global settings and env vars
 * represent the user's own authority on their machine.
 *
 * Precedence: env var > settings.json > built-in defaults
 */
import { type SettingsManager } from '@gsd/pi-coding-agent';
export declare function applySecurityOverrides(settingsManager: SettingsManager): void;
