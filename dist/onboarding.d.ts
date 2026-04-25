/**
 * Unified first-run onboarding wizard.
 *
 * Replaces the raw API-key-only wizard with a branded, clack-based experience
 * that guides users through LLM provider authentication before the TUI launches.
 *
 * Flow: logo -> choose LLM provider -> authenticate (OAuth or API key) ->
 *       optional tool keys -> summary -> TUI launches.
 *
 * All steps are skippable. All errors are recoverable. Never crashes boot.
 */
import type { AuthStorage } from '@gsd/pi-coding-agent';
type ClackModule = typeof import('@clack/prompts');
type PicoModule = {
    cyan: (s: string) => string;
    green: (s: string) => string;
    yellow: (s: string) => string;
    dim: (s: string) => string;
    bold: (s: string) => string;
    red: (s: string) => string;
    reset: (s: string) => string;
};
interface RunOnboardingOptions {
    /** Show logo + intro banner. Disable when onboarding is launched inside an active TUI session. */
    showIntro?: boolean;
}
/**
 * Determine if the onboarding wizard should run.
 *
 * Returns true when:
 * - No LLM provider auth is available
 * - We're on a TTY (interactive terminal)
 *
 * Returns false (skip wizard) when:
 * - Any LLM provider is already available via auth.json, env vars, runtime overrides, or fallback auth
 * - A default provider is already configured in settings (covers extension-based providers
 *   that may not require credentials in auth.json)
 * - Not a TTY (piped input, subagent, CI)
 */
export declare function shouldRunOnboarding(authStorage: AuthStorage, settingsDefaultProvider?: string): boolean;
/**
 * Run the unified onboarding wizard.
 *
 * Walks the user through:
 * 1. Choose LLM provider
 * 2. Authenticate (OAuth or API key)
 * 3. Optional tool API keys
 * 4. Summary
 *
 * All steps are skippable. All errors are recoverable.
 * Writes status to stderr during execution.
 */
export declare function runOnboarding(authStorage: AuthStorage, opts?: RunOnboardingOptions): Promise<void>;
export declare function runLlmStep(p: ClackModule, pc: PicoModule, authStorage: AuthStorage): Promise<boolean>;
export declare function runWebSearchStep(p: ClackModule, pc: PicoModule, authStorage: AuthStorage, isAnthropicAuth: boolean): Promise<string | null>;
export declare function runToolKeysStep(p: ClackModule, pc: PicoModule, authStorage: AuthStorage): Promise<number>;
export declare function runRemoteQuestionsStep(p: ClackModule, pc: PicoModule, authStorage: AuthStorage): Promise<string | null>;
export {};
