/**
 * Platform-correct binary name for the Claude Code CLI.
 *
 * On Windows, npm-global binaries are installed as `.cmd` shims and
 * `execFileSync` does not auto-resolve the extension — calling bare
 * `claude` would fail with ENOENT even when the CLI is installed and
 * authenticated. Mirrors the `NPM_COMMAND` pattern in
 * `src/resources/extensions/gsd/pre-execution-checks.ts`.
 */
export declare const CLAUDE_COMMAND: string;
/**
 * Check if the `claude` binary is installed (regardless of auth state).
 */
export declare function isClaudeBinaryInstalled(): boolean;
/**
 * Check if the `claude` CLI is installed AND authenticated.
 */
export declare function isClaudeCliReady(): boolean;
