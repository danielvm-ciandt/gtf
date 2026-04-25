/**
 * Graph-aware context injection for dispatch prompt builders.
 *
 * Reads the pre-built graph.json and returns a formatted context block
 * for injection into prompts. Gracefully returns null when no graph exists
 * or the query yields no results — callers must handle null.
 */
import { logWarning } from "./workflow-logger.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
let cachedGraphApi = null;
let resolvedGraphApi = false;
function readGraphFile(projectDir) {
    try {
        const graphPath = join(projectDir, ".gsd", "graphs", "graph.json");
        const raw = readFileSync(graphPath, "utf-8");
        const parsed = JSON.parse(raw);
        const nodes = Array.isArray(parsed.nodes) ? parsed.nodes : [];
        const edges = Array.isArray(parsed.edges) ? parsed.edges : [];
        return { nodes, edges, builtAt: typeof parsed.builtAt === "string" ? parsed.builtAt : undefined };
    }
    catch {
        return null;
    }
}
async function fallbackGraphQuery(projectDir, term, budget = 3000) {
    const graph = readGraphFile(projectDir);
    if (!graph)
        return { nodes: [], edges: [] };
    const needle = term.trim().toLowerCase();
    const matches = graph.nodes.filter((node) => {
        const hay = [node.id, node.label, node.description].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(needle);
    });
    const maxNodes = Math.max(1, Math.floor(Math.max(1, budget) / 20));
    const selectedIds = new Set(matches.slice(0, maxNodes).map((node) => node.id));
    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    // Pull one-hop neighbors so relation context survives even when the term
    // matches only one side of an edge.
    for (const edge of graph.edges) {
        if (selectedIds.size >= maxNodes)
            break;
        const touchesSelection = selectedIds.has(edge.from) || selectedIds.has(edge.to);
        if (!touchesSelection)
            continue;
        if (selectedIds.has(edge.from) && !selectedIds.has(edge.to) && nodeById.has(edge.to)) {
            selectedIds.add(edge.to);
        }
        else if (selectedIds.has(edge.to) && !selectedIds.has(edge.from) && nodeById.has(edge.from)) {
            selectedIds.add(edge.from);
        }
    }
    const nodes = graph.nodes.filter((node) => selectedIds.has(node.id));
    const remainingBudget = Math.max(0, budget - nodes.length * 20);
    const maxEdges = Math.floor(remainingBudget / 10);
    const edges = graph.edges
        .filter((edge) => selectedIds.has(edge.from) && selectedIds.has(edge.to))
        .slice(0, maxEdges);
    return { nodes, edges };
}
async function fallbackGraphStatus(projectDir) {
    const graph = readGraphFile(projectDir);
    if (!graph)
        return { exists: false, stale: false };
    if (!graph.builtAt)
        return { exists: true, stale: false };
    const builtAtMs = Date.parse(graph.builtAt);
    if (!Number.isFinite(builtAtMs))
        return { exists: true, stale: false };
    const ageHours = (Date.now() - builtAtMs) / (1000 * 60 * 60);
    return { exists: true, stale: ageHours > 24, ageHours };
}
function isGraphApi(mod) {
    if (!mod || typeof mod !== "object")
        return false;
    const candidate = mod;
    return typeof candidate.graphQuery === "function" && typeof candidate.graphStatus === "function";
}
async function resolveGraphApi() {
    if (resolvedGraphApi && cachedGraphApi)
        return cachedGraphApi;
    resolvedGraphApi = true;
    try {
        const imported = await import("@gsd-build/mcp-server");
        if (isGraphApi(imported)) {
            cachedGraphApi = imported;
            return cachedGraphApi;
        }
        logWarning("prompt", "@gsd-build/mcp-server graph exports unavailable; using local graph fallback");
    }
    catch {
        // Fall back to local reader implementation.
    }
    cachedGraphApi = {
        graphQuery: fallbackGraphQuery,
        graphStatus: fallbackGraphStatus,
    };
    return cachedGraphApi;
}
/**
 * Query the knowledge graph for nodes related to the given term and format
 * the result as an inlined context block.
 *
 * Returns null when:
 * - @gsd-build/mcp-server fails to import
 * - graph.json does not exist (graphQuery already handles this gracefully)
 * - query returns zero nodes
 *
 * Annotates the block header when the graph is stale (> 24 hours old).
 */
export async function inlineGraphSubgraph(projectDir, term, opts) {
    if (!term || !term.trim())
        return null;
    try {
        const graphApi = await resolveGraphApi();
        const result = await graphApi.graphQuery(projectDir, term, opts.budget);
        if (result.nodes.length === 0)
            return null;
        // Check staleness for annotation
        let staleAnnotation = "";
        try {
            const status = await graphApi.graphStatus(projectDir);
            if (status.exists && status.stale && status.ageHours !== undefined) {
                const hours = Math.round(status.ageHours);
                staleAnnotation = `\n> ⚠ Graph last built ${hours}h ago — context may be outdated`;
            }
        }
        catch {
            // Non-fatal — skip annotation on error
        }
        // Format nodes as a compact list
        const nodeLines = result.nodes.map((node) => {
            const desc = node.description ? ` — ${node.description}` : "";
            return `- **${node.label}** (\`${node.type}\`, ${node.confidence})${desc}`;
        });
        // Format edges as relations (only if present)
        const edgeLines = result.edges.length > 0
            ? result.edges.map((edge) => `- \`${edge.from}\` →[${edge.type}]→ \`${edge.to}\``)
            : [];
        const sections = [
            `### Knowledge Graph Context (term: "${term}")`,
            `Source: \`.gsd/graphs/graph.json\``,
            staleAnnotation,
            "",
            `**Nodes (${result.nodes.length}):**`,
            ...nodeLines,
        ];
        if (edgeLines.length > 0) {
            sections.push("", `**Relations (${result.edges.length}):**`, ...edgeLines);
        }
        return sections.filter((l) => l !== undefined).join("\n");
    }
    catch (err) {
        logWarning("prompt", `inlineGraphSubgraph failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`);
        return null;
    }
}
