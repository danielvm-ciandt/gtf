/**
 * Resolve bundled raw resource files from the package root.
 *
 * Both `src/*.ts` and compiled `dist/*.js` entry points need to load the same
 * raw `.ts` resource modules via jiti. Those modules are shipped under
 * `src/resources/**`, not next to the compiled entry point.
 */
export declare function resolveBundledSourceResource(importUrl: string, ...segments: string[]): string;
