/**
 * skill-filter-integration.test.ts — Integration tests verifying that
 * createWorkflowSkillFilter predicate logic works correctly with real Skill
 * objects, and that buildSystemPrompt respects the skillFilter option.
 *
 * No module mocking (harness disables --experimental-test-module-mocks).
 * Tests the full predicate path from WorkflowEngine.getSkillFilter?() output
 * through to the filtered skill list in the system prompt.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  createWorkflowSkillFilter,
  buildSystemPrompt,
  type Skill,
} from "@gsd/pi-coding-agent";
import type { WorkflowEngine } from "../workflow-engine.js";

// ── Synthetic skill fixtures ────────────────────────────────────────────────

function makeSkill(name: string, workflows?: string[]): Skill {
  return {
    name,
    description: `${name} skill`,
    filePath: `/fake/${name}/SKILL.md`,
    baseDir: `/fake/${name}`,
    source: `# ${name}`,
    disableModelInvocation: false,
    workflows,
  };
}

const bmadSkill = makeSkill("bmad-task", ["bmad"]);
const gsdSkill = makeSkill("gsd-task", ["gsd"]);
const untaggedSkill = makeSkill("generic-tool"); // no workflows field

// ── createWorkflowSkillFilter predicate logic ───────────────────────────────

describe("createWorkflowSkillFilter: predicate logic with Skill objects", () => {
  const bmadFilter = createWorkflowSkillFilter("bmad");

  test("BMAD skill (workflows: ['bmad']) passes BMAD filter", () => {
    assert.strictEqual(bmadFilter(bmadSkill), true);
  });

  test("GSD skill (workflows: ['gsd']) is excluded by BMAD filter", () => {
    assert.strictEqual(bmadFilter(gsdSkill), false);
  });

  test("untagged skill (no workflows field) passes BMAD filter — default-to-all invariant", () => {
    assert.strictEqual(bmadFilter(untaggedSkill), true);
  });

  test("skill with empty workflows array passes any filter — default-to-all invariant", () => {
    const emptyWorkflowsSkill = makeSkill("empty-workflows", []);
    assert.strictEqual(bmadFilter(emptyWorkflowsSkill), true);
  });

  test("skill tagged with multiple workflows passes when one matches", () => {
    const multiTagged = makeSkill("multi-tool", ["bmad", "gsd"]);
    assert.strictEqual(bmadFilter(multiTagged), true);
  });

  test("GSD filter excludes BMAD-only skill", () => {
    const gsdFilter = createWorkflowSkillFilter("gsd");
    assert.strictEqual(gsdFilter(bmadSkill), false);
    assert.strictEqual(gsdFilter(gsdSkill), true);
    assert.strictEqual(gsdFilter(untaggedSkill), true);
  });
});

// ── WorkflowEngine.getSkillFilter?() integration ───────────────────────────

describe("WorkflowEngine.getSkillFilter?() produces usable filter", () => {
  // Minimal engine satisfying the WorkflowEngine interface contract
  const bmadEngine: WorkflowEngine = {
    engineId: "bmad",
    async deriveState() {
      return { phase: "execute", unitId: "T01", milestoneId: "M001" } as never;
    },
    async resolveDispatch() {
      return { action: "done" } as never;
    },
    async reconcile() {
      return { next: "done" } as never;
    },
    getDisplayMetadata() {
      return { label: "BMAD" } as never;
    },
    getSkillFilter() {
      return createWorkflowSkillFilter("bmad");
    },
  };

  test("getSkillFilter?() returns a function", () => {
    const filter = bmadEngine.getSkillFilter?.();
    assert.strictEqual(typeof filter, "function");
  });

  test("filter from engine passes BMAD skill and rejects GSD skill", () => {
    const filter = bmadEngine.getSkillFilter!();
    assert.strictEqual(filter(bmadSkill), true, "BMAD skill must pass BMAD engine filter");
    assert.strictEqual(filter(gsdSkill), false, "GSD skill must be excluded by BMAD engine filter");
    assert.strictEqual(filter(untaggedSkill), true, "Untagged skill must pass — default-to-all invariant");
  });
});

// ── buildSystemPrompt: skillFilter integration ──────────────────────────────

describe("buildSystemPrompt: skillFilter option filters skill catalog", () => {
  const allSkills = [bmadSkill, gsdSkill, untaggedSkill];
  const bmadFilter = createWorkflowSkillFilter("bmad");

  test("BMAD filter: bmad-task skill appears in prompt", () => {
    const prompt = buildSystemPrompt({
      customPrompt: "test",
      skills: allSkills,
      skillFilter: bmadFilter,
      selectedTools: ["read"],
    });
    assert.ok(
      prompt.includes("bmad-task"),
      "BMAD skill must appear in system prompt when BMAD filter is active",
    );
  });

  test("BMAD filter: gsd-task skill is absent from prompt", () => {
    const prompt = buildSystemPrompt({
      customPrompt: "test",
      skills: allSkills,
      skillFilter: bmadFilter,
      selectedTools: ["read"],
    });
    assert.ok(
      !prompt.includes("gsd-task"),
      "GSD skill must be absent from system prompt when BMAD filter is active",
    );
  });

  test("BMAD filter: untagged skill appears in prompt — default-to-all invariant", () => {
    const prompt = buildSystemPrompt({
      customPrompt: "test",
      skills: allSkills,
      skillFilter: bmadFilter,
      selectedTools: ["read"],
    });
    assert.ok(
      prompt.includes("generic-tool"),
      "Untagged skill must appear in system prompt regardless of active filter",
    );
  });

  test("no filter: all three skills appear in prompt", () => {
    const prompt = buildSystemPrompt({
      customPrompt: "test",
      skills: allSkills,
      selectedTools: ["read"],
    });
    assert.ok(prompt.includes("bmad-task"), "bmad-task must appear when no filter");
    assert.ok(prompt.includes("gsd-task"), "gsd-task must appear when no filter");
    assert.ok(prompt.includes("generic-tool"), "generic-tool must appear when no filter");
  });

  test("GSD filter: gsd-task visible, bmad-task excluded", () => {
    const gsdFilter = createWorkflowSkillFilter("gsd");
    const prompt = buildSystemPrompt({
      customPrompt: "test",
      skills: allSkills,
      skillFilter: gsdFilter,
      selectedTools: ["read"],
    });
    assert.ok(prompt.includes("gsd-task"), "gsd-task must appear in GSD session prompt");
    assert.ok(!prompt.includes("bmad-task"), "bmad-task must be absent from GSD session prompt");
    assert.ok(prompt.includes("generic-tool"), "untagged skill must appear in GSD session prompt");
  });
});
