/**
 * loop-null-engine-routing.test.ts — Source-level contract test proving that
 * loop.ts:412 routes null (default GSD) and dev activeEngineId through the
 * engine layer instead of the legacy dev path.
 *
 * After S01 T02: the condition no longer gates on activeEngineId != null &&
 * activeEngineId !== "dev". Only sidecarItem and GSD_ENGINE_BYPASS remain as
 * guards. This test encodes that contract so future edits can't silently revert.
 */

import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOOP_PATH = join(__dirname, "..", "auto", "loop.ts");

function readSource(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("loop null-engineId routing (S01)", () => {
  const src = readSource(LOOP_PATH);

  test("engine-path condition does NOT gate on activeEngineId != null", () => {
    assert.ok(
      !src.includes("s.activeEngineId != null"),
      "activeEngineId != null guard must be absent — null sessions now route through the engine layer",
    );
  });

  test("engine-path condition does NOT gate on activeEngineId !== 'dev'", () => {
    assert.ok(
      !src.includes(`s.activeEngineId !== "dev"`),
      `activeEngineId !== "dev" guard must be absent — dev sessions now route through the engine layer`,
    );
  });

  test("sidecarItem guard is preserved on the engine-path condition", () => {
    assert.ok(
      src.includes("!sidecarItem"),
      "!sidecarItem guard must be present — sidecar sessions still bypass the engine path",
    );
  });

  test("GSD_ENGINE_BYPASS guard is preserved on the engine-path condition", () => {
    assert.ok(
      src.includes(`process.env.GSD_ENGINE_BYPASS !== "1"`),
      "GSD_ENGINE_BYPASS !== 1 guard must be present — kill-switch must remain intact",
    );
  });

  test("minimal engine-path condition has the correct shape", () => {
    // The full new condition is exactly:
    //   if (!sidecarItem && process.env.GSD_ENGINE_BYPASS !== "1") {
    assert.ok(
      src.includes(`if (!sidecarItem && process.env.GSD_ENGINE_BYPASS !== "1") {`),
      `engine-path condition must be exactly: if (!sidecarItem && process.env.GSD_ENGINE_BYPASS !== "1") {`,
    );
  });
});
