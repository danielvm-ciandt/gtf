export function selectConflictFreeBatch({ orderedIds, maxParallel, hasConflict, }) {
    if (maxParallel <= 0 || orderedIds.length === 0)
        return [];
    const selected = [];
    for (const candidate of orderedIds) {
        if (selected.length >= maxParallel)
            break;
        const conflictsExisting = selected.some((existing) => hasConflict(candidate, existing));
        if (conflictsExisting)
            continue;
        selected.push(candidate);
    }
    return selected;
}
function buildReactiveNodes(graph) {
    return graph.map((node) => ({
        id: node.id,
        kind: "unit",
        dependsOn: [...node.dependsOn],
        writes: [...node.outputFiles],
    }));
}
export function selectReactiveDispatchBatch(input) {
    const nodeMap = new Map(buildReactiveNodes(input.graph).map((n) => [n.id, n]));
    const readyNodes = input.readyIds
        .map((id) => nodeMap.get(id))
        .filter((node) => !!node);
    const conflicts = detectFileConflicts(readyNodes);
    if (readyNodes.length === 0 || input.maxParallel <= 0) {
        return { selected: [], conflicts };
    }
    const claimed = new Set(input.inFlightOutputs ?? []);
    const selected = [];
    const selectedSet = new Set();
    const readySet = new Set(input.readyIds);
    for (const id of input.readyIds) {
        if (selected.length >= input.maxParallel)
            break;
        const node = nodeMap.get(id);
        if (!node)
            continue;
        const hasUnmetReadyDependency = node.dependsOn.some((dep) => readySet.has(dep) && !selectedSet.has(dep));
        if (hasUnmetReadyDependency)
            continue;
        const writes = node.writes ?? [];
        const conflictsWithClaimed = writes.some((file) => claimed.has(file));
        if (conflictsWithClaimed)
            continue;
        selected.push(node.id);
        selectedSet.add(node.id);
        for (const file of writes)
            claimed.add(file);
    }
    return { selected, conflicts };
}
function sidecarToNodeKind(kind) {
    if (kind === "hook")
        return "hook";
    if (kind === "triage")
        return "verification";
    return "team-worker";
}
export function buildSidecarQueueNodes(queue) {
    return queue.map((item, index) => ({
        id: `sidecar-${String(index).padStart(4, "0")}:${item.kind}:${item.unitType}:${item.unitId}`,
        kind: sidecarToNodeKind(item.kind),
        dependsOn: index > 0 ? [`sidecar-${String(index - 1).padStart(4, "0")}:${queue[index - 1].kind}:${queue[index - 1].unitType}:${queue[index - 1].unitId}`] : [],
        metadata: { index },
    }));
}
export function buildExecutionGraphSnapshot(nodes, phase) {
    const sorted = topologicalSort(nodes);
    return {
        capturedAt: new Date().toISOString(),
        phase,
        nodes: sorted,
        order: sorted.map((node) => node.id),
        conflicts: detectFileConflicts(nodes),
    };
}
export async function scheduleSidecarQueue(queue) {
    if (queue.length <= 1)
        return [...queue];
    const nodes = buildSidecarQueueNodes(queue);
    const scheduler = new ExecutionGraphScheduler();
    const orderedIndexes = [];
    const seenKinds = new Set(nodes.map((n) => n.kind));
    for (const kind of seenKinds) {
        scheduler.registerHandler(kind, async (node) => {
            const idx = Number(node.metadata?.index);
            if (Number.isInteger(idx) && idx >= 0)
                orderedIndexes.push(idx);
        });
    }
    await scheduler.run(nodes, { parallel: false });
    return orderedIndexes.map((idx) => queue[idx]).filter((item) => !!item);
}
export class ExecutionGraphScheduler {
    handlers = new Map();
    registerHandler(kind, handler) {
        this.handlers.set(kind, handler);
    }
    async run(nodes, options) {
        const sorted = topologicalSort(nodes);
        const conflicts = detectFileConflicts(nodes);
        // Default deterministic serial execution remains the reference path.
        if (!options?.parallel) {
            for (const node of sorted) {
                const handler = this.handlers.get(node.kind);
                if (handler)
                    await handler(node);
            }
            return { order: sorted.map((n) => n.id), conflicts };
        }
        // Parallel mode only for nodes whose dependencies are already satisfied.
        const maxWorkers = Math.max(1, Math.min(8, options.maxWorkers ?? 2));
        const remaining = new Map(nodes.map((n) => [n.id, n]));
        const done = new Set();
        const order = [];
        while (remaining.size > 0) {
            const ready = Array.from(remaining.values()).filter((node) => node.dependsOn.every((dep) => done.has(dep)));
            ready.sort((a, b) => a.id.localeCompare(b.id));
            if (ready.length === 0) {
                throw new Error("Execution graph deadlock detected: no ready nodes and graph not complete");
            }
            const batch = ready.slice(0, maxWorkers);
            await Promise.all(batch.map(async (node) => {
                const handler = this.handlers.get(node.kind);
                if (handler)
                    await handler(node);
                done.add(node.id);
                order.push(node.id);
                remaining.delete(node.id);
            }));
        }
        return { order, conflicts };
    }
}
function topologicalSort(nodes) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const inDegree = new Map(nodes.map((n) => [n.id, 0]));
    for (const node of nodes) {
        for (const dep of node.dependsOn) {
            if (nodeMap.has(dep)) {
                inDegree.set(node.id, (inDegree.get(node.id) ?? 0) + 1);
            }
        }
    }
    const queue = nodes
        .filter((n) => (inDegree.get(n.id) ?? 0) === 0)
        .sort((a, b) => a.id.localeCompare(b.id));
    const ordered = [];
    while (queue.length > 0) {
        const current = queue.shift();
        ordered.push(current);
        for (const next of nodes) {
            if (!next.dependsOn.includes(current.id))
                continue;
            const deg = (inDegree.get(next.id) ?? 0) - 1;
            inDegree.set(next.id, deg);
            if (deg === 0) {
                queue.push(next);
                queue.sort((a, b) => a.id.localeCompare(b.id));
            }
        }
    }
    if (ordered.length !== nodes.length) {
        throw new Error("Execution graph has cyclic dependencies");
    }
    return ordered;
}
function detectFileConflicts(nodes) {
    const conflicts = [];
    for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const writesA = new Set(a.writes ?? []);
        if (writesA.size === 0)
            continue;
        for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            for (const file of b.writes ?? []) {
                if (writesA.has(file)) {
                    conflicts.push({ nodeA: a.id, nodeB: b.id, file });
                }
            }
        }
    }
    return conflicts;
}
