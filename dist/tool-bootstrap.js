import { chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, rmSync, statSync, symlinkSync, unlinkSync } from "node:fs";
import { delimiter, join } from "node:path";
const TOOL_SPECS = {
    fd: {
        targetName: process.platform === "win32" ? "fd.exe" : "fd",
        candidates: process.platform === "win32" ? ["fd.exe", "fd", "fdfind.exe", "fdfind"] : ["fd", "fdfind"],
    },
    rg: {
        targetName: process.platform === "win32" ? "rg.exe" : "rg",
        candidates: process.platform === "win32" ? ["rg.exe", "rg"] : ["rg"],
    },
};
function splitPath(pathValue) {
    if (!pathValue)
        return [];
    return pathValue.split(delimiter).map((segment) => segment.trim()).filter(Boolean);
}
function getCandidateNames(name) {
    if (process.platform !== "win32")
        return [name];
    const lower = name.toLowerCase();
    if (lower.endsWith(".exe") || lower.endsWith(".cmd") || lower.endsWith(".bat"))
        return [name];
    return [name, `${name}.exe`, `${name}.cmd`, `${name}.bat`];
}
function isRegularFile(path) {
    try {
        const stat = lstatSync(path);
        return stat.isFile() || stat.isSymbolicLink();
    }
    catch {
        return false;
    }
}
function pathExistsIncludingBrokenSymlink(path) {
    try {
        lstatSync(path);
        return true;
    }
    catch {
        return false;
    }
}
function isBrokenSymlink(path) {
    try {
        const stat = lstatSync(path);
        if (!stat.isSymbolicLink())
            return false;
        try {
            statSync(path);
            return false;
        }
        catch {
            return true;
        }
    }
    catch {
        return false;
    }
}
function removeTargetPath(path) {
    try {
        const stat = lstatSync(path);
        if (stat.isSymbolicLink()) {
            unlinkSync(path);
            return;
        }
        rmSync(path, { force: true });
    }
    catch {
        // Path already absent.
    }
}
export function resolveToolFromPath(tool, pathValue = process.env.PATH) {
    const spec = TOOL_SPECS[tool];
    for (const dir of splitPath(pathValue)) {
        for (const candidate of spec.candidates) {
            for (const name of getCandidateNames(candidate)) {
                const fullPath = join(dir, name);
                if (existsSync(fullPath) && isRegularFile(fullPath)) {
                    return fullPath;
                }
            }
        }
    }
    return null;
}
function provisionTool(targetDir, tool, sourcePath) {
    const targetPath = join(targetDir, TOOL_SPECS[tool].targetName);
    const brokenTarget = isBrokenSymlink(targetPath);
    if (pathExistsIncludingBrokenSymlink(targetPath)) {
        if (!brokenTarget)
            return targetPath;
        removeTargetPath(targetPath);
    }
    mkdirSync(targetDir, { recursive: true });
    if (!brokenTarget) {
        try {
            symlinkSync(sourcePath, targetPath);
            return targetPath;
        }
        catch {
            // Fall back to copying below.
        }
    }
    removeTargetPath(targetPath);
    copyFileSync(sourcePath, targetPath);
    chmodSync(targetPath, 0o755);
    return targetPath;
}
export function ensureManagedTools(targetDir, pathValue = process.env.PATH) {
    const provisioned = [];
    for (const tool of Object.keys(TOOL_SPECS)) {
        const targetPath = join(targetDir, TOOL_SPECS[tool].targetName);
        if (pathExistsIncludingBrokenSymlink(targetPath) && !isBrokenSymlink(targetPath))
            continue;
        const sourcePath = resolveToolFromPath(tool, pathValue);
        if (!sourcePath)
            continue;
        provisioned.push(provisionTool(targetDir, tool, sourcePath));
    }
    return provisioned;
}
