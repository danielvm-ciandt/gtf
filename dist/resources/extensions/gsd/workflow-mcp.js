import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const MCP_WORKFLOW_TOOL_SURFACE = new Set([
    "ask_user_questions",
    "gsd_decision_save",
    "gsd_exec",
    "gsd_exec_search",
    "gsd_resume",
    "gsd_complete_milestone",
    "gsd_complete_task",
    "gsd_complete_slice",
    "gsd_generate_milestone_id",
    "gsd_journal_query",
    "gsd_milestone_complete",
    "gsd_milestone_generate_id",
    "gsd_checkpoint_db",
    "gsd_milestone_status",
    "gsd_milestone_validate",
    "gsd_plan_task",
    "gsd_plan_milestone",
    "gsd_plan_slice",
    "gsd_replan_slice",
    "gsd_reassess_roadmap",
    "gsd_requirement_save",
    "gsd_requirement_update",
    "gsd_roadmap_reassess",
    "gsd_save_decision",
    "gsd_save_gate_result",
    "gsd_save_requirement",
    "gsd_skip_slice",
    "gsd_slice_replan",
    "gsd_slice_complete",
    "gsd_summary_save",
    "gsd_task_plan",
    "gsd_task_complete",
    "gsd_update_requirement",
    "gsd_validate_milestone",
]);
function parseLookupOutput(output) {
    return output
        .toString()
        .trim()
        .split(/\r?\n/)[0] ?? "";
}
function parseJsonEnv(env, name) {
    const raw = env[name];
    if (!raw)
        return undefined;
    try {
        return JSON.parse(raw);
    }
    catch {
        throw new Error(`Invalid JSON in ${name}`);
    }
}
function lookupCommand(command, platform = process.platform) {
    const lookup = platform === "win32" ? `where ${command}` : `which ${command}`;
    try {
        const resolved = parseLookupOutput(execSync(lookup, { timeout: 5_000, stdio: "pipe" }));
        return resolved || null;
    }
    catch {
        return null;
    }
}
function findWorkflowCliFromAncestorPath(startPath) {
    let current = resolve(startPath);
    while (true) {
        const candidate = resolve(current, "packages", "mcp-server", "dist", "cli.js");
        if (existsSync(candidate))
            return candidate;
        const parent = dirname(current);
        if (parent === current)
            break;
        current = parent;
    }
    return null;
}
function getBundledWorkflowMcpCliPath(env) {
    const envAnchors = [
        env.GSD_BIN_PATH?.trim(),
        env.GSD_CLI_PATH?.trim(),
        env.GSD_WORKFLOW_PATH?.trim(),
    ].filter((value) => typeof value === "string" && value.length > 0);
    for (const anchor of envAnchors) {
        const candidate = findWorkflowCliFromAncestorPath(anchor);
        if (candidate)
            return candidate;
    }
    const candidates = [
        resolve(fileURLToPath(new URL("../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/src/cli.ts", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../../packages/mcp-server/dist/cli.js", import.meta.url))),
    ];
    for (const bundledCli of candidates) {
        if (existsSync(bundledCli))
            return bundledCli;
    }
    return null;
}
function getBundledWorkflowExecutorModulePath() {
    const candidates = [
        resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.js", import.meta.url))),
        resolve(fileURLToPath(new URL("./tools/workflow-tool-executors.ts", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/gsd/tools/workflow-tool-executors.js", import.meta.url))),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function getBundledWorkflowWriteGateModulePath() {
    const candidates = [
        resolve(fileURLToPath(new URL("./bootstrap/write-gate.js", import.meta.url))),
        resolve(fileURLToPath(new URL("./bootstrap/write-gate.ts", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../dist/resources/extensions/gsd/bootstrap/write-gate.js", import.meta.url))),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function getResolveTsHookPath() {
    const candidates = [
        resolve(fileURLToPath(new URL("./tests/resolve-ts.mjs", import.meta.url))),
        resolve(fileURLToPath(new URL("../../../../src/resources/extensions/gsd/tests/resolve-ts.mjs", import.meta.url))),
    ];
    for (const candidate of candidates) {
        if (existsSync(candidate))
            return candidate;
    }
    return null;
}
function mergeNodeOptions(existing, additions) {
    const tokens = (existing ?? "").split(/\s+/).map((value) => value.trim()).filter(Boolean);
    for (const addition of additions) {
        if (!tokens.includes(addition)) {
            tokens.push(addition);
        }
    }
    return tokens.length > 0 ? tokens.join(" ") : undefined;
}
function buildWorkflowLaunchEnv(projectRoot, gsdCliPath, explicitEnv, workflowCliPath) {
    const executorModulePath = getBundledWorkflowExecutorModulePath();
    const writeGateModulePath = getBundledWorkflowWriteGateModulePath();
    const resolveTsHookPath = getResolveTsHookPath();
    const wantsSourceTs = Boolean(resolveTsHookPath) &&
        ((workflowCliPath?.endsWith(".ts") ?? false) ||
            (executorModulePath?.endsWith(".ts") ?? false) ||
            (writeGateModulePath?.endsWith(".ts") ?? false));
    const nodeOptions = wantsSourceTs
        ? mergeNodeOptions(explicitEnv?.NODE_OPTIONS, [
            "--experimental-strip-types",
            `--import=${pathToFileURL(resolveTsHookPath).href}`,
        ])
        : explicitEnv?.NODE_OPTIONS;
    return {
        ...(explicitEnv ?? {}),
        ...(gsdCliPath ? { GSD_CLI_PATH: gsdCliPath } : {}),
        ...(executorModulePath ? { GSD_WORKFLOW_EXECUTORS_MODULE: executorModulePath } : {}),
        ...(writeGateModulePath ? { GSD_WORKFLOW_WRITE_GATE_MODULE: writeGateModulePath } : {}),
        ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
        GSD_PERSIST_WRITE_GATE_STATE: "1",
        GSD_WORKFLOW_PROJECT_ROOT: projectRoot,
    };
}
export function detectWorkflowMcpLaunchConfig(projectRoot = process.cwd(), env = process.env) {
    const name = env.GSD_WORKFLOW_MCP_NAME?.trim() || "gsd-workflow";
    const explicitCommand = env.GSD_WORKFLOW_MCP_COMMAND?.trim();
    const explicitArgs = parseJsonEnv(env, "GSD_WORKFLOW_MCP_ARGS");
    const explicitEnv = parseJsonEnv(env, "GSD_WORKFLOW_MCP_ENV");
    const explicitCwd = env.GSD_WORKFLOW_MCP_CWD?.trim();
    const gsdCliPath = env.GSD_CLI_PATH?.trim() || env.GSD_BIN_PATH?.trim();
    const workflowProjectRoot = explicitEnv?.GSD_WORKFLOW_PROJECT_ROOT?.trim() ||
        env.GSD_WORKFLOW_PROJECT_ROOT?.trim() ||
        env.GSD_PROJECT_ROOT?.trim() ||
        explicitCwd ||
        projectRoot;
    const resolvedWorkflowProjectRoot = resolve(workflowProjectRoot);
    if (explicitCommand) {
        const launchEnv = buildWorkflowLaunchEnv(resolve(workflowProjectRoot), gsdCliPath, explicitEnv);
        return {
            name,
            command: explicitCommand,
            args: Array.isArray(explicitArgs) && explicitArgs.length > 0 ? explicitArgs.map(String) : undefined,
            cwd: explicitCwd || undefined,
            env: Object.keys(launchEnv).length > 0 ? launchEnv : undefined,
        };
    }
    const distCli = resolve(resolvedWorkflowProjectRoot, "packages", "mcp-server", "dist", "cli.js");
    if (existsSync(distCli)) {
        return {
            name,
            command: process.execPath,
            args: [distCli],
            cwd: resolvedWorkflowProjectRoot,
            env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath, undefined, distCli),
        };
    }
    const bundledCli = getBundledWorkflowMcpCliPath(env);
    if (bundledCli) {
        return {
            name,
            command: process.execPath,
            args: [bundledCli],
            cwd: resolvedWorkflowProjectRoot,
            env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath, undefined, bundledCli),
        };
    }
    const binPath = lookupCommand("gsd-mcp-server");
    if (binPath) {
        return {
            name,
            command: binPath,
            env: buildWorkflowLaunchEnv(resolvedWorkflowProjectRoot, gsdCliPath),
        };
    }
    return null;
}
export function buildWorkflowMcpServers(projectRoot = process.cwd(), env = process.env) {
    const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
    if (!launch)
        return undefined;
    return {
        [launch.name]: {
            command: launch.command,
            ...(launch.args && launch.args.length > 0 ? { args: launch.args } : {}),
            ...(launch.env ? { env: launch.env } : {}),
            ...(launch.cwd ? { cwd: launch.cwd } : {}),
        },
    };
}
export function getRequiredWorkflowToolsForGuidedUnit(unitType) {
    switch (unitType) {
        case "discuss-milestone":
            return ["gsd_summary_save", "gsd_plan_milestone"];
        case "discuss-slice":
            return ["gsd_summary_save"];
        case "research-milestone":
        case "research-slice":
            return ["gsd_summary_save"];
        case "plan-milestone":
            return ["gsd_plan_milestone"];
        case "plan-slice":
            return ["gsd_plan_slice"];
        case "execute-task":
            return ["gsd_task_complete"];
        case "complete-slice":
            return ["gsd_slice_complete"];
        default:
            return [];
    }
}
export function getRequiredWorkflowToolsForAutoUnit(unitType) {
    switch (unitType) {
        case "discuss-milestone":
            return ["gsd_summary_save", "gsd_plan_milestone"];
        case "research-milestone":
        case "research-slice":
        case "run-uat":
            return ["gsd_summary_save"];
        case "plan-milestone":
            return ["gsd_plan_milestone"];
        case "plan-slice":
            return ["gsd_plan_slice"];
        case "execute-task":
        case "execute-task-simple":
        case "reactive-execute":
            return ["gsd_complete_task"];
        case "complete-slice":
            return ["gsd_complete_slice"];
        case "replan-slice":
            return ["gsd_replan_slice"];
        case "reassess-roadmap":
            return ["gsd_milestone_status", "gsd_reassess_roadmap"];
        case "gate-evaluate":
            return ["gsd_save_gate_result"];
        case "validate-milestone":
            return ["gsd_milestone_status", "gsd_validate_milestone"];
        case "complete-milestone":
            return ["gsd_milestone_status", "gsd_complete_milestone"];
        default:
            return [];
    }
}
export function usesWorkflowMcpTransport(authMode, baseUrl) {
    return authMode === "externalCli" && typeof baseUrl === "string" && baseUrl.startsWith("local://");
}
export function supportsStructuredQuestions(activeTools, options = {}) {
    if (!activeTools.includes("ask_user_questions"))
        return false;
    return true;
}
export function getWorkflowTransportSupportError(provider, requiredTools, options = {}) {
    if (!provider || requiredTools.length === 0)
        return null;
    if (!usesWorkflowMcpTransport(options.authMode, options.baseUrl))
        return null;
    const projectRoot = options.projectRoot ?? process.cwd();
    const env = options.env ?? process.env;
    const launch = detectWorkflowMcpLaunchConfig(projectRoot, env);
    const surface = options.surface ?? "workflow dispatch";
    const unitLabel = options.unitType ? ` for ${options.unitType}` : "";
    const providerLabel = `"${provider}"`;
    if (!launch) {
        return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: the GSD workflow MCP server is not configured or discoverable. Detected Claude Code model but no workflow MCP. Please run /gsd mcp init . from your project root. You can also configure GSD_WORKFLOW_MCP_COMMAND, build packages/mcp-server/dist/cli.js, or install gsd-mcp-server on PATH.`;
    }
    const missing = [...new Set(requiredTools)].filter((tool) => !MCP_WORKFLOW_TOOL_SURFACE.has(tool));
    if (missing.length === 0)
        return null;
    return `Provider ${providerLabel} cannot run ${surface}${unitLabel}: this unit requires ${missing.join(", ")}, but the workflow MCP transport currently exposes only ${Array.from(MCP_WORKFLOW_TOOL_SURFACE).sort().join(", ")}.`;
}
