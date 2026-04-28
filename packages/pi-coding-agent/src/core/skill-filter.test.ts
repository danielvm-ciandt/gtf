import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createWorkflowSkillFilter } from "./skill-filter.js";
import type { Skill } from "./skills.js";

function makeSkill(overrides: Partial<Skill> = {}): Skill {
	return {
		name: "test-skill",
		description: "Test skill",
		filePath: "/fake/SKILL.md",
		baseDir: "/fake",
		source: "project",
		disableModelInvocation: false,
		...overrides,
	};
}

describe("createWorkflowSkillFilter", () => {
	it("includes a skill with no workflows field in any workflow", () => {
		const filter = createWorkflowSkillFilter("gsd");
		const skill = makeSkill({ workflows: undefined });
		assert.equal(filter(skill), true);
	});

	it("includes a skill with empty workflows array in any workflow", () => {
		const filter = createWorkflowSkillFilter("gsd");
		const skill = makeSkill({ workflows: [] });
		assert.equal(filter(skill), true);
	});

	it("includes a bmad-only skill when workflow is bmad", () => {
		const filter = createWorkflowSkillFilter("bmad");
		const skill = makeSkill({ workflows: ["bmad"] });
		assert.equal(filter(skill), true);
	});

	it("excludes a bmad-only skill when workflow is gsd", () => {
		const filter = createWorkflowSkillFilter("gsd");
		const skill = makeSkill({ workflows: ["bmad"] });
		assert.equal(filter(skill), false);
	});

	it("includes a skill tagged with both bmad and gsd for the bmad workflow", () => {
		const filter = createWorkflowSkillFilter("bmad");
		const skill = makeSkill({ workflows: ["bmad", "gsd"] });
		assert.equal(filter(skill), true);
	});

	it("includes a skill tagged with both bmad and gsd for the gsd workflow", () => {
		const filter = createWorkflowSkillFilter("gsd");
		const skill = makeSkill({ workflows: ["bmad", "gsd"] });
		assert.equal(filter(skill), true);
	});
});
