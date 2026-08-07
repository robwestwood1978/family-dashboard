import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { renderPreview } from "../preview/render-preview.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("the tracked 1024 by 768 preview is deterministic", async () => {
  const tracked = await readFile(new URL("../preview/family-dashboard-preview.svg", import.meta.url), "utf8");
  const rendered = renderPreview(example);
  assert.equal(tracked, rendered);
  assert.match(rendered, /width="1024" height="768"/);
  assert.match(rendered, /Today view preview/);
  assert.doesNotMatch(rendered, /192\.168\.|api[_-]?key|access[_-]?token/i);
});
