// GSD Exec Search Tool — lists and filters prior gsd_exec runs.
//
// Scans .gsd/exec/*.meta.json and returns a ranked summary so agents can
// re-discover past runs without re-executing. Read-only; no DB writes.
import { searchExecHistory } from "../exec-history.js";
export function executeExecSearch(params, opts) {
    const searchOpts = {
        query: typeof params.query === "string" ? params.query : undefined,
        runtime: params.runtime,
        failing_only: params.failing_only === true,
        limit: typeof params.limit === "number" ? params.limit : undefined,
    };
    const hits = searchExecHistory(opts.baseDir, searchOpts);
    if (hits.length === 0) {
        return {
            content: [{ type: "text", text: "No prior gsd_exec runs match those filters." }],
            details: { operation: "gsd_exec_search", matches: 0 },
        };
    }
    const lines = [`Found ${hits.length} exec run(s), most recent first:`];
    for (const hit of hits) {
        const e = hit.entry;
        const status = formatStatus(e);
        const purpose = e.purpose ? ` — ${e.purpose}` : "";
        const truncated = e.stdout_truncated ? " (stdout truncated)" : "";
        lines.push(`- [${e.id}] ${e.runtime} ${status} ${e.duration_ms}ms${truncated}${purpose}`, `    stdout: ${e.stdout_path}`);
        if (hit.digest_preview) {
            const preview = hit.digest_preview.replace(/\n/g, "\n      ");
            lines.push(`    preview:\n      ${preview}`);
        }
    }
    return {
        content: [{ type: "text", text: lines.join("\n") }],
        details: {
            operation: "gsd_exec_search",
            matches: hits.length,
            results: hits.map((hit) => ({
                id: hit.entry.id,
                runtime: hit.entry.runtime,
                exit_code: hit.entry.exit_code,
                timed_out: hit.entry.timed_out,
                duration_ms: hit.entry.duration_ms,
                purpose: hit.entry.purpose,
                stdout_path: hit.entry.stdout_path,
                stderr_path: hit.entry.stderr_path,
                meta_path: hit.entry.meta_path,
            })),
        },
    };
}
function formatStatus(entry) {
    if (entry.timed_out)
        return "timeout";
    if (entry.signal)
        return `signal:${entry.signal}`;
    if (entry.exit_code === null)
        return "exit:null";
    return `exit:${entry.exit_code}`;
}
