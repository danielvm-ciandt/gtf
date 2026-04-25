import { GSD_COMMAND_DESCRIPTION, getGsdArgumentCompletions } from "./catalog.js";
export function registerGSDCommand(pi) {
    pi.registerCommand("gsd", {
        description: GSD_COMMAND_DESCRIPTION,
        getArgumentCompletions: getGsdArgumentCompletions,
        handler: async (args, ctx) => {
            const { handleGSDCommand } = await import("./dispatcher.js");
            const { setStderrLoggingEnabled } = await import("../workflow-logger.js");
            const previousStderrSetting = setStderrLoggingEnabled(false);
            try {
                await handleGSDCommand(args, ctx, pi);
            }
            finally {
                setStderrLoggingEnabled(previousStderrSetting);
            }
        },
    });
}
