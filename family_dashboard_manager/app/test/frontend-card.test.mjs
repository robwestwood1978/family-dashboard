import test from "node:test";
import assert from "node:assert/strict";
import {
  binarySignalPresentation,
  buildControlPolicy,
  cameraControlRoute,
  cameraSessionPresentation,
  cameraStreamPhase,
  createControlledMediaHass,
  deriveRoomState,
  escapeHtml,
  FamilyHubCard,
  floorplanImageSource,
  floorplanViewBox,
  footballFreshness,
  formatPoints,
  heatingPresentation,
  isAlarmActionSupported,
  isApprovedMediaServiceCall,
  isCameraControlAvailable,
  isCommandEntityAvailable,
  isControlAction,
  isCurrentOrFutureCalendarEvent,
  isEntityAvailable,
  isSecureCoverActionAllowed,
  isSecureCoverActionSupported,
  normaliseChoreStatus,
  normaliseFixtureStatus,
  teamCrest,
  todaySecurityPresentation
} from "../frontend/family-hub-card.js";

test("escapes state-derived text before rendering it into the card", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("allows only the exact Premier League crest contract", () => {
  const validCrest = "https://resources.premierleague.com/premierleague/badges/70/t6.png";
  assert.equal(teamCrest({ crest_url: validCrest }), validCrest);

  for (const crest_url of [
    "http://resources.premierleague.com/premierleague/badges/70/t6.png",
    "https://resources.premierleague.com.evil.example/premierleague/badges/70/t6.png",
    "https://resources.premierleague.com/premierleague/badges/70/t0.png",
    "https://resources.premierleague.com/premierleague/badges/70/t06.png",
    "https://resources.premierleague.com/premierleague/badges/70/t6.svg",
    "https://resources.premierleague.com/premierleague/badges/70/t6.png?redirect=https://evil.example",
    "https://resources.premierleague.com/premierleague/badges/70/t6.png#alternate"
  ]) {
    assert.equal(teamCrest({ crest_url }), null);
  }

  for (const legacyField of ["crest", "badge_url", "logo_url"]) {
    assert.equal(teamCrest({ [legacyField]: validCrest }), null);
  }
  assert.equal(teamCrest(null), null);
});

test("presents heating state from the thermostat action without inferring demand from temperatures", () => {
  assert.deepEqual(heatingPresentation(undefined), {
    available: false,
    isOn: false,
    label: "Unavailable",
    tone: "unavailable"
  });
  assert.deepEqual(heatingPresentation({ state: "off", attributes: {} }), {
    available: true,
    isOn: false,
    label: "Off",
    tone: "off"
  });
  assert.deepEqual(heatingPresentation({ state: "heat", attributes: { hvac_action: "heating" } }), {
    available: true,
    isOn: true,
    label: "Heating",
    tone: "heating"
  });
  assert.equal(heatingPresentation({ state: "heat", attributes: { hvac_action: "idle" } }).label, "Idle");
  assert.equal(heatingPresentation({ state: "cool", attributes: { hvac_action: "cooling" } }).label, "Cooling");
  assert.equal(heatingPresentation({ state: "heat_cool", attributes: {} }).label, "Auto");
  assert.equal(heatingPresentation({ state: "heat", attributes: { current_temperature: 12, temperature: 25 } }).label, "On");
});

test("distinguishes unavailable security signals and rejects unavailable or unsupported actions", () => {
  assert.equal(isEntityAvailable({ state: "off" }), true);
  assert.equal(isEntityAvailable({ state: "unavailable" }), false);
  assert.deepEqual(binarySignalPresentation(undefined), { active: false, available: false, label: "Unavailable" });
  assert.deepEqual(binarySignalPresentation({ state: "off" }), { active: false, available: true, label: "Clear" });
  assert.deepEqual(binarySignalPresentation({ state: "on" }), { active: true, available: true, label: "Detected" });

  const fullAlarm = { state: "disarmed", attributes: { supported_features: 63 } };
  assert.equal(isAlarmActionSupported(fullAlarm, "alarm_arm_home"), true);
  assert.equal(isAlarmActionSupported(fullAlarm, "alarm_arm_away"), true);
  assert.equal(isAlarmActionSupported(fullAlarm, "alarm_disarm"), true);
  assert.equal(isAlarmActionSupported({ state: "disarmed", attributes: { supported_features: 1 } }, "alarm_arm_away"), false);
  assert.equal(isAlarmActionSupported({ state: "unavailable", attributes: { supported_features: 63 } }, "alarm_disarm"), false);

  const fullCover = { state: "closed", attributes: { supported_features: 3 } };
  assert.equal(isSecureCoverActionSupported(fullCover, "open_cover"), true);
  assert.equal(isSecureCoverActionSupported(fullCover, "close_cover"), true);
  assert.equal(isSecureCoverActionAllowed(fullCover, "open_cover"), true);
  assert.equal(isSecureCoverActionAllowed(fullCover, "close_cover"), false);
  assert.equal(isSecureCoverActionAllowed({ state: "open", attributes: { supported_features: 3 } }, "close_cover"), true);
  assert.equal(isSecureCoverActionAllowed({ state: "opening", attributes: { supported_features: 3 } }, "close_cover"), false);
  assert.equal(isSecureCoverActionAllowed({ state: "closing", attributes: { supported_features: 3 } }, "open_cover"), false);
  assert.equal(isSecureCoverActionSupported({ state: "unavailable", attributes: { supported_features: 3 } }, "close_cover"), false);

  const camera = {
    entity: "camera.front_door",
    startButton: "button.front_door_start",
    stopButton: "button.front_door_stop"
  };
  assert.equal(isCommandEntityAvailable({ state: "unknown" }), true);
  assert.equal(isCommandEntityAvailable({ state: "unavailable" }), false);
  assert.equal(isCameraControlAvailable(camera, {
    "camera.front_door": { state: "idle" },
    "button.front_door_start": { state: "unknown" },
    "button.front_door_stop": { state: "unknown" }
  }), true);
  assert.equal(isCameraControlAvailable(camera, {
    "camera.front_door": { state: "idle" },
    "button.front_door_start": { state: "unavailable" },
    "button.front_door_stop": { state: "unknown" }
  }), true);
  assert.equal(isCameraControlAvailable({
    entity: "camera.front_door",
    startButton: "button.front_door_start",
    stopButton: null
  }, {
    "camera.front_door": { state: "idle" },
    "button.front_door_start": { state: "unknown" }
  }), false);
  assert.equal(cameraStreamPhase(undefined), "unavailable");
  assert.equal(cameraStreamPhase({ state: "idle" }), "idle");
  assert.equal(cameraStreamPhase({ state: "preparing" }), "preparing");
  assert.equal(cameraStreamPhase({ state: "streaming" }), "streaming");
  assert.equal(cameraStreamPhase({ state: "unknown" }), "unavailable");
  assert.equal(cameraStreamPhase({ state: "recording" }), "unexpected");
  assert.deepEqual(cameraControlRoute(camera, {
    "camera.front_door": { state: "idle" },
    "button.front_door_start": { state: "unavailable" },
    "button.front_door_stop": { state: "unknown" }
  }), {
    start: { domain: "camera", service: "turn_on", entity: "camera.front_door" },
    stop: { domain: "camera", service: "turn_off", entity: "camera.front_door" }
  });
  assert.equal(cameraControlRoute({
    entity: "camera.front_door",
    startButton: "button.front_door_start",
    stopButton: null
  }, {
    "camera.front_door": { state: "idle" },
    "button.front_door_start": { state: "unknown" }
  }), null);
});

test("derives truthful Today Security status with alert, availability, and armed-state precedence", () => {
  const alarm = { state: "disarmed" };
  const garage = { state: "closed" };
  const clearSignals = [{ state: "off" }, { state: "off" }, { state: "off" }];

  assert.equal(todaySecurityPresentation(alarm, garage, clearSignals).title, "Quiet at home");
  assert.equal(todaySecurityPresentation({ state: "armed_home" }, garage, clearSignals).title, "Protected");
  assert.equal(todaySecurityPresentation(alarm, garage, [clearSignals[0], { state: "on" }]).title, "Check home");
  assert.equal(todaySecurityPresentation(alarm, { state: "open" }, clearSignals).title, "Check home");
  assert.equal(todaySecurityPresentation(alarm, { state: "closing" }, clearSignals).title, "Check home");
  assert.equal(todaySecurityPresentation({ state: "triggered" }, { state: "unavailable" }, [undefined]).title, "Check home");
  for (const transition of ["arming", "pending", "disarming"]) {
    const summary = todaySecurityPresentation({ state: transition }, garage, clearSignals);
    assert.equal(summary.title, "Alarm changing");
    assert.notEqual(summary.title, "Quiet at home");
  }
  assert.equal(todaySecurityPresentation({ state: "unexpected" }, garage, clearSignals).title, "Check home");

  const unavailableGarage = todaySecurityPresentation(alarm, { state: "unavailable" }, clearSignals);
  assert.equal(unavailableGarage.title, "Status unavailable");
  assert.match(unavailableGarage.detail, /unavailable/i);
  assert.notEqual(unavailableGarage.title, "Check home");
  assert.equal(todaySecurityPresentation(alarm, undefined, clearSignals).title, "Status unavailable");

  const unavailableSignal = todaySecurityPresentation(alarm, garage, [{ state: "off" }, undefined]);
  assert.equal(unavailableSignal.title, "Status unavailable");
  assert.match(unavailableSignal.detail, /unavailable/i);
});

test("presents wake-up, first-frame buffering, live, and stopping as distinct camera phases", () => {
  assert.deepEqual(cameraSessionPresentation("starting", "idle"), {
    label: "Waking camera…",
    icon: "mdi:progress-clock"
  });
  assert.deepEqual(cameraSessionPresentation("buffering", "streaming"), {
    label: "Loading video…",
    icon: "mdi:progress-clock"
  });
  assert.deepEqual(cameraSessionPresentation("viewing", "streaming"), {
    label: "Live",
    icon: "mdi:record-circle-outline"
  });
  assert.deepEqual(cameraSessionPresentation("stopping", "streaming"), {
    label: "Stopping…",
    icon: "mdi:progress-clock"
  });
  assert.equal(cameraSessionPresentation(null, "idle").label, "Tap to stream");
  assert.equal(cameraSessionPresentation(null, "streaming").label, "Ready to view");
  assert.equal(cameraSessionPresentation(null, "unavailable"), null);
});

test("accepts only idle as a stopped camera state and requires fresh idle when requested", async () => {
  const card = Object.create(FamilyHubCard.prototype);
  const entityId = "camera.front_door";
  card._hass = { states: {} };

  for (const state of [
    undefined,
    { state: "unavailable" },
    { state: "recording" },
    { state: "preparing" },
    { state: "streaming" }
  ]) {
    card._hass.states[entityId] = state;
    assert.equal(await card._waitForCameraStopped(entityId, 0), false);
  }

  const staleIdle = { state: "idle" };
  card._hass.states[entityId] = staleIdle;
  assert.equal(await card._waitForCameraStopped(entityId, 0, staleIdle), false);
  card._hass.states[entityId] = { state: "idle" };
  assert.equal(await card._waitForCameraStopped(entityId, 0, staleIdle), true);
});

test("allows slow-player reveal only for the exact current session token", () => {
  const card = Object.create(FamilyHubCard.prototype);
  const player = {};
  const promotions = [];
  card._cameraSession = { id: "doorbell", token: 7, phase: "buffering", slow: true };
  card._childCards = new Map([["camera:doorbell", player]]);
  card._markCameraFrameReady = (...args) => promotions.push(args);

  card._revealCameraFrame("garage", 7);
  card._revealCameraFrame("doorbell", 6);
  assert.deepEqual(promotions, []);
  card._childCards.clear();
  card._revealCameraFrame("doorbell", 7);
  assert.deepEqual(promotions, []);
  card._childCards.set("camera:doorbell", player);
  card._revealCameraFrame("doorbell", 7);
  assert.deepEqual(promotions, [["doorbell", 7, player]]);
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
  assert.equal(normaliseFixtureStatus({ started: true, finished: false, finished_provisional: true, minutes: 90 }), "finished");
});

test("presents football freshness without exposing provider internals", () => {
  const now = new Date("2026-08-21T19:15:00Z");
  assert.deepEqual(footballFreshness(undefined, now), {
    status: "waiting",
    title: "Waiting for scores",
    detail: "The first football update has not arrived yet."
  });
  assert.deepEqual(footballFreshness({ attributes: {
    data_status: "live",
    poller_status: "healthy",
    last_checked: "2026-08-21T19:12:00Z",
    refresh_interval_seconds: 180
  } }, now), {
    status: "live",
    title: "Scores up to date",
    detail: "Checking every 3 minutes."
  });
  assert.equal(footballFreshness({ attributes: {
    data_status: "cached",
    last_checked: "2026-08-21T19:12:00Z"
  } }, now).status, "cached");
  assert.equal(footballFreshness({ attributes: {
    data_status: "live",
    last_checked: "2026-08-21T18:00:00Z",
    refresh_interval_seconds: 180
  } }, now).status, "stale");
  assert.deepEqual(footballFreshness({ attributes: {
    data_status: "cached",
    poller_status: "degraded",
    last_checked: "2026-08-21T18:00:00Z",
    refresh_interval_seconds: 180
  } }, now), {
    status: "stale",
    title: "Scores may be delayed",
    detail: "The last football check is older than expected."
  });
  assert.deepEqual(footballFreshness({ attributes: {
    data_status: "cached",
    poller_status: "error",
    last_checked: "2026-08-21T19:12:00Z",
    refresh_interval_seconds: 180
  } }, now), {
    status: "stale",
    title: "Scores may be delayed",
    detail: "The latest football check could not complete. Retrying automatically."
  });
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
