/**
 * Headless UI Handling — auto-response, progress formatting, and supervised stdin
 *
 * Handles extension UI requests (auto-responding in headless mode),
 * formats progress events for stderr output, and reads orchestrator
 * commands from stdin in supervised mode.
 */
import { RpcClient } from '@gsd/pi-coding-agent';
interface ExtensionUIRequest {
    type: 'extension_ui_request';
    id: string;
    method: string;
    title?: string;
    options?: string[];
    message?: string;
    prefill?: string;
    timeout?: number;
    [key: string]: unknown;
}
export type { ExtensionUIRequest };
/** Context passed alongside an event for richer formatting. */
export interface ProgressContext {
    verbose: boolean;
    toolDuration?: number;
    lastCost?: {
        costUsd: number;
        inputTokens: number;
        outputTokens: number;
    };
    thinkingPreview?: string;
    isError?: boolean;
}
/**
 * Produce a short human-readable summary of tool arguments.
 * Returns a string like "path/to/file.ts" or "grep pattern *.ts" — never the
 * full JSON blob.
 */
export declare function summarizeToolArgs(toolName: unknown, toolInput: unknown): string;
export declare function handleExtensionUIRequest(event: ExtensionUIRequest, client: RpcClient): void;
export declare function formatProgress(event: Record<string, unknown>, ctx: ProgressContext): string | null;
/**
 * Format a thinking preview line from accumulated LLM text deltas.
 * Used as a fallback when streaming is not enabled — shows a truncated one-liner.
 */
export declare function formatThinkingLine(text: string): string;
/**
 * Format a text_start marker — printed once when the assistant begins a text block.
 */
export declare function formatTextStart(): string;
/**
 * Format a text_end marker — printed after the last text_delta.
 */
export declare function formatTextEnd(): string;
/**
 * Format a thinking_start marker.
 */
export declare function formatThinkingStart(): string;
/**
 * Format a thinking_end marker.
 */
export declare function formatThinkingEnd(): string;
/**
 * Format a cost line (used for periodic cost updates in verbose mode).
 */
export declare function formatCostLine(costUsd: number, inputTokens: number, outputTokens: number): string;
export declare function startSupervisedStdinReader(client: RpcClient, onResponse: (id: string) => void): () => void;
