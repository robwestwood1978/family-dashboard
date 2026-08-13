import test from "node:test";
import assert from "node:assert/strict";
import {
  buildControlPolicy,
  createControlledMediaHass,
  deriveRoomState,
  escapeHtml,
  floorplanImageSource,
  floorplanViewBox,
  formatPoints,
  isApprovedMediaServiceCall,
  isControlAction,
  isCurrentOrFutureCalendarEvent,
  normaliseChoreStatus,
  normaliseFixtureStatus
} from "../frontend/family-hub-card.js";

test("escapes state-derived text before rendering it into the card", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("identifies every Home Assistant write action blocked by read-only mode", () => {
  for (const dataset of [
    { toggle: "light.example" },
    { scene: "scene.example" },
    { mediaToggle: "media_player.example" },
    { coverAction: "open_cover" },
    { climateAdjust: "0.5" },
    { climatePower: "turn_off" }
  ]) assert.equal(isControlAction(dataset), true);
  assert.equal(isControlAction({ view: "rooms" }), false);
  assert.equal(isControlAction({ floor: "first" }), false);
});

test("derives the live-control boundary only from configured household entities", () => {
  const policy = buildControlPolicy({
    weather: { entity_id: "weather.home" },
    rooms: [{
      lights: ["light.kitchen"],
      scenes: ["scene.kitchen_bright"],
      media_players: ["media_player.kitchen"],
      covers: ["cover.kitchen_blind"],
      climate: "climate.kitchen"
    }],
    media: {
      players: [{
        entity_id: "media_player.kitchen",
        ma_entity_id: "media_player.kitchen_music_assistant"
      }]
    },
    cleaning: { vacuum_entity: "vacuum.robovac" },
    entry: {
      alarm_entity: "alarm_control_panel.home",
      garage: { cover_entity: "cover.garage" },
      cameras: [{
        id: "doorbell",
        entity_id: "camera.doorbell",
        start_stream_entity: "button.doorbell_start_stream",
        stop_stream_entity: "button.doorbell_stop_stream"
      }]
    }
  });

  assert.deepEqual([...policy.lights], ["light.kitchen"]);
  assert.deepEqual([...policy.scenes], ["scene.kitchen_bright"]);
  assert.deepEqual([...policy.mediaPlayers], ["media_player.kitchen", "media_player.kitchen_music_assistant"]);
  assert.deepEqual([...policy.moreInfo], ["light.kitchen", "weather.home"]);
  assert.equal(policy.vacuum, "vacuum.robovac");
  assert.equal(policy.alarm, "alarm_control_panel.home");
  assert.equal(policy.secureCover, "cover.garage");
  assert.deepEqual(policy.cameras.get("doorbell"), {
    entity: "camera.doorbell",
    startButton: "button.doorbell_start_stream",
    stopButton: "button.doorbell_stop_stream"
  });
});

test("allows the configured Sonos and Music Assistant services without exposing a generic write bridge", async () => {
  const policy = buildControlPolicy({
    rooms: [],
    media: {
      players: [
        { entity_id: "media_player.kitchen", ma_entity_id: "media_player.kitchen_music_assistant" },
        { entity_id: "media_player.living_room" }
      ]
    }
  });
  assert.equal(isApprovedMediaServiceCall(policy, "media_player", "join", {
    entity_id: "media_player.kitchen",
    group_members: ["media_player.living_room"]
  }), true);
  assert.equal(isApprovedMediaServiceCall(policy, "media_player", "join", {
    entity_id: "media_player.kitchen",
    group_members: ["media_player.unmapped"]
  }), false);
  assert.equal(isApprovedMediaServiceCall(
    policy,
    "media_player",
    "media_play",
    { entity_id: "media_player.kitchen" },
    { area_id: "whole_house" }
  ), false);
  assert.equal(isApprovedMediaServiceCall(policy, "light", "toggle", { entity_id: "light.kitchen" }), false);

  const calls = [];
  const messages = [];
  const apiCalls = [];
  const source = {
    states: {},
    callService(...args) { calls.push(args); },
    callWS(message) { messages.push(message); return Promise.resolve({}); },
    callApi(method, path) { apiCalls.push([method, path]); return Promise.resolve([]); },
    connection: {
      sendMessagePromise(message) { messages.push(message); return Promise.resolve({ response: {} }); }
    }
  };
  const hass = createControlledMediaHass(source, policy);

  await hass.callService("media_player", "media_play_pause", { entity_id: "media_player.kitchen" });
  await hass.callService("media_player", "media_play_pause", { entity_id: "media_player.unmapped" });
  await hass.callService("alarm_control_panel", "alarm_disarm", { entity_id: "alarm_control_panel.home" });
  await hass.callWS({ type: "media_player/browse_media", entity_id: "media_player.kitchen" });
  await hass.callWS({ type: "media_player/browse_media", entity_id: "media_player.unmapped" });
  await hass.connection.sendMessagePromise({
    type: "call_service",
    domain: "mass_queue",
    service: "get_queue_items",
    service_data: { entity: "media_player.kitchen_music_assistant" },
    return_response: true
  });
  await hass.connection.sendMessagePromise({
    type: "call_service",
    domain: "cover",
    service: "open_cover",
    service_data: { entity_id: "cover.garage" }
  });
  await hass.callApi("GET", "config/config_entries/entry");
  await hass.callApi("POST", "services/light/toggle");

  assert.deepEqual(calls, [["media_player", "media_play_pause", { entity_id: "media_player.kitchen" }, undefined]]);
  assert.deepEqual(messages, [
    { type: "media_player/browse_media", entity_id: "media_player.kitchen" },
    {
      type: "call_service",
      domain: "mass_queue",
      service: "get_queue_items",
      service_data: { entity: "media_player.kitchen_music_assistant" },
      return_response: true
    }
  ]);
  assert.deepEqual(apiCalls, [["GET", "config/config_entries/entry"]]);
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
    asset_revision: "v0.7.0"
  }), "/local/family-dashboard/private/ground-floor.svg?v=v0.7.0");
});
