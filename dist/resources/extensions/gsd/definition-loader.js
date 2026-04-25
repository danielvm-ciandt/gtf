/**
 * definition-loader.ts — Parse and validate V1 YAML workflow definitions.
 *
 * Loads definition YAML files from `.gsd/workflow-defs/`, validates the
 * V1 schema shape, and returns typed TypeScript objects. Pure functions
 * with no engine or runtime dependencies — just `yaml` and `node:fs`.
 *
 * YAML uses snake_case (`depends_on`, `context_from`) per project convention (P005).
 * TypeScript uses camelCase (`dependsOn`, `contextFrom`).
 *
 * Observability: All validation errors are collected into a string[] — callers
 * can log, surface in dashboards, or return to agents for self-repair.
 * substituteParams errors include the offending key name for traceability.
 */
import { parse } from "yaml";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
// ─── Validation ──────────────────────────────────────────────────────────
/**
 * Validate a parsed (but untyped) YAML object against the V1 workflow schema.
 *
 * Collects all errors (does not short-circuit) so a single call reveals
 * every problem with the definition.
 *
 * Unknown fields are silently accepted for forward compatibility with
 * S05/S06 features (`context_from`, `verify`, `iterate`).
 */
export function validateDefinition(parsed) {
    const errors = [];
    if (parsed == null || typeof parsed !== "object") {
        return { valid: false, errors: ["Definition must be a non-null object"] };
    }
    const def = parsed;
    // version: must be 1 (number)
    if (def.version === undefined || def.version === null) {
        errors.push("Missing required field: version");
    }
    else if (def.version !== 1) {
        errors.push(`Unsupported version: ${def.version} (expected 1)`);
    }
    // name: must be a non-empty string
    if (typeof def.name !== "string" || def.name.trim() === "") {
        errors.push("Missing or empty required field: name");
    }
    // steps: must be a non-empty array
    if (!Array.isArray(def.steps)) {
        errors.push("Missing required field: steps (must be an array)");
    }
    else if (def.steps.length === 0) {
        errors.push("steps must contain at least one step");
    }
    else {
        // Track whether all steps have valid IDs — graph-level checks only run when true
        let allStepIdsValid = true;
        for (let i = 0; i < def.steps.length; i++) {
            const step = def.steps[i];
            if (step == null || typeof step !== "object") {
                errors.push(`Step at index ${i} is not an object`);
                allStepIdsValid = false;
                continue;
            }
            // Required step fields
            if (typeof step.id !== "string" || step.id.trim() === "") {
                errors.push(`Step at index ${i} missing required field: id`);
                allStepIdsValid = false;
            }
            if (typeof step.name !== "string" || step.name.trim() === "") {
                errors.push(`Step at index ${i} missing required field: name`);
            }
            if (typeof step.prompt !== "string" || step.prompt.trim() === "") {
                errors.push(`Step at index ${i} missing required field: prompt`);
            }
            // produces: path traversal guard
            if (Array.isArray(step.produces)) {
                for (const p of step.produces) {
                    if (typeof p === "string" && p.includes("..")) {
                        errors.push(`Step "${step.id}" produces path contains disallowed '..': ${p}`);
                    }
                }
            }
            // iterate: optional, but if present must conform to IterateConfig shape
            if (step.iterate !== undefined) {
                const it = step.iterate;
                const sid = typeof step.id === "string" ? step.id : `index ${i}`;
                if (it == null || typeof it !== "object" || Array.isArray(it)) {
                    errors.push(`Step "${sid}" iterate must be an object with "source" and "pattern" fields`);
                }
                else {
                    const itObj = it;
                    if (typeof itObj.source !== "string" || itObj.source.trim() === "") {
                        errors.push(`Step "${sid}" iterate.source must be a non-empty string`);
                    }
                    else if (itObj.source.includes("..")) {
                        errors.push(`Step "${sid}" iterate.source contains disallowed '..' path traversal`);
                    }
                    if (typeof itObj.pattern !== "string" || itObj.pattern.trim() === "") {
                        errors.push(`Step "${sid}" iterate.pattern must be a non-empty string`);
                    }
                    else {
                        const pat = itObj.pattern;
                        let regexValid = true;
                        try {
                            new RegExp(pat);
                        }
                        catch {
                            regexValid = false;
                            errors.push(`Step "${sid}" iterate.pattern is not a valid regex: ${pat}`);
                        }
                        if (regexValid && !/\((?!\?)/.test(pat)) {
                            errors.push(`Step "${sid}" iterate.pattern must contain at least one capture group`);
                        }
                    }
                }
            }
            // verify: optional, but if present must conform to VerifyPolicy shape
            if (step.verify !== undefined) {
                const v = step.verify;
                const sid = typeof step.id === "string" ? step.id : `index ${i}`;
                if (v == null || typeof v !== "object" || Array.isArray(v)) {
                    errors.push(`Step "${sid}" verify must be an object with a "policy" field`);
                }
                else {
                    const vObj = v;
                    const VALID_POLICIES = ["content-heuristic", "shell-command", "prompt-verify", "human-review"];
                    if (typeof vObj.policy !== "string" || !VALID_POLICIES.includes(vObj.policy)) {
                        errors.push(`Step "${sid}" verify.policy must be one of: ${VALID_POLICIES.join(", ")}`);
                    }
                    else {
                        // Policy-specific required field checks
                        if (vObj.policy === "shell-command") {
                            if (typeof vObj.command !== "string" || vObj.command.trim() === "") {
                                errors.push(`Step "${sid}" verify policy "shell-command" requires a non-empty "command" field`);
                            }
                        }
                        if (vObj.policy === "prompt-verify") {
                            if (typeof vObj.prompt !== "string" || vObj.prompt.trim() === "") {
                                errors.push(`Step "${sid}" verify policy "prompt-verify" requires a non-empty "prompt" field`);
                            }
                        }
                    }
                }
            }
        }
        // ─── Graph-level validations (only when all step IDs are valid) ────
        if (allStepIdsValid) {
            const steps = def.steps;
            // 1. Duplicate step ID check
            const idCounts = new Map();
            for (const step of steps) {
                const id = step.id;
                idCounts.set(id, (idCounts.get(id) ?? 0) + 1);
            }
            for (const [id, count] of idCounts) {
                if (count > 1) {
                    errors.push(`Duplicate step id: ${id}`);
                }
            }
            // Build valid ID set for remaining checks
            const validIds = new Set(steps.map((s) => s.id));
            // 2. Dangling dependency check + 3. Self-referencing dependency check
            for (const step of steps) {
                const sid = step.id;
                const deps = Array.isArray(step.requires)
                    ? step.requires
                    : Array.isArray(step.depends_on)
                        ? step.depends_on
                        : [];
                for (const depId of deps) {
                    if (depId === sid) {
                        errors.push(`Step '${sid}' depends on itself`);
                    }
                    else if (!validIds.has(depId)) {
                        errors.push(`Step '${sid}' requires unknown step '${depId}'`);
                    }
                }
            }
            // 4. Cycle detection (DFS) — only when no duplicate IDs
            if (![...idCounts.values()].some((c) => c > 1)) {
                // Build adjacency list: step → its dependencies
                const adj = new Map();
                for (const step of steps) {
                    const sid = step.id;
                    const deps = Array.isArray(step.requires)
                        ? step.requires
                        : Array.isArray(step.depends_on)
                            ? step.depends_on
                            : [];
                    adj.set(sid, deps.filter((d) => validIds.has(d) && d !== sid));
                }
                const WHITE = 0, GRAY = 1, BLACK = 2;
                const color = new Map();
                for (const id of validIds)
                    color.set(id, WHITE);
                const parent = new Map();
                function dfs(node) {
                    color.set(node, GRAY);
                    for (const dep of adj.get(node) ?? []) {
                        if (color.get(dep) === GRAY) {
                            // Back edge found — reconstruct cycle path
                            const cycle = [dep, node];
                            let cur = node;
                            while (parent.has(cur) && parent.get(cur) !== null && parent.get(cur) !== dep) {
                                cur = parent.get(cur);
                                cycle.push(cur);
                            }
                            cycle.push(dep);
                            cycle.reverse();
                            return cycle;
                        }
                        if (color.get(dep) === WHITE) {
                            parent.set(dep, node);
                            const result = dfs(dep);
                            if (result)
                                return result;
                        }
                    }
                    color.set(node, BLACK);
                    return null;
                }
                for (const id of validIds) {
                    if (color.get(id) === WHITE) {
                        parent.set(id, null);
                        const cycle = dfs(id);
                        if (cycle) {
                            errors.push(`Cycle detected: ${cycle.join(" → ")}`);
                            break; // One cycle error is enough
                        }
                    }
                }
            }
        }
    }
    return { valid: errors.length === 0, errors };
}
// ─── Loading ─────────────────────────────────────────────────────────────
/**
 * Load and validate a YAML workflow definition from the filesystem.
 *
 * Reads `<defsDir>/<name>.yaml`, parses YAML, validates the V1 schema,
 * and converts snake_case YAML keys to camelCase TypeScript types.
 *
 * @param defsDir — directory containing definition YAML files
 * @param name — definition filename without extension
 * @returns Parsed and validated WorkflowDefinition
 * @throws Error if file is missing, YAML is malformed, or schema is invalid
 */
export function loadDefinition(defsDir, name) {
    const filePath = join(defsDir, `${name}.yaml`);
    return loadDefinitionFromFile(filePath);
}
/**
 * Load and validate a YAML workflow definition from an absolute file path.
 * Accepts both `.yaml` and `.yml` extensions.
 */
export function loadDefinitionFromFile(filePath) {
    if (!existsSync(filePath)) {
        throw new Error(`Definition file not found: ${filePath}`);
    }
    const raw = readFileSync(filePath, "utf-8");
    let parsed;
    try {
        parsed = parse(raw);
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        throw new Error(`Failed to parse YAML in ${filePath}: ${msg}`);
    }
    const { valid, errors } = validateDefinition(parsed);
    if (!valid) {
        throw new Error(`Invalid workflow definition in ${filePath}:\n  - ${errors.join("\n  - ")}`);
    }
    // Convert snake_case YAML → camelCase TypeScript
    const yamlDef = parsed;
    const yamlSteps = yamlDef.steps;
    return {
        version: yamlDef.version,
        name: yamlDef.name,
        description: typeof yamlDef.description === "string" ? yamlDef.description : undefined,
        params: yamlDef.params != null && typeof yamlDef.params === "object"
            ? Object.fromEntries(Object.entries(yamlDef.params).map(([k, v]) => [k, String(v)]))
            : undefined,
        steps: yamlSteps.map((s) => ({
            id: s.id,
            name: s.name,
            prompt: s.prompt,
            requires: Array.isArray(s.requires)
                ? s.requires
                : Array.isArray(s.depends_on)
                    ? s.depends_on
                    : [],
            produces: Array.isArray(s.produces) ? s.produces : [],
            contextFrom: Array.isArray(s.context_from) ? s.context_from : undefined,
            verify: s.verify,
            iterate: (s.iterate != null && typeof s.iterate === "object")
                ? s.iterate
                : undefined,
        })),
    };
}
// ─── Parameter Substitution ──────────────────────────────────────────────
/** Regex matching `{{key}}` placeholders — captures the key name. */
const PARAM_PATTERN = /\{\{(\w+)\}\}/g;
/**
 * Replace `{{key}}` placeholders in a single prompt string.
 *
 * Exported for use by the engine on iteration-instance prompts that live
 * in GRAPH.yaml (outside the definition's step list).
 *
 * @throws Error if any merged param value contains `..` (path-traversal guard)
 */
export function substitutePromptString(prompt, merged) {
    return prompt.replace(PARAM_PATTERN, (match, key) => {
        const value = merged[key];
        return value !== undefined ? value : match;
    });
}
/**
 * Replace `{{key}}` placeholders in all step prompts with param values.
 *
 * Merge order: `definition.params` (defaults) ← `overrides` (CLI wins).
 * Returns a **new** WorkflowDefinition — the input is never mutated.
 *
 * @throws Error if any param value contains `..` (path-traversal guard)
 * @throws Error if any `{{key}}` remains unresolved after substitution
 */
export function substituteParams(definition, overrides) {
    const merged = {
        ...(definition.params ?? {}),
        ...(overrides ?? {}),
    };
    // Path-traversal guard: reject any value containing ".."
    for (const [key, value] of Object.entries(merged)) {
        if (value.includes("..")) {
            throw new Error(`Parameter "${key}" contains disallowed '..' (path traversal): ${value}`);
        }
    }
    // Substitute in each step prompt
    const substitutedSteps = definition.steps.map((step) => ({
        ...step,
        prompt: substitutePromptString(step.prompt, merged),
    }));
    // Check for unresolved placeholders
    const unresolved = new Set();
    for (const step of substitutedSteps) {
        let m;
        const re = new RegExp(PARAM_PATTERN.source, "g");
        while ((m = re.exec(step.prompt)) !== null) {
            unresolved.add(m[1]);
        }
    }
    if (unresolved.size > 0) {
        const keys = [...unresolved].sort().join(", ");
        throw new Error(`Unresolved parameter(s) in step prompts: ${keys}`);
    }
    return {
        ...definition,
        steps: substitutedSteps,
    };
}
