import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileDashboard, getEnabledViewPaths } from "../src/compile-dashboard.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

function embeddedConfig(yaml) {
  const marker = "        config_json: |-\n";
  const start = yaml.indexOf(marker);
  assert.notEqual(start, -1);
  const json = yaml.slice(start + marker.length)
    .split("\n")
    .filter((line) => line.length)
    .map((line) => line.slice(10))
    .join("\n");
  return JSON.parse(json);
}

test("compiles one first-party panel card with internal product navigation", () => {
  const yaml = compileDashboard(example);
  assert.equal((yaml.match(/type: panel/g) || []).length, 1);
  assert.equal((yaml.match(/type: custom:family-hub-card/g) || []).length, 1);
  assert.match(yaml, /path: hub/);
  assert.doesNotMatch(yaml, /path: today|path: home|path: lighting|subview:/);
  assert.deepEqual(getEnabledViewPaths(example), ["today", "calendar", "rooms", "family", "entry", "music", "football"]);
});

test("embeds the complete schema-v6 house, family, school, cleaning and Security contract", () => {
  const config = embeddedConfig(compileDashboard(example));
  assert.equal(config.schema_version, 6);
  assert.deepEqual(config.display, {
    default_view: "today",
    kiosk: true,
    legacy_ios: true,
    orientation: "landscape",
    panel_path: "family-dashboard",
    read_only: false,
    target_height: 834,
    target_width: 1112
  });
  assert.equal(config.floorplan.floors.length, 2);
  assert.ok(config.floorplan.floors.every((floor) => floor.room_hotspots.length > 0));
  assert.deepEqual(config.football.spotlight_team_codes, ["TOT", "AVL"]);
  assert.equal(config.school.classroom_students.length, 2);
  assert.equal(config.cleaning.vacuum_entity, "vacuum.example_robovac");
  assert.equal(config.entry.alarm_entity, "alarm_control_panel.example_home");
  assert.equal(config.entry.cameras.length, 2);
  assert.deepEqual(config.location.entities, [
    "person.example_parent",
    "person.example_child_one",
    "person.example_child_two"
  ]);
});

test("keeps kiosk mode bounded so administrators retain the Home Assistant escape", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /non_admin_settings:\n    kiosk: true/);
  assert.match(yaml, /admin_settings:\n    kiosk: false/);
});

test("keeps Security inside the first-party confirmation boundary", () => {
  const yaml = compileDashboard(example);
  assert.doesNotMatch(yaml, /camera_view:|cover\.open_cover|hold_action:|custom:grid-layout|custom:layout-card|custom:button-card/);
  assert.equal(embeddedConfig(yaml).entry.alarm_entity, "alarm_control_panel.example_home");
  assert.deepEqual(embeddedConfig(yaml).entry.cameras.map((camera) => camera.role), ["doorbell", "driveway"]);
});

test("puts an enabled non-Today default first in the card's navigation contract", () => {
  const config = structuredClone(example);
  config.display.default_view = "rooms";
  assert.deepEqual(getEnabledViewPaths(config), ["rooms", "today", "calendar", "family", "entry", "music", "football"]);
  assert.equal(embeddedConfig(compileDashboard(config)).display.default_view, "rooms");
});

test("omits disabled internal views while always retaining Today", () => {
  const config = structuredClone(example);
  config.features.calendar = false;
  config.features.music = false;
  config.features.football = false;
  config.features.entry = false;
  assert.deepEqual(getEnabledViewPaths(config), ["today", "rooms", "family"]);
});

test("output is deterministic", () => {
  assert.equal(compileDashboard(example), compileDashboard(example));
});
