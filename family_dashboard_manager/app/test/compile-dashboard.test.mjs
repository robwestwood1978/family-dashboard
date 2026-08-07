import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { compileDashboard, getEnabledViewPaths } from "../src/compile-dashboard.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

test("compiles the six enabled product views", () => {
  const yaml = compileDashboard(example);
  for (const path of ["today", "calendar", "home", "music", "chores", "football"]) {
    assert.match(yaml, new RegExp(`path: ${path}`));
  }
  assert.doesNotMatch(yaml, /path: school/);
  assert.deepEqual(getEnabledViewPaths(example), ["today", "calendar", "home", "music", "chores", "football"]);
});

test("uses the qualified calendar, weather, list and media cards", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /custom:daylight-calendar-card/);
  assert.match(yaml, /custom:mediocre-multi-media-player-card/);
  assert.match(yaml, /type: weather-forecast/);
  assert.match(yaml, /type: todo-list/);
  assert.match(yaml, /ma_entity_id/);
  assert.match(yaml, /size: large/);
  assert.match(yaml, /rolling_days_agenda: 3/);
  assert.match(yaml, /event_styles:/);
  assert.match(yaml, /header_weather_sensor:/);
  assert.match(yaml, /enable_event_management: false/);
});

test("protects the parent escape while kiosk mode is enabled", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /non_admin_settings:\n    kiosk: true/);
  assert.match(yaml, /admin_settings:\n    kiosk: false/);
  for (const path of ["today", "calendar", "home", "music", "chores", "football"]) {
    assert.match(yaml, new RegExp(`navigation_path: "/family-dashboard/${path}"`));
  }
});

test("applies the presentation theme and disables motion for legacy iOS", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /color: "#F3F1EC"/);
  assert.match(yaml, /border-radius: 20px/);
  assert.match(yaml, /border: 1px solid rgba\(91, 91, 214, 0\.2\)/);
  assert.match(yaml, /--state-icon-color: #FFFFFF/);
  assert.match(yaml, /animation: none !important/);
  assert.match(yaml, /transition: none !important/);
});

test("wraps footer navigation into three columns in portrait", () => {
  const config = structuredClone(example);
  config.display.orientation = "portrait";
  assert.match(compileDashboard(config), /footer:\n      max_width: 1120[\s\S]*?columns: 3/);
});

test("uses native touch controls for home devices", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /type: light-brightness/);
  assert.match(yaml, /type: target-temperature/);
  assert.match(yaml, /type: cover-open-close/);
});

test("uses the legacy-lite ChoreOps helper profile", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /custom:auto-entities/);
  assert.match(yaml, /chore_helper_eids/);
  assert.match(yaml, /claim_button_eid/);
  assert.match(yaml, /perform_action': 'button\.press'/);
  assert.match(yaml, /All caught up/);
});

test("uses Team Tracker for the football view", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /custom:teamtracker-card/);
  assert.match(yaml, /entity: "sensor\.team_tracker"/);
});

test("puts a non-Today default view first without changing navigation availability", () => {
  const config = structuredClone(example);
  config.display.default_view = "home";
  const yaml = compileDashboard(config);
  assert.deepEqual(getEnabledViewPaths(config), ["home", "today", "calendar", "music", "chores", "football"]);
  assert.ok(yaml.indexOf('title: "Home"') < yaml.indexOf('title: "Today"'));
});

test("omits optional presentation cards when their features are disabled", () => {
  const config = structuredClone(example);
  config.features.weather = false;
  config.features.lists = false;
  const yaml = compileDashboard(config);
  assert.doesNotMatch(yaml, /type: weather-forecast/);
  assert.doesNotMatch(yaml, /type: todo-list/);
  assert.doesNotMatch(yaml, /header_weather_sensor:/);
});

test("output is deterministic", () => {
  assert.equal(compileDashboard(example), compileDashboard(example));
});
