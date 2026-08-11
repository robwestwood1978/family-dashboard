import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateConfig } from "../src/validate-config.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

function withDeferredEntry() {
  const config = structuredClone(example);
  config.entry = {
    primary_camera_id: "doorbell",
    cameras: [{
      id: "doorbell",
      name: "Example doorbell",
      entity_id: "camera.example_doorbell",
      role: "doorbell",
      motion_entity: "binary_sensor.example_doorbell_motion"
    }],
    garage: {
      cover_entity: "cover.example_garage",
      camera_id: "doorbell"
    }
  };
  return config;
}

test("accepts the public schema-v4 configuration", () => {
  assert.equal(validateConfig(structuredClone(example)).schema_version, 4);
});

test("requires read-only mode to be explicit", () => {
  const config = structuredClone(example);
  delete config.display.read_only;
  assert.throws(() => validateConfig(config), /display\.read_only/);
});

test("accepts the existing manager's private asset root", () => {
  const config = structuredClone(example);
  config.display.read_only = true;
  config.display.panel_path = "family-dashboard";
  config.floorplan.floors[0].base_image = "/local/family-dashboard/private/ground-floor.svg";
  config.floorplan.floors[1].base_image = "/local/family-dashboard/private/first-floor.svg";
  assert.equal(validateConfig(config).display.read_only, true);
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

test("requires the default internal view to be enabled", () => {
  const config = structuredClone(example);
  config.display.default_view = "family";
  config.features.family = false;
  config.features.location_map = false;
  assert.throws(() => validateConfig(config), /must be enabled in config.features/);
});

test("requires controls to use the expected entity domain", () => {
  const config = structuredClone(example);
  config.rooms[0].covers[0] = "light.not_a_cover";
  assert.throws(() => validateConfig(config), /must use the cover domain/);
});

test("requires ChoreOps and Classroom users to reference children", () => {
  const chores = structuredClone(example);
  chores.chores.users[0].person_id = "parent";
  assert.throws(() => validateConfig(chores), /must reference a child/);

  const classroom = structuredClone(example);
  classroom.school.classroom_students[0].person_id = "parent";
  assert.throws(() => validateConfig(classroom), /must reference a child/);
});

test("rejects unsafe panel and floorplan asset paths", () => {
  const panel = structuredClone(example);
  panel.display.panel_path = "../../lovelace";
  assert.throws(() => validateConfig(panel), /must be a lowercase dashboard path/);

  const asset = structuredClone(example);
  asset.floorplan.floors[0].base_image = "/local/family-dashboard/../secrets.yaml";
  assert.throws(() => validateConfig(asset), /must be a safe/);
});

test("requires an IANA timezone for tablet date and fixture formatting", () => {
  const config = structuredClone(example);
  config.product.timezone = "Somewhere/Home";
  assert.throws(() => validateConfig(config), /must be a valid IANA timezone/);
});

test("requires every room and light overlay to match its configured floor", () => {
  const room = structuredClone(example);
  room.rooms[0].floor_id = "first";
  assert.throws(() => validateConfig(room), /hotspot for living_room is on the wrong floor/);

  const overlay = structuredClone(example);
  overlay.floorplan.floors[0].light_overlays[0].entity_id = "light.child_one_room";
  assert.throws(() => validateConfig(overlay), /light overlay for light.child_one_room is on the wrong floor/);
});

test("requires the natural floorplan aspect ratio used by the shared image and hotspot coordinates", () => {
  const config = structuredClone(example);
  config.floorplan.floors[0].aspect_ratio = 0;
  assert.throws(() => validateConfig(config), /aspect_ratio: must be a number from 0.5 to 4/);
});

test("accepts an explicitly configured Eufy vacuum map as the private floorplan source", () => {
  const config = structuredClone(example);
  delete config.floorplan.floors[0].base_image;
  config.floorplan.floors[0].vacuum_map_entity = "camera.robovac_map";
  assert.equal(validateConfig(config).floorplan.floors[0].vacuum_map_entity, "camera.robovac_map");
});

test("does not allow an ordinary security camera to become a floorplan source", () => {
  const config = structuredClone(example);
  delete config.floorplan.floors[0].base_image;
  config.floorplan.floors[0].vacuum_map_entity = "camera.front_door";
  assert.throws(() => validateConfig(config), /must use a map-named camera entity/);
});

test("requires every floor to provide a private image or approved vacuum map", () => {
  const config = structuredClone(example);
  delete config.floorplan.floors[0].base_image;
  delete config.floorplan.floors[0].vacuum_map_entity;
  assert.throws(() => validateConfig(config), /must define base_image or vacuum_map_entity/);
});

test("requires location cards to use explicitly opted-in person entities", () => {
  const config = structuredClone(example);
  config.location.entities[0] = "person.unapproved";
  assert.throws(() => validateConfig(config), /must match one explicitly configured person location entity/);
});

test("requires the requested Premier League spotlights to be unique team codes", () => {
  assert.deepEqual(example.football.spotlight_team_codes, ["TOT", "AVL"]);
  const config = structuredClone(example);
  config.football.spotlight_team_codes = ["TOT", "TOT"];
  assert.throws(() => validateConfig(config), /must be unique/);

  const missingVilla = structuredClone(example);
  missingVilla.football.spotlight_team_codes = ["TOT", "ARS"];
  assert.throws(() => validateConfig(missingVilla), /must include AVL/);
});

test("requires configured Classroom children while School is enabled", () => {
  const config = structuredClone(example);
  config.school.classroom_students = [];
  assert.throws(() => validateConfig(config), /must not be empty when School is enabled/);
});

test("keeps Cameras & Entry disabled for the v0.4 qualification phase", () => {
  const config = structuredClone(example);
  config.features.entry = true;
  assert.throws(() => validateConfig(config), /remain disabled until a separately qualified release/);
});

test("requires camera, event and garage entities to use safe expected domains", () => {
  const camera = withDeferredEntry();
  camera.entry.cameras[0].entity_id = "sensor.not_a_camera";
  assert.throws(() => validateConfig(camera), /must use the camera domain/);

  const ringing = withDeferredEntry();
  ringing.entry.cameras[0].ringing_entity = "switch.not_a_binary_sensor";
  assert.throws(() => validateConfig(ringing), /must use the binary_sensor domain/);

  const garage = withDeferredEntry();
  garage.entry.garage.cover_entity = "switch.not_a_cover";
  assert.throws(() => validateConfig(garage), /must use the cover domain/);
});

test("rejects unknown fields through the production schema gate", () => {
  const config = structuredClone(example);
  config.rooms[0].invented_control = "switch.unknown";
  assert.throws(() => validateConfig(config), /invented_control: must NOT have additional properties/);
});
