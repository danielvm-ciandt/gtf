import { launchWebMode, stopWebMode, type WebModeLaunchStatus, type WebModeStopOptions, type WebModeStopResult } from './web-mode.js';
export interface CliFlags {
    mode?: 'text' | 'json' | 'rpc' | 'mcp';
    print?: boolean;
    continue?: boolean;
    noSession?: boolean;
    worktree?: boolean | string;
    model?: string;
    listModels?: string | true;
    extensions: string[];
    appendSystemPrompt?: string;
    tools?: string[];
    messages: string[];
    web?: boolean;
    /** Optional project path for web mode: `gsd --web <path>` or `gsd web start <path>` */
    webPath?: string;
    /** Custom host to bind web server to: `--host 0.0.0.0` */
    webHost?: string;
    /** Custom port for web server: `--port 8080` */
    webPort?: number;
    /** Additional allowed origins for CORS: `--allowed-origins http://192.168.1.10:8080` */
    webAllowedOrigins?: string[];
    /** Set by `gsd sessions` when the user picks a specific session to resume */
    _selectedSessionPath?: string;
}
type WritableLike = Pick<typeof process.stderr, 'write'>;
export interface RunWebCliBranchDeps {
    runWebMode?: typeof launchWebMode;
    stopWebMode?: (deps: Parameters<typeof stopWebMode>[0], options?: WebModeStopOptions) => WebModeStopResult;
    cwd?: () => string;
    stderr?: WritableLike;
    baseSessionsDir?: string;
    agentDir?: string;
    webPreferencesPath?: string;
}
export declare function parseCliArgs(argv: string[]): CliFlags;
export declare function buildHeadlessAutoArgs(flags: Pick<CliFlags, 'messages' | 'model'>): string[];
export { getProjectSessionsDir } from './project-sessions.js';
export declare function migrateLegacyFlatSessions(baseSessionsDir: string, projectSessionsDir: string): void;
/**
 * Resolve the working directory for context-aware launch detection.
 *
 * If the user has configured a dev root via onboarding and their cwd is inside
 * a project under that dev root, return the one-level-deep project directory.
 * Otherwise, return the cwd unchanged (browser picker handles selection).
 *
 * Edge cases handled:
 * - Missing or unreadable prefs file → cwd unchanged
 * - No devRoot field in prefs → cwd unchanged
 * - devRoot path doesn't exist (stale) → cwd unchanged
 * - cwd IS the devRoot → cwd unchanged (picker selects)
 * - cwd outside devRoot → cwd unchanged
 */
export declare function resolveContextAwareCwd(currentCwd: string, prefsPath: string): string;
export type RunWebCliBranchResult = {
    handled: false;
} | {
    handled: true;
    exitCode: number;
    action: 'start';
    status: WebModeLaunchStatus;
    launchInputs: {
        cwd: string;
        projectSessionsDir: string;
        agentDir: string;
    };
} | {
    handled: true;
    exitCode: number;
    action: 'stop';
    stopResult: WebModeStopResult;
};
export declare function runWebCliBranch(flags: CliFlags, deps?: RunWebCliBranchDeps): Promise<RunWebCliBranchResult>;
