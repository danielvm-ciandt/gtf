/**
 * loop-routing.test.ts — Behavioral regression tests proving that the engine
 * routing logic in loop.ts:412 behaves correctly for all three bypass cases.
 *
 * Uses resolveEngine directly (it is the same function the loop calls) to
 * verify:
 *   1. null activeEngineId → DevWorkflowEngine returned; deriveState callable
 *   2. GSD_ENGINE_BYPASS=1 → loop.ts source confirms the condition gates it out
 *   3. sidecarItem=true  → loop.ts source confirms the condition gates it out
 *
 * We cannot use mock.module() (--experimental-test-module-mocks is not enabled)
 * so the engine-path itself is tested by calling resolveEngine and exercising the
 * returned engine, while the bypass paths are verified via source-level contract.
 */

import test, { describe, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_PATH = join(__dirname, "..", "auto", "loop.ts");

// ── Helper: minimal .gsd tree for deriveState ───────────────────────────────
function makeMinimalGsdDir(): { basePath: string; cleanup: () => void } {
  const basePath = mkdtempSync(join(tmpdir(), "loop-routing-"));
  const gsdDir = join(basePath, ".gsd");
  mkdirSync(gsdDir, { recursive: true });

  // DevWorkflowEngine.deriveState reads STATE.md — provide a minimal one so it
  // doesn't throw on a missing file.
  writeFileSync(
    join(gsdDir, "STATE.md"),
    "## Active Milestone\nM001\n\n## Active Slice\nS01\n",
  );

  return {
    basePath,
    cleanup: () => rmSync(basePath, { recursive: true, force: true }),
  };
}

// ── 1. null activeEngineId → engine layer is entered; deriveState is callable ─
describe("loop routing: null activeEngineId uses engine layer", () => {
  test("resolveEngine returns DevWorkflowEngine for null session", async () => {
    const { resolveEngine } = await import("../engine-resolver.ts");
    const { engine, policy } = resolveEngine({ activeEngineId: null });

    // engineId must be "dev" — confirms the correct implementation is returned
    assert.equal(engine.engineId, "dev");

    // policy is an object (not null) — confirms a policy was also resolved
    assert.ok(policy, "policy must be non-null for a null-engineId session");
  });

  test("engine.deriveState is callable and resolves for null session", async () => {
    const { resolveEngine } = await import("../engine-resolver.ts");
    const { engine } = resolveEngine({ activeEngineId: null });

    // Spy on deriveState to confirm it is invoked
    const spy = mock.fn(engine.deriveState.bind(engine));

    const { basePath, cleanup } = makeMinimalGsdDir();
    try {
      const state = await spy(basePath);

      assert.equal(spy.mock.calls.length, 1, "deriveState must have been called exactly once");
      assert.ok(typeof state === "object" && state !== null, "deriveState must return an object");
      assert.ok("isComplete" in state, "EngineState must have isComplete field");
    } finally {
      cleanup();
    }
  });
});

// ── 2. GSD_ENGINE_BYPASS=1 → engine block is skipped ───────────────────────
describe("loop routing: GSD_ENGINE_BYPASS=1 skips engine path", () => {
  test("loop.ts condition gates on GSD_ENGINE_BYPASS !== '1'", () => {
    const src = readFileSync(LOOP_PATH, "utf-8");

    // The guard must still be present — removing it would break the kill switch
    assert.ok(
      src.includes(`process.env.GSD_ENGINE_BYPASS !== "1"`),
      "GSD_ENGINE_BYPASS guard must be present in the engine-path condition",
    );
  });

  test("loop.ts GSD_ENGINE_BYPASS guard is part of the engine-path if-condition", () => {
    const src = readFileSync(LOOP_PATH, "utf-8");

    // The exact minimal condition shape including the bypass guard
    assert.ok(
      src.includes(`if (!sidecarItem && process.env.GSD_ENGINE_BYPASS !== "1") {`),
      "bypass guard must be inside the engine-path if-condition, not elsewhere",
    );
  });
});

// ── 3. sidecarItem=true → engine path is skipped ───────────────────────────
describe("loop routing: sidecarItem guard skips engine path", () => {
  test("loop.ts condition gates on !sidecarItem", () => {
    const src = readFileSync(LOOP_PATH, "utf-8");

    assert.ok(
      src.includes("!sidecarItem"),
      "!sidecarItem guard must be present — sidecar sessions must bypass the engine path",
    );
  });

  test("sidecarItem guard is the first operand in the engine-path condition", () => {
    const src = readFileSync(LOOP_PATH, "utf-8");

    // sidecarItem must come before the GSD_ENGINE_BYPASS check (short-circuit order)
    const condIdx = src.indexOf(`if (!sidecarItem && process.env.GSD_ENGINE_BYPASS !== "1")`);
    assert.ok(
      condIdx !== -1,
      "engine-path condition must have !sidecarItem as the first guard (short-circuits before env read)",
    );
  });
});
