import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateConfig } from "../src/validate-config.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("accepts the public example configuration", () => {
  assert.equal(validateConfig(structuredClone(example)).schema_version, 1);
});

test("rejects secret-bearing keys anywhere in config", () => {
  const config = structuredClone(example);
  config.media.api_token = "must-not-be-committed";
  assert.throws(() => validateConfig(config), /secret-bearing keys are not permitted/);
});

test("rejects camelCase secret-bearing keys", () => {
  const config = structuredClone(example);
  config.media.accessToken = "must-not-be-committed";
  assert.throws(() => validateConfig(config), /secret-bearing keys are not permitted/);
});

test("rejects invalid entity IDs", () => {
  const config = structuredClone(example);
  config.rooms[0].lights[0] = "192.168.1.1";
  assert.throws(() => validateConfig(config), /invalid Home Assistant entity ID/);
});

test("requires the initial media player to be configured", () => {
  const config = structuredClone(example);
  config.media.initial_player = "media_player.missing";
  assert.throws(() => validateConfig(config), /must match one configured player/);
});
