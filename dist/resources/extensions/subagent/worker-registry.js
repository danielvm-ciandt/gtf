/**
 * Worker Registry — Tracks active subagent sessions for dashboard visibility.
 *
 * Provides a global registry of currently-running parallel workers so the
 * GSD dashboard overlay can display real-time worker status.
 */
const activeWorkers = new Map();
let workerIdCounter = 0;
/**
 * Register a new worker. Returns the worker ID for later updates.
 */
export function registerWorker(agent, task, index, batchSize, batchId) {
    const id = `worker-${++workerIdCounter}`;
    activeWorkers.set(id, {
        id,
        agent,
        task,
        startedAt: Date.now(),
        status: "running",
        index,
        batchSize,
        batchId,
    });
    return id;
}
/**
 * Update worker status when it completes or fails.
 */
export function updateWorker(id, status) {
    const entry = activeWorkers.get(id);
    if (entry) {
        entry.status = status;
        // Remove after a brief display window (5 seconds)
        // unref() so the timer doesn't keep the process alive in test environments
        setTimeout(() => {
            activeWorkers.delete(id);
        }, 5000).unref();
    }
}
/**
 * Get all currently-tracked workers (running + recently completed).
 */
export function getActiveWorkers() {
    return Array.from(activeWorkers.values());
}
/**
 * Get workers grouped by batch.
 */
export function getWorkerBatches() {
    const batches = new Map();
    for (const worker of activeWorkers.values()) {
        const batch = batches.get(worker.batchId) ?? [];
        batch.push(worker);
        batches.set(worker.batchId, batch);
    }
    return batches;
}
/**
 * Check if any parallel workers are currently running.
 */
export function hasActiveWorkers() {
    for (const worker of activeWorkers.values()) {
        if (worker.status === "running")
            return true;
    }
    return false;
}
/**
 * Reset registry state. Used for testing.
 */
export function resetWorkerRegistry() {
    activeWorkers.clear();
    workerIdCounter = 0;
}
