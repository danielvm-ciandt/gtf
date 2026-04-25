/**
 * GSD Worktree CLI — standalone subcommand and -w flag handling.
 *
 * Manages the full worktree lifecycle from the command line:
 *   gsd -w                    Create auto-named worktree, start interactive session
 *   gsd -w my-feature         Create/resume named worktree
 *   gsd worktree list         List worktrees with status
 *   gsd worktree merge [name] Squash-merge a worktree into main
 *   gsd worktree clean        Remove all merged/empty worktrees
 *   gsd worktree remove <n>   Remove a specific worktree
 *
 * On session exit (via session_shutdown event), auto-commits dirty work
 * so nothing is lost. The GSD extension reads GSD_CLI_WORKTREE to know
 * when a session was launched via -w.
 *
 * Note: Extension modules are .ts files loaded via jiti (not compiled to .js).
 * We use createJiti() here because this module is compiled by tsc but imports
 * from resources/extensions/gsd/ which are shipped as raw .ts (#1283).
 */
interface ExtensionModules {
    createWorktree: (basePath: string, name: string) => {
        path: string;
        branch: string;
    };
    listWorktrees: (basePath: string) => Array<{
        name: string;
        path: string;
        branch: string;
    }>;
    removeWorktree: (basePath: string, name: string, opts?: {
        deleteBranch?: boolean;
    }) => void;
    mergeWorktreeToMain: (basePath: string, name: string, commitMessage: string) => void;
    diffWorktreeAll: (basePath: string, name: string) => WorktreeDiff;
    diffWorktreeNumstat: (basePath: string, name: string) => Array<{
        added: number;
        removed: number;
    }>;
    worktreeBranchName: (name: string) => string;
    worktreePath: (basePath: string, name: string) => string;
    runWorktreePostCreateHook: (basePath: string, wtPath: string) => string | null;
    nativeHasChanges: (path: string) => boolean;
    nativeDetectMainBranch: (basePath: string) => string;
    nativeCommitCountBetween: (basePath: string, from: string, to: string) => number;
    inferCommitType: (name: string) => string;
    autoCommitCurrentBranch: (wtPath: string, reason: string, name: string) => void;
}
interface WorktreeDiff {
    added: string[];
    modified: string[];
    removed: string[];
}
interface WorktreeStatus {
    name: string;
    path: string;
    branch: string;
    exists: boolean;
    filesChanged: number;
    linesAdded: number;
    linesRemoved: number;
    uncommitted: boolean;
    commits: number;
}
declare function getWorktreeStatus(ext: ExtensionModules, basePath: string, name: string, wtPath: string): WorktreeStatus;
declare function handleList(basePath: string): Promise<void>;
declare function handleMerge(basePath: string, args: string[]): Promise<void>;
declare function handleClean(basePath: string): Promise<void>;
declare function handleRemove(basePath: string, args: string[]): Promise<void>;
declare function handleStatusBanner(basePath: string): Promise<void>;
declare function handleWorktreeFlag(worktreeFlag: boolean | string): Promise<void>;
export { handleList, handleMerge, handleClean, handleRemove, handleStatusBanner, handleWorktreeFlag, getWorktreeStatus, };
