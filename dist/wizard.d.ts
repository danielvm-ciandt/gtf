import type { AuthStorage } from '@gsd/pi-coding-agent';
/**
 * Hydrate process.env from stored auth.json credentials for optional tool keys.
 * Runs on every launch so extensions see Brave/Context7/Jina keys stored via the
 * wizard on prior launches.
 */
export declare function loadStoredEnvKeys(authStorage: AuthStorage): void;
