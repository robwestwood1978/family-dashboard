import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileDashboard } from "../src/compile-dashboard.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("compiles the six enabled product views", () => {
  const yaml = compileDashboard(example);
  for (const path of ["today", "calendar", "home", "music", "chores", "football"]) {
    assert.match(yaml, new RegExp(`path: ${path}`));
  }
  assert.doesNotMatch(yaml, /path: school/);
});

test("uses the qualified calendar and media cards", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /custom:daylight-calendar-card/);
  assert.match(yaml, /custom:mediocre-multi-media-player-card/);
  assert.match(yaml, /ma_entity_id/);
  assert.match(yaml, /size: large/);
  assert.match(yaml, /rolling_days_agenda: 3/);
  assert.match(yaml, /event_styles:/);
});

test("output is deterministic", () => {
  assert.equal(compileDashboard(example), compileDashboard(example));
});
