import test from "node:test";
import assert from "node:assert/strict";
import { deriveRoomState, escapeHtml, floorplanImageSource, floorplanViewBox, formatPoints, isControlAction, isCurrentOrFutureCalendarEvent, normaliseChoreStatus, normaliseFixtureStatus } from "../frontend/family-hub-card.js";

test("escapes state-derived text before rendering it into the card", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("identifies every Home Assistant write action blocked by read-only mode", () => {
  for (const dataset of [
    { toggle: "light.example" },
    { scene: "scene.example" },
    { mediaToggle: "media_player.example" },
    { coverAction: "open_cover" },
    { climateAdjust: "0.5" }
  ]) assert.equal(isControlAction(dataset), true);
  assert.equal(isControlAction({ view: "rooms" }), false);
  assert.equal(isControlAction({ floor: "first" }), false);
});

test("derives one bounded room summary from Home Assistant state", () => {
  const room = {
    lights: ["light.one", "light.two"],
    covers: ["cover.blind"],
    media_players: ["media_player.room"],
    climate: "climate.room",
    temperature_sensor: "sensor.room_temperature"
  };
  const summary = deriveRoomState(room, {
    "light.one": { entity_id: "light.one", state: "on", attributes: { rgb_color: [255, 120, 10] } },
    "light.two": { entity_id: "light.two", state: "off", attributes: {} },
    "cover.blind": { entity_id: "cover.blind", state: "open", attributes: {} },
    "media_player.room": { entity_id: "media_player.room", state: "playing", attributes: { friendly_name: "Room speaker" } },
    "climate.room": { entity_id: "climate.room", state: "heat", attributes: { current_temperature: 20, temperature: 21 } },
    "sensor.room_temperature": { entity_id: "sensor.room_temperature", state: "20.4", attributes: {} }
  });
  assert.deepEqual(summary, {
    lightsOn: 1,
    totalLights: 2,
    temperature: 20.4,
    targetTemperature: 21,
    playing: "Room speaker",
    openCovers: 1,
    colour: "rgb(255,120,10)"
  });
});

test("does not turn an absent room temperature into a false zero", () => {
  const summary = deriveRoomState({
    lights: [],
    covers: [],
    media_players: [],
    climate: null,
    temperature_sensor: null
  }, {});
  assert.equal(Number.isNaN(summary.temperature), true);
  assert.equal(Number.isNaN(summary.targetTemperature), true);
});

test("keeps Up next on a current or future event instead of yesterday or earlier today", () => {
  const now = new Date("2026-08-12T09:13:00Z");
  assert.equal(isCurrentOrFutureCalendarEvent({
    summary: "Past appointment",
    start: { dateTime: "2026-08-12T05:00:00Z" },
    end: { dateTime: "2026-08-12T06:00:00Z" }
  }, now), false);
  assert.equal(isCurrentOrFutureCalendarEvent({
    summary: "In progress",
    start: { dateTime: "2026-08-12T08:30:00Z" },
    end: { dateTime: "2026-08-12T10:00:00Z" }
  }, now), true);
  assert.equal(isCurrentOrFutureCalendarEvent({
    summary: "Later today",
    start: { dateTime: "2026-08-12T18:15:00+01:00" }
  }, now), true);
  assert.equal(isCurrentOrFutureCalendarEvent({ start: { date: "2026-08-11" } }, now, "Europe/London"), false);
  assert.equal(isCurrentOrFutureCalendarEvent({ start: { date: "2026-08-12" } }, now, "Europe/London"), true);
});

test("removes meaningless trailing zeroes from ChoreOps points", () => {
  assert.equal(formatPoints("35.0"), "35");
  assert.equal(formatPoints("55.5"), "55.5");
  assert.equal(formatPoints("unavailable"), "0");
});

test("crops excess floorplan margin while preserving hotspot alignment", () => {
  assert.equal(floorplanViewBox({
    aspect_ratio: 1.555556,
    room_hotspots: [
      { points: [[13, 17], [87, 17], [87, 79], [13, 79]] }
    ]
  }), "11.5000 9.4286 77.0000 42.8571");
});

test("normalises upcoming, live and finished fixture states", () => {
  assert.equal(normaliseFixtureStatus({ started: false, finished: false, minutes: 0 }), "upcoming");
  assert.equal(normaliseFixtureStatus({ started: true, finished: false, minutes: 23 }), "live");
  assert.equal(normaliseFixtureStatus({ started: true, finished: true, minutes: 90 }), "finished");
});

test("normalises ChoreOps state sensors into readable routine states", () => {
  assert.deepEqual(normaliseChoreStatus({ state: "claimed", attributes: { chore_name: "Brush teeth", default_points: 3 } }, "sensor.child_choreops_chore_status_brush_teeth"), {
    name: "Brush teeth",
    label: "Awaiting approval",
    tone: "waiting",
    points: 3,
    due: null
  });
  assert.equal(normaliseChoreStatus({ state: "overdue", attributes: {} }, "sensor.child_choreops_chore_status_get_dressed").name, "Get Dressed");
});

test("uses the authenticated Home Assistant Eufy map image without persisting it", () => {
  const floor = {
    base_image: "/local/family-dashboard/assets/fallback.svg",
    vacuum_map_entity: "camera.robovac_map"
  };
  const source = floorplanImageSource(floor, {
    "camera.robovac_map": {
      entity_id: "camera.robovac_map",
      state: "idle",
      last_updated: "2026-08-10T20:00:00.000Z",
      attributes: { entity_picture: "/api/camera_proxy/camera.robovac_map?token=example" }
    }
  });
  assert.equal(source, "/api/camera_proxy/camera.robovac_map?token=example&v=2026-08-10T20%3A00%3A00.000Z");
});

test("falls back to the private static plan when the map image is unavailable", () => {
  assert.equal(floorplanImageSource({
    base_image: "/local/family-dashboard/assets/fallback.svg",
    vacuum_map_entity: "camera.robovac_map"
  }), "/local/family-dashboard/assets/fallback.svg");
});

test("cache-busts a revised private floorplan without changing its approved file path", () => {
  assert.equal(floorplanImageSource({
    base_image: "/local/family-dashboard/private/ground-floor.svg",
    asset_revision: "v0.5.3"
  }), "/local/family-dashboard/private/ground-floor.svg?v=v0.5.3");
});
