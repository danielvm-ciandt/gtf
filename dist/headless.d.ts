/**
 * Headless Orchestrator — `gsd headless`
 *
 * Runs any /gsd subcommand without a TUI by spawning a child process in
 * RPC mode, auto-responding to extension UI requests, and streaming
 * progress to stderr.
 *
 * Exit codes:
 *   0  — complete (command finished successfully)
 *   1  — error or timeout
 *   10 — blocked (command reported a blocker)
 *   11 — cancelled (SIGINT/SIGTERM received)
 */
import type { SessionInfo } from '@gsd/pi-coding-agent';
import type { OutputFormat } from './headless-types.js';
export interface HeadlessOptions {
    timeout: number;
    json: boolean;
    outputFormat: OutputFormat;
    model?: string;
    command: string;
    commandArgs: string[];
    context?: string;
    contextText?: string;
    auto?: boolean;
    verbose?: boolean;
    maxRestarts?: number;
    supervised?: boolean;
    responseTimeout?: number;
    answers?: string;
    eventFilter?: Set<string>;
    resumeSession?: string;
    bare?: boolean;
}
export interface ResumeSessionResult {
    session?: SessionInfo;
    error?: string;
}
/**
 * Resolve a session prefix to a single session.
 * Exact id match is preferred over prefix match.
 * Returns `{ session }` on unique match or `{ error }` on 0/ambiguous matches.
 */
export declare function resolveResumeSession(sessions: SessionInfo[], prefix: string): ResumeSessionResult;
export declare function parseHeadlessArgs(argv: string[]): HeadlessOptions;
export declare function runHeadless(options: HeadlessOptions): Promise<void>;
