Warning: truncated output (original token count: 103332)
Total output lines: 7034

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
const PHOTO_FRAME_MEDIA_LIMIT = 250;
const MAX_CALENDAR_RANGE_MS = 62 * 86_400_000;
const PREPARATION_MARKER = "Family Dashboard preparation";
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

function formatTimeInput(value, timeZone) {
  if (!value) return "00:00";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "00:00";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.hour}:${parts.minute}`;
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

function preparationHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function familyPlannerEventKey(event = {}) {
  const calendarEntity = event?._calendar?.entity_id || event.calendar_entity_id || "calendar.unknown";
  const start = String(calendarEventStart(event) || "unknown").slice(0, 16);
  const summary = String(event.summary || event.message || "Event").trim().toLocaleLowerCase();
  return `fd-${preparationHash(`${calendarEntity}|${start}|${summary}`)}`;
}

export function familyPlannerPeople(event = {}, people = []) {
  const personIds = Array.isArray(event?._calendar?.person_ids) ? event._calendar.person_ids : [];
  return people.filter((person) => personIds.includes(person.id));
}

export function matchPreparationTemplate(event = {}, templates = []) {
  const haystack = `${event.summary || ""} ${event.description || ""}`.toLocaleLowerCase();
  return templates.find((template) => (template.keywords || []).some((keyword) => {
    return haystack.includes(String(keyword || "").trim().toLocaleLowerCase());
  })) || null;
}

export function preparationDescription(event, personId, templateId) {
  return [
    PREPARATION_MARKER,
    `Event: ${familyPlannerEventKey(event)}`,
    `Person: ${personId}`,
    `Template: ${templateId}`
  ].join("\n");
}

export function parsePreparationDescription(description = "") {
  const lines = String(description || "").split(/\r?\n/).map((line) => line.trim());
  if (lines[0] !== PREPARATION_MARKER) return null;
  const fields = Object.fromEntries(lines.slice(1).map((line) => {
    const separator = line.indexOf(":");
    return separator > 0 ? [line.slice(0, separator).trim().toLocaleLowerCase(), line.slice(separator + 1).trim()] : ["", ""];
  }).filter(([key, value]) => key && value));
  return fields.event && fields.person
    ? { eventKey: fields.event, personId: fields.person, templateId: fields.template || "custom" }
    : null;
}

export function extractPreparationItems(response = {}) {
  const candidates = [
    response?.items,
    response?.response?.items,
    ...Object.values(response?.response || {}).map((entry) => entry?.items),
    ...Object.values(response || {}).map((entry) => entry?.items)
  ];
  const items = candidates.find(Array.isArray) || [];
  return items.map((item) => ({
    ...item,
    _preparation: parsePreparationDescription(item.description)
  })).filter((item) => item._preparation);
}

export function preparationProgress(items = [], eventKey, personIds = []) {
  const relevant = items.filter((item) => item?._preparation?.eventKey === eventKey
    && (!personIds.length || personIds.includes(item._preparation.personId)));
  const complete = relevant.filter((item) => String(item.status).toLocaleLowerCase() === "completed").length;
  return { total: relevant.length, complete, ready: relevant.length > 0 && complete === relevant.length };
}

export function isPreparationWindowEvent(event, lookaheadDays = 7, now = new Date(), timeZone = "Europe/London") {
  if (!isCurrentOrFutureCalendarEvent(event, now, timeZone)) return false;
  const start = calendarEventStart(event);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(start || ""))
    ? new Date(`${start}T23:59:59Z`)
    : new Date(start);
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(nowDate.getTime())) return false;
  return startDate.getTime() <= nowDate.getTime() + Math.max(1, Number(lookaheadDays) || 7) * 86_400_000;
}

export function isAllowedPlannerAction(domain, service, targetEntity, config = {}) {
  if (!config?.features?.calendar) return false;
  if (domain === "todo" && service === "get_items") {
    return config.calendar.preparation?.enabled === true
      && config.calendar.preparation.todo_entity === targetEntity;
  }
  if (config?.display?.read_only) return false;
  if (domain === "calendar" && service === "create_event") {
    return config.calendar.entities.some((entry) => entry.allow_create === true && entry.entity_id === targetEntity);
  }
  if (domain === "todo" && ["add_item", "update_item"].includes(service)) {
    return config.calendar.preparation?.enabled === true
      && config.calendar.preparation.todo_entity === targetEntity;
  }
  return false;
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

export function schoolDataSource(config = {}) {
  return config?.school?.source === "calendar" ? "calendar" : "classroom";
}

export function isSafePhotoFrameMediaSource(value) {
  const source = String(value || "");
  return source.length <= 300
    && /^media-source:\/\/media_source\/local\/family-dashboard(?:\/[A-Za-z0-9._-]+)*$/.test(source)
    && !source.includes("..");
}

export function isSafeResolvedPhotoUrl(value) {
  const url = String(value || "");
  return url.length <= 2_000
    && url.startsWith("/media/local/family-dashboard/")
    && !/[\\\s<>]/.test(url)
    && !url.includes("..");
}

function isSafePhotoMediaId(value, source) {
  const mediaId = String(value || "");
  return isSafePhotoFrameMediaSource(source)
    && mediaId.length <= 600
    && mediaId.startsWith(`${source}/`)
    && !/[\\\s<>]/.test(mediaId)
    && !mediaId.includes("..");
}

export function nextSchoolCalendarEvent(config = {}, events = [], personId, now = new Date()) {
  if (schoolDataSource(config) !== "calendar") return null;
  const schoolEntityIds = new Set([
    ...(config?.school?.calendar_entities || []),
    ...(config?.school?.scopay_calendar_entities || [])
  ]);
  return (Array.isArray(events) ? events : [])
    .filter((event) => {
      const calendar = event?._calendar;
      return schoolEntityIds.has(calendar?.entity_id)
        && calendar?.category === "school"
        && Array.isArray(calendar?.person_ids)
        && calendar.person_ids.includes(personId)
        && isCurrentOrFutureCalendarEvent(event, now, config?.product?.timezone);
    })
    .sort((left, right) => new Date(calendarEventStart(left)) - new Date(calendarEventStart(right)))[0] || null;
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
    this._photoFrameIdleTimer = null;
    this._photoFrameSlideTimer = null;
    this._photoFrameActive = false;
    this._photoFrameIndex = 0;
    this._photoFrameItems = [];
    this._photoFrameUrl = null;
    this._photoFrameLoading = false;
    this._photoFrameError = null;
    this._photoFrameMediaSourceKey = null;
    this._photoFrameBrowseRequest = 0;
    this._photoFrameResolveRequest = 0;
    this._photoFrameMotionState = null;
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
    this._calendarPersonFilter = "all";
    this._plannerModal = null;
    this._preparationItems = [];
    this._preparationLoading = false;
    this._preparationError = null;
    this._preparationRequestKey = "";
    this._preparationRequest = 0;
    this._readOnlyHassSource = null;
    this._readOnlyHass = new Map();
    this._musicHassSource = null;
    this._musicHass = null;
    this._childHassTokens = new Map();
    this._childMountGeneration = 0;
    this._boundClick = (event) => this._handleClick(event);
    this._boundChange = (event) => this._handleChange(event);
    this._boundKeydown = (event) => this._handleKeydown(event);
    this._boundPointerActivity = () => this._handlePhotoFrameActivity();
    this._boundVisibilityChange = () => {
      if (globalThis.document?.visibilityState === "hidden") {
        this._clearFreshnessTimer();
        this._clearPhotoFrameTimers();
        this._photoFrameActive = false;
        this._closeActiveCamera({ render: false, invalidate: true });
      } else {
        this._scheduleRender(true);
        this._armFreshnessTimer();
        this._armPhotoFrameIdleTimer();
      }
    };
    this._boundPageHide = () => this._closeActiveCamera({ render: false, invalidate: true });
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._boundClick);
    this.shadowRoot.addEventListener("change", this._boundChange);
    this.shadowRoot.addEventListener("keydown", this._boundKeydown);
    this.shadowRoot.addEventListener("pointerdown", this._boundPointerActivity, { passive: true });
    globalThis.document?.addEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.addEventListener?.("pagehide", this._boundPageHide);
    this._armFreshnessTimer();
    this._armPhotoFrameIdleTimer();
    void this._loadPhotoFrameMedia();
    this._scheduleRender(true);
  }

  disconnectedCallback() {
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    this.shadowRoot.removeEventListener("click", this._boundClick);
    this.shadowRoot.removeEventListener("change", this._boundChange);
    this.shadowRoot.removeEventListener("keydown", this._boundKeydown);
    this.shadowRoot.removeEventListener("pointerdown", this._boundPointerActivity);
    globalThis.document?.removeEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.removeEventListener?.("pagehide", this._boundPageHide);
    this._clearFreshnessTimer();
    this._clearPhotoFrameTimers();
    this._photoFrameBrowseRequest += 1;
    this._photoFrameResolveRequest += 1;
    this._preparationRequest += 1;
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
    this._clearPhotoFrameTimers();
    this._photoFrameActive = false;
    this._photoFrameIndex = 0;
    this._photoFrameItems = [];
    this._photoFrameUrl = null;
    this._photoFrameLoading = false;
    this._photoFrameError = null;
    this._photoFrameMediaSourceKey = null;
    this._photoFrameMotionState = null;
    this._photoFrameBrowseRequest += 1;
    this._photoFrameResolveRequest += 1;
    this._view = config.display.default_view || "today";
    this._homeSection = config.home.default_section || "rooms";
    this._calendarMode = config.calendar.initial_view || "week";
    this._calendarPersonFilter = "all";
    this._plannerModal = null;
    this._preparationItems = [];
    this._preparationLoading = false;
    this._preparationError = null;
    this._preparationRequestKey = "";
    this._preparationRequest += 1;
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
    this._armPhotoFrameIdleTimer();
    void this._loadPhotoFrameMedia();
    this._scheduleRender(true);
  }

  set hass(hass) {
    this._invalidateChildHass();
    this._hass = hass;
    this._reconcilePhotoFrame(hass?.states || {});
    this._pruneInactiveChildCards();
    for (const [key, child] of this._childCards.entries()) child.hass = this._hassForChild(key);
    this._reconcileCameraSession(hass?.states || {});
    if (!this._config) return;
    void this._loadPhotoFrameMedia();
    const nextSignature = stateSignature(hass?.states || {}, this._entityIds);
    if (nextSignature !== this._signature) {
      this._signature = nextSignature;
      // The embedded player receives the new hass object above. Rebuilding the
      // outer shell for every playback tick would reset its browsing position.
      if (this._view !== "music") this._scheduleRender();
    }
    this._loadCalendarEvents();
    void this._loadPreparationItems();
  }

  getCardSize() {
    return 16;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 12 };
  }

  _scheduleRender(force = false) {
    if (!this.isConnected && !force) return;
    // The photo frame owns the visible surface while it is active. Rebuilding
    // the shadow tree for ordinary Home Assistant state ticks would replace
    // the current image and restart its reveal animation, which presents as a
    // recurring pulse between the configured slide changes.
    if (this._photoFrameActive && !force) return;
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

  _photoFrameConfig() {
    const photoFrame = this._config?.display?.photo_frame;
    return photoFrame?.enabled === true && isSafePhotoFrameMediaSource(photoFrame.media_source)
      ? photoFrame
      : null;
  }

  _clearPhotoFrameIdleTimer() {
    if (this._photoFrameIdleTimer !== null) clearTimeout(this._photoFrameIdleTimer);
    this._photoFrameIdleTimer = null;
  }

  _clearPhotoFrameSlideTimer() {
    if (this._photoFrameSlideTimer !== null) clearTimeout(this._photoFrameSlideTimer);
    this._photoFrameSlideTimer = null;
  }

  _clearPhotoFrameTimers() {
    this._clearPhotoFrameIdleTimer();
    this._clearPhotoFrameSlideTimer();
  }

  _armPhotoFrameIdleTimer() {
    this._clearPhotoFrameIdleTimer();
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame || this._photoFrameActive || !this.isConnected
      || globalThis.document?.visibilityState === "hidden") return;
    if (photoFrame.motion_entity
      && entityStateValue(this._hass?.states?.[photoFrame.motion_entity]) === "on") return;
    this._photoFrameIdleTimer = setTimeout(() => {
      this._photoFrameIdleTimer = null;
      this._activatePhotoFrame();
    }, photoFrame.idle_seconds * 1_000);
  }

  _armPhotoFrameSlideTimer() {
    this._clearPhotoFrameSlideTimer();
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame || !this._photoFrameActive || this._photoFrameItems.length < 1) return;
    this._photoFrameSlideTimer = setTimeout(() => {
      this._photoFrameSlideTimer = null;
      if (!this._photoFrameActive || !this._photoFrameItems.length) return;
      this._photoFrameIndex = (this._photoFrameIndex + 1) % this._photoFrameItems.length;
      void this._resolvePhotoFrameItem();
    }, photoFrame.slide_seconds * 1_000);
  }

  _handlePhotoFrameActivity() {
    if (this._photoFrameActive) {
      this._deactivatePhotoFrame();
      return;
    }
    this._armPhotoFrameIdleTimer();
  }

  _activatePhotoFrame() {
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame || globalThis.document?.visibilityState === "hidden") return;
    if (photoFrame.motion_entity
      && entityStateValue(this._hass?.states?.[photoFrame.motion_entity]) === "on") {
      this._armPhotoFrameIdleTimer();
      return;
    }
    this._clearPhotoFrameTimers();
    this._pendingConfirmation = null;
    this._confirmationReturnFocus = null;
    this._photoFrameActive = true;
    this._photoFrameUrl = null;
    this._closeActiveCamera({ render: false, invalidate: true });
    this._scheduleRender(true);
    if (this._photoFrameItems.length) void this._resolvePhotoFrameItem();
    else void this._loadPhotoFrameMedia({ refresh: true });
  }

  _deactivatePhotoFrame() {
    if (!this._photoFrameActive) {
      this._armPhotoFrameIdleTimer();
      return;
    }
    this._photoFrameActive = false;
    this._photoFrameResolveRequest += 1;
    this._clearPhotoFrameSlideTimer();
    this._scheduleRender(true);
    this._armPhotoFrameIdleTimer();
  }

  _reconcilePhotoFrame(states) {
    const photoFrame = this._photoFrameConfig();
    const nextMotion = photoFrame?.motion_entity
      ? entityStateValue(states?.[photoFrame.motion_entity])
      : null;
    const motionStarted = nextMotion === "on" && this._photoFrameMotionState !== "on";
    const motionEnded = nextMotion !== "on" && this._photoFrameMotionState === "on";
    this._photoFrameMotionState = nextMotion;
    if (motionStarted) {
      if (this._photoFrameActive) this._deactivatePhotoFrame();
      else this._armPhotoFrameIdleTimer();
    } else if (motionEnded) {
      this._armPhotoFrameIdleTimer();
    }
  }

  async _loadPhotoFrameMedia({ refresh = false } = {}) {
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame || typeof this._hass?.callWS !== "function") return;
    if (!refresh && (this._photoFrameLoading || this._photoFrameMediaSourceKey === photoFrame.media_source)) return;
    const request = ++this._photoFrameBrowseRequest;
    this._photoFrameLoading = true;
    this._photoFrameError = null;
    try {
      const result = await this._hass.callWS({
        type: "media_source/browse_media",
        media_content_id: photoFrame.media_source
      });
      if (request !== this._photoFrameBrowseRequest || this._photoFrameConfig()?.media_source !== photoFrame.media_source) return;
      const children = Array.isArray(result?.children) ? result.children : [];
      this._photoFrameItems = children
        .filter((item) => (item?.media_class === "image" || String(item?.mime_type || "").startsWith("image/"))
          && item?.can_play !== false
          && isSafePhotoMediaId(item?.media_content_id, photoFrame.media_source))
        .slice(0, PHOTO_FRAME_MEDIA_LIMIT)
        .map((item) => ({ media_content_id: item.media_content_id }));
      this._photoFrameMediaSourceKey = photoFrame.media_source;
      this._photoFrameIndex %= Math.max(1, this._photoFrameItems.length);
      if (!this._photoFrameItems.length) {
        this._photoFrameUrl = null;
        this._photoFrameError = "No photos are available in the private Family Dashboard album.";
      }
    } catch {
      if (request !== this._photoFrameBrowseRequest) return;
      this._photoFrameItems = [];
      this._photoFrameUrl = null;
      this._photoFrameError = "The private photo album is unavailable. Home Assistant will try again next time.";
    } finally {
      if (request === this._photoFrameBrowseRequest) {
        this._photoFrameLoading = false;
        if (this._photoFrameActive) {
          this._scheduleRender(true);
          if (this._photoFrameItems.length) void this._resolvePhotoFrameItem();
        }
      }
    }
  }

  async _resolvePhotoFrameItem() {
    const photoFrame = this._photoFrameConfig();
    const item = this._photoFrameItems[this._photoFrameIndex];
    if (!photoFrame || !this._photoFrameActive || !item || typeof this._hass?.callWS !== "function") return;
    const request = ++this._photoFrameResolveRequest;
    try {
      const result = await this._hass.callWS({
        type: "media_source/resolve_media",
        media_content_id: item.media_content_id
      });
      if (request !== this._photoFrameResolveRequest || !this._photoFrameActive) return;
      if (!String(result?.mime_type || "").startsWith("image/") || !isSafeResolvedPhotoUrl(result?.url)) {
        throw new Error("unsafe photo response");
      }
      this._photoFrameUrl = result.url;
      this._photoFrameError = null;
      this._syncPhotoFrameMedia();
    } catch {
      if (request !== this._photoFrameResolveRequest || !this._photoFrameActive) return;
      this._photoFrameUrl = null;
      this._photoFrameError = "This photo could not be displayed.";
      this._syncPhotoFrameMedia();
    } finally {
      if (request === this._photoFrameResolveRequest && this._photoFrameActive) this._armPhotoFrameSlideTimer();
    }
  }

  _syncPhotoFrameMedia() {
    const frame = this.shadowRoot?.querySelector?.(".photo-frame");
    if (!frame) {
      this._scheduleRender(true);
      return;
    }
    const image = frame.querySelector("img");
    const status = frame.querySelector(".photo-frame-status");
    if (image) {
      const previousUrl = image.getAttribute("src");
      if (this._photoFrameUrl) {
        if (previousUrl !== this._photoFrameUrl) {
          image.setAttribute("src", this._photoFrameUrl);
          image.classList.remove("is-revealing");
          void image.offsetWidth;
          image.classList.add("is-revealing");
        }
      } else {
        image.removeAttribute("src");
        image.classList.remove("is-revealing");
      }
      image.hidden = !this._photoFrameUrl;
      image.alt = `Family photo ${this._photoFrameIndex + 1} of ${Math.max(1, this._photoFrameItems.length)}`;
    }
    if (status) {
      status.hidden = Boolean(this._photoFrameUrl);
      status.textContent = this._photoFrameLoading ? "Loading family photos…" : this._photoFrameError || "Preparing family photos…";
    }
  }

  _updatePhotoFrameClock(now = new Date()) {
    if (!this._photoFrameActive || !this._config?.display?.photo_frame?.show_clock) return;
    const clock = this.shadowRoot?.querySelector?.(".photo-frame-clock strong");
    const date = this.shadowRoot?.querySelector?.(".photo-frame-clock span");
    if (clock) clock.textContent = new Intl.DateTimeFormat(this._config.product.locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: this._config.product.timezone
    }).format(now);
    if (date) date.textContent = new Intl.DateTimeFormat(this._config.product.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: this._config.product.timezone
    }).format(now);
  }

  _refreshTimeSensitiveView(now = new Date()) {
    if (this._photoFrameActive) {
      this._updatePhotoFrameClock(now);
      return;
    }
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

  _nextSchoolCalendarEvent(personId, now = new Date()) {
    const events = this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents();
    return nextSchoolCalendarEvent(this._config, events, personId, now);
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

  async _loadPreparationItems(force = false) {
    const preparation = this._config?.calendar?.preparation;
    const entityId = preparation?.todo_entity;
    if (!preparation?.enabled || !entityId || !this._hass || typeof this._hass.callWS !== "function") return;
    if (!isAllowedPlannerAction("todo", "get_items", entityId, this._config)) return;
    const state = this._hass.states?.[entityId];
    const requestKey = `${entityId}:${state?.last_updated || state?.last_changed || "unknown"}`;
    if (!force && requestKey === this._preparationRequestKey) return;
    this._preparationRequestKey = requestKey;
    this._preparationLoading = true;
    this._preparationError = null;
    const requestId = ++this._preparationRequest;
    try {
      const response = await this._hass.callWS({
        type: "call_service",
        domain: "todo",
        service: "get_items",
        target: { entity_id: entityId },
        service_data: {},
        return_response: true
      });
      if (requestId !== this._preparationRequest) return;
      this._preparationItems = extractPreparationItems(response);
    } catch (error) {
      if (requestId !== this._preparationRequest) return;
      this._preparationError = error?.message || "Preparation list is temporarily unavailable";
    } finally {
      if (requestId === this._preparationRequest) {
        this._preparationLoading = false;
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
    const shellGuard = this._photoFrameActive || this._plannerModal ? ' inert aria-hidden="true"' : "";
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
        <div class="hub-shell"${shellGuard}>
          ${this._renderNavigation()}
          <main class="hub-content">
            ${this._renderHeader()}
            <div class="hub-view" data-current-view="${escapeHtml(this._view)}">
              ${this._renderView()}
            </div>
          </main>
        </div>
        ${this._renderPhotoFrame()}
        ${this._renderPlannerModal()}
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
    if (this._plannerModal) {
      const modal = this.shadowRoot.querySelector(".planner-modal");
      if (modal && !modal.contains(this.shadowRoot.activeElement)) {
        (modal.querySelector('[data-planner-field="summary"]') || modal.querySelector("button:not([disabled])"))?.focus();
      }
    } else if (!confirmationFocusHandled) this._restoreRenderFocus(renderFocus);
    this._restoreEmbeddedRenderState(embeddedRenderState);
  }

  _renderPhotoFrame() {
    if (!this._photoFrameActive) return "";
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame) return "";
    const now = new Date();
    const time = new Intl.DateTimeFormat(this._config.product.locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: this._config.product.timezone
    }).format(now);
    const date = new Intl.DateTimeFormat(this._config.product.locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: this._config.product.timezone
    }).format(now);
    const status = this._photoFrameLoading
      ? "Loading family photos…"
      : this._photoFrameError || "Preparing family photos…";
    return `
      <button type="button" class="photo-frame" data-photo-frame-dismiss aria-label="Return to the Family Dashboard">
        <img ${this._photoFrameUrl ? `src="${escapeHtml(this._photoFrameUrl)}"` : ""} ${this._photoFrameUrl ? "" : "hidden"} alt="Family photo ${this._photoFrameIndex + 1} of ${Math.max(1, this._photoFrameItems.length)}">
        <span class="photo-frame-shade" aria-hidden="true"></span>
        <span class="photo-frame-status" role="status" ${this._photoFrameUrl ? "hidden" : ""}>${escapeHtml(status)}</span>
        ${photoFrame.show_clock ? `<span class="photo-frame-clock"><strong>${escapeHtml(time)}</strong><span>${escapeHtml(date)}</span></span>` : ""}
        <span class="photo-frame-hint"><ha-icon icon="mdi:motion-sensor" aria-hidden="true"></ha-icon>Approach or tap to open the dashboard</span>
      </button>
    `;
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
        && (!descriptor.gameweekRole || c…53332 tokens truncated…ly-note { display:flex; align-items:center; gap:7px; margin:14px 0 0; padding:10px 12px; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-muted); font-size:12px; }
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
      .calendar-view { position:relative; display:grid; grid-template-rows:58px 50px minmax(0,1fr); gap:9px; background:linear-gradient(155deg,rgba(250,246,245,.94),rgba(235,230,242,.91)); }
      .calendar-toolbar { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:14px; }
      .calendar-toolbar-actions { display:flex; align-items:center; gap:9px; }
      .calendar-add-event { min-height:48px; padding:0 12px; border:0; border-radius:11px; background:#1463E8; color:#fff; display:flex; align-items:center; gap:5px; font-size:12px; font-weight:800; cursor:pointer; }
      .calendar-add-event ha-icon { --mdc-icon-size:16px; }
      .calendar-context { min-width:max-content; display:flex; align-items:center; gap:9px; color:#0B1830; }
      .calendar-context > ha-icon { --mdc-icon-size:22px; color:#1463E8; }
      .calendar-context > span,.calendar-context strong,.calendar-context small { display:block; }
      .calendar-context strong { font-size:15px; }
      .calendar-context small { margin-top:2px; color:#5E6B80; font-size:12px; font-weight:650; }
      .calendar-modes { flex-wrap:nowrap; }
      .calendar-card-slot { height:100%; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:rgba(7,14,29,.62); --ha-card-background:transparent; --card-background-color:transparent; --ha-card-border-width:0; --ha-card-box-shadow:none; --primary-text-color:#f7f8fc; --secondary-text-color:#b6bdce; }
      .calendar-person-filters { min-width:0; display:flex; align-items:center; gap:7px; overflow-x:auto; scrollbar-width:none; }
      .calendar-person-filters::-webkit-scrollbar { display:none; }
      .calendar-person-filter { flex:0 0 auto; min-height:48px; padding:4px 12px 4px 5px; border:1px solid rgba(26,45,78,.11); border-radius:999px; background:rgba(255,255,255,.7); color:#445069; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:800; cursor:pointer; }
      .calendar-person-filter > span { width:32px; height:32px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; }
      .calendar-person-filter.is-selected { border-color:var(--person-colour); background:color-mix(in srgb,var(--person-colour) 11%,#fff); color:#14213A; box-shadow:0 4px 12px color-mix(in srgb,var(--person-colour) 17%,transparent); }
      .family-planner-slot { position:relative; min-height:0; overflow:hidden; }
      .family-planner-grid { height:100%; min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; }
      .family-planner-grid.is-day { grid-template-columns:minmax(0,1fr); }
      .family-planner-day { min-width:0; min-height:0; display:grid; grid-template-rows:52px minmax(0,1fr) auto; border:1px solid rgba(38,50,77,.09); border-radius:15px; background:rgba(255,255,255,.68); overflow:hidden; }
      .family-planner-day.is-today { border-color:rgba(20,99,232,.42); background:#fff; box-shadow:0 8px 20px rgba(35,59,94,.1); }
      .family-planner-day > header { padding:7px 7px 6px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(38,50,77,.07); }
      .family-planner-day > header > div:first-child { display:flex; align-items:baseline; gap:4px; }
      .family-planner-day > header span { color:#68748A; font-size:12px; font-weight:800; text-transform:uppercase; }
      .family-planner-day > header strong { color:#17233A; font-size:18px; line-height:1; }
      .family-planner-day > header small { color:#8A94A6; font-size:12px; text-transform:uppercase; }
      .day-people { display:flex; flex-direction:row-reverse; }
      .day-people i { width:24px; height:24px; margin-left:-5px; display:grid; place-items:center; border:2px solid #fff; border-radius:50%; background:var(--person-colour); color:#fff; font-size:12px; font-style:normal; font-weight:900; }
      .family-planner-events { min-height:0; padding:6px; display:flex; flex-direction:column; gap:5px; overflow:auto; }
      .family-planner-event { position:relative; width:100%; min-width:0; min-height:48px; padding:7px 6px 7px 9px; border:0; border-radius:10px; background:color-mix(in srgb,var(--calendar-colour) 13%,#fff); color:#1E2A42; display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left; cursor:pointer; overflow:hidden; }
      .family-planner-event::before { content:""; position:absolute; inset:4px auto 4px 0; width:3px; border-radius:4px; background:var(--calendar-colour); }
      .family-planner-event strong { width:100%; overflow:hidden; text-overflow:ellipsis; color:#111C33; font-size:12px; line-height:1.2; }
      .family-planner-event small,.planner-event-time { width:100%; overflow:hidden; text-overflow:ellipsis; color:#68748A; font-size:12px; white-space:nowrap; }
      .planner-event-time { color:var(--calendar-colour); font-weight:900; }
      .planner-ready-state { margin-top:3px; display:flex; align-items:center; gap:3px; color:#7A5720; font-size:12px; font-weight:850; }
      .planner-ready-state ha-icon { --mdc-icon-size:12px; }
      .family-planner-event.is-ready .planner-ready-state { color:#167451; }
      .family-planner-empty { margin:auto; color:#9BA4B4; font-size:12px; }
      .day-ready { padding:6px 7px; border-top:1px solid rgba(38,50,77,.07); background:#FFF8E9; color:#7B581D; display:flex; align-items:center; gap:4px; font-size:12px; font-weight:850; }
      .day-ready ha-icon { --mdc-icon-size:13px; }
      .day-ready.is-ready { background:#ECF9F3; color:#167451; }
      .calendar-card-slot .embedded-card { height:100%; min-height:0; overflow:auto; }
      .calendar-fallback { position:relative; height:100%; min-height:0; padding:10px; }
      .calendar-legends { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:7px 13px; }
      .calendar-legend { display:flex; align-items:center; gap:5px; color:#42495b; font-size:10px; font-weight:700; }
      .calendar-legend i { width:8px; height:8px; border-radius:50%; background:var(--calendar-colour); box-shadow:0 0 0 3px color-mix(in srgb,var(--calendar-colour) 16%,transparent); }
      .calendar-loading { position:absolute; top:14px; right:18px; z-index:2; display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; background:#fff; color:#4d5568; font-size:9px; box-shadow:0 7px 20px rgba(27,34,53,.12); }
      .calendar-loading span { width:8px; height:8px; border-radius:50%; background:var(--hub-accent); animation:pulse 1.2s ease-in-out infinite; }
      .calendar-warning { position:absolute; z-index:2; bottom:12px; left:50%; transform:translateX(-50%); margin:0; padding:8px 12px; border-radius:12px; background:#fff3d9; color:#704b0d; font-size:9px; box-shadow:0 7px 18px rgba(45,35,14,.14); }
      .calendar-warning.preparation-warning { bottom:48px; }
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
      .planner-modal-backdrop { position:absolute; inset:0; z-index:80; display:grid; place-items:center; padding:28px; background:rgba(7,13,25,.67); backdrop-filter:blur(7px); }
      .planner-modal { width:min(620px,92%); max-height:88%; display:grid; grid-template-rows:auto minmax(0,1fr) auto; border:1px solid rgba(255,255,255,.8); border-radius:24px; background:#F8FAFD; color:#14213A; box-shadow:0 28px 80px rgba(3,10,23,.42); overflow:hidden; }
      .planner-modal > header { position:relative; padding:21px 25px 18px; background:linear-gradient(145deg,color-mix(in srgb,var(--calendar-colour,#1463E8) 13%,#fff),#fff); border-bottom:1px solid #E4E9F1; }
      .planner-modal > header::before { content:""; position:absolute; inset:0 auto 0 0; width:6px; background:var(--calendar-colour,#1463E8); }
      .planner-modal > header h2 { margin:3px 38px 5px 0; color:#101B31; font-size:24px; }
      .planner-modal > header p:last-child { margin:0; color:#647087; font-size:12px; }
      .planner-modal-close { position:absolute; top:16px; right:18px; width:48px; height:48px; border:1px solid #DCE3ED; border-radius:12px; background:#fff; color:#42506A; display:grid; place-items:center; cursor:pointer; }
      .planner-modal-body { min-height:0; padding:20px 25px; overflow:auto; }
      .planner-event-location { margin:0 0 10px; display:flex; align-items:center; gap:6px; color:#42506A; font-size:12px; font-weight:750; }
      .planner-event-description { margin:0 0 15px; color:#647087; font-size:12px; line-height:1.45; }
      .planner-checklist { display:grid; gap:7px; }
      .planner-checklist-heading { margin-bottom:3px; display:flex; justify-content:space-between; align-items:center; }
      .planner-checklist-heading h3 { margin:3px 0 0; font-size:17px; }
      .planner-checklist-heading > span { width:38px; height:38px; display:grid; place-items:center; border-radius:13px; background:#FFF2D8; color:#9A681C; }
      .planner-checklist-heading > span.is-ready { background:#E7F7EF; color:#167451; }
      .planner-check-item { width:100%; min-height:48px; padding:7px 10px; border:1px solid #E1E7EF; border-radius:12px; background:#fff; color:#17233A; display:grid; grid-template-columns:27px minmax(0,1fr) auto; align-items:center; gap:8px; text-align:left; cursor:pointer; }
      .planner-check-item > span { width:26px; height:26px; display:grid; place-items:center; border-radius:9px; background:#EFF3F8; color:#718097; }
      .planner-check-item strong { font-size:12px; }
      .planner-check-item small { padding:4px 7px; border-radius:999px; background:color-mix(in srgb,var(--person-colour) 12%,#fff); color:var(--person-colour); font-size:12px; font-weight:850; }
      .planner-check-item.is-complete { background:#F2FAF6; border-color:#CCEBDD; }
      .planner-check-item.is-complete > span { background:#1B9A6B; color:#fff; }
      .planner-check-item.is-complete strong { color:#668074; text-decoration:line-through; }
      .planner-suggestion { padding:15px; border:1px solid #F0DCB2; border-radius:15px; background:#FFF9EC; display:grid; grid-template-columns:38px minmax(0,1fr); gap:11px; }
      .planner-suggestion > span { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; background:#FFE9B9; color:#A26B17; }
      .planner-suggestion h3 { margin:3px 0 5px; font-size:16px; }
      .planner-suggestion p:not(.eyebrow) { margin:0; color:#6D604A; font-size:12px; line-height:1.45; }
      .planner-suggestion div > div { display:flex; gap:7px; margin-top:11px; }
      .planner-suggestion button { min-height:48px; padding:8px 11px; border:0; border-radius:10px; background:var(--person-colour); color:#fff; font-size:12px; font-weight:850; cursor:pointer; }
      .planner-no-prep { margin:0; padding:15px; border-radius:14px; background:#EFF3F8; color:#68748A; font-size:12px; }
      .planner-modal > footer { min-height:58px; padding:10px 25px; border-top:1px solid #E4E9F1; background:#fff; display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .planner-modal > footer > span { display:flex; align-items:center; gap:5px; color:#68748A; font-size:12px; }
      .planner-add-modal { width:min(700px,94%); }
      .planner-event-form { min-height:0; padding:18px 25px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; overflow:auto; }
      .planner-event-form label { display:grid; gap:5px; }
      .planner-event-form label.is-wide { grid-column:1/-1; }
      .planner-event-form label > span { color:#536078; font-size:12px; font-weight:850; text-transform:uppercase; letter-spacing:.04em; }
      .planner-event-form input,.planner-event-form select { min-width:0; height:48px; padding:0 11px; border:1px solid #D9E1EC; border-radius:11px; background:#fff; color:#152139; font:inherit; font-size:12px; }
      .planner-form-error { grid-column:1/-1; min-height:15px; margin:0; color:#B83C4A; font-size:12px; font-weight:750; }
      .planner-add-modal > footer button { min-width:110px; min-height:48px; border:1px solid #D9E1EC; border-radius:11px; background:#fff; color:#42506A; font-weight:850; cursor:pointer; }
      .planner-add-modal > footer { justify-content:flex-end; }
      .planner-add-modal > footer button.planner-save { border-color:#1463E8; background:#1463E8; color:#fff; }
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
      .family-preparation { margin-top:13px; padding:10px; border:1px solid color-mix(in srgb,var(--person-colour) 23%,transparent); border-radius:15px; background:color-mix(in srgb,var(--person-colour) 6%,var(--hub-surface)); }
      .family-preparation .chore-heading { margin-top:0; }
      .family-preparation.is-ready { border-color:#A9DCC1; background:#F1FAF5; }
      .family-prep-list { margin-top:8px; display:grid; gap:6px; }
      .family-prep-item { width:100%; min-width:0; min-height:48px; padding:7px 9px; display:grid; grid-template-columns:27px minmax(0,1fr); gap:8px; align-items:center; border:1px solid color-mix(in srgb,var(--person-colour) 15%,transparent); border-radius:11px; background:color-mix(in srgb,var(--person-colour) 5%,rgba(255,255,255,.76)); color:var(--hub-text); text-align:left; cursor:pointer; }
      .family-prep-item > span { width:27px; height:27px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb,var(--person-colour) 12%,var(--hub-surface)); color:var(--person-colour); }
      .family-prep-item ha-icon { --mdc-icon-size:16px; }
      .family-prep-item strong,.family-prep-item small { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
      .family-prep-item strong { font-size:12px; }
      .family-prep-item small { margin-top:2px; color:var(--hub-muted); font-size:12px; }
      .family-prep-item.is-complete { border-color:#B7DEC9; background:#F1FAF5; }
      .family-prep-item.is-complete > span { background:#1B9A6B; color:#fff; }
      .family-prep-item.is-complete strong { color:var(--hub-muted); text-decoration:line-through; }
      .family-prep-more { width:100%; min-height:48px; margin-top:8px; padding:7px; border:0; background:transparent; color:var(--person-colour); font-size:12px; font-weight:850; cursor:pointer; }
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
      .family-preparation { border-color:color-mix(in srgb,var(--person-colour) 24%,#DCE4EE); background:color-mix(in srgb,var(--person-colour) 5%,#fff); }
      .family-prep-item { border-color:color-mix(in srgb,var(--person-colour) 20%,#DCE4EE); background:#fff; color:#0B1830; }
      .family-prep-item strong { color:#0B1830; font-size:13px; }
      .family-prep-item small { color:#5E6B80; font-size:12px; }
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
