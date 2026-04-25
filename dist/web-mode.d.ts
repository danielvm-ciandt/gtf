import { type ChildProcess, type SpawnOptions } from 'node:child_process';
type WritableLike = Pick<typeof process.stderr, 'write'>;
type SpawnedChildLike = Pick<ChildProcess, 'once' | 'unref' | 'pid'>;
export interface WebModeLaunchOptions {
    cwd: string;
    projectSessionsDir: string;
    agentDir: string;
    packageRoot?: string;
    host?: string;
    port?: number;
    /** Additional allowed origins for CORS (forwarded as GSD_WEB_ALLOWED_ORIGINS). */
    allowedOrigins?: string[];
}
export interface ResolvedWebHostBootstrap {
    ok: true;
    kind: 'packaged-standalone' | 'source-dev';
    packageRoot: string;
    hostRoot: string;
    entryPath: string;
}
export interface UnresolvedWebHostBootstrap {
    ok: false;
    packageRoot: string;
    reason: string;
    candidates: string[];
}
export type WebHostBootstrap = ResolvedWebHostBootstrap | UnresolvedWebHostBootstrap;
export interface WebModeLaunchSuccess {
    mode: 'web';
    ok: true;
    cwd: string;
    projectSessionsDir: string;
    host: string;
    port: number;
    url: string;
    hostKind: ResolvedWebHostBootstrap['kind'];
    hostPath: string;
    hostRoot: string;
}
export interface WebModeLaunchFailure {
    mode: 'web';
    ok: false;
    cwd: string;
    projectSessionsDir: string;
    host: string;
    port: number | null;
    url: string | null;
    hostKind: ResolvedWebHostBootstrap['kind'] | 'unresolved';
    hostPath: string | null;
    hostRoot: string | null;
    failureReason: string;
    candidates?: string[];
}
export type WebModeLaunchStatus = WebModeLaunchSuccess | WebModeLaunchFailure;
export interface WebModeDeps {
    existsSync?: (path: string) => boolean;
    initResources?: (agentDir: string) => void;
    resolvePort?: (host: string) => Promise<number>;
    spawn?: (command: string, args: readonly string[], options: SpawnOptions) => SpawnedChildLike;
    waitForBootReady?: (url: string) => Promise<void>;
    openBrowser?: (url: string) => void;
    stderr?: WritableLike;
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    execPath?: string;
    pidFilePath?: string;
    writePidFile?: (path: string, pid: number) => void;
    readPidFile?: (path: string) => number | null;
    deletePidFile?: (path: string) => void;
    /** Path to the multi-instance registry JSON (for testing). */
    registryPath?: string;
}
export interface WebModeStopResult {
    ok: boolean;
    reason?: string;
    /** How many instances were stopped (relevant for --all) */
    stoppedCount?: number;
}
export interface WebInstanceEntry {
    pid: number;
    port: number;
    url: string;
    cwd: string;
    startedAt: string;
}
export type WebInstanceRegistry = Record<string, WebInstanceEntry>;
export declare function readInstanceRegistry(registryPath?: string): WebInstanceRegistry;
export declare function writeInstanceRegistry(registry: WebInstanceRegistry, registryPath?: string): void;
export declare function registerInstance(cwd: string, entry: Omit<WebInstanceEntry, 'cwd' | 'startedAt'>, registryPath?: string): void;
export declare function unregisterInstance(cwd: string, registryPath?: string): void;
export declare function writePidFile(filePath: string, pid: number): void;
export declare function readPidFile(filePath: string): number | null;
export declare function deletePidFile(filePath: string): void;
export interface WebModeStopOptions {
    /** Stop instance for a specific project path */
    projectCwd?: string;
    /** Stop all running instances */
    all?: boolean;
}
export declare function stopWebMode(deps?: Pick<WebModeDeps, 'pidFilePath' | 'readPidFile' | 'deletePidFile' | 'stderr'>, options?: WebModeStopOptions): WebModeStopResult;
export declare function resolveWebHostBootstrap(options?: {
    packageRoot?: string;
    existsSync?: (path: string) => boolean;
}): WebHostBootstrap;
export declare function reserveWebPort(host?: string): Promise<number>;
export declare function launchWebMode(options: WebModeLaunchOptions, deps?: WebModeDeps): Promise<WebModeLaunchStatus>;
export {};
