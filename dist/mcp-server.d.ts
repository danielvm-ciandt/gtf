/**
 * Minimal tool interface matching GSD's AgentTool shape.
 * Avoids a direct dependency on @gsd/pi-agent-core from this compiled module.
 *
 * `details` and `isError` are optional fields that runtime tool implementations
 * may populate. The MCP transport drops non-standard fields, so the wrapper at
 * the call site mirrors `details` into `structuredContent` and forwards
 * `isError` directly. See #4472.
 */
export interface McpToolDef {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    execute(toolCallId: string, params: Record<string, unknown>, signal?: AbortSignal, onUpdate?: unknown): Promise<{
        content: Array<{
            type: string;
            text?: string;
            data?: string;
            mimeType?: string;
        }>;
        details?: Record<string, unknown>;
        isError?: boolean;
    }>;
}
/**
 * Starts a native MCP (Model Context Protocol) server over stdin/stdout.
 *
 * This enables GSD's tools (read, write, edit, bash, grep, glob, ls, etc.)
 * to be used by external AI clients such as Claude Desktop, VS Code Copilot,
 * and any MCP-compatible host.
 *
 * The server registers all tools from the agent session's tool registry and
 * maps MCP tools/list and tools/call requests to GSD tool definitions and
 * execution, respectively.
 *
 * All MCP SDK imports are dynamic to avoid subpath export resolution issues
 * with TypeScript's NodeNext module resolution.
 */
export declare function startMcpServer(options: {
    tools: McpToolDef[];
    version?: string;
}): Promise<void>;
