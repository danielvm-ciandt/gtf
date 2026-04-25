import { spawnSync } from "node:child_process";
import { GSD_RTK_DISABLED_ENV, GSD_RTK_PATH_ENV, RTK_TELEMETRY_DISABLED_ENV, getManagedRtkDir, getRtkBinaryName, isRtkEnabled } from "./rtk-shared.js";
export declare const RTK_VERSION = "0.33.1";
export declare const GSD_SKIP_RTK_INSTALL_ENV = "GSD_SKIP_RTK_INSTALL";
export { GSD_RTK_DISABLED_ENV, GSD_RTK_PATH_ENV, RTK_TELEMETRY_DISABLED_ENV, getManagedRtkDir, getRtkBinaryName, isRtkEnabled, };
export interface EnsureRtkOptions {
    targetDir?: string;
    allowDownload?: boolean;
    env?: NodeJS.ProcessEnv;
    pathValue?: string;
    releaseVersion?: string;
    log?: (message: string) => void;
}
export interface EnsureRtkResult {
    enabled: boolean;
    supported: boolean;
    available: boolean;
    source: "disabled" | "unsupported" | "managed" | "system" | "downloaded" | "missing";
    binaryPath?: string;
    reason?: string;
}
export declare function getManagedRtkPath(platform?: NodeJS.Platform, targetDir?: string): string;
export declare function prependPathEntry(env: NodeJS.ProcessEnv, entry: string): NodeJS.ProcessEnv;
export declare function applyRtkProcessEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function buildRtkEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv;
export declare function resolveRtkAssetName(platform: NodeJS.Platform, arch: string, version?: string): string | null;
export interface ResolveRtkBinaryPathOptions {
    binaryPath?: string;
    env?: NodeJS.ProcessEnv;
    pathValue?: string;
    platform?: NodeJS.Platform;
    targetDir?: string;
}
export declare function resolveRtkBinaryPath(options?: ResolveRtkBinaryPathOptions): string | null;
export interface RewriteCommandOptions {
    binaryPath?: string;
    env?: NodeJS.ProcessEnv;
    timeoutMs?: number;
    spawnSyncImpl?: typeof spawnSync;
}
export declare function rewriteCommandWithRtk(command: string, options?: RewriteCommandOptions): string;
export interface ValidateRtkBinaryOptions {
    spawnSyncImpl?: typeof spawnSync;
    env?: NodeJS.ProcessEnv;
}
export declare function validateRtkBinary(binaryPath: string, options?: ValidateRtkBinaryOptions): boolean;
export declare function ensureRtkAvailable(options?: EnsureRtkOptions): Promise<EnsureRtkResult>;
export declare function bootstrapRtk(options?: EnsureRtkOptions): Promise<EnsureRtkResult>;
