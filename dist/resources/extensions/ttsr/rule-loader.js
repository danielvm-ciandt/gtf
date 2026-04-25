/**
 * TTSR Rule Loader
 *
 * Scans global (~/.gsd/agent/rules/*.md) and project-local (.gsd/rules/*.md)
 * rule files. Parses YAML frontmatter for condition, scope, globs.
 * Project rules override global rules with the same name.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir } from "node:os";
const gsdHome = process.env.GSD_HOME || join(homedir(), ".gsd");
import { splitFrontmatter, parseFrontmatterMap } from "../shared/frontmatter.js";
function parseRuleFile(filePath) {
    let content;
    try {
        content = readFileSync(filePath, "utf-8");
    }
    catch {
        return null;
    }
    const [fmLines, body] = splitFrontmatter(content);
    if (!fmLines)
        return null;
    const meta = parseFrontmatterMap(fmLines);
    const condition = meta.condition;
    if (!Array.isArray(condition) || condition.length === 0)
        return null;
    const name = basename(filePath, ".md");
    return {
        name,
        path: filePath,
        content: body.trim(),
        condition: condition,
        scope: Array.isArray(meta.scope) ? meta.scope : undefined,
        globs: Array.isArray(meta.globs) ? meta.globs : undefined,
    };
}
function scanDir(dir) {
    if (!existsSync(dir))
        return [];
    const rules = [];
    try {
        const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
        for (const file of files) {
            const rule = parseRuleFile(join(dir, file));
            if (rule)
                rules.push(rule);
        }
    }
    catch {
        // Directory unreadable — skip
    }
    return rules;
}
/**
 * Load all TTSR rules from global and project-local directories.
 * Project rules override global rules with the same name.
 */
export function loadRules(cwd) {
    const globalDir = join(gsdHome, "agent", "rules");
    const projectDir = join(cwd, ".gsd", "rules");
    const globalRules = scanDir(globalDir);
    const projectRules = scanDir(projectDir);
    // Merge: project rules override global by name
    const byName = new Map();
    for (const rule of globalRules)
        byName.set(rule.name, rule);
    for (const rule of projectRules)
        byName.set(rule.name, rule);
    return Array.from(byName.values());
}
