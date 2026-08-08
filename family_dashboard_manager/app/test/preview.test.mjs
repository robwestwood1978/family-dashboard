import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderControlsPreview, renderPreview } from "../preview/render-preview.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("the tracked warm-glass Today preview is deterministic", async () => {
  const tracked = await readFile(new URL("../preview/family-dashboard-preview.svg", import.meta.url), "utf8");
  const rendered = renderPreview(example);
  assert.equal(tracked, rendered);
  assert.match(rendered, /width="1024" height="768"/);
  assert.match(rendered, /warm-glass Today view preview/);
  assert.match(rendered, /Today’s rhythm/);
  assert.match(rendered, /UP NEXT/);
  assert.doesNotMatch(rendered, /192\.168\.|api[_-]?key|access[_-]?token/i);
});

test("the tracked warm-glass control preview is deterministic and privacy safe", async () => {
  const tracked = await readFile(new URL("../preview/family-dashboard-controls-preview.svg", import.meta.url), "utf8");
  const rendered = renderControlsPreview(example);
  assert.equal(tracked, rendered);
  assert.match(rendered, /width="1024" height="768"/);
  assert.match(rendered, /Lighting/);
  assert.match(rendered, /Heating/);
  assert.match(rendered, /Cameras &amp; Entry/);
  assert.match(rendered, /Media/);
  assert.match(rendered, /HOLD TO/);
  assert.doesNotMatch(rendered, /192\.168\.|api[_-]?key|access[_-]?token/i);
});
