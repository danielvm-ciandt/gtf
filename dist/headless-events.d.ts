/**
 * Headless Event Detection — notification classification and command detection
 *
 * Detects terminal notifications, blocked notifications, milestone-ready signals,
 * and classifies commands as quick (single-turn) vs long-running.
 *
 * Also defines exit code constants and the status→exit-code mapping function.
 */
export declare const EXIT_SUCCESS = 0;
export declare const EXIT_ERROR = 1;
export declare const EXIT_BLOCKED = 10;
export declare const EXIT_CANCELLED = 11;
/**
 * Map a headless session status string to its standardized exit code.
 *
 *   success   → 0
 *   complete  → 0
 *   completed → 0
 *   error     → 1
 *   timeout   → 1
 *   blocked   → 10
 *   cancelled → 11
 *
 * Unknown statuses default to EXIT_ERROR (1).
 */
export declare function mapStatusToExitCode(status: string): number;
/**
 * Detect genuine auto-mode termination notifications.
 *
 * Only matches the actual stop signals emitted by stopAuto():
 *   "Auto-mode stopped..."
 *   "Step-mode stopped..."
 *
 * Does NOT match progress notifications that happen to contain words like
 * "complete" or "stopped" (e.g., "Override resolved — rewrite-docs completed",
 * "All slices are complete — nothing to discuss", "Skipped 5+ completed units").
 *
 * Blocked detection is separate — checked via isBlockedNotification.
 */
export declare const TERMINAL_PREFIXES: string[];
export declare const IDLE_TIMEOUT_MS = 15000;
export declare const NEW_MILESTONE_IDLE_TIMEOUT_MS = 120000;
export declare function isTerminalNotification(event: Record<string, unknown>): boolean;
export declare function isBlockedNotification(event: Record<string, unknown>): boolean;
export declare function isMilestoneReadyNotification(event: Record<string, unknown>): boolean;
export declare function isInteractiveHeadlessTool(toolName: string | undefined): boolean;
export declare function shouldArmHeadlessIdleTimeout(toolCallCount: number, interactiveToolCount: number): boolean;
export declare const FIRE_AND_FORGET_METHODS: Set<string>;
export declare const QUICK_COMMANDS: Set<string>;
export declare function isQuickCommand(command: string, commandArgs?: readonly string[]): boolean;
