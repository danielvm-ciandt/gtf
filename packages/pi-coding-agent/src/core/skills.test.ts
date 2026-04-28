// Unit tests for skills.ts — frontmatter parsing including the workflows field

import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, before, after } from "node:test";

import { loadSkillsFromDir } from "./skills.js";

describe("loadSkillsFromDir — workflows frontmatter field", () => {
	let tmpDir: string;

	before(() => {
		tmpDir = mkdtempSync(join(tmpdir(), "pi-skills-test-"));
	});

	after(() => {
		rmSync(tmpDir, { recursive: true, force: true });
	});

	it("parses workflows field when present in frontmatter", () => {
		const skillDir = join(tmpDir, "my-workflow-skill");
		mkdirSync(skillDir);
		writeFileSync(
			join(skillDir, "SKILL.md"),
			[
				"---",
				"name: my-workflow-skill",
				"description: A skill scoped to specific workflows",
				"workflows: [bmad, gsd]",
				"---",
				"",
				"Skill body content.",
			].join("\n"),
		);

		const { skills } = loadSkillsFromDir({ dir: tmpDir, source: "project" });
		const skill = skills.find((s) => s.name === "my-workflow-skill");

		assert.ok(skill, "skill should be loaded");
		assert.deepEqual(skill.workflows, ["bmad", "gsd"]);
	});

	it("parses to undefined workflows when field is absent", () => {
		const skillDir = join(tmpDir, "no-workflow-skill");
		mkdirSync(skillDir);
		writeFileSync(
			join(skillDir, "SKILL.md"),
			[
				"---",
				"name: no-workflow-skill",
				"description: A skill with no workflow scope",
				"---",
				"",
				"Skill body content.",
			].join("\n"),
		);

		const { skills } = loadSkillsFromDir({ dir: tmpDir, source: "project" });
		const skill = skills.find((s) => s.name === "no-workflow-skill");

		assert.ok(skill, "skill should be loaded");
		assert.equal(skill.workflows, undefined);
	});
});
