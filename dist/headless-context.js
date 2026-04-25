/**
 * Headless Context Loading — stdin reading, file context, and project bootstrapping
 *
 * Handles loading context from files or stdin for headless new-milestone,
 * and bootstraps the .gsd/ directory structure when needed.
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
// ---------------------------------------------------------------------------
// Stdin Reader
// ---------------------------------------------------------------------------
export async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
}
// ---------------------------------------------------------------------------
// Context Loading
// ---------------------------------------------------------------------------
export async function loadContext(options) {
    if (options.contextText)
        return options.contextText;
    if (options.context === '-') {
        return readStdin();
    }
    if (options.context) {
        return readFileSync(resolve(options.context), 'utf-8');
    }
    throw new Error('No context provided. Use --context <file> or --context-text <text>');
}
// ---------------------------------------------------------------------------
// Project Bootstrap
// ---------------------------------------------------------------------------
/**
 * Bootstrap .gsd/ directory structure for headless new-milestone.
 * Mirrors the bootstrap logic from guided-flow.ts showSmartEntry().
 */
export function bootstrapGsdProject(basePath) {
    const gsdDir = join(basePath, '.gsd');
    mkdirSync(join(gsdDir, 'milestones'), { recursive: true });
    mkdirSync(join(gsdDir, 'runtime'), { recursive: true });
}
