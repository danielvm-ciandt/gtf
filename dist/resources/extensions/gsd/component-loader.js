/**
 * Component Loader
 *
 * Multi-format loader that handles:
 * 1. New format: component.yaml + SKILL.md/AGENT.md
 * 2. Legacy skill format: SKILL.md with YAML frontmatter
 * 3. Legacy agent format: .md with YAML frontmatter (name, description, tools, model)
 *
 * Auto-detects format by checking for component.yaml first, then falling back
 * to legacy formats based on file naming conventions.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { parseFrontmatter } from '@gsd/pi-coding-agent';
import { validateComponentName, validateComponentDescription, computeComponentId, } from './component-types.js';
const SUPPORTED_COMPONENT_KINDS = ['skill', 'agent'];
const SUPPORTED_API_VERSIONS = ['gsd/v1'];
// ============================================================================
// Single Component Loading
// ============================================================================
/**
 * Load a component from a directory.
 * Checks for component.yaml first, then legacy formats.
 */
export function loadComponentFromDir(dir, source) {
    const diagnostics = [];
    // Try new format first: component.yaml
    const componentYamlPath = join(dir, 'component.yaml');
    if (existsSync(componentYamlPath)) {
        return loadFromComponentYaml(componentYamlPath, dir, source);
    }
    // Try legacy skill format: SKILL.md
    const skillMdPath = join(dir, 'SKILL.md');
    if (existsSync(skillMdPath)) {
        return loadFromLegacySkill(skillMdPath, dir, source);
    }
    // No recognized component format found
    return { component: null, diagnostics };
}
/**
 * Load a component from a legacy agent .md file (flat file, not directory).
 */
export function loadComponentFromAgentFile(filePath, source) {
    return loadFromLegacyAgent(filePath, source);
}
// ============================================================================
// New Format: component.yaml
// ============================================================================
function loadFromComponentYaml(yamlPath, dir, source) {
    const diagnostics = [];
    let raw;
    try {
        raw = readFileSync(yamlPath, 'utf-8');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to read component.yaml';
        diagnostics.push({ type: 'error', message: msg, path: yamlPath });
        return { component: null, diagnostics };
    }
    let definition;
    try {
        definition = parseYaml(raw);
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to parse component.yaml';
        diagnostics.push({ type: 'error', message: `invalid YAML: ${msg}`, path: yamlPath });
        return { component: null, diagnostics };
    }
    // Validate required fields
    if (!definition?.apiVersion) {
        diagnostics.push({ type: 'error', message: 'missing apiVersion', path: yamlPath });
        return { component: null, diagnostics };
    }
    if (!SUPPORTED_API_VERSIONS.includes(definition.apiVersion)) {
        diagnostics.push({
            type: 'error',
            message: `unsupported apiVersion "${String(definition.apiVersion)}"`,
            path: yamlPath,
        });
        return { component: null, diagnostics };
    }
    if (!definition.kind) {
        diagnostics.push({ type: 'error', message: 'missing kind', path: yamlPath });
        return { component: null, diagnostics };
    }
    if (!SUPPORTED_COMPONENT_KINDS.includes(definition.kind)) {
        diagnostics.push({
            type: 'error',
            message: `unsupported kind "${definition.kind}"`,
            path: yamlPath,
        });
        return { component: null, diagnostics };
    }
    if (!definition.metadata?.name) {
        diagnostics.push({ type: 'error', message: 'missing metadata.name', path: yamlPath });
        return { component: null, diagnostics };
    }
    if (!definition.metadata?.description) {
        diagnostics.push({ type: 'error', message: 'missing metadata.description', path: yamlPath });
        return { component: null, diagnostics };
    }
    const nameErrors = validateComponentName(definition.metadata.name);
    for (const err of nameErrors) {
        diagnostics.push({ type: 'error', message: err, path: yamlPath });
    }
    const descErrors = validateComponentDescription(definition.metadata.description);
    for (const err of descErrors) {
        diagnostics.push({ type: 'error', message: err, path: yamlPath });
    }
    if (nameErrors.length > 0 || descErrors.length > 0) {
        return { component: null, diagnostics };
    }
    // Validate kind-specific spec
    if (!definition.spec) {
        diagnostics.push({ type: 'error', message: 'missing spec', path: yamlPath });
        return { component: null, diagnostics };
    }
    const entryFileDiagnostic = validateEntryFile(definition.kind, definition.spec, dir, yamlPath);
    if (entryFileDiagnostic) {
        diagnostics.push(entryFileDiagnostic);
        return { component: null, diagnostics };
    }
    const id = computeComponentId(definition.metadata.name, definition.metadata.namespace);
    const component = {
        id,
        kind: definition.kind,
        metadata: definition.metadata,
        spec: definition.spec,
        requires: definition.requires,
        compatibility: definition.compatibility,
        routing: definition.routing,
        dirPath: dir,
        filePath: yamlPath,
        source,
        format: 'component-yaml',
        enabled: true,
    };
    return { component, diagnostics };
}
function loadFromLegacySkill(filePath, dir, source) {
    const diagnostics = [];
    let raw;
    try {
        raw = readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to read SKILL.md';
        diagnostics.push({ type: 'warning', message: msg, path: filePath });
        return { component: null, diagnostics };
    }
    const { frontmatter } = parseFrontmatter(raw);
    const parentDirName = basename(dir);
    const name = frontmatter.name || parentDirName;
    // Validate
    const nameErrors = validateComponentName(name);
    for (const err of nameErrors) {
        diagnostics.push({ type: 'warning', message: err, path: filePath });
    }
    const descErrors = validateComponentDescription(frontmatter.description);
    for (const err of descErrors) {
        diagnostics.push({ type: 'warning', message: err, path: filePath });
    }
    if (!frontmatter.description || frontmatter.description.trim() === '') {
        return { component: null, diagnostics };
    }
    const spec = {
        prompt: 'SKILL.md',
        disableModelInvocation: frontmatter['disable-model-invocation'] === true,
    };
    const id = computeComponentId(name);
    const component = {
        id,
        kind: 'skill',
        metadata: {
            name,
            description: frontmatter.description,
        },
        spec,
        dirPath: dir,
        filePath,
        source,
        format: 'skill-md',
        enabled: true,
    };
    return { component, diagnostics };
}
function loadFromLegacyAgent(filePath, source) {
    const diagnostics = [];
    let raw;
    try {
        raw = readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to read agent file';
        diagnostics.push({ type: 'warning', message: msg, path: filePath });
        return { component: null, diagnostics };
    }
    const { frontmatter } = parseFrontmatter(raw);
    if (!frontmatter.name || !frontmatter.description) {
        diagnostics.push({
            type: 'warning',
            message: 'agent file missing name or description in frontmatter',
            path: filePath,
        });
        return { component: null, diagnostics };
    }
    // Parse tools from comma-separated string
    const tools = frontmatter.tools
        ? {
            allow: frontmatter.tools
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean),
        }
        : undefined;
    const spec = {
        systemPrompt: basename(filePath),
        model: frontmatter.model,
        tools,
    };
    const id = computeComponentId(frontmatter.name);
    const dir = dirname(filePath);
    const component = {
        id,
        kind: 'agent',
        metadata: {
            name: frontmatter.name,
            description: frontmatter.description,
        },
        spec,
        dirPath: dir,
        filePath,
        source,
        format: 'agent-md',
        enabled: true,
    };
    return { component, diagnostics };
}
// ============================================================================
// Directory Scanning
// ============================================================================
/**
 * Scan a directory for components (skills format).
 * Handles both new and legacy directory layouts.
 *
 * Expected layouts:
 * - dir/{component-name}/component.yaml  (new format)
 * - dir/{component-name}/SKILL.md        (legacy skill)
 * - dir/{name}.md                        (legacy root-level skill)
 */
export function scanComponentDir(dir, source, kind) {
    const components = [];
    const diagnostics = [];
    if (!existsSync(dir)) {
        return { components, diagnostics };
    }
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' });
    }
    catch {
        return { components, diagnostics };
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
            continue;
        }
        const fullPath = join(dir, entry.name);
        let isDir = entry.isDirectory();
        let isFile = entry.isFile();
        if (entry.isSymbolicLink()) {
            try {
                const stats = statSync(fullPath);
                isDir = stats.isDirectory();
                isFile = stats.isFile();
            }
            catch {
                continue;
            }
        }
        if (isDir) {
            const result = loadComponentFromDir(fullPath, source);
            if (result.component) {
                if (!kind || result.component.kind === kind) {
                    components.push(result.component);
                }
            }
            diagnostics.push(...result.diagnostics);
        }
        else if (isFile && entry.name.endsWith('.md')) {
            // Root-level .md files — could be legacy skills or agents
            // Peek at frontmatter to determine type
            const result = loadFromFile(fullPath, source);
            if (result.component) {
                if (!kind || result.component.kind === kind) {
                    components.push(result.component);
                }
            }
            diagnostics.push(...result.diagnostics);
        }
    }
    return { components, diagnostics };
}
/**
 * Scan a directory specifically for agent .md files (legacy agent format).
 */
export function scanAgentDir(dir, source) {
    const components = [];
    const diagnostics = [];
    if (!existsSync(dir)) {
        return { components, diagnostics };
    }
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true, encoding: 'utf-8' });
    }
    catch {
        return { components, diagnostics };
    }
    for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        let isDir = entry.isDirectory();
        let isFile = entry.isFile();
        if (entry.isSymbolicLink()) {
            try {
                const stats = statSync(fullPath);
                isDir = stats.isDirectory();
                isFile = stats.isFile();
            }
            catch {
                continue;
            }
        }
        if (isDir) {
            const result = loadComponentFromDir(fullPath, source);
            if (result.component?.kind === 'agent') {
                components.push(result.component);
            }
            diagnostics.push(...result.diagnostics);
            continue;
        }
        if (!entry.name.endsWith('.md'))
            continue;
        if (!isFile)
            continue;
        // Check if there's a component.yaml in a same-named directory
        const nameWithoutExt = entry.name.replace(/\.md$/, '');
        const componentDir = join(dir, nameWithoutExt);
        if (existsSync(join(componentDir, 'component.yaml'))) {
            // New format takes precedence and is loaded by the directory branch.
            continue;
        }
        const result = loadComponentFromAgentFile(fullPath, source);
        if (result.component) {
            components.push(result.component);
        }
        diagnostics.push(...result.diagnostics);
    }
    return { components, diagnostics };
}
// ============================================================================
// Helpers
// ============================================================================
/**
 * Load a single file, detecting whether it's a skill or agent by frontmatter.
 */
function loadFromFile(filePath, source) {
    const diagnostics = [];
    let raw;
    try {
        raw = readFileSync(filePath, 'utf-8');
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to read file';
        diagnostics.push({ type: 'warning', message: msg, path: filePath });
        return { component: null, diagnostics };
    }
    const { frontmatter } = parseFrontmatter(raw);
    // If it has 'tools' field, treat as agent
    if (frontmatter.tools !== undefined) {
        return loadFromLegacyAgent(filePath, source);
    }
    // Otherwise treat as a legacy skill (root-level .md)
    const dir = dirname(filePath);
    const name = frontmatter.name || basename(filePath, '.md');
    const description = frontmatter.description;
    if (!description || description.trim() === '') {
        return { component: null, diagnostics };
    }
    const spec = {
        prompt: basename(filePath),
        disableModelInvocation: frontmatter['disable-model-invocation'] === true,
    };
    const id = computeComponentId(name);
    const component = {
        id,
        kind: 'skill',
        metadata: { name, description },
        spec,
        dirPath: dir,
        filePath,
        source,
        format: 'skill-md',
        enabled: true,
    };
    return { component, diagnostics };
}
function validateEntryFile(kind, spec, dir, yamlPath) {
    const relativePath = kind === 'skill'
        ? spec.prompt
        : spec.systemPrompt;
    const field = kind === 'skill' ? 'spec.prompt' : 'spec.systemPrompt';
    if (!relativePath || typeof relativePath !== 'string') {
        return {
            type: 'error',
            message: `missing ${field}`,
            path: yamlPath,
        };
    }
    const entryPath = join(dir, relativePath);
    if (!existsSync(entryPath)) {
        return {
            type: 'error',
            message: `missing referenced file for ${field}: ${relativePath}`,
            path: entryPath,
        };
    }
    try {
        if (!statSync(entryPath).isFile()) {
            return {
                type: 'error',
                message: `referenced ${field} is not a file: ${relativePath}`,
                path: entryPath,
            };
        }
    }
    catch (error) {
        const msg = error instanceof Error ? error.message : 'failed to inspect referenced file';
        return {
            type: 'error',
            message: `${msg}: ${relativePath}`,
            path: entryPath,
        };
    }
    return null;
}
