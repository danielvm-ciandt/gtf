/**
 * GSD Welcome Screen
 *
 * Two-panel bar layout: full-width accent bars at top/bottom (matching the
 * auto-mode progress widget style), logo left (fixed width), info right.
 * Falls back to simple text on narrow terminals (<70 cols) or non-TTY.
 */
export interface WelcomeScreenOptions {
    version: string;
    modelName?: string;
    provider?: string;
    remoteChannel?: string;
}
export declare function printWelcomeScreen(opts: WelcomeScreenOptions): void;
