import { isDbAvailable, upsertTurnGitTransaction } from "../gsd-db.js";
import { buildAuditEnvelope, emitUokAuditEvent } from "./audit.js";
export function writeTurnGitTransaction(args) {
    if (!isDbAvailable())
        return;
    upsertTurnGitTransaction({
        traceId: args.traceId,
        turnId: args.turnId,
        unitType: args.unitType,
        unitId: args.unitId,
        stage: args.stage,
        action: args.action,
        push: args.push,
        status: args.status,
        error: args.error,
        metadata: args.metadata,
        updatedAt: new Date().toISOString(),
    });
    emitUokAuditEvent(args.basePath, buildAuditEnvelope({
        traceId: args.traceId,
        turnId: args.turnId,
        category: "gitops",
        type: `turn-git-${args.stage}`,
        payload: {
            unitType: args.unitType,
            unitId: args.unitId,
            action: args.action,
            push: args.push,
            status: args.status,
            error: args.error,
            ...(args.metadata ?? {}),
        },
    }));
}
export function writeTurnCloseoutGitRecord(basePath, record, metadata) {
    writeTurnGitTransaction({
        basePath,
        traceId: record.traceId,
        turnId: record.turnId,
        unitType: record.unitType,
        unitId: record.unitId,
        stage: "record",
        action: record.gitAction,
        push: record.gitPushed,
        status: record.failureClass === "git" ? "failed" : "ok",
        error: record.failureClass === "git" ? "git closeout failure" : undefined,
        metadata: {
            ...(metadata ?? {}),
            turnStatus: record.status,
            finishedAt: record.finishedAt,
            activityFile: record.activityFile,
        },
    });
}
