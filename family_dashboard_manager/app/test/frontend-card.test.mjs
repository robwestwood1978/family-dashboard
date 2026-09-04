import test from "node:test";
import assert from "node:assert/strict";
import {
  binarySignalPresentation,
  buildFavouriteClubModels,
  buildControlPolicy,
  cameraControlRoute,
  cameraSessionPresentation,
  cameraStreamPhase,
  classroomAssignmentPresentation,
  createControlledMediaHass,
  deriveRoomState,
  energyCompactPresentation,
  energyFuelPresentation,
  energyOverviewPresentation,
  escapeHtml,
  FamilyHubCard,
  floorplanImageSource,
  floorplanViewBox,
  favouriteDerbyFixture,
  footballFreshness,
  formatClassroomDueDay,
  formatEnergyReading,
  formatPoints,
  heatingPresentation,
  homeHeatingCompactPresentation,
  homeLightingCompactPresentation,
  homeSummaryPresentation,
  isAlarmActionSupported,
  isAllowedCalendarApiRequest,
  isApprovedMediaServiceCall,
  isCameraControlAvailable,
  isCommandEntityAvailable,
  isControlAction,
  isCurrentOrFutureCalendarEvent,
  isEntityAvailable,
  isConfirmationStillValid,
  isReadOnlyChildMessageAllowed,
  isSecureCoverActionAllowed,
  nextFreshnessRefreshDelay,
  isSecureCoverActionSupported,
  normaliseChoreOpsSummary,
  normaliseChoreStatus,
  normaliseFixtureStatus,
  safeClassroomLink,
  selectFavouriteFixture,
  teamCrest,
  todaySecurityPresentation,
  weatherStateLabel
} from "../frontend/family-hub-card.js";

test("escapes state-derived text before rendering it into the card", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
});

test("presents Home Assistant weather states as family-friendly labels", () => {
  assert.equal(weatherStateLabel("partlycloudy"), "Partly cloudy");
  assert.equal(weatherStateLabel("clear-night"), "Clear night");
  assert.equal(weatherStateLabel("lightning-rainy"), "Lightning and rain");
  assert.equal(weatherStateLabel("snowy-rainy"), "Snow and rain");
  assert.equal(weatherStateLabel("windy-variant"), "Windy");
  assert.equal(weatherStateLabel("custom-weather_state"), "Custom Weather State");
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

test("formats smart-meter values without inventing unavailable readings", () => {
  assert.equal(formatEnergyReading({ state: "2.16", attributes: { unit_of_measurement: "GBP" } }, "en-GB", "cost"), "£2.16");
  assert.equal(formatEnergyReading({ state: "8.4", attributes: { unit_of_measurement: "kWh" } }), "8.4 kWh");
  assert.equal(formatEnergyReading({ state: "0.2574", attributes: { unit_of_measurement: "GBP/kWh" } }, "en-GB", "tariff"), "£0.257/kWh");
  assert.equal(formatEnergyReading({ state: "unavailable", attributes: { unit_of_measurement: "kWh" } }), "—");
});

test("labels energy totals as today so far and exposes delayed or partial readings", () => {
  const meter = {
    usage_today_entity: "sensor.example_usage_today",
    cost_today_entity: "sensor.example_cost_today",
    rate_entity: "sensor.example_rate",
    standing_charge_entity: "sensor.example_standing"
  };
  const state = (value, unit, lastUpdated = "2026-08-24T14:04:00.000Z") => ({
    state: String(value),
    attributes: { unit_of_measurement: unit },
    last_updated: lastUpdated
  });
  const currentStates = {
    [meter.usage_today_entity]: state(8.4, "kWh"),
    [meter.cost_today_entity]: state(2.16, "GBP"),
    [meter.rate_entity]: state(0.257, "GBP/kWh"),
    [meter.standing_charge_entity]: state(0.49, "GBP/day")
  };
  const options = {
    locale: "en-GB",
    timeZone: "Europe/London",
    now: new Date("2026-08-24T14:08:00.000Z"),
    staleAfterMinutes: 180
  };
  const current = energyFuelPresentation(meter, currentStates, options);
  assert.equal(current.status, "current");
  assert.equal(current.cost, "£2.16");
  assert.equal(current.usage, "8.4 kWh");
  assert.match(current.freshness, /^Updated /);

  const stale = energyFuelPresentation(meter, {
    ...currentStates,
    [meter.usage_today_entity]: state(8.4, "kWh", "2026-08-24T09:00:00.000Z")
  }, options);
  assert.equal(stale.status, "stale");
  assert.match(stale.freshness, /delayed/);

  const partial = energyFuelPresentation(meter, {
    ...currentStates,
    [meter.cost_today_entity]: state("unavailable", "GBP")
  }, options);
  assert.equal(partial.status, "partial");
  assert.equal(partial.cost, "—");
  assert.equal(partial.freshness, "Partial meter data");

  const oldUsageOnly = energyFuelPresentation(meter, {
    ...currentStates,
    [meter.usage_today_entity]: state(8.4, "kWh", "2026-08-24T09:00:00.000Z"),
    [meter.cost_today_entity]: state("unavailable", "GBP")
  }, options);
  assert.equal(oldUsageOnly.status, "stale");
  assert.match(oldUsageOnly.freshness, /delayed/);

  const oldCostOnly = energyFuelPresentation(meter, {
    ...currentStates,
    [meter.usage_today_entity]: state("unavailable", "kWh"),
    [meter.cost_today_entity]: state(2.16, "GBP", "2026-08-24T09:00:00.000Z")
  }, options);
  assert.equal(oldCostOnly.status, "stale");
  assert.match(oldCostOnly.freshness, /delayed/);

  const unverified = energyFuelPresentation(meter, Object.fromEntries(Object.entries(currentStates).map(([entityId, entityState]) => [
    entityId,
    { state: entityState.state, attributes: entityState.attributes }
  ])), options);
  assert.equal(unverified.status, "unverified");
  assert.equal(unverified.freshness, "Update time unavailable");

  const gasMeter = Object.fromEntries(Object.entries(meter).map(([key, entityId]) => [key, entityId.replace("example", "gas")]));
  const gasStates = Object.fromEntries(Object.entries(currentStates).map(([entityId, entityState]) => [entityId.replace("example", "gas"), entityState]));
  const overview = energyOverviewPresentation({ electricity: meter, gas: gasMeter, stale_after_minutes: 180 }, {
    ...currentStates,
    ...gasStates
  }, options);
  assert.equal(overview.totalCost, "£4.32");
  assert.equal(overview.detail, "Electricity + gas · today so far");

  const delayedOverview = energyOverviewPresentation({ electricity: meter, gas: gasMeter, stale_after_minutes: 180 }, {
    ...currentStates,
    ...gasStates,
    [meter.usage_today_entity]: state(8.4, "kWh", "2026-08-24T09:00:00.000Z")
  }, options);
  assert.equal(delayedOverview.status, "stale");
  assert.equal(delayedOverview.totalCost, "£4.32");
  assert.equal(delayedOverview.detail, "Meter update delayed · totals may be from an earlier period");

  gasStates[gasMeter.cost_today_entity] = state(2.16, "EUR");
  const mixedCurrency = energyOverviewPresentation({ electricity: meter, gas: gasMeter }, {
    ...currentStates,
    ...gasStates
  }, options);
  assert.equal(mixedCurrency.totalCost, "—");
  assert.equal(mixedCurrency.status, "partial");
});

test("keeps compact Energy and zero-device Home summaries honest", () => {
  assert.deepEqual(energyCompactPresentation({ status: "unavailable", totalCost: "—" }), {
    value: "Meters unavailable",
    detail: "Energy · waiting for data"
  });
  assert.deepEqual(energyCompactPresentation({ status: "stale", totalCost: "£4.32" }), {
    value: "Update delayed",
    detail: "Energy · cached totals"
  });
  assert.deepEqual(homeLightingCompactPresentation({ lightCount: 0, availableLights: 0 }), {
    value: "No lights configured",
    detail: "Lighting"
  });
  assert.deepEqual(homeHeatingCompactPresentation({ heatingZones: 0, availableHeatingZones: 0 }), {
    value: "No heating configured",
    detail: "Heating"
  });
});

test("summarises Home by rooms and heating zones instead of double-counting light entities", () => {
  const config = {
    theme: { accent: "#1463E8" },
    rooms: [
      { id: "living", lights: ["light.living_group", "light.living_lamp"], climate: "climate.living", covers: [], media_players: [] },
      { id: "kitchen", lights: ["light.kitchen"], climate: "climate.kitchen", covers: ["cover.kitchen"], media_players: [] },
      { id: "hall", lights: [], covers: [], media_players: [] }
    ]
  };
  const states = {
    "light.living_group": { state: "on", attributes: {} },
    "light.living_lamp": { state: "on", attributes: {} },
    "light.kitchen": { state: "off", attributes: {} },
    "climate.living": { state: "heat", attributes: { current_temperature: 20, hvac_action: "heating" } },
    "climate.kitchen": { state: "heat", attributes: { current_temperature: 18, hvac_action: "idle" } },
    "cover.kitchen": { state: "open", attributes: {} }
  };
  const summary = homeSummaryPresentation(config, states);
  assert.equal(summary.lightsOn, 2);
  assert.equal(summary.roomsLit, 1);
  assert.equal(summary.lightingRooms, 2);
  assert.equal(summary.availableLightingRooms, 2);
  assert.equal(summary.zonesHeating, 1);
  assert.equal(summary.heatingZones, 2);
  assert.equal(summary.availableHeatingZones, 2);
  assert.equal(summary.openCovers, 1);
  assert.equal(summary.coverCount, 1);
  assert.equal(summary.availableCovers, 1);
  assert.equal(summary.averageTemperature, 19);

  const unavailable = homeSummaryPresentation(config, Object.fromEntries(
    Object.keys(states).map((entityId) => [entityId, { state: "unavailable", attributes: {} }])
  ));
  assert.equal(unavailable.roomsLit, 0);
  assert.equal(unavailable.availableLightingRooms, 0);
  assert.equal(unavailable.availableHeatingZones, 0);
  assert.equal(unavailable.openCovers, 0);
  assert.equal(unavailable.availableCovers, 0);
  assert.equal(Number.isNaN(unavailable.averageTemperature), true);
});

test("includes the visible protected garage in Home cover totals even when no room maps it", () => {
  const summary = homeSummaryPresentation({
    features: { entry: true },
    entry: { garage: { cover_entity: "cover.garage" } },
    rooms: [{ lights: [], covers: [], media_players: [], climate: null }]
  }, {
    "cover.garage": { state: "open", attributes: {} }
  });
  assert.equal(summary.coverCount, 1);
  assert.equal(summary.availableCovers, 1);
  assert.equal(summary.openCovers, 1);
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

test("expires protected-action confirmations and rejects state objects that changed away and back", () => {
  const state = { state: "closed", last_changed: "2026-08-24T14:00:00Z" };
  const action = {
    expectedState: "closed",
    expectedStateObject: state,
    expectedLastChanged: state.last_changed,
    createdAt: 1_000
  };
  assert.equal(isConfirmationStillValid(action, state, 30_999), true);
  assert.equal(isConfirmationStillValid(action, state, 31_001), false);
  assert.equal(isConfirmationStillValid(action, { ...state }, 2_000), false);
  state.last_changed = "2026-08-24T14:01:00Z";
  assert.equal(isConfirmationStillValid(action, state, 2_000), false);
});

test("restores full-render focus by control identity rather than a changing matchweek value", () => {
  const card = Object.create(FamilyHubCard.prototype);
  const oldView = { dataset: { currentView: "football" } };
  const active = {
    dataset: { gameweek: "2" },
    tagName: "BUTTON",
    matches: (selector) => selector === 'button, select, a[href], [role="button"][tabindex]'
      || selector === "button[data-gameweek]",
    closest: (selector) => selector === ".hub-view" ? oldView : null,
    getAttribute: (name) => name === "aria-label" ? "Next matchweek" : null,
    classList: { contains: () => false }
  };
  card._pendingConfirmation = null;
  card.shadowRoot = { activeElement: active };

  const descriptor = card._captureRenderFocus();
  assert.equal(descriptor.scope, "view");
  assert.equal(descriptor.gameweekRole, "Next matchweek");
  assert.deepEqual(descriptor.dataset, {});

  let focusOptions = null;
  const replacement = {
    dataset: { gameweek: "3" },
    tagName: "BUTTON",
    disabled: false,
    classList: { contains: () => false },
    getAttribute: (name) => name === "aria-label" ? "Next matchweek" : null,
    focus: (options) => { focusOptions = options; }
  };
  const newView = {
    dataset: { currentView: "football" },
    querySelectorAll: () => [replacement]
  };
  card.shadowRoot = {
    querySelectorAll: (selector) => selector === ".hub-view" ? [newView] : []
  };
  card._restoreRenderFocus(descriptor);
  assert.deepEqual(focusOptions, { preventScroll: true });
});

test("restores first-party ChoreOps and Classroom link focus after a state render", () => {
  for (const { dataset, markerClass } of [
    { dataset: { choreopsLink: "native" }, markerClass: "choreops-link" },
    { dataset: { classroomPerson: "child_one" }, markerClass: null }
  ]) {
    const card = Object.create(FamilyHubCard.prototype);
    const oldView = { dataset: { currentView: "family" } };
    const active = {
      dataset,
      tagName: "A",
      matches: (selector) => selector === 'button, select, a[href], [role="button"][tabindex]',
      closest: (selector) => selector === ".hub-view" ? oldView : null,
      getAttribute: () => null,
      classList: { contains: (className) => className === markerClass }
    };
    card._pendingConfirmation = null;
    card.shadowRoot = { activeElement: active };
    const descriptor = card._captureRenderFocus();
    assert.equal(descriptor.scope, "view");

    let restored = false;
    const replacement = {
      dataset,
      tagName: "A",
      disabled: false,
      classList: { contains: (className) => className === markerClass },
      getAttribute: () => null,
      focus: () => { restored = true; }
    };
    const newView = { dataset: { currentView: "family" }, querySelectorAll: () => [replacement] };
    card.shadowRoot = { querySelectorAll: () => [newView] };
    card._restoreRenderFocus(descriptor);
    assert.equal(restored, true);
  }
});

test("schedules freshness refreshes just after the next minute boundary", () => {
  assert.equal(nextFreshnessRefreshDelay(0), 60_025);
  assert.equal(nextFreshnessRefreshDelay(59_999), 26);
  assert.equal(nextFreshnessRefreshDelay(Number.NaN), 60_000);
});

test("updates the Music clock without rebuilding the embedded player", () => {
  const card = Object.create(FamilyHubCard.prototype);
  const clock = { textContent: "old" };
  let renders = 0;
  card._view = "music";
  card._config = { product: { locale: "en-GB", timezone: "Europe/London" } };
  card.shadowRoot = { querySelector: () => clock };
  card._scheduleRender = () => { renders += 1; };
  card._refreshTimeSensitiveView(new Date("2026-09-04T12:34:00Z"));
  assert.equal(clock.textContent, "13:34");
  assert.equal(renders, 0);
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

  card._hass.states[entityId] = staleIdle;
  assert.equal(await card._waitForCameraStopped(entityId, 140, staleIdle), false);
});

test("tears down promptly and retains a tombstone until an unresolved Start receives a final Stop", async () => {
  let resolveRawStart;
  const rawStart = new Promise((resolve) => { resolveRawStart = resolve; });
  const baseline = { state: "idle" };
  const camera = {
    entity: "camera.front_door",
    startButton: "button.front_start",
    stopButton: "button.front_stop"
  };
  const session = {
    id: "front-door",
    phase: "starting",
    route: { stop: { domain: "button", service: "press", entity: "button.front_stop" } },
    camera,
    writable: true,
    startIssued: true,
    startPromise: Promise.resolve(false),
    startRawPromise: rawStart,
    startRawPending: true
  };
  const card = Object.create(FamilyHubCard.prototype);
  const stopCalls = [];
  let waits = 0;
  card._hass = { states: { "camera.front_door": baseline } };
  card._cameraSession = session;
  card._cameraOperationToken = 4;
  card._cameraBlockedIds = new Map();
  card._pendingCameraStarts = new Map();
  card._cameraStopTimeoutMs = 0;
  card._cameraBlockRetryMs = 10;
  card._controlPolicy = { cameras: new Map([["front-door", camera]]) };
  card._clearCameraStartTimer = () => undefined;
  card._clearCameraFrameTimers = () => undefined;
  card._evictCameraChild = () => undefined;
  card._scheduleRender = () => undefined;
  card._armCameraBlockRetryNotice = () => undefined;
  card._callCameraCommand = async (_id, direction) => {
    stopCalls.push(direction);
    return true;
  };
  card._waitForCameraStopped = async () => {
    waits += 1;
    return waits > 1;
  };

  assert.equal(await card._stopCameraSession(session, 4, { render: false }), false);
  assert.deepEqual(stopCalls, ["stop"]);
  assert.equal(card._cameraSession, null);
  assert.equal(card._pendingCameraStarts.has("front-door"), true);
  assert.equal(card._canRetryBlockedCamera("front-door", Number.MAX_SAFE_INTEGER), false);

  resolveRawStart(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(stopCalls, ["stop", "stop"]);
  assert.equal(card._pendingCameraStarts.size, 0);
  assert.equal(card._cameraBlockedIds.size, 0);
});

test("uses one Stop when Start settled before the live viewer closes", async () => {
  const camera = {
    entity: "camera.front_door",
    startButton: "button.front_start",
    stopButton: "button.front_stop"
  };
  const session = {
    id: "front-door",
    phase: "viewing",
    route: { stop: { domain: "button", service: "press", entity: "button.front_stop" } },
    camera,
    writable: true,
    startIssued: true,
    startPromise: Promise.resolve(true),
    startRawPromise: Promise.resolve(true),
    startRawPending: false
  };
  const card = Object.create(FamilyHubCard.prototype);
  let stopCalls = 0;
  card._hass = { states: { "camera.front_door": { state: "streaming" } } };
  card._cameraSession = session;
  card._cameraOperationToken = 5;
  card._cameraBlockedIds = new Map();
  card._pendingCameraStarts = new Map();
  card._cameraStopTimeoutMs = 0;
  card._controlPolicy = { cameras: new Map([["front-door", camera]]) };
  card._clearCameraStartTimer = () => undefined;
  card._clearCameraFrameTimers = () => undefined;
  card._evictCameraChild = () => undefined;
  card._scheduleRender = () => undefined;
  card._callCameraCommand = async () => { stopCalls += 1; return true; };
  card._waitForCameraStopped = async () => true;

  assert.equal(await card._stopCameraSession(session, 5, { render: false }), true);
  assert.equal(stopCalls, 1);
  assert.equal(card._pendingCameraStarts.size, 0);
});

test("repeats late-start Stop when Start settles during an earlier failed cleanup", async () => {
  let resolveRawStart;
  let resolveFirstStop;
  const rawStart = new Promise((resolve) => { resolveRawStart = resolve; });
  const firstStop = new Promise((resolve) => { resolveFirstStop = resolve; });
  const camera = {
    entity: "camera.front_door",
    startButton: "button.front_start",
    stopButton: "button.front_stop"
  };
  const session = {
    id: "front-door",
    route: { stop: { domain: "button", service: "press", entity: "button.front_stop" } },
    camera,
    startRawPromise: rawStart
  };
  const card = Object.create(FamilyHubCard.prototype);
  const baseline = { state: "idle" };
  const stopCalls = [];
  card._hass = { states: { "camera.front_door": { state: "streaming" } } };
  card._pendingCameraStarts = new Map();
  card._cameraBlockedIds = new Map();
  card._cameraStopTimeoutMs = 0;
  card._cameraBlockRetryMs = 10;
  card._scheduleRender = () => undefined;
  card._armCameraBlockRetryNotice = () => undefined;
  card._waitForCameraStopped = async () => true;
  card._callCameraCommand = async () => {
    stopCalls.push("stop");
    if (stopCalls.length === 1) return firstStop;
    card._hass.states["camera.front_door"] = { state: "idle" };
    return true;
  };
  const tombstone = card._registerPendingCameraStart(session, camera, baseline);
  const earlyCleanup = card._finalizePendingCameraStart("front-door", tombstone);
  resolveRawStart(true);
  await Promise.resolve();
  resolveFirstStop(false);
  await earlyCleanup;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(stopCalls, ["stop", "stop"]);
  assert.equal(card._pendingCameraStarts.size, 0);
  assert.equal(card._cameraBlockedIds.size, 0);
});

test("serializes the real close-path Stop with late Start cleanup", async () => {
  let resolveRawStart;
  let resolveFirstStop;
  const rawStart = new Promise((resolve) => { resolveRawStart = resolve; });
  const firstStop = new Promise((resolve) => { resolveFirstStop = resolve; });
  const camera = {
    entity: "camera.front_door",
    startButton: "button.front_start",
    stopButton: "button.front_stop"
  };
  const session = {
    id: "front-door",
    phase: "starting",
    route: { stop: { domain: "button", service: "press", entity: "button.front_stop" } },
    camera,
    writable: true,
    startIssued: true,
    startPromise: Promise.resolve(false),
    startRawPromise: rawStart,
    startRawPending: true
  };
  const card = Object.create(FamilyHubCard.prototype);
  const baseline = { state: "idle" };
  const stopCalls = [];
  card._hass = { states: { "camera.front_door": baseline } };
  card._cameraSession = session;
  card._cameraOperationToken = 6;
  card._cameraBlockedIds = new Map();
  card._pendingCameraStarts = new Map();
  card._cameraStopTimeoutMs = 0;
  card._cameraBlockRetryMs = 10;
  card._controlPolicy = { cameras: new Map([["front-door", camera]]) };
  card._clearCameraStartTimer = () => undefined;
  card._clearCameraFrameTimers = () => undefined;
  card._evictCameraChild = () => undefined;
  card._scheduleRender = () => undefined;
  card._armCameraBlockRetryNotice = () => undefined;
  card._waitForCameraStopped = async () => true;
  card._callCameraCommand = async () => {
    stopCalls.push("stop");
    if (stopCalls.length === 1) return firstStop;
    card._hass.states["camera.front_door"] = { state: "idle" };
    return true;
  };

  const closing = card._stopCameraSession(session, 6, { render: false });
  await Promise.resolve();
  assert.deepEqual(stopCalls, ["stop"]);
  resolveRawStart(true);
  await Promise.resolve();
  assert.deepEqual(stopCalls, ["stop"]);
  resolveFirstStop(false);
  assert.equal(await closing, true);
  assert.deepEqual(stopCalls, ["stop", "stop"]);
  assert.equal(card._pendingCameraStarts.size, 0);
  assert.equal(card._cameraBlockedIds.size, 0);
});

test("permits a bounded same-camera retry without releasing the global stop-failure interlock", () => {
  const card = Object.create(FamilyHubCard.prototype);
  card._hass = { states: { "camera.front_door": { state: "idle" }, "camera.garage": { state: "idle" } } };
  card._cameraBlockedIds = new Map([["front-door", {
    entity: "camera.front_door",
    baseline: card._hass.states["camera.front_door"],
    retryAt: 1_000
  }]]);
  assert.equal(card._canRetryBlockedCamera("front-door", 999), false);
  assert.equal(card._canRetryBlockedCamera("front-door", 1_000), true);
  assert.equal(card._canRetryBlockedCamera("garage", 2_000), false);
  card._cameraBlockedIds.set("garage", {
    entity: "camera.garage",
    baseline: card._hass.states["camera.garage"],
    retryAt: 1_000
  });
  assert.equal(card._canRetryBlockedCamera("front-door", 2_000), false);
});

test("does not expose a manual camera frame promotion path", () => {
  assert.equal(typeof FamilyHubCard.prototype._revealCameraFrame, "undefined");
});

test("recreates a stalled live viewer only once without restarting the camera", () => {
  const card = Object.create(FamilyHubCard.prototype);
  const session = {
    id: "front-door",
    phase: "buffering",
    token: 7,
    viewerRecoveryAttempted: false,
    slow: true
  };
  const calls = [];
  card._cameraSession = session;
  card._cameraOperationToken = 7;
  card._view = "entry";
  card._hass = { states: { "camera.front_door": { state: "streaming" } } };
  card._controlPolicy = { cameras: new Map([["front-door", { entity: "camera.front_door" }]]) };
  card._clearCameraFrameTimers = () => calls.push("clear");
  card._evictCameraChild = (cameraId) => calls.push(`evict:${cameraId}`);
  card._armCameraFrameTimers = (activeSession) => calls.push(activeSession === session ? "arm" : "wrong-session");
  card._scheduleRender = () => calls.push("render");

  assert.equal(card._recoverCameraViewer(session), true);
  assert.equal(session.viewerRecoveryAttempted, true);
  assert.equal(session.slow, false);
  assert.deepEqual(calls, ["clear", "evict:front-door", "arm", "render"]);
  assert.equal(card._recoverCameraViewer(session), false);
  assert.deepEqual(calls, ["clear", "evict:front-door", "arm", "render"]);
});

test("drops the Live camera phase when ready playback stalls", () => {
  const card = Object.create(FamilyHubCard.prototype);
  const child = {};
  const session = { id: "front-door", phase: "viewing", token: 8, viewerRecoveryAttempted: false };
  const calls = [];
  card._cameraSession = session;
  card._cameraOperationToken = 8;
  card._view = "entry";
  card._childCards = new Map([["camera:front-door", child]]);
  card._hass = { states: { "camera.front_door": { state: "streaming" } } };
  card._controlPolicy = { cameras: new Map([["front-door", { entity: "camera.front_door" }]]) };
  card._clearCameraFrameTimers = () => calls.push("clear");
  card._armCameraFrameTimers = () => calls.push("arm");
  card._scheduleRender = () => calls.push("render");

  card._markCameraMediaLost("front-door", 8, child);
  assert.equal(session.phase, "buffering");
  assert.equal(session.slow, true);
  assert.deepEqual(calls, ["clear", "arm", "render"]);
});

test("enforces a hard camera-session expiry", async () => {
  const card = Object.create(FamilyHubCard.prototype);
  const session = { token: 4 };
  card._cameraSession = session;
  card._cameraOperationToken = 4;
  card._cameraExpiryTimer = null;
  card._cameraExpiryMs = 5;
  let closeOptions = null;
  card._closeActiveCamera = (options) => { closeOptions = options; };

  card._armCameraExpiry(session);
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.deepEqual(closeOptions, { message: "Live view closed automatically after two minutes." });
  card._clearCameraExpiryTimer();
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

test("keeps embedded read-only cards behind a default-deny Home Assistant capability facade", async () => {
  const forwarded = [];
  let subscriptionStops = 0;
  const source = {
    connected: true,
    states: {
      "camera.front_door": { state: "idle", attributes: { access_token: "front-only" } },
      "camera.garage": { state: "idle", attributes: { access_token: "must-not-leak" } }
    },
    localize(key) { return key; },
    hassUrl(path) { return `https://home.example${path}`; },
    fetchWithAuth() { forwarded.push("fetchWithAuth"); },
    arbitraryWriteHelper() { forwarded.push("arbitraryWriteHelper"); },
    callService(...args) { forwarded.push(["service", ...args]); },
    callApi(...args) { forwarded.push(["api", ...args]); return Promise.resolve({}); },
    callWS(message) { forwarded.push(["ws", message]); return Promise.resolve({}); },
    connection: {
      socket: { send(message) { forwarded.push(["socket", message]); } },
      sendMessage(message) { forwarded.push(["send", message]); },
      sendMessagePromise(message) { forwarded.push(["sendPromise", message]); return Promise.resolve({}); },
      subscribeMessage(_callback, message) {
        forwarded.push(["subscribe", message]);
        return Promise.resolve(() => { subscriptionStops += 1; });
      },
      close() { forwarded.push("close"); }
    }
  };
  const card = Object.create(FamilyHubCard.prototype);
  card._hass = source;
  card._config = { display: { read_only: false } };
  card._controlPolicy = { cameras: new Map([
    ["front-door", { entity: "camera.front_door" }],
    ["garage", { entity: "camera.garage" }]
  ]) };
  card._readOnlyHassSource = null;
  card._readOnlyHass = new Map();

  const posterHass = card._hassForChild("camera-poster:stage:front-door");
  const cameraHass = card._hassForChild("camera:front-door");
  assert.equal(posterHass.connected, true);
  assert.equal(typeof posterHass.localize, "function");
  assert.equal(posterHass.fetchWithAuth, undefined);
  assert.equal(posterHass.arbitraryWriteHelper, undefined);
  assert.equal(posterHass.connection.socket, undefined);
  assert.equal(posterHass.connection.close, undefined);
  assert.equal(Object.getPrototypeOf(posterHass), null);
  assert.equal(Object.getPrototypeOf(posterHass.connection), null);
  assert.deepEqual(Object.keys(cameraHass.states), ["camera.front_door"]);
  assert.equal(cameraHass.states["camera.garage"], undefined);

  posterHass.callService("cover", "open_cover", { entity_id: "cover.garage" });
  await posterHass.callApi("POST", "services/cover/open_cover");
  await posterHass.callWS({ type: "lovelace/config/save" });
  posterHass.connection.sendMessage({ type: "config/entity_registry/update" });
  await posterHass.connection.sendMessagePromise({ type: "call_service", domain: "cover", service: "open_cover" });
  await posterHass.connection.subscribeMessage(() => undefined, { type: "lovelace/config/save" });
  await posterHass.callWS({ type: "camera/web_rtc_offer", entity_id: "camera.front_door" });
  await posterHass.callWS({ type: "auth/sign_path", path: "/api/webrtc/ws" });
  await posterHass.callWS({ type: "auth/sign_path", path: "/api/camera_proxy/camera.front_door" });
  await posterHass.callWS({ type: "auth/sign_path", path: "/api/camera_proxy/camera.garage" });
  await cameraHass.callWS({ type: "camera/web_rtc_offer", entity_id: "camera.garage" });
  await cameraHass.callWS({ type: "camera/web_rtc_offer", entity_id: "camera.front_door" });
  await cameraHass.callWS({ type: "camera/stream", entity_id: "camera.garage" });
  await cameraHass.callWS({ type: "camera/stream", entity_id: "camera.front_door" });
  await cameraHass.callWS({ type: "auth/sign_path", path: "/api/camera_proxy/camera.front_door" });
  await cameraHass.callWS({ type: "auth/sign_path", path: "/api/webrtc/ws" });
  await cameraHass.connection.subscribeMessage(() => undefined, { type: "get_config" });
  await posterHass.callApi("GET", "states");
  await cameraHass.callApi("GET", "camera_proxy/camera.garage");
  let readOnlyTypeReads = 0;
  const changingMessage = {};
  Object.defineProperty(changingMessage, "type", {
    enumerable: true,
    get() {
      readOnlyTypeReads += 1;
      return readOnlyTypeReads === 1 ? "get_config" : "call_service";
    }
  });
  cameraHass.connection.sendMessage(changingMessage);
  Object.getOwnPropertyDescriptor(posterHass, "callService").value("lock", "unlock", { entity_id: "lock.front_door" });
  Object.getOwnPropertyDescriptor(posterHass, "connection").value.sendMessage({ type: "call_service", domain: "lock", service: "unlock" });

  assert.deepEqual(forwarded, [
    ["ws", { type: "auth/sign_path", path: "/api/camera_proxy/camera.front_door" }],
    ["ws", { type: "camera/web_rtc_offer", entity_id: "camera.front_door" }],
    ["ws", { type: "camera/stream", entity_id: "camera.front_door" }],
    ["ws", { type: "auth/sign_path", path: "/api/camera_proxy/camera.front_door" }],
    ["subscribe", { type: "get_config" }],
    ["send", { type: "get_config" }]
  ]);
  assert.equal(readOnlyTypeReads, 1);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "call_service" }), false);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "lovelace/config/save" }), false);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "get_states" }), false);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "subscribe_entities" }), false);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "render_template", template: "{{ states }}" }), false);
  assert.equal(isReadOnlyChildMessageAllowed({ type: "auth/sign_path", path: "/api/webrtc/ws" }), false);
  assert.equal(isReadOnlyChildMessageAllowed(
    { type: "auth/sign_path", path: "/api/webrtc/ws" },
    { cameraEntity: "camera.front_door" }
  ), false);
  assert.equal(isReadOnlyChildMessageAllowed(
    { type: "auth/sign_path", path: "/api/camera_proxy/camera.front_door" },
    { cameraEntity: "camera.front_door" }
  ), true);
  for (const type of [
    "camera/capabilities",
    "camera/get_prefs",
    "camera/stream",
    "camera/web_rtc_offer",
    "camera/webrtc/candidate",
    "camera/webrtc/get_client_config",
    "camera/webrtc/offer"
  ]) {
    assert.equal(isReadOnlyChildMessageAllowed(
      { type, entity_id: "camera.front_door" },
      { cameraEntity: "camera.front_door", allowCameraStream: true }
    ), true);
    assert.equal(isReadOnlyChildMessageAllowed(
      { type, entity_id: "camera.garage" },
      { cameraEntity: "camera.front_door", allowCameraStream: true }
    ), false);
  }
  const forwardedBeforeRevocation = forwarded.length;
  card._invalidateChildHass("camera:front-door");
  await cameraHass.callWS({ type: "camera/stream", entity_id: "camera.front_door" });
  cameraHass.connection.sendMessage({ type: "get_config" });
  assert.equal(cameraHass.connected, undefined);
  assert.deepEqual(Object.keys(cameraHass.states), []);
  assert.equal(subscriptionStops, 1);
  assert.equal(forwarded.length, forwardedBeforeRevocation);
});

test("allows only bounded reads for configured Calendar entities", () => {
  const calendarEntities = new Set(["calendar.family"]);
  const start = "2026-09-01T00:00:00Z";
  const end = "2026-10-01T00:00:00Z";
  assert.equal(isReadOnlyChildMessageAllowed({
    type: "calendar/events",
    entity_id: "calendar.family",
    start_date_time: start,
    end_date_time: end
  }, { calendarEntities }), true);
  assert.equal(isReadOnlyChildMessageAllowed({
    type: "calendar/events",
    entity_id: "calendar.private",
    start_date_time: start,
    end_date_time: end
  }, { calendarEntities }), false);
  assert.equal(isReadOnlyChildMessageAllowed({
    type: "calendar/events",
    entity_id: "calendar.family",
    start_date_time: start,
    end_date_time: "2027-01-15T00:00:00Z"
  }, { calendarEntities }), false);
  assert.equal(isAllowedCalendarApiRequest(
    "GET",
    `calendars/calendar.family?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    calendarEntities
  ), true);
  assert.equal(isAllowedCalendarApiRequest(
    "GET",
    `calendars/calendar.private?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`,
    calendarEntities
  ), false);
  assert.equal(isAllowedCalendarApiRequest("GET", "camera_proxy/camera.private", calendarEntities), false);
});

test("scopes the native Map facade to opted-in location entities and zones", () => {
  const source = {
    states: {
      "person.child_one": { state: "school", attributes: {} },
      "person.private": { state: "home", attributes: {} },
      "zone.home": { state: "1", attributes: {} }
    }
  };
  const card = Object.create(FamilyHubCard.prototype);
  card._hass = source;
  card._config = {
    display: { read_only: false },
    location: { entities: ["person.child_one"] }
  };
  card._controlPolicy = { cameras: new Map() };
  card._readOnlyHassSource = null;
  card._readOnlyHass = new Map();
  card._childHassTokens = new Map();

  const mapHass = card._hassForChild("map");
  assert.deepEqual(Object.keys(mapHass.states).sort(), ["person.child_one", "zone.home"]);
  assert.equal(mapHass.states["person.private"], undefined);
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

test("disabled features remove write authority without downgrading the protected garage", () => {
  const policy = buildControlPolicy({
    features: { rooms: false, music: false, cleaning: false, entry: false, weather: false },
    weather: { entity_id: "weather.home" },
    rooms: [{
      lights: ["light.kitchen"],
      scenes: ["scene.kitchen_bright"],
      media_players: ["media_player.kitchen"],
      covers: ["cover.garage"],
      climate: "climate.kitchen"
    }],
    media: { players: [{ entity_id: "media_player.kitchen" }] },
    cleaning: { vacuum_entity: "vacuum.robovac" },
    entry: {
      alarm_entity: "alarm_control_panel.home",
      garage: { cover_entity: "cover.garage" },
      cameras: [{
        id: "garage",
        entity_id: "camera.garage",
        start_stream_entity: "button.garage_start_stream",
        stop_stream_entity: "button.garage_stop_stream"
      }]
    }
  });

  assert.deepEqual([...policy.lights], []);
  assert.deepEqual([...policy.scenes], []);
  assert.deepEqual([...policy.mediaPlayers], []);
  assert.deepEqual([...policy.covers], []);
  assert.deepEqual([...policy.climates], []);
  assert.deepEqual([...policy.moreInfo], []);
  assert.equal(policy.vacuum, null);
  assert.equal(policy.alarm, null);
  assert.equal(policy.secureCover, "cover.garage");
  assert.equal(policy.cameras.size, 0);

  const summary = homeSummaryPresentation({
    features: { entry: false },
    entry: { garage: { cover_entity: "cover.garage" } },
    rooms: [{ lights: [], covers: ["cover.garage"], media_players: [] }]
  }, { "cover.garage": { state: "open", attributes: {} } });
  assert.equal(summary.coverCount, 0);
  assert.equal(summary.openCovers, 0);
});

test("allows the configured Sonos and Music Assistant services without exposing a generic write bridge", async () => {
  const policy = buildControlPolicy({
    rooms: [],
    media: {
      players: [
        { entity_id: "media_player.kitchen", ma_entity_id: "media_player.kitchen_music_assistant" },
        { entity_id: "media_player.living_room" },
        { entity_id: "media_player.child_one_room" },
        { entity_id: "media_player.child_two_room" },
        { entity_id: "media_player.family_room", ma_entity_id: "media_player.family_room_music_assistant" }
      ]
    }
  });
  for (const entityId of [
    "media_player.kitchen",
    "media_player.living_room",
    "media_player.child_one_room",
    "media_player.child_two_room",
    "media_player.family_room"
  ]) {
    assert.equal(isApprovedMediaServiceCall(policy, "media_player", "media_play_pause", { entity_id: entityId }), true);
  }
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
    states: {
      "media_player.kitchen": { state: "playing", attributes: {} },
      "camera.private": { state: "idle", attributes: { access_token: "must-not-leak" } }
    },
    callService(...args) { calls.push(args); },
    callWS(message) { messages.push(message); return Promise.resolve({}); },
    callApi(method, path) {
      apiCalls.push([method, path]);
      return Promise.resolve([
        { domain: "music_assistant", state: "loaded", entry_id: "ma_loaded" },
        { domain: "music_assistant", state: "not_loaded", entry_id: "ma_not_loaded" },
        { domain: "other", state: "loaded", entry_id: "other_loaded" }
      ]);
    },
    connection: {
      sendMessagePromise(message) { messages.push(message); return Promise.resolve({ response: {} }); }
    }
  };
  const hass = createControlledMediaHass(source, policy);
  assert.deepEqual(Object.keys(hass.states), ["media_player.kitchen"]);
  assert.equal(hass.states["camera.private"], undefined);
  const libraryRequest = {
    type: "call_service",
    domain: "music_assistant",
    service: "get_library",
    service_data: {
      config_entry_id: "ma_loaded",
      favorite: true,
      limit: 20,
      media_type: "playlist"
    },
    return_response: true
  };

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
  await hass.connection.sendMessagePromise(libraryRequest);
  const discoveredEntries = await hass.callApi("GET", "config/config_entries/entry");
  assert.deepEqual(discoveredEntries, [{ domain: "music_assistant", state: "loaded", entry_id: "ma_loaded" }]);
  await hass.connection.sendMessagePromise(libraryRequest);
  await hass.connection.sendMessagePromise({
    ...libraryRequest,
    service_data: { ...libraryRequest.service_data, config_entry_id: "unknown" }
  });
  await hass.connection.sendMessagePromise({
    ...libraryRequest,
    service_data: { ...libraryRequest.service_data, limit: 21 }
  });
  await hass.connection.sendMessagePromise({ ...libraryRequest, return_response: false });
  await hass.connection.sendMessagePromise({
    ...libraryRequest,
    service_data: { ...libraryRequest.service_data, favorite: false }
  });
  await hass.connection.sendMessagePromise({
    ...libraryRequest,
    service_data: { ...libraryRequest.service_data, extra: "not allowed" }
  });
  await hass.callService("music_assistant", "get_library", libraryRequest.service_data);
  await hass.connection.sendMessagePromise({
    type: "call_service",
    domain: "cover",
    service: "open_cover",
    service_data: { entity_id: "cover.garage" }
  });
  await hass.callApi("POST", "services/light/toggle");
  Object.getOwnPropertyDescriptor(hass, "callService").value(
    "lock",
    "unlock",
    { entity_id: "lock.front_door" }
  );
  Object.getOwnPropertyDescriptor(hass, "connection").value.sendMessage({
    type: "call_service",
    domain: "lock",
    service: "unlock"
  });

  assert.deepEqual(calls, [["media_player", "media_play_pause", { entity_id: "media_player.kitchen" }, {}]]);
  assert.deepEqual(messages, [
    { type: "media_player/browse_media", entity_id: "media_player.kitchen" },
    {
      type: "call_service",
      domain: "mass_queue",
      service: "get_queue_items",
      service_data: { entity: "media_player.kitchen_music_assistant" },
      return_response: true
    },
    libraryRequest
  ]);
  assert.deepEqual(apiCalls, [["GET", "config/config_entries/entry"]]);
  assert.equal(Object.getPrototypeOf(hass), null);
  assert.equal(Object.getPrototypeOf(hass.connection), null);
});

test("revokes an issued media facade as soon as Music is left", async () => {
  const calls = [];
  const policy = buildControlPolicy({
    rooms: [],
    media: { players: [{ entity_id: "media_player.kitchen" }] }
  });
  const source = {
    connected: true,
    states: { "media_player.kitchen": { state: "playing", attributes: {} } },
    callService(...args) { calls.push(["service", ...args]); return Promise.resolve(); },
    connection: {
      sendMessage(message) { calls.push(["message", message]); }
    }
  };
  const card = Object.create(FamilyHubCard.prototype);
  card._hass = source;
  card._config = { display: { read_only: false }, features: { music: true } };
  card._controlPolicy = policy;
  card._readOnlyHassSource = null;
  card._readOnlyHass = new Map();
  card._musicHassSource = null;
  card._musicHass = null;
  card._childHassTokens = new Map();
  card._view = "music";
  card._pendingConfirmation = null;
  card._scheduleRender = () => undefined;
  let removed = 0;
  card._childCards = new Map([["music", { remove() { removed += 1; } }]]);

  const hass = card._hassForChild("music");
  await hass.callService("media_player", "media_play_pause", { entity_id: "media_player.kitchen" }, {});
  hass.connection.sendMessage({
    type: "call_service",
    domain: "media_player",
    service: "media_play_pause",
    service_data: { entity_id: "media_player.kitchen" }
  });
  assert.equal(calls.length, 2);

  const target = { dataset: { view: "today" } };
  card._handleClick({ target: { closest: () => target } });
  await hass.callService("media_player", "media_play_pause", { entity_id: "media_player.kitchen" }, {});
  hass.connection.sendMessage({
    type: "call_service",
    domain: "media_player",
    service: "media_play_pause",
    service_data: { entity_id: "media_player.kitchen" }
  });
  assert.equal(card._view, "today");
  assert.equal(card._childCards.has("music"), false);
  assert.equal(removed, 1);
  assert.equal(hass.connected, undefined);
  assert.deepEqual(Object.keys(hass.states), []);
  assert.equal(calls.length, 2);
});

test("does not mint a child facade when an async card mount finishes after disconnect", async () => {
  let resolveHelpers;
  let created = 0;
  const originalHelpers = globalThis.loadCardHelpers;
  globalThis.loadCardHelpers = () => new Promise((resolve) => { resolveHelpers = resolve; });
  const slot = { replaceChildren() {} };
  const card = Object.create(FamilyHubCard.prototype);
  Object.defineProperty(card, "isConnected", { configurable: true, writable: true, value: true });
  card.shadowRoot = {
    getElementById: () => slot,
    removeEventListener() {}
  };
  card._hass = { connected: true, states: {} };
  card._config = { display: { read_only: false }, features: { music: true } };
  card._controlPolicy = buildControlPolicy({ rooms: [], media: { players: [] } });
  card._view = "music";
  card._childCards = new Map();
  card._childHassTokens = new Map();
  card._childMountGeneration = 1;
  card._readOnlyHassSource = null;
  card._readOnlyHass = new Map();
  card._musicHassSource = null;
  card._musicHass = null;
  card._boundClick = () => undefined;
  card._boundChange = () => undefined;
  card._boundKeydown = () => undefined;
  card._boundVisibilityChange = () => undefined;
  card._boundPageHide = () => undefined;
  card._clearFreshnessTimer = () => undefined;
  card._closeActiveCamera = () => undefined;
  card._clearCameraBlockTimer = () => undefined;

  try {
    const mounting = card._ensureChildCard("music", { type: "custom:test" }, "music-card-slot");
    card.isConnected = false;
    card.disconnectedCallback();
    resolveHelpers({
      createCardElement() {
        created += 1;
        return {};
      }
    });
    await mounting;
    assert.equal(created, 0);
    assert.equal(card._childCards.size, 0);
    assert.equal(card._childHassTokens.size, 0);
  } finally {
    if (originalHelpers === undefined) delete globalThis.loadCardHelpers;
    else globalThis.loadCardHelpers = originalHelpers;
  }
});

test("suppresses in-flight child responses after facade revocation", async () => {
  let active = true;
  let resolveWs;
  let resolveConnection;
  const policy = buildControlPolicy({
    rooms: [],
    media: { players: [{ entity_id: "media_player.kitchen" }] }
  });
  const hass = createControlledMediaHass({
    states: { "media_player.kitchen": { state: "playing", attributes: {} } },
    callWS: () => new Promise((resolve) => { resolveWs = resolve; }),
    connection: {
      sendMessagePromise: () => new Promise((resolve) => { resolveConnection = resolve; })
    }
  }, policy, () => active);
  const wsResult = hass.callWS({
    type: "media_player/browse_media",
    entity_id: "media_player.kitchen"
  });
  const connectionResult = hass.connection.sendMessagePromise({
    type: "media_player/browse_media",
    entity_id: "media_player.kitchen"
  });
  active = false;
  resolveWs({ stale: "ws" });
  resolveConnection({ stale: "connection" });
  assert.equal(await wsResult, undefined);
  assert.equal(await connectionResult, undefined);
});

test("unsubscribes when a child facade is revoked before subscription registration finishes", async () => {
  let active = true;
  let resolveSubscription;
  let stops = 0;
  const policy = buildControlPolicy({
    rooms: [],
    media: { players: [{ entity_id: "media_player.kitchen" }] }
  });
  const hass = createControlledMediaHass({
    states: { "media_player.kitchen": { state: "playing", attributes: {} } },
    connection: {
      subscribeMessage: () => new Promise((resolve) => { resolveSubscription = resolve; })
    }
  }, policy, () => active);
  const registration = hass.connection.subscribeMessage(
    () => undefined,
    { type: "media_player/browse_media", entity_id: "media_player.kitchen" }
  );
  active = false;
  resolveSubscription(() => { stops += 1; });
  const unsubscribe = await registration;
  assert.equal(stops, 1);
  unsubscribe();
  assert.equal(stops, 1);
});

test("snapshots child-card messages and media service data before authorization", async () => {
  const policy = buildControlPolicy({
    rooms: [],
    media: { players: [{ entity_id: "media_player.kitchen" }] }
  });
  const calls = [];
  const messages = [];
  const source = {
    callService(...args) { calls.push(args); },
    connection: {
      sendMessage(message) { messages.push(message); }
    }
  };
  const hass = createControlledMediaHass(source, policy);
  let entityReads = 0;
  const serviceData = {};
  Object.defineProperty(serviceData, "entity_id", {
    enumerable: true,
    get() {
      entityReads += 1;
      return entityReads === 1 ? "media_player.kitchen" : "media_player.unmapped";
    }
  });
  await hass.callService("media_player", "turn_off", serviceData);

  let typeReads = 0;
  const message = {};
  Object.defineProperty(message, "type", {
    enumerable: true,
    get() {
      typeReads += 1;
      return typeReads === 1 ? "media_player/browse_media" : "call_service";
    }
  });
  Object.defineProperty(message, "entity_id", {
    enumerable: true,
    value: "media_player.kitchen"
  });
  hass.connection.sendMessage(message);

  assert.equal(entityReads, 1);
  assert.equal(typeReads, 1);
  assert.deepEqual(calls, [["media_player", "turn_off", { entity_id: "media_player.kitchen" }, {}]]);
  assert.deepEqual(messages, [{ type: "media_player/browse_media", entity_id: "media_player.kitchen" }]);
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
    availableLights: 2,
    temperature: 20.4,
    targetTemperature: 21,
    playing: "Room speaker",
    openCovers: 1,
    colour: "rgb(255,120,10)"
  });
});

test("does not report unavailable covers as open and keeps closing covers visible", () => {
  const room = {
    lights: [],
    media_players: [],
    covers: ["cover.unavailable", "cover.closed", "cover.closing", "cover.open"],
    climate: null,
    temperature_sensor: null
  };
  const result = deriveRoomState(room, {
    "cover.unavailable": { state: "unavailable", attributes: {} },
    "cover.closed": { state: "closed", attributes: {} },
    "cover.closing": { state: "closing", attributes: {} },
    "cover.open": { state: "open", attributes: {} }
  });
  assert.equal(result.openCovers, 2);
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

test("does not present unavailable room entities as healthy lighting or temperature", () => {
  const room = {
    lights: ["light.available", "light.missing"],
    covers: [],
    media_players: [],
    climate: "climate.room",
    temperature_sensor: "sensor.room_temperature"
  };
  const fallback = deriveRoomState(room, {
    "light.available": { state: "off", attributes: {} },
    "light.missing": { state: "unavailable", attributes: {} },
    "sensor.room_temperature": { state: "unavailable", attributes: {} },
    "climate.room": { state: "heat", attributes: { current_temperature: 19.5, temperature: 21 } }
  });
  assert.equal(fallback.availableLights, 1);
  assert.equal(fallback.lightsOn, 0);
  assert.equal(fallback.temperature, 19.5);

  const unavailable = deriveRoomState(room, {
    "light.available": { state: "unavailable", attributes: {} },
    "light.missing": { state: "unknown", attributes: {} },
    "sensor.room_temperature": { state: "unavailable", attributes: {} },
    "climate.room": { state: "unavailable", attributes: { current_temperature: 24, temperature: 25 } }
  });
  assert.equal(unavailable.availableLights, 0);
  assert.equal(Number.isNaN(unavailable.temperature), true);
  assert.equal(Number.isNaN(unavailable.targetTemperature), true);
});

test("requires a coherent bounded Classroom assignment payload before declaring it healthy", () => {
  assert.deepEqual(classroomAssignmentPresentation({
    state: "0",
    attributes: { assignments: [], assignments_truncated: false }
  }), { available: true, assignments: [], count: 0, truncated: false, stale: false });
  assert.equal(classroomAssignmentPresentation({
    state: "2",
    attributes: { assignments: [] }
  }).available, false);
  assert.equal(classroomAssignmentPresentation({
    state: "1",
    attributes: {}
  }).available, false);
  assert.equal(classroomAssignmentPresentation({
    state: "27",
    attributes: { assignments: Array.from({ length: 20 }, (_, id) => ({ id })), assignments_truncated: true }
  }).available, true);
  assert.equal(classroomAssignmentPresentation({
    state: "27",
    attributes: { assignments: [], assignments_truncated: true }
  }).available, false);
  assert.equal(classroomAssignmentPresentation({
    state: "20",
    attributes: { assignments: Array.from({ length: 20 }, (_, id) => ({ id })), assignments_truncated: true }
  }).available, false);
  assert.equal(classroomAssignmentPresentation({
    state: "21",
    attributes: { assignments: Array.from({ length: 21 }, (_, id) => ({ id })), assignments_truncated: false }
  }).available, false);
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

test("selects one deterministic live, nearest upcoming, or latest finished fixture per favourite", () => {
  const fixture = (id, kickoff_time, home, away, status = "upcoming") => ({
    id,
    kickoff_time,
    home: { short_name: home, name: home },
    away: { short_name: away, name: away },
    started: status === "live" || status === "finished",
    finished: status === "finished",
    minutes: status === "live" ? 58 : status === "finished" ? 90 : 0
  });
  const events = [
    fixture(906, "2026-08-24T16:30:00Z", "AVL", "NEW"),
    fixture(901, "2026-08-20T19:00:00Z", "TOT", "BUR", "finished"),
    fixture(902, "2026-08-27T19:00:00Z", "AVL", "CHE"),
    fixture(905, "2026-08-24T14:00:00Z", "TOT", "ARS", "live"),
    fixture(904, "2026-08-22T14:00:00Z", "FUL", "AVL", "finished"),
    fixture(903, "2026-08-25T19:00:00Z", "TOT", "EVE")
  ];
  const rows = [
    { team_id: 1, code: "TOT", name: "Tottenham Hotspur", position: 5, points: 4, goal_difference: 2 },
    { team_id: 2, code: "AVL", name: "Aston Villa", position: 8, points: 3, goal_difference: -1 }
  ];

  for (const input of [events, [...events].reverse()]) {
    const models = buildFavouriteClubModels(input, ["TOT", "AVL"], rows);
    assert.deepEqual(models.map((model) => [model.code, model.fixture?.id, model.status]), [
      ["TOT", 905, "live"],
      ["AVL", 906, "upcoming"]
    ]);
    assert.deepEqual(models.map((model) => model.standing?.position), [5, 8]);
  }

  const emptyModels = buildFavouriteClubModels([], ["tot", "avl"], rows);
  assert.deepEqual(emptyModels.map((model) => [model.code, model.fixture]), [
    ["TOT", null],
    ["AVL", null]
  ]);

  const finishedOnly = [
    fixture(11, "2026-08-20T19:00:00Z", "TOT", "BUR", "finished"),
    fixture(12, "2026-08-22T19:00:00Z", "TOT", "FUL", "finished")
  ];
  assert.equal(selectFavouriteFixture(finishedOnly, "TOT")?.id, 12);

  const tied = [
    fixture(20, "2026-08-25T19:00:00Z", "TOT", "BUR"),
    fixture(3, "2026-08-25T19:00:00Z", "TOT", "FUL")
  ];
  assert.equal(selectFavouriteFixture(tied, "TOT")?.id, 3);
  assert.equal(selectFavouriteFixture(events, "MCI"), null);
});

test("combines a genuine two-favourite head-to-head into one derby fixture", () => {
  const derby = {
    id: 910,
    kickoff_time: "2026-08-24T14:00:00Z",
    started: true,
    finished: false,
    minutes: 67,
    home: { short_name: "TOT", name: "Tottenham Hotspur" },
    away: { short_name: "AVL", name: "Aston Villa" }
  };
  const models = buildFavouriteClubModels([derby], ["TOT", "AVL"]);
  assert.deepEqual(models.map((model) => model.fixture?.id), [910, 910]);
  assert.equal(favouriteDerbyFixture(models), derby);

  const separate = buildFavouriteClubModels([
    derby,
    { ...derby, id: 911, kickoff_time: "2026-08-24T13:00:00Z", home: { short_name: "AVL", name: "Aston Villa" }, away: { short_name: "NEW", name: "Newcastle" } }
  ], ["TOT", "AVL"]);
  assert.equal(favouriteDerbyFixture(separate), null);
});

test("uses the same one-per-club selection for Today and the full Football view", () => {
  const card = Object.create(FamilyHubCard.prototype);
  card._config = {
    product: { locale: "en-GB", timezone: "Europe/London" },
    football: {
      index_entity: "sensor.football",
      gameweek_entity_prefix: "sensor.football_gw_",
      table_entity: "sensor.football_table",
      spotlight_team_codes: ["TOT", "AVL"]
    }
  };
  card._gameweek = null;
  card._footballTab = "fixtures";
  const events = [
    { id: 31, kickoff_time: "2026-08-25T19:00:00Z", started: false, finished: false, minutes: 0, home: { short_name: "TOT", name: "Tottenham Hotspur" }, away: { short_name: "BUR", name: "Burnley" }, spotlight: true },
    { id: 32, kickoff_time: "2026-08-24T14:00:00Z", started: true, finished: false, minutes: 67, home: { short_name: "TOT", name: "Tottenham Hotspur" }, away: { short_name: "ARS", name: "Arsenal" }, home_score: 2, away_score: 1, spotlight: true },
    { id: 33, kickoff_time: "2026-08-24T18:45:00Z", started: false, finished: false, minutes: 0, home: { short_name: "AVL", name: "Aston Villa" }, away: { short_name: "NEW", name: "Newcastle United" }, spotlight: true }
  ];
  const rows = [
    { code: "TOT", name: "Tottenham Hotspur", position: 5, points: 4, goal_difference: 2 },
    { code: "AVL", name: "Aston Villa", position: 8, points: 3, goal_difference: -1 }
  ];
  card._hass = { states: {
    "sensor.football": { state: "1", attributes: { current_gameweek: 1, available_gameweeks: [1], last_checked: "2026-08-24T16:07:00Z", refresh_interval_seconds: 180 } },
    "sensor.football_gw_1": { state: "3", attributes: { events } },
    "sensor.football_table": { state: "TOT", attributes: { rows } }
  } };

  const today = card._featuredFixtures();
  assert.equal(today.title, "Spurs & Villa");
  assert.match(today.html, /data-fixture-id="32" data-favourite-code="TOT"/);
  assert.match(today.html, /data-fixture-id="33" data-favourite-code="AVL"/);
  assert.doesNotMatch(today.html, /data-fixture-id="31"/);

  const football = card._renderFootball();
  assert.match(football, /data-favourite-code="TOT" data-fixture-id="32"/);
  assert.match(football, /data-favourite-code="AVL" data-fixture-id="33"/);
  assert.doesNotMatch(football, /favourite-hero-card[^>]+data-fixture-id="31"/);
  assert.match(football, /data-favourite-code="TOT"[^>]*>.*#5/s);
  assert.match(football, /data-favourite-code="AVL"[^>]*>.*#8/s);
});

test("keeps both family clubs visible and never calls unavailable Football data current", () => {
  const card = Object.create(FamilyHubCard.prototype);
  card._config = {
    product: { locale: "en-GB", timezone: "Europe/London" },
    football: {
      index_entity: "sensor.football",
      gameweek_entity_prefix: "sensor.football_gw_",
      table_entity: "sensor.football_table",
      spotlight_team_codes: ["TOT", "AVL"]
    }
  };
  card._gameweek = null;
  card._footballTab = "fixtures";
  card._hass = { states: {
    "sensor.football": {
      state: "1",
      attributes: {
        current_gameweek: 1,
        available_gameweeks: [1],
        last_checked: new Date().toISOString(),
        refresh_interval_seconds: 180
      }
    },
    "sensor.football_gw_1": { state: "unavailable", attributes: { events: [] } },
    "sensor.football_table": {
      state: "unavailable",
      attributes: { rows: [{ code: "TOT", position: 5, points: 4, goal_difference: 2 }] }
    }
  } };

  const today = card._featuredFixtures();
  assert.match(today.html, /data-favourite-code="TOT"/);
  assert.match(today.html, /data-favourite-code="AVL"/);
  assert.equal((today.html.match(/Fixture data unavailable/g) || []).length, 2);

  const waiting = card._renderFootball();
  assert.match(waiting, /Waiting for fixtures/);
  assert.doesNotMatch(waiting, /Scores up to date|#5/);
  assert.equal((waiting.match(/Fixture data unavailable/g) || []).length, 2);

  card._hass.states["sensor.football"] = { state: "unavailable", attributes: {} };
  const unavailable = card._renderFootball();
  assert.match(unavailable, /Scores unavailable/);
  assert.match(unavailable, /cannot read the football feed/);
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
    data_status: "live",
    poller_status: "healthy",
    last_checked: "2026-08-21T19:07:31Z",
    refresh_interval_seconds: 180
  } }, now).status, "live");
  assert.equal(footballFreshness({ attributes: {
    data_status: "live",
    poller_status: "healthy",
    last_checked: "2026-08-21T19:07:29Z",
    refresh_interval_seconds: 180
  } }, now).status, "stale");
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

test("normalises ChoreOps state sensors into readable job states", () => {
  assert.deepEqual(normaliseChoreStatus({ state: "claimed", attributes: { chore_name: "Brush teeth", default_points: 3 } }, "sensor.child_choreops_chore_status_brush_teeth"), {
    name: "Brush teeth",
    label: "Awaiting approval",
    tone: "waiting",
    points: 3,
    due: null
  });
  assert.equal(normaliseChoreStatus({ state: "overdue", attributes: {} }, "sensor.child_choreops_chore_status_get_dressed").name, "Get Dressed");
});

test("normalises generic ChoreOps reward and progress sensors without assuming actions", () => {
  assert.deepEqual(normaliseChoreOpsSummary({
    state: "available",
    attributes: {
      friendly_name: "Child one (ChoreOps) Reward status - Weekend movie",
      reward_cost: "50"
    }
  }, "sensor.child_one_choreops_reward_status_weekend_movie", "reward"), {
    name: "Weekend movie",
    label: "Available · 50 pts",
    tone: "available",
    icon: "mdi:gift-outline",
    kind: "reward"
  });
  assert.deepEqual(normaliseChoreOpsSummary({
    state: "65",
    attributes: { badge_name: "Starlight", status: "active", unit_of_measurement: "%", overall_progress: 0.65 }
  }, "sensor.child_one_choreops_badge_progress_starlight", "badge"), {
    name: "Starlight",
    label: "65% complete",
    tone: "progress",
    icon: "mdi:medal-outline",
    kind: "badge"
  });
  assert.equal(normaliseChoreOpsSummary({
    state: "active",
    attributes: { badge_name: "Starlight", overall_progress: 0.65 }
  }, "sensor.child_one_choreops_badge_progress_starlight", "badge").label, "65% complete");
  assert.equal(normaliseChoreOpsSummary({
    state: "43",
    attributes: { achievement_name: "Stayed in bed", unit_of_measurement: "%", overall_progress: 0.43 }
  }, "sensor.child_one_choreops_achievement_progress_stayed_in_bed", "achievement").label, "43% complete");
  assert.equal(normaliseChoreOpsSummary({
    state: "0",
    attributes: { achievement_name: "Stayed in bed", unit_of_measurement: "%", awarded: true, raw_progress: 0, target_value: 7 }
  }, "sensor.child_one_choreops_achievement_progress_stayed_in_bed", "achievement").label, "Complete");
  assert.deepEqual(normaliseChoreOpsSummary({
    state: "43",
    attributes: { achievement_name: "Stayed in bed", unit_of_measurement: "%", raw_progress: 3, target_value: 7 }
  }, "sensor.child_one_choreops_achievement_progress_stayed_in_bed", "achievement"), {
    name: "Stayed in bed",
    label: "3 of 7",
    tone: "progress",
    icon: "mdi:trophy-outline",
    kind: "achievement"
  });
  assert.deepEqual(normaliseChoreOpsSummary(undefined, "sensor.child_one_choreops_badge_progress_starlight", "badge"), {
    name: "Starlight",
    label: "Unavailable",
    tone: "unavailable",
    icon: "mdi:medal-outline",
    kind: "badge"
  });
});

test("keeps unauthorised Classroom assignments out of the Family view", () => {
  const card = Object.create(FamilyHubCard.prototype);
  card._config = {
    features: { location_map: false, school: false },
    people: [],
    chores: { users: [] },
    school: {
      classroom_students: [{ person_id: "child_one", assignments_entity: "sensor.family_dashboard_classroom_child_one" }]
    },
    product: { locale: "en-GB", timezone: "Europe/London" }
  };
  card._hass = {
    states: {
      "sensor.family_dashboard_classroom_child_one": {
        state: "1",
        attributes: {
          assignments: [{ title: "Stale private assignment", course: "Example", due_at: "2026-09-05T15:00:00Z" }]
        }
      }
    }
  };

  const html = card._renderFamilyPerson({ id: "child_one", name: "Child one", colour: "#1463E8" });
  assert.match(html, /Classroom ready after consent/);
  assert.doesNotMatch(html, /assignments/);
  assert.doesNotMatch(html, /Stale private assignment|Example/);
});

test("renders the complete Classroom count, bounded feed state, and only safe Classroom links", () => {
  assert.equal(safeClassroomLink("https://classroom.google.com/c/example/a/example"), "https://classroom.google.com/c/example/a/example");
  assert.equal(safeClassroomLink("https://example.com/not-classroom"), null);
  assert.equal(formatClassroomDueDay("2026-09-05", "en-GB", "Europe/London"), "Sat 5 Sept");

  const card = Object.create(FamilyHubCard.prototype);
  card._config = {
    features: { location_map: false, school: true, chores: false },
    chores: { users: [] },
    school: {
      classroom_students: [{ person_id: "child_one", assignments_entity: "sensor.child_one_classroom_open_assignments" }]
    },
    product: { locale: "en-GB", timezone: "Europe/London" }
  };
  card._hass = {
    states: {
      "sensor.child_one_classroom_open_assignments": {
        state: "27",
        attributes: {
          assignments: [{
            title: "Reading",
            course: "English",
            due_at: null,
            alternate_link: "https://classroom.google.com/c/example/a/example"
          }, ...Array.from({ length: 19 }, (_, id) => ({
            title: `Assignment ${id + 2}`,
            course: "Example course",
            due_at: null,
            alternate_link: null
          }))],
          assignments_truncated: true,
          data_stale: false
        }
      }
    }
  };

  const html = card._renderFamilyPerson({ id: "child_one", name: "Child one", colour: "#1463E8" });
  assert.match(html, /<strong>27<\/strong> assignments/);
  assert.match(html, /No due date/);
  assert.match(html, /Showing the next 20 of 27 assignments/);
  assert.match(html, /href="https:\/\/classroom\.google\.com\/c\/example\/a\/example"/);
  assert.doesNotMatch(html, /Today’s jobs|points|due today/);

  card._hass.states["sensor.child_one_classroom_open_assignments"] = {
    state: "0",
    attributes: {
      assignments: [],
      assignments_truncated: false,
      data_stale: true,
      last_error: "Google Classroom is temporarily unavailable",
      last_successful_update: "2026-09-03T07:30:00Z"
    }
  };
  const staleHtml = card._renderFamilyPerson({ id: "child_one", name: "Child one", colour: "#1463E8" });
  assert.match(staleHtml, /Classroom update delayed/);
  assert.match(staleHtml, /Google Classroom is temporarily unavailable/);
  assert.match(staleHtml, /Last updated/);
  assert.doesNotMatch(staleHtml, /Google Classroom is up to date/);
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
