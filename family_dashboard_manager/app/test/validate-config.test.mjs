import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateConfig } from "../src/validate-config.mjs";
import { CURRENT_SCHEMA_VERSION } from "../src/schema-version.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

function withDeferredEntry() {
  const config = structuredClone(example);
  config.entry = {
    alarm_entity: "alarm_control_panel.example_home",
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

test("accepts the public schema-v6 configuration", () => {
  assert.equal(validateConfig(structuredClone(example)).schema_version, CURRENT_SCHEMA_VERSION);
  const stale = structuredClone(example);
  stale.schema_version = CURRENT_SCHEMA_VERSION - 1;
  assert.throws(
    () => validateConfig(stale),
    new RegExp(`config\\.schema_version: must equal ${CURRENT_SCHEMA_VERSION}`)
  );
});

test("keeps Energy and the preferred Home room optional for existing schema-v6 households", () => {
  const config = structuredClone(example);
  delete config.features.energy;
  delete config.energy;
  delete config.home.default_room;
  assert.equal(validateConfig(config).schema_version, CURRENT_SCHEMA_VERSION);
});

test("requires a complete, unique sensor mapping only when Energy is configured", () => {
  const missing = structuredClone(example);
  delete missing.energy;
  assert.throws(() => validateConfig(missing), /config\.energy: must be configured when Energy is enabled/);

  const wrongDomain = structuredClone(example);
  wrongDomain.energy.gas.usage_today_entity = "binary_sensor.example_gas_usage";
  assert.throws(() => validateConfig(wrongDomain), /must use the sensor domain/);

  const duplicate = structuredClone(example);
  duplicate.energy.gas.cost_today_entity = duplicate.energy.electricity.cost_today_entity;
  assert.throws(() => validateConfig(duplicate), /config\.energy meter entities: must be unique/);
});

test("requires the preferred Home room to exist on the default floor", () => {
  const missing = structuredClone(example);
  missing.home.default_room = "missing_room";
  assert.throws(() => validateConfig(missing), /must match one configured room/);

  const wrongFloor = structuredClone(example);
  wrongFloor.home.default_room = "child_one_room";
  assert.throws(() => validateConfig(wrongFloor), /must be on the configured default floor/);
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

test("accepts a cache-safe floorplan revision and rejects URL-shaped values", () => {
  const config = structuredClone(example);
  config.floorplan.floors[0].asset_revision = "v0.7.0";
  assert.equal(validateConfig(config).floorplan.floors[0].asset_revision, "v0.7.0");

  config.floorplan.floors[0].asset_revision = "v0.7.0?unsafe=true";
  assert.throws(() => validateConfig(config), /asset_revision/);
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
  config.features.chores = false;
  config.features.school = false;
  assert.throws(() => validateConfig(config), /must be enabled in config.features/);
});

test("requires nested Family and Cleaning features to keep their parent view enabled", () => {
  for (const [feature, parent, message] of [
    ["chores", "family", /features\.chores.*requires the Family view/],
    ["school", "family", /features\.school.*requires the Family view/],
    ["location_map", "family", /features\.location_map.*requires the Family view/],
    ["cleaning", "rooms", /features\.cleaning.*requires the Home view/]
  ]) {
    const config = structuredClone(example);
    config.features[parent] = false;
    if (parent === "family") {
      config.features.chores = feature === "chores";
      config.features.school = feature === "school";
      config.features.location_map = feature === "location_map";
    }
    assert.throws(() => validateConfig(config), message);
  }
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

test("requires individual ChoreOps status sensors for every configured child", () => {
  const config = structuredClone(example);
  config.chores.users[0].status_entities = [];
  assert.throws(() => validateConfig(config), /status_entities/);

  const wrongDomain = structuredClone(example);
  wrongDomain.chores.users[0].status_entities[0] = "binary_sensor.not_a_chore_status";
  assert.throws(() => validateConfig(wrongDomain), /must use the sensor domain/);

  const missingChild = structuredClone(example);
  missingChild.chores.users.pop();
  assert.throws(() => validateConfig(missingChild), /must map every child.*missing child_two/);

  const sharedSensor = structuredClone(example);
  sharedSensor.chores.users[1].points_entity = sharedSensor.chores.users[0].points_entity;
  assert.throws(() => validateConfig(sharedSensor), /entity mappings.*must be unique/);
});

test("keeps ChoreOps rewards, progress and native dashboard routing optional", () => {
  const extended = structuredClone(example);
  assert.equal(validateConfig(extended).chores.dashboard_path, "/choreops");
  assert.equal(extended.chores.users[0].reward_status_entities.length, 1);
  assert.equal(extended.chores.users[0].badge_progress_entities.length, 1);
  assert.equal(extended.chores.users[0].achievement_progress_entities.length, 1);

  const legacy = structuredClone(example);
  delete legacy.chores.dashboard_path;
  for (const user of legacy.chores.users) {
    delete user.reward_status_entities;
    delete user.badge_progress_entities;
    delete user.achievement_progress_entities;
  }
  assert.equal(validateConfig(legacy).chores.dashboard_path, undefined);
});

test("rejects unsafe ChoreOps dashboard paths and malformed progress arrays", () => {
  for (const dashboardPath of ["https://example.invalid/choreops", "/choreops/../config", "/choreops?admin=1", "//choreops"]) {
    const config = structuredClone(example);
    config.chores.dashboard_path = dashboardPath;
    assert.throws(() => validateConfig(config), /dashboard_path/);
  }

  const wrongDomain = structuredClone(example);
  wrongDomain.chores.users[0].badge_progress_entities = ["binary_sensor.not_progress"];
  assert.throws(() => validateConfig(wrongDomain), /must use the sensor domain/);

  const duplicate = structuredClone(example);
  duplicate.chores.users[0].reward_status_entities.push(duplicate.chores.users[0].reward_status_entities[0]);
  assert.throws(() => validateConfig(duplicate), /must be unique/);

  const multipleFeatured = structuredClone(example);
  multipleFeatured.chores.users[0].achievement_progress_entities.push("sensor.child_one_choreops_achievement_progress_second");
  assert.throws(() => validateConfig(multipleFeatured), /at most one featured sensor/);
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

test("validates the dashboard timezone without ICU locale data", () => {
  const originalDateTimeFormat = Intl.DateTimeFormat;
  Intl.DateTimeFormat = class {
    constructor() {
      throw new Error("Internal error. Icu error.");
    }
  };
  try {
    assert.equal(validateConfig(structuredClone(example)).product.timezone, "Europe/London");
  } finally {
    Intl.DateTimeFormat = originalDateTimeFormat;
  }
});

test("requires every room and light overlay to match its configured floor", () => {
  const room = structuredClone(example);
  delete room.home.default_room;
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

  const extraClub = structuredClone(example);
  extraClub.football.spotlight_team_codes = ["TOT", "AVL", "ARS"];
  assert.throws(() => validateConfig(extraClub), /must contain exactly the two family spotlight clubs/);
});

test("requires one unique Classroom sensor for every child while School is enabled", () => {
  const config = structuredClone(example);
  config.school.classroom_students = [];
  assert.throws(() => validateConfig(config), /must map every child when School is enabled/);

  const missingChild = structuredClone(example);
  missingChild.school.classroom_students.pop();
  assert.throws(() => validateConfig(missingChild), /must map every child.*missing child_two/);

  const sharedSensor = structuredClone(example);
  sharedSensor.school.classroom_students[1].assignments_entity = sharedSensor.school.classroom_students[0].assignments_entity;
  assert.throws(() => validateConfig(sharedSensor), /assignments_entity.*must be unique/);
});

test("accepts a signals-only household camera while its private stream entity is deferred", () => {
  const config = structuredClone(example);
  delete config.entry.cameras[0].entity_id;
  assert.equal(validateConfig(config).entry.cameras[0].motion_entity, "binary_sensor.example_doorbell_motion");
});

test("requires camera start and stop stream controls to be configured as a pair", () => {
  const startOnly = structuredClone(example);
  delete startOnly.entry.cameras[0].stop_stream_entity;
  assert.throws(() => validateConfig(startOnly), /start_stream_entity and stop_stream_entity must be configured together/);

  const stopOnly = structuredClone(example);
  delete stopOnly.entry.cameras[0].start_stream_entity;
  assert.throws(() => validateConfig(stopOnly), /start_stream_entity and stop_stream_entity must be configured together/);
});

test("blocks child and bedroom cameras from the household Security surface", () => {
  const config = structuredClone(example);
  config.entry.cameras[0].id = "child_bedroom";
  config.entry.primary_camera_id = "child_bedroom";
  assert.throws(() => validateConfig(config), /private child or bedroom cameras are never allowed/);
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

  const alarm = withDeferredEntry();
  alarm.entry.alarm_entity = "switch.not_an_alarm";
  assert.throws(() => validateConfig(alarm), /must use the alarm_control_panel domain/);
});

test("rejects unknown fields through the production schema gate", () => {
  const config = structuredClone(example);
  config.rooms[0].invented_control = "switch.unknown";
  assert.throws(() => validateConfig(config), /invented_control: must NOT have additional properties/);
});
