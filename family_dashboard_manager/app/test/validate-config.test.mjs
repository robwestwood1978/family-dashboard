import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateConfig } from "../src/validate-config.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("accepts the public example configuration", () => {
  assert.equal(validateConfig(structuredClone(example)).schema_version, 3);
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

test("requires the default view to be enabled", () => {
  const config = structuredClone(example);
  config.display.default_view = "school";
  assert.throws(() => validateConfig(config), /must be enabled in config.features/);
});

test("requires controls to use the expected entity domain", () => {
  const config = structuredClone(example);
  config.rooms[0].covers[0] = "light.not_a_cover";
  assert.throws(() => validateConfig(config), /must use the cover domain/);
});

test("requires ChoreOps users to reference children", () => {
  const config = structuredClone(example);
  config.chores.users[0].person_id = "parent";
  assert.throws(() => validateConfig(config), /must reference a child/);
});

test("rejects unsafe panel paths", () => {
  const config = structuredClone(example);
  config.display.panel_path = "../../lovelace";
  assert.throws(() => validateConfig(config), /must be a lowercase dashboard path/);
});

test("requires the primary and garage cameras to reference configured camera IDs", () => {
  const missingPrimary = structuredClone(example);
  missingPrimary.entry.primary_camera_id = "missing";
  assert.throws(() => validateConfig(missingPrimary), /must match one configured camera/);

  const missingGarage = structuredClone(example);
  missingGarage.entry.garage.camera_id = "missing";
  assert.throws(() => validateConfig(missingGarage), /must match one configured camera/);
});

test("requires Cameras & Entry to remain under the Home control surface", () => {
  const config = structuredClone(example);
  config.features.home = false;
  assert.throws(() => validateConfig(config), /entry: requires the Home view/);
});

test("requires camera, event and garage entities to use safe expected domains", () => {
  const camera = structuredClone(example);
  camera.entry.cameras[0].entity_id = "sensor.not_a_camera";
  assert.throws(() => validateConfig(camera), /must use the camera domain/);

  const ringing = structuredClone(example);
  ringing.entry.cameras[0].ringing_entity = "switch.not_a_binary_sensor";
  assert.throws(() => validateConfig(ringing), /must use the binary_sensor domain/);

  const garage = structuredClone(example);
  garage.entry.garage.cover_entity = "switch.not_a_cover";
  assert.throws(() => validateConfig(garage), /must use the cover domain/);
});
