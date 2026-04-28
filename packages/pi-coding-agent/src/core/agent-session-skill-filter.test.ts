// Integration tests for AgentSession skill filter wiring.
// Verifies that skillFilter in AgentSessionConfig and setSkillFilter() control
// which skills appear in the session's system prompt.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { Agent } from "@gsd/pi-agent-core";
import { AgentSession } from "./agent-session.js";
import { AuthStorage } from "./auth-storage.js";
import { createWorkflowSkillFilter, type SkillFilter } from "./skill-filter.js";
import { ModelRegistry } from "./model-registry.js";
import { DefaultResourceLoader } from "./resource-loader.js";
import { SessionManager } from "./session-manager.js";
import { SettingsManager } from "./settings-manager.js";

let testDir: string;

function writeSkill(dir: string, name: string, workflows?: string[]): void {
	const skillDir = join(dir, name);
	mkdirSync(skillDir, { recursive: true });
	const frontmatter = workflows
		? `---\nname: ${name}\ndescription: Skill ${name}\nworkflows: [${workflows.join(", ")}]\n---\n`
		: `---\nname: ${name}\ndescription: Skill ${name}\n---\n`;
	writeFileSync(join(skillDir, "SKILL.md"), frontmatter + "\nSkill body.");
}

async function createSession(skillFilter?: SkillFilter): Promise<AgentSession> {
	const agentDir = join(testDir, "agent-home");
	mkdirSync(agentDir, { recursive: true });

	const authStorage = AuthStorage.inMemory({});
	const modelRegistry = new ModelRegistry(authStorage, join(agentDir, "models.json"));
	const settingsManager = SettingsManager.inMemory();

	// Write synthetic skills into the project skills dir
	const skillsDir = join(testDir, ".agents", "skills");
	mkdirSync(skillsDir, { recursive: true });
	writeSkill(skillsDir, "gsd-skill");                    // no workflows — default-to-all
	writeSkill(skillsDir, "bmad-skill", ["bmad"]);         // bmad-only
	writeSkill(skillsDir, "shared-skill", ["bmad", "gsd"]); // available in both

	const resourceLoader = new DefaultResourceLoader({
		cwd: testDir,
		agentDir,
		settingsManager,
		noExtensions: true,
		noPromptTemplates: true,
		noThemes: true,
	});
	await resourceLoader.reload();

	return new AgentSession({
		agent: new Agent(),
		sessionManager: SessionManager.inMemory(testDir),
		settingsManager,
		cwd: testDir,
		resourceLoader,
		modelRegistry,
		skillFilter,
	});
}

function getSystemPrompt(session: AgentSession): string {
	return (session as any)._baseSystemPrompt as string;
}

describe("AgentSession skillFilter — constructor injection", () => {
	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "agent-session-skill-filter-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("excludes bmad-only skill from a gsd-filtered session prompt", async () => {
		const session = await createSession(createWorkflowSkillFilter("gsd"));
		const prompt = getSystemPrompt(session);

		assert.ok(!prompt.includes("bmad-skill"), "bmad-only skill must be absent from gsd session");
		assert.ok(prompt.includes("gsd-skill"), "untagged skill must appear in gsd session");
		assert.ok(prompt.includes("shared-skill"), "shared skill must appear in gsd session");
	});

	it("includes all skills when no filter is provided", async () => {
		const session = await createSession();
		const prompt = getSystemPrompt(session);

		assert.ok(prompt.includes("bmad-skill"), "bmad-only skill must appear in unfiltered session");
		assert.ok(prompt.includes("gsd-skill"), "untagged skill must appear in unfiltered session");
		assert.ok(prompt.includes("shared-skill"), "shared skill must appear in unfiltered session");
	});
});

describe("AgentSession.setSkillFilter()", () => {
	beforeEach(() => {
		testDir = mkdtempSync(join(tmpdir(), "agent-session-skill-filter-set-"));
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	it("immediately applies a new filter to the system prompt", async () => {
		const session = await createSession();

		// Before filter: all skills visible
		assert.ok(getSystemPrompt(session).includes("bmad-skill"));

		// Apply gsd filter: bmad-only skill must disappear
		session.setSkillFilter(createWorkflowSkillFilter("gsd"));
		assert.ok(!getSystemPrompt(session).includes("bmad-skill"), "bmad-only skill must be absent after setSkillFilter");
		assert.ok(getSystemPrompt(session).includes("gsd-skill"), "untagged skill must remain after setSkillFilter");
	});

	it("restores all skills when filter is set to undefined", async () => {
		const session = await createSession(createWorkflowSkillFilter("gsd"));

		// With filter: bmad-only skill absent
		assert.ok(!getSystemPrompt(session).includes("bmad-skill"));

		// Remove filter: all skills must reappear
		session.setSkillFilter(undefined);
		assert.ok(getSystemPrompt(session).includes("bmad-skill"), "bmad-only skill must reappear after removing filter");
	});
});
