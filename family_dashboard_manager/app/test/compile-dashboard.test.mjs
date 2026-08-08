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
  for (const path of ["lighting", "heating", "entry"]) {
    assert.match(yaml, new RegExp(`path: ${path}[\\s\\S]*?subview: true`));
  }
});

test("uses the qualified calendar, weather, list and media cards", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /custom:daylight-calendar-card/);
  assert.match(yaml, /custom:mediocre-multi-media-player-card/);
  assert.match(yaml, /entity: "weather\.home"/);
  assert.match(yaml, /type: todo-list/);
  assert.match(yaml, /ma_entity_id/);
  assert.match(yaml, /size: large/);
  assert.match(yaml, /rolling_days_agenda: 3/);
  assert.match(yaml, /event_styles:/);
  assert.match(yaml, /event_color_mode: left-tint/);
  assert.match(yaml, /compact_height: true/);
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
  assert.match(yaml, /linear-gradient\(135deg, #14233A 0%, #5D3E5C 48%, #D98B6E 100%\)/);
  assert.match(yaml, /type: custom:grid-layout/);
  assert.match(yaml, /type: custom:layout-card/);
  assert.match(yaml, /type: custom:button-card/);
  assert.match(yaml, /border-radius: 20px/);
  assert.match(yaml, /box-shadow: 0 14px 34px rgba\(19, 26, 46, 0\.18\)/);
  assert.match(yaml, /animation: none !important/);
  assert.match(yaml, /transition: none !important/);
  assert.doesNotMatch(yaml, /backdrop-filter|filter: blur|animation-name/);
});

test("provides a bounded responsive fallback without losing the navigation rail", () => {
  const config = structuredClone(example);
  config.display.orientation = "portrait";
  const yaml = compileDashboard(config);
  assert.match(yaml, /"\(max-width: 700px\)":/);
  assert.match(yaml, /grid-template-columns: "56px minmax\(0, 1fr\)"/);
  assert.match(yaml, /navigation_path: "\/family-dashboard\/today"/);
});

test("uses native touch controls for home devices", () => {
  const yaml = compileDashboard(example);
  assert.match(yaml, /type: light-brightness/);
  assert.match(yaml, /type: thermostat/);
  assert.match(yaml, /type: cover-open-close/);
  assert.match(yaml, /navigation_path: "\/family-dashboard\/lighting"/);
  assert.match(yaml, /navigation_path: "\/family-dashboard\/heating"/);
  assert.match(yaml, /speakers · browse, group and play/);
});

test("uses one live camera and a confirmed hold action for the garage", () => {
  const yaml = compileDashboard(example);
  assert.equal((yaml.match(/camera_view: live/g) || []).length, 1);
  assert.match(yaml, /camera_view: auto/);
  assert.match(yaml, /entity: "camera\.example_doorbell"/);
  assert.match(yaml, /entity: "camera\.example_driveway"/);
  assert.match(yaml, /entity: "binary_sensor\.example_doorbell_person"/);
  assert.match(yaml, /hold_action: \|/);
  assert.match(yaml, /perform_action: opening \? 'cover\.open_cover' : 'cover\.close_cover'/);
  assert.match(yaml, /Check the live driveway view is clear/);
  assert.match(yaml, /confirmation:/);
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
  config.features.entry = false;
  const yaml = compileDashboard(config);
  assert.doesNotMatch(yaml, /type: todo-list/);
  assert.doesNotMatch(yaml, /header_weather_sensor:/);
  assert.doesNotMatch(yaml, /path: entry/);
});

test("output is deterministic", () => {
  assert.equal(compileDashboard(example), compileDashboard(example));
});
