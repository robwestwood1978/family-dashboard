import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderControlsPreview, renderPreview } from "../preview/render-preview.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("the tracked 10.5-inch iPad Today preview is deterministic", async () => {
  const tracked = await readFile(new URL("../preview/family-dashboard-preview.svg", import.meta.url), "utf8");
  const rendered = renderPreview(example);
  assert.equal(tracked, rendered);
  assert.match(rendered, /width="1112" height="834"/);
  assert.match(rendered, /First-party Family Hub/);
  assert.match(rendered, /School &amp; chores/);
  assert.match(rendered, /Tottenham spotlight/);
  assert.match(rendered, /Aston Villa spotlight/);
  assert.match(rendered, /All 38 matchweeks/);
  assert.doesNotMatch(rendered, /192\.168\.|api[_-]?key|access[_-]?token/i);
});

test("the tracked floorplan preview is deterministic, interactive-looking and privacy safe", async () => {
  const tracked = await readFile(new URL("../preview/family-dashboard-rooms-preview.svg", import.meta.url), "utf8");
  const rendered = renderControlsPreview(example);
  assert.equal(tracked, rendered);
  assert.match(rendered, /width="1112" height="834"/);
  assert.match(rendered, /Interactive house/);
  assert.match(rendered, /Tap a room to control it/);
  assert.match(rendered, /Illustrative geometry/);
  assert.match(rendered, /Living room/);
  assert.match(rendered, /LOW-RISK CONTROLS ONLY/);
  assert.doesNotMatch(rendered, /Cameras &amp; Entry|GARAGE|192\.168\.|api[_-]?key|access[_-]?token/i);
});
