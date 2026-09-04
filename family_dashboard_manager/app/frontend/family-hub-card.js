const VIEW_DEFINITIONS = [
  { id: "today", label: "Today", icon: "mdi:home-heart", feature: null },
  { id: "calendar", label: "Calendar", icon: "mdi:calendar-month", feature: "calendar" },
  { id: "rooms", label: "Home", icon: "mdi:floor-plan", feature: "rooms" },
  { id: "family", label: "Family", icon: "mdi:account-group", feature: "family" },
  { id: "entry", label: "Security", icon: "mdi:shield-home", feature: "entry" },
  { id: "music", label: "Music", icon: "mdi:music-circle", feature: "music" },
  { id: "energy", label: "Energy", icon: "mdi:lightning-bolt-circle", feature: "energy" },
  { id: "football", label: "Football", icon: "mdi:soccer", feature: "football" }
];

const ICONS = {
  light: "mdi:lightbulb-outline",
  climate: "mdi:radiator",
  cover: "mdi:blinds-horizontal",
  media: "mdi:speaker",
  scene: "mdi:creation-outline",
  calendar: "mdi:calendar-clock",
  school: "mdi:school-outline",
  chore: "mdi:checkbox-marked-circle-outline",
  vacuum: "mdi:robot-vacuum",
  security: "mdi:shield-home-outline",
  energy: "mdi:lightning-bolt-outline"
};

const htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character]);
}

export function isControlAction(dataset = {}) {
  return Boolean(
    dataset.toggle
    || dataset.scene
    || dataset.mediaToggle
    || dataset.coverAction
    || dataset.climateAdjust
    || dataset.climatePower
    || dataset.vacuumAction
    || dataset.alarmAction
    || dataset.secureCoverAction
  );
}

const COVER_SERVICES = new Set(["open_cover", "stop_cover", "close_cover"]);
const SECURE_COVER_SERVICES = new Set(["open_cover", "close_cover"]);
const VACUUM_SERVICES = new Set(["start", "pause", "return_to_base"]);
const CLIMATE_POWER_SERVICES = new Set(["turn_on", "turn_off"]);
const ALARM_SERVICES = new Set(["alarm_arm_home", "alarm_arm_away", "alarm_disarm"]);
// Eufy RTSP wake-up can legitimately take around 30 seconds on the household hardware.
// Keep a bounded margin so a late successful wake is not stopped at the threshold.
const CAMERA_START_TIMEOUT_MS = 60_000;
const CAMERA_STOP_TIMEOUT_MS = 30_000;
const CAMERA_FIRST_FRAME_TIMEOUT_MS = 45_000;
const CAMERA_SLOW_MESSAGE_MS = 10_000;
const CAMERA_SESSION_EXPIRY_MS = 120_000;
const CONFIRMATION_EXPIRY_MS = 30_000;
const FRESHNESS_REFRESH_MS = 60_000;
const CLASSROOM_ASSIGNMENT_LIMIT = 20;
const MAX_CALENDAR_RANGE_MS = 62 * 86_400_000;
const ALARM_ACTION_LABELS = {
  alarm_arm_home: "Arm home",
  alarm_arm_away: "Arm away",
  alarm_disarm: "Disarm alarm"
};
const MEDIA_PLAYER_SERVICES = new Set([
  "browse_media",
  "clear_playlist",
  "join",
  "media_next_track",
  "media_pause",
  "media_play",
  "media_play_pause",
  "media_previous_track",
  "media_stop",
  "play_media",
  "repeat_set",
  "search_media",
  "select_source",
  "shuffle_set",
  "toggle",
  "turn_off",
  "turn_on",
  "unjoin",
  "volume_down",
  "volume_mute",
  "volume_set",
  "volume_up"
]);
const MUSIC_ASSISTANT_SERVICES = new Set(["get_library", "play_media", "search", "transfer_queue"]);
const MUSIC_ASSISTANT_LIBRARY_MEDIA_TYPES = new Set([
  "album",
  "artist",
  "audiobook",
  "playlist",
  "podcast",
  "radio",
  "track"
]);
const MASS_QUEUE_SERVICES = new Set([
  "get_queue_items",
  "move_queue_item_down",
  "move_queue_item_up",
  "play_queue_item",
  "remove_queue_item"
]);

export function nextFreshnessRefreshDelay(now = Date.now()) {
  const timestamp = Number(now);
  if (!Number.isFinite(timestamp)) return FRESHNESS_REFRESH_MS;
  const remainder = ((timestamp % FRESHNESS_REFRESH_MS) + FRESHNESS_REFRESH_MS) % FRESHNESS_REFRESH_MS;
  return FRESHNESS_REFRESH_MS - remainder + 25;
}

function isBoundedCalendarRange(start, end) {
  const startTime = Date.parse(String(start || ""));
  const endTime = Date.parse(String(end || ""));
  return Number.isFinite(startTime)
    && Number.isFinite(endTime)
    && endTime > startTime
    && endTime - startTime <= MAX_CALENDAR_RANGE_MS;
}

export function isAllowedCalendarApiRequest(method, path, calendarEntities = new Set()) {
  if (String(method || "GET").toUpperCase() !== "GET" || typeof path !== "string" || path.length > 1_000) return false;
  try {
    const request = new URL(path, "https://family-dashboard.invalid/");
    const match = request.pathname.match(/^\/calendars\/([^/]+)$/);
    if (!match || [...request.searchParams.keys()].some((key) => !["start", "end"].includes(key))) return false;
    const entityId = decodeURIComponent(match[1]);
    return calendarEntities.has(entityId)
      && request.searchParams.getAll("start").length === 1
      && request.searchParams.getAll("end").length === 1
      && isBoundedCalendarRange(request.searchParams.get("start"), request.searchParams.get("end"));
  } catch {
    return false;
  }
}

function addEntity(set, value) {
  if (typeof value === "string" && value.includes(".")) set.add(value);
}

function entityList(value) {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((entry) => typeof entry === "string");
  return [];
}

function isConfiguredEntity(value, configuredEntities) {
  const entities = entityList(value);
  return entities.length > 0 && entities.every((entityId) => configuredEntities.has(entityId));
}

const READ_ONLY_CHILD_WS_TYPES = new Set([
  "auth/current_user",
  "config/area_registry/list",
  "config/device_registry/list",
  "config/entity_registry/list",
  "config/floor_registry/list",
  "frontend/get_translations",
  "get_config",
  "get_panels",
  "get_services"
]);

const SAFE_CHILD_HASS_FUNCTIONS = new Set([
  "formatEntityAttributeName",
  "formatEntityAttributeValue",
  "formatEntityName",
  "formatEntityState",
  "hassUrl",
  "loadBackendTranslation",
  "localize"
]);
const SAFE_CHILD_HASS_VALUES = new Set([
  "areas",
  "config",
  "connected",
  "devices",
  "dockedSidebar",
  "entities",
  "floors",
  "language",
  "locale",
  "moreInfoEntityId",
  "panels",
  "resources",
  "selectedLanguage",
  "selectedTheme",
  "services",
  "states",
  "themes",
  "user"
]);
const SAFE_CHILD_CONNECTION_VALUES = new Set(["connected", "haVersion"]);

function snapshotChildObject(value, fallback = null) {
  if (value === undefined || value === null) return fallback;
  try {
    const snapshot = typeof structuredClone === "function"
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
    return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      ? snapshot
      : fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_CHILD_STATES = Object.freeze(Object.create(null));

function guardedChildResult(result, isActive) {
  return Promise.resolve(result).then(
    (value) => isActive() ? value : undefined,
    (error) => {
      if (isActive()) throw error;
      return undefined;
    }
  );
}

function guardedChildConnection(connection, allowMessage, isActive = () => true) {
  if (!connection) return connection;
  const facade = Object.create(null);
  for (const property of SAFE_CHILD_CONNECTION_VALUES) {
    Object.defineProperty(facade, property, {
      enumerable: true,
      get: () => isActive() ? connection[property] : undefined
    });
  }
  facade.sendMessagePromise = (message, ...args) => {
    const snapshot = snapshotChildObject(message);
    return isActive() && snapshot && allowMessage(snapshot)
      ? guardedChildResult(connection.sendMessagePromise?.(snapshot, ...args), isActive)
      : Promise.resolve(undefined);
  };
  facade.sendMessage = (message, ...args) => {
    const snapshot = snapshotChildObject(message);
    return isActive() && snapshot && allowMessage(snapshot)
      ? connection.sendMessage?.(snapshot, ...args)
      : undefined;
  };
  facade.subscribeMessage = (callback, message, ...args) => {
    const snapshot = snapshotChildObject(message);
    const guardedCallback = (...callbackArgs) => {
      if (isActive()) return callback?.(...callbackArgs);
      return undefined;
    };
    if (!isActive() || !snapshot || !allowMessage(snapshot)) return Promise.resolve(() => undefined);
    return Promise.resolve(connection.subscribeMessage?.(guardedCallback, snapshot, ...args)).then(
      (unsubscribe) => {
        const rawStop = typeof unsubscribe === "function" ? unsubscribe : () => undefined;
        let stopped = false;
        const stop = () => {
          if (stopped) return;
          stopped = true;
          rawStop();
        };
        if (!isActive()) {
          stop();
          return () => undefined;
        }
        const unregisterRevocation = isActive.onRevoke?.(stop);
        return () => {
          unregisterRevocation?.();
          stop();
        };
      },
      (error) => {
        if (isActive()) throw error;
        return () => undefined;
      }
    );
  };
  return Object.freeze(facade);
}

function guardedChildHass(source, overrides = {}, isActive = () => true) {
  const facade = Object.create(null);
  for (const property of SAFE_CHILD_HASS_VALUES) {
    if (Object.prototype.hasOwnProperty.call(overrides, property)) continue;
    Object.defineProperty(facade, property, {
      enumerable: true,
      get: () => isActive() ? source[property] : undefined
    });
  }
  for (const property of SAFE_CHILD_HASS_FUNCTIONS) {
    if (typeof source[property] === "function") {
      facade[property] = (...args) => isActive() ? source[property](...args) : undefined;
    }
  }
  for (const [property, value] of Object.entries(overrides)) {
    if (property === "states") {
      Object.defineProperty(facade, property, {
        enumerable: true,
        get: () => isActive() ? value : EMPTY_CHILD_STATES
      });
    } else {
      facade[property] = value;
    }
  }
  return Object.freeze(facade);
}

export function isReadOnlyChildMessageAllowed(message, {
  cameraEntity = null,
  allowCameraStream = false,
  calendarEntities = new Set()
} = {}) {
  if (!message || typeof message !== "object") return false;
  const type = String(message.type || "");
  if (READ_ONLY_CHILD_WS_TYPES.has(type)) return true;
  if (type === "calendar/events") {
    return isConfiguredEntity(message.entity_id, calendarEntities)
      && isBoundedCalendarRange(message.start_date_time, message.end_date_time);
  }
  if (type === "auth/sign_path") {
    return Boolean(cameraEntity)
      && message.expires === undefined
      && message.path === `/api/camera_proxy/${cameraEntity}`;
  }
  if ([
    "camera/capabilities",
    "camera/get_prefs",
    "camera/stream",
    "camera/web_rtc_offer",
    "camera/webrtc/candidate",
    "camera/webrtc/get_client_config",
    "camera/webrtc/offer"
  ].includes(type)) {
    return allowCameraStream
      && Boolean(cameraEntity)
      && isConfiguredEntity(message.entity_id, new Set([cameraEntity]));
  }
  return false;
}

export function isConfirmationStillValid(action, currentState, now = Date.now()) {
  if (!action || !currentState || currentState !== action.expectedStateObject) return false;
  const createdAt = Number(action.createdAt);
  const age = Number(now) - createdAt;
  if (!Number.isFinite(createdAt) || !Number.isFinite(age) || age < 0 || age > CONFIRMATION_EXPIRY_MS) return false;
  if (entityStateValue(currentState) !== action.expectedState) return false;
  return !action.expectedLastChanged || currentState.last_changed === action.expectedLastChanged;
}

export function buildControlPolicy(config = {}) {
  const policy = {
    lights: new Set(),
    scenes: new Set(),
    mediaPlayers: new Set(),
    covers: new Set(),
    climates: new Set(),
    moreInfo: new Set(),
    cameras: new Map(),
    musicAssistantConfigEntries: new Set(),
    vacuum: config.features?.cleaning !== false ? config.cleaning?.vacuum_entity || null : null,
    alarm: config.features?.entry !== false ? config.entry?.alarm_entity || null : null,
    // Keep the garage classified as a protected cover even when Security is hidden.
    // Visibility determines whether actions are offered; it must never downgrade the entity.
    secureCover: config.entry?.garage?.cover_entity || null
  };

  for (const room of config.features?.rooms !== false ? config.rooms || [] : []) {
    for (const entityId of room.lights || []) {
      addEntity(policy.lights, entityId);
      addEntity(policy.moreInfo, entityId);
    }
    for (const entityId of room.scenes || []) addEntity(policy.scenes, entityId);
    if (config.features?.music !== false) {
      for (const entityId of room.media_players || []) addEntity(policy.mediaPlayers, entityId);
    }
    for (const entityId of room.covers || []) addEntity(policy.covers, entityId);
    addEntity(policy.climates, room.climate);
  }

  for (const player of config.features?.music !== false ? config.media?.players || [] : []) {
    addEntity(policy.mediaPlayers, player.entity_id);
    addEntity(policy.mediaPlayers, player.ma_entity_id);
    addEntity(policy.mediaPlayers, player.speaker_group_entity_id);
  }
  if (config.features?.weather !== false) addEntity(policy.moreInfo, config.weather?.entity_id);

  for (const camera of config.features?.entry !== false ? config.entry?.cameras || [] : []) {
    policy.cameras.set(camera.id, {
      entity: camera.entity_id || null,
      startButton: camera.start_stream_entity || null,
      stopButton: camera.stop_stream_entity || null
    });
  }
  return policy;
}

export function isApprovedMediaServiceCall(policy, domain, service, serviceData = {}, target = {}) {
  const data = serviceData && typeof serviceData === "object" ? serviceData : {};
  const serviceTarget = target && typeof target === "object" ? target : {};
  const mediaPlayers = policy?.mediaPlayers || new Set();
  if (["area_id", "device_id", "floor_id", "label_id"].some((key) => serviceTarget[key] !== undefined)) return false;

  if (domain === "media_player") {
    if (!MEDIA_PLAYER_SERVICES.has(service)) return false;
    const entityIds = [...entityList(data.entity_id), ...entityList(serviceTarget.entity_id)];
    if (!isConfiguredEntity(entityIds, mediaPlayers)) return false;
    if (data.group_members !== undefined && !isConfiguredEntity(data.group_members, mediaPlayers)) return false;
    return true;
  }

  if (domain === "music_assistant") {
    if (!MUSIC_ASSISTANT_SERVICES.has(service)) return false;
    if (service === "get_library") {
      const keys = Object.keys(data).sort();
      return keys.length === 4
        && keys.join(",") === "config_entry_id,favorite,limit,media_type"
        && policy?.musicAssistantConfigEntries?.has(data.config_entry_id)
        && MUSIC_ASSISTANT_LIBRARY_MEDIA_TYPES.has(data.media_type)
        && data.favorite === true
        && Number.isInteger(data.limit)
        && data.limit >= 1
        && data.limit <= 20
        && Object.keys(serviceTarget).length === 0;
    }
    if (service === "search") return true;
    const destinationEntities = [
      ...entityList(data.entity_id),
      ...entityList(serviceTarget.entity_id)
    ];
    if (service === "play_media") return isConfiguredEntity(destinationEntities, mediaPlayers);
    return isConfiguredEntity(data.source_player, mediaPlayers)
      && isConfiguredEntity(destinationEntities, mediaPlayers);
  }

  if (domain === "mass_queue") {
    const queueEntities = [
      ...entityList(data.entity),
      ...entityList(data.entity_id),
      ...entityList(serviceTarget.entity_id)
    ];
    return MASS_QUEUE_SERVICES.has(service) && isConfiguredEntity(queueEntities, mediaPlayers);
  }

  return false;
}

function isApprovedMediaMessage(policy, message) {
  if (!message || typeof message !== "object") return false;
  if (message.type === "call_service") {
    if (message.domain === "music_assistant"
      && message.service === "get_library"
      && message.return_response !== true) return false;
    return isApprovedMediaServiceCall(
      policy,
      message.domain,
      message.service,
      message.service_data,
      message.target
    );
  }
  return message.type === "media_player/browse_media"
    && isConfiguredEntity(message.entity_id, policy?.mediaPlayers || new Set());
}

export function createControlledMediaHass(source, policy, isActive = () => true) {
  if (!source) return source;
  const scopedStates = Object.freeze(Object.fromEntries(
    [...(policy?.mediaPlayers || [])]
      .filter((entityId) => source.states?.[entityId])
      .map((entityId) => [entityId, source.states[entityId]])
  ));
  const connection = guardedChildConnection(
    source.connection,
    (message) => isApprovedMediaMessage(policy, message),
    isActive
  );

  return guardedChildHass(source, {
    states: scopedStates,
    callService: (domain, service, data, serviceTarget, ...args) => {
      const safeDomain = String(domain || "");
      const safeService = String(service || "");
      const safeData = snapshotChildObject(data, {});
      const safeTarget = snapshotChildObject(serviceTarget, {});
      // Music Assistant library reads require `return_response: true`, which the
      // generic hass.callService surface cannot express. The embedded card uses
      // the guarded websocket message path for this request.
      if (safeDomain === "music_assistant" && safeService === "get_library") {
        return Promise.resolve(undefined);
      }
      return isActive() && safeData && safeTarget && isApprovedMediaServiceCall(policy, safeDomain, safeService, safeData, safeTarget)
        ? guardedChildResult(source.callService?.(safeDomain, safeService, safeData, safeTarget, ...args), isActive)
        : Promise.resolve(undefined);
    },
    callWS: (message, ...args) => {
      const snapshot = snapshotChildObject(message);
      return isActive() && snapshot && isApprovedMediaMessage(policy, snapshot)
        ? guardedChildResult(source.callWS?.(snapshot, ...args), isActive)
        : Promise.resolve(undefined);
    },
    callApi: async (method, path, ...args) => {
      const safeMethod = String(method || "GET").toUpperCase();
      const safePath = String(path || "");
      if (!isActive() || safeMethod !== "GET" || safePath !== "config/config_entries/entry") return undefined;
      const response = await guardedChildResult(source.callApi?.(safeMethod, safePath, ...args), isActive);
      if (!isActive()) return undefined;
      const entries = (Array.isArray(response) ? response : []).filter((entry) => (
        entry?.domain === "music_assistant"
        && entry?.state === "loaded"
        && typeof entry?.entry_id === "string"
        && /^[a-zA-Z0-9_-]{1,128}$/.test(entry.entry_id)
      ));
      policy.musicAssistantConfigEntries = new Set(entries.map((entry) => entry.entry_id));
      return entries;
    },
    ...(connection ? { connection } : {})
  }, isActive);
}

export function isActiveBinaryState(state) {
  return ["on", "open", "opening", "detected", "ringing", "triggered"].includes(String(state?.state || "").toLowerCase());
}

function entityStateValue(state) {
  return String(state?.state || "").trim().toLowerCase();
}

export function isEntityAvailable(state) {
  const value = entityStateValue(state);
  return Boolean(state) && !["", "unknown", "unavailable"].includes(value);
}

export function isCommandEntityAvailable(state) {
  return Boolean(state) && entityStateValue(state) !== "unavailable";
}

export function isCameraControlAvailable(camera, states = {}) {
  return Boolean(cameraControlRoute(camera, states));
}

export function cameraStreamPhase(state) {
  if (!isEntityAvailable(state)) return "unavailable";
  const value = entityStateValue(state);
  if (value === "idle") return "idle";
  if (value === "streaming") return "streaming";
  if (value === "preparing") return "preparing";
  return "unexpected";
}

export function cameraSessionPresentation(sessionPhase, streamPhase) {
  if (sessionPhase === "starting") return { label: "Waking camera…", icon: "mdi:progress-clock" };
  if (sessionPhase === "buffering") return { label: "Loading video…", icon: "mdi:progress-clock" };
  if (sessionPhase === "viewing") return { label: "Live", icon: "mdi:record-circle-outline" };
  if (sessionPhase === "stopping") return { label: "Stopping…", icon: "mdi:progress-clock" };
  if (streamPhase === "streaming") return { label: "Ready to view", icon: "mdi:gesture-tap-button" };
  if (["idle", "preparing"].includes(streamPhase)) return { label: "Tap to stream", icon: "mdi:gesture-tap-button" };
  return null;
}

export function cameraControlRoute(camera, states = {}) {
  if (!camera?.entity || !isEntityAvailable(states[camera.entity])) return null;
  const hasStartButton = Boolean(camera.startButton);
  const hasStopButton = Boolean(camera.stopButton);
  if (!hasStartButton || !hasStopButton) return null;
  if (isCommandEntityAvailable(states[camera.startButton])
    && isCommandEntityAvailable(states[camera.stopButton])) {
    return {
      start: { domain: "button", service: "press", entity: camera.startButton },
      stop: { domain: "button", service: "press", entity: camera.stopButton }
    };
  }
  return {
    start: { domain: "camera", service: "turn_on", entity: camera.entity },
    stop: { domain: "camera", service: "turn_off", entity: camera.entity }
  };
}

export function binarySignalPresentation(state) {
  if (!isEntityAvailable(state)) return { active: false, available: false, label: "Unavailable" };
  const active = isActiveBinaryState(state);
  return { active, available: true, label: active ? "Detected" : "Clear" };
}

export function todaySecurityPresentation(alarm, garage, entrySignals = []) {
  const alarmState = entityStateValue(alarm);
  const garageState = entityStateValue(garage);
  const armedStates = ["armed_home", "armed_away", "armed_night", "armed_vacation", "armed_custom_bypass"];
  const transitionStates = ["arming", "pending", "disarming"];
  const confirmedAlert = (isEntityAvailable(alarm) && alarmState === "triggered")
    || (isEntityAvailable(garage) && garageState !== "closed")
    || entrySignals.some((signal) => isEntityAvailable(signal) && isActiveBinaryState(signal));
  const allSignalsAvailable = isEntityAvailable(alarm)
    && isEntityAvailable(garage)
    && entrySignals.every(isEntityAvailable);

  if (confirmedAlert) {
    return { title: "Check home", detail: "Activity or an open entry", icon: "mdi:shield-alert-outline" };
  }
  if (!allSignalsAvailable) {
    return { title: "Status unavailable", detail: "Some entry signals are unavailable", icon: "mdi:shield-off-outline" };
  }
  if (armedStates.includes(alarmState)) {
    return { title: "Protected", detail: "Alarm armed · no entry alerts", icon: "mdi:shield-check-outline" };
  }
  if (alarmState === "disarmed") {
    return { title: "Quiet at home", detail: "Alarm off · no entry alerts", icon: "mdi:shield-home-outline" };
  }
  if (transitionStates.includes(alarmState)) {
    return { title: "Alarm changing", detail: "Open Security to check progress", icon: "mdi:shield-sync-outline" };
  }
  return { title: "Check home", detail: "Alarm status needs attention", icon: "mdi:shield-alert-outline" };
}

export function heatingPresentation(state) {
  const climateState = String(state?.state || "").trim().toLowerCase();
  if (!isEntityAvailable(state)) {
    return { available: false, isOn: false, label: "Unavailable", tone: "unavailable" };
  }
  if (climateState === "off") return { available: true, isOn: false, label: "Off", tone: "off" };

  const action = String(state?.attributes?.hvac_action || "").trim().toLowerCase();
  const actions = {
    heating: ["Heating", "heating"],
    idle: ["Idle", "idle"],
    cooling: ["Cooling", "cooling"]
  };
  if (actions[action]) {
    const [label, tone] = actions[action];
    return { available: true, isOn: true, label, tone };
  }
  if (["auto", "heat_cool"].includes(climateState)) {
    return { available: true, isOn: true, label: "Auto", tone: "auto" };
  }
  return { available: true, isOn: true, label: "On", tone: "on" };
}

function numericEntityValue(state) {
  if (!isEntityAvailable(state)) return NaN;
  return safeNumber(state?.state, NaN);
}

function energyUnit(state) {
  return String(state?.attributes?.unit_of_measurement || "").trim();
}

function energyCurrency(state) {
  const unit = energyUnit(state);
  if (/^[A-Z]{3}$/.test(unit)) return unit;
  if (unit === "£") return "GBP";
  return null;
}

function formatDecimal(value, locale, maximumFractionDigits = 2) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits
  }).format(value);
}

export function formatEnergyReading(state, locale = "en-GB", kind = "measurement") {
  const value = numericEntityValue(state);
  if (!Number.isFinite(value)) return "—";
  const unit = energyUnit(state);
  if (kind === "cost") {
    const currency = energyCurrency(state);
    if (currency) {
      try {
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }).format(value);
      } catch {
        // Fall through to the entity's own unit when Home Assistant exposes a non-standard code.
      }
    }
  }
  if (/^GBP\//i.test(unit)) return `£${formatDecimal(value, locale, 3)}/${unit.slice(4)}`;
  if (/^£\//.test(unit)) return `£${formatDecimal(value, locale, 3)}/${unit.slice(2)}`;
  const formatted = formatDecimal(value, locale, kind === "tariff" ? 3 : 2);
  return unit ? `${formatted} ${unit}` : formatted;
}

function energyStateTimestamp(state) {
  const value = Date.parse(state?.last_updated || state?.last_changed || "");
  return Number.isFinite(value) ? value : NaN;
}

function energyFreshness(timestamp, now, locale, timeZone, staleAfterMinutes) {
  if (!Number.isFinite(timestamp)) return { known: false, stale: false, label: "Update time unavailable" };
  const ageMs = Math.max(0, new Date(now).getTime() - timestamp);
  const updated = new Date(timestamp);
  const sameDay = dateKey(updated, timeZone) === dateKey(now, timeZone);
  const stale = !sameDay || ageMs > staleAfterMinutes * 60_000;
  const when = sameDay
    ? formatTime(updated, locale, timeZone)
    : formatDay(updated, locale, timeZone);
  return {
    known: true,
    stale,
    label: stale ? `Last update ${when} · delayed` : `Updated ${when}`
  };
}

export function energyFuelPresentation(
  meter = {},
  states = {},
  { locale = "en-GB", timeZone = "Europe/London", now = new Date(), staleAfterMinutes = 180 } = {}
) {
  const usageState = states[meter.usage_today_entity];
  const costState = states[meter.cost_today_entity];
  const rateState = states[meter.rate_entity];
  const standingChargeState = states[meter.standing_charge_entity];
  const usageValue = numericEntityValue(usageState);
  const costValue = numericEntityValue(costState);
  const rateValue = numericEntityValue(rateState);
  const standingChargeValue = numericEntityValue(standingChargeState);
  const complete = [usageValue, costValue, rateValue, standingChargeValue].every(Number.isFinite);
  const hasData = [usageValue, costValue, rateValue, standingChargeValue].some(Number.isFinite);
  const displayedReadings = [
    [usageValue, usageState],
    [costValue, costState]
  ].filter(([value]) => Number.isFinite(value));
  const knownTimestamps = displayedReadings
    .map(([, state]) => energyStateTimestamp(state))
    .filter(Number.isFinite);
  const oldestKnownTimestamp = knownTimestamps.length ? Math.min(...knownTimestamps) : NaN;
  const oldestKnownFreshness = energyFreshness(oldestKnownTimestamp, now, locale, timeZone, staleAfterMinutes);
  const freshness = oldestKnownFreshness.stale
    ? oldestKnownFreshness
    : knownTimestamps.length === displayedReadings.length && displayedReadings.length > 0
      ? oldestKnownFreshness
      : { known: false, stale: false, label: "Update time unavailable" };
  const timestamp = freshness.known ? oldestKnownTimestamp : NaN;
  const status = !hasData
    ? "unavailable"
    : freshness.known && freshness.stale
      ? "stale"
      : !complete
        ? "partial"
        : !freshness.known
          ? "unverified"
          : "current";
  return {
    status,
    complete,
    costValue,
    costCurrency: energyCurrency(costState),
    cost: formatEnergyReading(costState, locale, "cost"),
    usage: formatEnergyReading(usageState, locale),
    rate: formatEnergyReading(rateState, locale, "tariff"),
    standingCharge: formatEnergyReading(standingChargeState, locale, "tariff"),
    freshness: !hasData
      ? "Awaiting meter data"
      : freshness.known && freshness.stale
        ? freshness.label
        : !complete
          ? "Partial meter data"
          : freshness.label,
    updatedAt: Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
  };
}

export function energyOverviewPresentation(config = {}, states = {}, options = {}) {
  const staleAfterMinutes = safeNumber(config.stale_after_minutes, 180);
  const presentationOptions = { ...options, staleAfterMinutes };
  const electricity = energyFuelPresentation(config.electricity, states, presentationOptions);
  const gas = energyFuelPresentation(config.gas, states, presentationOptions);
  const compatibleCurrency = electricity.costCurrency
    && electricity.costCurrency === gas.costCurrency
    ? electricity.costCurrency
    : null;
  const completeCost = compatibleCurrency
    && Number.isFinite(electricity.costValue)
    && Number.isFinite(gas.costValue);
  const totalCost = completeCost
    ? formatEnergyReading({
      state: electricity.costValue + gas.costValue,
      attributes: { unit_of_measurement: compatibleCurrency }
    }, options.locale || "en-GB", "cost")
    : "—";
  const delayed = [electricity, gas].some((fuel) => fuel.status === "stale");
  const unavailable = [electricity, gas].every((fuel) => fuel.status === "unavailable");
  const partial = !unavailable && (!completeCost || [electricity, gas].some((fuel) => fuel.status === "partial"));
  const unverified = [electricity, gas].some((fuel) => fuel.status === "unverified");
  return {
    electricity,
    gas,
    totalCost,
    status: unavailable ? "unavailable" : delayed ? "stale" : partial ? "partial" : unverified ? "unverified" : "current",
    detail: unavailable
      ? "Waiting for smart-meter data"
      : delayed
        ? "Meter update delayed · totals may be from an earlier period"
      : partial
        ? "Partial meter data · today so far"
        : unverified
          ? "Update time unavailable · today so far"
          : "Electricity + gas · today so far"
  };
}

export function energyCompactPresentation(summary) {
  if (!summary) return null;
  if (summary.status === "unavailable") return { value: "Meters unavailable", detail: "Energy · waiting for data" };
  if (summary.status === "stale") return { value: "Update delayed", detail: "Energy · cached totals" };
  if (summary.status === "unverified") {
    return { value: summary.totalCost === "—" ? "View meters" : summary.totalCost, detail: "Energy · update time unknown" };
  }
  if (summary.status === "partial") {
    return { value: summary.totalCost === "—" ? "View meters" : summary.totalCost, detail: "Energy · partial data" };
  }
  return { value: summary.totalCost === "—" ? "View meters" : summary.totalCost, detail: "Energy · today so far" };
}

export function homeLightingCompactPresentation(summary = {}) {
  if (summary.lightCount === 0) return { value: "No lights configured", detail: "Lighting" };
  if (summary.availableLights === 0) return { value: "Status unavailable", detail: "Lighting" };
  if (summary.availableLights < summary.lightCount) {
    return { value: "Status incomplete", detail: `${summary.availableLights} of ${summary.lightCount} lights reporting` };
  }
  if (summary.roomsLit) {
    return { value: summary.roomsLit, detail: `room${summary.roomsLit === 1 ? "" : "s"} lit` };
  }
  return { value: "All off", detail: "Lighting" };
}

export function homeHeatingCompactPresentation(summary = {}) {
  if (summary.heatingZones === 0) return { value: "No heating configured", detail: "Heating" };
  if (summary.availableHeatingZones === 0) return { value: "Status unavailable", detail: "Heating" };
  if (summary.availableHeatingZones < summary.heatingZones) {
    return { value: "Status incomplete", detail: `${summary.availableHeatingZones} of ${summary.heatingZones} zones reporting` };
  }
  if (summary.zonesHeating) {
    return { value: summary.zonesHeating, detail: `zone${summary.zonesHeating === 1 ? "" : "s"} heating` };
  }
  return { value: formatTemperature(summary.averageTemperature), detail: "Home average" };
}

export function homeSummaryPresentation(config = {}, states = {}) {
  const secureCover = config.entry?.garage?.cover_entity;
  const rooms = (config.rooms || []).map((room) => {
    const summaryRoom = config.features?.entry === false && secureCover
      ? { ...room, covers: (room.covers || []).filter((entityId) => entityId !== secureCover) }
      : room;
    return {
      room: summaryRoom,
      summary: deriveRoomState(summaryRoom, states, config.theme?.accent)
    };
  });
  const temperatures = rooms.map(({ summary }) => summary.temperature).filter(Number.isFinite);
  const heatingRooms = rooms.filter(({ room }) => room.climate);
  const lightingRooms = rooms.filter(({ room }) => room.lights?.length);
  const lights = [...new Set(rooms.flatMap(({ room }) => room.lights || []))];
  const covers = [...new Set(rooms.flatMap(({ room }) => room.covers || []))];
  if (config.features?.entry === true && secureCover && !covers.includes(secureCover)) covers.push(secureCover);
  return {
    roomsLit: rooms.filter(({ summary }) => summary.lightsOn > 0).length,
    lightingRooms: lightingRooms.length,
    lightCount: lights.length,
    availableLights: lights.filter((entityId) => isEntityAvailable(states[entityId])).length,
    availableLightingRooms: lightingRooms.filter(({ room }) => (
      room.lights.some((entityId) => isEntityAvailable(states[entityId]))
    )).length,
    lightsOn: rooms.reduce((total, { summary }) => total + summary.lightsOn, 0),
    zonesHeating: heatingRooms.filter(({ room }) => heatingPresentation(states[room.climate]).tone === "heating").length,
    heatingZones: heatingRooms.length,
    availableHeatingZones: heatingRooms.filter(({ room }) => isEntityAvailable(states[room.climate])).length,
    openCovers: covers.filter((entityId) => (
      isEntityAvailable(states[entityId]) && entityStateValue(states[entityId]) !== "closed"
    )).length,
    coverCount: covers.length,
    availableCovers: covers.filter((entityId) => isEntityAvailable(states[entityId])).length,
    averageTemperature: temperatures.length
      ? temperatures.reduce((total, value) => total + value, 0) / temperatures.length
      : NaN
  };
}

export function isAlarmActionSupported(state, service) {
  if (!isEntityAvailable(state) || !ALARM_SERVICES.has(service)) return false;
  if (service === "alarm_disarm") return true;
  const supportedFeatures = safeNumber(state?.attributes?.supported_features, 0);
  if (service === "alarm_arm_home") return Boolean(supportedFeatures & 1);
  if (service === "alarm_arm_away") return Boolean(supportedFeatures & 2);
  return false;
}

export function isSecureCoverActionSupported(state, service) {
  if (!isEntityAvailable(state) || !SECURE_COVER_SERVICES.has(service)) return false;
  const supportedFeatures = safeNumber(state?.attributes?.supported_features, 0);
  if (service === "open_cover") return Boolean(supportedFeatures & 1);
  if (service === "close_cover") return Boolean(supportedFeatures & 2);
  return false;
}

export function isSecureCoverActionAllowed(state, service) {
  if (!isSecureCoverActionSupported(state, service)) return false;
  const coverState = entityStateValue(state);
  return service === "open_cover" ? coverState === "closed" : coverState === "open";
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTemperature(value) {
  const temperature = Number(value);
  return Number.isFinite(temperature) ? `${temperature.toFixed(temperature % 1 ? 1 : 0)}°` : "—";
}

function formatTime(value, locale = "en-GB", timeZone) {
  if (!value) return "TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

function formatDay(value, locale = "en-GB", timeZone) {
  if (!value) return "Date TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBC";
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone }).format(date);
}

export function formatClassroomDueDay(value, locale = "en-GB", timeZone) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) {
    const date = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return "Date TBC";
    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC"
    }).format(date);
  }
  return formatDay(value, locale, timeZone);
}

function calendarEventStart(event) {
  if (!event) return null;
  if (typeof event.start === "string") return event.start;
  return event.start?.dateTime || event.start?.date || event.start_time || null;
}

function calendarEventEnd(event) {
  if (!event) return null;
  if (typeof event.end === "string") return event.end;
  return event.end?.dateTime || event.end?.date || event.end_time || null;
}

function isAllDayCalendarEvent(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime)
    || /^\d{4}-\d{2}-\d{2}$/.test(String(calendarEventStart(event) || ""));
}

function dateKey(value, timeZone) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isCurrentOrFutureCalendarEvent(event, now = new Date(), timeZone = "Europe/London") {
  const start = calendarEventStart(event);
  if (!start) return false;
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) return false;

  const end = calendarEventEnd(event);
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) return endDate.getTime() > nowDate.getTime();
  }

  if (isAllDayCalendarEvent(event)) {
    return String(start).slice(0, 10) >= dateKey(nowDate, timeZone);
  }

  const startDate = new Date(start);
  return !Number.isNaN(startDate.getTime()) && startDate.getTime() >= nowDate.getTime();
}

export function formatPoints(value, locale = "en-GB") {
  const points = safeNumber(value, NaN);
  if (!Number.isFinite(points)) return "0";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(points);
}

function compactClubName(team = {}) {
  const name = String(team.name || team.short_name || "Team");
  return name
    .replace(/^Brighton (?:&|and) Hove Albion$/i, "Brighton")
    .replace(/^Tottenham Hotspur$/i, "Tottenham")
    .replace(/^Wolverhampton Wanderers$/i, "Wolves")
    .replace(/ United$/i, "");
}

function calendarWindow(locale, timeZone, count = 7, now = new Date()) {
  const today = dateKey(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day, 12);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(base + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      isToday: offset === 0,
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(date),
      month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date)
    };
  });
}

export function normaliseChoreStatus(state, entityId = "") {
  const raw = String(state?.state || "unavailable").toLowerCase();
  const presentations = {
    approved: ["Done", "done"],
    completed: ["Done", "done"],
    completed_by_other: ["Done", "done"],
    claimed: ["Awaiting approval", "waiting"],
    overdue: ["Overdue", "overdue"],
    missed: ["Missed", "missed"],
    pending: ["To do", "todo"],
    due: ["To do", "todo"],
    not_my_turn: ["Not your turn", "standby"],
    waiting: ["Later", "standby"],
    standby: ["Later", "standby"],
    unavailable: ["Unavailable", "unavailable"]
  };
  const [label, tone] = presentations[raw] || [titleCase(raw), "standby"];
  const fallbackName = String(entityId).split("_chore_status_")[1] || String(entityId).split(".")[1] || "Chore";
  return {
    name: state?.attributes?.chore_name || titleCase(fallbackName),
    label,
    tone,
    points: safeNumber(state?.attributes?.default_points, NaN),
    due: state?.attributes?.due_date || state?.attributes?.due_at || null
  };
}

const CHOREOPS_SUMMARY_KINDS = Object.freeze({
  reward: {
    attribute: "reward_name",
    fallback: "Reward",
    icon: "mdi:gift-outline",
    marker: "_choreops_reward_status_"
  },
  badge: {
    attribute: "badge_name",
    fallback: "Badge",
    icon: "mdi:medal-outline",
    marker: "_choreops_badge_progress_"
  },
  achievement: {
    attribute: "achievement_name",
    fallback: "Achievement",
    icon: "mdi:trophy-outline",
    marker: "_choreops_achievement_progress_"
  }
});

function choreOpsSummaryName(state, entityId, kind) {
  const presentation = CHOREOPS_SUMMARY_KINDS[kind];
  const attributes = state?.attributes || {};
  const explicitName = attributes[presentation.attribute] || attributes.name;
  if (typeof explicitName === "string" && explicitName.trim()) return explicitName.trim();

  const friendlyName = typeof attributes.friendly_name === "string" ? attributes.friendly_name.trim() : "";
  if (friendlyName) {
    const stripped = friendlyName
      .replace(/^.*?\(?choreops\)?\s*/i, "")
      .replace(/^(?:reward status|badge progress|achievement progress)\s*[-:]\s*/i, "")
      .trim();
    if (stripped && stripped !== friendlyName) return stripped;
    return friendlyName;
  }

  const entityName = String(entityId || "").split(presentation.marker)[1];
  return entityName ? titleCase(entityName) : presentation.fallback;
}

function firstFiniteNumber(values) {
  for (const value of values) {
    const parsed = safeNumber(value, NaN);
    if (Number.isFinite(parsed)) return parsed;
  }
  return NaN;
}

function percentageFromFraction(value) {
  const number = safeNumber(value, NaN);
  return Number.isFinite(number) && number >= 0 && number <= 1 ? number * 100 : number;
}

export function normaliseChoreOpsSummary(state, entityId = "", kind = "reward") {
  const summaryKind = Object.prototype.hasOwnProperty.call(CHOREOPS_SUMMARY_KINDS, kind) ? kind : "reward";
  const presentation = CHOREOPS_SUMMARY_KINDS[summaryKind];
  const attributes = state?.attributes || {};
  const rawState = entityStateValue(state);
  const status = String(attributes.status || rawState || "unavailable").trim().toLowerCase();
  const available = isEntityAvailable(state);
  const completed = ["approved", "completed", "earned", "redeemed"].includes(status)
    || (summaryKind === "achievement" && attributes.awarded === true);
  let label = "Unavailable";
  let tone = "unavailable";

  if (available && summaryKind === "reward") {
    const labels = {
      approved: "Approved",
      available: "Available",
      claimed: "Claimed",
      completed: "Complete",
      earned: "Earned",
      locked: "Locked",
      pending: "Not ready yet",
      redeemed: "Redeemed"
    };
    const cost = firstFiniteNumber([attributes.reward_cost, attributes.cost, attributes.points_required]);
    label = labels[status] || titleCase(status);
    if (Number.isFinite(cost)) label += ` · ${formatPoints(cost)} pts`;
    tone = completed ? "done" : status === "available" ? "available" : "progress";
  } else if (available && summaryKind === "badge") {
    const rawProgress = safeNumber(rawState, NaN);
    const normalisedOverallProgress = percentageFromFraction(attributes.overall_progress);
    const progress = firstFiniteNumber([
      attributes.unit_of_measurement === "%" ? rawProgress : NaN,
      attributes.percentage,
      attributes.progress,
      normalisedOverallProgress,
      rawProgress
    ]);
    const percentage = Number.isFinite(progress) ? Math.max(0, Math.min(100, progress)) : NaN;
    if (completed || percentage >= 100) {
      label = "Earned";
      tone = "done";
    } else if (Number.isFinite(percentage)) {
      label = `${formatPoints(percentage)}% complete`;
      tone = "progress";
    } else {
      label = titleCase(status);
      tone = "progress";
    }
  } else if (available && summaryKind === "achievement") {
    const current = firstFiniteNumber([
      attributes.current_value,
      attributes.current,
      attributes.progress_value,
      attributes.raw_progress,
      attributes.completed_count
    ]);
    const target = firstFiniteNumber([
      attributes.target_value,
      attributes.target,
      attributes.threshold_value,
      attributes.required_count
    ]);
    const rawProgress = safeNumber(rawState, NaN);
    const percentage = firstFiniteNumber([
      attributes.unit_of_measurement === "%" ? rawProgress : NaN,
      attributes.percentage,
      percentageFromFraction(attributes.overall_progress),
      rawProgress
    ]);
    if (completed || (Number.isFinite(percentage) && percentage >= 100)) {
      label = "Complete";
      tone = "done";
    } else if (Number.isFinite(current) && Number.isFinite(target)) {
      label = `${formatPoints(current)} of ${formatPoints(target)}`;
      tone = "progress";
    } else if (Number.isFinite(percentage)) {
      label = `${formatPoints(Math.max(0, Math.min(100, percentage)))}% complete`;
      tone = "progress";
    } else {
      label = titleCase(status);
      tone = "progress";
    }
  }

  return {
    name: choreOpsSummaryName(state, entityId, summaryKind),
    label,
    tone,
    icon: presentation.icon,
    kind: summaryKind
  };
}

function safeInternalDashboardPath(value) {
  const path = String(value || "");
  return path.length <= 160 && /^\/[a-z0-9][a-z0-9_-]*(?:\/[a-z0-9][a-z0-9_-]*)*$/.test(path) ? path : null;
}

export function safeClassroomLink(value) {
  const link = String(value || "");
  return link.length <= 1_000 && /^https:\/\/classroom\.google\.com\//.test(link) ? link : null;
}

export function classroomAssignmentPresentation(state) {
  const assignments = Array.isArray(state?.attributes?.assignments)
    ? state.attributes.assignments
    : [];
  const count = safeNumber(state?.state, NaN);
  const truncated = state?.attributes?.assignments_truncated === true;
  const countMatchesPayload = Number.isInteger(count)
    && count >= 0
    && assignments.length <= CLASSROOM_ASSIGNMENT_LIMIT
    && (truncated
      ? count > CLASSROOM_ASSIGNMENT_LIMIT && assignments.length === CLASSROOM_ASSIGNMENT_LIMIT
      : count === assignments.length);
  return {
    available: isEntityAvailable(state) && Array.isArray(state?.attributes?.assignments) && countMatchesPayload,
    assignments,
    count,
    truncated,
    stale: state?.attributes?.data_stale === true
  };
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const WEATHER_LABELS = {
  "clear-night": "Clear night",
  cloudy: "Cloudy",
  exceptional: "Exceptional",
  fog: "Fog",
  hail: "Hail",
  lightning: "Lightning",
  "lightning-rainy": "Lightning and rain",
  partlycloudy: "Partly cloudy",
  pouring: "Heavy rain",
  rainy: "Rainy",
  snowy: "Snowy",
  "snowy-rainy": "Snow and rain",
  sunny: "Sunny",
  windy: "Windy",
  "windy-variant": "Windy"
};

export function weatherStateLabel(value) {
  const raw = String(value || "Home").trim().toLowerCase();
  return WEATHER_LABELS[raw] || titleCase(raw.replace(/-/g, " "));
}

function entityName(state, fallback) {
  return state?.attributes?.friendly_name || fallback || state?.entity_id || "Unavailable";
}

function roomTemperature(room, states) {
  const sensor = room.temperature_sensor ? states[room.temperature_sensor] : null;
  if (isEntityAvailable(sensor)) {
    const reading = safeNumber(sensor.state, NaN);
    if (Number.isFinite(reading)) return reading;
  }
  const climate = room.climate ? states[room.climate] : null;
  return isEntityAvailable(climate)
    ? safeNumber(climate?.attributes?.current_temperature, NaN)
    : NaN;
}

function firstPlayingPlayer(config, states) {
  return config.media.players
    .map((player) => ({ player, state: states[player.entity_id] }))
    .find(({ state }) => state && ["playing", "paused"].includes(state.state));
}

function greetingForTime(value = new Date(), timeZone = "Europe/London") {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hourCycle: "h23",
    timeZone
  }).format(value));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const PREMIER_LEAGUE_CREST_URL = /^https:\/\/resources\.premierleague\.com\/premierleague\/badges\/70\/t[1-9]\d*\.png$/;
const FOOTBALL_CLUB_PRESENTATION = Object.freeze({
  TOT: Object.freeze({ label: "Spurs", primary: "#132257", accent: "#FFFFFF" }),
  AVL: Object.freeze({ label: "Villa", primary: "#670E36", accent: "#95BFE5" })
});
const FOOTBALL_CLUB_NAMES = Object.freeze({
  TOT: "Tottenham Hotspur",
  AVL: "Aston Villa"
});

export function teamCrest(team = {}) {
  const crestUrl = team?.crest_url;
  return typeof crestUrl === "string" && PREMIER_LEAGUE_CREST_URL.test(crestUrl)
    ? crestUrl
    : null;
}

function lightColour(state, fallback) {
  const rgb = state?.attributes?.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3 && rgb.every((value) => Number.isFinite(Number(value)))) {
    return `rgb(${rgb.slice(0, 3).map((value) => Math.max(0, Math.min(255, Number(value)))).join(",")})`;
  }
  return fallback;
}

export function deriveRoomState(room, states = {}, accent = "#5B5BD6") {
  const lightStates = room.lights.map((entityId) => states[entityId]).filter(Boolean);
  const availableLights = lightStates.filter(isEntityAvailable);
  const lightsOn = availableLights.filter((state) => state.state === "on");
  const climate = room.climate ? states[room.climate] : null;
  const playing = room.media_players
    .map((entityId) => states[entityId])
    .find((state) => state?.state === "playing");
  const openCovers = room.covers
    .map((entityId) => states[entityId])
    .filter((state) => isEntityAvailable(state) && entityStateValue(state) !== "closed");
  return {
    lightsOn: lightsOn.length,
    totalLights: room.lights.length,
    availableLights: availableLights.length,
    temperature: roomTemperature(room, states),
    targetTemperature: isEntityAvailable(climate)
      ? safeNumber(climate?.attributes?.temperature, NaN)
      : NaN,
    playing: playing ? entityName(playing) : null,
    openCovers: openCovers.length,
    colour: lightColour(lightsOn[0], accent)
  };
}

export function normaliseFixtureStatus(fixture) {
  if (fixture.finished || fixture.finished_provisional) return "finished";
  if (fixture.started || safeNumber(fixture.minutes) > 0) return "live";
  return "upcoming";
}

function footballTeamCode(team = {}) {
  return String(team?.short_name || team?.code || "").trim().toUpperCase();
}

function fixtureIncludesTeam(fixture, code) {
  const normalisedCode = String(code || "").trim().toUpperCase();
  return footballTeamCode(fixture?.home) === normalisedCode || footballTeamCode(fixture?.away) === normalisedCode;
}

function fixtureKickoffValue(fixture, fallback) {
  const value = Date.parse(fixture?.kickoff_time || "");
  return Number.isFinite(value) ? value : fallback;
}

function compareFixtureIds(left, right) {
  const leftNumber = Number(left?.id);
  const rightNumber = Number(right?.id);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }
  const a = String(left?.id ?? "");
  const b = String(right?.id ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
}

export function selectFavouriteFixture(events = [], teamCode = "") {
  const code = String(teamCode).trim().toUpperCase();
  if (!code || !Array.isArray(events)) return null;
  const relevant = events.filter((fixture) => fixtureIncludesTeam(fixture, code));
  const live = relevant
    .filter((fixture) => normaliseFixtureStatus(fixture) === "live")
    .sort((left, right) => (
      fixtureKickoffValue(left, Number.POSITIVE_INFINITY) - fixtureKickoffValue(right, Number.POSITIVE_INFINITY)
      || compareFixtureIds(left, right)
    ));
  if (live.length) return live[0];
  const upcoming = relevant
    .filter((fixture) => normaliseFixtureStatus(fixture) === "upcoming")
    .sort((left, right) => (
      fixtureKickoffValue(left, Number.POSITIVE_INFINITY) - fixtureKickoffValue(right, Number.POSITIVE_INFINITY)
      || compareFixtureIds(left, right)
    ));
  if (upcoming.length) return upcoming[0];
  const finished = relevant
    .filter((fixture) => normaliseFixtureStatus(fixture) === "finished")
    .sort((left, right) => (
      fixtureKickoffValue(right, Number.NEGATIVE_INFINITY) - fixtureKickoffValue(left, Number.NEGATIVE_INFINITY)
      || compareFixtureIds(left, right)
    ));
  return finished[0] || null;
}

export function buildFavouriteClubModels(events = [], spotlightTeamCodes = [], tableRows = []) {
  const fixtures = Array.isArray(events) ? events : [];
  const rows = Array.isArray(tableRows) ? tableRows : [];
  return (Array.isArray(spotlightTeamCodes) ? spotlightTeamCodes : []).map((rawCode) => {
    const code = String(rawCode).trim().toUpperCase();
    const fixture = selectFavouriteFixture(fixtures, code);
    const standing = rows.find((row) => String(row?.code || "").trim().toUpperCase() === code) || null;
    const fixtureTeam = footballTeamCode(fixture?.home) === code
      ? fixture.home
      : footballTeamCode(fixture?.away) === code
        ? fixture.away
        : null;
    const team = {
      id: fixtureTeam?.id ?? standing?.team_id ?? null,
      code,
      short_name: code,
      name: fixtureTeam?.name || standing?.name || FOOTBALL_CLUB_NAMES[code] || code,
      crest_url: fixtureTeam?.crest_url || standing?.crest_url || null
    };
    const opponent = fixture
      ? footballTeamCode(fixture.home) === code ? fixture.away : fixture.home
      : null;
    return {
      code,
      team,
      fixture,
      opponent,
      standing,
      status: fixture ? normaliseFixtureStatus(fixture) : "none",
      is_home: fixture ? footballTeamCode(fixture.home) === code : false
    };
  });
}

function fixtureIdentity(fixture) {
  if (!fixture) return null;
  if (fixture.id !== undefined && fixture.id !== null) return `id:${fixture.id}`;
  return [
    fixture.kickoff_time || "",
    footballTeamCode(fixture.home),
    footballTeamCode(fixture.away)
  ].join(":");
}

export function favouriteDerbyFixture(models = []) {
  if (!Array.isArray(models) || models.length !== 2) return null;
  const fixture = models[0]?.fixture;
  const identity = fixtureIdentity(fixture);
  if (!identity || fixtureIdentity(models[1]?.fixture) !== identity) return null;
  return models.every((model) => fixtureIncludesTeam(fixture, model.code)) ? fixture : null;
}

export function footballFreshness(index, now = new Date()) {
  const attributes = index?.attributes || {};
  if (!index) return { status: "waiting", title: "Waiting for scores", detail: "The first football update has not arrived yet." };
  if (["unknown", "unavailable"].includes(entityStateValue(index))) {
    return { status: "waiting", title: "Scores unavailable", detail: "Home Assistant cannot read the football feed right now." };
  }
  const checkedAt = Date.parse(attributes.last_checked || attributes.last_updated || "");
  const intervalMs = Math.max(60_000, safeNumber(attributes.refresh_interval_seconds, 900) * 1000);
  const ageMs = Number.isFinite(checkedAt) ? Math.max(0, new Date(now).getTime() - checkedAt) : Infinity;
  const cached = attributes.data_status === "cached" || attributes.poller_status === "degraded";
  const failed = attributes.poller_status === "error";
  const overdue = ageMs > intervalMs * 2.5;
  if (failed) return { status: "stale", title: "Scores may be delayed", detail: "The latest football check could not complete. Retrying automatically." };
  if (overdue) return { status: "stale", title: "Scores may be delayed", detail: "The last football check is older than expected." };
  if (cached) return { status: "cached", title: "Showing saved scores", detail: "Live updates are temporarily unavailable." };
  const minutes = Math.max(1, Math.round(intervalMs / 60_000));
  return { status: "live", title: "Scores up to date", detail: `Checking every ${minutes} minute${minutes === 1 ? "" : "s"}.` };
}

export function floorplanImageSource(floor, states = {}) {
  const staticSource = () => {
    const source = floor?.base_image || "";
    if (!source || !floor?.asset_revision) return source;
    return `${source}${source.includes("?") ? "&" : "?"}v=${encodeURIComponent(floor.asset_revision)}`;
  };
  if (!floor?.vacuum_map_entity) return staticSource();
  const mapState = states[floor.vacuum_map_entity];
  const entityPicture = mapState?.attributes?.entity_picture;
  if (typeof entityPicture === "string" && entityPicture.startsWith("/api/camera_proxy/")) {
    const updated = mapState.last_updated || mapState.last_changed;
    if (!updated) return entityPicture;
    return `${entityPicture}${entityPicture.includes("?") ? "&" : "?"}v=${encodeURIComponent(updated)}`;
  }
  return staticSource() || `/api/camera_proxy/${encodeURIComponent(floor.vacuum_map_entity)}`;
}

export function floorplanViewBox(floor, padding = 1.5) {
  const viewHeight = 100 / safeNumber(floor?.aspect_ratio, 1.666667);
  const points = (floor?.room_hotspots || [])
    .flatMap((hotspot) => hotspot?.points || [])
    .filter((point) => Array.isArray(point) && point.length === 2)
    .map(([x, y]) => [safeNumber(x, NaN), safeNumber(y, NaN) * viewHeight / 100])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!points.length) return `0 0 100 ${viewHeight.toFixed(4)}`;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x1 = Math.max(0, Math.min(...xs) - padding);
  const y1 = Math.max(0, Math.min(...ys) - padding);
  const x2 = Math.min(100, Math.max(...xs) + padding);
  const y2 = Math.min(viewHeight, Math.max(...ys) + padding);
  return `${x1.toFixed(4)} ${y1.toFixed(4)} ${(x2 - x1).toFixed(4)} ${(y2 - y1).toFixed(4)}`;
}

function relevantEntityIds(config) {
  const ids = new Set();
  const add = (value) => {
    if (typeof value === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(value)) ids.add(value);
  };
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
    else add(value);
  };
  walk(config);
  for (let gameweek = 1; gameweek <= 38; gameweek += 1) {
    ids.add(`${config.football.gameweek_entity_prefix}${gameweek}`);
  }
  return ids;
}

function stateSignature(states, entityIds) {
  const parts = [];
  for (const entityId of entityIds) {
    const state = states[entityId];
    if (!state) continue;
    const attributes = state.attributes || {};
    parts.push([
      entityId,
      state.state,
      state.last_changed,
      state.last_updated,
      attributes.brightness,
      attributes.rgb_color,
      attributes.current_position,
      attributes.current_temperature,
      attributes.temperature,
      attributes.hvac_action,
      attributes.supported_features,
      attributes.battery_level,
      attributes.media_title,
      attributes.media_artist,
      attributes.message,
      attributes.start_time,
      attributes.chore_name,
      attributes.default_points,
      attributes.due_date,
      attributes.due_at,
      attributes.reward_name,
      attributes.reward_cost,
      attributes.cost,
      attributes.points_required,
      attributes.badge_name,
      attributes.achievement_name,
      attributes.status,
      attributes.overall_progress,
      attributes.progress,
      attributes.percentage,
      attributes.current_value,
      attributes.current,
      attributes.progress_value,
      attributes.raw_progress,
      attributes.completed_count,
      attributes.target_value,
      attributes.target,
      attributes.threshold_value,
      attributes.required_count,
      attributes.awarded,
      attributes.unit_of_measurement,
      attributes.last_updated,
      attributes.events?.length,
      attributes.rows?.length,
      attributes.assignments?.length
    ].join(":"));
  }
  return parts.join("|");
}

const HTMLElementBase = globalThis.HTMLElement || class {};

export class FamilyHubCard extends HTMLElementBase {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._view = "today";
    this._homeSection = "rooms";
    this._calendarMode = "week";
    this._floor = null;
    this._room = null;
    this._securityCameraId = null;
    this._activeCameraId = null;
    this._cameraSession = null;
    this._cameraOperationToken = 0;
    this._cameraConfigGeneration = 0;
    this._cameraStartTimer = null;
    this._cameraFrameTimer = null;
    this._cameraSlowTimer = null;
    this._cameraExpiryTimer = null;
    this._cameraRecoveryPromise = null;
    this._cameraBlockedIds = new Map();
    this._pendingCameraStarts = new Map();
    this._cameraStopWitnesses = new Map();
    this._cameraBlockTimer = null;
    this._freshnessTimer = null;
    this._cameraBlockRetryMs = CAMERA_START_TIMEOUT_MS;
    this._cameraStartTimeoutMs = CAMERA_START_TIMEOUT_MS;
    this._cameraStopTimeoutMs = CAMERA_STOP_TIMEOUT_MS;
    this._cameraFrameTimeoutMs = CAMERA_FIRST_FRAME_TIMEOUT_MS;
    this._cameraSlowMessageMs = CAMERA_SLOW_MESSAGE_MS;
    this._cameraExpiryMs = CAMERA_SESSION_EXPIRY_MS;
    this._cameraError = null;
    this._pendingConfirmation = null;
    this._confirmationReturnFocus = null;
    this._footballTab = "fixtures";
    this._gameweek = null;
    this._entityIds = new Set();
    this._controlPolicy = buildControlPolicy();
    this._signature = "";
    this._renderPending = false;
    this._childCards = new Map();
    this._calendarEvents = [];
    this._calendarLoading = false;
    this._calendarError = null;
    this._calendarRequestKey = "";
    this._calendarRequest = 0;
    this._readOnlyHassSource = null;
    this._readOnlyHass = new Map();
    this._musicHassSource = null;
    this._musicHass = null;
    this._childHassTokens = new Map();
    this._childMountGeneration = 0;
    this._boundClick = (event) => this._handleClick(event);
    this._boundChange = (event) => this._handleChange(event);
    this._boundKeydown = (event) => this._handleKeydown(event);
    this._boundVisibilityChange = () => {
      if (globalThis.document?.visibilityState === "hidden") {
        this._clearFreshnessTimer();
        this._closeActiveCamera({ render: false, invalidate: true });
      } else {
        this._scheduleRender(true);
        this._armFreshnessTimer();
      }
    };
    this._boundPageHide = () => this._closeActiveCamera({ render: false, invalidate: true });
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._boundClick);
    this.shadowRoot.addEventListener("change", this._boundChange);
    this.shadowRoot.addEventListener("keydown", this._boundKeydown);
    globalThis.document?.addEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.addEventListener?.("pagehide", this._boundPageHide);
    this._armFreshnessTimer();
    this._scheduleRender(true);
  }

  disconnectedCallback() {
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    this.shadowRoot.removeEventListener("click", this._boundClick);
    this.shadowRoot.removeEventListener("change", this._boundChange);
    this.shadowRoot.removeEventListener("keydown", this._boundKeydown);
    globalThis.document?.removeEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.removeEventListener?.("pagehide", this._boundPageHide);
    this._clearFreshnessTimer();
    this._closeActiveCamera({ render: false, invalidate: true });
    this._clearCameraBlockTimer();
    this._childCards.clear();
  }

  setConfig(cardConfig) {
    const config = typeof cardConfig?.config_json === "string"
      ? JSON.parse(cardConfig.config_json)
      : cardConfig?.family_config;
    if (!config || config.schema_version !== 6) {
      throw new Error("Family Hub requires a schema-v6 family configuration");
    }
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    this._closeActiveCamera({ render: false, invalidate: true });
    this._cameraConfigGeneration = Number.isInteger(this._cameraConfigGeneration)
      ? this._cameraConfigGeneration + 1
      : 1;
    this._config = config;
    this._view = config.display.default_view || "today";
    this._homeSection = config.home.default_section || "rooms";
    this._calendarMode = config.calendar.initial_view || "week";
    this._floor = config.floorplan.default_floor;
    const defaultRoom = config.home.default_room
      ? config.rooms.find((room) => room.id === config.home.default_room && room.floor_id === this._floor)
      : null;
    this._room = defaultRoom?.id || config.floorplan.floors
      .find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || config.rooms[0]?.id || null;
    this._securityCameraId = config.entry?.primary_camera_id || config.entry?.cameras?.[0]?.id || null;
    this._entityIds = relevantEntityIds(config);
    this._controlPolicy = buildControlPolicy(config);
    const reboundWitnesses = new Map();
    for (const [witnessKey, witness] of this._cameraStopWitnesses) {
      const entity = witness.entity || witnessKey;
      const currentCamera = [...this._controlPolicy.cameras.entries()]
        .find(([, candidate]) => candidate.entity === entity);
      if (!config.display.read_only && currentCamera) {
        witness.cameraId = currentCamera[0];
        witness.configGeneration = this._cameraConfigGeneration;
      }
      reboundWitnesses.set(entity, witness);
    }
    this._cameraStopWitnesses = reboundWitnesses;
    this._signature = "";
    this._calendarEvents = [];
    this._calendarRequestKey = "";
    this._calendarError = null;
    this._activeCameraId = null;
    if (this._cameraBlockedIds.size === 0) this._cameraError = null;
    this._clearCameraBlockTimer();
    this._armCameraBlockRetryNotice();
    this._pendingConfirmation = null;
    this._confirmationReturnFocus = null;
    this._childCards.clear();
    this._scheduleRender(true);
  }

  set hass(hass) {
    this._invalidateChildHass();
    this._hass = hass;
    this._pruneInactiveChildCards();
    for (const [key, child] of this._childCards.entries()) child.hass = this._hassForChild(key);
    this._reconcileCameraSession(hass?.states || {});
    if (!this._config) return;
    const nextSignature = stateSignature(hass?.states || {}, this._entityIds);
    if (nextSignature !== this._signature) {
      this._signature = nextSignature;
      // The embedded player receives the new hass object above. Rebuilding the
      // outer shell for every playback tick would reset its browsing position.
      if (this._view !== "music") this._scheduleRender();
    }
    this._loadCalendarEvents();
  }

  getCardSize() {
    return 16;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 12 };
  }

  _scheduleRender(force = false) {
    if (!this.isConnected && !force) return;
    if (this._renderPending) return;
    this._renderPending = true;
    const callback = () => {
      this._renderPending = false;
      this._render();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  _armFreshnessTimer() {
    this._clearFreshnessTimer();
    if (!this.isConnected || globalThis.document?.visibilityState === "hidden") return;
    this._freshnessTimer = setTimeout(() => {
      this._freshnessTimer = null;
      if (!this.isConnected || globalThis.document?.visibilityState === "hidden") return;
      this._refreshTimeSensitiveView();
      this._armFreshnessTimer();
    }, nextFreshnessRefreshDelay());
  }

  _clearFreshnessTimer() {
    if (this._freshnessTimer !== null) clearTimeout(this._freshnessTimer);
    this._freshnessTimer = null;
  }

  _refreshTimeSensitiveView(now = new Date()) {
    if (this._view === "music") {
      const clock = this.shadowRoot?.querySelector?.(".hub-topbar-time");
      if (clock && this._config) {
        clock.textContent = new Intl.DateTimeFormat(this._config.product.locale, {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: this._config.product.timezone
        }).format(now);
      }
      return;
    }
    this._scheduleRender();
  }

  _enabledViews() {
    return VIEW_DEFINITIONS.filter((view) => !view.feature || this._config.features[view.feature]);
  }

  _calendarWindow() {
    return calendarWindow(
      this._config.product.locale,
      this._config.product.timezone,
      this._config.calendar.rolling_days
    );
  }

  _calendarFallbackEvents() {
    const states = this._hass?.states || {};
    return this._config.calendar.entities.flatMap((calendar) => {
      const state = states[calendar.entity_id];
      if (!state?.attributes?.start_time) return [];
      return [{
        summary: state.attributes.message || calendar.label,
        start: state.attributes.start_time,
        end: state.attributes.end_time,
        _calendar: calendar
      }];
    });
  }

  async _loadCalendarEvents() {
    if (!this._config?.features?.calendar || !this._hass) return;
    if (typeof this._hass.callApi !== "function") {
      if (!this._calendarEvents.length) this._calendarEvents = this._calendarFallbackEvents();
      return;
    }
    const days = this._calendarWindow();
    const stateVersion = this._config.calendar.entities.map((calendar) => {
      const state = this._hass.states?.[calendar.entity_id];
      return `${calendar.entity_id}:${state?.last_updated || state?.last_changed || "unknown"}`;
    }).join("|");
    const requestKey = `${days[0]?.key || ""}:${stateVersion}`;
    if (requestKey === this._calendarRequestKey) return;
    this._calendarRequestKey = requestKey;
    this._calendarLoading = true;
    this._calendarError = null;
    const requestId = ++this._calendarRequest;
    this._scheduleRender();
    const start = new Date(Date.now() - 43_200_000).toISOString();
    const end = new Date(Date.now() + (this._config.calendar.rolling_days + 1) * 86_400_000).toISOString();
    try {
      const groups = await Promise.all(this._config.calendar.entities.map(async (calendar) => {
        const path = `calendars/${encodeURIComponent(calendar.entity_id)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
        const events = await this._hass.callApi("GET", path);
        return (Array.isArray(events) ? events : []).map((event) => ({ ...event, _calendar: calendar }));
      }));
      if (requestId !== this._calendarRequest) return;
      this._calendarEvents = groups.flat().sort((left, right) => {
        return new Date(calendarEventStart(left) || 0) - new Date(calendarEventStart(right) || 0);
      });
    } catch (error) {
      if (requestId !== this._calendarRequest) return;
      this._calendarEvents = this._calendarFallbackEvents();
      this._calendarError = error?.message || "Calendar events are temporarily unavailable";
    } finally {
      if (requestId === this._calendarRequest) {
        this._calendarLoading = false;
        this._scheduleRender();
      }
    }
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;
    const renderFocus = this._captureRenderFocus();
    const embeddedRenderState = this._captureEmbeddedRenderState();
    const confirmationFocusAction = this._pendingConfirmation
      ? this.shadowRoot.activeElement?.dataset?.confirmAction || "cancel"
      : null;
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    const theme = this._config.theme;
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="hub-card" style="
        --hub-accent:${escapeHtml(theme.accent)};
        --hub-background:${escapeHtml(theme.background)};
        --hub-surface:${escapeHtml(theme.surface)};
        --hub-text:${escapeHtml(theme.text)};
        --hub-muted:${escapeHtml(theme.muted)};
        --hub-nav:${escapeHtml(theme.nav_background)};
        --hub-backdrop-start:${escapeHtml(theme.backdrop_start)};
        --hub-backdrop-mid:${escapeHtml(theme.backdrop_mid)};
        --hub-backdrop-end:${escapeHtml(theme.backdrop_end)};
        --hub-radius:${Number(theme.radius_px)}px;
      ">
        <div class="hub-shell">
          ${this._renderNavigation()}
          <main class="hub-content">
            ${this._renderHeader()}
            <div class="hub-view" data-current-view="${escapeHtml(this._view)}">
              ${this._renderView()}
            </div>
          </main>
        </div>
      </ha-card>
    `;
    for (const crest of this.shadowRoot.querySelectorAll("img[data-team-crest]")) {
      const showFallback = () => {
        crest.hidden = true;
        crest.previousElementSibling?.setAttribute("aria-hidden", "false");
      };
      crest.addEventListener("error", showFallback, { once: true });
      if (crest.complete && !crest.naturalWidth) showFallback();
    }
    this._mountChildCards();
    const confirmationFocusHandled = Boolean(this._pendingConfirmation || this._confirmationReturnFocus);
    this._syncConfirmationFocus(confirmationFocusAction);
    if (!confirmationFocusHandled) this._restoreRenderFocus(renderFocus);
    this._restoreEmbeddedRenderState(embeddedRenderState);
  }

  _captureEmbeddedRenderState() {
    if (this._view !== "music") return null;
    const stage = this.shadowRoot?.querySelector(".media-player-stage");
    const child = this._childCards.get("music");
    if (!stage || !child) return null;
    const rootActive = this.shadowRoot.activeElement;
    let focusedNode = rootActive === child || child.contains?.(rootActive) ? rootActive : null;
    while (focusedNode?.shadowRoot?.activeElement) focusedNode = focusedNode.shadowRoot.activeElement;
    return {
      child,
      focusedNode: focusedNode && focusedNode !== child ? focusedNode : null,
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop
    };
  }

  _restoreEmbeddedRenderState(state) {
    if (!state || this._view !== "music" || this._childCards.get("music") !== state.child) return;
    const stage = this.shadowRoot?.querySelector(".media-player-stage");
    if (stage) {
      stage.scrollLeft = state.scrollLeft;
      stage.scrollTop = state.scrollTop;
    }
    if (!state.focusedNode?.isConnected) return;
    try {
      state.focusedNode.focus({ preventScroll: true });
    } catch {
      state.focusedNode.focus?.();
    }
  }

  _captureRenderFocus() {
    if (this._pendingConfirmation) return null;
    const active = this.shadowRoot?.activeElement;
    if (!active?.matches?.('button, select, a[href], [role="button"][tabindex]')
      || active.closest?.(".confirmation-dialog")) return null;
    const currentView = active.closest?.(".hub-view")?.dataset?.currentView || null;
    const scope = active.closest?.(".hub-navigation")
      ? "navigation"
      : active.closest?.(".hub-topbar")
        ? "topbar"
        : currentView
          ? "view"
          : "card";
    const gameweekRole = active.matches?.("button[data-gameweek]")
      ? active.getAttribute("aria-label")
      : null;
    const dataset = Object.fromEntries(Object.entries(active.dataset || {})
      .filter(([key]) => key !== "confirmAction" && (key !== "gameweek" || !gameweekRole)));
    const markerClass = ["hub-nav-button", "hub-brand", "segment", "room-hotspot", "choreops-link"]
      .find((className) => active.classList?.contains(className)) || null;
    if (!gameweekRole && !Object.keys(dataset).length) return null;
    return {
      scope,
      currentView,
      tagName: active.tagName,
      markerClass,
      gameweekRole,
      dataset
    };
  }

  _restoreRenderFocus(descriptor) {
    if (!descriptor || this._pendingConfirmation) return;
    let scope = this.shadowRoot;
    if (descriptor.scope === "navigation") scope = this.shadowRoot.querySelector(".hub-navigation");
    else if (descriptor.scope === "topbar") scope = this.shadowRoot.querySelector(".hub-topbar");
    else if (descriptor.scope === "view") {
      scope = [...this.shadowRoot.querySelectorAll(".hub-view")]
        .find((view) => view.dataset.currentView === descriptor.currentView);
    }
    if (!scope) return;
    const control = [...scope.querySelectorAll('button, select, a[href], [role="button"][tabindex]')]
      .find((candidate) => (
        candidate.tagName === descriptor.tagName
        && (!descriptor.markerClass || candidate.classList.contains(descriptor.markerClass))
        && (!descriptor.gameweekRole || candidate.getAttribute("aria-label") === descriptor.gameweekRole)
        && Object.entries(descriptor.dataset).every(([key, value]) => candidate.dataset?.[key] === value)
      ));
    if (!control || control.disabled || control.getAttribute("aria-disabled") === "true") return;
    try {
      control.focus({ preventScroll: true });
    } catch {
      control.focus();
    }
  }

  _syncConfirmationFocus(confirmationFocusAction = null) {
    if (this._pendingConfirmation) {
      const action = ["cancel", "confirm"].includes(confirmationFocusAction)
        ? confirmationFocusAction
        : "cancel";
      const control = this.shadowRoot.querySelector(`button[data-confirm-action="${action}"]`)
        || this.shadowRoot.querySelector('button[data-confirm-action="cancel"]');
      control?.focus();
      return;
    }
    if (!this._confirmationReturnFocus) return;
    const descriptor = this._confirmationReturnFocus;
    this._confirmationReturnFocus = null;
    const control = [...this.shadowRoot.querySelectorAll("button")].find((button) => (
      button.dataset[descriptor.datasetKey] === descriptor.action
      && button.dataset.entity === descriptor.entity
    ));
    const fallback = this.shadowRoot.querySelector(descriptor.datasetKey === "secureCoverAction"
      ? ".garage-panel"
      : ".alarm-panel");
    if (control && !control.disabled && control.getAttribute("aria-disabled") !== "true") control.focus();
    else fallback?.focus();
  }

  _renderNavigation() {
    const coreIds = new Set(["today", "calendar", "rooms", "family", "entry"]);
    const confirmationGuard = this._pendingConfirmation ? ' inert aria-hidden="true"' : "";
    const renderButtons = (views) => views.map((view) => `
      <button class="hub-nav-button ${this._view === view.id ? "is-active" : ""}" type="button" data-view="${view.id}" aria-label="${escapeHtml(view.label)}" aria-current="${this._view === view.id ? "page" : "false"}">
        <ha-icon icon="${view.icon}" aria-hidden="true"></ha-icon>
        <span>${escapeHtml(view.label)}</span>
      </button>
    `).join("");
    const views = this._enabledViews();
    return `
      <nav class="hub-navigation" aria-label="Family Dashboard views"${confirmationGuard}>
        <button class="hub-brand" type="button" data-view="today" aria-label="Open Today"><ha-icon icon="mdi:home-heart" aria-hidden="true"></ha-icon><span>Family</span></button>
        <div class="hub-nav-items hub-nav-core">${renderButtons(views.filter((view) => coreIds.has(view.id)))}</div>
        <div class="hub-nav-items hub-nav-utility" aria-label="More"><span class="hub-nav-divider" aria-hidden="true"></span>${renderButtons(views.filter((view) => !coreIds.has(view.id)))}</div>
      </nav>
    `;
  }

  _renderHeader() {
    const now = new Date();
    const locale = this._config.product.locale;
    const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", timeZone: this._config.product.timezone }).format(now);
    const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: this._config.product.timezone }).format(now);
    const weatherEnabled = this._config.features.weather === true;
    const weather = weatherEnabled ? this._hass?.states?.[this._config.weather.entity_id] : null;
    const temperature = weather?.attributes?.temperature;
    const weatherText = weather
      ? `${formatTemperature(temperature)} · ${weatherStateLabel(weather.state)}`
      : "Home";
    const currentDefinition = VIEW_DEFINITIONS.find((view) => view.id === this._view) || VIEW_DEFINITIONS[0];
    const confirmationGuard = this._pendingConfirmation ? ' inert aria-hidden="true"' : "";
    return `
      <header class="hub-topbar"${confirmationGuard}>
        <div class="hub-page-title">
          <p class="hub-topbar-date">${escapeHtml(date)}</p>
          <h1>${escapeHtml(currentDefinition.label)}</h1>
        </div>
        <div class="hub-header-actions">
          ${weatherEnabled ? `<button class="hub-weather-pill" type="button" data-more-info="${escapeHtml(this._config.weather.entity_id)}" ${this._config.display.read_only ? 'aria-disabled="true"' : ""}>
            <ha-icon icon="mdi:weather-partly-cloudy" aria-hidden="true"></ha-icon>
            <span>${escapeHtml(weatherText)}</span>
          </button>` : ""}
          <time class="hub-topbar-time">${escapeHtml(time)}</time>
        </div>
      </header>
    `;
  }

  _renderView() {
    switch (this._view) {
      case "calendar": return this._renderCalendar();
      case "rooms": return this._renderRooms();
      case "family": return this._renderFamily();
      case "entry": return this._renderSecurity();
      case "music": return this._renderMusic();
      case "energy": return this._renderEnergy();
      case "football": return this._renderFootball();
      default: return this._renderToday();
    }
  }

  _renderToday() {
    const states = this._hass?.states || {};
    const features = this._config.features;
    const homeSummary = features.rooms ? homeSummaryPresentation(this._config, states) : null;
    const nextCalendar = features.calendar
      ? (this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents())
        .filter((event) => isCurrentOrFutureCalendarEvent(event, new Date(), this._config.product.timezone))
        .sort((a, b) => new Date(calendarEventStart(a)) - new Date(calendarEventStart(b)))[0]
      : null;
    const playing = features.music ? firstPlayingPlayer(this._config, states) : null;
    const footballSummary = features.football ? this._featuredFixtures() : null;
    const weather = features.weather ? states[this._config.weather.entity_id] : null;
    const alarm = features.entry ? states[this._config.entry?.alarm_entity] : null;
    const garage = features.entry ? states[this._config.entry?.garage?.cover_entity] : null;
    const entrySignals = features.entry
      ? (this._config.entry?.cameras || []).flatMap((camera) => [
        camera.ringing_entity,
        camera.person_entity,
        camera.motion_entity
      ]).filter(Boolean).map((entityId) => states[entityId])
      : [];
    const securitySummary = features.entry ? todaySecurityPresentation(alarm, garage, entrySignals) : null;
    const energySummary = this._energyPresentation();
    const energyCompact = energyCompactPresentation(energySummary);
    const lightingCompact = homeLightingCompactPresentation(homeSummary || {});
    const heatingCompact = homeHeatingCompactPresentation(homeSummary || {});
    const heroMetrics = [
      ...(features.rooms ? [
        `<button type="button" data-home-target="heating"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span><strong>${escapeHtml(heatingCompact.value)}</strong><small>${escapeHtml(heatingCompact.detail)}</small></span></button>`,
        `<button type="button" data-home-target="lights"><ha-icon icon="mdi:lightbulb-group-outline"></ha-icon><span><strong>${escapeHtml(lightingCompact.value)}</strong><small>${escapeHtml(lightingCompact.detail)}</small></span></button>`
      ] : []),
      ...(securitySummary ? [`<button type="button" data-view="entry"><ha-icon icon="${securitySummary.icon}"></ha-icon><span><strong>${escapeHtml(securitySummary.title)}</strong><small>${escapeHtml(securitySummary.detail)}</small></span></button>`] : []),
      ...(energyCompact ? [`<button type="button" data-view="energy"><ha-icon icon="${ICONS.energy}"></ha-icon><span><strong>${escapeHtml(energyCompact.value)}</strong><small>${escapeHtml(energyCompact.detail)}</small></span></button>`] : [])
    ];
    const familyHeading = features.chores ? "Jobs & rewards" : features.school ? "School" : "Family overview";
    const secondaryCards = [
      ...(features.family ? [`
        <article class="surface children-panel today-family today-secondary">
          <div class="section-heading"><div><p class="eyebrow">Family</p><h2>${familyHeading}</h2></div><button type="button" data-view="family">Open</button></div>
          <div class="person-summary-list">${this._renderChildSummaries()}</div>
        </article>
      `] : []),
      ...(footballSummary ? [`
        <article class="surface football-panel today-football today-secondary">
          <div class="section-heading"><div><p class="eyebrow">Football</p><h2>${escapeHtml(footballSummary.title)}</h2></div><button type="button" data-view="football">Open</button></div>
          <div class="featured-fixtures">${footballSummary.html}</div>
        </article>
      `] : []),
      ...(features.music ? [`
        <article class="surface now-playing-panel today-music today-secondary">
          <div class="section-heading"><div><p class="eyebrow">Music</p><h2>${playing ? "Now playing" : "House sound"}</h2></div><button type="button" data-view="music">Open</button></div>
          ${playing ? `
            <div class="now-playing">
              <div class="artwork">${playing.state.attributes.entity_picture ? `<img src="${escapeHtml(playing.state.attributes.entity_picture)}" alt="">` : '<ha-icon icon="mdi:music-note" aria-hidden="true"></ha-icon>'}</div>
              <div class="now-playing-copy" title="${escapeHtml(`${playing.state.attributes.media_title || "Music"} · ${playing.state.attributes.media_artist || playing.player.name}`)}"><h2>${escapeHtml(playing.state.attributes.media_title || "Music")}</h2><p>${escapeHtml(playing.state.attributes.media_artist || playing.player.name)}</p></div>
              <button type="button" class="icon-action" data-media-toggle="${escapeHtml(playing.player.entity_id)}" aria-label="Play or pause" ${this._config.display.read_only ? 'disabled aria-disabled="true"' : ""}><ha-icon icon="${playing.state.state === "playing" ? "mdi:pause" : "mdi:play"}"></ha-icon></button>
            </div>
          ` : `
            <div class="quiet-music"><div class="today-card-icon is-coral"><ha-icon icon="mdi:music-note"></ha-icon></div><div><strong>The house is quiet</strong><span>Choose a room in Music</span></div></div>
          `}
        </article>
      `] : [])
    ];
    return `
      <section class="today-grid" data-calendar="${features.calendar}" data-secondary-count="${secondaryCards.length}" aria-label="Today at a glance">
        <article class="surface hero-panel today-hero ${features.weather ? "" : "is-weatherless"}">
          <div class="today-hero-copy">
            <p class="eyebrow">${escapeHtml(new Intl.DateTimeFormat(this._config.product.locale, { weekday: "long", timeZone: this._config.product.timezone }).format(new Date()))}</p>
            <h2>${escapeHtml(greetingForTime(new Date(), this._config.product.timezone))}</h2>
            <p>${features.calendar ? nextCalendar ? `${escapeHtml(nextCalendar.summary || nextCalendar._calendar?.label || "Family event")} is next at ${escapeHtml(formatTime(calendarEventStart(nextCalendar), this._config.product.locale, this._config.product.timezone))}.` : "The day is clear and the house is ready." : "Home is ready when you are."}</p>
          </div>
          ${features.weather ? `<div class="today-weather" aria-label="Current weather">
            <ha-icon icon="mdi:weather-partly-cloudy" aria-hidden="true"></ha-icon>
            <strong>${escapeHtml(formatTemperature(weather?.attributes?.temperature))}</strong>
            <span>${escapeHtml(weatherStateLabel(weather?.state || "Home"))}</span>
          </div>` : ""}
          ${heroMetrics.length ? `<div class="hero-metrics ${energySummary ? "has-energy" : ""}" data-metric-count="${heroMetrics.length}">${heroMetrics.join("")}</div>` : ""}
        </article>
        ${features.calendar ? `<article class="surface next-panel today-next">
          <div class="today-card-icon is-amber"><ha-icon icon="mdi:calendar-clock"></ha-icon></div>
          <p class="eyebrow">Coming up</p>
          ${nextCalendar ? `
            <h2>${escapeHtml(nextCalendar.summary || nextCalendar._calendar?.label || "Family event")}</h2>
            <p class="supporting">${escapeHtml(formatDay(calendarEventStart(nextCalendar), this._config.product.locale, this._config.product.timezone))}${isAllDayCalendarEvent(nextCalendar) ? " · All day" : ` at ${escapeHtml(formatTime(calendarEventStart(nextCalendar), this._config.product.locale, this._config.product.timezone))}`}</p>
            <button class="text-action" type="button" data-view="calendar">See the day <ha-icon icon="mdi:arrow-right"></ha-icon></button>
          ` : `
            <h2>No plans yet</h2>
            <p class="supporting">The next family event will appear here.</p>
            <button class="text-action" type="button" data-view="calendar">Open calendar <ha-icon icon="mdi:arrow-right"></ha-icon></button>
          `}
        </article>` : ""}
        ${secondaryCards.join("")}
      </section>
    `;
  }

  _energyPresentation() {
    if (!this._config.features.energy || !this._config.energy) return null;
    return energyOverviewPresentation(this._config.energy, this._hass?.states || {}, {
      locale: this._config.product.locale,
      timeZone: this._config.product.timezone,
      now: new Date()
    });
  }

  _renderEnergy() {
    const summary = this._energyPresentation();
    if (!summary) return '<p class="hub-empty-state large">Energy is not configured.</p>';
    const statusLabels = {
      current: ["Latest readings", "mdi:check-circle-outline"],
      stale: ["Update delayed", "mdi:clock-alert-outline"],
      partial: ["Partial readings", "mdi:alert-circle-outline"],
      unverified: ["Update time unknown", "mdi:clock-question-outline"],
      unavailable: ["Waiting for meters", "mdi:progress-clock"]
    };
    const renderFuel = (id, label, icon, fuel) => {
      const [statusLabel, statusIcon] = statusLabels[fuel.status] || statusLabels.unavailable;
      return `
        <article class="surface energy-meter is-${id} is-${escapeHtml(fuel.status)}" data-energy-fuel="${id}">
          <header class="energy-meter-heading">
            <span class="energy-meter-icon"><ha-icon icon="${icon}" aria-hidden="true"></ha-icon></span>
            <div><p class="eyebrow">Smart meter</p><h2>${label}</h2></div>
            <span class="energy-status"><ha-icon icon="${statusIcon}" aria-hidden="true"></ha-icon>${escapeHtml(statusLabel)}</span>
          </header>
          <div class="energy-primary-metrics">
            <span><small>Cost today</small><strong>${escapeHtml(fuel.cost)}</strong></span>
            <span><small>Used today</small><strong>${escapeHtml(fuel.usage)}</strong></span>
          </div>
          <div class="energy-tariff">
            <span><small>Unit rate</small><strong>${escapeHtml(fuel.rate)}</strong></span>
            <span><small>Standing charge</small><strong>${escapeHtml(fuel.standingCharge)}</strong></span>
          </div>
          <p class="energy-freshness"><ha-icon icon="mdi:clock-outline" aria-hidden="true"></ha-icon>${escapeHtml(fuel.freshness)}</p>
        </article>
      `;
    };
    const [heroLabel, heroIcon] = statusLabels[summary.status] || statusLabels.unavailable;
    return `
      <section class="energy-view" aria-label="Household energy today">
        <article class="surface energy-hero is-${escapeHtml(summary.status)}">
          <div>
            <p class="eyebrow">Today so far</p>
            <h2>${escapeHtml(summary.totalCost === "—" ? "Meter data pending" : summary.totalCost)}</h2>
            <p>${escapeHtml(summary.detail)}</p>
          </div>
          <span class="energy-hero-status"><ha-icon icon="${heroIcon}" aria-hidden="true"></ha-icon><strong>${escapeHtml(heroLabel)}</strong><small>Readings can arrive at different times</small></span>
        </article>
        <div class="energy-meter-grid">
          ${renderFuel("electricity", "Electricity", "mdi:lightning-bolt", summary.electricity)}
          ${renderFuel("gas", "Gas", "mdi:fire", summary.gas)}
        </div>
        <article class="surface energy-truth-note">
          <ha-icon icon="mdi:information-outline" aria-hidden="true"></ha-icon>
          <div><strong>Smart-meter totals, not live power</strong><span>These figures show today so far. Gas and electricity may refresh on different schedules.</span></div>
        </article>
      </section>
    `;
  }

  _renderChildSummaries() {
    const states = this._hass?.states || {};
    const choresEnabled = this._config.features.chores === true;
    const schoolEnabled = this._config.features.school === true;
    return this._config.people.filter((person) => person.role === "child").map((person) => {
      const chore = choresEnabled ? this._config.chores.users.find((entry) => entry.person_id === person.id) : null;
      const choreState = chore ? states[chore.chores_entity] : null;
      const pointsState = chore ? states[chore.points_entity] : null;
      const choreStateAvailable = isEntityAvailable(choreState);
      const pointsStateAvailable = isEntityAvailable(pointsState);
      const due = choreStateAvailable
        ? safeNumber(choreState?.attributes?.chore_stat_current_due_today, 0)
        : NaN;
      const choreStatuses = (chore?.status_entities || [])
        .map((entityId) => ({ entityId, state: states[entityId] }));
      const hasUnavailableChore = choreStatuses.some(({ state }) => !isEntityAvailable(state));
      const nextChore = choreStatuses
        .filter(({ state }) => isEntityAvailable(state))
        .find(({ state }) => !["approved", "completed", "completed_by_other"].includes(String(state?.state || "").toLowerCase()));
      const nextChoreName = nextChore ? normaliseChoreStatus(nextChore.state, nextChore.entityId).name : "Jobs complete";
      const classroom = schoolEnabled
        ? this._config.school.classroom_students.find((entry) => entry.person_id === person.id)
        : null;
      const classroomState = classroom ? states[classroom.assignments_entity] : null;
      const classroomData = classroomAssignmentPresentation(classroomState);
      const assignmentCount = classroomData.available ? classroomData.count : NaN;
      const detail = choresEnabled
        ? !chore
          ? "ChoreOps not connected"
          : !choreStateAvailable || !pointsStateAvailable
            ? "ChoreOps unavailable"
            : hasUnavailableChore
              ? `${due} due · Job status incomplete`
              : `${due} due · ${nextChoreName}`
        : schoolEnabled
          ? Number.isFinite(assignmentCount)
            ? `${assignmentCount} open assignment${assignmentCount === 1 ? "" : "s"}${classroomData.stale ? " · Update delayed" : ""}`
            : "Classroom unavailable"
          : "Family overview";
      return `
        <button type="button" class="person-summary" data-view="family" style="--person-colour:${escapeHtml(person.colour)}">
          <span class="person-initial">${escapeHtml(person.name.slice(0, 1))}</span>
          <span><strong>${escapeHtml(person.name)}</strong><small>${escapeHtml(detail)}</small></span>
          ${choresEnabled && chore ? `<span class="points">${pointsStateAvailable ? `${escapeHtml(formatPoints(pointsState.state, this._config.product.locale))} pts` : "— pts"}</span>` : ""}
        </button>
      `;
    }).join("");
  }

  _renderCalendar() {
    const modes = [
      { id: "day", label: "Day", icon: "mdi:calendar-today" },
      { id: "week", label: "Week", icon: "mdi:calendar-week" },
      { id: "month", label: "Month", icon: "mdi:calendar-month" },
      { id: "agenda", label: "Agenda", icon: "mdi:format-list-bulleted" }
    ];
    const modeButtons = modes.map((mode) => `<button type="button" class="segment ${mode.id === this._calendarMode ? "is-selected" : ""}" data-calendar-mode="${mode.id}" aria-pressed="${mode.id === this._calendarMode}"><ha-icon icon="${mode.icon}" aria-hidden="true"></ha-icon>${mode.label}</button>`).join("");
    return `
      <section class="single-surface surface calendar-view">
        <div class="calendar-toolbar">
          <div class="calendar-context"><ha-icon icon="mdi:calendar-heart" aria-hidden="true"></ha-icon><span><strong>Family schedule</strong><small>Read only</small></span></div>
          <div class="segments calendar-modes" role="group" aria-label="Choose calendar view">${modeButtons}</div>
        </div>
        <div id="calendar-card-slot" class="child-card-slot calendar-card-slot">${this._renderCalendarFallback()}</div>
      </section>
    `;
  }

  _renderCalendarFallback() {
    const days = this._calendarWindow();
    const events = this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents();
    const timeZone = this._config.product.timezone;
    const locale = this._config.product.locale;
    const columns = days.map((day) => {
      const dayEvents = events.filter((event) => dateKey(calendarEventStart(event), timeZone) === day.key);
      return `
        <section class="hub-agenda-day ${day.isToday ? "is-today" : ""}">
          <header><span>${escapeHtml(day.weekday)}</span><strong>${escapeHtml(day.day)}</strong><small>${escapeHtml(day.month)}</small></header>
          <div class="hub-agenda-events">
            ${dayEvents.slice(0, 5).map((event) => {
              const calendar = event._calendar || this._config.calendar.entities[0];
              return `
                <article class="hub-agenda-event" style="--calendar-colour:${escapeHtml(calendar.colour)}">
                  <span class="event-time">${isAllDayCalendarEvent(event) ? "All day" : escapeHtml(formatTime(calendarEventStart(event), locale, timeZone))}</span>
                  <strong>${escapeHtml(event.summary || calendar.label)}</strong>
                  ${event.location ? `<small><ha-icon icon="mdi:map-marker-outline" aria-hidden="true"></ha-icon>${escapeHtml(event.location)}</small>` : ""}
                </article>
              `;
            }).join("") || '<p class="hub-agenda-empty">Nothing planned</p>'}
            ${dayEvents.length > 5 ? `<span class="hub-agenda-more">+${dayEvents.length - 5} more</span>` : ""}
          </div>
        </section>
      `;
    }).join("");
    return `
      <div class="calendar-fallback" aria-label="Built-in calendar fallback">
        ${this._calendarLoading ? '<div class="calendar-loading"><span></span>Refreshing the family week…</div>' : ""}
        ${this._calendarError ? '<p class="calendar-warning">Daylight is unavailable, so this safe built-in agenda is being shown.</p>' : ""}
        <div class="hub-agenda-board">${columns}</div>
      </div>
    `;
  }

  _renderRooms() {
    const sectionDefinitions = [
      { id: "rooms", label: "Rooms", icon: "mdi:floor-plan" },
      { id: "lights", label: "Lights", icon: "mdi:lightbulb-group-outline" },
      { id: "heating", label: "Heating", icon: "mdi:radiator" },
      { id: "covers", label: "Blinds & doors", icon: "mdi:blinds-horizontal" },
      ...(this._config.features.cleaning ? [{ id: "cleaning", label: "Cleaning", icon: "mdi:robot-vacuum" }] : [])
    ];
    if (!sectionDefinitions.some((entry) => entry.id === this._homeSection)) this._homeSection = "rooms";
    const summary = homeSummaryPresentation(this._config, this._hass?.states || {});
    const cleaningState = titleCase(this._hass?.states?.[this._config.cleaning?.vacuum_entity]?.state || "unavailable");
    const lightingUnavailable = summary.lightCount > 0 && summary.availableLights === 0;
    const lightingPartial = summary.availableLights > 0 && summary.availableLights < summary.lightCount;
    const heatingUnavailable = summary.heatingZones > 0 && summary.availableHeatingZones === 0;
    const heatingPartial = summary.availableHeatingZones > 0 && summary.availableHeatingZones < summary.heatingZones;
    const coversUnavailable = summary.coverCount > 0 && summary.availableCovers === 0;
    const coversPartial = summary.availableCovers > 0 && summary.availableCovers < summary.coverCount;
    const headings = {
      rooms: ["Home overview", "The whole house, at a glance"],
      lights: [lightingUnavailable ? "Lighting status unavailable" : lightingPartial ? "Lighting status incomplete" : summary.lightCount === 0 ? "No lights configured" : summary.roomsLit ? `${summary.roomsLit} of ${summary.lightingRooms} rooms lit` : "All lights are off", lightingPartial ? `${summary.availableLights} of ${summary.lightCount} lights reporting` : summary.lightCount === 0 ? "Add room lighting mappings" : "Lighting, room by room"],
      heating: [heatingUnavailable ? "Heating status unavailable" : heatingPartial ? "Heating status incomplete" : summary.heatingZones ? `${summary.zonesHeating} of ${summary.heatingZones} zones heating` : "No heating zones configured", heatingPartial ? `${summary.availableHeatingZones} of ${summary.heatingZones} zones reporting` : summary.heatingZones ? "Comfort across every zone" : "Add room climate mappings"],
      covers: [coversUnavailable ? "Cover status unavailable" : coversPartial ? "Cover status incomplete" : summary.coverCount === 0 ? "No blinds or doors configured" : summary.openCovers ? `${summary.openCovers} open` : "Everything closed", coversPartial ? `${summary.availableCovers} of ${summary.coverCount} blinds and doors reporting` : summary.coverCount === 0 ? "Add room cover mappings" : "Blinds and doors"],
      cleaning: [cleaningState, "Whole-home cleaning"]
    };
    const [eyebrow, title] = headings[this._homeSection] || headings.rooms;
    const sectionButtons = sectionDefinitions.map((entry) => `
      <button type="button" class="segment ${entry.id === this._homeSection ? "is-selected" : ""}" data-home-section="${entry.id}" aria-pressed="${entry.id === this._homeSection}">
        <ha-icon icon="${entry.icon}" aria-hidden="true"></ha-icon>${escapeHtml(entry.label)}
      </button>
    `).join("");
    return `
      <section class="home-surface">
        <div class="home-toolbar">
          <div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h2>${escapeHtml(title)}</h2></div>
          <div class="segments home-segments" role="group" aria-label="Choose Home section">${sectionButtons}</div>
        </div>
        <div class="home-section" data-home-section-current="${escapeHtml(this._homeSection)}">${this._renderHomeSection()}</div>
      </section>
    `;
  }

  _renderHomeSection() {
    switch (this._homeSection) {
      case "lights": return this._renderAllLights();
      case "heating": return this._renderAllHeating();
      case "covers": return this._renderAllCovers();
      case "cleaning": return this._renderCleaning();
      default: return this._renderRoomExplorer();
    }
  }

  _renderRoomExplorer() {
    const states = this._hass?.states || {};
    const floor = this._config.floorplan.floors.find((entry) => entry.id === this._floor) || this._config.floorplan.floors[0];
    const selectedRoom = this._config.rooms.find((room) => room.id === this._room)
      || this._config.rooms.find((room) => room.floor_id === floor.id)
      || this._config.rooms[0];
    const floorButtons = this._config.floorplan.floors.map((entry) => `
      <button type="button" class="segment ${entry.id === floor.id ? "is-selected" : ""}" data-floor="${entry.id}" aria-pressed="${entry.id === floor.id}">${escapeHtml(entry.name)}</button>
    `).join("");
    const summary = homeSummaryPresentation(this._config, states);
    const energy = this._energyPresentation();
    const energyCompact = energyCompactPresentation(energy);
    const lightingCompact = homeLightingCompactPresentation(summary);
    const heatingCompact = homeHeatingCompactPresentation(summary);
    const lightingUnavailable = summary.lightCount > 0 && summary.availableLights === 0;
    const lightingPartial = summary.availableLights > 0 && summary.availableLights < summary.lightCount;
    const heatingUnavailable = summary.heatingZones > 0 && summary.availableHeatingZones === 0;
    const heatingPartial = summary.availableHeatingZones > 0 && summary.availableHeatingZones < summary.heatingZones;
    const summaryLinks = [
      `<button type="button" data-home-target="lights"><ha-icon icon="mdi:lightbulb-group-outline" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(lightingCompact.value)}</strong><small>${escapeHtml(lightingCompact.detail)}</small></span><ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></button>`,
      `<button type="button" data-home-target="heating"><ha-icon icon="mdi:radiator" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(heatingCompact.value)}</strong><small>${escapeHtml(heatingCompact.detail)}</small></span><ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></button>`,
      ...(energyCompact ? [`<button type="button" data-view="energy"><ha-icon icon="${ICONS.energy}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(energyCompact.value)}</strong><small>${escapeHtml(energyCompact.detail)}</small></span><ha-icon icon="mdi:chevron-right" aria-hidden="true"></ha-icon></button>`] : [])
    ].join("");
    return `
      <section class="home-overview">
        <div class="home-summary-links" data-summary-count="${energy ? 3 : 2}" aria-label="Home summaries">${summaryLinks}</div>
        <section class="rooms-layout">
          <article class="surface floorplan-panel">
            <div class="section-heading floorplan-heading">
              <div><p class="eyebrow">${escapeHtml(floor.name)}</p><h2>${this._config.display.read_only ? "Choose a room to explore" : "Choose a room"}</h2></div>
              <div class="segments" role="group" aria-label="Choose floor">${floorButtons}</div>
            </div>
            ${this._renderFloorplan(floor, selectedRoom)}
          </article>
          <aside class="surface room-detail home-drawer" aria-label="Selected room controls">${this._renderRoomDetail(selectedRoom)}</aside>
        </section>
      </section>
    `;
  }

  _renderAllLights() {
    const states = this._hass?.states || {};
    const readOnly = this._config.display.read_only === true;
    const rooms = this._config.rooms.filter((room) => room.lights.length).map((room) => {
      const lightStates = room.lights.map((entityId) => states[entityId]);
      const onCount = lightStates.filter((state) => state?.state === "on").length;
      const availableCount = lightStates.filter(isEntityAvailable).length;
      const controls = room.lights.map((entityId) => {
        const state = states[entityId];
        const available = isEntityAvailable(state);
        const isOn = state?.state === "on";
        const name = entityName(state, titleCase(entityId.split(".")[1]));
        const reportedBrightness = safeNumber(state?.attributes?.brightness, NaN);
        const brightness = isOn
          ? Number.isFinite(reportedBrightness) ? `${Math.round(reportedBrightness / 2.55)}%` : "On"
          : titleCase(state?.state || "unavailable");
        const unavailable = readOnly || !available ? ' disabled aria-disabled="true"' : "";
        const actionLabel = available ? `Turn ${name} ${isOn ? "off" : "on"}` : `${name} unavailable`;
        return `<button type="button" class="whole-home-control ${isOn ? "is-on" : ""}" data-toggle="${escapeHtml(entityId)}" aria-label="${escapeHtml(actionLabel)}" aria-pressed="${isOn}"${unavailable}><ha-icon icon="${ICONS.light}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(brightness)}</small></span></button>`;
      }).join("");
      const status = availableCount === 0
        ? "Status unavailable"
        : availableCount < room.lights.length
          ? `${onCount} on · ${availableCount} of ${room.lights.length} reporting`
          : `${onCount} of ${room.lights.length} on`;
      return `<article class="surface whole-home-card"><div class="whole-home-heading"><span><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><h3>${escapeHtml(room.name)}</h3><p>${status}</p></div></div><div class="whole-home-controls">${controls}</div></article>`;
    }).join("");
    return `<div class="whole-home-grid">${rooms || '<p class="hub-empty-state">No room lights are available yet.</p>'}</div>`;
  }

  _renderAllHeating() {
    const states = this._hass?.states || {};
    const readOnly = this._config.display.read_only === true;
    const heatingRooms = this._config.rooms.filter((room) => room.climate);
    const zones = heatingRooms.map((room) => {
      const state = states[room.climate];
      const current = roomTemperature(room, states);
      const target = isEntityAvailable(state)
        ? safeNumber(state?.attributes?.temperature, NaN)
        : NaN;
      const presentation = heatingPresentation(state);
      const targetLabel = formatTemperature(target);
      const powerService = presentation.isOn ? "turn_off" : "turn_on";
      const powerLabel = presentation.available ? presentation.isOn ? "On" : "Off" : "—";
      const powerLabelText = presentation.available
        ? `Turn ${room.name} heating ${presentation.isOn ? "off" : "on"}`
        : `${room.name} heating unavailable`;
      const powerPressed = presentation.available ? ` aria-pressed="${presentation.isOn}"` : "";
      const powerDisabled = readOnly || !presentation.available ? ' disabled aria-disabled="true"' : "";
      const targetDisabled = readOnly || !presentation.available || !Number.isFinite(target)
        ? ' disabled aria-disabled="true"'
        : "";
      return `
        <article class="surface heating-card is-${escapeHtml(presentation.tone)} ${presentation.available ? presentation.isOn ? "is-on" : "is-off" : "is-state-unavailable"}" data-climate-card="${escapeHtml(room.climate)}">
          <div class="heating-card-heading">
            <span class="heating-icon"><ha-icon icon="${ICONS.climate}"></ha-icon></span>
            <div><h3>${escapeHtml(room.name)}</h3><p class="heating-status"><span aria-hidden="true"></span>${escapeHtml(presentation.label)}</p></div>
            <button type="button" class="heating-power ${presentation.isOn ? "is-on" : ""}" data-climate-power="${powerService}" data-entity="${escapeHtml(room.climate)}" aria-label="${escapeHtml(powerLabelText)}"${powerPressed}${powerDisabled}><ha-icon icon="mdi:power"></ha-icon><span>${powerLabel}</span></button>
          </div>
          <div class="heating-body">
            <div class="heating-current"><small>Current</small><strong class="heating-current-value">${formatTemperature(current)}</strong></div>
            <div class="heating-target-control" role="group" aria-label="${escapeHtml(room.name)} target temperature, currently ${targetLabel}">
              <small>Target</small>
              <div class="heating-stepper">
                <button type="button" data-climate-adjust="-0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Lower ${escapeHtml(room.name)} target from ${targetLabel}"${targetDisabled}>−</button>
                <output class="heating-target-value">${targetLabel}</output>
                <button type="button" data-climate-adjust="0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Raise ${escapeHtml(room.name)} target from ${targetLabel}"${targetDisabled}>+</button>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join("");
    return `<div class="heating-grid" data-zone-count="${heatingRooms.length}">${zones || '<p class="hub-empty-state">No heating controls are available yet.</p>'}</div>`;
  }

  _renderAllCovers() {
    const states = this._hass?.states || {};
    const readOnly = this._config.display.read_only === true;
    const secureCover = this._controlPolicy.secureCover;
    const covers = this._config.rooms.flatMap((room) => room.covers
      .filter((entityId) => entityId !== secureCover)
      .map((entityId) => ({ room, entityId })));
    const cards = covers.map(({ room, entityId }) => {
      const state = states[entityId];
      const available = isEntityAvailable(state);
      const name = entityName(state, "Blind");
      const disabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
      const position = safeNumber(state?.attributes?.current_position, NaN);
      return `
        <article class="surface cover-card">
          <div class="cover-card-heading"><span><ha-icon icon="${ICONS.cover}"></ha-icon></span><div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(room.name)} · ${escapeHtml(titleCase(state?.state || "unavailable"))}${Number.isFinite(position) ? ` · ${position}%` : ""}</p></div></div>
          <div class="cover-actions"><button type="button" data-cover-action="open_cover" data-entity="${escapeHtml(entityId)}" aria-label="Open ${escapeHtml(name)}"${disabled}><ha-icon icon="mdi:arrow-up"></ha-icon>Open</button><button type="button" data-cover-action="stop_cover" data-entity="${escapeHtml(entityId)}" aria-label="Stop ${escapeHtml(name)}"${disabled}><ha-icon icon="mdi:stop"></ha-icon>Stop</button><button type="button" data-cover-action="close_cover" data-entity="${escapeHtml(entityId)}" aria-label="Close ${escapeHtml(name)}"${disabled}><ha-icon icon="mdi:arrow-down"></ha-icon>Close</button></div>
        </article>
      `;
    }).join("");
    const garage = this._config.features.entry ? this._hass?.states?.[this._config.entry.garage.cover_entity] : null;
    const garageCard = this._config.features.entry ? `
      <article class="surface cover-card">
        <div class="cover-card-heading"><span><ha-icon icon="mdi:garage-variant"></ha-icon></span><div><h3>Garage door</h3><p>${escapeHtml(titleCase(garage?.state || "unavailable"))} · protected action</p></div></div>
        <div class="cover-actions is-single"><button type="button" data-view="entry"><ha-icon icon="mdi:shield-home-outline"></ha-icon>Open Security</button></div>
      </article>
    ` : "";
    return `<div class="cover-grid">${cards}${garageCard || (!cards ? '<p class="hub-empty-state">No blinds or door controls are available yet.</p>' : "")}</div>`;
  }

  _renderCleaning() {
    const states = this._hass?.states || {};
    const config = this._config.cleaning;
    const vacuum = states[config.vacuum_entity];
    const readOnly = this._config.display.read_only === true;
    const available = isEntityAvailable(vacuum);
    const disabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
    const battery = config.battery_entity ? states[config.battery_entity]?.state : vacuum?.attributes?.battery_level;
    const task = config.task_entity ? states[config.task_entity]?.state : vacuum?.state;
    const dock = config.dock_entity ? states[config.dock_entity]?.state : null;
    const facts = [
      [Number.isFinite(Number(battery)) ? `${Number(battery)}%` : "—", "Battery"],
      [titleCase(task || "unavailable"), "Current task"],
      [titleCase(dock || vacuum?.state || "unavailable"), "Dock"]
    ].map(([value, label]) => `<span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`).join("");
    return `
      <article class="surface cleaning-panel">
        <div class="cleaning-hero"><span><ha-icon icon="${ICONS.vacuum}"></ha-icon></span><div><p class="eyebrow">Whole-home cleaning</p><h2>${escapeHtml(entityName(vacuum, "Robot vacuum"))}</h2><p>${escapeHtml(titleCase(vacuum?.state || "unavailable"))}</p></div></div>
        <div class="cleaning-facts">${facts}</div>
        <div class="cleaning-actions"><button type="button" data-vacuum-action="start" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:play"></ha-icon>Start</button><button type="button" data-vacuum-action="pause" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:pause"></ha-icon>Pause</button><button type="button" data-vacuum-action="return_to_base" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:home-map-marker"></ha-icon>Return home</button></div>
        ${config.map_entity ? '<div id="vacuum-map-card-slot" class="child-card-slot vacuum-map-slot"></div>' : '<div class="vacuum-map-placeholder"><ha-icon icon="mdi:map-outline"></ha-icon><span>The cleaning map is not available yet.</span></div>'}
      </article>
    `;
  }

  _renderFloorplan(floor, selectedRoom) {
    const states = this._hass?.states || {};
    const viewHeight = 100 / safeNumber(floor.aspect_ratio, 1.666667);
    const viewBox = floorplanViewBox(floor);
    const imageSource = floorplanImageSource(floor, states);
    const overlays = floor.light_overlays.map((overlay) => {
      const state = states[overlay.entity_id];
      if (state?.state !== "on") return "";
      const opacity = Math.max(0.18, safeNumber(state.attributes?.brightness, 255) / 255);
      return `<image class="light-overlay" href="${escapeHtml(overlay.image)}" x="0" y="0" width="100" height="${viewHeight.toFixed(4)}" preserveAspectRatio="none" opacity="${opacity.toFixed(3)}" aria-hidden="true"></image>`;
    }).join("");
    const hotspots = floor.room_hotspots.map((hotspot) => {
      const room = this._config.rooms.find((entry) => entry.id === hotspot.room_id);
      if (!room) return "";
      const summary = deriveRoomState(room, states, this._config.theme.accent);
      const points = hotspot.points.map(([x, y]) => `${x},${(y * viewHeight / 100).toFixed(4)}`).join(" ");
      const lightStatus = summary.totalLights === 0
        ? null
        : summary.availableLights === 0
          ? "Lighting unavailable"
          : summary.availableLights < summary.totalLights
            ? `${summary.lightsOn} on · ${summary.availableLights} of ${summary.totalLights} lights reporting`
            : `${summary.lightsOn}/${summary.totalLights} lights`;
      const status = [
        lightStatus,
        Number.isFinite(summary.temperature) ? formatTemperature(summary.temperature) : null
      ].filter(Boolean).join(" · ") || "Open room";
      return `
        <g class="room-hotspot ${selectedRoom?.id === room.id ? "is-selected" : ""} ${summary.lightsOn ? "has-light" : ""}" role="button" tabindex="0" data-room="${room.id}" aria-label="${escapeHtml(`${room.name}, ${status}`)}" style="--room-colour:${escapeHtml(summary.colour)}">
          <title>${escapeHtml(`${room.name}, ${status}`)}</title>
          <polygon points="${points}"></polygon>
        </g>
      `;
    }).join("");
    return `
      <div class="floorplan-canvas">
        <div class="floorplan-backdrop" aria-hidden="true"></div>
        <svg class="floorplan-visual" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Rooms on ${escapeHtml(floor.name)}">
          <image class="floorplan-image" href="${escapeHtml(imageSource)}" x="0" y="0" width="100" height="${viewHeight.toFixed(4)}" preserveAspectRatio="none" aria-hidden="true"></image>
          ${overlays}
          ${hotspots}
        </svg>
      </div>
    `;
  }

  _renderRoomDetail(room) {
    if (!room) return '<p class="hub-empty-state">Choose a room.</p>';
    const states = this._hass?.states || {};
    const summary = deriveRoomState(room, states, this._config.theme.accent);
    const readOnly = this._config.display.read_only === true;
    const disabled = readOnly ? ' disabled aria-disabled="true"' : "";
    const lights = room.lights.map((entityId) => {
      const state = states[entityId];
      const available = isEntityAvailable(state);
      const isOn = state?.state === "on";
      const name = entityName(state, entityId.split(".")[1]);
      const reportedBrightness = safeNumber(state?.attributes?.brightness, NaN);
      const lightDetail = isOn
        ? Number.isFinite(reportedBrightness) ? `${Math.round(reportedBrightness / 2.55)}%` : "On"
        : titleCase(state?.state || "unavailable");
      const toggleDisabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
      const actionLabel = available ? `Turn ${name} ${isOn ? "off" : "on"}` : `${name} unavailable`;
      return `
        <div class="control-row">
          <button type="button" class="control-main ${isOn ? "is-on" : ""}" data-toggle="${escapeHtml(entityId)}" aria-label="${escapeHtml(actionLabel)}" aria-pressed="${isOn}"${toggleDisabled}>
            <ha-icon icon="${ICONS.light}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(lightDetail)}</small></span>
          </button>
          <button type="button" class="icon-action" data-more-info="${escapeHtml(entityId)}" aria-label="Open light details"${disabled}><ha-icon icon="mdi:tune"></ha-icon></button>
        </div>
      `;
    }).join("");
    const climate = room.climate ? states[room.climate] : null;
    const climateAvailable = isEntityAvailable(climate) && Number.isFinite(summary.targetTemperature);
    const climateDisabled = readOnly || !climateAvailable ? ' disabled aria-disabled="true"' : "";
    const climateControl = room.climate ? `
      <div class="climate-control">
        <div><span>Temperature</span><strong>${formatTemperature(summary.temperature)}</strong><small>Target ${formatTemperature(summary.targetTemperature)}</small></div>
        <div class="stepper">
          <button type="button" data-climate-adjust="-0.5" data-entity="${escapeHtml(room.climate)}" aria-label="${climateAvailable ? "Lower target temperature" : "Temperature control unavailable"}"${climateDisabled}>−</button>
          <button type="button" data-climate-adjust="0.5" data-entity="${escapeHtml(room.climate)}" aria-label="${climateAvailable ? "Raise target temperature" : "Temperature control unavailable"}"${climateDisabled}>+</button>
        </div>
      </div>
    ` : "";
    const covers = room.covers.flatMap((entityId) => {
      const state = states[entityId];
      const available = isEntityAvailable(state);
      const name = entityName(state, entityId === this._controlPolicy.secureCover ? "Garage door" : "Blind");
      if (entityId === this._controlPolicy.secureCover) {
        return this._config.features.entry ? [`
          <div class="cover-control is-protected"><span><ha-icon icon="mdi:garage-variant" aria-hidden="true"></ha-icon><strong>${escapeHtml(name)}</strong><small>${escapeHtml(titleCase(state?.state || "unavailable"))} · protected action</small></span><div>
            <button type="button" data-view="entry" aria-label="Open Security for ${escapeHtml(name)}"><ha-icon icon="mdi:shield-home-outline" aria-hidden="true"></ha-icon></button>
          </div></div>
        `] : [];
      }
      const coverDisabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
      return [`
        <div class="cover-control"><span><ha-icon icon="${ICONS.cover}" aria-hidden="true"></ha-icon><strong>${escapeHtml(name)}</strong><small>${escapeHtml(titleCase(state?.state || "unavailable"))}</small></span><div>
          <button type="button" data-cover-action="open_cover" data-entity="${escapeHtml(entityId)}" aria-label="Open ${escapeHtml(name)}"${coverDisabled}><ha-icon icon="mdi:arrow-up" aria-hidden="true"></ha-icon></button>
          <button type="button" data-cover-action="stop_cover" data-entity="${escapeHtml(entityId)}" aria-label="Stop ${escapeHtml(name)}"${coverDisabled}><ha-icon icon="mdi:stop" aria-hidden="true"></ha-icon></button>
          <button type="button" data-cover-action="close_cover" data-entity="${escapeHtml(entityId)}" aria-label="Close ${escapeHtml(name)}"${coverDisabled}><ha-icon icon="mdi:arrow-down" aria-hidden="true"></ha-icon></button>
        </div></div>
      `];
    }).join("");
    const scenes = room.scenes.map((entityId) => {
      const state = states[entityId];
      const available = isEntityAvailable(state);
      const sceneDisabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
      const name = entityName(state, titleCase(entityId.split(".")[1]));
      return `<button type="button" class="scene-button" data-scene="${escapeHtml(entityId)}" aria-label="${escapeHtml(available ? `Activate ${name}` : `${name} unavailable`)}"${sceneDisabled}><ha-icon icon="${ICONS.scene}"></ha-icon>${escapeHtml(name)}</button>`;
    }).join("");
    const media = (this._config.features.music ? room.media_players : []).map((entityId) => {
      const state = states[entityId];
      const available = isEntityAvailable(state);
      const playing = state?.state === "playing";
      const name = entityName(state, "Speaker");
      const mediaDisabled = readOnly || !available ? ' disabled aria-disabled="true"' : "";
      const actionLabel = available ? `${playing ? "Pause" : "Play"} ${name}` : `${name} unavailable`;
      return `
        <button type="button" class="media-room-control" data-media-toggle="${escapeHtml(entityId)}" aria-label="${escapeHtml(actionLabel)}" aria-pressed="${playing}"${mediaDisabled}><ha-icon icon="${playing ? "mdi:pause-circle" : "mdi:play-circle"}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(state?.attributes?.media_title || titleCase(state?.state || "unavailable"))}</small></span></button>
      `;
    }).join("");
    const lightStatus = summary.totalLights === 0
      ? "No lights"
      : summary.availableLights === 0
        ? "Lighting unavailable"
        : summary.availableLights < summary.totalLights
          ? `${summary.lightsOn} on · ${summary.availableLights} of ${summary.totalLights} lights reporting`
          : `${summary.lightsOn} light${summary.lightsOn === 1 ? "" : "s"} on`;
    return `
      <div class="room-title"><span class="room-icon"><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><p class="eyebrow">${readOnly ? "Read-only room" : "Room controls"}</p><h2>${escapeHtml(room.name)}</h2><p>${escapeHtml(lightStatus)}${Number.isFinite(summary.temperature) ? ` · ${formatTemperature(summary.temperature)}` : ""}</p></div></div>
      ${readOnly ? '<p class="read-only-note"><ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon>Controls are disabled while this version is being checked.</p>' : ""}
      <div class="room-control-list">${climateControl}${lights}${covers}</div>
      ${scenes ? `<div class="scene-list"><p class="eyebrow">Scenes</p>${scenes}</div>` : ""}
      ${media ? `<div class="room-media"><p class="eyebrow">Music</p>${media}</div>` : ""}
      ${!climate && !lights && !covers && !scenes && !media ? '<p class="hub-empty-state">No controls are available for this room yet.</p>' : ""}
    `;
  }

  _renderSecurity() {
    const states = this._hass?.states || {};
    const entry = this._config.entry;
    const alarm = states[entry.alarm_entity];
    const garage = states[entry.garage.cover_entity];
    const readOnly = this._config.display.read_only === true;
    const confirmationGuard = this._pendingConfirmation ? ' inert aria-hidden="true"' : "";
    const garageState = entityStateValue(garage);
    const garageAction = garageState === "closed"
      ? "open_cover"
      : garageState === "open"
        ? "close_cover"
        : null;
    const garageActionAllowed = garageAction && isSecureCoverActionAllowed(garage, garageAction);
    const garageDisabled = readOnly || !garageActionAllowed ? ' disabled aria-disabled="true"' : "";
    const garageButtonLabel = garageAction === "open_cover"
      ? "Open garage"
      : garageAction === "close_cover"
        ? "Close garage"
        : garageState === "opening"
          ? "Opening…"
          : garageState === "closing"
            ? "Closing…"
            : "Unavailable";
    const garageActionLabel = garageAction === "open_cover"
      ? "Open garage door"
      : garageAction === "close_cover"
        ? "Close garage door"
        : `Garage door ${garageButtonLabel.toLowerCase()}`;
    const garageActionAttributes = garageActionAllowed
      ? ` data-secure-cover-action="${garageAction}" data-entity="${escapeHtml(entry.garage.cover_entity)}" data-action-label="${garageActionLabel}"`
      : "";
    const garageMotion = entry.garage.motion_entity
      ? binarySignalPresentation(states[entry.garage.motion_entity])
      : null;
    const alarmDisabled = (service) => readOnly || !isAlarmActionSupported(alarm, service)
      ? ' disabled aria-disabled="true"'
      : "";
    const cameraOperationPending = this._cameraSession?.phase === "stopping"
      || Boolean(this._cameraRecoveryPromise);
    const hasBlockedCamera = this._cameraBlockedIds.size > 0;
    const presentCamera = (camera) => {
      const signalDefinitions = [
        [camera.ringing_entity, "Ringing", "mdi:bell-ring-outline"],
        [camera.person_entity, "Person", "mdi:account-alert-outline"],
        [camera.motion_entity, "Motion", "mdi:motion-sensor"]
      ].filter(([entityId]) => entityId);
      const signals = signalDefinitions.map(([entityId, label, icon]) => {
        const signal = binarySignalPresentation(states[entityId]);
        return `<span class="security-signal ${signal.active ? "is-active" : ""} ${signal.available ? "" : "is-unavailable"}"><ha-icon icon="${icon}"></ha-icon><strong>${escapeHtml(label)}</strong><small>${signal.label}</small></span>`;
      }).join("");
      const cameraControl = this._controlPolicy.cameras.get(camera.id);
      const cameraEntityAvailable = Boolean(camera.entity_id) && isEntityAvailable(states[camera.entity_id]);
      const cameraAvailable = isCameraControlAvailable(cameraControl, states);
      const commandPairValid = Boolean(cameraControl?.startButton && cameraControl?.stopButton);
      const phase = cameraStreamPhase(states[camera.entity_id]);
      const session = this._cameraSession?.id === camera.id ? this._cameraSession : null;
      const isStarting = session?.phase === "starting";
      const isBuffering = session?.phase === "buffering";
      const isViewing = session?.phase === "viewing";
      const isStopping = session?.phase === "stopping";
      const retryBlockedCamera = this._canRetryBlockedCamera(camera.id);
      const isWaiting = !session && (cameraOperationPending || hasBlockedCamera && !retryBlockedCamera);
      const cameraError = this._cameraError?.id === camera.id ? this._cameraError.message : "";
      const cameraReady = ["idle", "preparing", "streaming"].includes(phase);
      const readOnlyStartBlocked = readOnly && cameraAvailable && cameraReady && phase !== "streaming";
      const canOpen = cameraAvailable
        && cameraReady
        && !session
        && !cameraOperationPending
        && (!hasBlockedCamera || retryBlockedCamera)
        && (!readOnly || phase === "streaming");
      const hasMountedStream = (isBuffering || isViewing) && phase === "streaming" && cameraAvailable;
      const cameraStatus = cameraError
        ? canOpen
          ? { label: "Retry available", icon: "mdi:refresh-circle" }
          : { label: "Live view unavailable", icon: "mdi:camera-off-outline" }
        : isWaiting
          ? { label: "Waiting…", icon: "mdi:shield-clock-outline" }
          : session
            ? cameraSessionPresentation(session.phase, phase)
            : readOnlyStartBlocked
              ? { label: "Stream off", icon: "mdi:lock-outline" }
              : cameraAvailable && cameraReady ? cameraSessionPresentation(null, phase) : null;
      const badgeLabel = cameraStatus?.label
        || (camera.entity_id
          ? cameraEntityAvailable && !commandPairValid
            ? "Controls unavailable"
            : cameraEntityAvailable && commandPairValid && !cameraReady
              ? "Not ready"
              : "Camera unavailable"
          : "Signals only");
      const badgeIcon = cameraStatus?.icon
        || (camera.entity_id
          ? cameraEntityAvailable && commandPairValid && !cameraReady
            ? "mdi:camera-clock-outline"
            : "mdi:camera-off-outline"
          : "mdi:shield-check-outline");
      return {
        camera,
        signals,
        cameraAvailable,
        cameraReady,
        readOnlyStartBlocked,
        canOpen,
        hasMountedStream,
        isStarting,
        isBuffering,
        isViewing,
        isStopping,
        isWaiting,
        cameraError,
        badgeLabel,
        badgeIcon,
        session
      };
    };
    const cameras = entry.cameras.map(presentCamera);
    const selectedId = this._cameraSession?.id || this._securityCameraId || entry.primary_camera_id || cameras[0]?.camera.id;
    const selected = cameras.find((item) => item.camera.id === selectedId) || cameras[0];
    const cameraCards = cameras.map((item) => {
      const waitingForSafeStop = item.isWaiting || item.isStopping;
      const retryAvailable = Boolean(item.cameraError && item.canOpen);
      const actionLabel = retryAvailable
        ? "Retry live view"
        : waitingForSafeStop
          ? "Camera controls unavailable while the secure stream closes"
          : item.cameraError
            ? "Live view unavailable"
            : !item.camera.entity_id
              ? `${escapeHtml(item.camera.name)} has signals only`
              : !item.cameraAvailable
                ? `${escapeHtml(item.camera.name)} camera unavailable`
                : !item.cameraReady
                  ? `${escapeHtml(item.camera.name)} camera not ready`
                  : item.readOnlyStartBlocked
                    ? `${escapeHtml(item.camera.name)} stream is off in read-only mode`
                    : `View ${escapeHtml(item.camera.name)} live`;
      const actionText = item.isViewing
        ? "Live"
        : waitingForSafeStop
          ? "Please wait"
          : retryAvailable
            ? "Retry"
            : item.cameraError
              ? "Unavailable"
              : !item.camera.entity_id
                ? "Signals only"
                : !item.cameraAvailable
                  ? "Unavailable"
                  : !item.cameraReady
                    ? "Not ready"
                    : item.readOnlyStartBlocked
                      ? "Stream off"
                      : "View live";
      const actionIcon = item.isViewing
        ? "mdi:video"
        : waitingForSafeStop
          ? "mdi:shield-clock-outline"
          : item.readOnlyStartBlocked
            ? "mdi:lock-outline"
            : item.canOpen
              ? "mdi:play-circle-outline"
              : "mdi:camera-off-outline";
      return `
        <article class="surface security-camera ${item.camera.id === selected?.camera.id ? "is-selected" : ""}">
          <div class="camera-tile-media">
            <div id="camera-poster-tile-${escapeHtml(item.camera.id)}" class="camera-poster-slot camera-tile-poster"><span class="camera-poster-fallback"><ha-icon icon="${item.camera.role === "doorbell" ? "mdi:doorbell-video" : "mdi:cctv"}"></ha-icon>Still unavailable</span></div>
            <button type="button" class="camera-poster-action" data-camera-open="${escapeHtml(item.camera.id)}" aria-label="${actionLabel}" ${item.canOpen ? "" : 'disabled aria-disabled="true"'}><span><ha-icon icon="${actionIcon}"></ha-icon>${actionText}</span></button>
          </div>
          <div class="camera-tile-details">
            <div class="security-card-heading"><div><p class="eyebrow">${escapeHtml(titleCase(item.camera.role))}</p><h2>${escapeHtml(item.camera.name)}</h2></div><span class="privacy-badge"><ha-icon icon="${item.badgeIcon}"></ha-icon>${item.badgeLabel}</span></div>
            ${item.signals ? `<div class="security-signals">${item.signals}</div>` : ""}
          </div>
        </article>
      `;
    }).join("");
    const bufferingMessage = selected?.session?.slow
      ? "Still loading—this camera is taking longer than usual. Keep this screen open."
      : "The secure stream is ready; waiting for the first picture.";
    const stageActionText = selected?.cameraError
      ? selected.canOpen ? "Retry" : "Unavailable"
      : !selected?.camera?.entity_id
        ? "Signals only"
        : !selected?.cameraAvailable
          ? "Unavailable"
          : !selected?.cameraReady
            ? "Not ready"
            : selected?.readOnlyStartBlocked
              ? "Read only"
              : "View live";
    const stageActionLabel = selected?.cameraError
      ? selected.canOpen ? "Retry live view" : "Live view unavailable"
      : !selected?.camera?.entity_id
        ? "Live video is not configured for this signals-only camera"
        : !selected?.cameraAvailable
          ? "Camera unavailable"
          : !selected?.cameraReady
            ? "Camera not ready"
            : selected?.readOnlyStartBlocked
              ? "Live stream is off in read-only mode"
              : "Start selected live view";
    const stageActionIcon = selected?.readOnlyStartBlocked
      ? "mdi:lock-outline"
      : selected?.canOpen ? "mdi:play" : "mdi:camera-off-outline";
    const stageStatus = selected?.isStarting
      ? { title: "Waking camera…", detail: `The latest ${selected.camera.name} still remains visible while the secure stream starts.`, icon: "mdi:loading" }
      : selected?.isBuffering
        ? { title: selected.session?.viewerRecoveryAttempted ? "Reconnecting video…" : "Loading video…", detail: bufferingMessage, icon: "mdi:loading" }
        : selected?.isStopping
          ? { title: "Stopping live view…", detail: "Closing the secure stream before another camera can open.", icon: "mdi:loading" }
          : selected?.isWaiting
            ? { title: "Waiting for camera…", detail: "The previous secure stream must become idle before another camera can open.", icon: "mdi:shield-clock-outline" }
            : null;
    const idleStageTitle = selected?.cameraError
      ? "Live view unavailable"
      : !selected?.camera?.entity_id
        ? "Signals only"
        : !selected?.cameraAvailable
          ? "Camera unavailable"
          : !selected?.cameraReady
            ? "Camera not ready"
            : selected?.readOnlyStartBlocked
              ? "Stream off"
              : "Tap the picture for live video";
    const idleStageDetail = selected?.cameraError
      ? selected.cameraError
      : !selected?.camera?.entity_id
        ? "Live video is not configured for this entry camera."
        : selected?.cameraAvailable
          ? selected?.cameraReady
            ? selected?.readOnlyStartBlocked
              ? "Read-only mode will not start this camera."
              : "This is the latest available still; live video starts only when you tap."
            : "Live view cannot start while the camera is in its current state."
          : "This camera is currently unavailable.";
    const selectedStream = `
      <div class="camera-stage-stack ${selected?.isViewing ? "is-live" : "is-poster"} ${!selected?.session ? "security-stage-poster" : ""}" data-camera-phase="${escapeHtml(selected?.session?.phase || "idle")}" ${!selected?.session && selected?.cameraError ? 'role="alert"' : ""}>
        <div id="camera-poster-stage-${escapeHtml(selected?.camera.id || "")}" class="camera-poster-slot camera-stage-poster-slot"><span class="camera-poster-fallback"><ha-icon icon="${selected?.camera.role === "doorbell" ? "mdi:doorbell-video" : "mdi:cctv"}"></ha-icon>Latest still unavailable</span></div>
        ${selected?.hasMountedStream ? `<slot id="camera-card-slot-${escapeHtml(selected.camera.id)}" name="camera-${escapeHtml(selected.camera.id)}" class="child-card-slot camera-card-slot"></slot>` : ""}
        ${selected?.isViewing ? '<span class="camera-live-indicator" role="status"><span></span>Live</span>' : ""}
        ${stageStatus ? `<div class="camera-stream-overlay camera-is-${escapeHtml(selected.session?.phase || "waiting")}" role="status" aria-live="polite" aria-busy="true"><ha-icon icon="${stageStatus.icon}"></ha-icon><div><strong>${escapeHtml(stageStatus.title)}</strong><small>${escapeHtml(stageStatus.detail)}</small></div></div>` : ""}
        ${!selected?.session && !selected?.isWaiting ? `<button type="button" class="camera-stage-action" data-camera-stage-open="${escapeHtml(selected?.camera.id || "")}" aria-label="${stageActionLabel}" ${selected?.canOpen ? "" : 'disabled aria-disabled="true"'}><span><strong>${escapeHtml(idleStageTitle)}</strong><small>${escapeHtml(idleStageDetail)}</small></span><b><ha-icon icon="${stageActionIcon}"></ha-icon>${stageActionText}</b></button>` : ""}
        ${selected?.session && !selected?.isStopping ? `<button type="button" class="camera-close" data-camera-close="${escapeHtml(selected.camera.id)}"><ha-icon icon="mdi:close"></ha-icon>${selected.isViewing ? "Close live view" : "Cancel"}</button>` : ""}
      </div>`;
    return `
      <section class="security-layout">
        <div class="security-main"${confirmationGuard}>
          <article class="security-stage" aria-label="Selected secure camera">
            <div class="security-stage-heading"><div><p class="eyebrow">Live view</p><h2>${escapeHtml(selected?.camera.name || "Entry camera")}</h2></div><span class="stage-privacy"><ha-icon icon="mdi:shield-lock-outline"></ha-icon>Private · on demand</span></div>
            <div class="security-stage-media">${selectedStream}</div>
          </article>
          <div class="security-camera-picker" aria-label="Choose an entry camera">${cameraCards}</div>
        </div>
        <aside class="security-sidebar"${confirmationGuard}>
          <article class="surface alarm-panel" tabindex="-1" aria-label="Home alarm controls">
            <div class="security-card-heading"><div><p class="eyebrow">Home alarm</p><h2>${escapeHtml(titleCase(alarm?.state || "unavailable"))}</h2></div><span class="alarm-state ${String(alarm?.state || "").includes("triggered") ? "is-alert" : ""} ${isEntityAvailable(alarm) ? "" : "is-unavailable"}"><ha-icon icon="${ICONS.security}"></ha-icon></span></div>
            <p>You’ll confirm before the alarm changes.</p>
            <div class="alarm-actions"><button type="button" data-alarm-action="alarm_arm_home" data-entity="${escapeHtml(entry.alarm_entity)}" data-action-label="Arm home"${alarmDisabled("alarm_arm_home")}><ha-icon icon="mdi:shield-home-outline"></ha-icon>Home</button><button type="button" data-alarm-action="alarm_arm_away" data-entity="${escapeHtml(entry.alarm_entity)}" data-action-label="Arm away"${alarmDisabled("alarm_arm_away")}><ha-icon icon="mdi:shield-lock-outline"></ha-icon>Away</button><button type="button" class="is-danger" data-alarm-action="alarm_disarm" data-entity="${escapeHtml(entry.alarm_entity)}" data-action-label="Disarm alarm"${alarmDisabled("alarm_disarm")}><ha-icon icon="mdi:shield-off-outline"></ha-icon>Disarm</button></div>
          </article>
          <article class="surface garage-panel" tabindex="-1" aria-label="Garage controls">
            <div class="garage-heading"><span><ha-icon icon="mdi:garage-variant"></ha-icon></span><div><p class="eyebrow">Garage door</p><h2>${escapeHtml(titleCase(garage?.state || "unavailable"))}</h2></div></div>
            ${garageMotion ? `<p class="garage-motion ${garageMotion.active ? "is-active" : ""} ${garageMotion.available ? "" : "is-unavailable"}"><ha-icon icon="mdi:motion-sensor"></ha-icon>${garageMotion.available ? garageMotion.active ? "Motion detected" : "No motion detected" : "Motion unavailable"}</p>` : ""}
            <button type="button" class="garage-action"${garageActionAttributes}${garageDisabled}><ha-icon icon="${garageAction === "open_cover" ? "mdi:garage-open-variant" : garageAction === "close_cover" ? "mdi:garage-alert-variant" : "mdi:garage-clock"}"></ha-icon>${garageButtonLabel}</button>
          </article>
          <p class="security-privacy-note"><ha-icon icon="mdi:shield-account-outline"></ha-icon>Entry cameras only. The viewer opens only when you choose it. A stream started here stops when you close the view, leave Security or after two minutes.</p>
        </aside>
        ${this._renderConfirmation()}
      </section>
    `;
  }

  _renderConfirmation() {
    if (!this._pendingConfirmation) return "";
    return `
      <div class="confirmation-backdrop" role="presentation">
        <section class="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title">
          <span><ha-icon icon="mdi:shield-alert-outline"></ha-icon></span>
          <p class="eyebrow">Please confirm</p>
          <h2 id="confirmation-title">${escapeHtml(this._pendingConfirmation.label)}</h2>
          <p>This is a protected household action. Nothing changes until you press Confirm.</p>
          <div><button type="button" data-confirm-action="cancel">Cancel</button><button type="button" class="confirm-primary" data-confirm-action="confirm">Confirm</button></div>
        </section>
      </div>
    `;
  }

  _renderFamily() {
    const locationEnabled = this._config.features.location_map;
    const choresEnabled = this._config.features.chores === true;
    const familyTitle = choresEnabled ? "Jobs & rewards" : this._config.features.school ? "School" : "Family overview";
    const children = this._config.people.filter((person) => person.role === "child");
    if (!locationEnabled) {
      return `
        <section class="family-dashboard">
          <header class="family-dashboard-heading"><div><p class="eyebrow">Family</p><h2>${familyTitle}</h2></div>${choresEnabled ? this._renderChoreOpsLink() : ""}</header>
          <div class="family-people-grid">${children.map((person) => this._renderFamilyPerson(person)).join("")}</div>
        </section>
      `;
    }
    return `
      <section class="family-layout">
        <article class="surface map-panel">
          <div class="section-heading"><div><p class="eyebrow">${locationEnabled ? "Family map" : "Family overview"}</p><h2>${locationEnabled ? "Presence & location" : "Private family summary"}</h2></div><span>${locationEnabled ? "Private to Home Assistant" : "Location sharing off"}</span></div>
          ${locationEnabled ? '<div id="map-card-slot" class="child-card-slot map-slot"></div>' : '<p class="hub-empty-state">Location sharing is disabled.</p>'}
        </article>
        <aside class="family-sidebar" aria-label="${choresEnabled ? "Family jobs and rewards" : "Family details"}">
          <div class="family-scroll-cue"><strong>${familyTitle}</strong><span><ha-icon icon="mdi:swap-vertical" aria-hidden="true"></ha-icon>Swipe for everyone</span></div>
          ${choresEnabled ? this._renderChoreOpsLink("family-sidebar-link") : ""}
          ${children.map((person) => this._renderFamilyPerson(person)).join("")}
        </aside>
      </section>
    `;
  }

  _renderChoreOpsLink(extraClass = "") {
    if (this._config.display.read_only || !this._config.features.chores) return "";
    const path = safeInternalDashboardPath(this._config.chores?.dashboard_path);
    if (!path) return "";
    return `<a class="choreops-link ${extraClass}" href="${escapeHtml(path)}" data-choreops-link="native"><ha-icon icon="mdi:arrow-right" aria-hidden="true"></ha-icon>Open ChoreOps</a>`;
  }

  _renderChoreOpsSummary(chore) {
    if (!chore) return "";
    const states = this._hass?.states || {};
    const firstSummary = (entityIds, kind) => {
      const entityId = entityIds?.[0];
      return entityId ? normaliseChoreOpsSummary(states[entityId], entityId, kind) : null;
    };
    const items = [
      firstSummary(chore.reward_status_entities, "reward"),
      firstSummary(chore.badge_progress_entities, "badge"),
      firstSummary(chore.achievement_progress_entities, "achievement")
    ].filter(Boolean);
    if (!items.length) return "";
    const labels = { reward: "Reward", badge: "Badge", achievement: "Achievement" };
    const rows = items.map((item) => `
      <div class="family-summary-item is-${escapeHtml(item.tone)}">
        <span><ha-icon icon="${escapeHtml(item.icon)}" aria-hidden="true"></ha-icon></span>
        <div><p>${labels[item.kind]}</p><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.label)}</small></div>
      </div>
    `).join("");
    return `<section class="family-summary-grid" aria-label="Rewards and progress">${rows}</section>`;
  }

  _renderFamilyPerson(person) {
    const states = this._hass?.states || {};
    const choresEnabled = this._config.features.chores === true;
    const chore = choresEnabled ? this._config.chores.users.find((entry) => entry.person_id === person.id) : null;
    const classroom = this._config.features.school
      ? this._config.school.classroom_students.find((entry) => entry.person_id === person.id)
      : null;
    const classroomState = classroom ? states[classroom.assignments_entity] : null;
    const classroomData = classroomAssignmentPresentation(classroomState);
    const assignments = classroomData.assignments;
    const assignmentCount = classroomData.available ? classroomData.count : NaN;
    const assignmentsTruncated = classroomData.truncated;
    const classroomStale = classroomState?.attributes?.data_stale === true;
    const pointsState = chore ? states[chore.points_entity] : null;
    const choresState = chore ? states[chore.chores_entity] : null;
    const pointsAvailable = isEntityAvailable(pointsState);
    const choresSummaryAvailable = isEntityAvailable(choresState);
    const points = pointsAvailable ? pointsState.state : null;
    const due = choresSummaryAvailable
      ? safeNumber(choresState.attributes?.chore_stat_current_due_today, 0)
      : NaN;
    const nextAssignment = assignments[0];
    const classroomLink = safeClassroomLink(nextAssignment?.alternate_link);
    const assignmentTitle = classroomLink
      ? `<a href="${escapeHtml(classroomLink)}" target="_blank" rel="noopener noreferrer" data-classroom-person="${escapeHtml(person.id)}">${escapeHtml(nextAssignment.title || "Assignment")}</a>`
      : `<strong>${escapeHtml(nextAssignment?.title || "Assignment")}</strong>`;
    const assignmentDue = nextAssignment?.due_at
      ? formatClassroomDueDay(nextAssignment.due_at, this._config.product.locale, this._config.product.timezone)
      : "No due date";
    const lastSuccessfulUpdate = classroomState?.attributes?.last_successful_update;
    const lastSuccessfulLabel = lastSuccessfulUpdate
      ? `${formatDay(lastSuccessfulUpdate, this._config.product.locale, this._config.product.timezone)} at ${formatTime(lastSuccessfulUpdate, this._config.product.locale, this._config.product.timezone)}`
      : null;
    const classroomError = String(classroomState?.attributes?.last_error || "Classroom update delayed").slice(0, 160);
    const classroomHealth = classroomStale
      ? `<span class="classroom-health is-stale"><ha-icon icon="mdi:cloud-alert-outline" aria-hidden="true"></ha-icon>${escapeHtml(classroomError)}${lastSuccessfulLabel ? ` · Last updated ${escapeHtml(lastSuccessfulLabel)}` : ""}</span>`
      : assignmentsTruncated
        ? `<span class="classroom-health"><ha-icon icon="mdi:format-list-numbered" aria-hidden="true"></ha-icon>Showing the next ${assignments.length} of ${assignmentCount} assignments</span>`
        : "";
    const classroomStatus = classroom && !classroomData.available
      ? '<div class="assignment is-stale"><ha-icon icon="mdi:school-outline"></ha-icon><div><strong>Classroom unavailable</strong><small>The last update could not be read. Home Assistant will retry.</small></div></div>'
      : nextAssignment
      ? `<div class="assignment ${classroomStale ? "is-stale" : ""}"><ha-icon icon="${ICONS.school}"></ha-icon><div>${assignmentTitle}<small>${escapeHtml(nextAssignment.course || "Google Classroom")} · ${escapeHtml(assignmentDue)}</small>${classroomHealth}</div></div>`
      : classroomStale
        ? `<div class="assignment is-stale"><ha-icon icon="mdi:cloud-alert-outline"></ha-icon><div><strong>Classroom update delayed</strong><small>${escapeHtml(classroomError)}${lastSuccessfulLabel ? ` · Last updated ${escapeHtml(lastSuccessfulLabel)}` : ""}</small></div></div>`
      : !this._config.features.school
        ? '<div class="assignment classroom-locked"><ha-icon icon="mdi:school-outline"></ha-icon><div><strong>Classroom ready after consent</strong><small>Read-only access will be connected separately for each child. No password belongs in this dashboard.</small></div></div>'
        : !classroom
          ? '<div class="assignment is-stale"><ha-icon icon="mdi:school-alert-outline"></ha-icon><div><strong>Classroom not connected</strong><small>This child still needs a separate read-only connection.</small></div></div>'
        : '<div class="assignment"><ha-icon icon="mdi:school-check-outline"></ha-icon><div><strong>No open assignments</strong><small>Google Classroom is up to date.</small></div></div>';
    const presence = this._config.features.location_map && person.location_entity
      ? titleCase(states[person.location_entity]?.state || "Location unavailable")
      : choresEnabled ? "Today’s jobs" : this._config.features.school ? "School" : "Family overview";
    const choreRows = (chore?.status_entities || []).map((entityId) => {
      const state = states[entityId];
      const presentation = normaliseChoreStatus(state, entityId);
      return `
        <li class="chore-row is-${escapeHtml(presentation.tone)}">
          <span class="chore-check"><ha-icon icon="${presentation.tone === "done" ? "mdi:check" : presentation.tone === "overdue" ? "mdi:alert" : "mdi:circle-small"}" aria-hidden="true"></ha-icon></span>
          <span><strong>${escapeHtml(presentation.name)}</strong><small>${escapeHtml(presentation.label)}${presentation.due ? ` · ${escapeHtml(formatTime(presentation.due, this._config.product.locale, this._config.product.timezone))}` : ""}</small></span>
          ${Number.isFinite(presentation.points) ? `<b>+${presentation.points}</b>` : ""}
        </li>
      `;
    }).join("");
    const choreOpsSummary = choresEnabled ? this._renderChoreOpsSummary(chore) : "";
    const choreHeading = choresEnabled && this._config.features.location_map
      ? `<div class="chore-heading"><p class="eyebrow">Today’s jobs</p><span>${choreRows ? `${(chore?.status_entities || []).length} jobs` : "None yet"}</span></div>`
      : "";
    const factItems = [
      ...(choresEnabled && chore ? [`<span><strong>${pointsAvailable ? escapeHtml(formatPoints(points, this._config.product.locale)) : "—"}</strong> points</span>`, `<span><strong>${Number.isFinite(due) ? due : "—"}</strong> due today</span>`] : []),
      ...(this._config.features.school ? [`<span><strong>${Number.isFinite(assignmentCount) ? assignmentCount : "—"}</strong> assignments</span>`] : [])
    ].join("");
    return `
      <article class="surface family-person" style="--person-colour:${escapeHtml(person.colour)}">
        <div class="family-person-heading"><span>${escapeHtml(person.name.slice(0, 1))}</span><div><p class="eyebrow">${escapeHtml(person.name)}</p><h2>${escapeHtml(presence)}</h2></div></div>
        ${factItems ? `<div class="family-facts">${factItems}</div>` : ""}
        ${choresEnabled && !chore ? '<p class="family-connection-warning"><ha-icon icon="mdi:alert-circle-outline" aria-hidden="true"></ha-icon>ChoreOps is not connected for this child.</p>' : choresEnabled && (!pointsAvailable || !choresSummaryAvailable) ? '<p class="family-connection-warning"><ha-icon icon="mdi:alert-circle-outline" aria-hidden="true"></ha-icon>ChoreOps data is currently unavailable.</p>' : ""}
        ${choreHeading}
        ${choresEnabled && chore ? choreRows ? `<ul class="chore-list" aria-label="Today’s jobs">${choreRows}</ul>` : '<p class="hub-empty-state compact">No jobs are due yet.</p>' : ""}
        ${choreOpsSummary}
        ${classroomStatus}
      </article>
    `;
  }

  _renderMusic() {
    const readOnly = this._config.display.read_only;
    return `
      <section class="music-experience">
        <article class="surface media-player-panel">
          <div class="section-heading music-heading"><div><p class="eyebrow">Spotify · Sonos</p><h2>${readOnly ? "Your full music player" : "Browse, group and play"}</h2></div><span class="music-meta">${this._config.media.players.length} rooms${readOnly ? ' · <ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon> playback locked' : ""}</span></div>
          <div class="media-player-stage ${readOnly ? "is-read-only" : ""}">
            <div id="music-card-slot" class="child-card-slot"></div>
          </div>
        </article>
      </section>
    `;
  }

  _footballState() {
    const states = this._hass?.states || {};
    const index = states[this._config.football.index_entity];
    const suggested = safeNumber(index?.attributes?.current_gameweek || index?.attributes?.next_gameweek || index?.state, 1);
    const gameweek = Math.max(1, Math.min(38, this._gameweek || suggested || 1));
    const gameweekState = states[`${this._config.football.gameweek_entity_prefix}${gameweek}`];
    const table = states[this._config.football.table_entity];
    return { index, gameweek, gameweekState, table };
  }

  _featuredFixtures() {
    const { index, gameweekState, table } = this._footballState();
    if (!isEntityAvailable(index) || !isEntityAvailable(gameweekState)) {
      return {
        title: "Spurs & Villa",
        html: this._config.football.spotlight_team_codes
          .map((code) => this._renderCompactUnavailableFavourite(code))
          .join("")
      };
    }
    const fixtures = gameweekState?.attributes?.events || [];
    const models = buildFavouriteClubModels(
      fixtures,
      this._config.football.spotlight_team_codes,
      isEntityAvailable(table) ? table.attributes?.rows || [] : []
    );
    const derby = favouriteDerbyFixture(models);
    const html = derby
      ? this._renderCompactFixture(derby, { derby: true })
      : models.map((model) => this._renderCompactFavourite(model)).join("");
    return {
      title: this._favouriteTitle(models),
      html: html || '<p class="hub-empty-state">No favourite clubs are configured yet.</p>'
    };
  }

  _renderCompactFixture(fixture, { favouriteCode = "", derby = false } = {}) {
    const status = normaliseFixtureStatus(fixture);
    const score = status === "upcoming"
      ? formatTime(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)
      : `${fixture.home_score ?? "–"}–${fixture.away_score ?? "–"}`;
    const favouriteAttribute = derby
      ? this._config.football.spotlight_team_codes.join(" ")
      : favouriteCode;
    return `
      <button type="button" class="compact-fixture ${derby ? "is-derby" : ""}" data-view="football" data-fixture-id="${escapeHtml(fixture.id ?? "")}"${favouriteAttribute ? ` data-favourite-code="${escapeHtml(favouriteAttribute)}"` : ""}>
        <span title="${escapeHtml(fixture.home?.name || "Home")}">${escapeHtml(compactClubName(fixture.home))}</span><strong>${escapeHtml(score)}</strong><span title="${escapeHtml(fixture.away?.name || "Away")}">${escapeHtml(compactClubName(fixture.away))}</span>
        <small>${escapeHtml(derby ? `Family derby · ${status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "Full time" : formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)}` : status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "Full time" : formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone))}</small>
      </button>
    `;
  }

  _renderCompactFavourite(model) {
    if (model.fixture) return this._renderCompactFixture(model.fixture, { favouriteCode: model.code });
    return `
      <button type="button" class="compact-fixture is-empty" data-view="football" data-favourite-code="${escapeHtml(model.code)}">
        <span class="compact-favourite-name">${escapeHtml(compactClubName(model.team))}</span><strong>—</strong><span>No match</span>
        <small>No fixture this matchweek</small>
      </button>
    `;
  }

  _renderCompactUnavailableFavourite(code) {
    const presentation = this._clubPresentation(code);
    return `
      <button type="button" class="compact-fixture is-empty is-unavailable" data-view="football" data-favourite-code="${escapeHtml(code)}">
        <span class="compact-favourite-name">${escapeHtml(presentation.label)}</span><strong>—</strong><span>Waiting</span>
        <small>Fixture data unavailable</small>
      </button>
    `;
  }

  _renderTeamMark(team, size = "small") {
    const crest = teamCrest(team);
    const code = team?.short_name || team?.code || String(team?.name || "?").slice(0, 3).toUpperCase();
    return `<span class="team-mark is-${escapeHtml(size)}"><strong aria-hidden="${crest ? "true" : "false"}">${escapeHtml(code)}</strong>${crest ? `<img data-team-crest src="${escapeHtml(crest)}" alt="${escapeHtml(`${team?.name || code} crest`)}">` : ""}</span>`;
  }

  _favouriteTitle(models) {
    return models.map((model) => (
      FOOTBALL_CLUB_PRESENTATION[model.code]?.label || compactClubName(model.team)
    )).join(" & ") || "Family football";
  }

  _footballMatchValue(fixture, status) {
    if (!fixture) return "—";
    return status === "upcoming"
      ? formatTime(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)
      : `${fixture.home_score ?? "–"} — ${fixture.away_score ?? "–"}`;
  }

  _footballMatchDetail(fixture, status) {
    if (!fixture) return "No fixture this matchweek";
    if (status === "live") return `LIVE · ${fixture.minutes || 0}'`;
    if (status === "finished") return "Full time";
    return formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone);
  }

  _clubPresentation(code) {
    return FOOTBALL_CLUB_PRESENTATION[code] || { label: code, primary: "#0C315D", accent: "#8FD8CB" };
  }

  _renderFavouriteHero(model) {
    const presentation = this._clubPresentation(model.code);
    const statusLabel = model.status === "live" ? `LIVE · ${model.fixture?.minutes || 0}'` : model.status === "finished" ? "FULL TIME" : model.status === "upcoming" ? "UP NEXT" : "NO MATCH";
    const venue = model.fixture ? model.is_home ? "Home against" : "Away at" : "This matchweek";
    return `
      <article class="favourite-hero-card is-${escapeHtml(model.status)}" data-favourite-code="${escapeHtml(model.code)}" data-fixture-id="${escapeHtml(model.fixture?.id ?? "")}" style="--club-primary:${presentation.primary};--club-accent:${presentation.accent}">
        <header class="favourite-club-heading">
          <div class="favourite-club-identity">${this._renderTeamMark(model.team, "favourite")}<div><small>Family favourite</small><strong>${escapeHtml(presentation.label)}</strong></div></div>
          <span class="favourite-match-status">${escapeHtml(statusLabel)}</span>
        </header>
        ${model.fixture ? `<div class="favourite-fixture-summary">
          <div class="favourite-opponent"><small>${escapeHtml(venue)}</small><strong>${escapeHtml(compactClubName(model.opponent))}</strong></div>
          ${this._renderTeamMark(model.opponent, "small")}
          <div class="favourite-result"><strong>${escapeHtml(this._footballMatchValue(model.fixture, model.status))}</strong><small>${escapeHtml(this._footballMatchDetail(model.fixture, model.status))}</small></div>
        </div>` : `<div class="favourite-fixture-summary is-empty"><ha-icon icon="mdi:calendar-blank-outline" aria-hidden="true"></ha-icon><div><strong>No fixture this matchweek</strong><small>${escapeHtml(`${presentation.label} remain pinned here.`)}</small></div></div>`}
      </article>
    `;
  }

  _renderUnavailableFavourite(code) {
    const presentation = this._clubPresentation(code);
    const team = { short_name: code, code, name: FOOTBALL_CLUB_NAMES[code] || code };
    return `
      <article class="favourite-hero-card is-unavailable" data-favourite-code="${escapeHtml(code)}" style="--club-primary:${presentation.primary};--club-accent:${presentation.accent}">
        <header class="favourite-club-heading">
          <div class="favourite-club-identity">${this._renderTeamMark(team, "favourite")}<div><small>Family favourite</small><strong>${escapeHtml(presentation.label)}</strong></div></div>
          <span class="favourite-match-status">WAITING</span>
        </header>
        <div class="favourite-fixture-summary is-empty"><ha-icon icon="mdi:cloud-alert-outline" aria-hidden="true"></ha-icon><div><strong>Fixture data unavailable</strong><small>Home Assistant will retry automatically.</small></div></div>
      </article>
    `;
  }

  _renderDerbyHero(models, fixture) {
    const status = normaliseFixtureStatus(fixture);
    const statusLabel = status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "FULL TIME" : "UP NEXT";
    return `
      <article class="favourite-hero-card is-derby is-${escapeHtml(status)}" data-favourite-code="${escapeHtml(models.map((model) => model.code).join(" "))}" data-fixture-id="${escapeHtml(fixture.id ?? "")}">
        <header class="derby-heading"><div><small>Family derby</small><strong>${escapeHtml(this._favouriteTitle(models))}</strong></div><span class="favourite-match-status">${escapeHtml(statusLabel)}</span></header>
        <div class="derby-fixture">
          <div class="derby-team">${this._renderTeamMark(fixture.home, "favourite")}<strong>${escapeHtml(compactClubName(fixture.home))}</strong></div>
          <div class="favourite-result"><strong>${escapeHtml(this._footballMatchValue(fixture, status))}</strong><small>${escapeHtml(this._footballMatchDetail(fixture, status))}</small></div>
          <div class="derby-team is-away">${this._renderTeamMark(fixture.away, "favourite")}<strong>${escapeHtml(compactClubName(fixture.away))}</strong></div>
        </div>
      </article>
    `;
  }

  _renderFavouriteStandings(models) {
    return `
      <article class="surface favourite-standings">
        <div><p class="eyebrow">Where they stand</p><h2>Premier League</h2></div>
        <div class="favourite-standing-list">${models.map((model) => {
          const presentation = this._clubPresentation(model.code);
          const position = safeNumber(model.standing?.position, NaN);
          const points = safeNumber(model.standing?.points, NaN);
          const goalDifference = safeNumber(model.standing?.goal_difference, NaN);
          const detail = Number.isFinite(points) && Number.isFinite(goalDifference)
            ? `${formatPoints(points, this._config.product.locale)} pts · ${goalDifference > 0 ? "+" : ""}${goalDifference} GD`
            : "Table position pending";
          return `<div class="favourite-standing" data-favourite-code="${escapeHtml(model.code)}" style="--club-primary:${presentation.primary};--club-accent:${presentation.accent}">${this._renderTeamMark(model.team)}<div><strong>${escapeHtml(presentation.label)}</strong><small>${escapeHtml(detail)}</small></div><b>${Number.isFinite(position) ? `#${position}` : "—"}</b></div>`;
        }).join("")}</div>
      </article>
    `;
  }

  _renderFootball() {
    const { index, gameweek, gameweekState, table } = this._footballState();
    const events = gameweekState?.attributes?.events || [];
    const available = index?.attributes?.available_gameweeks || Array.from({ length: 38 }, (_, position) => position + 1);
    const fixtureDataAvailable = isEntityAvailable(index) && isEntityAvailable(gameweekState);
    const favouriteModels = buildFavouriteClubModels(
      events,
      this._config.football.spotlight_team_codes,
      isEntityAvailable(table) ? table.attributes?.rows || [] : []
    );
    const derbyFixture = favouriteDerbyFixture(favouriteModels);
    const hasLiveFavourite = favouriteModels.some((model) => model.status === "live");
    const indexFreshness = footballFreshness(index);
    const freshness = !isEntityAvailable(index)
      ? indexFreshness
      : !isEntityAvailable(gameweekState)
        ? {
          status: "waiting",
          title: "Waiting for fixtures",
          detail: "The selected matchweek has not arrived yet."
        }
        : indexFreshness;
    const checkedLabel = index?.attributes?.last_checked
      ? `Checked ${formatTime(index.attributes.last_checked, this._config.product.locale, this._config.product.timezone)}`
      : "Awaiting first check";
    this._gameweek = gameweek;
    return `
      <section class="football-experience">
        <article class="football-favourites-stage ${hasLiveFavourite ? "is-live" : ""}">
          <div class="football-hero-heading"><div><p class="eyebrow">Premier League · Matchweek ${gameweek}</p><h2>${escapeHtml(this._favouriteTitle(favouriteModels))}</h2></div><span class="football-freshness is-${freshness.status}"><i></i><span><strong>${escapeHtml(freshness.title)}</strong><small>${escapeHtml(freshness.status === "live" ? `${freshness.detail} ${checkedLabel}.` : `${checkedLabel}.`)}</small></span></span></div>
          ${freshness.status === "live" ? "" : `<p class="football-health-note is-${freshness.status}" role="status">${escapeHtml(freshness.detail)}</p>`}
          <div class="favourite-hero-grid">${fixtureDataAvailable
            ? derbyFixture ? this._renderDerbyHero(favouriteModels, derbyFixture) : favouriteModels.map((model) => this._renderFavouriteHero(model)).join("")
            : this._config.football.spotlight_team_codes.map((code) => this._renderUnavailableFavourite(code)).join("")}</div>
        </article>
        <div class="football-layout">
          <article class="surface football-main">
          <div class="football-toolbar">
            <div><p class="eyebrow">Match centre</p><h2>Matchweek ${gameweek}</h2></div>
            <div class="matchweek-controls">
              <button type="button" data-gameweek="${Math.max(1, gameweek - 1)}" ${gameweek <= 1 ? "disabled" : ""} aria-label="Previous matchweek"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
              <label><span class="sr-only">Choose matchweek</span><select data-gameweek-select>${available.map((entry) => `<option value="${entry}" ${entry === gameweek ? "selected" : ""}>MW ${entry}</option>`).join("")}</select></label>
              <button type="button" data-gameweek="${Math.min(38, gameweek + 1)}" ${gameweek >= 38 ? "disabled" : ""} aria-label="Next matchweek"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
            </div>
            <div class="segments football-tabs" role="group" aria-label="Football view">
              <button type="button" class="segment ${this._footballTab === "fixtures" ? "is-selected" : ""}" data-football-tab="fixtures" aria-pressed="${this._footballTab === "fixtures"}">Fixtures</button>
              <button type="button" class="segment ${this._footballTab === "table" ? "is-selected" : ""}" data-football-tab="table" aria-pressed="${this._footballTab === "table"}">Table</button>
            </div>
          </div>
          ${this._footballTab === "table" ? this._renderLeagueTable(table) : this._renderFixtures(events, fixtureDataAvailable)}
          </article>
          <aside class="football-sidebar">
            ${this._renderFavouriteStandings(favouriteModels)}
          </aside>
        </div>
      </section>
    `;
  }

  _renderFixtures(events, available = true) {
    if (!available) return '<p class="hub-empty-state large">Fixture data is unavailable. Home Assistant will retry.</p>';
    if (!events.length) return `
      <div class="football-empty">
        <span class="football-orbit"><ha-icon icon="mdi:soccer" aria-hidden="true"></ha-icon></span>
        <div><p class="eyebrow">Between matchweeks</p><h3>No fixtures yet</h3><p>We’ll show the next Spurs or Aston Villa match here as soon as it is announced.</p></div>
        <div class="empty-clubs"><span>TOT</span><i></i><span>AVL</span></div>
      </div>
    `;
    const grouped = new Map();
    for (const fixture of events) {
      const key = formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(fixture);
    }
    return `<div class="fixture-groups">${[...grouped.entries()].map(([day, fixtures]) => `
      <section class="fixture-day"><h3>${escapeHtml(day)}</h3>${fixtures.map((fixture) => this._renderFixture(fixture)).join("")}</section>
    `).join("")}</div>`;
  }

  _renderFixture(fixture) {
    const status = normaliseFixtureStatus(fixture);
    const score = status === "upcoming"
      ? formatTime(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)
      : `${fixture.home_score ?? "–"} — ${fixture.away_score ?? "–"}`;
    const scorers = [
      ...(fixture.home_scorers || []).map((name) => `${name} (H)`),
      ...(fixture.away_scorers || []).map((name) => `${name} (A)`)
    ];
    const favouriteCodes = this._config.football.spotlight_team_codes.filter((code) => fixtureIncludesTeam(fixture, code));
    return `
      <div class="fixture ${fixture.spotlight ? "is-spotlight" : ""} ${status === "live" ? "is-live" : ""}"${favouriteCodes.length ? ` data-favourite-code="${escapeHtml(favouriteCodes.join(" "))}"` : ""}>
        <span class="team home-team">${this._renderTeamMark(fixture.home)}<span>${escapeHtml(fixture.home?.name || "Home")}</span></span>
        <strong class="fixture-score">${escapeHtml(score)}<small>${status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "FT" : ""}</small></strong>
        <span class="team away-team"><span>${escapeHtml(fixture.away?.name || "Away")}</span>${this._renderTeamMark(fixture.away)}</span>
        ${scorers.length ? `<span class="scorers">${escapeHtml(scorers.join(" · "))}</span>` : ""}
      </div>
    `;
  }

  _renderLeagueTable(tableState) {
    if (!isEntityAvailable(tableState)) return '<p class="hub-empty-state large">League table data is unavailable. Home Assistant will retry.</p>';
    const rows = tableState?.attributes?.rows || [];
    if (!rows.length) return '<p class="hub-empty-state large">The league table will appear after the first results.</p>';
    return `
      <div class="league-table-wrap"><table class="league-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${rows.map((row) => `<tr class="${row.spotlight ? "is-spotlight" : ""}"><td>${row.position}</td><td><strong>${escapeHtml(row.name)}</strong></td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.goal_difference > 0 ? "+" : ""}${row.goal_difference}</td><td><strong>${row.points}</strong></td></tr>`).join("")}
      </tbody></table></div>
    `;
  }

  _activeChildCardKeys() {
    const keys = new Set();
    if (!this._config) return keys;
    if (this._view === "calendar" && this._config.features?.calendar !== false) {
      keys.add(`calendar:${this._calendarMode}`);
    }
    if (this._view === "family" && this._config.features?.location_map) keys.add("map");
    if (this._view === "music" && this._config.features?.music !== false) keys.add("music");
    if (this._view === "rooms"
      && this._homeSection === "cleaning"
      && this._config.features?.cleaning
      && this._config.cleaning?.map_entity) keys.add("vacuum-map");
    if (this._view === "entry" && this._config.features?.entry !== false) {
      const cameras = this._config.entry?.cameras || [];
      for (const camera of cameras) {
        if (camera.entity_id) keys.add(`camera-poster:tile:${camera.id}`);
      }
      const selectedId = this._cameraSession?.id
        || this._securityCameraId
        || this._config.entry?.primary_camera_id
        || cameras[0]?.id;
      if (cameras.some((camera) => camera.id === selectedId && camera.entity_id)) {
        keys.add(`camera-poster:stage:${selectedId}`);
      }
      const liveCamera = cameras.find((camera) => camera.id === this._activeCameraId);
      if (liveCamera?.entity_id
        && ["buffering", "viewing"].includes(this._cameraSession?.phase)
        && cameraStreamPhase(this._hass?.states?.[liveCamera.entity_id]) === "streaming") {
        keys.add(`camera:${liveCamera.id}`);
      }
    }
    return keys;
  }

  _removeChildCard(key) {
    const child = this._childCards?.get?.(key);
    this._invalidateChildHass(key);
    child?.__familyCameraObserverCleanup?.();
    child?.remove?.();
    this._childCards?.delete?.(key);
  }

  _pruneInactiveChildCards() {
    if (!(this._childCards instanceof Map)) return;
    const activeKeys = this._activeChildCardKeys();
    for (const key of [...this._childCards.keys()]) {
      if (!activeKeys.has(key)) this._removeChildCard(key);
    }
  }

  _mountChildCards() {
    if (!this._hass || !globalThis.loadCardHelpers) return;
    this._pruneInactiveChildCards();
    if (this._view === "calendar") {
      const viewMap = {
        day: "schedule",
        week: "week-compact",
        month: "month",
        agenda: "agenda"
      };
      const calendarNames = Object.fromEntries(this._config.calendar.entities.map((entry) => [entry.entity_id, entry.label]));
      const colours = Object.fromEntries(this._config.calendar.entities.map((entry) => [entry.entity_id, entry.colour]));
      const calendarIcons = Object.fromEntries(this._config.calendar.entities.map((entry) => [
        entry.entity_id,
        /school/i.test(`${entry.label} ${entry.entity_id}`) ? "mdi:school-outline" : "mdi:home-heart"
      ]));
      this._ensureChildCard(`calendar:${this._calendarMode}`, {
        type: this._config.calendar.card_type,
        title: "",
        entities: this._config.calendar.entities.map((entry) => entry.entity_id),
        calendar_names: calendarNames,
        calendar_badge_icons: calendarIcons,
        colors: colours,
        default_view: viewMap[this._calendarMode] || "week-compact",
        ...(this._calendarMode === "day" ? { rolling_days_schedule: 1 } : {}),
        rolling_days_agenda: this._config.calendar.rolling_days,
        first_day_of_week: 1,
        week_days: [0, 1, 2, 3, 4, 5, 6],
        use_24hr_schedule: true,
        shorten_event_times: true,
        show_event_location: true,
        show_current_time_bar: true,
        past_event_mode: "muted",
        show_header_controls: true,
        hide_navigation_buttons: false,
        hide_calendars: false,
        hide_view_selector: true,
        hide_add_event_button: true,
        hide_dark_mode_toggle: true,
        enable_event_management: false,
        readonly_calendars: this._config.calendar.entities.map((entry) => entry.entity_id),
        preference_storage_key: this._config.calendar.preference_storage_key,
        compact_header: true,
        compact_height: true,
        color_scheme: "light",
        language: this._config.product.locale.split("-")[0],
        locale: this._config.product.locale,
        time_zone: this._config.product.timezone
      }, "calendar-card-slot");
    }
    if (this._view === "family" && this._config.features.location_map) {
      this._ensureChildCard("map", {
        type: "map",
        auto_fit: true,
        fit_zones: true,
        hours_to_show: this._config.location.hours_to_show,
        entities: this._config.location.entities
      }, "map-card-slot");
    }
    if (this._view === "music") {
      const mediaPlayers = this._config.media.players.map((player) => ({
        ...player,
        ...(player.ma_entity_id ? {
          media_browser: player.media_browser || [{ entity_id: player.ma_entity_id, name: "Spotify & Music" }]
        } : {})
      }));
      this._ensureChildCard("music", {
        type: this._config.media.card_type,
        size: "large",
        mode: "in-card",
        entity_id: this._config.media.initial_player,
        media_players: mediaPlayers,
        options: {
          player_is_active_when: "playing_or_paused",
          show_volume_step_buttons: true,
          default_tab: "massive",
          transparent_background_on_home: false
        }
      }, "music-card-slot");
    }
    if (this._view === "rooms" && this._homeSection === "cleaning" && this._config.cleaning.map_entity) {
      this._ensureChildCard("vacuum-map", {
        type: "picture-entity",
        entity: this._config.cleaning.map_entity,
        camera_view: "auto",
        show_name: false,
        show_state: false
      }, "vacuum-map-card-slot");
    }
    if (this._view === "entry") {
      const posterConfig = (camera) => ({
        type: "picture-entity",
        entity: camera.entity_id,
        camera_view: "auto",
        aspect_ratio: "16:9",
        fit_mode: "cover",
        show_name: false,
        show_state: false,
        tap_action: { action: "none" },
        hold_action: { action: "none" },
        double_tap_action: { action: "none" }
      });
      for (const camera of this._config.entry.cameras || []) {
        if (!camera.entity_id) continue;
        this._ensureChildCard(
          `camera-poster:tile:${camera.id}`,
          posterConfig(camera),
          `camera-poster-tile-${camera.id}`
        );
      }
      const selectedId = this._cameraSession?.id
        || this._securityCameraId
        || this._config.entry.primary_camera_id
        || this._config.entry.cameras?.[0]?.id;
      const selected = this._config.entry.cameras.find((camera) => camera.id === selectedId);
      if (selected?.entity_id) {
        this._ensureChildCard(
          `camera-poster:stage:${selected.id}`,
          posterConfig(selected),
          `camera-poster-stage-${selected.id}`
        );
      }
    }
    if (this._view === "entry"
      && ["buffering", "viewing"].includes(this._cameraSession?.phase)
      && this._activeCameraId) {
      const camera = this._config.entry.cameras.find((entry) => entry.id === this._activeCameraId);
      if (camera?.entity_id && cameraStreamPhase(this._hass.states?.[camera.entity_id]) === "streaming") {
        this._ensureChildCard(`camera:${camera.id}`, {
          type: "picture-entity",
          entity: camera.entity_id,
          camera_view: "live",
          aspect_ratio: "16:9",
          fit_mode: "cover",
          show_name: false,
          show_state: false,
          tap_action: { action: "none" },
          hold_action: { action: "none" },
          double_tap_action: { action: "none" }
        }, `camera-card-slot-${camera.id}`);
      }
    }
  }

  async _ensureChildCard(key, cardConfig, slotId) {
    const slot = this.shadowRoot.getElementById(slotId);
    const mountGeneration = this._childMountGeneration;
    if (!slot || !this.isConnected || !this._activeChildCardKeys().has(key)) return;
    let child = this._childCards.get(key);
    if (!child) {
      try {
        const helpers = await globalThis.loadCardHelpers();
        if (!this.isConnected
          || this._childMountGeneration !== mountGeneration
          || !this._activeChildCardKeys().has(key)
          || !this._isCurrentCameraSlot(key, slotId, slot)) return;
        child = helpers.createCardElement(cardConfig);
        child.classList.add("embedded-card");
        this._childCards.set(key, child);
      } catch (error) {
        const message = key.startsWith("camera:")
          ? "The secure live view could not load. Please try again."
          : key.startsWith("camera-poster:")
            ? "The latest camera still is unavailable."
            : `This Home Assistant card could not load: ${escapeHtml(error?.message || error)}`;
        slot.innerHTML = `<p class="hub-empty-state">${message}</p>`;
        return;
      }
    }
    if (!this.isConnected
      || this._childMountGeneration !== mountGeneration
      || !this._activeChildCardKeys().has(key)
      || !this._isCurrentCameraSlot(key, slotId, slot)) return;
    if (key === "music") {
      const readOnly = this._config.display.read_only === true;
      child.inert = false;
      if (readOnly) {
        child.setAttribute("aria-disabled", "true");
        child.dataset.readOnlyGuard = "service-boundary";
      } else {
        child.removeAttribute("aria-disabled");
        delete child.dataset.readOnlyGuard;
      }
    }
    if (key.startsWith("calendar:") || key.startsWith("camera-poster:") || key === "vacuum-map") {
      child.inert = false;
      child.setAttribute("data-read-only-guard", "service-boundary");
      child.setAttribute("aria-label", key.startsWith("calendar:") ? "Read-only family calendar" : "Latest camera still");
      if (key.startsWith("camera-poster:")) child.inert = true;
    }
    if (key.startsWith("camera:")) {
      const buffering = this._cameraSession?.phase === "buffering";
      child.inert = buffering;
      child.setAttribute("data-read-only-guard", "service-boundary");
      child.setAttribute("aria-label", "Read-only camera view");
      if (buffering) child.setAttribute("aria-hidden", "true");
      else child.removeAttribute("aria-hidden");
    }
    child.hass = this._hassForChild(key);
    if (key.startsWith("camera:")) {
      child.slot = `camera-${key.slice("camera:".length)}`;
      if (child.parentElement !== this) this.append(child);
      const cameraId = key.slice("camera:".length);
      const sessionToken = this._cameraSession?.token;
      if (child.__familyCameraObserverToken !== sessionToken) {
        child.__familyCameraObserverCleanup?.();
        this._observeCameraMedia(child, cameraId, sessionToken);
      }
    } else {
      slot.replaceChildren(child);
    }
  }

  _isCurrentCameraSlot(key, slotId, slot) {
    if (this.shadowRoot.getElementById(slotId) !== slot) return false;
    if (!key.startsWith("camera:")) return true;
    const cameraId = key.slice("camera:".length);
    return this._view === "entry"
      && this._cameraSession?.id === cameraId
      && ["buffering", "viewing"].includes(this._cameraSession?.phase)
      && cameraStreamPhase(this._hass?.states?.[this._controlPolicy.cameras.get(cameraId)?.entity]) === "streaming"
      && this.shadowRoot.getElementById(slotId) === slot;
  }

  _observeCameraMedia(child, cameraId, sessionToken) {
    let closed = false;
    let frameReady = false;
    let readyMediaElement = null;
    let scanTimer = null;
    const observedRoots = new Map();
    const mediaReady = (media) => {
      if (media?.tagName === "VIDEO") return media.readyState >= 2;
      return false;
    };
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (scanTimer !== null) clearTimeout(scanTimer);
      for (const [root, observer] of observedRoots) {
        observer?.disconnect();
        root.removeEventListener("load", markReady, true);
        root.removeEventListener("loadeddata", markReady, true);
        root.removeEventListener("playing", markReady, true);
        root.removeEventListener("canplay", markReady, true);
        root.removeEventListener("stalled", markLost, true);
        root.removeEventListener("waiting", markLost, true);
        root.removeEventListener("ended", markLost, true);
        root.removeEventListener("emptied", markLost, true);
        root.removeEventListener("error", markLost, true);
      }
      observedRoots.clear();
    };
    const markReady = (event) => {
      const media = event?.target;
      if (!mediaReady(media)) return;
      frameReady = true;
      readyMediaElement = media;
      this._markCameraFrameReady(cameraId, sessionToken, child);
    };
    const reportLost = (terminal = false) => {
      if (!frameReady) return;
      frameReady = false;
      readyMediaElement = null;
      this._markCameraMediaLost(cameraId, sessionToken, child, { terminal });
    };
    const markLost = (event) => {
      if (event?.target?.tagName !== "VIDEO") return;
      reportLost(["ended", "emptied", "error"].includes(event.type));
    };
    const scheduleScan = (delay = 100) => {
      if (closed) return;
      if (scanTimer !== null) clearTimeout(scanTimer);
      scanTimer = setTimeout(() => {
        scanTimer = null;
        inspect();
      }, delay);
    };
    const observeRoot = (root) => {
      if (!root || observedRoots.has(root)) return;
      root.addEventListener("load", markReady, true);
      root.addEventListener("loadeddata", markReady, true);
      root.addEventListener("playing", markReady, true);
      root.addEventListener("canplay", markReady, true);
      root.addEventListener("stalled", markLost, true);
      root.addEventListener("waiting", markLost, true);
      root.addEventListener("ended", markLost, true);
      root.addEventListener("emptied", markLost, true);
      root.addEventListener("error", markLost, true);
      const observer = typeof MutationObserver === "function"
        ? new MutationObserver(() => scheduleScan(0))
        : null;
      observer?.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
      observedRoots.set(root, observer);
    };
    const inspectRoot = (root) => {
      if (!root || closed) return null;
      observeRoot(root);
      if (root.shadowRoot) {
        const readyInOwnShadow = inspectRoot(root.shadowRoot);
        if (readyInOwnShadow) return readyInOwnShadow;
      }
      for (const element of root.querySelectorAll?.("*") || []) {
        if (mediaReady(element)) return element;
        if (element.shadowRoot) {
          const readyInNestedShadow = inspectRoot(element.shadowRoot);
          if (readyInNestedShadow) return readyInNestedShadow;
        }
      }
      return null;
    };
    const inspect = () => {
      if (closed) return;
      const readyMedia = inspectRoot(child);
      if (readyMedia) {
        markReady({ target: readyMedia });
        return;
      }
      if (frameReady && (!readyMediaElement?.isConnected || !mediaReady(readyMediaElement))) reportLost(false);
      scheduleScan();
    };
    child.__familyCameraObserverToken = sessionToken;
    child.__familyCameraObserverCleanup = cleanup;
    inspect();
  }

  _invalidateChildHass(key = null) {
    if (!(this._childHassTokens instanceof Map)) this._childHassTokens = new Map();
    if (key === null) {
      for (const activeKey of [...this._childHassTokens.keys()]) this._invalidateChildHass(activeKey);
      this._childHassTokens.clear();
      this._readOnlyHassSource = null;
      this._readOnlyHass = new Map();
      this._musicHassSource = null;
      this._musicHass = null;
      return;
    }
    const token = this._childHassTokens.get(key);
    if (token) {
      token.active = false;
      for (const cleanup of token.cleanups || []) {
        try { cleanup(); } catch { /* Child subscriptions are best-effort cleanup. */ }
      }
      token.cleanups?.clear?.();
    }
    this._childHassTokens.delete(key);
    this._readOnlyHass?.delete?.(key);
    if (key === "music") {
      this._musicHassSource = null;
      this._musicHass = null;
    }
  }

  _childHassGuard(key) {
    if (!(this._childHassTokens instanceof Map)) this._childHassTokens = new Map();
    const token = { active: true, cleanups: new Set() };
    this._childHassTokens.set(key, token);
    const guard = () => token.active && this._childHassTokens.get(key) === token;
    guard.onRevoke = (cleanup) => {
      if (typeof cleanup !== "function") return () => undefined;
      if (!guard()) {
        cleanup();
        return () => undefined;
      }
      token.cleanups.add(cleanup);
      return () => token.cleanups.delete(cleanup);
    };
    return guard;
  }

  _hassForChild(key) {
    const forceReadOnly = key.startsWith("calendar:")
      || key.startsWith("camera:")
      || key.startsWith("camera-poster:")
      || key === "map"
      || key === "vacuum-map";
    if (!this._hass) return this._hass;
    if (key === "music" && !this._config?.display?.read_only) {
      if (this._musicHassSource !== this._hass || !this._musicHass) {
        this._invalidateChildHass(key);
        this._musicHassSource = this._hass;
        this._musicHass = createControlledMediaHass(
          this._hass,
          this._controlPolicy,
          this._childHassGuard(key)
        );
      }
      return this._musicHass;
    }
    if (!forceReadOnly && key !== "music") return this._hass;
    if (this._readOnlyHassSource !== this._hass) {
      for (const cachedKey of this._readOnlyHass?.keys?.() || []) this._invalidateChildHass(cachedKey);
      this._readOnlyHassSource = this._hass;
      this._readOnlyHass = new Map();
    }
    if (this._readOnlyHass.has(key)) return this._readOnlyHass.get(key);
    this._invalidateChildHass(key);
    const source = this._hass;
    const isActive = this._childHassGuard(key);
    const cameraId = key.startsWith("camera:")
      ? key.slice("camera:".length)
      : key.startsWith("camera-poster:")
        ? key.split(":").at(-1)
        : null;
    const cameraEntity = key === "vacuum-map"
      ? this._config.cleaning.map_entity || null
      : cameraId ? this._controlPolicy.cameras.get(cameraId)?.entity || null : null;
    const calendarEntities = new Set(key.startsWith("calendar:")
      ? this._config.calendar.entities.map((entry) => entry.entity_id)
      : []);
    const allowMessage = (message) => isReadOnlyChildMessageAllowed(message, {
      cameraEntity,
      allowCameraStream: key.startsWith("camera:"),
      calendarEntities
    });
    const scopedEntityIds = key.startsWith("calendar:")
      ? this._config.calendar.entities.map((entry) => entry.entity_id)
      : key === "map"
        ? [
            ...(this._config.location?.entities || []),
            ...Object.keys(source.states || {}).filter((entityId) => entityId.startsWith("zone."))
          ]
        : cameraEntity ? [cameraEntity] : [];
    const scopedStates = Object.freeze(Object.fromEntries(
      [...new Set(scopedEntityIds)]
        .filter((entityId) => source.states?.[entityId])
        .map((entityId) => [entityId, source.states[entityId]])
    ));
    const connection = guardedChildConnection(source.connection, allowMessage, isActive);
    const readOnlyHass = guardedChildHass(source, {
      states: scopedStates,
      callService: () => Promise.resolve(undefined),
      // Native read-only cards use the guarded websocket protocol. Do not
      // expose a generic REST GET bridge that could fetch another camera.
      callApi: (method, path, ...args) => isActive() && isAllowedCalendarApiRequest(method, path, calendarEntities)
        ? guardedChildResult(source.callApi?.(String(method || "GET").toUpperCase(), String(path), ...args), isActive)
        : Promise.resolve(undefined),
      callWS: (message, ...args) => {
        const snapshot = snapshotChildObject(message);
        return isActive() && snapshot && allowMessage(snapshot)
          ? guardedChildResult(source.callWS?.(snapshot, ...args), isActive)
          : Promise.resolve(undefined);
      },
      ...(connection ? { connection } : {})
    }, isActive);
    this._readOnlyHass.set(key, readOnlyHass);
    return readOnlyHass;
  }

  _handleKeydown(event) {
    if (this._pendingConfirmation) {
      if (event.key === "Escape") {
        event.preventDefault();
        this._pendingConfirmation = null;
        this._scheduleRender(true);
        return;
      }
      if (event.key === "Tab") {
        const controls = [...this.shadowRoot.querySelectorAll('.confirmation-dialog button:not([disabled])')];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        const active = this.shadowRoot.activeElement;
        if (event.shiftKey && (active === first || !controls.includes(active))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (active === last || !controls.includes(active))) {
          event.preventDefault();
          first.focus();
        }
      }
      return;
    }
    const target = event.target.closest?.("[data-room]");
    if (!target || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    this._selectRoom(target.dataset.room);
  }

  _handleChange(event) {
    const select = event.target.closest?.("[data-gameweek-select]");
    if (!select) return;
    this._gameweek = Math.max(1, Math.min(38, safeNumber(select.value, 1)));
    this._scheduleRender(true);
  }

  _handleClick(event) {
    const target = event.target.closest?.("button, [data-room]");
    if (!target) return;
    if (this._pendingConfirmation && !target.dataset.confirmAction) return;
    if (target.dataset.homeTarget) {
      if (!this._enabledViews().some((view) => view.id === "rooms")) return;
      this._view = "rooms";
      this._homeSection = target.dataset.homeTarget;
      this._childMountGeneration += 1;
      this._pruneInactiveChildCards();
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.view) {
      if (!this._enabledViews().some((view) => view.id === target.dataset.view)) return;
      if (this._view === "entry" && target.dataset.view !== "entry") this._closeActiveCamera({ render: false, invalidate: true });
      this._view = target.dataset.view;
      this._childMountGeneration += 1;
      this._pruneInactiveChildCards();
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.homeSection) {
      const allowedHomeSections = new Set([
        "rooms",
        "lights",
        "heating",
        "covers",
        ...(this._config.features.cleaning ? ["cleaning"] : [])
      ]);
      if (!this._config.features.rooms || !allowedHomeSections.has(target.dataset.homeSection)) return;
      this._homeSection = target.dataset.homeSection;
      this._childMountGeneration += 1;
      this._pruneInactiveChildCards();
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.calendarMode) {
      this._calendarMode = target.dataset.calendarMode;
      this._childMountGeneration += 1;
      this._pruneInactiveChildCards();
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.floor) {
      this._floor = target.dataset.floor;
      this._room = this._config.floorplan.floors.find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || null;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.room) {
      this._selectRoom(target.dataset.room);
      return;
    }
    if (target.dataset.footballTab) {
      this._footballTab = target.dataset.footballTab;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.gameweek) {
      this._gameweek = safeNumber(target.dataset.gameweek, 1);
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.cameraOpen) {
      void this._openCamera(target.dataset.cameraOpen);
      return;
    }
    if (target.dataset.cameraStageOpen) {
      void this._openCamera(target.dataset.cameraStageOpen);
      return;
    }
    if (target.dataset.cameraClose) {
      this._closeActiveCamera();
      return;
    }
    if (target.dataset.confirmAction) {
      if (target.dataset.confirmAction === "confirm" && this._pendingConfirmation && !this._config.display.read_only) {
        const action = this._pendingConfirmation;
        const currentState = this._hass?.states?.[action.entity];
        const stateUnchanged = isConfirmationStillValid(action, currentState);
        const approved = action.domain === "alarm_control_panel"
          ? this._config.features.entry
            && action.entity === this._controlPolicy.alarm
            && stateUnchanged
            && isAlarmActionSupported(currentState, action.service)
          : action.domain === "cover"
            && this._config.features.entry
            && action.entity === this._controlPolicy.secureCover
            && stateUnchanged
            && isSecureCoverActionAllowed(currentState, action.service);
        if (approved) this._hass?.callService?.(action.domain, action.service, { entity_id: action.entity });
      }
      this._pendingConfirmation = null;
      this._scheduleRender(true);
      return;
    }
    if (this._config.display.read_only && (isControlAction(target.dataset) || target.dataset.moreInfo)) return;
    if (target.dataset.alarmAction && target.dataset.entity) {
      if (!this._config.features.entry
        || target.dataset.entity !== this._controlPolicy.alarm
        || !isAlarmActionSupported(this._hass?.states?.[target.dataset.entity], target.dataset.alarmAction)) return;
      const expectedStateObject = this._hass?.states?.[target.dataset.entity];
      this._pendingConfirmation = {
        domain: "alarm_control_panel",
        service: target.dataset.alarmAction,
        entity: target.dataset.entity,
        expectedState: entityStateValue(expectedStateObject),
        expectedStateObject,
        expectedLastChanged: expectedStateObject?.last_changed || null,
        createdAt: Date.now(),
        label: ALARM_ACTION_LABELS[target.dataset.alarmAction]
      };
      this._confirmationReturnFocus = {
        datasetKey: "alarmAction",
        action: target.dataset.alarmAction,
        entity: target.dataset.entity
      };
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.secureCoverAction && target.dataset.entity) {
      if (!this._config.features.entry
        || target.dataset.entity !== this._controlPolicy.secureCover
        || !isSecureCoverActionAllowed(this._hass?.states?.[target.dataset.entity], target.dataset.secureCoverAction)) return;
      const expectedStateObject = this._hass?.states?.[target.dataset.entity];
      this._pendingConfirmation = {
        domain: "cover",
        service: target.dataset.secureCoverAction,
        entity: target.dataset.entity,
        expectedState: entityStateValue(expectedStateObject),
        expectedStateObject,
        expectedLastChanged: expectedStateObject?.last_changed || null,
        createdAt: Date.now(),
        label: target.dataset.secureCoverAction === "open_cover" ? "Open garage door" : target.dataset.secureCoverAction === "close_cover" ? "Close garage door" : "Stop garage door"
      };
      this._confirmationReturnFocus = {
        datasetKey: "secureCoverAction",
        action: target.dataset.secureCoverAction,
        entity: target.dataset.entity
      };
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.moreInfo) {
      if (this._controlPolicy.moreInfo.has(target.dataset.moreInfo)) this._showMoreInfo(target.dataset.moreInfo);
      return;
    }
    if (target.dataset.toggle) {
      if (this._controlPolicy.lights.has(target.dataset.toggle)
        && isEntityAvailable(this._hass?.states?.[target.dataset.toggle])) {
        this._hass?.callService?.("light", "toggle", { entity_id: target.dataset.toggle });
      }
      return;
    }
    if (target.dataset.scene) {
      if (this._controlPolicy.scenes.has(target.dataset.scene)
        && isEntityAvailable(this._hass?.states?.[target.dataset.scene])) {
        this._hass?.callService?.("scene", "turn_on", { entity_id: target.dataset.scene });
      }
      return;
    }
    if (target.dataset.mediaToggle) {
      if (this._controlPolicy.mediaPlayers.has(target.dataset.mediaToggle)
        && isEntityAvailable(this._hass?.states?.[target.dataset.mediaToggle])) {
        this._hass?.callService?.("media_player", "media_play_pause", { entity_id: target.dataset.mediaToggle });
      }
      return;
    }
    if (target.dataset.coverAction && target.dataset.entity) {
      if (this._controlPolicy.covers.has(target.dataset.entity)
        && target.dataset.entity !== this._controlPolicy.secureCover
        && COVER_SERVICES.has(target.dataset.coverAction)
        && isEntityAvailable(this._hass?.states?.[target.dataset.entity])) {
        this._hass?.callService?.("cover", target.dataset.coverAction, { entity_id: target.dataset.entity });
      }
      return;
    }
    if (target.dataset.vacuumAction && target.dataset.entity) {
      if (target.dataset.entity === this._controlPolicy.vacuum && VACUUM_SERVICES.has(target.dataset.vacuumAction)) {
        if (isEntityAvailable(this._hass?.states?.[target.dataset.entity])) {
          this._hass?.callService?.("vacuum", target.dataset.vacuumAction, { entity_id: target.dataset.entity });
        }
      }
      return;
    }
    if (target.dataset.climatePower && target.dataset.entity) {
      if (this._controlPolicy.climates.has(target.dataset.entity)
        && CLIMATE_POWER_SERVICES.has(target.dataset.climatePower)
        && isEntityAvailable(this._hass?.states?.[target.dataset.entity])) {
        this._hass?.callService?.("climate", target.dataset.climatePower, { entity_id: target.dataset.entity });
      }
      return;
    }
    if (target.dataset.climateAdjust && target.dataset.entity) {
      const adjustment = Number(target.dataset.climateAdjust);
      if (!this._controlPolicy.climates.has(target.dataset.entity) || ![-0.5, 0.5].includes(adjustment)) return;
      const state = this._hass?.states?.[target.dataset.entity];
      if (!isEntityAvailable(state)) return;
      const current = safeNumber(state?.attributes?.temperature, NaN);
      if (Number.isFinite(current)) {
        this._hass.callService("climate", "set_temperature", {
          entity_id: target.dataset.entity,
          temperature: Math.round((current + adjustment) * 2) / 2
        });
      }
    }
  }

  async _openCamera(cameraId) {
    if (!cameraId || this._cameraSession?.id === cameraId
      && ["starting", "buffering", "viewing", "stopping"].includes(this._cameraSession.phase)) return;
    if (this._cameraSession?.phase === "stopping" || this._cameraRecoveryPromise) return;

    let camera = this._controlPolicy?.cameras?.get(cameraId);
    let route = cameraControlRoute(camera, this._hass?.states || {});
    let phase = cameraStreamPhase(this._hass?.states?.[camera?.entity]);
    let retryBlockedCamera = this._retryableCameraBlock(cameraId);
    if (!route || this._view !== "entry" || this._cameraBlockedIds.size > 0 && !retryBlockedCamera) return;
    if (this._config?.display?.read_only && phase !== "streaming") return;
    if (!["idle", "preparing", "streaming"].includes(phase)) {
      this._cameraError = { id: cameraId, message: "The camera is not ready to start a live view." };
      this._scheduleRender(true);
      return;
    }
    if (retryBlockedCamera) {
      this._cameraBlockedIds.delete(retryBlockedCamera.key);
      this._armCameraBlockRetryNotice();
    }

    this._securityCameraId = cameraId;

    const token = ++this._cameraOperationToken;
    this._clearCameraStartTimer();
    this._clearCameraExpiryTimer();
    this._cameraError = null;

    if (this._cameraSession) {
      const previousSession = this._cameraSession;
      const stopped = await this._stopCameraSession(previousSession, token, { render: true });
      if (token !== this._cameraOperationToken) return;
      const previousStillIdle = stopped && this._confirmStoppedCameraState(previousSession);
      if (!stopped || !previousStillIdle) {
        this._cameraError = { id: cameraId, message: "The previous live view could not be stopped safely. Please try again." };
        this._scheduleRender(true);
        return;
      }
    }

    if (token !== this._cameraOperationToken) return;
    camera = this._controlPolicy?.cameras?.get(cameraId);
    route = cameraControlRoute(camera, this._hass?.states || {});
    phase = cameraStreamPhase(this._hass?.states?.[camera?.entity]);
    retryBlockedCamera = this._retryableCameraBlock(cameraId);
    if (!route || this._view !== "entry" || this._cameraBlockedIds.size > 0 && !retryBlockedCamera) return;
    if (this._config?.display?.read_only && phase !== "streaming") return;
    if (!["idle", "preparing", "streaming"].includes(phase)) {
      this._cameraError = { id: cameraId, message: "The camera is not ready to start a live view." };
      this._scheduleRender(true);
      return;
    }
    if (retryBlockedCamera) {
      this._cameraBlockedIds.delete(retryBlockedCamera.key);
      this._armCameraBlockRetryNotice();
    }

    this._evictCameraChild(cameraId);
    const session = {
      id: cameraId,
      phase: "starting",
      token,
      route,
      camera: { ...camera },
      configGeneration: this._cameraConfigGeneration,
      writable: !this._config?.display?.read_only,
      startIssued: false,
      startPromise: null,
      startRawPromise: null,
      startRawPending: false,
      viewerRecoveryAttempted: false
    };
    this._cameraSession = session;
    this._activeCameraId = null;
    this._armCameraExpiry(session);

    if (phase === "streaming") {
      this._bufferCameraSession(session);
      return;
    }

    this._armCameraStartTimeout(session);
    this._scheduleRender(true);
    if (phase === "preparing") return;

    // Consume only the passive witness for this physical camera, at the last
    // synchronous boundary before deliberately issuing its next Start.
    this._cameraStopWitnesses?.delete(camera.entity);
    session.startIssued = true;
    session.startPromise = this._callCameraCommand(
      cameraId,
      "start",
      route.start,
      this._cameraStartTimeoutMs,
      session.camera,
      (rawPromise) => {
        session.startRawPromise = rawPromise;
        session.startRawPending = true;
        const settled = () => { session.startRawPending = false; };
        Promise.resolve(rawPromise).then(settled, settled);
      }
    );
    const started = await session.startPromise;
    if (token !== this._cameraOperationToken || this._cameraSession !== session || session.phase !== "starting") return;
    if (cameraStreamPhase(this._hass?.states?.[camera.entity]) === "streaming") {
      this._bufferCameraSession(session);
      return;
    }
    if (!started) void this._recoverCameraSession(session, "Live view could not start. Please try again.");
  }

  _bufferCameraSession(session) {
    if (!session || this._cameraSession !== session || session.token !== this._cameraOperationToken) return;
    const camera = this._controlPolicy?.cameras?.get(session.id);
    if (cameraStreamPhase(this._hass?.states?.[camera?.entity]) !== "streaming") return;
    this._clearCameraStartTimer();
    this._clearCameraFrameTimers();
    session.phase = "buffering";
    session.slow = false;
    this._activeCameraId = session.id;
    this._cameraError = null;
    this._armCameraFrameTimers(session);
    this._scheduleRender(true);
  }

  _markCameraFrameReady(cameraId, token, child) {
    const session = this._cameraSession;
    if (!child
      || !session
      || session.id !== cameraId
      || session.token !== token
      || session.token !== this._cameraOperationToken
      || session.phase !== "buffering"
      || this._view !== "entry"
      || this._childCards.get(`camera:${cameraId}`) !== child) return;
    const camera = this._controlPolicy?.cameras?.get(cameraId);
    if (cameraStreamPhase(this._hass?.states?.[camera?.entity]) !== "streaming") return;
    this._clearCameraFrameTimers();
    session.phase = "viewing";
    session.slow = false;
    this._cameraError = null;
    this._scheduleRender(true);
  }

  _markCameraMediaLost(cameraId, token, child, { terminal = false } = {}) {
    const session = this._cameraSession;
    if (!child
      || !session
      || session.id !== cameraId
      || session.token !== token
      || session.token !== this._cameraOperationToken
      || !["buffering", "viewing"].includes(session.phase)
      || this._view !== "entry"
      || this._childCards.get(`camera:${cameraId}`) !== child) return;
    const camera = this._controlPolicy?.cameras?.get(cameraId);
    if (cameraStreamPhase(this._hass?.states?.[camera?.entity]) !== "streaming") return;
    this._clearCameraFrameTimers();
    session.phase = "buffering";
    session.slow = true;
    this._cameraError = null;
    if (terminal) {
      if (!this._recoverCameraViewer(session)) {
        void this._recoverCameraSession(session, "The live video ended. Please try again.");
      }
      return;
    }
    this._armCameraFrameTimers(session);
    this._scheduleRender(true);
  }

  _reconcileCameraSession(states) {
    const session = this._cameraSession;
    let blocksChanged = false;
    for (const [witnessEntity, witness] of this._cameraStopWitnesses || []) {
      const entity = witness.entity || witnessEntity;
      const cameraId = witness.cameraId || witness.id || witnessEntity;
      const state = states[entity];
      const phase = cameraStreamPhase(state);
      if (phase === "idle") {
        witness.idleState = state;
        continue;
      }
      if (!["preparing", "streaming"].includes(phase)) continue;
      this._cameraStopWitnesses.delete(witnessEntity);
      if (session?.camera?.entity === entity && session.writable && session.startIssued) continue;
      this._recordCameraBlock(
        cameraId,
        entity,
        state,
        witness.recoveryMessage,
        witness.configGeneration
      );
      blocksChanged = true;
      const message = "A previously closed camera became active again. Live views remain locked until it is idle.";
      this._cameraError = { id: cameraId, entity, message };
      if (session && session.phase !== "stopping") {
        this._closeActiveCamera();
      }
    }
    for (const [blockedEntity, block] of this._cameraBlockedIds) {
      const entity = block.entity || blockedEntity;
      const cameraId = block.cameraId || block.id || blockedEntity;
      const state = states[entity];
      if (block.pendingStart) {
        const tombstone = this._pendingCameraStarts.get(entity);
        const blockedPhase = cameraStreamPhase(state);
        if (tombstone
          && tombstone.settled
          && tombstone.stopIssued
          && !tombstone.stopping
          && blockedPhase === "idle"
          && state !== tombstone.lastStopState) {
          this._pendingCameraStarts.delete(entity);
          this._cameraBlockedIds.delete(blockedEntity);
          const witnessed = this._recordCameraStopWitness(
            cameraId,
            tombstone.camera.entity,
            state,
            tombstone.recoveryMessage,
            tombstone.configGeneration
          );
          if (this._cameraError?.id === cameraId
            && (!this._cameraError.entity || this._cameraError.entity === entity)) {
            this._cameraError = witnessed && tombstone.recoveryMessage
              ? { id: cameraId, entity, message: tombstone.recoveryMessage }
              : null;
          }
          blocksChanged = true;
        } else if (tombstone && ["preparing", "streaming"].includes(blockedPhase)) {
          if (tombstone.stopping) {
            if (!tombstone.activeRetryUsed
              && state !== tombstone.lastStopState) tombstone.rerunAfterActiveState = true;
          } else if (state !== tombstone.lastStopState
            && (!tombstone.stopIssued || !tombstone.activeRetryUsed)) {
            if (tombstone.stopIssued) tombstone.activeRetryUsed = true;
            void this._finalizePendingCameraStart(entity, tombstone);
          }
        }
        continue;
      }
      if (cameraStreamPhase(state) === "idle" && state !== block.baseline) {
        this._cameraBlockedIds.delete(blockedEntity);
        const witnessed = this._recordCameraStopWitness(
          cameraId,
          entity,
          state,
          block.recoveryMessage,
          block.configGeneration
        );
        if (this._cameraError?.id === cameraId
          && (!this._cameraError.entity || this._cameraError.entity === entity)) {
          this._cameraError = witnessed && block.recoveryMessage
            ? { id: cameraId, entity, message: block.recoveryMessage }
            : null;
        }
        blocksChanged = true;
      }
    }
    if (blocksChanged) {
      this._armCameraBlockRetryNotice();
      this._scheduleRender(true);
    }
    if (!session || session.phase === "stopping") return;
    const camera = this._controlPolicy?.cameras?.get(session.id);
    const phase = cameraStreamPhase(states[camera?.entity]);
    if (session.phase === "starting") {
      if (phase === "streaming") this._bufferCameraSession(session);
      else if (["unavailable", "unexpected"].includes(phase)) {
        void this._recoverCameraSession(session, "The camera became unavailable. Please try again.");
      }
      return;
    }
    if (["buffering", "viewing"].includes(session.phase) && phase !== "streaming") {
      this._closeActiveCamera({ message: "The live stream ended. You can try again." });
    }
  }

  _armCameraStartTimeout(session) {
    this._clearCameraStartTimer();
    this._cameraStartTimer = setTimeout(() => {
      if (this._cameraSession !== session || session.token !== this._cameraOperationToken) return;
      void this._recoverCameraSession(session, "The camera took too long to start. Please try again.");
    }, this._cameraStartTimeoutMs);
  }

  _clearCameraStartTimer() {
    if (this._cameraStartTimer !== null) clearTimeout(this._cameraStartTimer);
    this._cameraStartTimer = null;
  }

  _recordCameraBlock(
    cameraId,
    entity,
    baseline,
    recoveryMessage = null,
    configGeneration = this._cameraConfigGeneration
  ) {
    if (!cameraId || !entity) return null;
    const existing = this._cameraBlockedIds.get(entity);
    if (existing?.pendingStart) return entity;
    this._cameraBlockedIds.set(entity, {
      cameraId,
      entity,
      baseline,
      pendingStart: false,
      activeLatched: ["preparing", "streaming"].includes(cameraStreamPhase(baseline)),
      retryAt: Date.now() + this._cameraBlockRetryMs,
      recoveryMessage,
      configGeneration: Number.isInteger(configGeneration) ? configGeneration : 0
    });
    this._armCameraBlockRetryNotice();
    return entity;
  }

  _recordCameraStopWitness(
    cameraId,
    entity,
    idleState,
    recoveryMessage = null,
    configGeneration = this._cameraConfigGeneration
  ) {
    if (!cameraId || !entity || cameraStreamPhase(idleState) !== "idle") return false;
    const currentGeneration = Number.isInteger(this._cameraConfigGeneration)
      ? this._cameraConfigGeneration
      : 0;
    if (this._config === null) return false;
    const currentCamera = [...(this._controlPolicy?.cameras?.entries?.() || [])]
      .find(([, candidate]) => candidate.entity === entity);
    if (this._config !== undefined && !this._config.display?.read_only && currentCamera) {
      cameraId = currentCamera[0];
      configGeneration = currentGeneration;
    }
    if (!(this._cameraStopWitnesses instanceof Map)) this._cameraStopWitnesses = new Map();
    this._cameraStopWitnesses.set(entity, {
      cameraId,
      entity,
      idleState,
      recoveryMessage,
      configGeneration: Number.isInteger(configGeneration) ? configGeneration : currentGeneration
    });
    return true;
  }

  _confirmStoppedCameraState(session, recoveryMessage = null) {
    if (!session?.writable || !session.route?.stop) return true;
    const camera = session?.camera || this._controlPolicy?.cameras?.get(session?.id);
    if (!session?.id || !camera?.entity) return false;
    const state = this._hass?.states?.[camera.entity];
    if (cameraStreamPhase(state) === "idle") {
      return this._recordCameraStopWitness(
        session.id,
        camera.entity,
        state,
        recoveryMessage,
        session.configGeneration
      );
    }
    this._cameraStopWitnesses?.delete(camera.entity);
    this._recordCameraBlock(
      session.id,
      camera.entity,
      state,
      recoveryMessage,
      session.configGeneration
    );
    return false;
  }

  _retryableCameraBlock(cameraId, now = Date.now()) {
    const camera = this._controlPolicy?.cameras?.get(cameraId);
    const entry = camera?.entity ? [camera.entity, this._cameraBlockedIds.get(camera.entity)] : null;
    const block = entry?.[1];
    if (!block
      || block.pendingStart
      || this._cameraBlockedIds.size !== 1
      || now < block.retryAt
      || this._config?.display?.read_only) return null;
    return cameraStreamPhase(this._hass?.states?.[camera.entity]) === "idle"
      ? { key: entry[0], block }
      : null;
  }

  _canRetryBlockedCamera(cameraId, now = Date.now()) {
    return Boolean(this._retryableCameraBlock(cameraId, now));
  }

  _registerPendingCameraStart(session, camera, baseline, recoveryMessage = null) {
    if (!session?.startRawPromise || !camera?.entity || this._pendingCameraStarts.has(camera.entity)) {
      return this._pendingCameraStarts.get(camera?.entity) || null;
    }
    const tombstone = {
      cameraId: session.id,
      raw: session.startRawPromise,
      camera: { ...camera },
      configGeneration: session.configGeneration,
      stopCommand: { ...session.route.stop },
      baseline,
      settled: false,
      stopping: false,
      rerunAfterStop: false,
      rerunAfterActiveState: false,
      activeRetryUsed: false,
      stopBeganSettled: null,
      stopIssued: false,
      lastStopState: null,
      recoveryMessage
    };
    this._pendingCameraStarts.set(camera.entity, tombstone);
    this._cameraBlockedIds.set(camera.entity, {
      cameraId: session.id,
      entity: camera.entity,
      baseline,
      pendingStart: true,
      activeLatched: ["preparing", "streaming"].includes(cameraStreamPhase(baseline)),
      configGeneration: session.configGeneration,
      retryAt: Infinity
    });
    const settle = () => {
      tombstone.settled = true;
      if (tombstone.stopping) {
        if (tombstone.stopBeganSettled === false) tombstone.rerunAfterStop = true;
        return;
      }
      void this._finalizePendingCameraStart(camera.entity, tombstone);
    };
    Promise.resolve(tombstone.raw).then(settle, settle);
    return tombstone;
  }

  async _finalizePendingCameraStart(cameraEntity, tombstone) {
    if (!tombstone
      || this._pendingCameraStarts.get(cameraEntity) !== tombstone) return false;
    if (tombstone.stopping) return false;
    tombstone.stopping = true;
    const settledBeforeStop = tombstone.settled;
    tombstone.stopBeganSettled = settledBeforeStop;
    const before = this._hass?.states?.[tombstone.camera.entity];
    tombstone.stopIssued = true;
    tombstone.lastStopState = before;
    const stopped = await this._callCameraCommand(
      tombstone.cameraId,
      "stop",
      tombstone.stopCommand,
      this._cameraStopTimeoutMs,
      tombstone.camera
    );
    const settlementRequiresFollowUp = tombstone.rerunAfterStop
      || (!settledBeforeStop && tombstone.settled);
    const causalIdleStop = stopped
      && settledBeforeStop
      && cameraStreamPhase(before) === "idle";
    let idle = causalIdleStop;
    if (!settlementRequiresFollowUp && !causalIdleStop) {
      idle = await this._waitForCameraStopped(
        tombstone.camera.entity,
        stopped ? this._cameraStopTimeoutMs : 0,
        cameraStreamPhase(before) === "idle" ? before : null,
        () => tombstone.rerunAfterStop || (!settledBeforeStop && tombstone.settled)
      );
    }
    tombstone.stopping = false;
    tombstone.stopBeganSettled = null;
    if (this._pendingCameraStarts.get(cameraEntity) !== tombstone) return idle;
    const latest = this._hass?.states?.[tombstone.camera.entity];
    const latestPhase = cameraStreamPhase(latest);
    idle = latestPhase === "idle"
      && (latest !== tombstone.lastStopState || stopped && settledBeforeStop);
    if (["preparing", "streaming"].includes(latestPhase)
      && latest !== tombstone.lastStopState) tombstone.rerunAfterActiveState = true;
    const rerunForSettlement = tombstone.rerunAfterStop || (!settledBeforeStop && tombstone.settled);
    const rerunForActiveState = tombstone.rerunAfterActiveState && !tombstone.activeRetryUsed && !idle;
    tombstone.rerunAfterActiveState = false;
    if (rerunForSettlement || rerunForActiveState) {
      tombstone.rerunAfterStop = false;
      if (rerunForActiveState) tombstone.activeRetryUsed = true;
      return this._finalizePendingCameraStart(cameraEntity, tombstone);
    }
    if (idle && tombstone.settled) {
      this._pendingCameraStarts.delete(cameraEntity);
      if (this._cameraBlockedIds.get(cameraEntity)?.pendingStart) this._cameraBlockedIds.delete(cameraEntity);
      const witnessed = this._recordCameraStopWitness(
        tombstone.cameraId,
        tombstone.camera.entity,
        latest,
        tombstone.recoveryMessage,
        tombstone.configGeneration
      );
      if (this._cameraError?.id === tombstone.cameraId
        && (!this._cameraError.entity || this._cameraError.entity === tombstone.camera.entity)) {
        this._cameraError = witnessed && tombstone.recoveryMessage
          ? {
              id: tombstone.cameraId,
              entity: tombstone.camera.entity,
              message: tombstone.recoveryMessage
            }
          : null;
      }
      this._armCameraBlockRetryNotice();
      this._scheduleRender(true);
      return true;
    }
    if (tombstone.settled) {
      this._cameraError = {
        id: tombstone.cameraId,
        entity: tombstone.camera.entity,
        message: "The camera still needs to confirm it has stopped. Live views remain locked for safety."
      };
      this._scheduleRender(true);
    }
    return false;
  }

  _armCameraBlockRetryNotice() {
    this._clearCameraBlockTimer();
    const now = Date.now();
    const nextRetryAt = Math.min(...[...this._cameraBlockedIds.values()]
      .map((block) => block.retryAt)
      .filter((retryAt) => Number.isFinite(retryAt) && retryAt > now));
    if (!Number.isFinite(nextRetryAt)) return;
    this._cameraBlockTimer = setTimeout(() => {
      this._cameraBlockTimer = null;
      this._scheduleRender();
      this._armCameraBlockRetryNotice();
    }, Math.max(0, nextRetryAt - now));
  }

  _clearCameraBlockTimer() {
    if (this._cameraBlockTimer !== null) clearTimeout(this._cameraBlockTimer);
    this._cameraBlockTimer = null;
  }

  _armCameraFrameTimers(session) {
    this._cameraSlowTimer = setTimeout(() => {
      if (this._cameraSession !== session
        || session.token !== this._cameraOperationToken
        || session.phase !== "buffering") return;
      session.slow = true;
      this._scheduleRender(true);
    }, this._cameraSlowMessageMs);
    this._cameraFrameTimer = setTimeout(() => {
      if (this._cameraSession !== session
        || session.token !== this._cameraOperationToken
        || session.phase !== "buffering") return;
      if (this._recoverCameraViewer(session)) return;
      void this._recoverCameraSession(session, "The video could not connect after one retry. Please try again.");
    }, this._cameraFrameTimeoutMs);
  }

  _clearCameraFrameTimers() {
    if (this._cameraFrameTimer !== null) clearTimeout(this._cameraFrameTimer);
    if (this._cameraSlowTimer !== null) clearTimeout(this._cameraSlowTimer);
    this._cameraFrameTimer = null;
    this._cameraSlowTimer = null;
  }

  _recoverCameraViewer(session) {
    if (!session
      || this._cameraSession !== session
      || session.token !== this._cameraOperationToken
      || session.phase !== "buffering"
      || session.viewerRecoveryAttempted
      || this._view !== "entry") return false;
    const camera = this._controlPolicy?.cameras?.get(session.id);
    if (cameraStreamPhase(this._hass?.states?.[camera?.entity]) !== "streaming") return false;
    session.viewerRecoveryAttempted = true;
    session.slow = false;
    this._clearCameraFrameTimers();
    this._evictCameraChild(session.id);
    this._armCameraFrameTimers(session);
    this._scheduleRender(true);
    return true;
  }

  _armCameraExpiry(session) {
    this._clearCameraExpiryTimer();
    this._cameraExpiryTimer = setTimeout(() => {
      if (this._cameraSession !== session || session.token !== this._cameraOperationToken) return;
      this._closeActiveCamera({ message: "Live view closed automatically after two minutes." });
    }, this._cameraExpiryMs);
  }

  _clearCameraExpiryTimer() {
    if (this._cameraExpiryTimer !== null) clearTimeout(this._cameraExpiryTimer);
    this._cameraExpiryTimer = null;
  }

  async _recoverCameraSession(session, message) {
    if (!session || this._cameraSession !== session) return false;
    this._clearCameraExpiryTimer();
    const token = ++this._cameraOperationToken;
    const recovery = this._stopCameraSession(session, token, { render: true, message });
    this._cameraRecoveryPromise = recovery;
    let stopped = false;
    let stopWitnessed = false;
    try {
      stopped = await recovery;
    } finally {
      stopWitnessed = this._confirmStoppedCameraState(session, message);
      if (!stopWitnessed) this._scheduleRender(true);
      if (this._cameraRecoveryPromise === recovery) this._cameraRecoveryPromise = null;
    }
    return stopped && stopWitnessed;
  }

  _closeActiveCamera({ render = true, message = null, invalidate = false } = {}) {
    const session = this._cameraSession;
    if (session?.phase === "stopping") {
      if (invalidate) ++this._cameraOperationToken;
      this._evictCameraChild(session.id);
      this._activeCameraId = null;
      if (render) this._scheduleRender(true);
      return;
    }
    ++this._cameraOperationToken;
    this._clearCameraStartTimer();
    this._clearCameraFrameTimers();
    this._clearCameraExpiryTimer();
    if (!session) {
      if (this._activeCameraId) this._evictCameraChild(this._activeCameraId);
      this._activeCameraId = null;
      if (render) this._scheduleRender(true);
      return;
    }
    const token = this._cameraOperationToken;
    const recovery = this._stopCameraSession(session, token, { render, message });
    this._cameraRecoveryPromise = recovery;
    void recovery.finally(() => {
      if (!this._confirmStoppedCameraState(session, message) && render) this._scheduleRender(true);
      if (this._cameraRecoveryPromise === recovery) this._cameraRecoveryPromise = null;
    });
  }

  async _stopCameraSession(session, token, { render = true, message = null } = {}) {
    if (!session) return true;
    const previousPhase = session.phase;
    this._clearCameraStartTimer();
    this._clearCameraFrameTimers();
    session.phase = "stopping";
    this._activeCameraId = null;
    this._evictCameraChild(session.id);
    if (render) this._scheduleRender(true);

    const camera = session.camera || this._controlPolicy?.cameras?.get(session.id);
    const phase = cameraStreamPhase(this._hass?.states?.[camera?.entity]);
    const preStopState = this._hass?.states?.[camera?.entity];
    const shouldStop = session.writable
      && Boolean(session.route?.stop)
      && (session.startIssued || ["buffering", "viewing"].includes(previousPhase) || ["preparing", "streaming"].includes(phase));
    const pendingTombstone = shouldStop && session.startRawPromise && session.startRawPending
      ? this._registerPendingCameraStart(session, camera, preStopState, message)
      : null;
    const currentRoute = cameraControlRoute(camera, this._hass?.states || {});
    const stopCommand = currentRoute?.stop || session.route.stop;
    let stopped = !shouldStop
      || (pendingTombstone
        ? await this._finalizePendingCameraStart(camera.entity, pendingTombstone)
        : await this._callCameraCommand(
          session.id,
          "stop",
          stopCommand,
          this._cameraStopTimeoutMs,
          camera
        ));

    if (!shouldStop) {
      if (this._cameraSession === session) this._cameraSession = null;
      if (token === this._cameraOperationToken && message) {
        this._cameraError = { id: session.id, entity: camera?.entity, message };
      }
      if (render && token === this._cameraOperationToken) this._scheduleRender(true);
      return true;
    }
    const requireFreshIdle = session.startIssued && previousPhase === "starting" && phase === "idle";
    if (stopped && !pendingTombstone) {
      await this._waitForCameraStopped(
        camera.entity,
        this._cameraStopTimeoutMs,
        requireFreshIdle ? preStopState : null
      );
    }
    const latestStopState = this._hass?.states?.[camera.entity];
    const stateStopped = cameraStreamPhase(latestStopState) === "idle"
      && (!requireFreshIdle || latestStopState !== preStopState || pendingTombstone && stopped)
      && !this._pendingCameraStarts.has(camera.entity);
    if (stateStopped && session.writable && session.route?.stop) {
      this._recordCameraStopWitness(
        session.id,
        camera.entity,
        latestStopState,
        message,
        session.configGeneration
      );
    }
    if (token !== this._cameraOperationToken) {
      if (this._cameraSession === session) this._cameraSession = null;
      if (!stateStopped && (session.startIssued || cameraStreamPhase(this._hass?.states?.[camera.entity]) !== "idle")) {
        this._recordCameraBlock(
          session.id,
          camera.entity,
          this._hass?.states?.[camera.entity],
          message,
          session.configGeneration
        );
      }
      return stateStopped;
    }
    const isCurrentSession = this._cameraSession === session;
    if (isCurrentSession) {
      this._cameraSession = null;
      if (message) this._cameraError = { id: session.id, entity: camera.entity, message };
      else if (!stateStopped) {
        this._cameraError = {
          id: session.id,
          entity: camera.entity,
          message: "The live view could not be stopped safely. Please wait for the camera to become idle."
        };
      }
      if (!stateStopped && (session.startIssued || cameraStreamPhase(this._hass?.states?.[camera.entity]) !== "idle")) {
        this._recordCameraBlock(
          session.id,
          camera.entity,
          this._hass?.states?.[camera.entity],
          message,
          session.configGeneration
        );
      }
    }
    if (render && isCurrentSession) this._scheduleRender(true);
    return stateStopped;
  }

  async _waitForCameraStopped(entityId, timeoutMs, staleIdleState = null, abortWait = null) {
    const deadline = Date.now() + timeoutMs;
    while (true) {
      if (typeof abortWait === "function" && abortWait()) return false;
      const state = this._hass?.states?.[entityId];
      if (cameraStreamPhase(state) === "idle") {
        if (!staleIdleState || state !== staleIdleState) return true;
      }
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async _callCameraCommand(cameraId, direction, command, timeoutMs, authorizedCamera = null, onDispatched = null) {
    const camera = authorizedCamera || this._controlPolicy?.cameras?.get(cameraId);
    if (!camera || !camera.startButton || !camera.stopButton || !command) return false;
    const expectedButton = direction === "start" ? camera.startButton : camera.stopButton;
    const approved = command.domain === "button"
      ? command.service === "press" && Boolean(expectedButton) && command.entity === expectedButton
      : command.domain === "camera"
        && command.service === (direction === "start" ? "turn_on" : "turn_off")
        && command.entity === camera.entity
      ;
    if (!approved || typeof this._hass?.callService !== "function") return false;

    let timeout;
    try {
      const call = Promise.resolve(this._hass.callService(command.domain, command.service, { entity_id: command.entity }));
      if (typeof onDispatched === "function") onDispatched(call);
      await Promise.race([
        call,
        new Promise((_, reject) => {
          timeout = setTimeout(() => reject(new Error("camera command timeout")), timeoutMs);
        })
      ]);
      return true;
    } catch {
      return false;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  _evictCameraChild(cameraId) {
    if (!cameraId) return;
    this._removeChildCard(`camera:${cameraId}`);
  }

  _selectRoom(roomId) {
    const room = this._config.rooms.find((entry) => entry.id === roomId);
    if (!room) return;
    this._room = roomId;
    this._floor = room.floor_id;
    this._scheduleRender(true);
  }

  _showMoreInfo(entityId) {
    if (this._config.display.read_only || !this._controlPolicy.moreInfo.has(entityId)) return;
    const event = new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId }
    });
    this.dispatchEvent(event);
  }

  _styles() {
    return `
      :host { --family-ha-header-offset:var(--header-height,56px); --hub-focus:#0B57C7; display:block; width:100%; min-width:0; min-height:664px; height:calc(100vh - var(--family-ha-header-offset)); margin-top:var(--family-ha-header-offset); color:var(--primary-text-color); font-family:var(--family-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif); }
      *, *::before, *::after { box-sizing:border-box; }
      button, select { font:inherit; }
      button { -webkit-tap-highlight-color:transparent; }
      .hub-card { overflow:hidden; border:0; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); color:var(--hub-text); min-height:100%; height:100%; }
      .hub-shell { display:grid; grid-template-columns:86px minmax(0,1fr); min-height:100%; height:100%; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); }
      .hub-navigation { padding:14px 9px; background:linear-gradient(180deg,color-mix(in srgb,var(--hub-nav) 96%,transparent),color-mix(in srgb,var(--hub-nav) 86%,var(--hub-accent))); border-right:1px solid rgba(255,255,255,.1); display:flex; flex-direction:column; gap:14px; min-height:0; }
      .hub-brand { width:54px; height:54px; margin:0 auto; border-radius:50%; border:1px solid rgba(255,255,255,.45); background:rgba(255,255,255,.12); color:#fff; font-size:24px; font-weight:700; cursor:pointer; }
      .hub-nav-items { display:flex; min-height:0; flex:1; flex-direction:column; justify-content:center; gap:8px; }
      .hub-nav-button { min-height:64px; border:1px solid transparent; border-radius:20px; background:transparent; color:rgba(255,255,255,.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; }
      .hub-nav-button ha-icon { --mdc-icon-size:22px; }
      .hub-nav-button span { font-size:10px; font-weight:600; }
      .hub-nav-button.is-active { color:#fff; background:linear-gradient(145deg,var(--hub-backdrop-end),var(--hub-accent)); border-color:rgba(255,255,255,.35); box-shadow:0 10px 24px rgba(13,18,34,.28); }
      .hub-content { min-width:0; min-height:0; padding:12px 18px 16px; display:grid; grid-template-rows:56px minmax(0,1fr); gap:10px; background:linear-gradient(135deg,rgba(17,28,51,.18),rgba(183,101,98,.12)); }
      .hub-topbar { min-width:0; display:flex; justify-content:space-between; align-items:center; color:#fff; padding:0 4px; }
      .hub-topbar h1 { margin:2px 0 0; font-size:30px; line-height:1; font-weight:700; }
      .eyebrow { margin:0; font-size:10px; line-height:1.2; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--hub-muted); }
      .hub-topbar .eyebrow { color:rgba(255,255,255,.72); }
      .hub-header-actions { display:flex; align-items:center; gap:9px; }
      .preview-pill { min-height:36px; padding:0 12px; border:1px solid rgba(255,255,255,.34); border-radius:14px; display:flex; align-items:center; gap:7px; background:rgba(255,255,255,.13); color:#fff; font-size:11px; font-weight:700; }
      .preview-pill ha-icon { --mdc-icon-size:18px; }
      .hub-weather-pill { min-height:48px; padding:0 16px; border:1px solid rgba(255,255,255,.28); border-radius:18px; background:rgba(255,255,255,.14); color:#fff; display:flex; align-items:center; gap:9px; cursor:pointer; }
      .hub-view { min-height:0; min-width:0; }
      .surface { color:var(--hub-text); background:linear-gradient(145deg,color-mix(in srgb,var(--hub-surface) 82%,transparent),color-mix(in srgb,var(--hub-backdrop-mid) 72%,transparent)); border:1px solid rgba(255,255,255,.16); border-radius:var(--hub-radius); box-shadow:0 20px 52px rgba(3,8,24,.3),inset 0 1px 0 rgba(255,255,255,.1); -webkit-backdrop-filter:blur(22px) saturate(1.18); backdrop-filter:blur(22px) saturate(1.18); }
      .today-grid { height:100%; display:grid; grid-template-columns:minmax(0,1.35fr) minmax(245px,.9fr) minmax(240px,.85fr); grid-template-rows:minmax(190px,.82fr) minmax(210px,1.18fr); gap:14px; }
      .today-grid article { padding:20px; min-width:0; overflow:hidden; }
      .today-grid h2 { margin:7px 0 0; font-size:22px; line-height:1.16; }
      .supporting { margin:8px 0 0; color:var(--hub-muted); font-size:13px; }
      .hero-panel { grid-column:span 2; background:linear-gradient(140deg,color-mix(in srgb,var(--hub-accent) 86%,#000),var(--hub-backdrop-end)); color:#fff; }
      .hero-panel .eyebrow { color:rgba(255,255,255,.7); }
      .hero-panel h2 { font-size:30px; }
      .hero-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:22px; }
      .hero-metrics.has-energy { grid-template-columns:repeat(4,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
      .hero-metrics[data-metric-count="2"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="3"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .hero-metrics button { text-align:left; min-height:74px; padding:12px 14px; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.12); color:#fff; border-radius:16px; cursor:pointer; }
      .hero-metrics strong,.hero-metrics span { display:block; }
      .hero-metrics strong { font-size:18px; }
      .hero-metrics span { margin-top:4px; font-size:10px; opacity:.74; }
      .next-panel { display:flex; flex-direction:column; }
      .next-panel .text-action { margin-top:auto; }
      .text-action,.section-heading > button { width:max-content; border:0; padding:5px 0; background:transparent; color:var(--hub-accent); font-size:12px; font-weight:700; cursor:pointer; }
      .children-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .football-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .now-playing-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .section-heading h2 { margin:4px 0 0; font-size:19px; }
      .section-heading > span { color:var(--hub-muted); font-size:11px; }
      .person-summary-list { display:grid; gap:8px; margin-top:14px; }
      .person-summary { width:100%; border:0; background:color-mix(in srgb,var(--person-colour) 9%,var(--hub-surface)); padding:10px; border-radius:15px; display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:9px; text-align:left; color:var(--hub-text); cursor:pointer; }
      .person-initial { width:34px; height:34px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; font-weight:700; }
      .person-summary strong,.person-summary small { display:block; }
      .person-summary small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .points { font-size:11px; font-weight:700; color:var(--person-colour); }
      .featured-fixtures { display:grid; gap:8px; margin-top:12px; }
      .compact-fixture { border:1px solid color-mix(in srgb,var(--hub-accent) 18%,transparent); border-radius:15px; background:var(--hub-surface); min-height:60px; padding:9px 10px; color:var(--hub-text); display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:7px; align-items:center; cursor:pointer; }
      .compact-fixture > span { min-width:0; overflow:hidden; font-size:10px; font-weight:650; white-space:nowrap; text-overflow:ellipsis; }
      .compact-fixture span:last-of-type { text-align:right; }
      .compact-fixture small { grid-column:1/-1; color:var(--hub-muted); font-size:9px; text-align:center; }
      .now-playing { display:grid; grid-template-columns:58px minmax(0,1fr) 38px; gap:12px; align-items:center; margin-top:14px; }
      .artwork { width:58px; height:58px; border-radius:14px; overflow:hidden; display:grid; place-items:center; background:linear-gradient(145deg,var(--hub-accent),var(--hub-backdrop-end)); color:#fff; }
      .artwork img { width:100%; height:100%; object-fit:cover; }
      .now-playing-copy { min-width:0; }
      .now-playing h2 { display:-webkit-box; margin:0; overflow:hidden; font-size:16px; line-height:1.18; overflow-wrap:anywhere; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
      .now-playing p { display:-webkit-box; margin:4px 0 0; overflow:hidden; color:var(--hub-muted); font-size:11px; line-height:1.25; overflow-wrap:anywhere; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
      .today-next h2 { display:-webkit-box; overflow:hidden; overflow-wrap:anywhere; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
      .icon-action { width:38px; height:38px; padding:0; display:grid; place-items:center; border:0; border-radius:50%; background:color-mix(in srgb,var(--hub-accent) 12%,var(--hub-surface)); color:var(--hub-accent); cursor:pointer; }
      .single-surface { height:100%; padding:18px; overflow:hidden; }
      .embedded-view { display:grid; grid-template-rows:48px minmax(0,1fr); gap:10px; }
      .child-card-slot { min-height:0; overflow:auto; border-radius:16px; }
      .child-card-slot > * { display:block; min-height:100%; }
      .home-surface { height:100%; min-height:0; display:grid; grid-template-rows:52px minmax(0,1fr); gap:10px; }
      .home-toolbar { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:12px; color:#fff; padding:0 4px; }
      .home-toolbar h2 { margin:3px 0 0; font-size:19px; }
      .home-toolbar .eyebrow { color:rgba(255,255,255,.68); }
      .home-section { min-width:0; min-height:0; }
      .home-segments { max-width:70%; overflow-x:auto; }
      .home-segments .segment,.calendar-modes .segment { display:flex; align-items:center; gap:5px; }
      .home-segments ha-icon,.calendar-modes ha-icon { --mdc-icon-size:15px; }
      .home-overview { height:100%; min-height:0; display:grid; grid-template-rows:66px minmax(0,1fr); gap:10px; }
      .home-summary-links { min-width:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; }
      .home-summary-links[data-summary-count="2"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .home-summary-links button { min-width:0; min-height:58px; padding:8px 12px; display:grid; grid-template-columns:30px minmax(0,1fr) 18px; align-items:center; gap:9px; border:1px solid rgba(255,255,255,.12); border-radius:15px; background:rgba(8,15,31,.46); color:var(--hub-text); text-align:left; cursor:pointer; }
      .home-summary-links button > ha-icon:first-child { --mdc-icon-size:21px; color:#bcaeff; }
      .home-summary-links button > ha-icon:last-child { --mdc-icon-size:17px; color:var(--hub-muted); }
      .home-summary-links strong,.home-summary-links small { display:block; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .home-summary-links strong { font-size:14px; }
      .home-summary-links small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .whole-home-grid { height:100%; min-height:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; overflow:auto; align-content:start; padding:1px 3px 4px 1px; }
      .whole-home-card { min-width:0; padding:15px; }
      .whole-home-heading,.heating-card-heading,.cover-card-heading { min-width:0; display:flex; align-items:center; gap:10px; }
      .whole-home-heading > span,.heating-card-heading > span,.cover-card-heading > span { flex:0 0 40px; width:40px; height:40px; display:grid; place-items:center; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 13%,rgba(8,15,31,.64)); color:#bcaeff; }
      .whole-home-heading h3,.heating-card-heading h3,.cover-card-heading h3 { margin:0; font-size:15px; }
      .whole-home-heading p,.heating-card-heading p,.cover-card-heading p { margin:3px 0 0; color:var(--hub-muted); font-size:9px; }
      .whole-home-controls { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; margin-top:13px; }
      .whole-home-control { min-width:0; min-height:52px; display:flex; align-items:center; gap:8px; padding:8px 10px; border:1px solid rgba(255,255,255,.1); border-radius:13px; background:rgba(8,15,31,.5); color:var(--hub-text); text-align:left; cursor:pointer; }
      .whole-home-control.is-on { border-color:rgba(242,184,92,.44); background:rgba(128,88,29,.34); color:#ffd789; }
      .whole-home-control ha-icon { flex:0 0 auto; --mdc-icon-size:19px; }
      .whole-home-control span { min-width:0; }
      .whole-home-control strong,.whole-home-control small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .whole-home-control strong { font-size:10px; }
      .whole-home-control small { margin-top:3px; color:var(--hub-muted); font-size:8px; }
      .heating-grid,.cover-grid { height:100%; min-height:0; display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; align-content:start; overflow:auto; padding:1px 3px 4px 1px; }
      .heating-card { min-width:0; min-height:174px; padding:16px; display:grid; grid-template-rows:auto minmax(0,1fr); gap:13px; transition:border-color .18s ease,background .18s ease; }
      .cover-card { min-width:0; padding:16px; }
      .heating-card-heading { min-height:44px; }
      .heating-card-heading > div { min-width:0; }
      .heating-card-heading > .heating-icon { flex-basis:44px; width:44px; height:44px; }
      .heating-card-heading h3 { font-size:16px; }
      .heating-card-heading .heating-status { display:flex; align-items:center; gap:5px; font-size:11px; }
      .heating-status > span { width:6px; height:6px; border-radius:50%; background:#8d96aa; box-shadow:0 0 0 3px rgba(141,150,170,.1); }
      .heating-power { flex:0 0 auto; min-width:58px; min-height:44px; margin-left:auto; padding:0 10px; border:1px solid rgba(255,255,255,.12); border-radius:13px; background:rgba(8,15,31,.48); color:var(--hub-muted); display:flex; align-items:center; justify-content:center; gap:5px; font-size:10px; font-weight:800; cursor:pointer; }
      .heating-power ha-icon { --mdc-icon-size:16px; }
      .heating-power.is-on { border-color:rgba(242,184,92,.36); background:rgba(128,88,29,.25); color:#f5d493; }
      .heating-power:disabled { opacity:.5; cursor:not-allowed; }
      .heating-body { min-width:0; display:grid; grid-template-columns:minmax(72px,.72fr) minmax(150px,1.28fr); align-items:end; gap:14px; padding-top:13px; border-top:1px solid rgba(255,255,255,.1); }
      .heating-current,.heating-target-control { min-width:0; }
      .heating-current small,.heating-target-control > small { display:block; color:var(--hub-muted); font-size:10px; font-weight:700; letter-spacing:.02em; }
      .heating-current-value { display:block; margin-top:5px; color:var(--hub-text); font-size:30px; line-height:.95; letter-spacing:-.04em; }
      .heating-target-control { width:100%; justify-self:end; }
      .heating-stepper { min-width:0; margin-top:5px; display:grid; grid-template-columns:44px minmax(48px,1fr) 44px; align-items:center; overflow:hidden; border:1px solid rgba(255,255,255,.09); border-radius:12px; background:rgba(255,255,255,.075); }
      .heating-stepper button,.heating-target-value { min-height:44px; border:0; background:transparent; color:#c8bcff; }
      .heating-stepper button { width:44px; height:44px; padding:0; display:grid; place-items:center; border-radius:0; font-size:18px; font-weight:800; cursor:pointer; }
      .heating-stepper button:first-child { border-radius:11px 0 0 11px; }
      .heating-stepper button:last-child { border-radius:0 11px 11px 0; }
      .heating-stepper button:disabled { cursor:not-allowed; opacity:.48; }
      .heating-target-value { display:grid; place-items:center; border-width:0 1px; border-style:solid; border-color:rgba(255,255,255,.09); color:var(--hub-text); font-size:19px; font-weight:800; }
      .heating-card.is-heating { border-color:rgba(242,184,92,.42); background:linear-gradient(145deg,color-mix(in srgb,var(--hub-surface) 78%,rgba(128,88,29,.3)),color-mix(in srgb,var(--hub-backdrop-mid) 70%,transparent)); }
      .heating-card.is-heating .heating-icon,.heating-card.is-heating .heating-status { color:#ffd789; }
      .heating-card.is-heating .heating-status > span { background:#f2b85c; box-shadow:0 0 0 3px rgba(242,184,92,.14); }
      .heating-card.is-idle .heating-status > span { background:#8dc9b0; box-shadow:0 0 0 3px rgba(141,201,176,.12); }
      .heating-card.is-cooling .heating-icon,.heating-card.is-cooling .heating-status { color:#8ecff1; }
      .heating-card.is-cooling .heating-status > span { background:#72bde6; box-shadow:0 0 0 3px rgba(114,189,230,.13); }
      .heating-card.is-auto .heating-status > span { background:#aa99ff; box-shadow:0 0 0 3px rgba(170,153,255,.13); }
      .heating-card.is-off { background:linear-gradient(145deg,color-mix(in srgb,var(--hub-surface) 72%,transparent),color-mix(in srgb,var(--hub-backdrop-mid) 64%,transparent)); }
      .heating-card.is-off .heating-icon,.heating-card.is-off .heating-status,.heating-card.is-off .heating-target-control { opacity:.7; }
      .heating-card.is-unavailable { border-style:dashed; }
      .heating-card.is-unavailable .heating-icon,.heating-card.is-unavailable .heating-status,.heating-card.is-unavailable .heating-target-control { opacity:.5; }
      .cover-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:16px; }
      .cover-actions.is-single { grid-template-columns:1fr; }
      .cover-actions button { min-width:0; min-height:42px; border:0; border-radius:12px; background:rgba(255,255,255,.08); color:#c8bcff; display:flex; align-items:center; justify-content:center; gap:4px; font-size:9px; font-weight:750; cursor:pointer; }
      .cover-actions ha-icon { --mdc-icon-size:15px; }
      .cleaning-panel { height:100%; min-height:0; padding:22px; display:grid; grid-template-columns:minmax(0,.86fr) minmax(0,1.14fr); grid-template-rows:auto auto minmax(0,1fr); gap:16px 24px; overflow:hidden; }
      .cleaning-hero { display:flex; align-items:center; gap:15px; }
      .cleaning-hero > span { width:72px; height:72px; display:grid; place-items:center; border-radius:24px; background:linear-gradient(145deg,var(--hub-accent),var(--hub-backdrop-end)); color:#fff; }
      .cleaning-hero > span ha-icon { --mdc-icon-size:38px; }
      .cleaning-hero h2 { margin:4px 0 0; font-size:23px; }
      .cleaning-hero p:last-child { margin:5px 0 0; color:var(--hub-muted); font-size:11px; }
      .cleaning-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; align-self:center; }
      .cleaning-facts span { padding:12px; border:1px solid rgba(255,255,255,.1); border-radius:14px; background:rgba(8,15,31,.44); }
      .cleaning-facts strong,.cleaning-facts small { display:block; }
      .cleaning-facts strong { font-size:14px; }
      .cleaning-facts small { margin-top:4px; color:var(--hub-muted); font-size:8px; }
      .cleaning-actions { display:flex; align-items:center; gap:8px; }
      .cleaning-actions button { min-height:46px; padding:0 16px; border:0; border-radius:14px; background:color-mix(in srgb,var(--hub-accent) 18%,rgba(8,15,31,.72)); color:#d8d0ff; display:flex; align-items:center; gap:6px; font-weight:750; cursor:pointer; }
      .vacuum-map-slot,.vacuum-map-placeholder { grid-column:2; grid-row:2/4; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:18px; background:rgba(6,12,27,.54); }
      .vacuum-map-slot .embedded-card { height:100%; }
      .vacuum-map-placeholder { display:grid; place-items:center; align-content:center; gap:10px; padding:28px; color:var(--hub-muted); text-align:center; font-size:11px; }
      .vacuum-map-placeholder ha-icon { --mdc-icon-size:44px; color:#a999ff; }
      .energy-view { height:100%; min-height:0; display:grid; grid-template-rows:146px minmax(0,1fr) 74px; gap:14px; }
      .energy-hero { min-width:0; padding:22px 26px; display:flex; align-items:center; justify-content:space-between; gap:24px; overflow:hidden; border:0; background:radial-gradient(circle at 88% 18%,rgba(0,168,135,.25),transparent 32%),linear-gradient(135deg,#061B3A,#0C315D); color:#fff; }
      .energy-hero .eyebrow { color:#8FD8CB; }
      .energy-hero h2 { margin:6px 0 0; color:#fff; font-size:40px; line-height:1; letter-spacing:-.04em; }
      .energy-hero p:last-child { margin:8px 0 0; color:#C7D4E4; font-size:13px; }
      .energy-hero-status { flex:0 0 auto; min-width:214px; padding:12px 14px; display:grid; grid-template-columns:24px minmax(0,1fr); gap:2px 9px; align-items:center; border:1px solid rgba(255,255,255,.14); border-radius:16px; background:rgba(255,255,255,.075); }
      .energy-hero-status ha-icon { grid-row:1/3; --mdc-icon-size:22px; color:#8FD8CB; }
      .energy-hero-status strong,.energy-hero-status small { display:block; }
      .energy-hero-status strong { font-size:12px; }
      .energy-hero-status small { color:#AFC0D5; font-size:10px; }
      .energy-meter-grid { min-height:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .energy-meter { min-width:0; min-height:0; padding:20px; display:grid; grid-template-rows:auto minmax(92px,1fr) auto auto; gap:14px; overflow:hidden; }
      .energy-meter-heading { min-width:0; display:grid; grid-template-columns:48px minmax(0,1fr) auto; align-items:center; gap:11px; }
      .energy-meter-icon { width:48px; height:48px; display:grid; place-items:center; border-radius:15px; background:color-mix(in srgb,var(--hub-accent) 15%,rgba(8,15,31,.64)); color:#c8bcff; }
      .energy-meter-icon ha-icon { --mdc-icon-size:25px; }
      .energy-meter-heading h2 { margin:3px 0 0; font-size:20px; }
      .energy-status { min-height:34px; padding:0 10px; display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.11); border-radius:12px; color:var(--hub-muted); font-size:10px; font-weight:750; }
      .energy-status ha-icon { --mdc-icon-size:16px; }
      .energy-meter.is-stale .energy-status,.energy-meter.is-partial .energy-status,.energy-meter.is-unverified .energy-status { color:#ffd789; }
      .energy-primary-metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .energy-primary-metrics > span { min-width:0; padding:14px; border:1px solid rgba(255,255,255,.1); border-radius:15px; background:rgba(8,15,31,.42); }
      .energy-primary-metrics small,.energy-primary-metrics strong,.energy-tariff small,.energy-tariff strong { display:block; }
      .energy-primary-metrics small,.energy-tariff small { color:var(--hub-muted); font-size:10px; }
      .energy-primary-metrics strong { margin-top:7px; font-size:27px; line-height:1; letter-spacing:-.035em; }
      .energy-tariff { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; padding-top:12px; border-top:1px solid rgba(255,255,255,.1); }
      .energy-tariff strong { margin-top:4px; font-size:13px; }
      .energy-freshness { margin:0; display:flex; align-items:center; gap:6px; color:var(--hub-muted); font-size:10px; }
      .energy-freshness ha-icon { --mdc-icon-size:15px; }
      .energy-truth-note { min-width:0; padding:13px 18px; display:grid; grid-template-columns:34px minmax(0,1fr); align-items:center; gap:11px; }
      .energy-truth-note > ha-icon { --mdc-icon-size:24px; color:#8FD8CB; }
      .energy-truth-note strong,.energy-truth-note span { display:block; }
      .energy-truth-note strong { font-size:12px; }
      .energy-truth-note span { margin-top:3px; color:var(--hub-muted); font-size:10px; }
      .rooms-layout { height:100%; display:grid; grid-template-columns:minmax(0,3.2fr) minmax(232px,1fr); gap:12px; }
      .floorplan-panel { min-width:0; min-height:0; padding:14px; display:grid; grid-template-rows:48px minmax(0,1fr); gap:7px; }
      .floorplan-heading { align-items:center; }
      .segments { display:flex; flex-shrink:0; align-items:center; gap:4px; padding:3px; border-radius:13px; background:color-mix(in srgb,var(--hub-muted) 10%,transparent); }
      .segment { min-height:32px; padding:0 12px; border:0; border-radius:10px; background:transparent; color:var(--hub-muted); font-size:11px; font-weight:700; white-space:nowrap; cursor:pointer; }
      .segment.is-selected { color:#fff; background:var(--hub-accent); }
      .floorplan-canvas { position:relative; min-height:0; overflow:hidden; border-radius:18px; background:radial-gradient(circle at 52% 34%,rgba(100,91,145,.38) 0,rgba(20,28,52,.88) 52%,rgba(7,13,29,.96) 100%); border:1px solid rgba(255,255,255,.14); }
      .floorplan-backdrop { position:absolute; inset:0; background:linear-gradient(145deg,rgba(255,255,255,.07),transparent 48%),radial-gradient(ellipse at 50% 80%,rgba(3,8,24,.62),transparent 55%); }
      .floorplan-visual { position:absolute; inset:0; width:100%; height:100%; z-index:4; }
      .floorplan-image,.light-overlay { pointer-events:none; }
      .light-overlay { mix-blend-mode:screen; }
      .room-hotspot { cursor:pointer; outline:none; }
      .room-hotspot polygon { fill:transparent; stroke:transparent; stroke-width:.45; vector-effect:non-scaling-stroke; transition:fill .18s ease,stroke .18s ease,filter .18s ease; }
      .room-hotspot.has-light polygon { fill:color-mix(in srgb,var(--room-colour) 12%,transparent); filter:drop-shadow(0 0 4px var(--room-colour)); }
      .room-hotspot.is-selected polygon,.room-hotspot:focus polygon { fill:color-mix(in srgb,var(--hub-accent) 8%,transparent); stroke:#b9aaff; stroke-width:.72; filter:drop-shadow(0 0 4px var(--hub-accent)); }
      .room-detail { padding:16px; min-height:0; overflow:auto; }
      .read-only-note { display:flex; align-items:center; gap:7px; margin:14px 0 0; padding:10px 12px; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-muted); font-size:12px; }
      .read-only-note ha-icon { --mdc-icon-size:17px; color:var(--hub-accent); }
      .read-only-music { display:grid; place-items:center; grid-template-columns:minmax(0,1fr) 130px; padding:42px; }
      .read-only-music h2 { margin:7px 0 0; font-size:30px; }
      .read-only-music > ha-icon { --mdc-icon-size:112px; color:color-mix(in srgb,var(--hub-accent) 58%,transparent); }
      button:disabled { cursor:not-allowed; opacity:.58; }
      .room-title { display:flex; gap:12px; align-items:center; }
      .room-icon { width:46px; height:46px; border-radius:15px; display:grid; place-items:center; background:color-mix(in srgb,var(--hub-accent) 12%,var(--hub-surface)); color:var(--hub-accent); }
      .room-title h2 { margin:3px 0 0; font-size:22px; }
      .room-title p:last-child { margin:3px 0 0; color:var(--hub-muted); font-size:11px; }
      .room-control-list { display:grid; gap:9px; margin-top:18px; }
      .control-row { display:grid; grid-template-columns:minmax(0,1fr) 38px; gap:7px; align-items:center; }
      .control-main,.media-room-control { min-height:54px; border:1px solid color-mix(in srgb,var(--hub-muted) 13%,transparent); border-radius:15px; background:var(--hub-surface); color:var(--hub-text); display:flex; gap:10px; align-items:center; text-align:left; padding:9px 12px; cursor:pointer; }
      .control-main.is-on { color:var(--hub-text); background:color-mix(in srgb,#f2b85c 18%,var(--hub-surface)); }
      .control-main strong,.control-main small,.media-room-control strong,.media-room-control small { display:block; }
      .control-main small,.media-room-control small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .climate-control { padding:14px; border-radius:16px; background:linear-gradient(145deg,color-mix(in srgb,#ee6c62 12%,var(--hub-surface)),var(--hub-surface)); display:flex; align-items:center; justify-content:space-between; }
      .climate-control span,.climate-control strong,.climate-control small { display:block; }
      .climate-control span { color:var(--hub-muted); font-size:10px; }
      .climate-control strong { margin-top:2px; font-size:27px; }
      .climate-control small { color:var(--hub-muted); font-size:10px; }
      .stepper { display:flex; gap:5px; }
      .stepper button,.cover-control button { width:36px; height:36px; border:0; border-radius:11px; background:var(--hub-surface); color:var(--hub-accent); font-weight:700; cursor:pointer; }
      .cover-control { min-height:60px; border-radius:15px; background:var(--hub-surface); padding:9px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .cover-control > span { display:grid; grid-template-columns:25px minmax(0,1fr); grid-template-rows:auto auto; column-gap:7px; align-items:center; }
      .cover-control > span ha-icon { grid-row:1/3; }
      .cover-control strong,.cover-control small { display:block; }
      .cover-control small { color:var(--hub-muted); font-size:10px; }
      .cover-control > div { display:flex; gap:4px; }
      .scene-list,.room-media { margin-top:18px; display:flex; gap:7px; flex-wrap:wrap; }
      .scene-list .eyebrow,.room-media .eyebrow { flex-basis:100%; }
      .scene-button { min-height:40px; padding:0 12px; border:0; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 10%,var(--hub-surface)); color:var(--hub-accent); display:flex; align-items:center; gap:6px; cursor:pointer; }
      .media-room-control { width:100%; }
      .family-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.55fr) minmax(310px,.72fr); gap:14px; }
      .map-panel { padding:18px; min-height:0; display:grid; grid-template-rows:48px minmax(0,1fr); gap:9px; overflow:hidden; }
      .map-slot { overflow:hidden; }
      .family-sidebar { min-height:0; display:grid; grid-template-rows:repeat(2,minmax(0,1fr)); gap:14px; }
      .family-person { padding:18px; min-height:0; overflow:auto; }
      .family-person-heading { display:flex; align-items:center; gap:10px; }
      .family-person-heading > span { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; background:var(--person-colour); color:#fff; font-weight:700; }
      .family-person-heading h2 { margin:3px 0 0; font-size:16px; }
      .family-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:15px; }
      .family-facts span { padding:8px; border-radius:12px; background:color-mix(in srgb,var(--person-colour) 8%,var(--hub-surface)); color:var(--hub-muted); font-size:9px; }
      .family-facts strong { display:block; color:var(--hub-text); font-size:16px; }
      .assignment { display:flex; gap:8px; margin-top:13px; padding-top:12px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 16%,transparent); }
      .assignment > div { min-width:0; }
      .assignment strong,.assignment small,.assignment a { display:block; }
      .assignment a { color:var(--hub-accent); font-weight:800; text-decoration-thickness:1px; text-underline-offset:3px; overflow-wrap:anywhere; }
      .assignment small { margin-top:3px; color:var(--hub-muted); font-size:9px; }
      .classroom-health { margin-top:7px; display:flex; align-items:center; gap:5px; color:var(--hub-muted); font-size:10px; font-weight:700; line-height:1.3; }
      .classroom-health ha-icon { flex:0 0 auto; --mdc-icon-size:15px; }
      .classroom-health.is-stale { color:#9b6400; }
      .classroom-locked { opacity:.82; }
      .security-layout { position:relative; height:100%; min-height:0; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(260px,.72fr); gap:14px; }
      .security-main { min-height:0; display:grid; grid-template-rows:repeat(2,minmax(0,1fr)); gap:14px; }
      .security-camera { min-height:0; padding:17px; display:grid; grid-template-rows:auto auto minmax(0,1fr); gap:11px; overflow:hidden; }
      .security-card-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .security-card-heading h2 { margin:4px 0 0; font-size:19px; }
      .privacy-badge { min-height:34px; padding:0 10px; border:1px solid rgba(255,255,255,.11); border-radius:10px; background:rgba(255,255,255,.06); color:var(--hub-muted); display:flex; align-items:center; gap:5px; font-size:12px; font-weight:750; white-space:nowrap; }
      .privacy-badge ha-icon { --mdc-icon-size:14px; color:#bcaeff; }
      .security-signals { display:flex; gap:7px; }
      .security-signal { min-width:0; flex:1; display:grid; grid-template-columns:25px minmax(0,1fr); grid-template-rows:auto auto; align-items:center; column-gap:6px; padding:7px 8px; border:1px solid rgba(255,255,255,.08); border-radius:11px; background:rgba(8,15,31,.44); }
      .security-signal ha-icon { grid-row:1/3; --mdc-icon-size:17px; color:#8893a8; }
      .security-signal strong,.security-signal small { overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
      .security-signal strong { font-size:9px; }
      .security-signal small { color:var(--hub-muted); font-size:7px; }
      .security-signal.is-active { border-color:rgba(239,164,71,.52); background:rgba(121,68,20,.34); }
      .security-signal.is-active ha-icon { color:#ffc06f; }
      .security-signal.is-unavailable { border-style:dashed; background:rgba(8,15,31,.3); }
      .security-signal.is-unavailable ha-icon,.security-signal.is-unavailable small { color:#7f899d; }
      .camera-idle { min-height:0; display:grid; grid-template-columns:54px minmax(0,1fr) auto; align-items:center; gap:13px; padding:14px; border:1px dashed rgba(255,255,255,.13); border-radius:15px; background:radial-gradient(circle at 10% 50%,rgba(123,104,211,.18),transparent 32%),rgba(6,12,27,.45); }
      .camera-idle > ha-icon { --mdc-icon-size:42px; color:#a999ff; }
      .camera-idle strong,.camera-idle small { display:block; }
      .camera-idle small { margin-top:4px; max-width:330px; color:var(--hub-muted); font-size:12px; line-height:1.4; }
      .camera-idle button,.camera-close { min-height:44px; padding:0 13px; border:0; border-radius:12px; background:var(--hub-accent); color:#fff; display:flex; align-items:center; gap:5px; font-size:12px; font-weight:800; cursor:pointer; }
      .camera-stream { position:relative; min-height:0; overflow:hidden; border-radius:15px; background:#050a15; }
      .camera-card-slot { display:block; width:100%; height:100%; min-height:130px; border-radius:0; overflow:hidden; }
      .camera-card-slot .embedded-card { height:100%; }
      .camera-card-slot::slotted(.embedded-card) { display:block; height:100%; min-height:130px; }
      .camera-stream.is-buffering .camera-card-slot { opacity:.24; }
      .camera-stream-overlay { position:absolute; z-index:3; inset:0; display:flex; align-items:center; justify-content:center; gap:13px; padding:20px 80px 20px 20px; background:radial-gradient(circle at 18% 50%,rgba(123,104,211,.28),transparent 36%),linear-gradient(135deg,rgba(5,10,21,.76),rgba(12,20,39,.68)); color:#fff; backdrop-filter:blur(1.5px); }
      .camera-stream-overlay > ha-icon { flex:0 0 auto; --mdc-icon-size:34px; color:#b9adff; animation:camera-spin 1.4s linear infinite; }
      .camera-stream-overlay strong,.camera-stream-overlay small { display:block; }
      .camera-stream-overlay strong { font-size:15px; }
      .camera-stream-overlay small { margin-top:5px; color:#bac4d7; font-size:12px; line-height:1.4; }
      .camera-stream-overlay button { min-height:44px; margin-top:12px; padding:0 14px; border:1px solid rgba(255,255,255,.24); border-radius:12px; background:rgba(255,255,255,.1); color:#fff; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800; cursor:pointer; }
      .camera-stream-overlay button ha-icon { --mdc-icon-size:18px; }
      .camera-live-indicator { position:absolute; z-index:3; top:9px; left:9px; min-height:30px; padding:0 11px; border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(8,15,31,.82); color:#fff; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:850; letter-spacing:.04em; text-transform:uppercase; }
      .camera-live-indicator > span { width:7px; height:7px; border-radius:50%; background:#ff5f64; box-shadow:0 0 0 3px rgba(255,95,100,.18); }
      .camera-close { position:absolute; z-index:4; right:9px; bottom:9px; background:rgba(8,15,31,.86); border:1px solid rgba(255,255,255,.18); }
      .camera-is-starting > ha-icon,.camera-is-stopping > ha-icon { animation:camera-spin 1.4s linear infinite; }
      @keyframes camera-spin { to { transform:rotate(360deg); } }
      .security-sidebar { min-height:0; display:grid; grid-template-rows:minmax(0,1fr) auto auto; gap:12px; }
      .alarm-panel,.garage-panel { padding:17px; overflow:hidden; }
      .alarm-state { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:rgba(70,144,111,.22); color:#7bd4a7; }
      .alarm-state.is-alert { background:rgba(184,53,57,.32); color:#ff9999; }
      .alarm-state.is-unavailable { background:rgba(255,255,255,.06); color:#7f899d; }
      .alarm-panel > p { margin:13px 0 0; color:var(--hub-muted); font-size:9px; line-height:1.4; }
      .alarm-actions { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:15px; }
      .alarm-actions button { min-width:0; min-height:46px; border:0; border-radius:12px; background:rgba(123,104,211,.17); color:#c9beff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:8px; font-weight:800; cursor:pointer; }
      .alarm-actions button.is-danger { background:rgba(176,57,61,.22); color:#ffaaa7; }
      .alarm-actions ha-icon { --mdc-icon-size:17px; }
      .garage-heading { display:flex; align-items:center; gap:10px; }
      .garage-heading > span { width:43px; height:43px; display:grid; place-items:center; border-radius:14px; background:rgba(123,104,211,.18); color:#c5b9ff; }
      .garage-heading h2 { margin:3px 0 0; font-size:18px; }
      .garage-motion { display:flex; align-items:center; gap:6px; margin:13px 0 0; color:var(--hub-muted); font-size:9px; }
      .garage-motion.is-active { color:#ffc06f; }
      .garage-motion.is-unavailable { color:#7f899d; }
      .garage-action { width:100%; min-height:43px; margin-top:13px; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:rgba(123,104,211,.18); color:#d7d0ff; display:flex; align-items:center; justify-content:center; gap:6px; font-size:10px; font-weight:800; cursor:pointer; }
      .security-privacy-note { display:flex; align-items:flex-start; gap:7px; margin:0; padding:10px 12px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(8,15,31,.46); color:var(--hub-muted); font-size:8px; line-height:1.35; }
      .security-privacy-note ha-icon { flex:0 0 auto; --mdc-icon-size:16px; color:#a999ff; }
      .confirmation-backdrop { position:absolute; z-index:30; inset:0; display:grid; place-items:center; padding:20px; border-radius:var(--hub-radius); background:rgba(2,7,17,.72); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); }
      .confirmation-dialog { width:min(390px,90%); padding:25px; border:1px solid rgba(255,255,255,.18); border-radius:22px; background:linear-gradient(155deg,#1a2440,#352c4b); color:#fff; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,.5); }
      .confirmation-dialog > span { width:58px; height:58px; margin:0 auto 13px; display:grid; place-items:center; border-radius:19px; background:rgba(239,164,71,.17); color:#ffc06f; }
      .confirmation-dialog > span ha-icon { --mdc-icon-size:30px; }
      .confirmation-dialog h2 { margin:6px 0 0; font-size:22px; }
      .confirmation-dialog > p:not(.eyebrow) { margin:10px 0 0; color:#bcc4d5; font-size:11px; line-height:1.45; }
      .confirmation-dialog > div { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:20px; }
      .confirmation-dialog button { min-height:46px; border:1px solid rgba(255,255,255,.14); border-radius:13px; background:rgba(255,255,255,.07); color:#fff; font-weight:800; cursor:pointer; }
      .confirmation-dialog button.confirm-primary { border-color:transparent; background:var(--hub-accent); }
      .football-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(260px,.62fr); gap:14px; }
      .football-main { min-height:0; padding:18px; display:grid; grid-template-rows:54px minmax(0,1fr); overflow:hidden; }
      .football-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:12px; align-items:center; }
      .football-toolbar h2 { margin:3px 0 0; font-size:20px; }
      .matchweek-controls { display:flex; align-items:center; gap:4px; }
      .matchweek-controls button { width:34px; height:34px; display:grid; place-items:center; border:0; border-radius:10px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-accent); cursor:pointer; }
      .matchweek-controls button:disabled { opacity:.35; cursor:default; }
      .matchweek-controls select { height:34px; min-width:76px; border:1px solid color-mix(in srgb,var(--hub-muted) 18%,transparent); border-radius:10px; background:var(--hub-surface); color:var(--hub-text); padding:0 8px; }
      .football-tabs .segment { min-height:30px; }
      .fixture-groups { min-height:0; overflow:auto; padding-right:4px; }
      .fixture-day h3 { margin:13px 0 7px; color:var(--hub-muted); font-size:10px; letter-spacing:.09em; text-transform:uppercase; }
      .fixture { min-height:46px; display:grid; grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr); align-items:center; gap:8px; padding:6px 10px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 12%,transparent); }
      .fixture.is-spotlight { border-radius:12px; border:1px solid color-mix(in srgb,var(--hub-accent) 26%,transparent); background:color-mix(in srgb,var(--hub-accent) 6%,var(--hub-surface)); margin:4px 0; }
      .fixture.is-live { border-color:#d94848; }
      .team { font-size:12px; font-weight:600; }
      .away-team { text-align:right; }
      .fixture-score { text-align:center; font-size:14px; }
      .fixture-score small { display:block; margin-top:2px; color:var(--hub-muted); font-size:8px; }
      .fixture.is-live .fixture-score small { color:#d94848; }
      .scorers { grid-column:1/-1; text-align:center; color:var(--hub-muted); font-size:8px; }
      .football-sidebar { min-height:0; }
      .favourite-standings { min-height:0; padding:18px; overflow:hidden; }
      .favourite-standings h2 { margin:5px 0 0; font-size:18px; }
      .favourite-standing-list { display:grid; gap:10px; margin-top:16px; }
      .favourite-standing { position:relative; min-width:0; min-height:64px; padding:9px 10px; display:grid; grid-template-columns:34px minmax(0,1fr) auto; gap:9px; align-items:center; overflow:hidden; border:1px solid color-mix(in srgb,var(--club-accent) 34%,transparent); border-radius:14px; background:color-mix(in srgb,var(--club-primary) 7%,var(--hub-surface)); }
      .favourite-standing::before { content:""; position:absolute; inset:0 auto 0 0; width:4px; background:var(--club-primary); }
      .favourite-standing strong,.favourite-standing small { display:block; }
      .favourite-standing small { margin-top:3px; color:var(--hub-muted); font-size:9px; }
      .favourite-standing b { color:var(--club-primary); font-size:17px; }
      .league-table-wrap { min-height:0; overflow:auto; margin-top:10px; }
      .league-table { width:100%; border-collapse:collapse; font-size:11px; }
      .league-table th,.league-table td { padding:7px 8px; text-align:right; border-bottom:1px solid color-mix(in srgb,var(--hub-muted) 12%,transparent); }
      .league-table th:nth-child(2),.league-table td:nth-child(2) { text-align:left; }
      .league-table tr.is-spotlight { background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); }
      .calendar-view { position:relative; display:grid; grid-template-rows:58px minmax(0,1fr); gap:10px; background:linear-gradient(155deg,rgba(250,246,245,.94),rgba(235,230,242,.91)); }
      .calendar-toolbar { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:14px; }
      .calendar-context { min-width:max-content; display:flex; align-items:center; gap:9px; color:#0B1830; }
      .calendar-context > ha-icon { --mdc-icon-size:22px; color:#1463E8; }
      .calendar-context > span,.calendar-context strong,.calendar-context small { display:block; }
      .calendar-context strong { font-size:15px; }
      .calendar-context small { margin-top:2px; color:#5E6B80; font-size:12px; font-weight:650; }
      .calendar-modes { flex-wrap:nowrap; }
      .calendar-card-slot { height:100%; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:rgba(7,14,29,.62); --ha-card-background:transparent; --card-background-color:transparent; --ha-card-border-width:0; --ha-card-box-shadow:none; --primary-text-color:#f7f8fc; --secondary-text-color:#b6bdce; }
      .calendar-card-slot .embedded-card { height:100%; min-height:0; overflow:auto; }
      .calendar-fallback { position:relative; height:100%; min-height:0; padding:10px; }
      .calendar-legends { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:7px 13px; }
      .calendar-legend { display:flex; align-items:center; gap:5px; color:#42495b; font-size:10px; font-weight:700; }
      .calendar-legend i { width:8px; height:8px; border-radius:50%; background:var(--calendar-colour); box-shadow:0 0 0 3px color-mix(in srgb,var(--calendar-colour) 16%,transparent); }
      .calendar-loading { position:absolute; top:14px; right:18px; z-index:2; display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; background:#fff; color:#4d5568; font-size:9px; box-shadow:0 7px 20px rgba(27,34,53,.12); }
      .calendar-loading span { width:8px; height:8px; border-radius:50%; background:var(--hub-accent); animation:pulse 1.2s ease-in-out infinite; }
      .calendar-warning { position:absolute; z-index:2; bottom:12px; left:50%; transform:translateX(-50%); margin:0; padding:8px 12px; border-radius:12px; background:#fff3d9; color:#704b0d; font-size:9px; box-shadow:0 7px 18px rgba(45,35,14,.14); }
      .hub-agenda-board { min-width:0; min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; overflow:hidden; }
      .hub-agenda-day { min-width:0; min-height:0; display:grid; grid-template-rows:58px minmax(0,1fr); border:1px solid rgba(81,78,99,.12); border-radius:17px; background:rgba(255,255,255,.62); overflow:hidden; }
      .hub-agenda-day.is-today { border-color:color-mix(in srgb,var(--hub-accent) 45%,transparent); background:color-mix(in srgb,var(--hub-accent) 8%,#fff); box-shadow:inset 0 3px 0 var(--hub-accent); }
      .hub-agenda-day > header { padding:9px 8px 7px; display:grid; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:auto auto; align-items:end; border-bottom:1px solid rgba(81,78,99,.1); color:#242a3a; }
      .hub-agenda-day > header span { align-self:start; color:#656c7f; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
      .hub-agenda-day > header strong { grid-row:1/3; font-size:25px; line-height:1; }
      .hub-agenda-day > header small { color:#7a8090; font-size:9px; }
      .hub-agenda-events { min-height:0; padding:7px; display:flex; flex-direction:column; gap:6px; overflow:auto; }
      .hub-agenda-event { position:relative; min-width:0; padding:8px 7px 8px 10px; border-radius:11px; background:color-mix(in srgb,var(--calendar-colour) 10%,#fff); color:#222838; box-shadow:0 4px 12px rgba(30,35,54,.07); }
      .hub-agenda-event::before { content:""; position:absolute; inset:5px auto 5px 0; width:3px; border-radius:3px; background:var(--calendar-colour); }
      .hub-agenda-event .event-time { display:block; color:var(--calendar-colour); font-size:8px; font-weight:850; letter-spacing:.04em; }
      .hub-agenda-event strong { display:-webkit-box; margin-top:3px; overflow:hidden; color:#1d2333; font-size:10px; line-height:1.25; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
      .hub-agenda-event small { display:flex; align-items:center; gap:2px; margin-top:5px; overflow:hidden; color:#656c7f; font-size:8px; white-space:nowrap; text-overflow:ellipsis; }
      .hub-agenda-event small ha-icon { --mdc-icon-size:11px; }
      .hub-agenda-empty { margin:12px 4px; color:#8a8f9d; font-size:9px; line-height:1.4; }
      .hub-agenda-more { margin:auto 4px 2px; color:var(--hub-accent); font-size:9px; font-weight:750; }
      .family-dashboard { height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); gap:10px; }
      .family-dashboard-heading { min-height:48px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 2px; }
      .family-dashboard-heading h2 { margin:3px 0 0; color:var(--hub-text); font-size:22px; }
      .choreops-link { min-height:48px; padding:0 14px; display:inline-flex; align-items:center; justify-content:center; gap:7px; border:1px solid color-mix(in srgb,var(--hub-accent) 24%,transparent); border-radius:14px; background:color-mix(in srgb,var(--hub-accent) 8%,var(--hub-surface)); color:var(--hub-accent); font-size:12px; font-weight:800; text-decoration:none; }
      .choreops-link ha-icon { --mdc-icon-size:18px; }
      .family-sidebar-link { flex:0 0 auto; align-self:flex-end; }
      .family-people-grid { min-height:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .family-people-grid .family-person { padding:15px 20px; }
      .family-people-grid .chore-list { grid-template-columns:1fr; }
      .chore-heading { display:flex; align-items:center; justify-content:space-between; margin-top:14px; }
      .chore-heading span { color:var(--hub-muted); font-size:9px; }
      .family-connection-warning { margin:13px 0 0; padding:10px 12px; display:flex; align-items:center; gap:7px; border:1px solid #e8d29d; border-radius:12px; background:#fff9e8; color:#704b0d; font-size:12px; line-height:1.35; }
      .family-connection-warning ha-icon { flex:0 0 auto; --mdc-icon-size:17px; }
      .chore-list { margin:8px 0 0; padding:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; list-style:none; }
      .chore-row { min-width:0; min-height:54px; display:grid; grid-template-columns:28px minmax(0,1fr) auto; gap:7px; align-items:center; padding:7px 9px; border:1px solid color-mix(in srgb,var(--person-colour) 16%,transparent); border-radius:13px; background:color-mix(in srgb,var(--person-colour) 7%,rgba(255,255,255,.72)); }
      .chore-check { width:26px; height:26px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb,var(--person-colour) 14%,#fff); color:var(--person-colour); }
      .chore-check ha-icon { --mdc-icon-size:16px; }
      .chore-row strong,.chore-row small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
      .chore-row strong { color:var(--hub-text); font-size:10px; }
      .chore-row small { margin-top:2px; color:var(--hub-muted); font-size:8px; }
      .chore-row b { color:var(--person-colour); font-size:9px; }
      .chore-row.is-done { opacity:.7; }
      .chore-row.is-done .chore-check { background:#dff3e8; color:#18794e; }
      .chore-row.is-overdue { border-color:#e9978f; background:#fff0ef; }
      .chore-row.is-overdue .chore-check { background:#f9d5d1; color:#a9362d; }
      .chore-row.is-waiting .chore-check { background:#fff0cf; color:#8b5b00; }
      .family-summary-grid { min-width:0; margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(105px,1fr)); gap:7px; }
      .family-summary-item { min-width:0; min-height:72px; padding:8px; display:grid; grid-template-columns:26px minmax(0,1fr); gap:6px; align-items:center; border:1px solid color-mix(in srgb,var(--person-colour) 16%,transparent); border-radius:13px; background:color-mix(in srgb,var(--person-colour) 4%,var(--hub-surface)); }
      .family-summary-item > span { width:26px; height:26px; display:grid; place-items:center; border-radius:8px; background:color-mix(in srgb,var(--person-colour) 11%,var(--hub-surface)); color:var(--person-colour); }
      .family-summary-item ha-icon { --mdc-icon-size:17px; }
      .family-summary-item p,.family-summary-item strong,.family-summary-item small { display:block; margin:0; overflow-wrap:anywhere; }
      .family-summary-item p { color:var(--hub-text); font-size:12px; font-weight:800; line-height:1.15; }
      .family-summary-item strong { color:var(--hub-text); font-size:12px; line-height:1.2; }
      .family-summary-item small { margin-top:2px; color:var(--hub-muted); font-size:12px; line-height:1.2; }
      .family-summary-item.is-done > span { background:#dff3e8; color:#18794e; }
      .family-summary-item.is-unavailable { opacity:.7; }
      .family-summary-item.is-unavailable > span { background:color-mix(in srgb,var(--hub-muted) 10%,var(--hub-surface)); color:var(--hub-muted); }
      .football-empty { min-height:0; height:100%; display:grid; grid-template-columns:90px minmax(0,1fr) auto; gap:20px; align-items:center; padding:26px; border:1px dashed color-mix(in srgb,var(--hub-accent) 32%,transparent); border-radius:18px; background:linear-gradient(145deg,color-mix(in srgb,var(--hub-accent) 7%,#fff),rgba(255,255,255,.5)); }
      .football-orbit { width:82px; height:82px; display:grid; place-items:center; border-radius:50%; background:radial-gradient(circle,#fff 34%,color-mix(in srgb,var(--hub-accent) 18%,#fff) 35% 58%,transparent 59%); color:var(--hub-accent); box-shadow:0 12px 28px rgba(31,36,57,.12); }
      .football-orbit ha-icon { --mdc-icon-size:34px; }
      .football-empty h3 { margin:5px 0 0; color:var(--hub-text); font-size:19px; }
      .football-empty p:last-child { max-width:440px; margin:7px 0 0; color:var(--hub-muted); font-size:12px; line-height:1.45; }
      .empty-clubs { display:flex; align-items:center; gap:8px; }
      .empty-clubs span { width:42px; height:42px; display:grid; place-items:center; border-radius:12px; background:var(--hub-nav); color:#fff; font-size:12px; font-weight:800; }
      .empty-clubs i { width:16px; height:1px; background:color-mix(in srgb,var(--hub-muted) 32%,transparent); }
      .hub-empty-state { color:var(--hub-muted); font-size:12px; line-height:1.45; }
      .hub-empty-state.compact { margin:14px 0 0; font-size:12px; }
      .hub-empty-state.large { display:grid; place-items:center; min-height:260px; text-align:center; }
      .surface .eyebrow { color:rgba(223,228,241,.64); }
      .surface h2,.surface h3,.surface strong { color:var(--hub-text); }
      .next-panel { background:linear-gradient(155deg,rgba(24,34,62,.9),rgba(55,43,73,.76)); }
      .children-panel { background:linear-gradient(155deg,rgba(27,39,65,.88),rgba(54,39,65,.74)); }
      .football-panel { background:linear-gradient(155deg,rgba(25,39,55,.88),rgba(55,45,66,.74)); }
      .now-playing-panel { background:linear-gradient(155deg,rgba(30,29,56,.9),rgba(67,43,76,.76)); }
      .person-summary { border:1px solid color-mix(in srgb,var(--person-colour) 26%,transparent); background:color-mix(in srgb,var(--person-colour) 14%,rgba(12,20,39,.72)); }
      .compact-fixture { border-color:rgba(255,255,255,.12); background:rgba(10,18,36,.54); }
      .room-detail { background:linear-gradient(160deg,rgba(25,34,58,.92),rgba(48,38,64,.82)); }
      .read-only-note,.control-main,.media-room-control,.climate-control,.cover-control { border-color:rgba(255,255,255,.1); background:rgba(10,18,36,.48); }
      .stepper button,.cover-control button { background:rgba(255,255,255,.09); color:#bcaeff; }
      .calendar-view { background:linear-gradient(155deg,rgba(18,27,49,.94),rgba(48,38,67,.9)); }
      .calendar-legend { color:#dce1ef; }
      .hub-agenda-day { border-color:rgba(255,255,255,.11); background:rgba(8,16,33,.52); }
      .hub-agenda-day.is-today { border-color:color-mix(in srgb,var(--hub-accent) 72%,#fff); background:color-mix(in srgb,var(--hub-accent) 16%,rgba(8,16,33,.72)); box-shadow:inset 0 3px 0 #a999ff; }
      .hub-agenda-day > header { border-color:rgba(255,255,255,.09); color:#fff; }
      .hub-agenda-day > header span,.hub-agenda-day > header small { color:#aeb7ca; }
      .hub-agenda-event { border:1px solid color-mix(in srgb,var(--calendar-colour) 32%,rgba(255,255,255,.08)); background:color-mix(in srgb,var(--calendar-colour) 19%,rgba(13,21,40,.92)); color:#fff; box-shadow:0 7px 18px rgba(1,5,16,.22); }
      .hub-agenda-event strong { color:#f7f8fc; }
      .hub-agenda-event small { color:#b7bfd0; }
      .hub-agenda-empty { color:#8f99ad; }
      .family-person { background:linear-gradient(155deg,color-mix(in srgb,var(--person-colour) 13%,rgba(20,29,51,.94)),rgba(32,29,52,.88)); }
      .family-facts span { border:1px solid color-mix(in srgb,var(--person-colour) 17%,transparent); background:color-mix(in srgb,var(--person-colour) 10%,rgba(8,15,31,.55)); }
      .chore-row { border-color:color-mix(in srgb,var(--person-colour) 25%,transparent); background:color-mix(in srgb,var(--person-colour) 11%,rgba(8,15,31,.62)); }
      .chore-check { background:color-mix(in srgb,var(--person-colour) 22%,rgba(8,15,31,.72)); }
      .chore-row.is-overdue { border-color:#d56e69; background:rgba(112,38,42,.42); }
      .chore-row.is-overdue .chore-check { background:rgba(202,74,69,.34); color:#ffaaa3; }
      .football-main,.favourite-standings { background:linear-gradient(155deg,rgba(18,30,48,.93),rgba(47,38,61,.88)); }
      .football-empty { border-color:rgba(255,255,255,.12); background:radial-gradient(circle at 10% 50%,rgba(123,104,211,.22),transparent 28%),linear-gradient(145deg,rgba(11,20,40,.86),rgba(39,32,57,.78)); }
      .football-orbit { background:radial-gradient(circle,rgba(169,153,255,.95) 0 34%,rgba(123,104,211,.3) 35% 58%,transparent 59%); color:#fff; box-shadow:0 12px 28px rgba(1,5,16,.34); }
      .football-empty p:last-child { color:#aeb7ca; }
      .fixture { border-color:rgba(255,255,255,.09); }
      .fixture.is-spotlight { border-color:color-mix(in srgb,var(--hub-accent) 52%,transparent); background:color-mix(in srgb,var(--hub-accent) 13%,rgba(9,17,34,.72)); }
      .league-table th,.league-table td { border-color:rgba(255,255,255,.08); }
      .league-table tr.is-spotlight { background:color-mix(in srgb,var(--hub-accent) 15%,rgba(8,15,31,.62)); }
      .matchweek-controls select { border-color:rgba(255,255,255,.12); background:rgba(8,15,31,.66); }
      .music-experience { height:100%; min-height:0; }
      .media-player-panel { height:100%; min-height:0; padding:20px; display:grid; grid-template-rows:58px minmax(0,1fr); gap:12px; overflow:visible; background:radial-gradient(circle at 85% 10%,rgba(123,104,211,.32),transparent 35%),linear-gradient(145deg,rgba(16,25,48,.96),rgba(52,38,70,.9)); }
      .music-heading { align-items:center; }
      .music-heading h2 { font-size:24px; }
      .music-meta { display:flex; align-items:center; gap:4px; white-space:nowrap; }
      .music-meta ha-icon { --mdc-icon-size:14px; color:#b7a8ff; }
      .media-player-stage { position:relative; min-height:0; overflow:auto; overscroll-behavior:contain; scrollbar-gutter:stable; border:1px solid rgba(255,255,255,.12); border-radius:18px; background:#07182F; }
      .media-player-stage .child-card-slot { min-height:100%; overflow:visible; touch-action:pan-x pan-y; border-radius:0; --ha-card-background:#07182F; --card-background-color:#07182F; --primary-background-color:#07182F; --secondary-background-color:#102A4A; --primary-text-color:#f7f8fc; --secondary-text-color:#b6bdce; --mmpc-card:#07182F; --mmpc-on-card:#f7f8fc; --mmpc-on-card-muted:#b6bdce; --mmpc-on-card-divider:rgba(255,255,255,.12); --mmpc-chip-background:#263251; --mmpc-chip-foreground:#f7f8fc; --mmpc-chip-border:rgba(255,255,255,.18); }
      .media-player-stage .embedded-card { min-height:100%; overflow:visible; --ha-card-border-width:0; --ha-card-box-shadow:none; }
      .media-player-stage #mmpc-group-chips-controller { width:auto !important; max-width:100%; display:flex !important; flex-wrap:wrap !important; gap:8px; overflow:visible !important; padding:4px 2px; }
      .media-player-stage #mmpc-group-chips-controller > * { margin:0 !important; }
      @keyframes pulse { 0%,100% { opacity:.45; transform:scale(.8); } 50% { opacity:1; transform:scale(1); } }
      .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      button:focus-visible,select:focus-visible,a[href]:focus-visible,.room-hotspot:focus-visible,.alarm-panel:focus-visible,.garage-panel:focus-visible { outline:3px solid var(--hub-focus); outline-offset:2px; box-shadow:0 0 0 2px #fff; }
      @media (max-width:1030px) {
        .hub-shell { grid-template-columns:74px minmax(0,1fr); }
        .hub-navigation { padding-inline:7px; }
        .hub-brand { width:50px; height:50px; }
        .hub-nav-button { min-height:60px; }
        .hub-content { padding-inline:14px; }
        .today-grid { grid-template-columns:minmax(0,1.25fr) minmax(225px,.88fr) minmax(220px,.82fr); }
        .today-grid article { padding:17px; }
        .rooms-layout { grid-template-columns:minmax(0,2.9fr) minmax(224px,1fr); }
        .whole-home-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .heating-grid,.cover-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .security-layout { grid-template-columns:minmax(0,1.55fr) 246px; }
        .football-layout { grid-template-columns:minmax(0,1.6fr) 250px; }
      }
      @media (max-width:760px) {
        :host { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-card { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-shell { display:block; }
        .hub-navigation { position:sticky; top:0; z-index:20; flex-direction:row; padding:7px; overflow-x:auto; }
        .hub-brand { flex:0 0 44px; width:44px; height:44px; }
        .hub-nav-items { flex-direction:row; justify-content:flex-start; }
        .hub-nav-button { flex:0 0 64px; min-height:48px; }
        .hub-nav-button span { display:none; }
        .hub-content { display:block; padding:10px; }
        .hub-topbar { min-height:64px; }
        .hub-view { min-height:620px; }
        .today-grid,.rooms-layout,.family-layout,.security-layout,.football-layout { display:flex; flex-direction:column; height:auto; }
        .home-surface { height:auto; grid-template-rows:auto auto; }
        .home-toolbar { align-items:flex-start; flex-direction:column; }
        .home-segments { max-width:100%; }
        .home-overview { height:auto; grid-template-rows:auto auto; }
        .home-summary-links { grid-template-columns:1fr; }
        .home-summary-links[data-summary-count="2"] { grid-template-columns:1fr; }
        .hero-metrics.has-energy { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .whole-home-grid,.heating-grid,.cover-grid { grid-template-columns:1fr; height:auto; }
        .cleaning-panel { height:auto; display:flex; flex-direction:column; }
        .vacuum-map-slot,.vacuum-map-placeholder { min-height:320px; }
        .energy-view { height:auto; grid-template-rows:auto auto auto; }
        .energy-hero { align-items:flex-start; flex-direction:column; }
        .energy-meter-grid { grid-template-columns:1fr; }
        .security-main { display:flex; flex-direction:column; }
        .security-camera { min-height:300px; }
        .hero-panel { grid-column:auto; }
        .family-sidebar { display:flex; flex-direction:column; }
        .floorplan-canvas { min-height:420px; }
        .football-main { min-height:620px; }
      }

      /* v0.9 design system: warm, light Family OS. These rules intentionally
         sit after the production styles so the prototype is exercised through
         the real component and interaction boundaries. */
      .hub-card { --hub-accent:#1463E8 !important; --hub-background:#F4F7FA !important; --hub-surface:#FFFFFF !important; --hub-text:#0B1830 !important; --hub-muted:#5E6B80 !important; --hub-nav:#061B3A !important; --hub-backdrop-start:#F4F7FA !important; --hub-backdrop-mid:#EEF3F8 !important; --hub-backdrop-end:#E6EEF7 !important; }
      .hub-card,.hub-shell { background:#F4F7FA; color:#0B1830; }
      .hub-shell { grid-template-columns:108px minmax(0,1fr); }
      .hub-navigation { padding:18px 12px; gap:18px; background:#061B3A; border:0; box-shadow:12px 0 34px rgba(6,27,58,.08); }
      .hub-brand { width:68px; height:68px; margin:0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:1px solid rgba(255,255,255,.16); border-radius:22px; background:rgba(255,255,255,.09); box-shadow:none; }
      .hub-brand ha-icon { --mdc-icon-size:25px; }
      .hub-brand span { font-size:12px; font-weight:750; letter-spacing:.01em; }
      .hub-nav-items { flex:0 0 auto; justify-content:flex-start; gap:6px; }
      .hub-nav-core { flex:1; }
      .hub-nav-utility { margin-top:auto; }
      .hub-nav-divider { display:block; height:1px; margin:2px 10px 8px; background:rgba(255,255,255,.13); }
      .hub-nav-button { min-height:58px; gap:5px; border:0; border-radius:17px; color:#A8B7CB; }
      .hub-nav-button ha-icon { --mdc-icon-size:23px; }
      .hub-nav-button span { font-size:12px; font-weight:700; }
      .hub-nav-button.is-active { color:#061B3A; background:#fff; border:0; box-shadow:0 8px 24px rgba(0,0,0,.18); }
      .hub-content { padding:16px 26px 24px; grid-template-rows:70px minmax(0,1fr); gap:14px; background:#F4F7FA; }
      .hub-topbar { color:#0B1830; padding:0; }
      .hub-page-title { display:flex; align-items:baseline; gap:14px; }
      .hub-topbar h1 { margin:0; font-size:34px; line-height:1; letter-spacing:-.035em; font-weight:800; }
      .hub-topbar-date { order:2; margin:0; color:#5E6B80; font-size:14px; font-weight:650; }
      .hub-header-actions { gap:10px; }
      .hub-weather-pill { min-height:48px; padding:0 15px; border:1px solid #DCE4EE; border-radius:16px; background:#fff; color:#0B1830; box-shadow:0 5px 18px rgba(11,24,48,.05); font-size:14px; font-weight:700; }
      .hub-weather-pill ha-icon { color:#E7A93D; }
      .hub-topbar-time { min-width:82px; color:#0B1830; font-size:26px; line-height:1; font-weight:800; letter-spacing:-.03em; text-align:right; }
      .eyebrow { color:#5E6B80; font-size:12px; line-height:1.2; font-weight:800; letter-spacing:.1em; }
      .surface { color:#0B1830; border:1px solid #DCE4EE; background:#fff; border-radius:24px; box-shadow:0 12px 32px rgba(21,43,75,.065); -webkit-backdrop-filter:none; backdrop-filter:none; }
      .surface .eyebrow { color:#5E6B80; }
      .surface h2,.surface h3,.surface strong { color:#0B1830; }
      .section-heading h2 { font-size:20px; }
      .section-heading > span { font-size:12px; }
      .section-heading > button,.text-action { min-width:48px; min-height:48px; padding:0 4px; display:flex; align-items:center; gap:4px; color:#1463E8; font-size:14px; }
      .section-heading > button { margin-top:-8px; }
      .text-action ha-icon { --mdc-icon-size:17px; }
      .supporting { color:#5E6B80; font-size:15px; line-height:1.45; }
      .icon-action { width:48px; height:48px; background:#EAF2FF; color:#1463E8; }

      .today-grid { height:100%; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:minmax(282px,1.08fr) minmax(226px,.92fr); gap:16px; }
      .today-grid article { padding:24px; }
      .today-grid h2 { font-size:24px; }
      .hero-panel.today-hero { position:relative; grid-column:1/5; display:grid; grid-template-columns:minmax(0,1fr) 132px; grid-template-rows:minmax(0,1fr) auto; gap:18px 26px; overflow:hidden; border:0; background:radial-gradient(circle at 90% 5%,rgba(42,117,209,.32),transparent 38%),linear-gradient(135deg,#061B3A,#0C315D); color:#fff; box-shadow:0 20px 44px rgba(6,27,58,.22); }
      .today-hero::after { content:""; position:absolute; right:-70px; bottom:-105px; width:260px; height:260px; border:1px solid rgba(255,255,255,.1); border-radius:50%; box-shadow:0 0 0 36px rgba(255,255,255,.025),0 0 0 78px rgba(255,255,255,.018); pointer-events:none; }
      .today-hero-copy { position:relative; z-index:1; align-self:center; }
      .today-hero .eyebrow { color:#8FD8CB; }
      .today-hero h2 { margin:8px 0 0; color:#fff; font-size:44px; line-height:1; letter-spacing:-.045em; }
      .today-hero-copy > p:last-child { max-width:520px; margin:14px 0 0; color:#C7D4E4; font-size:16px; line-height:1.45; }
      .today-weather { position:relative; z-index:1; align-self:center; display:grid; justify-items:end; }
      .today-weather ha-icon { --mdc-icon-size:34px; color:#FFD27B; }
      .today-weather strong { margin-top:8px; color:#fff; font-size:42px; line-height:1; letter-spacing:-.05em; }
      .today-weather span { margin-top:6px; color:#B7C6DA; font-size:13px; font-weight:650; }
      .hero-metrics { position:relative; z-index:1; grid-column:1/-1; margin:0; gap:10px; }
      .hero-metrics.has-energy { grid-template-columns:repeat(4,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
      .hero-metrics[data-metric-count="2"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="3"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .hero-metrics button { min-height:70px; padding:11px 14px; display:flex; align-items:center; gap:11px; border:1px solid rgba(255,255,255,.14); border-radius:16px; background:rgba(255,255,255,.075); }
      .hero-metrics button > ha-icon { flex:0 0 auto; --mdc-icon-size:22px; color:#8FD8CB; }
      .hero-metrics button > span { min-width:0; }
      .hero-metrics strong { color:#fff; font-size:16px; }
      .hero-metrics small { display:block; margin-top:3px; color:#AFC0D5; font-size:12px; }
      .today-next { position:relative; grid-column:5/7; justify-content:flex-start; background:#fff; }
      .today-card-icon { width:50px; height:50px; margin-bottom:18px; display:grid; place-items:center; border-radius:16px; background:#FFF4D9; color:#A86800; }
      .today-card-icon ha-icon { --mdc-icon-size:24px; }
      .today-card-icon.is-coral { margin:0; background:#FFEAE6; color:#C94F3C; }
      .today-next h2 { margin-top:10px; font-size:28px; line-height:1.14; }
      .today-family,.today-football,.today-music { grid-row:2; justify-content:flex-start; background:#fff; }
      .today-family { grid-column:1/3; }
      .today-football { grid-column:3/5; }
      .today-music { grid-column:5/7; }
      .today-grid[data-calendar="false"] .today-hero { grid-column:1/7; }
      .today-grid[data-secondary-count="0"] .today-hero { grid-row:1/3; }
      .today-grid[data-secondary-count="0"] .today-next { grid-row:1/3; }
      .today-grid[data-secondary-count="1"] .today-secondary { grid-column:1/7 !important; }
      .today-grid[data-secondary-count="2"] .today-secondary { grid-column:span 3 !important; }
      .today-hero.is-weatherless { grid-template-columns:minmax(0,1fr); }
      .person-summary-list { gap:9px; margin-top:10px; }
      .person-summary { min-height:60px; padding:10px 12px; border:1px solid color-mix(in srgb,var(--person-colour) 16%,#DCE4EE); background:color-mix(in srgb,var(--person-colour) 5%,#fff); border-radius:16px; }
      .person-initial { width:38px; height:38px; border:3px solid color-mix(in srgb,var(--person-colour) 72%,#fff); background:#0B1830; color:#fff; font-size:15px; }
      .person-summary strong { font-size:14px; }
      .person-summary small { font-size:12px; }
      .points { color:#33445C; font-size:12px; }
      .featured-fixtures { gap:8px; margin-top:10px; }
      .compact-fixture { min-height:62px; border-color:#DCE4EE; background:#F7F9FC; border-radius:16px; }
      .compact-fixture[data-favourite-code~="TOT"] { border-left:4px solid #132257; }
      .compact-fixture[data-favourite-code~="AVL"] { box-shadow:inset 4px 0 #670E36; }
      .compact-fixture.is-derby { border-left-color:#132257; background:linear-gradient(90deg,rgba(19,34,87,.055),rgba(103,14,54,.065)); box-shadow:inset -4px 0 #670E36; }
      .compact-fixture > span { font-size:12px; }
      .compact-fixture strong { font-size:15px; }
      .compact-fixture small { color:#5E6B80; font-size:12px; }
      .now-playing { grid-template-columns:64px minmax(0,1fr) 48px; margin-top:13px; }
      .artwork { width:64px; height:64px; background:linear-gradient(145deg,#1463E8,#00A887); }
      .now-playing h2 { font-size:17px; }
      .now-playing p { font-size:13px; }
      .today-music .now-playing,.quiet-music { flex:1; align-content:center; }
      .quiet-music { min-height:92px; display:flex; align-items:center; gap:13px; }
      .quiet-music strong,.quiet-music span { display:block; }
      .quiet-music strong { font-size:16px; }
      .quiet-music span { margin-top:4px; color:#5E6B80; font-size:13px; }

      .home-surface { grid-template-rows:64px minmax(0,1fr); gap:14px; }
      .home-toolbar { color:#0B1830; padding:0; }
      .home-toolbar h2 { margin-top:5px; font-size:22px; }
      .home-toolbar .eyebrow { color:#5E6B80; }
      .home-segments { max-width:72%; padding:4px; background:#E8EEF5; border-radius:16px; }
      .segment { min-height:48px; padding:0 15px; border-radius:12px; color:#5E6B80; font-size:13px; }
      .segment.is-selected { color:#fff; background:#1463E8; box-shadow:0 5px 14px rgba(20,99,232,.2); }
      .home-segments ha-icon,.calendar-modes ha-icon { --mdc-icon-size:18px; }
      .home-summary-links button { border-color:#DCE4EE; background:#fff; color:#0B1830; box-shadow:0 8px 20px rgba(21,43,75,.05); }
      .home-summary-links button > ha-icon:first-child { color:#1463E8; }
      .home-summary-links button > ha-icon:last-child,.home-summary-links small { color:#5E6B80; }
      .home-summary-links strong { font-size:15px; }
      .home-summary-links small { font-size:12px; }
      .rooms-layout { grid-template-columns:minmax(0,1fr) clamp(340px,31vw,390px); gap:16px; }
      .floorplan-panel { padding:20px; grid-template-rows:58px minmax(0,1fr); gap:12px; }
      .floorplan-heading h2 { font-size:24px; }
      .floorplan-canvas { border:1px solid #DCE4EE; border-radius:20px; background:radial-gradient(circle at 50% 44%,#fff 0,#F0F5FA 68%,#E5EDF5 100%); }
      .floorplan-backdrop { background:radial-gradient(ellipse at 50% 90%,rgba(41,74,108,.09),transparent 58%); }
      .light-overlay { mix-blend-mode:multiply; }
      .room-hotspot.has-light polygon { fill:color-mix(in srgb,#E7A93D 15%,transparent); filter:drop-shadow(0 0 3px rgba(231,169,61,.65)); }
      .room-hotspot.is-selected polygon,.room-hotspot:focus polygon { fill:color-mix(in srgb,#1463E8 9%,transparent); stroke:#1463E8; stroke-width:.72; filter:drop-shadow(0 0 3px rgba(20,99,232,.4)); }
      .room-detail.home-drawer { padding:24px; background:#fff; }
      .room-title { align-items:flex-start; }
      .room-icon { width:52px; height:52px; border-radius:16px; background:#EAF2FF; color:#1463E8; }
      .room-title h2 { font-size:26px; }
      .room-title p:last-child { color:#5E6B80; font-size:13px; }
      .room-control-list { gap:10px; margin-top:22px; }
      .control-row { grid-template-columns:minmax(0,1fr) 48px; gap:8px; }
      .control-main,.media-room-control,.climate-control,.cover-control { min-height:60px; border:1px solid #DCE4EE; background:#F7F9FC; color:#0B1830; }
      .control-main { padding:10px 14px; }
      .control-main strong,.media-room-control strong,.cover-control strong { font-size:14px; }
      .control-main small,.media-room-control small,.cover-control small { color:#5E6B80; font-size:12px; }
      .control-main.is-on { border-color:#F1D398; background:#FFF8E8; }
      .climate-control span,.climate-control small { color:#5E6B80; font-size:12px; }
      .climate-control strong { font-size:30px; }
      .stepper button,.cover-control button { width:48px; height:48px; border:1px solid #DCE4EE; background:#fff; color:#1463E8; }
      .scene-button { min-height:48px; background:#EAF2FF; color:#1463E8; font-size:13px; }

      .whole-home-card,.heating-card,.cover-card,.cleaning-panel { border-color:#DCE4EE; background:#fff; color:#0B1830; }
      .whole-home-heading > span,.heating-card-heading > span,.cover-card-heading > span { width:48px; height:48px; flex-basis:48px; border-radius:15px; background:#EAF2FF; color:#1463E8; }
      .whole-home-heading h3,.heating-card-heading h3,.cover-card-heading h3 { color:#0B1830; font-size:16px; }
      .whole-home-heading p,.heating-card-heading p,.cover-card-heading p { color:#5E6B80; font-size:12px; }
      .whole-home-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .heating-grid { grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); }
      .heating-grid[data-zone-count="6"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .cover-grid { grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); }
      .whole-home-controls { grid-template-columns:1fr; gap:9px; }
      .whole-home-control { min-height:58px; border-color:#DCE4EE; background:#F7F9FC; color:#0B1830; }
      .whole-home-control.is-on { border-color:#E8C67E; background:#FFF7E5; color:#765000; }
      .whole-home-control strong,.whole-home-control small { overflow:visible; text-overflow:clip; white-space:normal; line-height:1.2; overflow-wrap:anywhere; }
      .whole-home-control strong { color:inherit; font-size:13px; }
      .whole-home-control small { color:#5E6B80; font-size:12px; }
      .heating-card { min-height:190px; }
      .heating-card.is-heating { border-color:#E8C67E; background:linear-gradient(145deg,#FFF9EC,#fff); }
      .heating-card.is-off,.heating-card.is-unavailable { background:#F7F9FC; }
      .heating-card.is-heating .heating-icon,.heating-card.is-heating .heating-status { color:#8B5B00; }
      .heating-card-heading .heating-status,.heating-current small,.heating-target-control > small { color:#5E6B80; font-size:12px; }
      .heating-current-value,.heating-target-value { color:#0B1830; }
      .heating-power { min-width:68px; min-height:48px; border-color:#DCE4EE; background:#F7F9FC; color:#5E6B80; font-size:12px; }
      .heating-power.is-on { border-color:#E8C67E; background:#FFF4D9; color:#765000; }
      .heating-stepper { grid-template-columns:48px minmax(54px,1fr) 48px; border-color:#DCE4EE; background:#F7F9FC; }
      .heating-stepper button,.heating-target-value { min-height:48px; color:#1463E8; }
      .heating-stepper button { width:48px; height:48px; }
      .heating-target-value { border-color:#DCE4EE; color:#0B1830; }
      .cover-actions { gap:8px; }
      .cover-actions button { min-height:48px; border:1px solid #DCE4EE; background:#F7F9FC; color:#1463E8; font-size:12px; }
      .cleaning-panel { padding:24px; }
      .cleaning-hero > span { background:linear-gradient(145deg,#1463E8,#00A887); }
      .cleaning-hero p:last-child { color:#5E6B80; font-size:13px; }
      .cleaning-facts span { border-color:#DCE4EE; background:#F7F9FC; }
      .cleaning-facts strong { color:#0B1830; font-size:16px; }
      .cleaning-facts small { color:#5E6B80; font-size:12px; }
      .cleaning-actions button { min-height:48px; border:1px solid #C9DAF4; background:#EAF2FF; color:#1463E8; font-size:13px; }
      .vacuum-map-slot,.vacuum-map-placeholder { border-color:#DCE4EE; background:#F1F5F9; color:#5E6B80; }
      .vacuum-map-placeholder { font-size:13px; }

      .energy-hero { border:0; border-radius:24px; background:radial-gradient(circle at 88% 18%,rgba(0,168,135,.25),transparent 32%),linear-gradient(135deg,#061B3A,#0C315D); color:#fff; box-shadow:0 18px 42px rgba(6,27,58,.2); }
      .energy-hero .eyebrow { color:#8FD8CB; }
      .energy-hero h2,.energy-hero-status strong { color:#fff; }
      .energy-hero-status small { color:#AFC0D5; font-size:12px; }
      .energy-meter { border-color:#DCE4EE; background:#fff; color:#0B1830; }
      .energy-meter-icon { background:#EAF2FF; color:#1463E8; }
      .energy-meter.is-gas .energy-meter-icon { background:#FFEAE6; color:#C94F3C; }
      .energy-meter-heading h2 { color:#0B1830; font-size:22px; }
      .energy-status { border-color:#DCE4EE; background:#F7F9FC; color:#5E6B80; font-size:12px; }
      .energy-meter.is-stale .energy-status,.energy-meter.is-partial .energy-status,.energy-meter.is-unverified .energy-status { border-color:#E8C67E; background:#FFF7E5; color:#765000; }
      .energy-primary-metrics > span { border-color:#DCE4EE; background:#F7F9FC; }
      .energy-primary-metrics small,.energy-tariff small,.energy-freshness { color:#5E6B80; font-size:12px; }
      .energy-primary-metrics strong { color:#0B1830; font-size:30px; }
      .energy-tariff { border-color:#E1E8F0; }
      .energy-tariff strong { color:#0B1830; font-size:14px; }
      .energy-truth-note { border-color:#DCE4EE; background:#F1F6FF; color:#0B1830; }
      .energy-truth-note > ha-icon { color:#1463E8; }
      .energy-truth-note strong { font-size:14px; }
      .energy-truth-note span { color:#5E6B80; font-size:12px; }

      .security-layout { grid-template-columns:minmax(0,1fr) clamp(286px,27vw,334px); gap:18px; }
      .security-main { display:grid; grid-template-rows:minmax(0,1fr) auto; gap:14px; }
      .security-stage { min-height:0; padding:18px; display:grid; grid-template-rows:56px minmax(0,1fr); border:0; border-radius:24px; background:#061B3A; color:#fff; box-shadow:0 18px 42px rgba(6,27,58,.2); overflow:hidden; }
      .security-stage-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
      .security-stage-heading .eyebrow { color:#8FD8CB; }
      .security-stage-heading h2 { margin:3px 0 0; color:#fff; font-size:24px; }
      .stage-privacy { min-height:38px; padding:0 12px; display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.15); border-radius:13px; background:rgba(255,255,255,.07); color:#C5D2E2; font-size:12px; font-weight:700; }
      .stage-privacy ha-icon { --mdc-icon-size:17px; color:#8FD8CB; }
      .security-stage-media { width:100%; max-width:780px; min-height:0; aspect-ratio:16/9; place-self:center; overflow:hidden; border-radius:18px; background:radial-gradient(circle at 50% 46%,#102F54,#041225 72%); }
      .camera-stage-stack { position:relative; width:100%; height:100%; min-height:0; overflow:hidden; border-radius:18px; background:#041225; }
      .camera-poster-slot { position:relative; min-width:0; min-height:0; overflow:hidden; background:radial-gradient(circle at 50% 46%,#16385f,#041225 72%); color:#c5d2e2; }
      .camera-poster-slot > .embedded-card { display:block; width:100%; height:100%; min-height:100%; border:0; }
      .camera-stage-poster-slot { position:absolute; inset:0; }
      .camera-poster-fallback { position:absolute; inset:0; display:grid; place-items:center; align-content:center; gap:8px; color:#c5d2e2; font-size:12px; font-weight:750; }
      .camera-poster-fallback ha-icon { --mdc-icon-size:32px; color:#8fd8cb; }
      .camera-stage-stack .camera-card-slot { position:absolute; z-index:1; inset:0; opacity:0; transition:opacity .18s ease; }
      .camera-stage-stack.is-live .camera-card-slot { opacity:1; }
      .camera-stage-action { position:absolute; z-index:2; inset:0; width:100%; padding:18px; border:0; background:linear-gradient(180deg,transparent 40%,rgba(4,18,37,.88)); color:#fff; display:flex; align-items:flex-end; justify-content:space-between; gap:16px; text-align:left; cursor:pointer; }
      .camera-stage-action > span { min-width:0; }
      .camera-stage-action strong,.camera-stage-action small { display:block; }
      .camera-stage-action strong { font-size:17px; }
      .camera-stage-action small { max-width:430px; margin-top:4px; color:#d7e0eb; font-size:12px; line-height:1.4; }
      .camera-stage-action b { flex:0 0 auto; min-height:48px; padding:0 16px; border-radius:14px; background:#1463e8; display:flex; align-items:center; gap:7px; font-size:13px; }
      .camera-stage-action:disabled { cursor:default; }
      .camera-stage-action:disabled b { background:#53657b; }
      .camera-idle { height:100%; min-height:0; grid-template-columns:70px minmax(0,1fr) auto; gap:18px; padding:24px; border:0; border-radius:18px; background:radial-gradient(circle at 12% 50%,rgba(20,99,232,.25),transparent 34%); }
      .camera-stage-icon { width:64px; height:64px; display:grid; place-items:center; border-radius:20px; background:rgba(255,255,255,.09); color:#8FD8CB; }
      .camera-stage-icon ha-icon { --mdc-icon-size:34px; }
      .camera-is-starting .camera-stage-icon ha-icon,.camera-is-stopping .camera-stage-icon ha-icon { animation:spin 1.1s linear infinite; }
      .camera-idle strong { color:#fff; font-size:19px; }
      .camera-idle small { max-width:360px; margin-top:6px; color:#B5C4D6; font-size:13px; line-height:1.45; }
      .camera-idle button,.camera-close,.camera-select-action { min-height:48px; padding:0 16px; border-radius:14px; background:#1463E8; font-size:13px; }
      .camera-stream { width:100%; height:100%; border-radius:18px; }
      .camera-card-slot,.camera-card-slot::slotted(.embedded-card) { height:100%; min-height:100%; }
      .camera-live-chip { position:absolute; z-index:4; top:12px; left:12px; min-height:34px; padding:0 11px; display:flex; align-items:center; gap:7px; border-radius:12px; background:rgba(4,18,37,.8); color:#fff; font-size:12px; font-weight:800; }
      .camera-live-chip span { width:8px; height:8px; border-radius:50%; background:#E86E5A; box-shadow:0 0 0 4px rgba(232,110,90,.2); }
      .camera-close { right:12px; bottom:12px; background:rgba(4,18,37,.86); }
      .security-camera-picker { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .security-camera { min-height:174px; padding:0; display:grid; grid-template-columns:minmax(118px,.86fr) minmax(0,1.14fr); grid-template-rows:minmax(174px,1fr); gap:0; border-radius:20px; background:#fff; overflow:hidden; }
      .camera-tile-media { position:relative; min-width:0; min-height:174px; overflow:hidden; background:#061b3a; }
      .camera-tile-poster { position:absolute; inset:0; }
      .camera-poster-action { position:absolute; z-index:2; inset:0; width:100%; padding:10px; border:0; background:linear-gradient(180deg,transparent 46%,rgba(4,18,37,.82)); color:#fff; display:flex; align-items:flex-end; justify-content:flex-start; text-align:left; cursor:pointer; }
      .camera-poster-action > span { min-height:38px; padding:0 10px; border:1px solid rgba(255,255,255,.24); border-radius:11px; background:rgba(4,18,37,.78); display:flex; align-items:center; gap:6px; font-size:12px; font-weight:800; }
      .camera-poster-action:disabled { cursor:default; }
      .camera-tile-details { min-width:0; padding:13px; display:grid; grid-template-rows:auto minmax(0,1fr); align-content:start; gap:9px; }
      .security-camera .security-card-heading { min-width:0; display:grid; align-content:start; justify-content:stretch; gap:7px; }
      .security-camera.is-selected { border-color:#8DB7F8; box-shadow:0 0 0 2px rgba(20,99,232,.09),0 10px 26px rgba(21,43,75,.06); }
      .security-card-heading { min-width:0; align-items:flex-start; flex-wrap:wrap; }
      .security-card-heading > div { min-width:0; }
      .security-card-heading h2 { font-size:18px; overflow-wrap:anywhere; }
      .privacy-badge { flex:0 1 auto; max-width:100%; min-height:34px; padding:7px 9px; border:1px solid #DCE4EE; background:#F7F9FC; color:#5E6B80; font-size:12px; line-height:1.25; white-space:normal; overflow-wrap:anywhere; }
      .privacy-badge ha-icon { --mdc-icon-size:16px; color:#1463E8; }
      .security-signals { gap:6px; }
      .security-camera .security-signals { min-width:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-content:start; }
      .security-signal { min-height:48px; grid-template-columns:22px minmax(0,1fr); padding:6px 7px; border:1px solid #E1E8F0; background:#F7F9FC; }
      .security-signal ha-icon { --mdc-icon-size:18px; color:#79869A; }
      .security-signal strong,.security-signal small { overflow:visible; white-space:normal; text-overflow:clip; overflow-wrap:anywhere; }
      .security-signal strong { font-size:12px; }
      .security-signal small { color:#5E6B80; font-size:12px; }
      .security-signal.is-active { border-color:#F0CD89; background:#FFF7E5; }
      .security-signal.is-active ha-icon { color:#B87500; }
      .security-signal.is-unavailable { background:#F7F9FC; }
      .camera-select-action { width:100%; min-width:0; justify-content:center; background:#EAF2FF; color:#1463E8; line-height:1.25; white-space:normal; }
      .security-sidebar { grid-template-rows:minmax(218px,1fr) auto auto; gap:12px; }
      .alarm-panel,.garage-panel { padding:20px; background:#fff; }
      .alarm-state { width:48px; height:48px; background:#E2F5EF; color:#008C71; }
      .alarm-state.is-alert { background:#FFE7E3; color:#D64545; }
      .alarm-state.is-unavailable { background:#EEF2F6; color:#718097; }
      .alarm-panel > p { margin-top:14px; color:#5E6B80; font-size:13px; }
      .alarm-actions { gap:7px; margin-top:16px; }
      .alarm-actions button { min-height:58px; border:1px solid #DCE4EE; background:#EAF2FF; color:#1463E8; font-size:12px; }
      .alarm-actions button.is-danger { border-color:#E5A7A4; background:#FFF0EE; color:#B4232B; }
      .alarm-actions ha-icon { --mdc-icon-size:20px; }
      .garage-heading > span { width:48px; height:48px; background:#EAF2FF; color:#1463E8; }
      .garage-heading h2 { font-size:20px; }
      .garage-motion { margin-top:14px; color:#5E6B80; font-size:12px; }
      .garage-action { min-height:50px; border:0; background:#1463E8; color:#fff; font-size:13px; }
      .security-privacy-note { min-height:58px; align-items:center; padding:11px 13px; border:1px solid #DCE4EE; background:#fff; color:#5E6B80; font-size:12px; }
      .security-privacy-note ha-icon { --mdc-icon-size:19px; color:#00A887; }
      .confirmation-dialog { background:#fff; color:#0B1830; border:1px solid #DCE4EE; }
      .confirmation-dialog h2 { color:#0B1830; }
      .confirmation-dialog > p:not(.eyebrow) { color:#5E6B80; font-size:14px; }
      .confirmation-dialog button { min-height:50px; border-color:#DCE4EE; background:#F7F9FC; color:#0B1830; }
      .confirmation-dialog button.confirm-primary { border-color:#1463E8; background:#1463E8; color:#fff; }

      .calendar-view { border-color:#DCE4EE; background:#fff; }
      .calendar-context strong { color:#0B1830; }
      .calendar-legends { color:#0B1830; }
      .calendar-legend { color:#3E4D63; font-size:12px; }
      .calendar-card-slot { border-color:#DCE4EE; background:#fff; --ha-card-background:#fff; --card-background-color:#fff; --primary-text-color:#0B1830; --secondary-text-color:#5E6B80; }
      .calendar-loading { color:#33445C; font-size:12px; }
      .calendar-warning { color:#704B0D; font-size:12px; }
      .hub-agenda-day { border-color:#DCE4EE; background:#fff; }
      .hub-agenda-day.is-today { border-color:#8DB7F8; background:#F1F6FF; }
      .hub-agenda-day > header { border-color:#DCE4EE; color:#0B1830; }
      .hub-agenda-day > header span,.hub-agenda-day > header small { color:#5E6B80; font-size:12px; }
      .hub-agenda-event { border:1px solid color-mix(in srgb,var(--calendar-colour) 30%,#DCE4EE); background:color-mix(in srgb,var(--calendar-colour) 8%,#fff); color:#0B1830; }
      .hub-agenda-event .event-time,.hub-agenda-event strong,.hub-agenda-event small,.hub-agenda-empty,.hub-agenda-more { font-size:12px; }
      .hub-agenda-event strong { color:#0B1830; }
      .hub-agenda-event small,.hub-agenda-empty { color:#5E6B80; }

      .family-layout { grid-template-columns:minmax(0,1.45fr) minmax(350px,.8fr); }
      .family-dashboard-heading h2 { color:#0B1830; }
      .choreops-link { border-color:#B9D1F8; background:#EAF2FF; color:#0B57C7; }
      .family-person { border-color:#DCE4EE; background:#fff; color:#0B1830; }
      .family-sidebar { display:flex; flex-direction:column; align-items:stretch; overflow-y:auto; overscroll-behavior:contain; padding-right:4px; scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:#9FB0C5 transparent; }
      .family-scroll-cue { position:sticky; top:0; z-index:3; flex:0 0 auto; min-height:38px; padding:0 8px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid #DCE4EE; background:rgba(244,247,250,.96); color:#33445C; font-size:12px; }
      .family-scroll-cue span { display:flex; align-items:center; gap:4px; color:#5E6B80; font-weight:700; }
      .family-scroll-cue ha-icon { --mdc-icon-size:16px; color:#1463E8; }
      .family-sidebar .family-person { flex:0 0 auto; overflow:visible; }
      .family-sidebar::-webkit-scrollbar { width:7px; }
      .family-sidebar::-webkit-scrollbar-thumb { border:2px solid transparent; border-radius:999px; background:#9FB0C5; background-clip:padding-box; }
      .family-person-heading > span { border:3px solid color-mix(in srgb,var(--person-colour) 72%,#fff); background:#0B1830; color:#fff; }
      .family-facts span { border:1px solid color-mix(in srgb,var(--person-colour) 18%,#DCE4EE); background:color-mix(in srgb,var(--person-colour) 5%,#fff); color:#4F5F75; font-size:12px; }
      .family-facts strong { color:#0B1830; }
      .chore-heading span { color:#5E6B80; font-size:12px; }
      .chore-row { border-color:color-mix(in srgb,var(--person-colour) 22%,#DCE4EE); background:color-mix(in srgb,var(--person-colour) 5%,#fff); }
      .chore-check { background:#EEF2F6; color:#33445C; }
      .chore-row strong { color:#0B1830; font-size:13px; }
      .chore-row small { color:#5E6B80; font-size:12px; }
      .family-sidebar .chore-list { grid-template-columns:1fr; }
      .family-sidebar .chore-row strong,.family-sidebar .chore-row small { overflow:visible; white-space:normal; text-overflow:clip; line-height:1.2; overflow-wrap:normal; }
      .family-people-grid .chore-row strong,.family-people-grid .chore-row small { overflow:visible; white-space:normal; text-overflow:clip; line-height:1.25; overflow-wrap:anywhere; }
      .chore-row b { color:#33445C; font-size:12px; }
      .chore-row.is-done { opacity:1; border-color:#B7DEC9; background:#F1FAF5; }
      .chore-row.is-done .chore-check { background:#DFF3E8; color:#18794E; }
      .chore-row.is-overdue,.chore-row.is-missed { border-color:#E5A7A4; background:#FFF0EE; }
      .chore-row.is-overdue .chore-check,.chore-row.is-missed .chore-check { background:#F9D5D1; color:#A9362D; }
      .chore-row.is-waiting { border-color:#E8D29D; background:#FFF9E8; }
      .chore-row.is-waiting .chore-check { background:#FFF0CF; color:#8B5B00; }
      .chore-row.is-unavailable { border-style:dashed; background:#F7F9FC; }
      .family-summary-item { border-color:color-mix(in srgb,var(--person-colour) 20%,#DCE4EE); background:color-mix(in srgb,var(--person-colour) 4%,#fff); }
      .family-summary-item > span { background:#EEF2F6; color:#33445C; }
      .family-summary-item p { color:#33445C; }
      .family-summary-item strong { color:#0B1830; }
      .family-summary-item small { color:#5E6B80; }
      .family-summary-item.is-done > span { background:#DFF3E8; color:#18794E; }
      .family-summary-item.is-unavailable > span { background:#EEF2F6; color:#718097; }
      .assignment { border-color:#DCE4EE; color:#0B1830; }
      .assignment a { color:#0B57C7; }
      .assignment small { color:#5E6B80; font-size:12px; }
      .classroom-health { color:#5E6B80; font-size:12px; }
      .classroom-health.is-stale { color:#8A5700; }

      .media-player-panel { border:0; background:radial-gradient(circle at 85% 10%,rgba(20,99,232,.28),transparent 35%),linear-gradient(145deg,#061B3A,#0C315D); }
      .music-heading .eyebrow { color:#8FD8CB; }
      .music-heading h2 { color:#fff; }
      .music-heading > .music-meta { min-height:34px; padding:0 10px; border:1px solid rgba(255,255,255,.14); border-radius:999px; background:#123760; color:#E7F0FA; font-size:12px; font-weight:750; }
      .media-player-stage { border-color:rgba(255,255,255,.16); background:#07182F; }

      .compact-fixture,.compact-fixture > span,.compact-fixture > strong { color:#0B1830; }

      .football-experience { height:100%; min-height:0; display:grid; grid-template-rows:250px minmax(0,1fr); gap:16px; }
      .football-favourites-stage { position:relative; min-height:0; padding:18px 22px; display:flex; flex-direction:column; overflow:hidden; border-radius:24px; background:radial-gradient(circle at 12% 105%,rgba(0,168,135,.24),transparent 34%),radial-gradient(circle at 88% 0,rgba(20,99,232,.3),transparent 34%),#061B3A; color:#fff; box-shadow:0 18px 42px rgba(6,27,58,.2); }
      .football-favourites-stage::after { content:""; position:absolute; right:50%; bottom:-160px; width:340px; height:340px; transform:translateX(50%); border:1px solid rgba(255,255,255,.055); border-radius:50%; box-shadow:0 0 0 34px rgba(255,255,255,.014),0 0 0 72px rgba(255,255,255,.01); pointer-events:none; }
      .football-hero-heading { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start; }
      .football-favourites-stage .eyebrow { color:#8FD8CB; }
      .football-favourites-stage h2 { margin:4px 0 0; color:#fff; font-size:25px; }
      .football-freshness { max-width:370px; min-height:42px; padding:7px 12px; display:flex; align-items:center; gap:9px; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(255,255,255,.07); }
      .football-freshness > span { min-width:0; }
      .football-freshness > i { width:9px; height:9px; border-radius:50%; background:#00C69D; box-shadow:0 0 0 4px rgba(0,198,157,.16); }
      .football-freshness.is-waiting > i { background:#E7A93D; box-shadow:0 0 0 4px rgba(231,169,61,.16); }
      .football-freshness.is-cached > i { background:#E7A93D; box-shadow:0 0 0 4px rgba(231,169,61,.16); }
      .football-freshness.is-stale > i { background:#E86E5A; box-shadow:0 0 0 4px rgba(232,110,90,.16); }
      .football-freshness strong,.football-freshness small { display:block; color:#fff; }
      .football-freshness strong { font-size:12px; }
      .football-freshness small { margin-top:2px; color:#AFC0D5; font-size:12px; line-height:1.25; overflow-wrap:anywhere; }
      .football-health-note { position:relative; z-index:1; width:max-content; max-width:min(430px,62%); margin:7px 0 0 auto; padding:7px 10px; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:rgba(255,255,255,.07); color:#E7F0FA; font-size:12px; line-height:1.3; }
      .football-health-note.is-cached { border-color:rgba(231,169,61,.45); }
      .football-health-note.is-stale { border-color:rgba(232,110,90,.5); }
      .favourite-hero-grid { position:relative; z-index:1; flex:1; min-height:0; margin-top:10px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .football-health-note + .favourite-hero-grid { margin-top:7px; }
      .favourite-hero-card { min-width:0; min-height:0; height:100%; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; border:1px solid color-mix(in srgb,var(--club-accent) 40%,rgba(255,255,255,.18)); border-radius:18px; background:radial-gradient(circle at 92% 8%,color-mix(in srgb,var(--club-accent) 22%,transparent),transparent 42%),linear-gradient(135deg,color-mix(in srgb,var(--club-primary) 92%,#061B3A),color-mix(in srgb,var(--club-primary) 66%,#061B3A)); color:#fff; box-shadow:0 10px 26px rgba(0,0,0,.18); }
      .favourite-hero-card.is-live { box-shadow:inset 0 0 0 1px rgba(232,110,90,.72),0 10px 26px rgba(0,0,0,.18); }
      .favourite-club-heading,.derby-heading { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .favourite-club-identity { min-width:0; display:flex; align-items:center; gap:10px; }
      .favourite-club-identity > div,.derby-heading > div { min-width:0; }
      .favourite-club-identity small,.derby-heading small { display:block; color:color-mix(in srgb,var(--club-accent,#8FD8CB) 78%,#fff); font-size:12px; font-weight:750; }
      .favourite-club-identity strong,.derby-heading strong { display:block; margin-top:2px; overflow:hidden; color:#fff; font-size:18px; line-height:1.1; white-space:nowrap; text-overflow:ellipsis; }
      .favourite-match-status { flex:0 0 auto; min-height:28px; padding:0 9px; display:flex; align-items:center; border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(255,255,255,.1); color:#fff; font-size:12px; font-weight:850; letter-spacing:.05em; }
      .favourite-hero-card.is-live .favourite-match-status { border-color:rgba(255,139,125,.56); background:rgba(180,40,43,.34); }
      .favourite-fixture-summary { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) 30px auto; align-items:end; gap:9px; }
      .favourite-opponent { min-width:0; }
      .favourite-opponent small,.favourite-result small { display:block; color:#C9D6E5; font-size:12px; line-height:1.2; }
      .favourite-opponent strong { display:block; margin-top:3px; overflow:hidden; color:#fff; font-size:15px; line-height:1.15; white-space:nowrap; text-overflow:ellipsis; }
      .favourite-result { min-width:74px; text-align:right; }
      .favourite-result strong { display:block; color:#fff; font-size:22px; line-height:1; letter-spacing:-.025em; }
      .favourite-result small { margin-top:4px; color:var(--club-accent,#8FD8CB); font-weight:750; }
      .favourite-fixture-summary.is-empty { grid-template-columns:24px minmax(0,1fr); align-items:center; color:#fff; }
      .favourite-fixture-summary.is-empty ha-icon { --mdc-icon-size:21px; color:var(--club-accent,#8FD8CB); }
      .favourite-fixture-summary.is-empty strong,.favourite-fixture-summary.is-empty small { display:block; color:#fff; font-size:13px; }
      .favourite-fixture-summary.is-empty small { margin-top:3px; color:#C9D6E5; font-size:12px; }
      .favourite-hero-card.is-derby { --club-accent:#8FD8CB; grid-column:1/-1; background:radial-gradient(circle at 12% 20%,rgba(255,255,255,.13),transparent 27%),radial-gradient(circle at 88% 20%,rgba(149,191,229,.22),transparent 28%),linear-gradient(115deg,#132257 0 49.5%,#670E36 50.5% 100%); }
      .derby-heading { align-items:flex-start; }
      .derby-fixture { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr); align-items:center; gap:14px; }
      .derby-team { min-width:0; display:flex; align-items:center; justify-content:flex-end; gap:10px; }
      .derby-team.is-away { flex-direction:row-reverse; }
      .derby-team > strong { overflow:hidden; color:#fff; font-size:17px; white-space:nowrap; text-overflow:ellipsis; }
      .derby-team.is-away > strong { text-align:right; }
      .team-mark { position:relative; flex:0 0 auto; display:grid; place-items:center; overflow:hidden; border-radius:50%; background:#fff; color:#061B3A; box-shadow:0 5px 16px rgba(3,12,28,.18); }
      .team-mark img { position:absolute; inset:11%; width:78%; height:78%; object-fit:contain; background:#fff; }
      .team-mark img[hidden] { display:none; }
      .team-mark.is-favourite { width:48px; height:48px; }
      .team-mark.is-favourite strong { font-size:13px; }
      .team-mark.is-small { width:30px; height:30px; }
      .team-mark.is-small strong { font-size:12px; }
      .football-layout { grid-template-columns:minmax(0,1fr) clamp(260px,25vw,320px); gap:16px; }
      .football-main,.favourite-standings { border-color:#DCE4EE; background:#fff; }
      .football-main { padding:18px 20px; grid-template-rows:58px minmax(0,1fr); }
      .football-toolbar h2 { font-size:21px; }
      .matchweek-controls { gap:5px; }
      .matchweek-controls button { width:48px; height:48px; background:#EAF2FF; color:#1463E8; }
      .matchweek-controls select { height:48px; min-width:82px; border-color:#DCE4EE; background:#fff; color:#0B1830; font-size:13px; }
      .football-tabs .segment { min-height:48px; }
      .fixture-groups { padding-right:5px; }
      .fixture-day h3 { margin:12px 0 7px; color:#5E6B80; font-size:12px; }
      .fixture { min-height:58px; grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr); gap:10px; padding:8px 10px; border-color:#E1E8F0; }
      .fixture.is-spotlight { border-color:#BFD3F2; background:#F4F8FF; }
      .fixture[data-favourite-code~="TOT"] { border-left:4px solid #132257; }
      .fixture[data-favourite-code~="AVL"] { box-shadow:inset 4px 0 #670E36; }
      .fixture[data-favourite-code~="TOT"][data-favourite-code~="AVL"] { border-left-color:#132257; box-shadow:inset 4px 0 #670E36; }
      .fixture.is-live { border-color:#E86E5A; }
      .team { display:flex; align-items:center; gap:8px; color:#0B1830; font-size:13px; }
      .away-team { justify-content:flex-end; }
      .fixture-score { font-size:16px; }
      .fixture-score small,.scorers { color:#5E6B80; font-size:12px; }
      .favourite-standings { padding:20px; }
      .favourite-standings h2 { font-size:20px; }
      .favourite-standing-list { gap:12px; margin-top:14px; }
      .favourite-standing { min-height:70px; border-color:#DCE4EE; background:color-mix(in srgb,var(--club-accent) 8%,#F7F9FC); }
      .favourite-standing strong { color:#0B1830; font-size:14px; }
      .favourite-standing small { color:#5E6B80; font-size:12px; line-height:1.3; }
      .favourite-standing b { color:var(--club-primary); font-size:19px; }
      .league-table { font-size:13px; }
      .league-table th,.league-table td { padding:9px 8px; border-color:#E1E8F0; }
      .league-table tr.is-spotlight { background:#F1F6FF; }

      @keyframes spin { to { transform:rotate(360deg); } }
      @media (max-width:1030px) {
        .hub-shell { grid-template-columns:92px minmax(0,1fr); }
        .hub-navigation { padding-inline:10px; }
        .hub-brand { width:62px; height:62px; }
        .hub-content { padding-inline:18px; }
        .rooms-layout { grid-template-columns:minmax(0,1fr) 330px; }
        .security-layout { grid-template-columns:minmax(0,1fr) 274px; }
        .football-layout { grid-template-columns:minmax(0,1fr) 270px; }
        .hub-nav-button { min-height:55px; }
        .whole-home-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .cover-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (max-width:1279px) {
        .heating-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .heating-grid[data-zone-count="6"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .heating-grid[data-zone-count="6"] .heating-card { min-height:174px; padding:14px; gap:9px; }
        .heating-grid[data-zone-count="6"] .heating-card-heading > .heating-icon { width:42px; flex-basis:42px; }
      }
      @media (max-width:1180px) {
        .security-layout { grid-template-columns:minmax(0,1fr) 274px; }
        .security-camera-picker { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .security-stage-media { width:auto; max-width:100%; height:100%; place-self:stretch center; }
      }
      @media (min-width:901px) and (max-width:1180px) {
        .security-camera .security-signals { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .security-signal:last-child:nth-child(odd) { grid-column:1/-1; }
        .security-signal { grid-template-columns:1fr; grid-template-rows:auto auto; justify-items:center; gap:1px; padding:5px 4px; text-align:center; }
        .security-signal ha-icon { display:none; }
        .security-signal strong,.security-signal small { white-space:nowrap; overflow-wrap:normal; }
      }
      @media (max-width:900px) {
        .security-layout { display:flex; flex-direction:column; height:auto; }
        .security-main { display:flex; flex-direction:column; }
        .security-camera-picker { grid-template-columns:1fr; }
      }
      @media (max-width:760px) {
        :host { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-card { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-shell { display:block; height:auto; }
        .hub-navigation { position:sticky; top:0; z-index:20; flex-direction:row; align-items:center; gap:6px; padding:7px; overflow-x:auto; overscroll-behavior-x:contain; box-shadow:0 6px 20px rgba(6,27,58,.16); }
        .hub-brand { flex:0 0 48px; width:48px; height:48px; margin:0; border-radius:15px; }
        .hub-brand span,.hub-nav-button span,.hub-nav-divider { display:none; }
        .hub-nav-items { display:contents; }
        .hub-nav-utility { margin:0; }
        .hub-nav-button { flex:0 0 56px; min-height:48px; border-radius:14px; }
        .hub-content { display:block; padding:10px; }
        .hub-topbar { min-height:auto; padding:10px 2px 14px; gap:10px; flex-wrap:wrap; }
        .hub-page-title { flex:1 1 250px; flex-wrap:wrap; gap:5px 10px; }
        .hub-topbar-date { font-size:12px; }
        .hub-header-actions { flex:1 1 auto; justify-content:flex-end; flex-wrap:wrap; }
        .hub-weather-pill { min-height:48px; }
        .hub-topbar-time { min-width:70px; font-size:24px; }
        .hub-view { min-height:620px; }
        .today-grid,.rooms-layout,.family-layout,.security-layout,.football-layout { display:flex; flex-direction:column; height:auto; }
        .today-grid { gap:12px; }
        .today-grid article { min-height:210px; }
        .hero-panel.today-hero { min-height:360px; grid-template-columns:minmax(0,1fr) 110px; }
        .today-hero h2 { font-size:38px; }
        .hero-metrics.has-energy { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
        .home-surface { height:auto; grid-template-rows:auto auto; }
        .home-toolbar { align-items:flex-start; flex-direction:column; }
        .home-segments { width:100%; max-width:100%; overflow-x:auto; }
        .home-overview { height:auto; grid-template-rows:auto auto; }
        .home-summary-links,.home-summary-links[data-summary-count="2"] { grid-template-columns:1fr; }
        .calendar-view { grid-template-rows:auto minmax(0,1fr); }
        .calendar-toolbar { align-items:stretch; flex-direction:column; }
        .calendar-modes { width:100%; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .calendar-modes .segment { justify-content:center; }
        .whole-home-grid,.heating-grid,.cover-grid { grid-template-columns:1fr; height:auto; }
        .heating-grid,.heating-grid[data-zone-count="6"] { grid-template-columns:1fr; }
        .cleaning-panel { height:auto; display:flex; flex-direction:column; }
        .vacuum-map-slot,.vacuum-map-placeholder { min-height:320px; }
        .energy-view { height:auto; grid-template-rows:auto auto auto; }
        .energy-hero { align-items:flex-start; flex-direction:column; }
        .energy-meter-grid { grid-template-columns:1fr; }
        .family-dashboard { height:auto; grid-template-rows:auto auto; }
        .family-dashboard-heading { align-items:flex-start; flex-wrap:wrap; }
        .family-people-grid { grid-template-columns:1fr; }
        .family-sidebar { display:flex; flex-direction:column; overflow:visible; padding-right:0; scrollbar-gutter:auto; }
        .family-scroll-cue { position:static; }
        .family-summary-grid { grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); }
        .security-main { display:flex; flex-direction:column; }
        .security-stage { min-height:0; }
        .security-stage-media { width:100%; height:auto; min-height:280px; place-self:auto; }
        .security-camera { min-height:174px; }
        .floorplan-canvas { min-height:420px; }
        .music-experience,.media-player-panel { height:auto; min-height:620px; }
        .football-experience { height:auto; grid-template-rows:auto auto; }
        .football-favourites-stage { min-height:410px; padding:18px 16px; overflow:visible; }
        .football-hero-heading { gap:10px; flex-wrap:wrap; }
        .football-freshness { margin-left:auto; }
        .football-health-note { max-width:100%; margin-left:0; }
        .favourite-hero-grid { grid-template-columns:1fr; grid-auto-rows:minmax(142px,auto); }
        .favourite-hero-card.is-derby { grid-column:auto; }
        .derby-fixture { grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr); gap:6px; }
        .derby-team { gap:6px; }
        .derby-team > strong { font-size:14px; }
        .favourite-result { min-width:68px; }
        .favourite-result strong { font-size:20px; }
        .football-main { min-height:620px; grid-template-rows:auto minmax(0,1fr); }
        .football-toolbar { grid-template-columns:minmax(0,1fr) auto; grid-template-rows:auto auto; gap:8px 10px; }
        .football-tabs { grid-column:1/-1; display:grid; grid-template-columns:1fr 1fr; }
      }
      @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
    `;
  }
}

if (globalThis.customElements && !globalThis.customElements.get("family-hub-card")) {
  globalThis.customElements.define("family-hub-card", FamilyHubCard);
  globalThis.customCards = globalThis.customCards || [];
  globalThis.customCards.push({
    type: "family-hub-card",
    name: "Family Hub",
    preview: false,
    description: "A room-first family dashboard for Home Assistant"
  });
}
