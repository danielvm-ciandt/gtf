import { importExtensionModule } from "@gsd/pi-coding-agent";
const WORKTREE_SUBCOMMANDS = [
    { cmd: "list", desc: "List existing worktrees" },
    { cmd: "merge", desc: "Merge a worktree into a target branch" },
    { cmd: "remove", desc: "Remove a worktree and its branch" },
    { cmd: "switch", desc: "Switch into an existing worktree" },
    { cmd: "create", desc: "Create and switch into a new worktree" },
    { cmd: "return", desc: "Switch back to the main tree" },
];
function getWorktreeCompletions(prefix) {
    const parts = prefix.trim().split(/\s+/);
    if (parts.length <= 1) {
        const partial = parts[0] ?? "";
        return WORKTREE_SUBCOMMANDS
            .filter((option) => option.cmd.startsWith(partial))
            .map((option) => ({
            value: option.cmd,
            label: option.cmd,
            description: option.desc,
        }));
    }
    if (parts[0] === "remove" && parts.length <= 2 && "all".startsWith(parts[1] ?? "")) {
        return [{ value: "remove all", label: "all", description: "Remove all worktrees" }];
    }
    return null;
}
function registerLazyWorktreeAlias(pi, name, description) {
    pi.registerCommand(name, {
        description,
        getArgumentCompletions: getWorktreeCompletions,
        handler: async (args, ctx) => {
            const { handleWorktreeCommand } = await importExtensionModule(import.meta.url, "./worktree-command.js");
            await handleWorktreeCommand(args, ctx, pi, name);
        },
    });
}
export function registerLazyWorktreeCommands(pi) {
    registerLazyWorktreeAlias(pi, "worktree", "Git worktrees (also /wt): /worktree <name> | list | merge | remove");
    registerLazyWorktreeAlias(pi, "wt", "Alias for /worktree");
}
