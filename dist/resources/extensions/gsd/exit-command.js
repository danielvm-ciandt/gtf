import { importExtensionModule } from "@gsd/pi-coding-agent";
export function registerExitCommand(pi, deps = {}) {
    pi.registerCommand("exit", {
        description: "Exit GSD gracefully",
        handler: async (_args, ctx) => {
            // Stop auto-mode first so locks and activity state are cleaned up before shutdown.
            // Wrapped in try/catch: if gsd-pi was updated on disk mid-session, the dynamic
            // import may resolve a new auto-worktree.js whose static imports reference
            // exports absent from the process-cached native-git-bridge.js (ESM cache is
            // immutable). The user's work is already saved — this is cleanup only.
            try {
                const stopAuto = deps.stopAuto ?? (await importExtensionModule(import.meta.url, "./auto.js")).stopAuto;
                await stopAuto(ctx, pi, "Graceful exit");
            }
            catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                ctx.ui?.notify?.(`Auto-mode cleanup skipped (module version mismatch): ${msg}`, "warning");
            }
            ctx.shutdown();
        },
    });
}
