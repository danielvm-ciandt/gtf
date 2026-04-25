export interface SortWarning {
    declaringId: string;
    missingId: string;
    message: string;
}
export interface SortResult {
    sortedPaths: string[];
    warnings: SortWarning[];
}
/**
 * Sort extension entry paths in topological dependency-first order using Kahn's BFS algorithm.
 *
 * - Extensions without manifests are prepended in input order.
 * - Missing dependencies produce a structured warning but do not block loading.
 * - Cycles produce warnings; cycle participants are appended alphabetically.
 * - Self-dependencies are silently ignored.
 */
export declare function sortExtensionPaths(paths: string[]): SortResult;
