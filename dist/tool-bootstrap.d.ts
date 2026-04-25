type ManagedTool = "fd" | "rg";
export declare function resolveToolFromPath(tool: ManagedTool, pathValue?: string | undefined): string | null;
export declare function ensureManagedTools(targetDir: string, pathValue?: string | undefined): string[];
export {};
