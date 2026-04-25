/**
 * Headless Query — `gsd headless query`
 *
 * Single read-only command that returns the full project snapshot as JSON
 * to stdout, without spawning an LLM session. Instant (~50ms).
 *
 * Output: { state, next, cost }
 *   state — deriveState() output (phase, milestones, progress, blockers)
 *   next  — dry-run dispatch preview (what auto-mode would do next)
 *   cost  — aggregated parallel worker costs
 *
 * Note: Extension modules are .ts files loaded via jiti (not compiled to .js).
 * We use createJiti() here because this module is imported directly from cli.ts,
 * bypassing the extension loader's jiti setup (#1137).
 */
import type { GSDState } from './resources/extensions/gsd/types.js';
export interface QuerySnapshot {
    state: GSDState;
    next: {
        action: 'dispatch' | 'stop' | 'skip';
        unitType?: string;
        unitId?: string;
        reason?: string;
    };
    cost: {
        workers: Array<{
            milestoneId: string;
            pid: number;
            state: string;
            cost: number;
            lastHeartbeat: number;
        }>;
        total: number;
    };
}
export interface QueryResult {
    exitCode: number;
    data?: QuerySnapshot;
}
export declare function handleQuery(basePath: string): Promise<QueryResult>;
