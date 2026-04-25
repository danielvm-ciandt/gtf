export function buildDispatchEnvelope(input) {
    return {
        action: input.action,
        nodeKind: input.node?.kind,
        unitType: input.unitType,
        unitId: input.unitId,
        prompt: input.prompt,
        reason: {
            reasonCode: input.reasonCode,
            summary: input.summary,
            evidence: input.evidence,
            blockedBy: input.blockedBy,
        },
        gateVerdict: input.gateVerdict,
        constraints: input.node
            ? {
                reads: input.node.reads,
                writes: input.node.writes,
                dependsOn: input.node.dependsOn,
            }
            : undefined,
        trace: input.trace,
    };
}
export function explainDispatch(envelope) {
    const subject = envelope.unitType && envelope.unitId
        ? `${envelope.unitType} ${envelope.unitId}`
        : envelope.nodeKind ?? envelope.action;
    const blocked = envelope.reason.blockedBy && envelope.reason.blockedBy.length > 0
        ? ` Blocked by: ${envelope.reason.blockedBy.map((b) => `${b.kind}:${b.id}`).join(", ")}.`
        : "";
    return `[${envelope.reason.reasonCode}] ${subject}: ${envelope.reason.summary}.${blocked}`;
}
