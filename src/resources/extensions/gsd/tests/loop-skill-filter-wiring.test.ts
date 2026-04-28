/**
 * loop-skill-filter-wiring.test.ts — Source-level contract tests verifying that
 * engine.getSkillFilter?() is extracted in loop.ts and applied via
 * AutoSession.skillFilter + cmdCtx.setSkillFilter() before sendMessage().
 *
 * Uses the source-level pattern from engine-interfaces-contract.test.ts because
 * --experimental-test-module-mocks is not available in this harness.
 *
 * See MEM004: source-level contract tests are the established pattern for
 * testing bypass paths where loop internals can't be directly instrumented.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Root is 5 levels up from tests/ (tests → gsd → extensions → resources → src → root)
const PROJECT_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const LOOP_PATH = join(__dirname, "..", "auto", "loop.ts");
const RUN_UNIT_PATH = join(__dirname, "..", "auto", "run-unit.ts");
const SESSION_PATH = join(__dirname, "..", "auto", "session.ts");
const TYPES_PATH = join(PROJECT_ROOT, "packages", "pi-coding-agent", "src", "core", "extensions", "types.ts");

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

// ── loop.ts: skillFilter extraction ─────────────────────────────────────────

describe("loop.ts: skillFilter extraction after resolveEngine()", () => {
  test("loop.ts assigns engine.getSkillFilter?.() to s.skillFilter after resolveEngine()", () => {
    const source = readSource(LOOP_PATH);

    // Must assign the optional-chain call result to s.skillFilter
    assert.ok(
      /s\.skillFilter\s*=\s*engine\.getSkillFilter\?\.\(\)/.test(source),
      "loop.ts must contain: s.skillFilter = engine.getSkillFilter?.()",
    );
  });

  test("loop.ts assignment is in the engine path (after resolveEngine call)", () => {
    const source = readSource(LOOP_PATH);

    const resolveEngineIdx = source.indexOf("resolveEngine({");
    const skillFilterIdx = source.indexOf("s.skillFilter = engine.getSkillFilter?.()");

    assert.ok(resolveEngineIdx !== -1, "loop.ts must call resolveEngine()");
    assert.ok(skillFilterIdx !== -1, "loop.ts must assign s.skillFilter");
    assert.ok(
      skillFilterIdx > resolveEngineIdx,
      "s.skillFilter assignment must come AFTER resolveEngine() call",
    );
  });

  test("loop.ts assignment is before runUnitPhaseViaContract call in the engine path", () => {
    const source = readSource(LOOP_PATH);

    const skillFilterIdx = source.indexOf("s.skillFilter = engine.getSkillFilter?.()");
    assert.ok(skillFilterIdx !== -1, "loop.ts must assign s.skillFilter");

    // Find the first runUnitPhaseViaContract CALL that appears after s.skillFilter
    // (the function definition appears earlier in the file)
    const runUnitPhaseIdx = source.indexOf("runUnitPhaseViaContract(", skillFilterIdx);

    assert.ok(
      runUnitPhaseIdx !== -1,
      "loop.ts must call runUnitPhaseViaContract() after s.skillFilter assignment",
    );
    assert.ok(
      skillFilterIdx < runUnitPhaseIdx,
      "s.skillFilter assignment must come BEFORE runUnitPhaseViaContract() call in the engine path",
    );
  });
});

// ── run-unit.ts: setSkillFilter injection ────────────────────────────────────

describe("run-unit.ts: setSkillFilter called before sendMessage", () => {
  test("run-unit.ts calls cmdCtx.setSkillFilter when s.skillFilter is set", () => {
    const source = readSource(RUN_UNIT_PATH);

    assert.ok(
      /s\.cmdCtx[!?]\.setSkillFilter\(s\.skillFilter\)/.test(source),
      "run-unit.ts must call s.cmdCtx!.setSkillFilter(s.skillFilter) or s.cmdCtx?.setSkillFilter(s.skillFilter)",
    );
  });

  test("run-unit.ts guards setSkillFilter behind a skillFilter check", () => {
    const source = readSource(RUN_UNIT_PATH);

    // Must be inside an if-guard on s.skillFilter
    assert.ok(
      /if\s*\(\s*s\.skillFilter[^)]*\)/.test(source),
      "run-unit.ts must guard setSkillFilter with an if(s.skillFilter) check",
    );
  });

  test("run-unit.ts calls setSkillFilter BEFORE pi.sendMessage", () => {
    const source = readSource(RUN_UNIT_PATH);

    const setSkillFilterIdx = source.indexOf("setSkillFilter(");
    const sendMessageIdx = source.indexOf("pi.sendMessage(");

    assert.ok(setSkillFilterIdx !== -1, "run-unit.ts must contain setSkillFilter call");
    assert.ok(sendMessageIdx !== -1, "run-unit.ts must contain pi.sendMessage call");
    assert.ok(
      setSkillFilterIdx < sendMessageIdx,
      "setSkillFilter must be called BEFORE pi.sendMessage()",
    );
  });

  test("run-unit.ts calls setSkillFilter AFTER newSession resolves", () => {
    const source = readSource(RUN_UNIT_PATH);

    const newSessionIdx = source.indexOf("newSession(");
    const setSkillFilterIdx = source.indexOf("setSkillFilter(");

    assert.ok(newSessionIdx !== -1, "run-unit.ts must call newSession");
    assert.ok(setSkillFilterIdx !== -1, "run-unit.ts must call setSkillFilter");
    assert.ok(
      setSkillFilterIdx > newSessionIdx,
      "setSkillFilter must come AFTER newSession() call (after session is ready)",
    );
  });
});

// ── AutoSession.skillFilter field ───────────────────────────────────────────

describe("AutoSession.skillFilter field lifecycle", () => {
  test("AutoSession has skillFilter field declared", async () => {
    const { AutoSession } = await import("../auto/session.ts");
    const session = new AutoSession();
    assert.ok(
      "skillFilter" in session,
      "AutoSession must have a skillFilter field",
    );
  });

  test("AutoSession.skillFilter defaults to undefined", async () => {
    const { AutoSession } = await import("../auto/session.ts");
    const session = new AutoSession();
    assert.equal(
      session.skillFilter,
      undefined,
      "skillFilter should default to undefined (no filter)",
    );
  });

  test("AutoSession.skillFilter is cleared to undefined by reset()", async () => {
    const { AutoSession } = await import("../auto/session.ts");
    const session = new AutoSession();
    session.skillFilter = () => true;
    session.reset();
    assert.equal(
      session.skillFilter,
      undefined,
      "skillFilter must be undefined after reset()",
    );
  });

  test("session.ts source imports SkillFilter from @gsd/pi-coding-agent", () => {
    const source = readSource(SESSION_PATH);
    assert.ok(
      /SkillFilter/.test(source) && /@gsd\/pi-coding-agent/.test(source),
      "session.ts must import SkillFilter from @gsd/pi-coding-agent",
    );
  });
});

// ── ExtensionCommandContext interface ────────────────────────────────────────

describe("ExtensionCommandContext.setSkillFilter interface", () => {
  test("types.ts defines setSkillFilter on ExtensionCommandContext", () => {
    const source = readSource(TYPES_PATH);

    // Find the ExtensionCommandContext interface block
    const contextIdx = source.indexOf("export interface ExtensionCommandContext");
    assert.ok(contextIdx !== -1, "types.ts must define ExtensionCommandContext interface");

    // Find the next closing brace after the interface start
    const interfaceBlock = source.slice(contextIdx, contextIdx + 1500);
    assert.ok(
      /setSkillFilter\s*\(filter/.test(interfaceBlock),
      "ExtensionCommandContext must declare setSkillFilter(filter ...)",
    );
  });

  test("types.ts defines setSkillFilter on ExtensionCommandContextActions", () => {
    const source = readSource(TYPES_PATH);

    const actionsIdx = source.indexOf("export interface ExtensionCommandContextActions");
    assert.ok(actionsIdx !== -1, "types.ts must define ExtensionCommandContextActions interface");

    const actionsBlock = source.slice(actionsIdx, actionsIdx + 1000);
    assert.ok(
      /setSkillFilter\s*:/.test(actionsBlock),
      "ExtensionCommandContextActions must declare setSkillFilter property",
    );
  });
});
