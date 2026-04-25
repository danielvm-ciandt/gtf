/**
 * Unit closeout helper — consolidates the repeated pattern of
 * snapshotting metrics + saving activity log + extracting memories
 * that appears 6+ times in auto.ts.
 */
import { snapshotUnitMetrics } from "./metrics.js";
import { saveActivityLog } from "./activity-log.js";
import { logWarning } from "./workflow-logger.js";
import { writeTurnGitTransaction } from "./uok/gitops.js";
/**
 * Snapshot metrics, save activity log, and fire-and-forget memory extraction
 * for a completed unit. Returns the activity log file path (if any).
 */
export async function closeoutUnit(ctx, basePath, unitType, unitId, startedAt, opts) {
    const modelId = ctx.model?.id ?? "unknown";
    snapshotUnitMetrics(ctx, unitType, unitId, startedAt, modelId, opts);
    const activityFile = saveActivityLog(ctx, basePath, unitType, unitId);
    if (activityFile) {
        try {
            const { buildMemoryLLMCall, extractMemoriesFromUnit } = await import('./memory-extractor.js');
            const llmCallFn = buildMemoryLLMCall(ctx);
            if (llmCallFn) {
                // Awaited: a fire-and-forget here lets memory-extractor writes land in
                // .gsd/ after closeoutUnit returns but before the milestone merge
                // runs, which made the working tree appear dirty to `git merge
                // --squash` (root cause class of #4704). Completion latency is now
                // bounded by the extractor's LLM call, which is the acceptable price
                // for not racing the merge boundary.
                try {
                    await extractMemoriesFromUnit(activityFile, unitType, unitId, llmCallFn);
                }
                catch (err) {
                    logWarning("engine", `memory extraction failed for ${unitType}/${unitId}: ${err.message}`);
                }
            }
        }
        catch (err) { /* non-fatal */
            logWarning("engine", `operation failed: ${err instanceof Error ? err.message : String(err)}`);
        }
    }
    if (opts?.traceId && opts.turnId && opts.gitAction && opts.gitStatus) {
        writeTurnGitTransaction({
            basePath,
            traceId: opts.traceId,
            turnId: opts.turnId,
            unitType,
            unitId,
            stage: "record",
            action: opts.gitAction,
            push: opts.gitPush === true,
            status: opts.gitStatus,
            error: opts.gitError,
            metadata: {
                activityFile,
            },
        });
    }
    return activityFile ?? undefined;
}
