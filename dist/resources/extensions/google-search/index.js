export default function (pi) {
    pi.on("session_start", async (_event, ctx) => {
        ctx.ui.notify("google_search is being extracted to @gsd-extensions/google-search " +
            "(not yet published to npm). This stub will be replaced once the " +
            "package is available. No action needed for now.", "warning");
    });
}
