/**
 * One-time migration of provider credentials from Pi (~/.pi/agent/auth.json)
 * into GSD's auth storage. Runs when GSD has no LLM providers configured,
 * so users with an existing Pi install skip re-authentication.
 */
import type { AuthStorage } from '@gsd/pi-coding-agent';
/**
 * Migrate provider credentials from Pi's auth.json into GSD's AuthStorage.
 *
 * Only runs when GSD has no LLM provider configured and Pi's auth.json exists.
 * Copies any credentials GSD doesn't already have. Returns true if an LLM
 * provider was migrated (so onboarding can be skipped).
 */
export declare function migratePiCredentials(authStorage: AuthStorage): boolean;
export declare function getPiDefaultModelAndProvider(): {
    provider: string;
    model: string;
} | null;
