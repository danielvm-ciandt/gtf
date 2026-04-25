import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gsdRoot } from "../paths.js";
function parityLogPath(basePath) {
    return join(gsdRoot(basePath), "runtime", "uok-parity.jsonl");
}
function reportPath(basePath) {
    return join(gsdRoot(basePath), "runtime", "uok-parity-report.json");
}
function increment(bucket, key) {
    const normalized = key && key.trim().length > 0 ? key : "unknown";
    bucket[normalized] = (bucket[normalized] ?? 0) + 1;
}
export function parseParityEvents(raw) {
    return raw
        .split("\n")
        .filter(Boolean)
        .map((line) => {
        try {
            return JSON.parse(line);
        }
        catch {
            return { status: "error", error: "invalid parity json line" };
        }
    });
}
export function buildParityReport(events, sourcePath) {
    const paths = {};
    const statuses = {};
    const criticalMismatches = [];
    let fallbackInvocations = 0;
    for (const event of events) {
        increment(paths, event.path);
        increment(statuses, event.status);
        if (event.path === "legacy-fallback")
            fallbackInvocations += 1;
        if (event.status === "error") {
            criticalMismatches.push(event.error ?? "parity event reported error");
        }
    }
    return {
        generatedAt: new Date().toISOString(),
        sourcePath,
        totalEvents: events.length,
        paths,
        statuses,
        criticalMismatches,
        fallbackInvocations,
    };
}
export function writeParityReport(basePath) {
    const sourcePath = parityLogPath(basePath);
    const raw = existsSync(sourcePath) ? readFileSync(sourcePath, "utf-8") : "";
    const report = buildParityReport(parseParityEvents(raw), sourcePath);
    mkdirSync(join(gsdRoot(basePath), "runtime"), { recursive: true });
    writeFileSync(reportPath(basePath), JSON.stringify(report, null, 2) + "\n", "utf-8");
    return report;
}
