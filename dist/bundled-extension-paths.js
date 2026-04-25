import { delimiter } from "node:path";
export function serializeBundledExtensionPaths(paths, pathDelimiter = delimiter) {
    return paths.filter(Boolean).join(pathDelimiter);
}
export function parseBundledExtensionPaths(value, pathDelimiter = delimiter) {
    return (value ?? "")
        .split(pathDelimiter)
        .map((segment) => segment.trim())
        .filter(Boolean);
}
