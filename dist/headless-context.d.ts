/**
 * Headless Context Loading — stdin reading, file context, and project bootstrapping
 *
 * Handles loading context from files or stdin for headless new-milestone,
 * and bootstraps the .gsd/ directory structure when needed.
 */
interface ContextOptions {
    context?: string;
    contextText?: string;
}
export declare function readStdin(): Promise<string>;
export declare function loadContext(options: ContextOptions): Promise<string>;
/**
 * Bootstrap .gsd/ directory structure for headless new-milestone.
 * Mirrors the bootstrap logic from guided-flow.ts showSmartEntry().
 */
export declare function bootstrapGsdProject(basePath: string): void;
export {};
