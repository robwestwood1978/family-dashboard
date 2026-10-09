import { HOME_ILLUSTRATION } from "./assets/home-illustration.js";
import { DAILY_BRIEF_STYLES } from "./daily-brief-styles.js?v=0.19.0";

const VIEW_DEFINITIONS = [
  { id: "today", label: "Today", icon: "mdi:home-heart", feature: null, primary: true },
  { id: "calendar", label: "Calendar", icon: "mdi:calendar-month", feature: "calendar" },
  { id: "rooms", label: "Home", icon: "mdi:floor-plan", feature: "rooms" },
  { id: "family", label: "Tasks", icon: "mdi:clipboard-check-outline", feature: "family" },
  { id: "entry", label: "Security", icon: "mdi:shield-home", feature: "entry" },
  { id: "music", label: "Music", icon: "mdi:music-circle", feature: "music" },
  { id: "energy", label: "Energy", icon: "mdi:lightning-bolt-circle", feature: "energy" },
  { id: "football", label: "Football", icon: "mdi:soccer", feature: "football" }
];

// Small outline icons keep the shared navigation independent of HA's filled glyphs.
function outlineIcon(name) {
  const paths = {
    today:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-14 4h.01M12 15h.01M17 15h.01M7 18h.01M12 18h.01"/>',
    rooms:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-8H9v8H4a1 1 0 0 1-1-1Z"/>',
    family:'<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    entry:'<path d="m12 3 8 3v6c0 5-5 8-8 9-3-1-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
    energy:'<path d="m13 2-9 12h7l-1 8 10-12h-7Z"/>',
    football:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1"/>',
    music:'<path d="M9 18V4l10 3v11M9 4v5l10 3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="16" cy="18" rx="3" ry="3"/>'
  };
  return `<svg class="hub-outline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.rooms}</svg>`;
}

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
    || dataset.mediaService
    || dataset.coverAction
    || dataset.climateAdjust
    || dataset.climatePower
    || dataset.vacuumAction
    || dataset.alarmAction
    || dataset.secureCoverAction
    || dataset.choreClaim
    || dataset.rewardClaim
    || dataset.roomLights
    || dataset.allInternalLights !== undefined
    || dataset.climateMaster
    || dataset.masterTemperatureAdjust
    || dataset.heatingScheduleApply
    || dataset.cleaningCommand
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

// Device-only copies: no photo data enters household config or Home Assistant.
class DevicePhotoAlbum {
  constructor() {
    this.key = globalThis.location?.pathname || "family-dashboard";
    this.database = null;
  }
  async db() {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      const request = indexedDB.open("family-dashboard-device-photos", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("photos", { keyPath: "id" });
        request.result.createObjectStore("preferences");
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); this.database = null; };
        resolve(request.result);
      };
      request.onerror = () => { this.database = null; reject(request.error); };
      request.onblocked = () => reject(new Error("Close other dashboard tabs and try again."));
    });
    return this.database;
  }
  async transaction(store, mode, operation) {
    const db = await this.db();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(store, mode);
      const request = operation(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("Photo storage was interrupted."));
    });
  }
  async source() { return await this.transaction("preferences", "readonly", store => store.get(this.key)) || "home-assistant"; }
  async setSource(source) { await this.transaction("preferences", "readwrite", store => store.put(source, this.key)); }
  async list() {
    const records = await this.transaction("photos", "readonly", store => store.getAll());
    return records.filter(record => record.album === this.key).sort((a,b) => a.created - b.created);
  }
  async remove(id) {
    const record = await this.transaction("photos", "readonly", store => store.get(id));
    if (record?.album === this.key) await this.transaction("photos", "readwrite", store => store.delete(id));
  }
  async add(file) {
    if (!/\.(jpe?g|png|webp|heic|heif|avif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|heic|heif|avif)$/.test(file.type)) {
      throw new Error("Choose a photo in JPEG, PNG, WebP, HEIC or AVIF format.");
    }
    if (file.size > 40 * 1024 * 1024) throw new Error("This photo is too large. Choose a copy smaller than 40 MB.");
    const records = await this.list();
    if (records.length >= PHOTO_FRAME_MEDIA_LIMIT) throw new Error("Your collection is full (250 photos). Remove a photo before adding more.");
    // Materialise one file at a time while the picker input is still attached.
    // WebKit can revoke a selected File's backing access when its input resets.
    const bytes = await file.arrayBuffer();
    const url = URL.createObjectURL(new Blob([bytes], { type:file.type }));
    const image = new Image();
    let blob, thumbnail;
    try {
      await new Promise((resolve, reject) => { image.onload = resolve; image.onerror = () => reject(new Error("This photo cannot be opened here. Try a JPEG copy.")); image.src = url; });
      const resize = async (edge, quality) => {
        const scale = Math.min(1, edge / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#fff"; context.fillRect(0,0,canvas.width,canvas.height);
        context.drawImage(image,0,0,canvas.width,canvas.height);
        const result = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
        canvas.width = canvas.height = 1;
        if (!result) throw new Error("This photo could not be prepared. Try a JPEG copy.");
        return result;
      };
      blob = await resize(2048, .86);
      thumbnail = await resize(240, .75);
    } finally { image.src = ""; URL.revokeObjectURL(url); }
    if (records.reduce((sum,record) => sum + record.blob.size + record.thumbnail.size, 0) + blob.size + thumbnail.size > 100 * 1024 * 1024) {
      throw new Error("Your collection has reached 100 MB. Remove some photos before adding more.");
    }
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await this.transaction("photos", "readwrite", store => store.put({ id, album:this.key, created:Date.now(), name:file.name, blob, thumbnail }));
  }
}

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
    scheduleTexts: new Set(),
    scheduleModes: new Set(),
    scheduleRefreshButtons: new Set(),
    cleaningSelects: new Set(),
    cleaningButtons: new Set(),
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
    addEntity(policy.scheduleTexts, room.heating_schedule?.entity_id);
    addEntity(policy.scheduleModes, room.heating_schedule?.mode_entity);
    addEntity(policy.scheduleRefreshButtons, room.heating_schedule?.refresh_entity);
  }

  for (const player of config.features?.music !== false ? config.media?.players || [] : []) {
    addEntity(policy.mediaPlayers, player.entity_id);
    addEntity(policy.mediaPlayers, player.ma_entity_id);
    addEntity(policy.mediaPlayers, player.speaker_group_entity_id);
  }
  if (config.features?.weather !== false) addEntity(policy.moreInfo, config.weather?.entity_id);
  for (const key of ["room_entity", "mode_entity", "suction_entity", "mop_entity", "water_entity"]) {
    addEntity(policy.cleaningSelects, config.cleaning?.[key]);
  }
  for (const entityId of config.cleaning?.command_entities || []) addEntity(policy.cleaningButtons, entityId);

  for (const camera of config.features?.entry !== false ? config.entry?.cameras || [] : []) {
    policy.cameras.set(camera.id, {
      entity: camera.entity_id || null,
      ...(camera.still_entity_id ? { stillEntity: camera.still_entity_id } : {}),
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

export function lightSupportsBrightness(state, name = "") {
  if (!isEntityAvailable(state) || /\blamps?\b/i.test(String(name))) return false;
  const modes = Array.isArray(state?.attributes?.supported_color_modes)
    ? state.attributes.supported_color_modes
    : [];
  if (modes.some((mode) => !["onoff", "unknown"].includes(String(mode).toLowerCase()))) return true;
  return (safeNumber(state?.attributes?.supported_features, 0) & 1) === 1
    || Number.isFinite(safeNumber(state?.attributes?.brightness, NaN));
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

const DEFAULT_HEATING_SCHEDULE = Object.freeze([
  { stage: 0, time: "07:00", temperature: 20 },
  { stage: 1, time: "09:30", temperature: 16 },
  { stage: 2, time: "17:30", temperature: 20 },
  { stage: 3, time: "22:00", temperature: 17 }
]);

function bytesToBase64(bytes) {
  return globalThis.btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(value) {
  try {
    return Uint8Array.from(globalThis.atob(String(value || "")), (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

export function encodeHeatingSchedule(periods, dayMask = 0x7f) {
  if (!Array.isArray(periods) || periods.length !== 4 || !Number.isInteger(dayMask) || dayMask < 1 || dayMask > 0x7f) return null;
  const bytes = [dayMask];
  for (let stage = 0; stage < 4; stage += 1) {
    const period = periods[stage] || {};
    const match = String(period.time || "").match(/^(\d{2}):(\d{2})$/);
    const temperature = Math.round(Number(period.temperature) * 10);
    const hour = Number(match?.[1]);
    const minute = Number(match?.[2]);
    if (!match || hour > 23 || minute > 59 || temperature < 50 || temperature > 350) return null;
    bytes.push(stage, hour, minute, temperature >> 8, temperature & 0xff);
  }
  return bytesToBase64(bytes);
}

export function decodeHeatingSchedule(value) {
  const bytes = base64ToBytes(value);
  if (!bytes || bytes.length !== 21 || bytes[0] < 1 || bytes[0] > 0x7f) return null;
  const periods = [];
  for (let offset = 1, stage = 0; stage < 4; stage += 1, offset += 5) {
    if (bytes[offset] !== stage || bytes[offset + 1] > 23 || bytes[offset + 2] > 59) return null;
    const temperature = (bytes[offset + 3] * 256 + bytes[offset + 4]) / 10;
    if (temperature < 5 || temperature > 35) return null;
    periods.push({
      stage,
      time: `${String(bytes[offset + 1]).padStart(2, "0")}:${String(bytes[offset + 2]).padStart(2, "0")}`,
      temperature
    });
  }
  return { dayMask: bytes[0], periods };
}

export function nextHeatingSchedulePeriod(periods, now = new Date(), timeZone = "Europe/London") {
  if (!Array.isArray(periods) || periods.length !== 4) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone
  }).formatToParts(now).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const minutesNow = Number(parts.hour) * 60 + Number(parts.minute);
  const sorted = periods.map((period) => ({ ...period, minutes: Number(period.time.slice(0, 2)) * 60 + Number(period.time.slice(3, 5)) }))
    .sort((left, right) => left.minutes - right.minutes);
  return sorted.find((period) => period.minutes > minutesNow) || { ...sorted[0], tomorrow: true };
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

export function todayPreparationPreview(items = [], events = [], people = [], now = new Date(), timeZone = "Europe/London", limit = 3) {
  const childById = new Map(people.filter((person) => person.role === "child").map((person) => [person.id, person]));
  const eventByKey = new Map(events
    .filter((event) => isPreparationWindowEvent(event, 1, now, timeZone))
    .map((event) => [familyPlannerEventKey(event), event]));
  const rows = items.map((item) => {
    const preparation = item?._preparation;
    const event = eventByKey.get(preparation?.eventKey);
    const person = childById.get(preparation?.personId);
    if (!event || !person) return null;
    return {
      item,
      event,
      person,
      completed: String(item.status).toLocaleLowerCase() === "completed"
    };
  }).filter(Boolean).sort((left, right) => {
    const eventOrder = new Date(calendarEventStart(left.event) || 0) - new Date(calendarEventStart(right.event) || 0);
    return eventOrder || Number(left.completed) - Number(right.completed)
      || String(left.item.summary || left.item.item || "").localeCompare(String(right.item.summary || right.item.item || ""));
  });
  return {
    total: rows.length,
    complete: rows.filter((row) => row.completed).length,
    rows: rows.slice(0, Math.max(1, Number(limit) || 3))
  };
}

export function isPreparationWindowEvent(event, lookaheadDays = 7, now = new Date(), timeZone = "Europe/London") {
  if (!isCurrentOrFutureCalendarEvent(event, now, timeZone)) return false;
  const eventDate = dateKey(calendarEventStart(event), timeZone);
  const today = dateKey(now, timeZone);
  const lastVisibleDate = shiftDateKey(today, Math.max(1, Number(lookaheadDays) || 7));
  return Boolean(eventDate && today && lastVisibleDate && eventDate >= today && eventDate <= lastVisibleDate);
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
  if (domain === "todo" && ["add_item", "update_item", "remove_item"].includes(service)) {
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
  const anchor = dateKey(now, timeZone);
  const today = dateKey(new Date(), timeZone);
  const [year, month, day] = anchor.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day, 12);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(base + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      isToday: key === today,
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(date),
      month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date)
    };
  });
}

function shiftDateKey(value, days) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function mondayForDateKey(value) {
  const [year, month, day] = String(value || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  if (Number.isNaN(date.getTime())) return value;
  const weekday = date.getUTCDay() || 7;
  return shiftDateKey(value, 1 - weekday);
}

function monthGridStart(value) {
  const [year, month] = String(value || "").split("-").map(Number);
  if (!year || !month) return value;
  return mondayForDateKey(`${year}-${String(month).padStart(2, "0")}-01`);
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
    status: raw,
    name: state?.attributes?.chore_name || titleCase(fallbackName),
    label,
    tone,
    points: safeNumber(state?.attributes?.default_points, NaN),
    due: state?.attributes?.due_date || state?.attributes?.due_at || null
  };
}

export function choreClaimEntityId(statusEntityId = "") {
  const match = String(statusEntityId).match(/^sensor\.([a-z0-9_]+)_choreops_chore_status_([a-z0-9_]+)$/);
  return match ? `button.${match[1]}_choreops_claim_chore_${match[2]}` : null;
}

export function rewardClaimEntityId(statusEntityId = "") {
  const match = String(statusEntityId).match(/^sensor\.([a-z0-9_]+)_choreops_reward_status_([a-z0-9_]+)$/);
  return match ? `button.${match[1]}_choreops_claim_reward_${match[2]}` : null;
}

function choreIcon(name = "") {
  const value = String(name).toLowerCase();
  if (/teeth|tooth/.test(value)) return "mdi:toothbrush";
  if (/dress|uniform|clothes/.test(value)) return "mdi:tshirt-crew-outline";
  if (/bed|sleep/.test(value)) return "mdi:bed-clock";
  if (/tidy|clean|sweep|vacuum/.test(value)) return "mdi:broom";
  if (/school|homework|read/.test(value)) return "mdi:book-open-page-variant-outline";
  if (/dish|table|kitchen/.test(value)) return "mdi:silverware-clean";
  return "mdi:star-circle-outline";
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
    status,
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

export function selectHomeFootballFixtures(events = [], spotlightTeamCodes = [], limit = 4) {
  const codes = new Set((Array.isArray(spotlightTeamCodes) ? spotlightTeamCodes : [])
    .map((code) => String(code || "").trim().toUpperCase())
    .filter(Boolean));
  const unique = new Map();
  for (const fixture of Array.isArray(events) ? events : []) {
    if (![footballTeamCode(fixture?.home), footballTeamCode(fixture?.away)].some((code) => codes.has(code))) continue;
    const identity = fixtureIdentity(fixture);
    if (identity && !unique.has(identity)) unique.set(identity, fixture);
  }
  const relevant = [...unique.values()];
  const byKickoffAsc = (left, right) => (
    fixtureKickoffValue(left, Number.POSITIVE_INFINITY) - fixtureKickoffValue(right, Number.POSITIVE_INFINITY)
    || compareFixtureIds(left, right)
  );
  const byKickoffDesc = (left, right) => (
    fixtureKickoffValue(right, Number.NEGATIVE_INFINITY) - fixtureKickoffValue(left, Number.NEGATIVE_INFINITY)
    || compareFixtureIds(left, right)
  );
  const live = relevant.filter((fixture) => normaliseFixtureStatus(fixture) === "live").sort(byKickoffAsc);
  const upcoming = relevant.filter((fixture) => normaliseFixtureStatus(fixture) === "upcoming").sort(byKickoffAsc);
  const finished = relevant.filter((fixture) => normaliseFixtureStatus(fixture) === "finished").sort(byKickoffDesc);
  const selected = [];
  const add = (fixture) => {
    if (!fixture || selected.length >= limit || selected.some((entry) => fixtureIdentity(entry) === fixtureIdentity(fixture))) return;
    selected.push(fixture);
  };
  // Select within each club before combining: a busy club must not crowd out
  // the other club's result or next match. A shared derby remains one fixture.
  const current = [...codes].map((code) => (
    live.find((fixture) => fixtureIncludesTeam(fixture, code))
    || finished.find((fixture) => fixtureIncludesTeam(fixture, code))
  )).filter(Boolean);
  for (const fixture of current.filter((entry) => normaliseFixtureStatus(entry) === "live").sort(byKickoffAsc)) add(fixture);
  for (const fixture of current.filter((entry) => normaliseFixtureStatus(entry) === "finished").sort(byKickoffDesc)) add(fixture);
  const next = [...codes].map((code) => upcoming.find((fixture) => fixtureIncludesTeam(fixture, code))).filter(Boolean);
  for (const fixture of next.sort(byKickoffAsc)) add(fixture);
  return selected;
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
  for (const user of config.chores?.users || []) {
    for (const entityId of user.status_entities || []) add(choreClaimEntityId(entityId));
    for (const entityId of user.reward_status_entities || []) add(rewardClaimEntityId(entityId));
  }
  for (let gameweek = 1; gameweek <= 38; gameweek += 1) {
    ids.add(`${config.football.gameweek_entity_prefix}${gameweek}`);
  }
  for (const entry of config.football?.entries || []) ids.add(`sensor.family_dashboard_fpl_${entry.person_id}`);
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
    this._calendarSelectedKey = null;
    this._calendarFocusEvent = null;
    this._dockPlayerId = null;
    this._responsiveStyleFrame = null;
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
    this._devicePhotoAlbum = new DevicePhotoAlbum();
    this._devicePhotoReady = null;
    this._devicePhotoSource = "home-assistant";
    this._devicePhotoRecords = [];
    this._devicePhotoModal = false;
    this._devicePhotoBusy = false;
    this._devicePhotoMessage = "";
    this._devicePhotoUnavailable = false;
    this._devicePhotoUrls = [];
    this._deviceFrameUrl = null;
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
    this._fplEntryId = null;
    this._masterTemperature = 20;
    this._heatingScheduleDrafts = new Map();
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
    this._calendarAnchorKey = null;
    this._calendarLastLoadedAt = 0;
    this._calendarPersonFilter = "all";
    this._plannerModal = null;
    this._familyPersonId = null;
    this._pendingChoreClaims = new Set();
    this._choreClaimFeedback = null;
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
    this._boundInput = (event) => this._handleInput(event);
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
        if (this._view === "calendar") void this._loadCalendarEvents(true);
        this._armFreshnessTimer();
        this._armPhotoFrameIdleTimer();
      }
    };
    this._boundPageHide = () => this._closeActiveCamera({ render: false, invalidate: true });
    this._boundResize = () => {
      this._syncViewportHeight();
      if (this._responsiveStyleFrame !== null) return;
      this._responsiveStyleFrame = requestAnimationFrame(() => {
        this._responsiveStyleFrame = null;
        const style = this.shadowRoot.querySelector("style[data-layout]");
        const key = this._responsiveViewportKey();
        if (!this.isConnected || !style || style.dataset.layout === key) return;
        // Refresh only the stylesheet when Safari retains a previous breakpoint.
        // Child players, control state and keyboard focus keep their identity.
        style.dataset.layout = key;
        style.textContent = this._styles();
      });
    };
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._boundClick);
    this.shadowRoot.addEventListener("change", this._boundChange);
    this.shadowRoot.addEventListener("input", this._boundInput);
    this.shadowRoot.addEventListener("keydown", this._boundKeydown);
    this.shadowRoot.addEventListener("pointerdown", this._boundPointerActivity, { passive: true });
    globalThis.document?.addEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.addEventListener?.("pagehide", this._boundPageHide);
    globalThis.addEventListener?.("resize", this._boundResize, { passive: true });
    globalThis.visualViewport?.addEventListener?.("resize", this._boundResize, { passive: true });
    if (globalThis.ResizeObserver && this.parentElement) {
      this._viewportObserver = new ResizeObserver(() => this._syncViewportHeight());
      this._viewportObserver.observe(this.parentElement);
    }
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
    this.shadowRoot.removeEventListener("input", this._boundInput);
    this.shadowRoot.removeEventListener("keydown", this._boundKeydown);
    this.shadowRoot.removeEventListener("pointerdown", this._boundPointerActivity);
    globalThis.document?.removeEventListener?.("visibilitychange", this._boundVisibilityChange);
    globalThis.removeEventListener?.("pagehide", this._boundPageHide);
    globalThis.removeEventListener?.("resize", this._boundResize);
    globalThis.visualViewport?.removeEventListener?.("resize", this._boundResize);
    this._viewportObserver?.disconnect();
    if (this._responsiveStyleFrame != null) globalThis.cancelAnimationFrame?.(this._responsiveStyleFrame);
    this._responsiveStyleFrame = null;
    this._clearFreshnessTimer();
    this._clearPhotoFrameTimers();
    this._releaseDevicePhotoUrls();
    this._photoFrameActive = false;
    this._photoFrameUrl = null;
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
    if (!config || config.schema_version !== 7) {
      throw new Error("Family Hub requires a schema-v7 family configuration");
    }
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    this._closeActiveCamera({ render: false, invalidate: true });
    this._cameraConfigGeneration = Number.isInteger(this._cameraConfigGeneration)
      ? this._cameraConfigGeneration + 1
      : 1;
    this._config = config;
    this._releaseDevicePhotoUrls();
    this._devicePhotoModal = false;
    this._heatingScheduleDrafts ||= new Map();
    this._heatingScheduleDrafts.clear();
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
    this._calendarAnchorKey = dateKey(new Date(), config.product?.timezone || "Europe/London");
    this._calendarLastLoadedAt = 0;
    this._calendarPersonFilter = "all";
    this._plannerModal = null;
    this._familyPersonId = config.people?.find((person) => person.role === "child")?.id || null;
    this._pendingChoreClaims ||= new Set();
    this._pendingChoreClaims.clear();
    this._choreClaimFeedback = null;
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
    // Appearance can change without any entity state changing. Update the
    // palette in place so a theme switch preserves Music browsing and streams.
    this.shadowRoot?.querySelector?.(".hub-card")?.setAttribute("data-appearance", this._appearance());
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
      else this._refreshMusicDock();
    }
    this._loadCalendarEvents();
    void this._loadPreparationItems();
  }

  _appearance() {
    const preference = this._config?.display?.appearance || "light";
    return preference === "auto" ? this._hass?.themes?.darkMode ? "dark" : "light" : preference;
  }

  _syncViewportHeight() {
    if (!this.isConnected || !this.getBoundingClientRect) return;
    const viewport = globalThis.visualViewport;
    const bottom = viewport ? viewport.height + viewport.offsetTop : globalThis.innerHeight;
    const top = this.getBoundingClientRect().top;
    const height = Math.max(160, Math.floor(bottom - top));
    if (Number.isFinite(height)) this.style.setProperty("--family-viewport-height", `${height}px`);
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
    if (this._devicePhotoBusy || (this._devicePhotoModal || this._photoFrameActive) && !force) return;
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
    if (!photoFrame || this._devicePhotoModal || this._photoFrameActive || !this.isConnected
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
    if (!photoFrame || this._devicePhotoModal || globalThis.document?.visibilityState === "hidden") return;
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
    if (this._deviceFrameUrl) URL.revokeObjectURL(this._deviceFrameUrl);
    this._deviceFrameUrl = null;
    this._photoFrameUrl = null;
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

  async _readyDevicePhotos() {
    if (!this._devicePhotoReady) this._devicePhotoReady = (async () => {
      if (!globalThis.indexedDB) { this._devicePhotoUnavailable = true; return; }
      try {
        this._devicePhotoSource = await this._devicePhotoAlbum.source();
        this._devicePhotoRecords = await this._devicePhotoAlbum.list();
      } catch {
        this._devicePhotoUnavailable = true;
        this._devicePhotoMessage = "Local photo storage is unavailable. Use a normal browser window with website storage enabled.";
      }
    })();
    await this._devicePhotoReady;
  }

  _releaseDevicePhotoUrls() {
    for (const url of this._devicePhotoUrls || []) URL.revokeObjectURL(url);
    this._devicePhotoUrls = [];
    if (this._deviceFrameUrl) URL.revokeObjectURL(this._deviceFrameUrl);
    this._deviceFrameUrl = null;
  }

  async _openDevicePhotos() {
    this._devicePhotoModal = true;
    this._clearPhotoFrameTimers();
    this._scheduleRender(true);
    await this._readyDevicePhotos();
    if (!this._devicePhotoUnavailable) {
      try { this._devicePhotoRecords = await this._devicePhotoAlbum.list(); }
      catch { this._devicePhotoMessage = "Your photos could not be loaded. Try opening Photos again."; }
    }
    if (this._devicePhotoModal && this.isConnected) this._scheduleRender(true);
  }

  _closeDevicePhotos() {
    this._devicePhotoModal = false;
    this._releaseDevicePhotoUrls();
    this._scheduleRender(true);
    this._armPhotoFrameIdleTimer();
    requestAnimationFrame(() => this.shadowRoot.querySelector("[data-device-photos-open]")?.focus());
  }

  async _changeDevicePhotoSource(source) {
    if (this._devicePhotoBusy || !["local", "home-assistant"].includes(source)) return;
    try {
      await this._devicePhotoAlbum.setSource(source);
      this._devicePhotoSource = source;
      this._photoFrameBrowseRequest += 1;
      this._photoFrameResolveRequest += 1;
      this._photoFrameMediaSourceKey = null;
      this._photoFrameLoading = false;
      this._photoFrameItems = [];
      this._photoFrameUrl = null;
      await this._loadPhotoFrameMedia({ refresh:true });
    } catch { this._devicePhotoMessage = "The photo preference could not be saved on this device."; }
    if (this._devicePhotoModal && this.isConnected) this._scheduleRender(true);
  }

  async _importDevicePhotos(files) {
    if (this._devicePhotoBusy || this._devicePhotoUnavailable || !files.length) return;
    this._devicePhotoBusy = true;
    this._devicePhotoMessage = "Preparing photos on this device…";
    // Keep the native file input intact until every selected file is read.
    const modal = this.shadowRoot.querySelector(".device-photos-modal");
    modal?.setAttribute("aria-busy", "true");
    for (const button of modal?.querySelectorAll("button") || []) button.disabled = true;
    const status = modal?.querySelector(".device-photo-message");
    if (status) status.textContent = this._devicePhotoMessage;
    const selected = files.slice(0, PHOTO_FRAME_MEDIA_LIMIT);
    let added = 0, failed = files.length - selected.length;
    let error = failed ? "Choose up to 250 photos at a time." : "";
    try {
      for (const file of selected) {
        try { await this._devicePhotoAlbum.add(file); added++; }
        catch (cause) { failed++; error = cause?.name === "QuotaExceededError" ? "This device has run out of photo storage. Remove some photos and try again." : cause.message; }
      }
      this._devicePhotoRecords = await this._devicePhotoAlbum.list();
    } catch { error = "Photo storage is unavailable. Try again in a normal browser window."; }
    this._devicePhotoBusy = false;
    this._devicePhotoMessage = `${added ? `${added} ${added === 1 ? "photo" : "photos"} added. ` : ""}${failed ? `${failed} could not be added. ` : ""}${error}`.trim();
    if (added) await this._changeDevicePhotoSource("local");
    if (this._devicePhotoModal && this.isConnected) this._scheduleRender(true);
  }

  async _removeDevicePhoto(id) {
    if (this._devicePhotoBusy || !this._devicePhotoRecords.some(record => record.id === id)) return;
    try {
      await this._devicePhotoAlbum.remove(id);
      this._devicePhotoRecords = await this._devicePhotoAlbum.list();
      this._devicePhotoMessage = "Removed from this collection. Your original photo is unchanged.";
      this._photoFrameMediaSourceKey = null;
      await this._loadPhotoFrameMedia({ refresh:true });
    } catch { this._devicePhotoMessage = "This photo could not be removed. Try again."; }
    if (this._devicePhotoModal && this.isConnected) this._scheduleRender(true);
  }

  _renderDevicePhotos() {
    if (!this._devicePhotoModal) return "";
    for (const url of this._devicePhotoUrls) URL.revokeObjectURL(url);
    this._devicePhotoUrls = [];
    const disabled = this._devicePhotoBusy || this._devicePhotoUnavailable || !this._devicePhotoReady ? "disabled" : "";
    return `<div class="planner-modal-backdrop device-photos-backdrop"><section class="planner-modal device-photos-modal" role="dialog" aria-modal="true" aria-labelledby="device-photos-title">
      <header><button type="button" class="planner-modal-close" data-device-photos-close aria-label="Close photos" ${this._devicePhotoBusy ? "disabled" : ""}>×</button><p class="eyebrow">Screensaver · this device</p><h2 id="device-photos-title">Your photo collection</h2><p>Choose photos from Photos or Files. Copies stay in this browser on this device.</p></header>
      <div class="planner-modal-body"><div class="device-photo-source" role="group" aria-label="Screensaver photo source"><button type="button" data-device-photo-source="local" aria-pressed="${this._devicePhotoSource === "local"}" ${disabled}>This device</button><button type="button" data-device-photo-source="home-assistant" aria-pressed="${this._devicePhotoSource !== "local"}" ${disabled}>Home Assistant album</button></div>
      <div class="device-photo-toolbar"><span>${this._devicePhotoRecords.length} ${this._devicePhotoRecords.length === 1 ? "photo" : "photos"} on this device</span><button type="button" data-device-photos-add ${disabled}>+ Add photos</button><input type="file" data-device-photo-files accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/avif,.heic,.heif" multiple hidden></div>
      <p class="device-photo-message" role="status" aria-live="polite">${escapeHtml(this._devicePhotoMessage)}</p>
      ${this._devicePhotoRecords.length ? `<div class="device-photo-grid">${this._devicePhotoRecords.map(record => {
        const url = URL.createObjectURL(record.thumbnail); this._devicePhotoUrls.push(url);
        return `<figure><img src="${escapeHtml(url)}" alt="${escapeHtml(record.name)}"><button type="button" data-device-photo-remove="${escapeHtml(record.id)}" aria-label="Remove ${escapeHtml(record.name)}" ${disabled}>×</button></figure>`;
      }).join("")}</div>` : `<div class="device-photo-empty"><h3>A little more you</h3><p>Add favourite moments to turn this screen into a photo frame when it’s idle.</p></div>`}
      <p class="device-photo-note">Originals stay in your library. Add newly taken photos here when you want them included. Clearing website data can remove these copies.</p></div>
      <footer><button type="button" data-device-photos-close ${this._devicePhotoBusy ? "disabled" : ""}>Done</button><button type="button" data-device-photos-preview ${this._devicePhotoBusy || this._devicePhotoSource === "local" && !this._devicePhotoRecords.length ? "disabled" : ""}>Preview screensaver</button></footer>
    </section></div>`;
  }

  async _loadPhotoFrameMedia({ refresh = false } = {}) {
    const photoFrame = this._photoFrameConfig();
    if (!photoFrame) return;
    await this._readyDevicePhotos();
    if (!this._photoFrameConfig()) return;
    if (this._devicePhotoSource === "local") {
      if (!refresh && this._photoFrameMediaSourceKey === "device-local") return;
      this._photoFrameItems = this._devicePhotoRecords.map(record => ({ local:record }));
      this._photoFrameMediaSourceKey = "device-local";
      this._photoFrameIndex %= Math.max(1, this._photoFrameItems.length);
      this._photoFrameLoading = false;
      this._photoFrameError = this._photoFrameItems.length ? null : "Add photos to this device using Photos in the dashboard header.";
      if (this._photoFrameActive) {
        this._scheduleRender(true);
        if (this._photoFrameItems.length) void this._resolvePhotoFrameItem();
      }
      return;
    }
    if (typeof this._hass?.callWS !== "function") return;
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
    if (!photoFrame || !this._photoFrameActive || !item) return;
    if (item.local && this._devicePhotoSource === "local") {
      if (this._deviceFrameUrl) URL.revokeObjectURL(this._deviceFrameUrl);
      this._deviceFrameUrl = URL.createObjectURL(item.local.blob);
      this._photoFrameUrl = this._deviceFrameUrl;
      this._photoFrameError = null;
      this._syncPhotoFrameMedia();
      this._armPhotoFrameSlideTimer();
      return;
    }
    if (this._devicePhotoSource === "local" || typeof this._hass?.callWS !== "function") return;
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
    if (this._view === "calendar") {
      void this._loadCalendarEvents();
      void this._loadPreparationItems();
      return;
    }
    this._scheduleRender();
  }

  _enabledViews() {
    return VIEW_DEFINITIONS.filter((view) => !view.feature || this._config.features[view.feature]);
  }

  _calendarWindow() {
    const today = dateKey(new Date(), this._config.product.timezone);
    const anchor = this._calendarAnchorKey || today;
    const start = this._calendarMode === "day"
      ? anchor
      : this._calendarMode === "month"
        ? monthGridStart(anchor)
        : mondayForDateKey(anchor);
    const count = this._calendarMode === "day"
      ? 1
      : this._calendarMode === "month"
        ? 42
        : this._calendarMode === "agenda"
          ? Math.max(14, this._config.calendar.rolling_days)
          : 7;
    return calendarWindow(
      this._config.product.locale,
      this._config.product.timezone,
      count,
      new Date(`${start}T12:00:00Z`)
    );
  }

  _calendarRangeLabel() {
    const days = this._calendarWindow();
    if (!days.length) return "";
    const locale = this._config.product.locale;
    const start = new Date(`${days[0].key}T12:00:00Z`);
    const end = new Date(`${days[days.length - 1].key}T12:00:00Z`);
    if (this._calendarMode === "month") {
      const anchor = new Date(`${this._calendarAnchorKey}T12:00:00Z`);
      return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(anchor);
    }
    const startMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(start);
    const endMonth = new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(end);
    const year = new Intl.DateTimeFormat(locale, { year: "numeric", timeZone: "UTC" }).format(end);
    return startMonth === endMonth
      ? `${days[0].day}–${days[days.length - 1].day} ${endMonth} ${year}`
      : `${days[0].day} ${startMonth}–${days[days.length - 1].day} ${endMonth} ${year}`;
  }

  _moveCalendar(direction) {
    const today = dateKey(new Date(), this._config.product.timezone);
    if (direction === "today") {
      this._calendarAnchorKey = today;
    } else if (this._calendarMode === "month") {
      const [year, month] = String(this._calendarAnchorKey || today).split("-").map(Number);
      const offset = direction === "next" ? 1 : -1;
      this._calendarAnchorKey = new Date(Date.UTC(year, month - 1 + offset, 1, 12)).toISOString().slice(0, 10);
    } else {
      const step = this._calendarMode === "day" ? 1 : 7;
      this._calendarAnchorKey = shiftDateKey(this._calendarAnchorKey || today, direction === "next" ? step : -step);
    }
    this._calendarSelectedKey = this._calendarAnchorKey;
    this._calendarFocusEvent = null;
    this._calendarRequestKey = "";
    this._scheduleRender(true);
    void this._loadCalendarEvents(true);
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

  async _loadCalendarEvents(force = false) {
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
    const requestKey = `${days[0]?.key || ""}:${days[days.length - 1]?.key || ""}:${stateVersion}`;
    if (!force && requestKey === this._calendarRequestKey && Date.now() - this._calendarLastLoadedAt < 60_000) return;
    this._calendarRequestKey = requestKey;
    this._calendarLoading = true;
    this._calendarError = null;
    const requestId = ++this._calendarRequest;
    this._scheduleRender();
    const start = `${days[0].key}T00:00:00`;
    const end = `${shiftDateKey(days[days.length - 1].key, 1)}T00:00:00`;
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
      this._calendarLastLoadedAt = Date.now();
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
    if (!this._config || !this.shadowRoot || this._devicePhotoBusy) return;
    const renderFocus = this._captureRenderFocus();
    const scheduleFocus = this._plannerModal?.type === "heating" ? this.shadowRoot.activeElement?.dataset : null;
    const scheduleFocusSelector = scheduleFocus?.scheduleTime !== undefined ? `[data-schedule-time="${scheduleFocus.scheduleTime}"]`
      : scheduleFocus?.scheduleTemperature !== undefined ? `[data-schedule-temperature="${scheduleFocus.scheduleTemperature}"]` : null;
    const embeddedRenderState = this._captureEmbeddedRenderState();
    const confirmationFocusAction = this._pendingConfirmation
      ? this.shadowRoot.activeElement?.dataset?.confirmAction || "cancel"
      : null;
    this._childMountGeneration += 1;
    this._invalidateChildHass();
    const theme = this._config.theme;
    const shellGuard = this._photoFrameActive || this._plannerModal || this._devicePhotoModal ? ' inert aria-hidden="true"' : "";
    this.shadowRoot.innerHTML = `
      <style data-layout="${this._responsiveViewportKey()}">${this._styles()}</style>
      <ha-card class="hub-card" data-appearance="${this._appearance()}" style="
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
        ${this._renderMasthead(shellGuard)}
        <div class="hub-shell"${shellGuard}>
          ${this._renderNavigation()}
          <main class="hub-content">
            ${this._renderHeader()}
            <div class="hub-view" data-current-view="${escapeHtml(this._view)}" tabindex="0" aria-label="${escapeHtml(this._enabledViews().find((entry)=>entry.id===this._view)?.label || "Dashboard")} content">
              ${this._renderView()}
            </div>
          </main>
        </div>
        <div class="focus-dock-shell"${this._pendingConfirmation ? ' inert aria-hidden="true"' : shellGuard}>${this._renderMusicDock()}</div>
        ${this._renderPhotoFrame()}
        ${this._renderDevicePhotos()}
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
    if (this._devicePhotoModal) this.shadowRoot.querySelector(".device-photos-modal button:not([disabled])")?.focus();
    if (this._plannerModal) {
      const modal = this.shadowRoot.querySelector(".planner-modal");
      if (modal && !modal.contains(this.shadowRoot.activeElement)) {
        (scheduleFocusSelector && modal.querySelector(scheduleFocusSelector) || modal.querySelector('[data-planner-field="summary"]') || modal.querySelector("button:not([disabled])"))?.focus();
      }
    } else if (!confirmationFocusHandled) this._restoreRenderFocus(renderFocus);
    if (this._heatingScheduleReturnScope) {
      [...this.shadowRoot.querySelectorAll("[data-heating-schedule-open]")].find((button) => button.dataset.heatingScheduleOpen === this._heatingScheduleReturnScope)?.focus();
      this._heatingScheduleReturnScope = null;
    }
    this._restoreEmbeddedRenderState(embeddedRenderState);
    this._syncViewportHeight();
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
      .filter(([key]) => !["confirmAction", "prepStatus"].includes(key) && (key !== "gameweek" || !gameweekRole)));
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
    const confirmationGuard = this._pendingConfirmation ? ' inert aria-hidden="true"' : "";
    const views = this._enabledViews();
    const order = ["today", "calendar", "rooms", "family", "entry", "energy", "football", "music"];
    return `<nav class="hub-navigation" aria-label="Family Dashboard views"${confirmationGuard}>${order.map(id => views.find(view => view.id === id)).filter(Boolean).map(view => `
      <button class="${view.id === "today" ? "hub-brand" : "hub-nav-button"} ${this._view === view.id ? "is-active" : ""}" type="button" data-view="${view.id}" aria-label="${view.id === "today" ? "Open Today" : escapeHtml(view.label)}" aria-current="${this._view === view.id ? "page" : "false"}">
        ${outlineIcon(view.id)}<span>${escapeHtml(view.label)}</span>
      </button>`).join("")}</nav>`;
  }

  _renderMasthead(shellGuard = "") {
    const date = new Intl.DateTimeFormat(this._config.product.locale, {weekday:"long",day:"numeric",month:"long",timeZone:this._config.product.timezone}).format(new Date());
    const states = this._hass?.states || {};
    const security = this._config.features.entry ? todaySecurityPresentation(states[this._config.entry?.alarm_entity], states[this._config.entry?.garage?.cover_entity], (this._config.entry?.cameras || []).flatMap(camera => [camera.ringing_entity,camera.person_entity,camera.motion_entity]).filter(Boolean).map(id => states[id])) : null;
    const name = this._hass?.user?.name || this._config.people.find(person => person.role !== "child" && person.role !== "household")?.name || "Family";
    const initials = name.split(/\s+/).map(part => part[0]).slice(0,2).join("");
    return `<header class="hub-masthead"${shellGuard}><button type="button" class="hub-masthead-brand" data-view="today">${outlineIcon("rooms")}<span>${escapeHtml(this._config.product.title)}</span></button><div class="hub-masthead-status"><span class="hub-masthead-date">${escapeHtml(date)}</span>${security ? `<button type="button" class="hub-quiet-status" data-view="entry" title="${escapeHtml(security.detail)}">${outlineIcon("entry")}<span>${escapeHtml(["Protected","Quiet at home"].includes(security.title) ? "All quiet" : security.title)}</span></button>` : ""}${this._photoFrameConfig() ? '<button type="button" class="hub-photos-button" data-device-photos-open aria-label="Manage screensaver photos">Photos</button>' : ""}<span class="hub-profile" aria-label="${escapeHtml(name)}">${escapeHtml(initials)}</span>${this._hass?.user?.is_admin && this._config.display.kiosk ? '<a class="hub-ha-escape" href="?disable_km" aria-label="Open Home Assistant navigation" title="Home Assistant">↗</a>' : ""}</div></header>`;
  }

  _renderHeader() {
    const now = new Date();
    const locale = this._config.product.locale;
    const timezone = this._config.product.timezone;
    const date = new Intl.DateTimeFormat(locale, {day:"numeric",month:"long",timeZone:timezone}).format(now);
    const time = new Intl.DateTimeFormat(locale, {hour:"2-digit",minute:"2-digit",timeZone:timezone}).format(now);
    const weekday = new Intl.DateTimeFormat(locale, {weekday:"long",timeZone:timezone}).format(now);
    const weather = this._config.features.weather ? this._hass?.states?.[this._config.weather.entity_id] : null;
    const definition = VIEW_DEFINITIONS.find(view => view.id === this._view) || VIEW_DEFINITIONS[0];
    const subtitles = {rooms:"Your home, room by room.",family:"Jobs, rewards and a little progress.",entry:"Entry cameras and home protection.",energy:"Your home’s usage and cost.",music:"Browse, group and play.",football:"Results, fixtures and your FPL teams."};
    const title = this._view === "today" ? weekday : this._view === "football" ? this._config.football.spotlight_team_codes.map(code => this._clubPresentation(code).label).join(" & ") : definition.label;
    const football = this._view === "football" ? this._footballState() : null;
    const freshness = football ? (!isEntityAvailable(football.gameweekState) && isEntityAvailable(football.index) ? {status:"waiting",title:"Waiting for fixtures",detail:"The selected matchweek has not arrived yet."} : footballFreshness(football.index)) : null;
    const guard = this._pendingConfirmation ? ' inert aria-hidden="true"' : "";
    return `<header class="hub-topbar ${this._view === "calendar" ? "is-calendar-header" : ""}"${guard}><div class="hub-page-title"><h1>${escapeHtml(title)}</h1><p class="hub-topbar-date">${escapeHtml(this._view === "today" ? `${date} · ${time}` : subtitles[this._view] || date)}</p></div><div class="hub-header-actions">${freshness ? `<span class="football-freshness is-${escapeHtml(freshness.status)}" title="${escapeHtml(freshness.detail)}"><strong>${escapeHtml(freshness.title)}</strong></span>` : ""}${weather && this._view === "today" ? `<button class="hub-weather-pill" type="button" data-more-info="${escapeHtml(this._config.weather.entity_id)}" aria-label="${escapeHtml(weatherStateLabel(weather.state))}, ${formatTemperature(weather.attributes?.temperature)}"><ha-icon icon="mdi:weather-partly-cloudy"></ha-icon><span>${formatTemperature(weather.attributes?.temperature)}</span></button>` : ""}</div></header>`;
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

  _renderFocusChecklist(event, { compact = false, personId = "" } = {}) {
    const eventKey = familyPlannerEventKey(event);
    const items = this._preparationItems.filter((item) => item?._preparation?.eventKey === eventKey && (!personId || item._preparation.personId === personId));
    if (!items.length) return "";
    const progress = preparationProgress(items,eventKey);
    const shown = compact ? items.slice(0, 3) : items;
    return `<div class="focus-checklist ${compact ? "is-compact":""}">${shown.map((item) => {const done=String(item.status).toLowerCase()==="completed";const id=item.uid || item.id || item.summary;const person=this._config.people.find((person)=>person.id===item._preparation.personId);return `<button type="button" class="focus-ready-item ${done ? "is-complete":""}" data-prep-item="${escapeHtml(id)}" data-prep-status="${done ? "needs_action":"completed"}" aria-pressed="${done}" ${this._config.display.read_only ? "disabled":""}><ha-icon icon="${done ? "mdi:checkbox-marked":"mdi:checkbox-blank-outline"}"></ha-icon><span>${escapeHtml(item.summary || item.item || "Ready item")}</span>${person && !personId ? `<small class="focus-ready-person">${escapeHtml(person.name)}</small>` : ""}</button>`}).join("")}</div><p class="focus-ready-count">${progress.complete} of ${progress.total} ready${shown.length < items.length ? ` · ${items.length - shown.length} more in the plan` : ""}</p>`;
  }

  _refreshMusicDock() {
    const shell = this.shadowRoot?.querySelector(".focus-dock-shell");
    if (!shell) return;
    const active = this.shadowRoot.activeElement;
    const focus = this._captureRenderFocus();
    const volume = active?.matches?.("[data-dock-volume]")
      ? { entity: active.dataset.dockVolume, value: active.value } : null;
    shell.innerHTML = this._renderMusicDock();
    if (volume) {
      const input = [...shell.querySelectorAll("[data-dock-volume]")].find((node) => node.dataset.dockVolume === volume.entity);
      if (input) { input.value = volume.value; input.focus({ preventScroll: true }); }
    } else this._restoreRenderFocus(focus);
  }

  _renderMusicDock() {
    if (!this._config.features.music) return "";
    const players=this._config.media.players;
    const playing=firstPlayingPlayer(this._config,this._hass?.states || {});
    const player=players.find((entry)=>entry.entity_id===this._dockPlayerId) || playing?.player || players[0];
    if (!player) return "";
    const state=this._hass?.states?.[player.entity_id];
    const available=isEntityAvailable(state);
    const features=Number(state?.attributes?.supported_features || 0);
    const locked=this._config.display.read_only || !available;
    const mediaButton=(service,icon,label,capability=0)=>`<button type="button" class="focus-dock-action" data-media-service="${service}" data-entity="${escapeHtml(player.entity_id)}" aria-label="${label}" ${locked || (capability && !(features & capability)) ? "disabled":""}><ha-icon icon="${icon}"></ha-icon></button>`;
    return `<footer class="focus-music-dock today-music" aria-label="Music playback"><div class="artwork">${state?.attributes?.entity_picture ? `<img src="${escapeHtml(state.attributes.entity_picture)}" alt="Album artwork">`:'<ha-icon icon="mdi:music-note"></ha-icon>'}</div><button type="button" class="focus-dock-track" data-view="music"><strong>${escapeHtml(available ? state.attributes?.media_title || "Choose something to play":"Player unavailable")}</strong><small>${escapeHtml(available ? state.attributes?.media_artist || player.name:player.name)}</small></button><div class="focus-dock-playback">${mediaButton("media_previous_track","mdi:skip-previous","Previous track",16)}<button type="button" class="focus-dock-action is-play" data-media-toggle="${escapeHtml(player.entity_id)}" aria-label="${state?.state === "playing" ? "Pause music":"Play music"}" ${locked || (state?.state === "playing" ? !(features & 1):!(features & 16384)) ? "disabled":""}><ha-icon icon="${state?.state === "playing" ? "mdi:pause":"mdi:play"}"></ha-icon></button>${mediaButton("media_next_track","mdi:skip-next","Next track",32)}</div><label class="focus-dock-output"><ha-icon icon="mdi:speaker"></ha-icon><select data-dock-player aria-label="Music output room">${players.map((entry)=>`<option value="${escapeHtml(entry.entity_id)}" ${entry.entity_id===player.entity_id ? "selected":""}>${escapeHtml(entry.name)}</option>`).join("")}</select></label><input class="focus-dock-volume" type="range" min="0" max="100" value="${Math.round(safeNumber(state?.attributes?.volume_level,0)*100)}" data-dock-volume="${escapeHtml(player.entity_id)}" aria-label="${escapeHtml(player.name)} volume" ${locked || !(features & 4) ? "disabled":""}></footer>`;
  }

  _focusCalendarDay() {
    const days=this._calendarWindow();
    const selected=this._calendarSelectedKey || this._calendarAnchorKey || dateKey(new Date(),this._config.product.timezone);
    return days.find((day)=>day.key===selected) || days[0];
  }

  _renderFocusCalendarPlan() {
    const day = this._focusCalendarDay();
    if (!day) return "";
    const events = this._filteredCalendarEvents().filter(event => dateKey(calendarEventStart(event), this._config.product.timezone) === day.key);
    const selected = events.find(event => familyPlannerEventKey(event) === this._calendarFocusEvent) || events.find(event => isCurrentOrFutureCalendarEvent(event,new Date(),this._config.product.timezone)) || events[0];
    return `<div class="focus-calendar-layout"><section class="focus-calendar-agenda"><header><h2>${escapeHtml(formatDay(`${day.key}T12:00:00`,this._config.product.locale,this._config.product.timezone))}</h2><small>${events.length} plan${events.length === 1 ? "" : "s"}</small></header>${events.map(event => {
      const key = familyPlannerEventKey(event), progress = preparationProgress(this._preparationItems,key);
      const people = familyPlannerPeople(event,this._config.people).filter(person => person.role !== "household");
      const person = people[0], colour = person?.colour || event._calendar?.colour || this._config.theme.accent;
      const personLabel = people.map(person => person.name).join(" · ") || "Everyone";
      const start = isAllDayCalendarEvent(event) ? "All day" : formatTime(calendarEventStart(event),this._config.product.locale,this._config.product.timezone);
      const end = !isAllDayCalendarEvent(event) && calendarEventEnd(event) ? formatTime(calendarEventEnd(event),this._config.product.locale,this._config.product.timezone) : "";
      return `<div class="focus-agenda-row"><div class="focus-agenda-time"><span>${escapeHtml(start)}</span><small>${escapeHtml(end)}</small></div><button type="button" class="family-planner-event focus-agenda-event ${selected === event ? "is-selected" : ""}" data-calendar-focus="${escapeHtml(key)}" aria-label="Show ${escapeHtml(event.summary || "event")} checklist" aria-pressed="${selected === event}" style="--calendar-colour:${escapeHtml(colour)}"><span class="focus-event-token">${outlineIcon("calendar")}</span><span class="focus-event-copy"><strong>${escapeHtml(event.summary || "Family event")}</strong><small>${escapeHtml(personLabel)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</small>${progress.total ? `<span class="planner-ready-state"><ha-icon icon="mdi:bag-personal-outline"></ha-icon>${progress.complete}/${progress.total} ready</span>` : ""}</span><ha-icon class="focus-event-chevron" icon="mdi:chevron-right"></ha-icon></button></div>`;
    }).join("") || '<p class="family-planner-empty">A little breathing room. Add a plan when you need one.</p>'}</section>${selected ? this._renderFocusPreparation(selected) : ""}</div>`;
  }

  _renderFocusPreparation(event) {
    const key = familyPlannerEventKey(event);
    const children = familyPlannerPeople(event, this._config.people).filter((person) => person.role === "child");
    const suggestion = matchPreparationTemplate(event, this._config.calendar.preparation?.templates || []);
    let checklist = this._renderFocusChecklist(event);
    if (!checklist && suggestion && children.length && !this._config.display.read_only) {
      checklist = `<p class="supporting">${escapeHtml(suggestion.label)}</p>${children.map((person) => `
        <button type="button" class="focus-add-template" data-add-preparation="${escapeHtml(key)}"
          data-preparation-template="${escapeHtml(suggestion.id)}" data-preparation-person="${escapeHtml(person.id)}">
          Add for ${escapeHtml(person.name)}
        </button>`).join("")}`;
    }
    const day = formatDay(calendarEventStart(event), this._config.product.locale, this._config.product.timezone);
    const time = isAllDayCalendarEvent(event) ? "All day" : formatTime(calendarEventStart(event), this._config.product.locale, this._config.product.timezone);
    return `<aside class="focus-event-ready">
      <header class="focus-prep-heading"><span class="focus-prep-icon"><ha-icon icon="mdi:bag-personal-outline"></ha-icon></span>
      <p class="eyebrow">Get ready</p>
      <h2>${escapeHtml(event.summary || "Your next plan")}</h2>
      <p class="supporting">${escapeHtml(day)} · ${escapeHtml(time)}${event.location ? ` · ${escapeHtml(event.location)}` : ""}</p></header>
      <div class="focus-prep-body">
      ${checklist || '<p class="planner-no-prep">No checklist linked yet.</p>'}
      </div>${children.length && !this._config.display.read_only ? `<p class="focus-prep-note">Also in ${escapeHtml(children[0].name)}’s task list.</p><div class="focus-prep-add"><input data-focus-prep-input="${escapeHtml(key)}" placeholder="Add an item" aria-label="Add a preparation item"><button type="button" data-focus-add-prep="${escapeHtml(key)}" data-preparation-person="${escapeHtml(children[0].id)}" aria-label="Add checklist item"><ha-icon icon="mdi:plus"></ha-icon></button></div>` : ""}
      <div class="focus-prep-links">
        <button type="button" data-planner-event="${escapeHtml(key)}" aria-label="Event details" title="Event details"><span class="prep-link-label">Event details</span> <ha-icon icon="mdi:arrow-top-right"></ha-icon></button>
        ${this._config.features.family && children.length ? `<button type="button" data-focus-tasks="${escapeHtml(children[0].id)}" data-task-target="ready" aria-label="Open Tasks" title="Open Tasks"><span class="prep-link-label">Tasks</span> <ha-icon icon="mdi:arrow-right"></ha-icon></button>` : ""}
      </div>
    </aside>`;
  }

  _renderToday() {
    const states = this._hass?.states || {};
    const features = this._config.features;
    const home = features.rooms ? homeSummaryPresentation(this._config, states) : null;
    const room = features.rooms ? this._config.rooms.find((entry) => entry.id === this._config.home?.default_room) || this._config.rooms[0] : null;
    const summary = room ? deriveRoomState(room, states, this._config.theme.accent) : null;
    const next = features.calendar ? (this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents()).filter((event) => isCurrentOrFutureCalendarEvent(event, new Date(), this._config.product.timezone)).sort((a,b) => new Date(calendarEventStart(a))-new Date(calendarEventStart(b)))[0] : null;
    const football = features.football ? this._featuredFixtures() : null;
    const readOnly = this._config.display.read_only;
    const availableLights = (room?.lights || []).filter((id) => isEntityAvailable(states[id]));
    const lighting = homeLightingCompactPresentation(home || {});
    const heating = homeHeatingCompactPresentation(home || {});
    const energy = features.energy ? energyCompactPresentation(this._energyPresentation()) : null;
    const security = features.entry ? todaySecurityPresentation(states[this._config.entry?.alarm_entity], states[this._config.entry?.garage?.cover_entity], (this._config.entry?.cameras || []).flatMap((camera) => [camera.ringing_entity,camera.person_entity,camera.motion_entity]).filter(Boolean).map((id) => states[id])) : null;
    const preview = features.family && features.calendar ? todayPreparationPreview(this._preparationItems.filter((item) => !next || item?._preparation?.eventKey !== familyPlannerEventKey(next)),this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents(),this._config.people,new Date(),this._config.product.timezone,2) : {total:0,complete:0,rows:[]};
    return `<section class="today-grid focus-today" data-calendar="${features.calendar}" data-secondary-count="${[features.family, features.football, features.music].filter(Boolean).length}" aria-label="Today at a glance">
      ${room ? `<article class="surface hero-panel today-hero focus-home-card"><div class="daily-home-art" aria-hidden="true"><img src="${HOME_ILLUSTRATION}" alt="" decoding="async"></div><div class="today-hero-copy"><h2>${escapeHtml(room.name)}</h2><p>${Number.isFinite(summary.temperature) ? `${escapeHtml(room.name)} · ${formatTemperature(summary.temperature)}` : "Your home controls"}</p></div><button type="button" class="focus-home-open" data-focus-home-room="${escapeHtml(room.id)}" aria-label="Open ${escapeHtml(room.name)} controls"><ha-icon icon="mdi:arrow-top-right"></ha-icon></button><div class="focus-home-controls"><button type="button" data-room-lights="${escapeHtml(room.id)}" data-light-service="${summary.lightsOn ? "turn_off":"turn_on"}" aria-label="Turn ${escapeHtml(room.name)} lights ${summary.lightsOn ? "off":"on"}" aria-pressed="${Boolean(summary.lightsOn)}" ${readOnly || !availableLights.length ? "disabled" : ""}><ha-icon icon="mdi:lamp-outline"></ha-icon><span><strong>${availableLights.length ? summary.lightsOn ? "Lights on":"Lights off" : "Lighting unavailable"}</strong><small>${escapeHtml(room.name)}</small></span></button><button type="button" ${room.climate ? `data-focus-home-room="${escapeHtml(room.id)}" data-room-section-target="comfort"` : 'data-home-target="heating"'}><ha-icon icon="mdi:thermometer"></ha-icon><span><strong>${Number.isFinite(summary.targetTemperature) ? formatTemperature(summary.targetTemperature):Number.isFinite(home?.averageTemperature) ? formatTemperature(home.averageTemperature):"View heating"}</strong><small>${room.climate ? "Heating target" : "Home temperature"} <ha-icon icon="mdi:chevron-right"></ha-icon></small></span></button></div></article>` : `<article class="focus-hello"><h2>${escapeHtml(greetingForTime(new Date(),this._config.product.timezone))}</h2><p>Your family’s day, together.</p></article>`}
      <div class="focus-today-plan">${this._preparationError ? `<p class="calendar-warning" role="alert">${escapeHtml(this._preparationError)}</p>` : ""}${features.calendar ? `<article class="next-panel today-next"><p class="eyebrow">${next ? `Next, ${isAllDayCalendarEvent(next) ? "all day" : `at ${escapeHtml(formatTime(calendarEventStart(next),this._config.product.locale,this._config.product.timezone))}`}` : "Coming up"}</p><h2>${escapeHtml(next?.summary || "No plans yet")}</h2><p class="supporting">${next ? `${escapeHtml(familyPlannerPeople(next,this._config.people).filter(person => person.role !== "household").map(person => person.name).join(", ") || "Everyone")}${next.location ? ` · ${escapeHtml(next.location)}` : ""}` : "The next family event will appear here."}</p>${next ? this._renderFocusChecklist(next, { compact:true }) : ""}<button type="button" class="text-action" ${next ? `data-focus-open-plan="${escapeHtml(familyPlannerEventKey(next))}"`:'data-view="calendar"'}>See the plan <ha-icon icon="mdi:arrow-right"></ha-icon></button></article>`:""}${features.family ? `<article class="children-panel today-family"><div class="section-heading"><h2>A little left to do</h2><button type="button" data-view="family">Tasks <ha-icon icon="mdi:arrow-top-right"></ha-icon></button></div><div class="today-job-list">${this._renderTodayJobs()}</div>${this._renderTodayTaskPreview(preview)}</article>`:""}</div>
      ${football ? `<article class="football-panel today-football" data-fixture-count="${football.fixtureCount || 0}"><div class="section-heading"><h2>This week in football</h2><button type="button" data-view="football">All football <ha-icon icon="mdi:arrow-top-right"></ha-icon></button></div><div class="featured-fixtures">${football.html}</div></article>`:""}
      ${home || security || energy ? `<footer class="hero-metrics focus-home-summary">${home ? `<button type="button" data-home-target="heating"><ha-icon icon="mdi:home-thermometer-outline"></ha-icon><span><strong>${escapeHtml(`${heating.value} · ${heating.detail}`)}</strong><small>${escapeHtml(heating.detail)}</small></span></button><button type="button" data-home-target="lights"><ha-icon icon="mdi:lightbulb-group-outline"></ha-icon><span><strong>${escapeHtml(`${lighting.value} · ${lighting.detail}`)}</strong><small>${escapeHtml(lighting.detail)}</small></span></button>`:""}${security ? `<button type="button" data-view="entry"><ha-icon icon="${security.icon}"></ha-icon><span><strong>${escapeHtml(security.title)}</strong><small>${escapeHtml(security.detail)}</small></span></button>`:""}${energy ? `<button type="button" data-view="energy"><ha-icon icon="${ICONS.energy}"></ha-icon><span><strong>${escapeHtml(energy.value)}</strong><small>${escapeHtml(energy.detail)}</small></span></button>`:""}</footer>` : ""}
    </section>`;
  }

  _renderTodayJobs() {
    const states = this._hass?.states || {};
    return this._config.people.filter(person => person.role === "child").map(person => {
      const user = this._config.features.chores ? this._config.chores.users.find(user => user.person_id === person.id) : null;
      const job = (user?.status_entities || []).map(entity => ({entity,presentation:normaliseChoreStatus(states[entity],entity)})).find(job => job.presentation.tone !== "done");
      const claim = job ? choreClaimEntityId(job.entity) : "";
      const available = job && ["pending","due","overdue","missed"].includes(job.presentation.status) && isCommandEntityAvailable(states[claim]) && !this._config.display.read_only && !this._pendingChoreClaims.has(claim);
      return `<div class="today-job" style="--person-colour:${escapeHtml(person.colour)}"><span class="today-person-token">${escapeHtml(person.name.slice(0,1))}</span><div><strong>${escapeHtml(person.name)} · ${escapeHtml(job?.presentation.name || "Your tasks")}</strong><small>${job ? `${Number.isFinite(job.presentation.points) ? `${job.presentation.points} points · ` : ""}${escapeHtml(job.presentation.label)}` : "See jobs and rewards"}</small></div><button type="button" class="today-job-action" ${available ? `data-chore-claim="${escapeHtml(claim)}" data-chore-status="${escapeHtml(job.entity)}" data-person-id="${escapeHtml(person.id)}" aria-label="Mark ${escapeHtml(job.presentation.name)} as done for ${escapeHtml(person.name)}"` : `data-focus-tasks="${escapeHtml(person.id)}" aria-label="Open ${escapeHtml(person.name)} tasks"`}><ha-icon icon="${available ? "mdi:circle-outline" : "mdi:arrow-top-right"}"></ha-icon></button></div>`;
    }).join("");
  }

  _renderTodayTaskPreview(preview) {
    if (!preview?.total) return "";
    const remaining = preview.total - preview.complete;
    const today = dateKey(new Date(), this._config.product.timezone);
    const tomorrow = shiftDateKey(today, 1);
    const rows = preview.rows.map(({ item, event, person, completed }) => {
      const itemId = item.uid || item.id || item.summary;
      const eventDay = dateKey(calendarEventStart(event), this._config.product.timezone);
      const dayLabel = eventDay === today ? "Today" : eventDay === tomorrow ? "Tomorrow" : formatDay(calendarEventStart(event), this._config.product.locale, this._config.product.timezone);
      const timeLabel = isAllDayCalendarEvent(event) ? "All day" : formatTime(calendarEventStart(event), this._config.product.locale, this._config.product.timezone);
      return `<button type="button" class="today-ready-item ${completed ? "is-complete" : ""}" data-prep-item="${escapeHtml(itemId)}" data-prep-status="${completed ? "needs_action" : "completed"}" style="--person-colour:${escapeHtml(person.colour)}" aria-label="${completed ? "Mark not ready" : "Mark ready"}: ${escapeHtml(item.summary || item.item || "Preparation item")}"><span><ha-icon icon="${completed ? "mdi:check" : "mdi:circle-outline"}"></ha-icon></span><div><strong>${escapeHtml(item.summary || item.item || "Preparation item")}</strong><small>${escapeHtml(`${person.name} · ${event.summary || "Upcoming event"} · ${dayLabel} ${timeLabel}`)}</small></div></button>`;
    }).join("");
    const overflow = Math.max(0, preview.total - preview.rows.length);
    return `<details class="today-ready-preview" aria-label="Ready for upcoming events"><summary class="today-ready-heading"><span><strong>Ready next</strong><small>${remaining ? `${remaining} still to do` : "Everything packed"}</small></span><b>${preview.complete}/${preview.total}</b></summary><div class="today-ready-list">${rows}</div>${overflow ? `<button type="button" class="today-ready-more" data-view="family">${overflow} more in Tasks <ha-icon icon="mdi:arrow-right"></ha-icon></button>` : ""}</details>`;
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
        <div class="energy-history-grid">
          <article class="surface energy-history-card"><div><p class="eyebrow">Last 24 hours</p><h2>Electricity trend</h2></div><div id="energy-history-electricity" class="child-card-slot energy-history-slot"></div></article>
          <article class="surface energy-history-card"><div><p class="eyebrow">Last 24 hours</p><h2>Gas trend</h2></div><div id="energy-history-gas" class="child-card-slot energy-history-slot"></div></article>
        </div>
        <article class="surface energy-truth-note">
          <ha-icon icon="mdi:information-outline" aria-hidden="true"></ha-icon>
          <div><strong>Smart-meter totals, not live power</strong><span>From Home Assistant’s DCC readings. Meter updates can be delayed; your supplier account is not connected.</span></div>
        </article>
      </section>
    `;
  }

  _renderChildSummaries() {
    const states = this._hass?.states || {};
    const choresEnabled = this._config.features.chores === true;
    const schoolEnabled = this._config.features.school === true;
    const schoolSource = schoolDataSource(this._config);
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
      const classroom = schoolEnabled && schoolSource === "classroom"
        ? this._config.school.classroom_students.find((entry) => entry.person_id === person.id)
        : null;
      const classroomState = classroom ? states[classroom.assignments_entity] : null;
      const classroomData = classroomAssignmentPresentation(classroomState);
      const assignmentCount = classroomData.available ? classroomData.count : NaN;
      const schoolEvent = schoolEnabled && schoolSource === "calendar"
        ? this._nextSchoolCalendarEvent(person.id)
        : null;
      const detail = choresEnabled
        ? !chore
          ? "ChoreOps not connected"
          : !choreStateAvailable || !pointsStateAvailable
            ? "ChoreOps unavailable"
            : hasUnavailableChore
              ? `${due} due · Job status incomplete`
              : `${due} due · ${nextChoreName}`
        : schoolEnabled
          ? schoolSource === "calendar"
            ? schoolEvent
              ? `${schoolEvent.summary || schoolEvent._calendar?.label || "School event"} · ${formatClassroomDueDay(calendarEventStart(schoolEvent), this._config.product.locale, this._config.product.timezone)}`
              : "No upcoming school dates"
            : Number.isFinite(assignmentCount)
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
    const modeButtons = modes.map((mode) => `<button type="button" class="segment ${mode.id === this._calendarMode ? "is-selected" : ""}" data-calendar-mode="${mode.id}" aria-pressed="${mode.id === this._calendarMode}">${mode.label}</button>`).join("");
    const canCreate = !this._config.display.read_only
      && this._config.calendar.entities.some((entry) => entry.allow_create === true);
    const personFilters = [
      { id: "all", name: "Everyone", colour: this._config.theme.accent },
      ...this._config.people.filter((person) => person.role !== "household")
    ].map((person) => `<button type="button" class="calendar-person-filter ${this._calendarPersonFilter === person.id ? "is-selected" : ""}" data-calendar-person="${escapeHtml(person.id)}" style="--person-colour:${escapeHtml(person.colour)}" aria-pressed="${this._calendarPersonFilter === person.id}"><span aria-hidden="true"></span>${escapeHtml(person.name)}</button>`).join("");
    return `
      <section class="single-surface surface calendar-view" data-planner-mode="${this._calendarMode}">
        <div class="calendar-toolbar">
          <div class="calendar-context"><span><h2 class="focus-calendar-title">${escapeHtml(new Intl.DateTimeFormat(this._config.product.locale,{month:"long",year:"numeric",timeZone:"UTC"}).format(new Date(`${this._calendarAnchorKey || dateKey(new Date(),this._config.product.timezone)}T12:00:00Z`)))}</h2><strong>Family calendar</strong></span></div>
          <div class="calendar-toolbar-actions">${canCreate ? '<button type="button" class="calendar-add-event" data-planner-add-event><ha-icon icon="mdi:plus"></ha-icon>Add event</button>' : ""}</div>
        </div>
        <div class="calendar-controls"><div class="segments calendar-modes" role="group" aria-label="Choose calendar view">${modeButtons}</div><div class="calendar-navigation">
          <button type="button" data-calendar-nav="previous" aria-label="Previous period"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
          <button type="button" data-calendar-nav="today">Today</button>
          <strong data-calendar-range>${escapeHtml(this._calendarRangeLabel())}</strong>
          <button type="button" data-calendar-refresh aria-label="Refresh calendars"><ha-icon icon="mdi:refresh"></ha-icon></button>
          <button type="button" data-calendar-nav="next" aria-label="Next period"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
        </div></div>
        <div class="calendar-person-filters" role="group" aria-label="Filter by family member">${personFilters}</div>
        ${this._preparationError ? `<p class="calendar-warning" role="alert">${escapeHtml(this._preparationError)}</p>` : ""}
        <div class="family-planner-slot">${this._calendarMode === "month"
          ? this._renderPlannerMonth()
          : this._calendarMode === "agenda"
            ? this._renderPlannerAgenda()
            : this._renderFamilyPlanner()}</div>
      </section>
    `;
  }

  _filteredCalendarEvents() {
    const source = this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents();
    return this._calendarPersonFilter === "all"
      ? source
      : source.filter((event) => event?._calendar?.person_ids?.includes(this._calendarPersonFilter));
  }

  _renderPlannerEventButton(event, compact = false) {
    const calendar = event._calendar || this._config.calendar.entities[0];
    const people = familyPlannerPeople(event, this._config.people).filter((person) => person.role !== "household");
    const progress = preparationProgress(this._preparationItems, familyPlannerEventKey(event));
    const personLabel = calendar.category === "family" ? calendar.label : people.map((person) => person.name).join(" · ") || calendar.label;
    return `<button type="button" class="family-planner-event ${compact ? "is-compact" : ""} ${progress.ready ? "is-ready" : ""}" data-planner-event="${escapeHtml(familyPlannerEventKey(event))}" style="--calendar-colour:${escapeHtml(calendar.colour)}">
      <span class="planner-event-time">${isAllDayCalendarEvent(event) ? "All day" : escapeHtml(formatTime(calendarEventStart(event), this._config.product.locale, this._config.product.timezone))}</span>
      <strong>${escapeHtml(event.summary || calendar.label)}</strong>
      ${compact ? "" : `<small>${escapeHtml(personLabel)}</small>`}
      ${progress.total ? `<span class="planner-ready-state"><ha-icon icon="${progress.ready ? "mdi:check-circle" : "mdi:bag-personal-outline"}"></ha-icon>${progress.ready ? "Ready" : `${progress.complete}/${progress.total}`}</span>` : ""}
    </button>`;
  }

  _plannerEventByKey(eventKey) {
    const events = this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents();
    return events.find((event) => familyPlannerEventKey(event) === eventKey) || null;
  }

  _renderFamilyPlanner() {
    const days=this._calendarWindow().slice(0,this._calendarMode==="day" ? 1:7);
    const selected=this._focusCalendarDay();
    const events=this._filteredCalendarEvents();
    return `${this._calendarLoading || this._preparationLoading ? '<div class="calendar-loading"><span></span>Refreshing the family planner…</div>':""}${this._calendarError ? `<p class="calendar-warning">${escapeHtml(this._calendarError)}</p>`:""}${this._preparationError ? `<p class="calendar-warning preparation-warning">${escapeHtml(this._preparationError)}</p>`:""}<div class="family-planner-grid focus-week-picker ${this._calendarMode==="day" ? "is-day":""}">${days.map((day)=>{const list=events.filter((event)=>dateKey(calendarEventStart(event),this._config.product.timezone)===day.key);return `<button type="button" class="family-planner-day ${day.isToday ? "is-today":""} ${day.key===selected?.key ? "is-selected":""}" data-calendar-day="${day.key}" aria-label="${escapeHtml(`${day.weekday} ${day.day} ${day.month}, ${list.length} events`)}" aria-pressed="${day.key===selected?.key}"><header><span>${escapeHtml(day.weekday)}</span><strong>${escapeHtml(day.day)}</strong><small>${escapeHtml(day.month)}</small></header><span class="focus-calendar-dots">${list.slice(0,4).map((event)=>`<i style="--calendar-colour:${escapeHtml(event._calendar?.colour || this._config.theme.accent)}"></i>`).join("")}</span><span class="focus-week-hint">${escapeHtml(list[0]?.summary || "—")}${list[0] ? `<small>${isAllDayCalendarEvent(list[0]) ? "All day":escapeHtml(formatTime(calendarEventStart(list[0]),this._config.product.locale,this._config.product.timezone))}${list.length>1 ? ` · +${list.length-1}`:""}</small>`:""}</span></button>`}).join("")}</div>${this._renderFocusCalendarPlan()}`;
  }

  _renderPlannerMonth() {
    const days = this._calendarWindow();
    const events = this._filteredCalendarEvents();
    const anchorMonth = String(this._calendarAnchorKey || "").slice(0, 7);
    const headings = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      .map((day) => `<span>${day}</span>`).join("");
    const cells = days.map((day) => {
      const dayEvents = events.filter((event) => dateKey(calendarEventStart(event), this._config.product.timezone) === day.key);
      return `<section class="planner-month-day ${day.isToday ? "is-today" : ""} ${day.key.slice(0, 7) !== anchorMonth ? "is-outside" : ""}">
        <header><button type="button" class="planner-date-select" data-calendar-day="${day.key}" aria-label="Select ${escapeHtml(`${day.day} ${day.month}`)}" aria-pressed="${this._focusCalendarDay()?.key===day.key}"><strong>${escapeHtml(day.day)}</strong></button></header>
        <div>${dayEvents.slice(0, 2).map((event) => this._renderPlannerEventButton(event, true)).join("")}${dayEvents.length > 2 ? `<span class="planner-month-more">+${dayEvents.length - 2} more</span>` : ""}</div>
      </section>`;
    }).join("");
    return `${this._calendarLoading ? '<div class="calendar-loading"><span></span>Refreshing month…</div>' : ""}<div class="planner-month-headings">${headings}</div><div class="planner-month-grid">${cells}</div>${this._renderFocusCalendarPlan()}`;
  }

  _renderPlannerAgenda() {
    const days = this._calendarWindow();
    const events = this._filteredCalendarEvents();
    const rows = days.map((day) => {
      const dayEvents = events.filter((event) => dateKey(calendarEventStart(event), this._config.product.timezone) === day.key);
      if (!dayEvents.length) return "";
      return `<section class="planner-agenda-day ${day.isToday ? "is-today" : ""}"><header><strong>${escapeHtml(day.weekday)} ${escapeHtml(day.day)} ${escapeHtml(day.month)}</strong></header><div>${dayEvents.map((event) => this._renderPlannerEventButton(event)).join("")}</div></section>`;
    }).join("");
    return `${this._calendarLoading ? '<div class="calendar-loading"><span></span>Refreshing agenda…</div>' : ""}<div class="planner-agenda-list">${rows || '<p class="family-planner-empty">Nothing planned in this period</p>'}</div>`;
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
        ${this._calendarError ? '<p class="calendar-warning">Calendar events are temporarily unavailable.</p>' : ""}
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
    const exteriorLights = new Set(this._config.home?.exterior_lights || []);
    const internalLights = this._config.rooms.flatMap((room) => room.lights).filter((entityId) => !exteriorLights.has(entityId));
    const internalOn = internalLights.filter((entityId) => states[entityId]?.state === "on").length;
    const internalDimmable = internalLights.filter((entityId) => {
      const state = states[entityId];
      return lightSupportsBrightness(state, entityName(state, titleCase(entityId.split(".")[1])));
    }).length;
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
        const brightnessPercent = Number.isFinite(reportedBrightness) ? Math.max(1, Math.min(100, Math.round(reportedBrightness / 2.55))) : 100;
        const dimmable = lightSupportsBrightness(state, name);
        const brightness = isOn ? dimmable ? `${brightnessPercent}% brightness` : "On" : titleCase(state?.state || "unavailable");
        const unavailable = readOnly || !available ? ' disabled aria-disabled="true"' : "";
        const actionLabel = available ? `Turn ${name} ${isOn ? "off" : "on"}` : `${name} unavailable`;
        const dimmer = dimmable ? `<label class="light-dimmer ${isOn ? "is-on" : ""}" style="--light-level:${brightnessPercent}%"><span class="sr-only">${escapeHtml(name)} brightness</span><ha-icon icon="mdi:brightness-6" aria-hidden="true"></ha-icon><input type="range" min="1" max="100" step="1" value="${brightnessPercent}" data-light-brightness="${escapeHtml(entityId)}" aria-label="${escapeHtml(name)} brightness, ${brightnessPercent} percent"${unavailable}><output>${brightnessPercent}%</output></label>` : "";
        return `<div class="light-device ${isOn ? "is-on" : ""} ${dimmable ? "is-dimmable" : "is-binary"}"><button type="button" class="whole-home-control ${isOn ? "is-on" : ""}" data-toggle="${escapeHtml(entityId)}" aria-label="${escapeHtml(actionLabel)}" aria-pressed="${isOn}"${unavailable}><span class="light-control-icon"><ha-icon icon="${ICONS.light}" aria-hidden="true"></ha-icon></span><span><strong>${escapeHtml(name)}</strong><small>${escapeHtml(brightness)}</small></span><span class="light-power-indicator" aria-hidden="true"><ha-icon icon="mdi:power"></ha-icon></span></button>${dimmer}</div>`;
      }).join("");
      const status = availableCount === 0
        ? "Status unavailable"
        : availableCount < room.lights.length
          ? `${onCount} on · ${availableCount} of ${room.lights.length} reporting`
          : `${onCount} of ${room.lights.length} on`;
      const roomAction = onCount > 0 ? "turn_off" : "turn_on";
      const roomDisabled = readOnly || availableCount === 0 ? ' disabled aria-disabled="true"' : "";
      return `<article class="surface whole-home-card ${onCount ? "has-lights-on" : ""}"><div class="whole-home-heading"><span><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><h3>${escapeHtml(room.name)}</h3><p>${status}</p></div><button type="button" class="room-light-master ${onCount ? "is-on" : ""}" data-room-lights="${escapeHtml(room.id)}" data-light-service="${roomAction}"${roomDisabled}><ha-icon icon="mdi:power"></ha-icon>${roomAction === "turn_off" ? "All off" : "All on"}</button></div><div class="whole-home-controls">${controls}</div></article>`;
    }).join("");
    return `<section class="lights-experience"><article class="surface lighting-master"><div class="lighting-master-copy"><p class="eyebrow">Whole house</p><h2>Lighting</h2><span>${internalOn ? `${internalOn} of ${internalLights.length} internal lights on` : "Everything inside is off"}</span></div><div class="lighting-master-stats"><span><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon><strong>${internalOn}</strong><small>On now</small></span><span><ha-icon icon="mdi:tune-vertical"></ha-icon><strong>${internalDimmable}</strong><small>Dimmable</small></span></div><button type="button" class="lighting-all-off" data-all-internal-lights data-light-service="turn_off" ${readOnly || internalOn === 0 ? 'disabled aria-disabled="true"' : ""}><ha-icon icon="mdi:lightbulb-group-off-outline"></ha-icon><span>Turn all off</span></button></article><div class="whole-home-grid">${rooms || '<p class="hub-empty-state">No room lights are available yet.</p>'}</div></section>`;
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
      const decodedSchedule = room.heating_schedule?.entity_id
        ? decodeHeatingSchedule(states[room.heating_schedule.entity_id]?.state)
        : null;
      const nextPeriod = decodedSchedule ? nextHeatingSchedulePeriod(decodedSchedule.periods, new Date(), this._config.product.timezone) : null;
      const scheduleSummary = room.heating_schedule
        ? nextPeriod
          ? `Next ${formatTemperature(nextPeriod.temperature)} at ${nextPeriod.time}${nextPeriod.tomorrow ? " tomorrow" : ""}`
          : "Schedule waiting for thermostat"
        : "No schedule entity configured";
      return `
        <article class="surface heating-card is-${escapeHtml(presentation.tone)} ${presentation.available ? presentation.isOn ? "is-on" : "is-off" : "is-state-unavailable"}" data-climate-card="${escapeHtml(room.climate)}">
          <div class="heating-card-heading">
            <span class="heating-icon"><ha-icon icon="${ICONS.climate}"></ha-icon></span>
            <div><h3>${escapeHtml(room.name)}</h3><p class="heating-status"><span aria-hidden="true"></span>${escapeHtml(presentation.label)}</p></div>
            <button type="button" class="heating-power ${presentation.isOn ? "is-on" : ""}" data-climate-power="${powerService}" data-entity="${escapeHtml(room.climate)}" aria-label="${escapeHtml(powerLabelText)}"${powerPressed}${powerDisabled}><ha-icon icon="mdi:power"></ha-icon><span>${powerLabel}</span></button>
          </div>
          <div class="heating-body">
            <div class="heating-target-control" role="group" aria-label="${escapeHtml(room.name)} target temperature, currently ${targetLabel}"><div class="heating-stepper">
              <button type="button" data-climate-adjust="-0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Lower ${escapeHtml(room.name)} target from ${targetLabel}"${targetDisabled}>−</button>
              <div class="thermostat-dial" style="--temperature-progress:${Number.isFinite(target) ? Math.max(0, Math.min(100, (target - 5) / 30 * 100)) : 0}" role="img" aria-label="${escapeHtml(room.name)} target ${targetLabel}, current ${formatTemperature(current)}">
                <svg viewBox="0 0 180 180" aria-hidden="true"><circle class="thermostat-track" cx="90" cy="90" r="84"/><circle class="thermostat-value" cx="90" cy="90" r="84" pathLength="100" stroke-dasharray="${Number.isFinite(target) ? Math.max(0, Math.min(100, (target - 5) / 30 * 75)) : 0} 100"/></svg>
                <div><small>Target</small><output class="heating-target-value">${targetLabel}</output></div>
              </div>
              <button type="button" data-climate-adjust="0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Raise ${escapeHtml(room.name)} target from ${targetLabel}"${targetDisabled}>+</button>
            </div></div>
            <p class="heating-inside">Inside <strong class="heating-current-value">${formatTemperature(current)}</strong></p>
          </div>
          <button type="button" class="heating-schedule schedule-open-action" data-heating-schedule-open="${escapeHtml(room.id)}"><span><ha-icon icon="mdi:calendar-clock"></ha-icon><strong>Daily schedule</strong><small>${escapeHtml(scheduleSummary)}</small></span><ha-icon class="schedule-chevron" icon="mdi:chevron-right"></ha-icon></button>
        </article>
      `;
    }).join("");
    const availableZones = heatingRooms.filter((room) => isEntityAvailable(states[room.climate])).length;
    return `<section class="heating-experience"><article class="surface heating-master"><div class="heating-master-copy"><p class="eyebrow">Whole house</p><h2>Master heating</h2><span>${availableZones} of ${heatingRooms.length} zones available</span></div><div class="heating-master-target"><span>All-room target</span><div class="master-dial"><svg viewBox="0 0 180 180" aria-hidden="true"><circle class="thermostat-track" cx="90" cy="90" r="84"/><circle class="thermostat-value" cx="90" cy="90" r="84" pathLength="100" stroke-dasharray="${Math.max(0, Math.min(75, (this._masterTemperature - 5) / 30 * 75))} 100"/></svg><div class="master-temperature-stepper"><button type="button" data-master-temperature-adjust="-0.5" aria-label="Lower all-room target" ${readOnly ? "disabled" : ""}>−</button><label><span class="sr-only">All-room target temperature</span><input type="number" min="5" max="35" step="0.5" value="${this._masterTemperature}" data-master-temperature ${readOnly ? "disabled" : ""}><b>°</b></label><button type="button" data-master-temperature-adjust="0.5" aria-label="Raise all-room target" ${readOnly ? "disabled" : ""}>+</button></div></div></div><div class="heating-master-actions"><button type="button" data-climate-master="set_temperature" ${readOnly || !availableZones ? "disabled" : ""}><ha-icon icon="mdi:thermometer-check"></ha-icon><span>Set all rooms</span></button><button type="button" data-climate-master="turn_on" ${readOnly || !availableZones ? "disabled" : ""}><ha-icon icon="mdi:radiator"></ha-icon><span>All on</span></button><button type="button" data-climate-master="turn_off" ${readOnly || !availableZones ? "disabled" : ""}><ha-icon icon="mdi:power"></ha-icon><span>All off</span></button></div><button type="button" class="heating-schedule master-schedule schedule-open-action" data-heating-schedule-open="all"><span><ha-icon icon="mdi:calendar-sync"></ha-icon><strong>Whole-house schedule</strong><small>Use the same four periods in every configured room</small></span><ha-icon class="schedule-chevron" icon="mdi:chevron-right"></ha-icon></button></article><div class="heating-grid" data-zone-count="${heatingRooms.length}">${zones || '<p class="hub-empty-state">No heating controls are available yet.</p>'}</div></section>`;
  }

  _renderHeatingScheduleEditor(periods, scope, disabled = false, showSave = true) {
    const names = ["Wake", "Away", "Home", "Sleep"];
    const descriptions = ["Morning", "Daytime", "Evening", "Overnight"];
    return `<div class="schedule-editor" data-schedule-editor="${escapeHtml(scope)}"><div class="schedule-periods">${periods.map((period, index) => `<fieldset class="schedule-period"><legend><span>${index + 1}</span><strong>${names[index]}</strong><small>${descriptions[index]}</small></legend><label><span>Starts</span><input type="time" value="${escapeHtml(period.time)}" data-schedule-time="${index}" ${disabled ? "disabled" : ""}></label><label><span>Temperature</span><span class="schedule-temp"><input type="number" min="5" max="35" step="0.5" value="${Number(period.temperature)}" data-schedule-temperature="${index}" ${disabled ? "disabled" : ""}><b>°C</b></span></label></fieldset>`).join("")}</div>${showSave ? `<button type="button" data-heating-schedule-apply="${escapeHtml(scope)}" ${disabled ? "disabled" : ""}><ha-icon icon="mdi:content-save-outline"></ha-icon>${scope === "all" ? "Apply schedule to all rooms" : "Save schedule"}</button>` : ""}</div>`;
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
    const area = config.cleaning_area_entity ? states[config.cleaning_area_entity] : null;
    const duration = config.cleaning_time_entity ? states[config.cleaning_time_entity] : null;
    const facts = [
      [Number.isFinite(Number(battery)) ? `${Number(battery)}%` : "—", "Battery"],
      [titleCase(task || "unavailable"), "Current task"],
      [titleCase(dock || vacuum?.state || "unavailable"), "Dock"]
      , [area && isEntityAvailable(area) ? `${area.state}${area.attributes?.unit_of_measurement ? ` ${area.attributes.unit_of_measurement}` : ""}` : "—", "Area cleaned"]
      , [duration && isEntityAvailable(duration) ? `${duration.state}${duration.attributes?.unit_of_measurement ? ` ${duration.attributes.unit_of_measurement}` : ""}` : "—", "Cleaning time"]
    ].map(([value, label]) => `<span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(label)}</small></span>`).join("");
    const renderSelect = (entityId, label) => {
      const state = states[entityId];
      if (!entityId) return "";
      const options = Array.isArray(state?.attributes?.options) ? state.attributes.options : [];
      const selectDisabled = readOnly || !isEntityAvailable(state) || !options.length ? "disabled" : "";
      return `<label><span>${escapeHtml(label)}</span><span class="select-shell"><select data-cleaning-select="${escapeHtml(entityId)}" ${selectDisabled}>${options.length ? options.map((option) => `<option value="${escapeHtml(option)}" ${String(option) === String(state.state) ? "selected" : ""}>${escapeHtml(titleCase(option))}</option>`).join("") : '<option>Unavailable</option>'}</select><ha-icon icon="mdi:chevron-down"></ha-icon></span></label>`;
    };
    const selectors = [
      [config.room_entity, "Room"], [config.mode_entity, "Cleaning mode"], [config.suction_entity, "Suction"],
      [config.mop_entity, "Mop intensity"], [config.water_entity, "Water level"]
    ].map(([entityId, label]) => renderSelect(entityId, label)).join("");
    const consumables = (config.consumable_entities || []).map((entityId) => {
      const state = states[entityId];
      return `<span><ha-icon icon="mdi:progress-wrench"></ha-icon><span><strong>${escapeHtml(entityName(state, titleCase(entityId.split(".")[1])))}</strong><small>${escapeHtml(isEntityAvailable(state) ? `${state.state}${state.attributes?.unit_of_measurement || ""}` : "Unavailable")}</small></span></span>`;
    }).join("");
    const commands = (config.command_entities || []).map((entityId) => {
      const state = states[entityId];
      return `<button type="button" data-cleaning-command="${escapeHtml(entityId)}" ${readOnly || !isCommandEntityAvailable(state) ? "disabled" : ""}><ha-icon icon="mdi:gesture-tap-button"></ha-icon>${escapeHtml(entityName(state, titleCase(entityId.split(".")[1])))}</button>`;
    }).join("");
    const sections = [["clean", "Clean"], ["settings", "Settings"], ["care", "Care"]].filter(([id]) => id === "clean" || (id === "settings" ? selectors : commands || consumables));
    const selectedSection = sections.some(([id]) => id === this._cleaningSection) ? this._cleaningSection : "clean";
    return `
      <section class="cleaning-experience"><article class="surface cleaning-panel">
        <div class="cleaning-hero"><span><ha-icon icon="${ICONS.vacuum}"></ha-icon></span><div><p class="eyebrow">Whole-home cleaning</p><h2>${escapeHtml(entityName(vacuum, "Robot vacuum"))}</h2><p>${escapeHtml(titleCase(vacuum?.state || "unavailable"))}</p></div></div>
        <div class="segments detail-segments" role="group" aria-label="Cleaning section">${sections.map(([id, label]) => `<button type="button" class="segment ${selectedSection === id ? "is-selected" : ""}" data-cleaning-section="${id}" aria-pressed="${selectedSection === id}">${label}</button>`).join("")}</div>
        <section class="ux-section cleaning-section" ${selectedSection === "clean" ? "" : "hidden"}><div class="cleaning-facts">${facts}</div>
        <div class="cleaning-actions"><button type="button" data-vacuum-action="start" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:play"></ha-icon>Start</button><button type="button" data-vacuum-action="pause" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:pause"></ha-icon>Pause</button><button type="button" data-vacuum-action="return_to_base" data-entity="${escapeHtml(config.vacuum_entity)}"${disabled}><ha-icon icon="mdi:home-map-marker"></ha-icon>Return home</button></div>
        </section><section class="ux-section cleaning-section" ${selectedSection === "settings" ? "" : "hidden"}>${selectors ? `<div class="cleaning-selectors">${selectors}</div>` : ""}</section>
        <section class="ux-section cleaning-section" ${selectedSection === "care" ? "" : "hidden"}>
        ${commands ? `<div class="cleaning-command-grid">${commands}</div>` : ""}
        ${consumables ? `<div class="cleaning-consumables">${consumables}</div>` : ""}
        </section>
      </article><article class="surface cleaning-map-panel"><div class="section-heading"><div><p class="eyebrow">Room map</p><h2>Cleaning map</h2></div></div>${config.map_entity ? '<div id="vacuum-map-card-slot" class="child-card-slot vacuum-map-slot"></div>' : '<div class="vacuum-map-placeholder is-actionable"><ha-icon icon="mdi:map-marker-alert-outline"></ha-icon><strong>Cleaning map unavailable</strong><span>Connect the robot’s map camera in Admin to see its progress here.</span></div>'}</article></section>
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
    const sections = [["lights", "Lights", lights], ["comfort", "Comfort", climateControl + covers], ["scenes", "Scenes", scenes], ["music", "Music", media]].filter(([, , content]) => content);
    const selectedSection = sections.some(([id]) => id === this._roomDetailSection) ? this._roomDetailSection : sections[0]?.[0];
    return `
      <div class="room-title"><span class="room-icon"><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><p class="eyebrow">${readOnly ? "Read-only room" : "Room controls"}</p><h2>${escapeHtml(room.name)}</h2><p>${escapeHtml(lightStatus)}${Number.isFinite(summary.temperature) ? ` · ${formatTemperature(summary.temperature)}` : ""}</p></div></div>
      ${readOnly ? '<p class="read-only-note"><ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon>Controls are disabled while this version is being checked.</p>' : ""}
      ${sections.length > 1 ? `<div class="segments detail-segments" role="group" aria-label="Room controls">${sections.map(([id, label]) => `<button type="button" class="segment ${selectedSection === id ? "is-selected" : ""}" data-room-section="${id}" aria-pressed="${selectedSection === id}">${label}</button>`).join("")}</div>` : ""}
      <div class="room-section-content">${sections.map(([id, , content]) => `<section class="room-control-list ux-section" data-room-panel="${id}" ${selectedSection === id ? "" : "hidden"}>${content}</section>`).join("")}</div>
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
          <button type="button" class="camera-select-action" data-camera-select="${escapeHtml(item.camera.id)}" aria-pressed="${item.camera.id === selected?.camera.id}" aria-label="Select ${escapeHtml(item.camera.name)} camera" ${cameraOperationPending ? "disabled" : ""}>
            <ha-icon icon="${item.camera.role === "doorbell" ? "mdi:doorbell-video" : "mdi:cctv"}"></ha-icon>
            <span><strong>${escapeHtml(item.camera.name)}</strong><small class="privacy-badge">${item.badgeLabel}</small></span>
          </button>
          <button type="button" class="camera-picker-live" data-camera-open="${escapeHtml(item.camera.id)}" aria-label="${actionLabel}" title="${actionLabel}" ${item.canOpen ? "" : 'disabled aria-disabled="true"'}><ha-icon icon="${actionIcon}"></ha-icon><span class="camera-picker-action-label">${actionText}</span></button>
        </article>
      `;
    }).join("");
    const cameraPicker = cameras.length > 3
      ? `<label class="camera-collection-picker"><ha-icon icon="mdi:cctv"></ha-icon><span><small>${cameras.length} cameras</small><select data-camera-select aria-label="Choose a camera" ${cameraOperationPending ? "disabled" : ""}>${cameras.map((item) => `<option value="${escapeHtml(item.camera.id)}" ${item.camera.id === selected?.camera.id ? "selected" : ""}>${escapeHtml(item.camera.name)} · ${escapeHtml(item.badgeLabel)}</option>`).join("")}</select></span></label>`
      : `<div class="camera-choice-list" style="--camera-count:${Math.max(1,cameras.length)}">${cameraCards}</div>`;
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
      ? { title: "Waking camera…", detail: `Connecting to ${selected.camera.name}. This can take up to a minute.`, icon: "mdi:loading" }
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
              : selected?.camera?.still_entity_id ? "Latest snapshot ready; live video starts only when you tap." : "Tap once to wake the camera and open a private live view."
            : "Live view cannot start while the camera is in its current state."
          : "This camera is currently unavailable.";
    const selectedStream = `
      <div class="camera-stage-stack ${selected?.isViewing ? "is-live" : "is-poster"} ${!selected?.session ? "security-stage-poster" : ""}" data-camera-phase="${escapeHtml(selected?.session?.phase || "idle")}" ${!selected?.session && selected?.cameraError ? 'role="alert"' : ""}>
        <div id="camera-poster-stage-${escapeHtml(selected?.camera.id || "")}" class="camera-poster-slot camera-stage-poster-slot"><span class="camera-poster-fallback"><ha-icon icon="${selected?.camera.role === "doorbell" ? "mdi:doorbell-video" : "mdi:cctv"}"></ha-icon>${selected?.camera?.still_entity_id ? "Loading latest snapshot…" : selected?.cameraAvailable && selected?.cameraReady && !selected?.readOnlyStartBlocked ? "Camera ready · live on demand" : escapeHtml(selected?.badgeLabel || "Camera unavailable")}</span></div>
        ${selected?.hasMountedStream ? `<slot id="camera-card-slot-${escapeHtml(selected.camera.id)}" name="camera-${escapeHtml(selected.camera.id)}" class="child-card-slot camera-card-slot"></slot>` : ""}
        ${selected?.isViewing ? '<span class="camera-live-indicator" role="status"><span></span>Live</span>' : ""}
        ${stageStatus ? `<div class="camera-stream-overlay camera-is-${escapeHtml(selected.session?.phase || "waiting")}" role="status" aria-live="polite" aria-busy="true"><ha-icon icon="${stageStatus.icon}"></ha-icon><div><strong>${escapeHtml(stageStatus.title)}</strong><small>${escapeHtml(stageStatus.detail)}</small></div></div>` : ""}
        ${!selected?.session && !selected?.isWaiting ? `<button type="button" class="camera-stage-action" data-camera-stage-open="${escapeHtml(selected?.camera.id || "")}" aria-label="${stageActionLabel}" ${selected?.canOpen ? "" : 'disabled aria-disabled="true"'}><span><strong>${escapeHtml(idleStageTitle)}</strong><small>${escapeHtml(idleStageDetail)}</small></span><b><ha-icon icon="${stageActionIcon}"></ha-icon>${stageActionText}</b></button>` : ""}
        ${selected?.session && !selected?.isStopping ? `<button type="button" class="camera-close" data-camera-close="${escapeHtml(selected.camera.id)}"><ha-icon icon="mdi:close"></ha-icon>${selected.isViewing ? "Close live view" : "Cancel"}</button>` : ""}
      </div>`;
    return `
      <section class="security-layout">
        <div class="security-main"${confirmationGuard}>
          <div class="security-camera-picker" aria-label="Choose an entry camera">${cameraPicker}</div>
          <article class="security-stage" aria-label="Selected secure camera">
            <div class="security-stage-heading"><div><p class="eyebrow">Live view</p><h2>${escapeHtml(selected?.camera.name || "Entry camera")}</h2></div><span class="stage-privacy"><ha-icon icon="mdi:shield-lock-outline"></ha-icon>Private · on demand</span></div>
            <div class="security-stage-media">${selectedStream}</div>
            ${selected?.signals ? `<div class="security-selected-signals security-signals" aria-label="${escapeHtml(selected.camera.name)} activity">${selected.signals}</div>` : ""}
          </article>
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

  _openHeatingSchedule(scope) {
    if (!this._config.features.rooms || (scope !== "all" && !this._config.rooms.some((room) => room.id === scope && room.climate))) return;
    this._plannerModal = { type: "heating", scope, error: "", saving: false };
    this._scheduleRender(true);
  }

  _closeHeatingSchedule() {
    this._heatingScheduleReturnScope = this._plannerModal.scope;
    this._plannerModal = null;
    this._scheduleRender(true);
  }

  _renderHeatingScheduleModal() {
    const { scope, error, saving } = this._plannerModal;
    const rooms = this._config.rooms.filter((room) => room.climate && (scope === "all" || room.id === scope));
    const configured = rooms.filter((room) => this._controlPolicy.scheduleTexts.has(room.heating_schedule?.entity_id));
    const saved = configured.map((room) => decodeHeatingSchedule(this._hass?.states?.[room.heating_schedule.entity_id]?.state)?.periods).find(Boolean);
    const periods = this._heatingScheduleDrafts.get(scope) || saved || DEFAULT_HEATING_SCHEDULE;
    const disabled = this._config.display.read_only === true || saving;
    const title = scope === "all" ? "Whole-house schedule" : `${rooms[0]?.name || "Room"} schedule`;
    return `<div class="planner-modal-backdrop" role="presentation"><section class="planner-modal heating-schedule-modal" role="dialog" aria-modal="true" aria-labelledby="heating-schedule-title">
      <header><button type="button" class="planner-modal-close" data-planner-close aria-label="Close schedule"><ha-icon icon="mdi:close"></ha-icon></button><p class="eyebrow">Heating · daily schedule</p><h2 id="heating-schedule-title">${escapeHtml(title)}</h2><p>${scope === "all" ? `Apply these four periods to ${configured.length} configured ${configured.length === 1 ? "room" : "rooms"}.` : "Choose when each period starts and the temperature you want."}</p></header>
      <div class="planner-modal-body">${configured.length ? this._renderHeatingScheduleEditor(periods, scope, disabled, false) : '<p class="planner-no-prep">No schedule entity is configured for this thermostat yet.</p>'}${error ? `<p class="schedule-error" role="alert">${escapeHtml(error)}</p>` : ""}</div>
      <footer><button type="button" data-planner-close>Close</button>${configured.length ? `<button type="button" data-heating-schedule-apply="${escapeHtml(scope)}" ${disabled ? "disabled" : ""}>${saving ? "Saving…" : scope === "all" ? "Apply to all rooms" : "Save schedule"}</button>` : ""}</footer>
    </section></div>`;
  }

  async _saveHeatingSchedule(scope) {
    const modal = this._plannerModal;
    if (modal?.type !== "heating" || modal.scope !== scope || modal.saving || this._config.display.read_only === true || !this._config.features.rooms) return;
    const editor = this.shadowRoot.querySelector('.heating-schedule-modal [data-schedule-editor]');
    const periods = [0, 1, 2, 3].map((stage) => ({ stage,
      time: editor?.querySelector(`[data-schedule-time="${stage}"]`)?.value,
      temperature: Number(editor?.querySelector(`[data-schedule-temperature="${stage}"]`)?.value)
    }));
    const ordered = periods.every((period, index) => Number.isFinite(period.temperature) && (!index || period.time > periods[index - 1].time));
    const encoded = ordered ? encodeHeatingSchedule(periods) : null;
    const targets = this._config.rooms.filter((room) => room.climate && (scope === "all" || room.id === scope))
      .map((room) => room.heating_schedule?.entity_id).filter((entityId) => this._controlPolicy.scheduleTexts.has(entityId));
    if (!encoded || !targets.length) {
      modal.error = "Enter four valid start times in order and temperatures between 5°C and 35°C.";
      this._scheduleRender(true);
      return;
    }
    this._heatingScheduleDrafts.set(scope, periods);
    modal.saving = true;
    modal.error = "";
    this._scheduleRender(true);
    try {
      if (!this._hass?.callService) throw new Error("Service unavailable");
      await Promise.all(targets.map((entity_id) => this._hass.callService("text", "set_value", { entity_id, value: encoded })));
      if (this._heatingScheduleDrafts.get(scope) === periods) this._heatingScheduleDrafts.delete(scope);
      if (this._plannerModal === modal) this._closeHeatingSchedule();
    } catch {
      if (this._plannerModal === modal) {
        modal.saving = false;
        modal.error = "The schedule could not be saved. Please try again.";
        this._scheduleRender(true);
      }
    }
  }

  _renderPlannerModal() {
    if (!this._plannerModal) return "";
    if (this._plannerModal.type === "heating") return this._renderHeatingScheduleModal();
    if (this._plannerModal.type === "add") return this._renderPlannerAddModal();
    const event = this._plannerEventByKey(this._plannerModal.eventKey);
    if (!event) return `<div class="planner-modal-backdrop" role="presentation"><section class="planner-modal" role="dialog" aria-modal="true" aria-labelledby="planner-event-missing-title">
      <header><button type="button" class="planner-modal-close" data-planner-close aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button><p class="eyebrow">Family planner</p><h2 id="planner-event-missing-title">Event no longer available</h2></header>
      <div class="planner-modal-body"><p class="planner-no-prep">The calendar changed while this event was open.</p></div>
      <footer><span>Close this window to refresh the planner.</span><button type="button" data-planner-close>Close</button></footer>
    </section></div>`;
    const calendar = event._calendar || this._config.calendar.entities[0];
    const people = familyPlannerPeople(event, this._config.people).filter((person) => person.role !== "household");
    const children = people.filter((person) => person.role === "child");
    const eventKey = familyPlannerEventKey(event);
    const items = this._preparationItems.filter((item) => item?._preparation?.eventKey === eventKey);
    const progress = preparationProgress(items, eventKey);
    const suggestion = matchPreparationTemplate(event, this._config.calendar.preparation?.templates || []);
    const templates = this._config.calendar.preparation?.templates || [];
    const checklist = items.length ? `<div class="planner-checklist">
      <div class="planner-checklist-heading"><div><p class="eyebrow">Get ready</p><h3>${progress.ready ? "Ready" : `${progress.complete} of ${progress.total} complete`}</h3></div><span class="${progress.ready ? "is-ready" : ""}"><ha-icon icon="${progress.ready ? "mdi:check-circle" : "mdi:bag-personal-outline"}"></ha-icon></span></div>
      ${items.map((item) => {
        const completed = String(item.status).toLocaleLowerCase() === "completed";
        const person = this._config.people.find((entry) => entry.id === item._preparation.personId);
        const itemId = item.uid || item.id || item.summary;
        return `<div class="planner-check-item ${completed ? "is-complete" : ""}"><button type="button" data-prep-item="${escapeHtml(itemId)}" data-prep-status="${completed ? "needs_action" : "completed"}" aria-label="${completed ? "Mark not ready" : "Mark ready"}" ${this._config.display.read_only ? "disabled" : ""}><span><ha-icon icon="${completed ? "mdi:check" : "mdi:circle-outline"}"></ha-icon></span><strong>${escapeHtml(item.summary || item.item || "Preparation item")}</strong>${person ? `<small style="--person-colour:${escapeHtml(person.colour)}">${escapeHtml(person.name)}</small>` : ""}</button>${this._config.display.read_only ? "" : `<button type="button" class="planner-remove-item" data-remove-prep-item="${escapeHtml(itemId)}" aria-label="Remove ${escapeHtml(item.summary || item.item || "preparation item")}"><ha-icon icon="mdi:delete-outline"></ha-icon></button>`}</div>`;
      }).join("")}
    </div>` : suggestion && children.length ? `<div class="planner-suggestion"><span><ha-icon icon="mdi:lightbulb-on-outline"></ha-icon></span><div><p class="eyebrow">Suggested preparation</p><h3>${escapeHtml(suggestion.label)}</h3><p>${escapeHtml(suggestion.items.join(" · "))}</p><div>${children.map((person) => `<button type="button" data-add-preparation="${escapeHtml(eventKey)}" data-preparation-template="${escapeHtml(suggestion.id)}" data-preparation-person="${escapeHtml(person.id)}" style="--person-colour:${escapeHtml(person.colour)}">Add for ${escapeHtml(person.name)}</button>`).join("")}</div></div></div>` : '<p class="planner-no-prep">No preparation checklist is linked to this event yet.</p>';
    const checklistEditor = children.length && !this._config.display.read_only ? `<section class="planner-checklist-editor"><p class="eyebrow">Change the Ready list</p><div class="planner-editor-row"><span class="select-shell"><select data-planner-field="event-person" aria-label="Family member">${children.map((person) => `<option value="${escapeHtml(person.id)}">${escapeHtml(person.name)}</option>`).join("")}</select><ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon></span><span class="select-shell"><select data-planner-field="event-template" aria-label="Ready template"><option value="">Choose a template</option>${templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.label)}</option>`).join("")}</select><ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon></span><button type="button" data-add-event-template="${escapeHtml(eventKey)}">Add template</button></div><div class="planner-editor-row"><input data-planner-field="event-custom-item" type="text" maxlength="120" autocomplete="off" placeholder="Add present, card, water bottle…"/><button type="button" data-add-event-custom="${escapeHtml(eventKey)}">Add item</button></div></section>` : "";
    return `<div class="planner-modal-backdrop" role="presentation"><section class="planner-modal" role="dialog" aria-modal="true" aria-labelledby="planner-event-title">
      <header style="--calendar-colour:${escapeHtml(calendar.colour)}"><button type="button" class="planner-modal-close" data-planner-close aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button><p class="eyebrow">${escapeHtml(people.map((person) => person.name).join(" · ") || calendar.label)}</p><h2 id="planner-event-title">${escapeHtml(event.summary || calendar.label)}</h2><p>${escapeHtml(formatDay(calendarEventStart(event), this._config.product.locale, this._config.product.timezone))}${isAllDayCalendarEvent(event) ? " · All day" : ` · ${escapeHtml(formatTime(calendarEventStart(event), this._config.product.locale, this._config.product.timezone))}`}</p></header>
      <div class="planner-modal-body">${event.location ? `<p class="planner-event-location"><ha-icon icon="mdi:map-marker-outline"></ha-icon>${escapeHtml(event.location)}</p>` : ""}${event.description ? `<p class="planner-event-description">${escapeHtml(event.description)}</p>` : ""}${checklist}${checklistEditor}</div>
      <footer><span><ha-icon icon="mdi:apple"></ha-icon>Edit the event itself in Apple Calendar, then press Refresh</span></footer>
    </section></div>`;
  }

  _renderPlannerAddModal() {
    const now = new Date(Date.now() + 3_600_000);
    const date = dateKey(now, this._config.product.timezone);
    const startTime = formatTimeInput(now, this._config.product.timezone);
    const endTime = formatTimeInput(new Date(now.getTime() + 3_600_000), this._config.product.timezone);
    const calendars = this._config.calendar.entities.filter((entry) => entry.allow_create === true);
    const templates = this._config.calendar.preparation?.templates || [];
    return `<div class="planner-modal-backdrop" role="presentation"><section class="planner-modal planner-add-modal" role="dialog" aria-modal="true" aria-labelledby="planner-add-title">
      <header><button type="button" class="planner-modal-close" data-planner-close aria-label="Close"><ha-icon icon="mdi:close"></ha-icon></button><p class="eyebrow">Family planner</p><h2 id="planner-add-title">Add an event</h2><p>This will be added to the selected Apple calendar.</p></header>
      <div class="planner-event-form">
        <label><span>Who is it for?</span><span class="select-shell"><select data-planner-field="calendar">${calendars.map((calendar) => `<option value="${escapeHtml(calendar.entity_id)}">${escapeHtml(calendar.label)}</option>`).join("")}</select><ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon></span></label>
        <label class="is-wide"><span>Event</span><input data-planner-field="summary" type="text" maxlength="120" autocomplete="off" placeholder="Football training" /></label>
        <label><span>Date</span><input data-planner-field="date" type="date" value="${escapeHtml(date)}" /></label>
        <label><span>Starts</span><input data-planner-field="start" type="time" value="${escapeHtml(startTime)}" /></label>
        <label><span>Ends</span><input data-planner-field="end" type="time" value="${escapeHtml(endTime)}" /></label>
        <label class="is-wide"><span>Location</span><input data-planner-field="location" type="text" maxlength="160" autocomplete="off" placeholder="Optional" /></label>
        <label class="is-wide"><span>Get ready template</span><span class="select-shell"><select data-planner-field="template"><option value="">No checklist</option>${templates.map((template) => `<option value="${escapeHtml(template.id)}">${escapeHtml(template.label)}</option>`).join("")}</select><ha-icon icon="mdi:chevron-down" aria-hidden="true"></ha-icon></span></label>
        <label class="is-wide"><span>Extra Ready items</span><textarea data-planner-field="custom-items" maxlength="600" placeholder="One item per line, for example:&#10;Birthday present&#10;Birthday card"></textarea><small>These are added alongside any template you choose.</small></label>
        <p class="planner-form-error" role="alert">${escapeHtml(this._plannerModal.error || "")}</p>
      </div>
      <footer><button type="button" data-planner-close>Cancel</button><button type="button" class="planner-save" data-planner-save ${this._plannerModal.saving ? "disabled" : ""}>${this._plannerModal.saving ? "Adding…" : "Add to calendar"}</button></footer>
    </section></div>`;
  }

  _renderFamily() {
    const locationEnabled = this._config.features.location_map;
    const choresEnabled = this._config.features.chores === true;
    const familyTitle = choresEnabled ? "Tasks, jobs & rewards" : this._config.features.school ? "School & tasks" : "Tasks";
    const children = this._config.people.filter((person) => person.role === "child");
    if (!locationEnabled) {
      const selected = children.find((person) => person.id === this._familyPersonId) || children[0];
      const tabs = children.map((person) => `<button type="button" class="family-kid-tab ${selected?.id === person.id ? "is-selected" : ""}" data-family-person="${escapeHtml(person.id)}" style="--person-colour:${escapeHtml(person.colour)}" aria-pressed="${selected?.id === person.id}"><span>${escapeHtml(person.name.slice(0, 1))}</span><strong>${escapeHtml(person.name)}</strong></button>`).join("");
      return `
        <section class="family-dashboard${children.length > 1 ? " has-kid-switcher" : ""}${this._choreClaimFeedback ? " has-claim-feedback" : ""}">
          <header class="family-dashboard-heading"><div class="task-section-tabs segments" role="group" aria-label="Tasks section">${[["jobs", "Jobs"], ["ready", "Get ready"], ["rewards", "Rewards"]].map(([id, label]) => `<button type="button" class="segment ${(this._taskSection || "jobs") === id ? "is-selected" : ""}" data-task-section="${id}" aria-pressed="${(this._taskSection || "jobs") === id}">${label}</button>`).join("")}</div>${choresEnabled ? this._renderChoreOpsLink() : ""}</header>
          ${children.length > 1 ? `<div class="family-kid-switcher" role="group" aria-label="Choose family member">${tabs}</div>` : ""}
          ${this._choreClaimFeedback ? `<p class="chore-claim-feedback" role="status"><ha-icon icon="mdi:check-circle"></ha-icon>${escapeHtml(this._choreClaimFeedback)}</p>` : ""}
          <div class="family-kid-stage">${selected ? this._renderFamilyPerson(selected, { kidMode: true }) : '<p class="hub-empty-state large">Add a child in Family Dashboard Admin to connect ChoreOps.</p>'}</div>
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
    if (!path || path === "/choreops") return "";
    return `<a class="choreops-link ${extraClass}" href="${escapeHtml(path)}" data-choreops-link="native"><ha-icon icon="mdi:cog-outline" aria-hidden="true"></ha-icon>Parent controls</a>`;
  }

  _renderChoreOpsSummary(chore, points = NaN, personId = "") {
    if (!chore) return "";
    const states = this._hass?.states || {};
    const firstSummary = (entityIds, kind) => {
      const entityId = entityIds?.[0];
      return entityId ? { ...normaliseChoreOpsSummary(states[entityId], entityId, kind), entityId, state: states[entityId] } : null;
    };
    const items = [
      firstSummary(chore.reward_status_entities, "reward"),
      firstSummary(chore.badge_progress_entities, "badge"),
      firstSummary(chore.achievement_progress_entities, "achievement")
    ].filter(Boolean);
    if (!items.length) return "";
    const labels = { reward: "Reward", badge: "Badge", achievement: "Achievement" };
    const rows = items.map((item) => {
      const attributes = item.state?.attributes || {};
      const rewardCost = firstFiniteNumber([attributes.reward_cost, attributes.cost, attributes.points_required]);
      const percentageLabel = item.label.match(/([0-9.]+)%/);
      const countLabel = item.label.match(/([0-9.]+) of ([0-9.]+)/);
      const progress = item.kind === "reward" && Number.isFinite(points) && Number.isFinite(rewardCost) && rewardCost > 0
        ? Math.min(100, Math.max(0, points / rewardCost * 100))
        : percentageLabel
          ? Number(percentageLabel[1])
          : countLabel && Number(countLabel[2]) > 0
            ? Math.min(100, Number(countLabel[1]) / Number(countLabel[2]) * 100)
            : item.tone === "done" ? 100 : 0;
      const claimEntity = item.kind === "reward" ? rewardClaimEntityId(item.entityId) : null;
      const pending = claimEntity && this._pendingChoreClaims.has(claimEntity);
      const canClaim = item.kind === "reward" && item.status === "available" && claimEntity
        && isCommandEntityAvailable(states[claimEntity]) && !this._config.display.read_only && !pending;
      const claimAction = canClaim || pending
        ? `<button type="button" class="reward-claim" ${canClaim ? `data-reward-claim="${escapeHtml(claimEntity)}" data-reward-status="${escapeHtml(item.entityId)}" data-person-id="${escapeHtml(personId)}"` : "disabled"}>${pending ? "Requesting…" : "Claim reward"}</button>`
        : "";
      return `
      <div class="family-summary-item is-${escapeHtml(item.tone)} award-${item.kind}">
        <span class="award-art" style="--progress:${Math.round(progress)}"><ha-icon icon="${escapeHtml(item.icon)}" aria-hidden="true"></ha-icon></span>
        <div><p>${labels[item.kind]}</p><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.label)}</small><i class="family-progress"><b style="width:${Math.round(progress)}%"></b></i>${claimAction}</div>
      </div>
    `;
    }).join("");
    return `<section class="family-summary-grid" aria-label="Rewards and progress">${rows}</section>`;
  }

  _renderPersonPreparation(person) {
    if (!this._config.calendar?.preparation?.enabled) return "";
    const source=this._calendarEvents.length ? this._calendarEvents:this._calendarFallbackEvents();
    const byKey=new Map(source.map((event)=>[familyPlannerEventKey(event),event]));
    const today=dateKey(new Date(),this._config.product.timezone);
    const groups=new Map();
    for (const item of this._preparationItems) {
      if (item?._preparation?.personId!==person.id) continue;
      const event=byKey.get(item._preparation.eventKey);
      const due=event ? calendarEventStart(event):item.due || item.due_datetime || item.due_date;
      if (due && dateKey(due,this._config.product.timezone)<today) continue;
      if (!due && String(item.status).toLowerCase()==="completed") continue;
      const key=item._preparation.eventKey;
      if (!groups.has(key)) groups.set(key,{event,due,items:[]});
      groups.get(key).items.push(item);
    }
    if (!groups.size) return "";
    return `<section class="family-preparation" aria-label="Get ready for upcoming events"><div class="chore-heading"><p class="eyebrow">Get ready</p><span>From your calendar</span></div>${[...groups.values()].sort((a,b)=>String(a.due || "").localeCompare(String(b.due || ""))).map(({event,due,items})=>`<section class="focus-task-event"><header><ha-icon icon="mdi:bag-personal-outline"></ha-icon><div><h3>${escapeHtml(event?.summary || "Event checklist")}</h3>${due ? `<small>${escapeHtml(formatDay(due,this._config.product.locale,this._config.product.timezone))}</small>`:""}</div>${event ? `<button type="button" data-focus-open-plan="${escapeHtml(familyPlannerEventKey(event))}" aria-label="Open ${escapeHtml(event.summary || "event")} in Calendar"><ha-icon icon="mdi:arrow-top-right"></ha-icon></button>`:""}</header><div class="family-prep-list">${items.map((item)=>{const done=String(item.status).toLowerCase()==="completed";return `<button type="button" class="family-prep-item ${done ? "is-complete":""}" data-prep-item="${escapeHtml(item.uid || item.id || item.summary)}" data-prep-status="${done ? "needs_action":"completed"}" aria-pressed="${done}" ${this._config.display.read_only ? "disabled":""}><span><ha-icon icon="${done ? "mdi:checkbox-marked":"mdi:checkbox-blank-outline"}"></ha-icon></span><div><strong>${escapeHtml(item.summary || item.item || "Preparation item")}</strong></div></button>`}).join("")}</div><small>${items.filter((item)=>String(item.status).toLowerCase()==="completed").length} of ${items.length} ready</small></section>`).join("")}</section>`;
  }
  _renderFamilyPerson(person, { kidMode = false } = {}) {
    const states = this._hass?.states || {};
    const choresEnabled = this._config.features.chores === true;
    const schoolEnabled = this._config.features.school === true;
    const schoolSource = schoolDataSource(this._config);
    const chore = choresEnabled ? this._config.chores.users.find((entry) => entry.person_id === person.id) : null;
    const classroom = schoolEnabled && schoolSource === "classroom"
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
    const schoolEvent = schoolEnabled && schoolSource === "calendar"
      ? this._nextSchoolCalendarEvent(person.id)
      : null;
    const schoolEventStart = calendarEventStart(schoolEvent);
    const schoolEventWhen = schoolEventStart
      ? `${formatClassroomDueDay(schoolEventStart, this._config.product.locale, this._config.product.timezone)} · ${formatTime(schoolEventStart, this._config.product.locale, this._config.product.timezone)}`
      : "Date to be confirmed";
    const classroomHealth = classroomStale
      ? `<span class="classroom-health is-stale"><ha-icon icon="mdi:cloud-alert-outline" aria-hidden="true"></ha-icon>${escapeHtml(classroomError)}${lastSuccessfulLabel ? ` · Last updated ${escapeHtml(lastSuccessfulLabel)}` : ""}</span>`
      : assignmentsTruncated
        ? `<span class="classroom-health"><ha-icon icon="mdi:format-list-numbered" aria-hidden="true"></ha-icon>Showing the next ${assignments.length} of ${assignmentCount} assignments</span>`
        : "";
    const classroomStatus = schoolEnabled && schoolSource === "calendar"
      ? schoolEvent
        ? `<div class="assignment school-calendar-fallback"><ha-icon icon="mdi:calendar-school-outline"></ha-icon><div><strong>${escapeHtml(schoolEvent.summary || schoolEvent._calendar?.label || "School event")}</strong><small>${escapeHtml(schoolEventWhen)}${schoolEvent.location ? ` · ${escapeHtml(schoolEvent.location)}` : ""}</small><span class="classroom-health"><ha-icon icon="mdi:shield-check-outline" aria-hidden="true"></ha-icon>Calendar-only fallback · Classroom remains disconnected</span></div></div>`
        : '<div class="assignment school-calendar-fallback"><ha-icon icon="mdi:calendar-blank-outline"></ha-icon><div><strong>No upcoming school dates</strong><small>The calendar-only fallback is active. Classroom assignments are not being read.</small></div></div>'
      : classroom && !classroomData.available
      ? '<div class="assignment is-stale"><ha-icon icon="mdi:school-outline"></ha-icon><div><strong>Classroom unavailable</strong><small>The last update could not be read. Home Assistant will retry.</small></div></div>'
      : nextAssignment
      ? `<div class="assignment ${classroomStale ? "is-stale" : ""}"><ha-icon icon="${ICONS.school}"></ha-icon><div>${assignmentTitle}<small>${escapeHtml(nextAssignment.course || "Google Classroom")} · ${escapeHtml(assignmentDue)}</small>${classroomHealth}</div></div>`
      : classroomStale
        ? `<div class="assignment is-stale"><ha-icon icon="mdi:cloud-alert-outline"></ha-icon><div><strong>Classroom update delayed</strong><small>${escapeHtml(classroomError)}${lastSuccessfulLabel ? ` · Last updated ${escapeHtml(lastSuccessfulLabel)}` : ""}</small></div></div>`
      : !schoolEnabled
        ? ""
        : !classroom
          ? '<div class="assignment is-stale"><ha-icon icon="mdi:school-alert-outline"></ha-icon><div><strong>Classroom not connected</strong><small>This child still needs a separate read-only connection.</small></div></div>'
        : '<div class="assignment"><ha-icon icon="mdi:school-check-outline"></ha-icon><div><strong>No open assignments</strong><small>Google Classroom is up to date.</small></div></div>';
    const presence = this._config.features.location_map && person.location_entity
      ? titleCase(states[person.location_entity]?.state || "Location unavailable")
      : choresEnabled ? "Today’s jobs" : schoolEnabled ? "School" : "Tasks";
    const jobPresentations = (chore?.status_entities || []).map((entityId) => ({ entityId, presentation: normaliseChoreStatus(states[entityId], entityId) }));
    const completedJobs = jobPresentations.filter(({ presentation }) => presentation.tone === "done").length;
    const totalJobs = jobPresentations.length;
    const missionProgress = totalJobs ? Math.round(completedJobs / totalJobs * 100) : 0;
    const choreRows = jobPresentations.map(({ entityId, presentation }) => {
      const state = states[entityId];
      const claimEntity = choreClaimEntityId(entityId);
      const claimableStatus = ["pending", "due", "overdue", "missed"].includes(presentation.status);
      const actionAvailable = claimableStatus && claimEntity && isCommandEntityAvailable(states[claimEntity]);
      const pending = claimEntity && this._pendingChoreClaims.has(claimEntity);
      const interactive = kidMode && !this._config.display.read_only && actionAvailable && !pending;
      return `
        <li class="chore-row ${kidMode ? "is-kid-card" : ""} is-${escapeHtml(presentation.tone)} ${interactive ? "is-actionable" : ""}">
          <span class="chore-check"><ha-icon icon="${escapeHtml(kidMode ? choreIcon(presentation.name) : presentation.tone === "done" ? "mdi:check" : presentation.tone === "overdue" ? "mdi:alert" : "mdi:circle-small")}" aria-hidden="true"></ha-icon></span>
          <span><strong>${escapeHtml(presentation.name)}</strong><small>${escapeHtml(pending ? "Marking as done…" : presentation.label)}${presentation.due ? ` · ${escapeHtml(formatTime(presentation.due, this._config.product.locale, this._config.product.timezone))}` : ""}</small></span>
          ${Number.isFinite(presentation.points) ? `<b>+${presentation.points}</b>` : ""}
          ${kidMode ? `<button type="button" class="chore-claim-action" ${interactive ? `data-chore-claim="${escapeHtml(claimEntity)}" data-chore-status="${escapeHtml(entityId)}" data-person-id="${escapeHtml(person.id)}"` : "disabled"}><span class="sr-only">${pending ? "Saving…" : presentation.tone === "done" ? "Done" : presentation.tone === "waiting" ? "Waiting for a grown-up" : interactive ? "Mark as done" : presentation.label}</span></button>` : ""}
        </li>
      `;
    }).join("");
    const choreOpsSummary = choresEnabled ? this._renderChoreOpsSummary(chore, safeNumber(points, NaN), person.id) : "";
    const choreHeading = choresEnabled && this._config.features.location_map
      ? `<div class="chore-heading"><p class="eyebrow">Today’s jobs</p><span>${choreRows ? `${(chore?.status_entities || []).length} jobs` : "None yet"}</span></div>`
      : "";
    const factItems = [
      ...(choresEnabled && chore ? [`<span><strong>${pointsAvailable ? escapeHtml(formatPoints(points, this._config.product.locale)) : "—"}</strong> points</span>`, `<span><strong>${Number.isFinite(due) ? due : "—"}</strong> due today</span>`] : []),
      ...(schoolEnabled
        ? schoolSource === "calendar"
          ? [`<span><strong>${schoolEventStart ? escapeHtml(formatClassroomDueDay(schoolEventStart, this._config.product.locale, this._config.product.timezone)) : "—"}</strong> next school date</span>`]
          : [`<span><strong>${Number.isFinite(assignmentCount) ? assignmentCount : "—"}</strong> assignments</span>`]
        : [])
    ].join("");
    return `
      <article class="surface family-person ${kidMode ? "is-kid-mode" : ""}" style="--person-colour:${escapeHtml(person.colour)}">
        <div class="family-person-heading"><span>${escapeHtml(person.name.slice(0, 1))}</span><div><p class="eyebrow">${escapeHtml(person.name)}</p><h2>${escapeHtml(presence)}</h2></div></div>
        ${kidMode && choresEnabled && chore ? `<section class="kid-mission ${completedJobs === totalJobs && totalJobs ? "is-complete" : ""}"><span class="kid-mission-orbit progress-ring" style="--progress:${missionProgress}" role="img" aria-label="${missionProgress}% of jobs complete"><span>${missionProgress}%</span></span><div><p>${completedJobs === totalJobs && totalJobs ? "Mission complete!" : "Today’s mission"}</p><strong>${completedJobs} of ${totalJobs} jobs finished</strong></div><ha-icon class="mission-symbol" icon="${completedJobs === totalJobs && totalJobs ? "mdi:trophy-outline" : "mdi:rocket-launch-outline"}" aria-hidden="true"></ha-icon></section>` : ""}
        ${factItems ? `<div class="family-facts">${factItems}</div>` : ""}
        ${choresEnabled && !chore ? '<p class="family-connection-warning"><ha-icon icon="mdi:alert-circle-outline" aria-hidden="true"></ha-icon>ChoreOps is not connected for this child.</p>' : choresEnabled && (!pointsAvailable || !choresSummaryAvailable) ? '<p class="family-connection-warning"><ha-icon icon="mdi:alert-circle-outline" aria-hidden="true"></ha-icon>ChoreOps data is currently unavailable.</p>' : ""}
        <div class="focus-task-workspace ${kidMode ? "is-sectioned" : ""}"><section class="focus-task-jobs ux-section" ${kidMode && (this._taskSection || "jobs") !== "jobs" ? "hidden" : ""}>
        ${choreHeading}
        ${choresEnabled && chore ? choreRows ? `<ul class="chore-list" aria-label="Today’s jobs">${choreRows}</ul>` : '<p class="hub-empty-state compact">No jobs are due yet.</p>' : ""}
        ${classroomStatus}${!kidMode ? this._renderPersonPreparation(person) : ""}</section><section class="focus-task-ready ux-section" ${!kidMode || this._taskSection !== "ready" ? "hidden" : ""}>${kidMode ? this._renderPersonPreparation(person) || '<p class="hub-empty-state compact">No checklists yet. Open a plan in Calendar to add one.</p>' : ""}</section><aside class="focus-task-rewards ux-section" aria-label="Rewards and awards" ${kidMode && this._taskSection !== "rewards" ? "hidden" : ""}>${choreOpsSummary}</aside></div>
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

  _allFootballFixtures() {
    const {index} = this._footballState();
    if (!isEntityAvailable(index)) return [];
    const weeks = index?.attributes?.available_gameweeks || Array.from({length:38},(_,index) => index + 1);
    const fixtures = weeks.flatMap(week => {
      const state = this._hass?.states?.[`${this._config.football.gameweek_entity_prefix}${week}`];
      return isEntityAvailable(state) ? state.attributes?.events || [] : [];
    });
    return [...new Map(fixtures.map(fixture => [fixtureIdentity(fixture),fixture])).values()];
  }

  _clubOverviewModels() {
    const {table} = this._footballState(), fixtures = this._allFootballFixtures();
    return buildFavouriteClubModels(fixtures,this._config.football.spotlight_team_codes,table?.attributes?.rows || []).map(model => {
      const own = fixtures.filter(fixture => fixtureIncludesTeam(fixture,model.code));
      const byTime = (a,b) => new Date(a.kickoff_time) - new Date(b.kickoff_time);
      return {...model,live:own.find(fixture => normaliseFixtureStatus(fixture) === "live"),latest:own.filter(fixture => normaliseFixtureStatus(fixture) === "finished").sort(byTime).at(-1),next:own.filter(fixture => normaliseFixtureStatus(fixture) === "upcoming").sort(byTime)[0]};
    });
  }

  _renderClubOverview(model, compact = false) {
    const result = model.live || model.latest, next = model.next;
    const presentation = this._clubPresentation(model.code);
    const opponent = fixture => footballTeamCode(fixture.home) === model.code ? fixture.away : fixture.home;
    const matchTitle = fixture => compact ? `${compactClubName(fixture.home)} vs ${compactClubName(fixture.away)}` : `vs ${compactClubName(opponent(fixture))}`;
    const score = fixture => compact || footballTeamCode(fixture.home) === model.code ? `${fixture.home_score ?? "–"}–${fixture.away_score ?? "–"}` : `${fixture.away_score ?? "–"}–${fixture.home_score ?? "–"}`;
    const detail = fixture => `${formatDay(fixture.kickoff_time,this._config.product.locale,this._config.product.timezone)} · ${formatTime(fixture.kickoff_time,this._config.product.locale,this._config.product.timezone)}`;
    const resultStatus = model.live ? `LIVE · ${result.minutes || 0}'` : "Latest result · Full time";
    return `<article class="club-overview ${compact ? "is-compact" : ""}" data-favourite-code="${escapeHtml(model.code)}"><header>${this._renderTeamMark(model.team,"favourite")}<div><h2>${escapeHtml(presentation.label)}</h2>${compact ? "" : '<small>Your club</small>'}</div></header>${compact ? "" : `<p class="eyebrow">${escapeHtml(resultStatus)}</p>`}<button type="button" class="club-match-row" data-view="football" ${result ? `data-fixture-id="${escapeHtml(result.id ?? "")}" data-favourite-code="${escapeHtml(model.code)}" data-fixture-status="${normaliseFixtureStatus(result)}"` : ""}><span><strong>${result ? escapeHtml(matchTitle(result)) : "Fixture data unavailable"}</strong><small>${compact ? escapeHtml(result ? resultStatus : "Waiting for fixtures") : result ? escapeHtml(formatDay(result.kickoff_time,this._config.product.locale,this._config.product.timezone)) : "Home Assistant will retry"}</small></span><b>${result ? score(result) : "—"}</b></button><button type="button" class="club-match-row club-next-row" data-view="football" ${next ? `data-fixture-id="${escapeHtml(next.id ?? "")}" data-favourite-code="${escapeHtml(model.code)}" data-fixture-status="upcoming"` : ""}><span><strong>${next ? escapeHtml(compact ? matchTitle(next) : detail(next)) : "Next fixture to be announced"}</strong><small>${next ? escapeHtml(compact ? "Next fixture" : `${footballTeamCode(next.home) === model.code ? "Home against" : "Away at"} ${compactClubName(footballTeamCode(next.home) === model.code ? next.away : next.home)}`) : "No upcoming fixture loaded"}</small></span>${compact && next ? `<small>${escapeHtml(detail(next))}</small>` : outlineIcon("calendar")}</button></article>`;
  }

  _featuredFixtures() {
    const models = this._clubOverviewModels();
    return {title:this._favouriteTitle(models),fixtureCount:new Set(models.flatMap(model => [model.live || model.latest,model.next]).filter(Boolean).map(fixtureIdentity)).size,html:models.map(model => this._renderClubOverview(model,true)).join("")};
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
      <button type="button" class="compact-fixture ${derby ? "is-derby" : ""}" data-view="football" data-fixture-status="${status}" data-fixture-id="${escapeHtml(fixture.id ?? "")}"${favouriteAttribute ? ` data-favourite-code="${escapeHtml(favouriteAttribute)}"` : ""}>
        <span class="compact-team" title="${escapeHtml(fixture.home?.name || "Home")}">${this._renderTeamMark(fixture.home, "small")}<span class="compact-team-name">${escapeHtml(compactClubName(fixture.home))}</span></span>
        <strong class="compact-score">${escapeHtml(score)}</strong>
        <span class="compact-team is-away" title="${escapeHtml(fixture.away?.name || "Away")}">${this._renderTeamMark(fixture.away, "small")}<span class="compact-team-name">${escapeHtml(compactClubName(fixture.away))}</span></span>
        <small class="compact-fixture-detail">${escapeHtml(derby ? `Family derby · ${status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "Full time" : formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)}` : status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "Full time" : formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone))}</small>
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
    if (FOOTBALL_CLUB_PRESENTATION[code]) return FOOTBALL_CLUB_PRESENTATION[code];
    const hue = [...String(code || "CLB")].reduce((total, character, index) => total + character.charCodeAt(0) * (index + 3), 0) % 360;
    return {
      label: code,
      primary: `hsl(${hue} 58% 28%)`,
      accent: `hsl(${(hue + 48) % 360} 72% 76%)`
    };
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

  _renderFplPlayer(player) {
    const bench = player?.bench === true;
    const eventPoints = safeNumber(player?.event_points, 0);
    const contributionPoints = safeNumber(player?.contribution_points, eventPoints);
    const displayedPoints = bench ? eventPoints : contributionPoints;
    const flagged = player?.status && player.status !== "a";
    const badge = player?.captain ? "C" : player?.vice_captain ? "V" : "";
    const name = player?.name || "Player";
    const team = player?.team_code || player?.position || "FPL";
    const crest = teamCrest(player);
    return `<article class="fpl-player ${bench ? "is-bench" : ""} ${flagged ? "is-flagged" : ""}" title="${escapeHtml(`${name} · ${team} · ${displayedPoints} points`)}">
      <span class="fpl-player-mark">${crest ? `<img src="${escapeHtml(crest)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.hidden=true">` : ""}<b>${escapeHtml(team)}</b></span>
      ${badge ? `<i class="fpl-player-badge" aria-label="${player.captain ? "Captain" : "Vice-captain"}">${badge}</i>` : ""}
      ${flagged ? `<ha-icon class="fpl-player-warning" icon="mdi:alert" aria-label="Availability warning"></ha-icon>` : ""}
      <strong>${escapeHtml(name)}</strong>
      <small>${escapeHtml(player?.position || "")}</small>
      <em>${displayedPoints}</em>
    </article>`;
  }

  _renderFplSquad(squad, status = "live") {
    if (!squad.length) return status === "unavailable"
      ? '<p class="hub-empty-state large">Squad data could not be loaded. The manager will retry automatically.</p>'
      : '<p class="hub-empty-state large">The squad will appear after the next football refresh.</p>';
    const starters = squad.filter((player) => !player.bench);
    const bench = squad.filter((player) => player.bench);
    const rows = ["GKP", "DEF", "MID", "FWD"].map((position) => {
      const players = starters.filter((player) => player.position === position);
      return players.length ? `<div class="fpl-pitch-row" data-position="${position}">${players.map((player) => this._renderFplPlayer(player)).join("")}</div>` : "";
    }).join("");
    return `<div class="segments detail-segments squad-segments" role="group" aria-label="Squad selection"><button type="button" class="segment ${this._squadSection !== "bench" ? "is-selected" : ""}" data-squad-section="starters" aria-pressed="${this._squadSection !== "bench"}">Starting eleven</button><button type="button" class="segment ${this._squadSection === "bench" ? "is-selected" : ""}" data-squad-section="bench" aria-pressed="${this._squadSection === "bench"}">Bench · ${bench.length}</button></div><div class="fpl-pitch ux-section" aria-label="Starting eleven" ${this._squadSection === "bench" ? "hidden" : ""}>${rows}</div><div class="fpl-bench ux-section" ${this._squadSection === "bench" ? "" : "hidden"}><p class="eyebrow">Bench</p><div>${bench.map((player) => this._renderFplPlayer(player)).join("")}</div></div>`;
  }

  _renderFplTeams() {
    const entries = this._config.football.entries || [];
    if (!entries.length) return '<div class="football-empty"><span class="football-orbit"><ha-icon icon="mdi:trophy-outline"></ha-icon></span><div><p class="eyebrow">Our FPL teams</p><h3>Add Rob and Ernie’s team IDs in Admin</h3><p>The IDs are the number in each team’s FPL URL. No password or FPL login is needed.</p></div></div>';
    if (!entries.some((entry) => entry.person_id === this._fplEntryId)) this._fplEntryId = entries[0].person_id;
    const selected = entries.find((entry) => entry.person_id === this._fplEntryId) || entries[0];
    const person = this._config.people.find((candidate) => candidate.id === selected.person_id);
    const state = this._hass?.states?.[`sensor.family_dashboard_fpl_${selected.person_id}`];
    const available = isEntityAvailable(state);
    const attributes = state?.attributes || {};
    const rank = safeNumber(attributes.overall_rank, NaN);
    const eventPoints = safeNumber(attributes.gameweek_points, NaN);
    const transfers = safeNumber(attributes.transfers, NaN);
    const transferCost = safeNumber(attributes.transfer_cost, 0);
    const leagues = Array.isArray(attributes.leagues) ? attributes.leagues : [];
    const squad = Array.isArray(attributes.squad) ? attributes.squad : [];
    const squadStatus = attributes.squad_status || (squad.length ? "live" : "unavailable");
    const selectors = entries.map((entry) => {
      const candidate = this._config.people.find((personEntry) => personEntry.id === entry.person_id);
      const selectedEntry = entry.person_id === selected.person_id;
      return `<button type="button" data-fpl-entry="${escapeHtml(entry.person_id)}" class="${selectedEntry ? "is-selected" : ""}" aria-pressed="${selectedEntry}"><span style="--person-colour:${escapeHtml(candidate?.colour || this._config.theme.accent)}">${escapeHtml((candidate?.name || entry.person_id).slice(0, 1))}</span>${escapeHtml(candidate?.name || entry.person_id)}</button>`;
    }).join("");
    const leagueRows = leagues.map((league) => {
      const currentRank = safeNumber(league.rank, NaN);
      const previousRank = safeNumber(league.previous_rank, NaN);
      const movement = Number.isFinite(currentRank) && Number.isFinite(previousRank)
        ? currentRank < previousRank ? "is-up" : currentRank > previousRank ? "is-down" : "is-level"
        : "";
      const movementIcon = movement === "is-up" ? "mdi:arrow-up" : movement === "is-down" ? "mdi:arrow-down" : "mdi:minus";
      return `<span class="${movement}"><strong>${escapeHtml(league.name)}</strong><b>${Number.isFinite(currentRank) ? `#${escapeHtml(formatPoints(currentRank, this._config.product.locale))}` : "—"}</b><ha-icon icon="${movementIcon}" aria-hidden="true"></ha-icon></span>`;
    }).join("");
    return `<section class="fpl-detail" style="--person-colour:${escapeHtml(person?.colour || this._config.theme.accent)}">
      <div class="fpl-entry-selector" role="group" aria-label="Choose fantasy team">${selectors}</div>
      <article class="surface fpl-team-card"><header><span>${escapeHtml((person?.name || selected.person_id).slice(0, 1))}</span><div><p class="eyebrow">${escapeHtml(person?.name || selected.person_id)}</p><h3>${escapeHtml(available ? attributes.team_name || "FPL team" : "Waiting for FPL")}</h3></div><ha-icon icon="mdi:trophy"></ha-icon></header>
        <div class="fpl-scoreboard"><span><strong>${available ? escapeHtml(formatPoints(state.state, this._config.product.locale)) : "—"}</strong><small>Total points</small></span><span><strong>${Number.isFinite(eventPoints) ? eventPoints : "—"}</strong><small>GW ${attributes.gameweek || "—"}</small></span><span><strong>${Number.isFinite(rank) ? `#${escapeHtml(formatPoints(rank, this._config.product.locale))}` : "—"}</strong><small>Overall rank</small></span><span><strong>${Number.isFinite(transfers) ? transfers : "—"}</strong><small>Transfers${transferCost ? ` · −${transferCost}` : ""}</small></span></div>
        ${attributes.active_chip ? `<p class="fpl-chip"><ha-icon icon="mdi:star-circle"></ha-icon>${escapeHtml(titleCase(attributes.active_chip))} active</p>` : ""}
      </article>
      <div class="fpl-detail-grid"><article class="surface fpl-squad-panel"><div class="section-heading"><div><p class="eyebrow">Gameweek ${attributes.gameweek || "—"}</p><h3>Squad points</h3></div>${Number.isFinite(safeNumber(attributes.points_on_bench, NaN)) ? `<span>${safeNumber(attributes.points_on_bench, 0)} on bench</span>` : squadStatus === "cached" ? "<span>Last update</span>" : ""}</div>${this._renderFplSquad(squad, squadStatus)}</article>
      <article class="surface fpl-league-panel"><div class="section-heading"><div><p class="eyebrow">All competitions</p><h3>Leagues</h3></div><span>${leagues.length}</span></div>${leagues.length ? `<div class="fpl-leagues">${leagueRows}</div>` : '<p class="hub-empty-state compact">League positions will appear after the next manager refresh.</p>'}</article></div>
    </section>`;
  }

  _renderFootball() {
    const { index, gameweek, gameweekState, table } = this._footballState();
    const events = gameweekState?.attributes?.events || [];
    const available = index?.attributes?.available_gameweeks || Array.from({ length: 38 }, (_, position) => position + 1);
    const fixtureDataAvailable = isEntityAvailable(index) && isEntityAvailable(gameweekState);
    this._gameweek = gameweek;
    const models = this._clubOverviewModels();
    const tabs = [["fixtures","Fixtures"],["results","Results"],["table","Table"],["fpl","FPL"]];
    const shown = this._footballTab === "results" ? events.filter(fixture => normaliseFixtureStatus(fixture) === "finished") : events;
    return `<section class="football-experience ${this._footballTab === "fpl" ? "is-fpl" : this._footballTab === "table" ? "is-table" : ""}">

      <div class="football-club-overviews">${models.map(model => this._renderClubOverview(model)).join("")}</div>
      <div class="football-layout ${this._footballTab === "fpl" ? "is-fpl" : ""}"><article class="football-main"><div class="segments football-tabs" role="group" aria-label="Football view">${tabs.map(([id,label]) => `<button type="button" class="segment ${this._footballTab === id ? "is-selected" : ""}" data-football-tab="${id}" aria-pressed="${this._footballTab === id}">${label}</button>`).join("")}</div><div class="football-toolbar"><h2>${this._footballTab === "results" ? "Results" : this._footballTab === "table" ? "Premier League" : this._footballTab === "fpl" ? "Our teams" : "Matchweek fixtures"}</h2>${this._footballTab === "fpl" ? "" : `<div class="matchweek-controls"><button type="button" data-gameweek="${Math.max(1,gameweek-1)}" ${gameweek <= 1 ? "disabled" : ""} aria-label="Previous matchweek"><ha-icon icon="mdi:chevron-left"></ha-icon></button><label><span class="sr-only">Choose matchweek</span><select data-gameweek-select>${available.map(week => `<option value="${week}" ${week === gameweek ? "selected" : ""}>Matchweek ${week}</option>`).join("")}</select><ha-icon icon="mdi:chevron-down"></ha-icon></label><button type="button" data-gameweek="${Math.min(38,gameweek+1)}" ${gameweek >= 38 ? "disabled" : ""} aria-label="Next matchweek"><ha-icon icon="mdi:chevron-right"></ha-icon></button></div>`}</div>${this._footballTab === "fpl" ? this._renderFplTeams() : this._footballTab === "table" ? this._renderLeagueTable(table) : this._renderFixtures(shown,fixtureDataAvailable)}</article></div>
    </section>`;
  }

  _renderFixtures(events, available = true) {
    if (!available) return '<p class="hub-empty-state large">Fixture data is unavailable. Home Assistant will retry.</p>';
    if (!events.length) return `
      <div class="football-empty">
        <span class="football-orbit"><ha-icon icon="mdi:soccer" aria-hidden="true"></ha-icon></span>
        <div><p class="eyebrow">Between matchweeks</p><h3>No fixtures yet</h3><p>We’ll show the next match for your favourite clubs here as soon as it is announced.</p></div>
        <div class="empty-clubs"><span>${escapeHtml(this._config.football.spotlight_team_codes[0])}</span><i></i><span>${escapeHtml(this._config.football.spotlight_team_codes[1])}</span></div>
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
      <div data-fixture-id="${escapeHtml(String(fixture.id || fixtureIdentity(fixture)))}" data-fixture-status="${status}" class="fixture ${fixture.spotlight ? "is-spotlight" : ""} ${status === "live" ? "is-live" : ""} ${favouriteCodes.length > 1 ? "is-family-derby" : ""}"${favouriteCodes.length ? ` data-favourite-code="${escapeHtml(favouriteCodes.join(" "))}"` : ""}>
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
    if (this._view === "energy" && this._config.features?.energy !== false) {
      keys.add("energy:electricity");
      keys.add("energy:gas");
    }
    if (this._view === "rooms"
      && this._homeSection === "cleaning"
      && this._config.features?.cleaning
      && this._config.cleaning?.map_entity) keys.add("vacuum-map");
    if (this._view === "entry" && this._config.features?.entry !== false) {
      const cameras = this._config.entry?.cameras || [];
      const selectedId = this._cameraSession?.id
        || this._securityCameraId
        || this._config.entry?.primary_camera_id
        || cameras[0]?.id;
      if (cameras.some((camera) => camera.id === selectedId && camera.still_entity_id)) {
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
        height: "100%",
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
    if (this._view === "energy") {
      for (const fuel of ["electricity", "gas"]) {
        const entityId = this._config.energy?.[fuel]?.usage_today_entity;
        if (!entityId) continue;
        this._ensureChildCard(`energy:${fuel}`, {
          type: "history-graph",
          hours_to_show: 24,
          entities: [entityId]
        }, `energy-history-${fuel}`);
      }
    }
    if (this._view === "entry") {
      const posterConfig = (camera) => ({
        type: "picture-entity",
        entity: camera.still_entity_id,
        camera_view: "auto",
        aspect_ratio: "16:9",
        fit_mode: "cover",
        show_name: false,
        show_state: false,
        tap_action: { action: "none" },
        hold_action: { action: "none" },
        double_tap_action: { action: "none" }
      });
      const selectedId = this._cameraSession?.id
        || this._securityCameraId
        || this._config.entry.primary_camera_id
        || this._config.entry.cameras?.[0]?.id;
      const selected = this._config.entry.cameras.find((camera) => camera.id === selectedId);
      if (selected?.still_entity_id) {
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
      : cameraId
        ? key.startsWith("camera-poster:")
          ? this._controlPolicy.cameras.get(cameraId)?.stillEntity || null
          : this._controlPolicy.cameras.get(cameraId)?.entity || null
        : null;
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
    if (this._photoFrameActive) {
      event.preventDefault();
      this._deactivatePhotoFrame();
      return;
    }
    this._armPhotoFrameIdleTimer();
    if (this._devicePhotoModal) {
      if (event.key === "Escape" && !this._devicePhotoBusy) { event.preventDefault(); this._closeDevicePhotos(); }
      if (event.key === "Tab") {
        const controls = [...this.shadowRoot.querySelectorAll(".device-photos-modal button:not([disabled])")];
        const first = controls[0], last = controls[controls.length - 1], active = this.shadowRoot.activeElement;
        if (event.shiftKey && (active === first || !controls.includes(active))) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && (active === last || !controls.includes(active))) { event.preventDefault(); first?.focus(); }
      }
      return;
    }
    if (this._plannerModal) {
      if (event.key === "Escape") {
        event.preventDefault();
        if (this._plannerModal.type === "heating") this._closeHeatingSchedule();
        else { this._plannerModal = null; this._scheduleRender(true); }
        return;
      }
      if (event.key === "Tab") {
        const controls = [...this.shadowRoot.querySelectorAll('.planner-modal button:not([disabled]),.planner-modal input:not([disabled]),.planner-modal select:not([disabled]),.planner-modal textarea:not([disabled])')];
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
    if (this._devicePhotoModal && event.target === this.shadowRoot.querySelector("[data-device-photo-files]")) {
      const input = event.target;
      const files = Array.from(input.files || []);
      void this._importDevicePhotos(files).finally(() => { input.value = ""; });
      return;
    }
    if (this._devicePhotoModal) return;
    this._armPhotoFrameIdleTimer();
    if (this._pendingConfirmation || this._photoFrameActive) return;
    const cameraPicker = event.target.closest?.("select[data-camera-select]");
    if (cameraPicker) {
      this._selectCamera(cameraPicker.value);
      return;
    }
    const dockPlayer = event.target.closest?.("[data-dock-player]");
    if (dockPlayer) {
      if (this._config.media.players.some((player) => player.entity_id === dockPlayer.value)) {
        this._dockPlayerId = dockPlayer.value;
        this._refreshMusicDock();
      }
      return;
    }
    const dockVolume = event.target.closest?.("[data-dock-volume]");
    if (dockVolume) {
      const entityId = dockVolume.dataset.dockVolume;
      const state = this._hass?.states?.[entityId];
      const volume = Number(dockVolume.value);
      if (!this._config.display.read_only && this._controlPolicy.mediaPlayers.has(entityId)
        && isEntityAvailable(state) && (Number(state.attributes?.supported_features) & 4)
        && Number.isFinite(volume) && volume >= 0 && volume <= 100) {
        this._hass?.callService?.("media_player", "volume_set", { entity_id: entityId, volume_level: volume / 100 });
      }
      return;
    }
    const lightBrightness = event.target.closest?.("[data-light-brightness]");
    if (lightBrightness) {
      const entityId = lightBrightness.dataset.lightBrightness;
      const state = this._hass?.states?.[entityId];
      const name = entityName(state, titleCase(entityId?.split(".")[1]));
      const brightnessPct = Math.max(1, Math.min(100, Math.round(Number(lightBrightness.value))));
      if (!this._config.display.read_only
        && this._controlPolicy.lights.has(entityId)
        && isEntityAvailable(state)
        && lightSupportsBrightness(state, name)
        && Number.isFinite(brightnessPct)) {
        this._hass?.callService?.("light", "turn_on", { entity_id: entityId, brightness_pct: brightnessPct });
      }
      return;
    }
    const cleaningSelect = event.target.closest?.("[data-cleaning-select]");
    if (cleaningSelect) {
      const entityId = cleaningSelect.dataset.cleaningSelect;
      const options = this._hass?.states?.[entityId]?.attributes?.options || [];
      if (!this._config.display.read_only && this._controlPolicy.cleaningSelects.has(entityId) && options.includes(cleaningSelect.value)) {
        this._hass?.callService?.("select", "select_option", { entity_id: entityId, option: cleaningSelect.value });
      }
      return;
    }
    const masterTemperature = event.target.closest?.("[data-master-temperature]");
    if (masterTemperature) {
      const value = Number(masterTemperature.value);
      if (Number.isFinite(value) && value >= 5 && value <= 35) this._masterTemperature = Math.round(value * 2) / 2;
      return;
    }
    const select = event.target.closest?.("[data-gameweek-select]");
    if (select) {
      this._gameweek = Math.max(1, Math.min(38, safeNumber(select.value, 1)));
      this._scheduleRender(true);
    }
  }

  _handleInput(event) {
    const lightBrightness = event.target.closest?.("[data-light-brightness]");
    if (lightBrightness) {
      const brightnessPct = Math.max(1, Math.min(100, Math.round(Number(lightBrightness.value))));
      const dimmer = lightBrightness.closest(".light-dimmer");
      dimmer?.style.setProperty("--light-level", `${brightnessPct}%`);
      const output = dimmer?.querySelector("output");
      if (output) output.textContent = `${brightnessPct}%`;
      return;
    }
    const scheduleInput = event.target.closest?.("[data-schedule-time], [data-schedule-temperature]");
    if (!scheduleInput) return;
    const editor = scheduleInput.closest("[data-schedule-editor]");
    const scope = editor?.dataset.scheduleEditor;
    if (!scope) return;
    const periods = [0, 1, 2, 3].map((stage) => ({
      stage,
      time: editor.querySelector(`[data-schedule-time="${stage}"]`)?.value || "",
      temperature: Number(editor.querySelector(`[data-schedule-temperature="${stage}"]`)?.value)
    }));
    this._heatingScheduleDrafts.set(scope, periods);
  }

  async _callPlannerAction(domain, service, entityId, data = {}) {
    if (!isAllowedPlannerAction(domain, service, entityId, this._config) || typeof this._hass?.callService !== "function") {
      throw new Error("This Family Planner action is not allowed.");
    }
    return this._hass.callService(domain, service, data, { entity_id: entityId });
  }

  async _createPreparationItems(event, template, personIds) {
    const entityId = this._config.calendar.preparation?.todo_entity;
    if (!entityId || !template || !personIds.length) return;
    const eventKey = familyPlannerEventKey(event);
    const existingKeys = new Set(this._preparationItems
      .filter((item) => item?._preparation?.eventKey === eventKey)
      .map((item) => `${item._preparation.personId}|${String(item.summary || item.item || "").trim().toLocaleLowerCase()}`));
    const dueValue = calendarEventStart(event);
    for (const personId of personIds) {
      const person = this._config.people.find((entry) => entry.id === personId && entry.role === "child");
      if (!person) continue;
      for (const item of template.items) {
        const duplicateKey = `${personId}|${String(item).trim().toLocaleLowerCase()}`;
        if (existingKeys.has(duplicateKey)) continue;
        const data = {
          item,
          description: preparationDescription(event, personId, template.id),
          ...(isAllDayCalendarEvent(event) ? { due_date: String(dueValue).slice(0, 10) } : { due_datetime: dueValue })
        };
        await this._callPlannerAction("todo", "add_item", entityId, data);
        existingKeys.add(duplicateKey);
      }
    }
    this._preparationRequestKey = "";
    await this._loadPreparationItems(true);
  }

  async _addPreparationForEvent(eventKey, templateId, personId) {
    const event = this._plannerEventByKey(eventKey);
    const template = this._config.calendar.preparation?.templates?.find((entry) => entry.id === templateId);
    if (!event || !template || !event?._calendar?.person_ids?.includes(personId)) return;
    try {
      await this._createPreparationItems(event, template, [personId]);
    } catch (error) {
      this._preparationError = error?.message || "The preparation checklist could not be created.";
      this._scheduleRender(true);
    }
  }

  async _addCustomPreparationForEvent(eventKey, personId, itemText) {
    const event = this._plannerEventByKey(eventKey);
    const item = String(itemText || "").trim();
    if (!event || !item || !event?._calendar?.person_ids?.includes(personId)) return;
    try {
      await this._createPreparationItems(event, { id: "custom", items: [item] }, [personId]);
    } catch (error) {
      this._preparationError = error?.message || "The Ready item could not be added.";
      this._scheduleRender(true);
    }
  }

  _createdEventMatch(calendar, summary, start) {
    const expectedDate = dateKey(start, this._config.product.timezone);
    return [...this._calendarEvents].reverse().find((event) => event?._calendar?.entity_id === calendar.entity_id
      && String(event.summary || "").trim().toLocaleLowerCase() === summary.trim().toLocaleLowerCase()
      && dateKey(calendarEventStart(event), this._config.product.timezone) === expectedDate) || null;
  }

  async _togglePreparationItem(itemId, status) {
    const entityId = this._config.calendar.preparation?.todo_entity;
    const item = this._preparationItems.find((entry) => String(entry.uid || entry.id || entry.summary) === itemId);
    if (this._config.display.read_only || !entityId || !item || !["completed", "needs_action"].includes(status)) return;
    const previousStatus = item.status;
    item.status = status;
    this._scheduleRender(true);
    try {
      await this._callPlannerAction("todo", "update_item", entityId, { item: itemId, status });
      this._preparationRequestKey = "";
      await this._loadPreparationItems(true);
    } catch (error) {
      item.status = previousStatus;
      this._preparationError = error?.message || "The checklist item could not be updated.";
      this._scheduleRender(true);
    }
  }

  async _removePreparationItem(itemId) {
    const entityId = this._config.calendar.preparation?.todo_entity;
    const item = this._preparationItems.find((entry) => String(entry.uid || entry.id || entry.summary) === itemId);
    if (!entityId || !item) return;
    try {
      await this._callPlannerAction("todo", "remove_item", entityId, { item: itemId });
      this._preparationRequestKey = "";
      await this._loadPreparationItems(true);
    } catch (error) {
      this._preparationError = error?.message || "The Ready item could not be removed.";
      this._scheduleRender(true);
    }
  }

  async _savePlannerEvent() {
    if (this._plannerModal?.type !== "add" || this._plannerModal.saving) return;
    const field = (name) => this.shadowRoot.querySelector(`[data-planner-field="${name}"]`)?.value?.trim?.() || "";
    const calendarEntity = field("calendar");
    const calendar = this._config.calendar.entities.find((entry) => entry.entity_id === calendarEntity && entry.allow_create === true);
    const summary = field("summary");
    const date = field("date");
    const startTime = field("start");
    const endTime = field("end");
    const location = field("location");
    const templateId = field("template");
    const customItems = field("custom-items").split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean).slice(0, 20);
    if (!calendar || !summary || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
      this._plannerModal.error = "Choose a calendar and enter the event, date, start and end time.";
      this._scheduleRender(true);
      return;
    }
    const start = `${date}T${startTime}:00`;
    const end = `${date}T${endTime}:00`;
    if (end <= start) {
      this._plannerModal.error = "The end time must be after the start time.";
      this._scheduleRender(true);
      return;
    }
    this._plannerModal.saving = true;
    this._plannerModal.error = "";
    this._scheduleRender(true);
    try {
      await this._callPlannerAction("calendar", "create_event", calendar.entity_id, {
        summary,
        start_date_time: start,
        end_date_time: end,
        ...(location ? { location } : {})
      });
      const syntheticEvent = { summary, start, end, location, _calendar: calendar };
      this._calendarRequestKey = "";
      await this._loadCalendarEvents(true);
      const event = this._createdEventMatch(calendar, summary, start) || syntheticEvent;
      const template = this._config.calendar.preparation?.templates?.find((entry) => entry.id === templateId);
      const childIds = calendar.person_ids.filter((personId) => this._config.people.some((person) => person.id === personId && person.role === "child"));
      if (template && childIds.length) {
        await this._createPreparationItems(event, template, childIds);
      }
      if (customItems.length && childIds.length) await this._createPreparationItems(event, { id: "custom", items: customItems }, childIds);
      this._plannerModal = null;
      this._calendarRequestKey = "";
      await this._loadCalendarEvents(true);
      this._scheduleRender(true);
    } catch (error) {
      this._plannerModal.saving = false;
      this._plannerModal.error = error?.message || "The event could not be added to Apple Calendar.";
      this._scheduleRender(true);
    }
  }

  _handleClick(event) {
    const target = event.target.closest?.("button, [data-room]");
    if (!target) return;
    if (this._photoFrameActive || target.dataset.photoFrameDismiss !== undefined) {
      this._deactivatePhotoFrame();
      return;
    }
    if (this._devicePhotoModal) {
      if (this._devicePhotoBusy) return;
      if (target.dataset.devicePhotosClose !== undefined) this._closeDevicePhotos();
      else if (target.dataset.devicePhotosAdd !== undefined) this.shadowRoot.querySelector("[data-device-photo-files]")?.click();
      else if (target.dataset.devicePhotoSource) void this._changeDevicePhotoSource(target.dataset.devicePhotoSource);
      else if (target.dataset.devicePhotoRemove) void this._removeDevicePhoto(target.dataset.devicePhotoRemove);
      else if (target.dataset.devicePhotosPreview !== undefined) { this._closeDevicePhotos(); this._activatePhotoFrame(); }
      return;
    }
    if (target.dataset.devicePhotosOpen !== undefined && !this._pendingConfirmation && !this._plannerModal && this._photoFrameConfig()) {
      void this._openDevicePhotos(); return;
    }
    this._armPhotoFrameIdleTimer();
    if (this._plannerModal?.type === "heating") {
      if (target.dataset.plannerClose !== undefined) this._closeHeatingSchedule();
      else if (target.dataset.heatingScheduleApply) void this._saveHeatingSchedule(target.dataset.heatingScheduleApply);
      return;
    }
    if (this._plannerModal) {
      if (target.dataset.plannerClose !== undefined) {
        this._plannerModal = null;
        this._scheduleRender(true);
        void this._loadCalendarEvents(true);
      } else if (target.dataset.plannerSave !== undefined) {
        void this._savePlannerEvent();
      } else if (target.dataset.prepItem) {
        void this._togglePreparationItem(target.dataset.prepItem, target.dataset.prepStatus);
      } else if (target.dataset.removePrepItem) {
        void this._removePreparationItem(target.dataset.removePrepItem);
      } else if (target.dataset.addPreparation) {
        void this._addPreparationForEvent(target.dataset.addPreparation, target.dataset.preparationTemplate, target.dataset.preparationPerson);
      } else if (target.dataset.addEventTemplate) {
        const templateId = this.shadowRoot.querySelector('[data-planner-field="event-template"]')?.value || "";
        const personId = this.shadowRoot.querySelector('[data-planner-field="event-person"]')?.value || "";
        if (templateId && personId) void this._addPreparationForEvent(target.dataset.addEventTemplate, templateId, personId);
      } else if (target.dataset.addEventCustom) {
        const input = this.shadowRoot.querySelector('[data-planner-field="event-custom-item"]');
        const personId = this.shadowRoot.querySelector('[data-planner-field="event-person"]')?.value || "";
        if (input?.value?.trim() && personId) {
          void this._addCustomPreparationForEvent(target.dataset.addEventCustom, personId, input.value);
          input.value = "";
        }
      }
      return;
    }
    // Navigation remains local; checklist writes use the existing bounded
    // to-do action path shared with the event editor.
    if (this._pendingConfirmation && !target.dataset.confirmAction) return;
    for (const [key, property, allowed] of [
      ["roomSection", "_roomDetailSection", ["lights", "comfort", "scenes", "music"]],
      ["taskSection", "_taskSection", ["jobs", "ready", "rewards"]],
      ["cleaningSection", "_cleaningSection", ["clean", "settings", "care"]],
      ["squadSection", "_squadSection", ["starters", "bench"]]
    ]) {
      if (target.dataset[key] === undefined) continue;
      if (allowed.includes(target.dataset[key])) {
        this[property] = target.dataset[key];
        this._scheduleRender(true);
      }
      return;
    }
    if (target.dataset.heatingScheduleOpen) {
      this._openHeatingSchedule(target.dataset.heatingScheduleOpen);
      return;
    }
    if (target.dataset.focusHomeRoom) {
      if (!this._config.features.rooms || !this._config.rooms.some((room) => room.id === target.dataset.focusHomeRoom)) return;
      if (this._view === "entry") this._closeActiveCamera({ render: false, invalidate: true });
      this._view = "rooms";
      this._homeSection = "rooms";
      this._selectRoom(target.dataset.focusHomeRoom, { section: target.dataset.roomSectionTarget });
      return;
    }
    if (target.dataset.focusTasks) {
      if (!this._config.features.family || !this._config.people.some((person) => person.role === "child" && person.id === target.dataset.focusTasks)) return;
      this._view = "family";
      this._familyPersonId = target.dataset.focusTasks;
      this._taskSection = target.dataset.taskTarget === "ready" ? "ready" : "jobs";
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.focusOpenPlan) {
      const plan = this._plannerEventByKey(target.dataset.focusOpenPlan);
      if (!this._config.features.calendar || !plan) return;
      this._view = "calendar";
      this._calendarAnchorKey = dateKey(calendarEventStart(plan), this._config.product.timezone);
      this._calendarSelectedKey = this._calendarAnchorKey;
      this._calendarFocusEvent = target.dataset.focusOpenPlan;
      this._scheduleRender(true);
      void this._loadCalendarEvents(true);
      return;
    }
    if (target.dataset.calendarDay) {
      if (this._calendarWindow().some((day) => day.key === target.dataset.calendarDay)) {
        this._calendarSelectedKey = target.dataset.calendarDay;
        this._calendarFocusEvent = null;
        this._scheduleRender(true);
      }
      return;
    }
    if (target.dataset.calendarFocus) {
      const plan = this._plannerEventByKey(target.dataset.calendarFocus);
      if (plan) {
        this._calendarSelectedKey = dateKey(calendarEventStart(plan), this._config.product.timezone);
        this._calendarFocusEvent = target.dataset.calendarFocus;
        this._scheduleRender(true);
      }
      return;
    }
    if (target.dataset.focusAddPrep) {
      const input = [...this.shadowRoot.querySelectorAll("[data-focus-prep-input]")].find(node => node.dataset.focusPrepInput === target.dataset.focusAddPrep);
      if (input?.value?.trim()) {
        void this._addCustomPreparationForEvent(target.dataset.focusAddPrep,target.dataset.preparationPerson,input.value);
        input.value = "";
      }
      return;
    }
    if (target.dataset.addPreparation) {
      void this._addPreparationForEvent(target.dataset.addPreparation, target.dataset.preparationTemplate, target.dataset.preparationPerson);
      return;
    }
    if (target.dataset.plannerAddEvent !== undefined) {
      this._plannerModal = { type: "add", saving: false, error: "" };
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.plannerEvent) {
      this._plannerModal = { type: "event", eventKey: target.dataset.plannerEvent };
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.calendarPerson) {
      const allowed = new Set(["all", ...this._config.people.map((person) => person.id)]);
      if (allowed.has(target.dataset.calendarPerson)) this._calendarPersonFilter = target.dataset.calendarPerson;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.calendarNav) {
      this._moveCalendar(target.dataset.calendarNav);
      return;
    }
    if (target.dataset.calendarRefresh !== undefined) {
      this._calendarRequestKey = "";
      void this._loadCalendarEvents(true);
      return;
    }
    if (target.dataset.prepItem) {
      void this._togglePreparationItem(target.dataset.prepItem, target.dataset.prepStatus);
      return;
    }
    if (target.dataset.familyPerson) {
      if (this._config.people.some((person) => person.id === target.dataset.familyPerson && person.role === "child")) {
        this._familyPersonId = target.dataset.familyPerson;
        this._choreClaimFeedback = null;
        this._scheduleRender(true);
      }
      return;
    }
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
      if (this._view === "calendar") {
        this._calendarAnchorKey = this._calendarAnchorKey || dateKey(new Date(), this._config.product.timezone);
        this._calendarRequestKey = "";
        void this._loadCalendarEvents(true);
      }
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
      this._calendarRequestKey = "";
      this._childMountGeneration += 1;
      this._pruneInactiveChildCards();
      this._scheduleRender(true);
      void this._loadCalendarEvents(true);
      return;
    }
    if (target.dataset.floor) {
      this._floor = target.dataset.floor;
      this._roomDetailSection = "lights";
      this._room = this._config.floorplan.floors.find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || null;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.room) {
      this._selectRoom(target.dataset.room);
      return;
    }
    if (target.dataset.footballTab) {
      if (!new Set(["fixtures", "results", "table", "fpl"]).has(target.dataset.footballTab)) return;
      this._footballTab = target.dataset.footballTab;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.fplEntry) {
      const allowedEntries = new Set((this._config.football?.entries || []).map((entry) => entry.person_id));
      if (!allowedEntries.has(target.dataset.fplEntry)) return;
      this._fplEntryId = target.dataset.fplEntry;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.gameweek) {
      this._gameweek = safeNumber(target.dataset.gameweek, 1);
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.cameraSelect) {
      this._selectCamera(target.dataset.cameraSelect);
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
    if (target.dataset.choreClaim) {
      void this._claimChore(target.dataset.personId, target.dataset.choreStatus, target.dataset.choreClaim);
      return;
    }
    if (target.dataset.rewardClaim) {
      void this._claimReward(target.dataset.personId, target.dataset.rewardStatus, target.dataset.rewardClaim);
      return;
    }
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
    if (target.dataset.roomLights) {
      const room = this._config.rooms.find((entry) => entry.id === target.dataset.roomLights);
      const service = target.dataset.lightService;
      const entityIds = (room?.lights || []).filter((entityId) => this._controlPolicy.lights.has(entityId) && isEntityAvailable(this._hass?.states?.[entityId]));
      if (["turn_on", "turn_off"].includes(service) && entityIds.length) this._hass?.callService?.("light", service, { entity_id: entityIds });
      return;
    }
    if (target.dataset.allInternalLights !== undefined) {
      const exterior = new Set(this._config.home?.exterior_lights || []);
      const entityIds = [...this._controlPolicy.lights].filter((entityId) => !exterior.has(entityId) && isEntityAvailable(this._hass?.states?.[entityId]));
      if (entityIds.length) this._hass?.callService?.("light", "turn_off", { entity_id: entityIds });
      return;
    }
    if (target.dataset.masterTemperatureAdjust) {
      const adjustment = Number(target.dataset.masterTemperatureAdjust);
      if (![-0.5, 0.5].includes(adjustment)) return;
      this._masterTemperature = Math.max(5, Math.min(35, Math.round((this._masterTemperature + adjustment) * 2) / 2));
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.climateMaster) {
      const service = target.dataset.climateMaster;
      const entityIds = [...this._controlPolicy.climates].filter((entityId) => isEntityAvailable(this._hass?.states?.[entityId]));
      if (service === "set_temperature" && entityIds.length) {
        const input = this.shadowRoot.querySelector("[data-master-temperature]");
        const temperature = Math.round(Number(input?.value) * 2) / 2;
        if (Number.isFinite(temperature) && temperature >= 5 && temperature <= 35) {
          this._masterTemperature = temperature;
          this._hass?.callService?.("climate", "set_temperature", { entity_id: entityIds, temperature });
        }
      } else if (CLIMATE_POWER_SERVICES.has(service) && entityIds.length) {
        this._hass?.callService?.("climate", service, { entity_id: entityIds });
      }
      return;
    }
    if (target.dataset.cleaningCommand) {
      const entityId = target.dataset.cleaningCommand;
      if (this._controlPolicy.cleaningButtons.has(entityId) && isCommandEntityAvailable(this._hass?.states?.[entityId])) {
        this._hass?.callService?.("button", "press", { entity_id: entityId });
      }
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
    if (target.dataset.mediaService) {
      const capabilities = { media_previous_track: 16, media_next_track: 32 };
      const state = this._hass?.states?.[target.dataset.entity];
      const capability = capabilities[target.dataset.mediaService];
      if (capability && this._controlPolicy.mediaPlayers.has(target.dataset.entity)
        && isEntityAvailable(state) && (Number(state.attributes?.supported_features) & capability)) {
        this._hass?.callService?.("media_player", target.dataset.mediaService, { entity_id: target.dataset.entity });
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

  async _claimChore(personId, statusEntityId, claimEntityId) {
    const user = this._config.chores?.users?.find((entry) => entry.person_id === personId);
    const allowed = user?.status_entities?.includes(statusEntityId)
      && claimEntityId === choreClaimEntityId(statusEntityId)
      && isCommandEntityAvailable(this._hass?.states?.[claimEntityId]);
    if (!allowed || this._config.display.read_only || this._pendingChoreClaims.has(claimEntityId)) return;
    this._pendingChoreClaims.add(claimEntityId);
    this._choreClaimFeedback = null;
    this._scheduleRender(true);
    let successful = false;
    try {
      await this._hass.callService("button", "press", { entity_id: claimEntityId });
      successful = true;
      this._choreClaimFeedback = "Nice work — a grown-up can approve that job now.";
    } catch {
      this._choreClaimFeedback = "That job could not be saved. Please ask a grown-up to try again.";
    } finally {
      if (successful) this._releaseClaimCooldown(claimEntityId);
      else this._pendingChoreClaims.delete(claimEntityId);
      this._scheduleRender(true);
    }
  }

  async _claimReward(personId, statusEntityId, claimEntityId) {
    const user = this._config.chores?.users?.find((entry) => entry.person_id === personId);
    const allowed = user?.reward_status_entities?.includes(statusEntityId)
      && claimEntityId === rewardClaimEntityId(statusEntityId)
      && isCommandEntityAvailable(this._hass?.states?.[claimEntityId]);
    if (!allowed || this._config.display.read_only || this._pendingChoreClaims.has(claimEntityId)) return;
    this._pendingChoreClaims.add(claimEntityId);
    this._choreClaimFeedback = null;
    this._scheduleRender(true);
    let successful = false;
    try {
      await this._hass.callService("button", "press", { entity_id: claimEntityId });
      successful = true;
      this._choreClaimFeedback = "Reward requested — a grown-up can approve it now.";
    } catch {
      this._choreClaimFeedback = "That reward could not be requested. Please ask a grown-up to try again.";
    } finally {
      if (successful) this._releaseClaimCooldown(claimEntityId);
      else this._pendingChoreClaims.delete(claimEntityId);
      this._scheduleRender(true);
    }
  }

  _releaseClaimCooldown(claimEntityId) {
    const timer = setTimeout(() => {
      this._pendingChoreClaims.delete(claimEntityId);
      this._scheduleRender(true);
    }, 2500);
    timer?.unref?.();
  }

  _selectCamera(cameraId) {
    if (this._view !== "entry" || this._cameraSession?.phase === "stopping" || this._cameraRecoveryPromise
      || !this._config.entry.cameras.some((camera) => camera.id === cameraId)) return;
    if (this._securityCameraId === cameraId) return;
    this._securityCameraId = cameraId;
    // Browsing cameras never wakes a stream. An owned view closes before switching.
    if (this._cameraSession) this._closeActiveCamera();
    this._scheduleRender(true);
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

  _selectRoom(roomId, { section = "lights" } = {}) {
    const room = this._config.rooms.find((entry) => entry.id === roomId);
    if (!room) return;
    this._room = roomId;
    this._roomDetailSection = section;
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

  _responsiveViewportKey() {
    const width = globalThis.innerWidth || 0;
    const height = globalThis.innerHeight || 0;
    // Bound stylesheet variants to the existing breakpoints, rather than each pixel.
    return [480, 760, 850, 900, 1030, 1120, 1180, 1279].map((limit) => Number(width <= limit)).join("") + (width <= height ? "p" : "l");
  }

  _styles() {
    const styles = `
      /* Responsive layout: ${this._responsiveViewportKey()} */
      :host { --family-ha-header-offset:var(--header-height,56px); --hub-focus:#0B57C7; display:block; width:100%; min-width:0; min-height:664px; height:calc(100vh - var(--family-ha-header-offset)); margin-top:var(--family-ha-header-offset); color:var(--primary-text-color); font-family:var(--family-font-family,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif); }
      *, *::before, *::after { box-sizing:border-box; }
      button, select { font:inherit; }
      button { -webkit-tap-highlight-color:transparent; }
      .hub-card { position:relative; display:block; overflow:hidden; border:0; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); color:var(--hub-text); min-height:100%; height:100%; }
      .photo-frame { position:absolute; inset:0; z-index:100; width:100%; height:100%; min-height:100%; padding:0; overflow:hidden; border:0; border-radius:inherit; background:#05070b; color:#fff; cursor:pointer; text-align:left; }
      .photo-frame img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
      .photo-frame img.is-revealing { animation:photo-frame-reveal .65s ease both; }
      .photo-frame-shade { position:absolute; inset:0; background:linear-gradient(180deg,rgba(0,0,0,.06) 48%,rgba(0,0,0,.64)); pointer-events:none; }
      .photo-frame-status { position:absolute; inset:0; display:grid; place-items:center; padding:32px; color:rgba(255,255,255,.78); font-size:15px; text-align:center; }
      .photo-frame-status[hidden] { display:none; }
      .photo-frame-clock { position:absolute; left:32px; bottom:30px; display:grid; gap:2px; filter:drop-shadow(0 2px 8px rgba(0,0,0,.48)); }
      .photo-frame-clock strong { font-size:46px; line-height:1; letter-spacing:-.04em; }
      .photo-frame-clock span { font-size:14px; font-weight:500; }
      .photo-frame-hint { position:absolute; right:28px; bottom:30px; min-height:40px; padding:0 14px; display:flex; align-items:center; gap:8px; border:1px solid rgba(255,255,255,.32); border-radius:14px; background:rgba(5,7,11,.38); color:rgba(255,255,255,.88); font-size:11px; font-weight:500; -webkit-backdrop-filter:blur(12px); backdrop-filter:blur(12px); }
      .photo-frame-hint ha-icon { --mdc-icon-size:18px; }
      @keyframes photo-frame-reveal { from { opacity:.18; transform:scale(1.012); } to { opacity:1; transform:scale(1); } }
      .hub-shell { display:grid; grid-template-columns:86px minmax(0,1fr); min-height:100%; height:100%; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); }
      .hub-navigation { padding:14px 9px; background:linear-gradient(180deg,color-mix(in srgb,var(--hub-nav) 96%,transparent),color-mix(in srgb,var(--hub-nav) 86%,var(--hub-accent))); border-right:1px solid rgba(255,255,255,.1); display:flex; flex-direction:column; gap:14px; min-height:0; }
      .hub-brand { width:54px; height:54px; margin:0 auto; border-radius:50%; border:1px solid rgba(255,255,255,.45); background:rgba(255,255,255,.12); color:#fff; font-size:24px; font-weight:500; cursor:pointer; }
      .hub-nav-items { display:flex; min-height:0; flex:1; flex-direction:column; justify-content:center; gap:8px; }
      .hub-nav-button { min-height:64px; border:1px solid transparent; border-radius:20px; background:transparent; color:rgba(255,255,255,.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; }
      .hub-nav-button ha-icon { --mdc-icon-size:22px; }
      .hub-nav-button span { font-size:10px; font-weight:500; }
      .hub-nav-button.is-active { color:#fff; background:linear-gradient(145deg,var(--hub-backdrop-end),var(--hub-accent)); border-color:rgba(255,255,255,.35); box-shadow:0 10px 24px rgba(13,18,34,.28); }
      .hub-content { min-width:0; min-height:0; padding:12px 18px 16px; display:grid; grid-template-rows:56px minmax(0,1fr); gap:10px; background:linear-gradient(135deg,rgba(17,28,51,.18),rgba(183,101,98,.12)); }
      .hub-topbar { min-width:0; display:flex; justify-content:space-between; align-items:center; color:#fff; padding:0 4px; }
      .hub-topbar h1 { margin:2px 0 0; font-size:30px; line-height:1; font-weight:500; }
      .eyebrow { margin:0; font-size:10px; line-height:1.2; font-weight:500; letter-spacing:.13em; text-transform:uppercase; color:var(--hub-muted); }
      .hub-topbar .eyebrow { color:rgba(255,255,255,.72); }
      .hub-header-actions { display:flex; align-items:center; gap:9px; }
      .preview-pill { min-height:36px; padding:0 12px; border:1px solid rgba(255,255,255,.34); border-radius:14px; display:flex; align-items:center; gap:7px; background:rgba(255,255,255,.13); color:#fff; font-size:11px; font-weight:500; }
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
      .text-action,.section-heading > button { width:max-content; border:0; padding:5px 0; background:transparent; color:var(--hub-accent); font-size:12px; font-weight:500; cursor:pointer; }
      .children-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .football-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .now-playing-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .section-heading h2 { margin:4px 0 0; font-size:19px; }
      .section-heading > span { color:var(--hub-muted); font-size:11px; }
      .person-summary-list { display:grid; gap:8px; margin-top:14px; }
      .person-summary { width:100%; border:0; background:color-mix(in srgb,var(--person-colour) 9%,var(--hub-surface)); padding:10px; border-radius:15px; display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:9px; text-align:left; color:var(--hub-text); cursor:pointer; }
      .person-initial { width:34px; height:34px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; font-weight:500; }
      .person-summary strong,.person-summary small { display:block; }
      .person-summary small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .points { font-size:11px; font-weight:500; color:var(--person-colour); }
      .today-ready-preview { min-height:0; margin-top:10px; display:grid; gap:6px; }
      .today-ready-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .today-ready-heading span,.today-ready-heading strong,.today-ready-heading small { display:block; }
      .today-ready-heading strong { font-size:12px; }
      .today-ready-heading small { margin-top:1px; color:var(--hub-muted); font-size:9px; }
      .today-ready-heading b { padding:4px 7px; border-radius:999px; background:color-mix(in srgb,var(--hub-accent) 11%,var(--hub-surface)); color:var(--hub-accent); font-size:10px; }
      .today-ready-list { display:grid; gap:5px; }
      .today-ready-item { min-width:0; min-height:40px; padding:4px 7px; display:grid; grid-template-columns:28px minmax(0,1fr); align-items:center; gap:7px; border:1px solid color-mix(in srgb,var(--person-colour) 20%,transparent); border-radius:11px; background:color-mix(in srgb,var(--person-colour) 7%,var(--hub-surface)); color:var(--hub-text); text-align:left; cursor:pointer; }
      .today-ready-item > span { width:27px; height:27px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb,var(--person-colour) 14%,var(--hub-surface)); color:var(--person-colour); }
      .today-ready-item ha-icon { --mdc-icon-size:17px; }
      .today-ready-item strong,.today-ready-item small { display:block; min-width:0; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
      .today-ready-item strong { font-size:11px; }
      .today-ready-item small { margin-top:2px; color:var(--hub-muted); font-size:9px; }
      .today-ready-item.is-complete { opacity:.7; }
      .today-ready-item.is-complete > span { background:#1B9A6B; color:#fff; }
      .today-ready-item.is-complete strong { text-decoration:line-through; }
      .today-ready-more { width:max-content; min-height:28px; padding:0; display:flex; align-items:center; gap:3px; border:0; background:transparent; color:var(--hub-accent); font-size:10px; font-weight:500; cursor:pointer; }
      .today-ready-more ha-icon { --mdc-icon-size:14px; }
      .person-summary-list.has-ready-preview { margin-top:7px; grid-template-columns:repeat(2,minmax(0,1fr)); gap:5px; }
      .person-summary-list.has-ready-preview .person-summary { min-height:38px; padding:4px 7px; grid-template-columns:28px minmax(0,1fr); }
      .person-summary-list.has-ready-preview .person-initial { width:27px; height:27px; font-size:11px; }
      .person-summary-list.has-ready-preview .points { display:none; }
      .person-summary-list.has-ready-preview .person-summary strong { font-size:11px; }
      .person-summary-list.has-ready-preview .person-summary small { font-size:9px; }
      .featured-fixtures { display:grid; gap:8px; margin-top:12px; }
      .compact-fixture { position:relative; overflow:hidden; border:1px solid color-mix(in srgb,var(--hub-accent) 18%,transparent); border-radius:15px; background:var(--hub-surface); min-height:70px; padding:8px 12px; color:var(--hub-text); display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:7px; align-items:center; cursor:pointer; }
      .compact-team { min-width:0; display:flex; align-items:center; gap:6px; overflow:hidden; font-size:10px; font-weight:500; }
      .compact-team-name { min-width:0; white-space:normal; overflow-wrap:anywhere; }
      .compact-team.is-away { justify-content:flex-end; text-align:right; }
      .compact-score { min-width:52px; font-size:14px; text-align:center; }
      .compact-fixture-detail { grid-column:1/-1; color:var(--hub-muted); font-size:9px; text-align:center; }
      .compact-fixture.is-derby::before,.compact-fixture.is-derby::after { content:""; position:absolute; inset-block:0; width:4px; }
      .compact-fixture.is-derby::before { left:0; background:#132257; }
      .compact-fixture.is-derby::after { right:0; background:#670E36; }
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
      .heating-power { flex:0 0 auto; min-width:58px; min-height:44px; margin-left:auto; padding:0 10px; border:1px solid rgba(255,255,255,.12); border-radius:13px; background:rgba(8,15,31,.48); color:var(--hub-muted); display:flex; align-items:center; justify-content:center; gap:5px; font-size:10px; font-weight:500; cursor:pointer; }
      .heating-power ha-icon { --mdc-icon-size:16px; }
      .heating-power.is-on { border-color:rgba(242,184,92,.36); background:rgba(128,88,29,.25); color:#f5d493; }
      .heating-power:disabled { opacity:.5; cursor:not-allowed; }
      .heating-body { min-width:0; display:grid; grid-template-columns:minmax(72px,.72fr) minmax(150px,1.28fr); align-items:end; gap:14px; padding-top:13px; border-top:1px solid rgba(255,255,255,.1); }
      .heating-current,.heating-target-control { min-width:0; }
      .heating-current small,.heating-target-control > small { display:block; color:var(--hub-muted); font-size:10px; font-weight:500; letter-spacing:.02em; }
      .heating-current-value { display:block; margin-top:5px; color:var(--hub-text); font-size:30px; line-height:.95; letter-spacing:-.04em; }
      .heating-target-control { width:100%; justify-self:end; }
      .heating-stepper { min-width:0; margin-top:5px; display:grid; grid-template-columns:44px minmax(48px,1fr) 44px; align-items:center; overflow:hidden; border:1px solid rgba(255,255,255,.09); border-radius:12px; background:rgba(255,255,255,.075); }
      .heating-stepper button,.heating-target-value { min-height:44px; border:0; background:transparent; color:#c8bcff; }
      .heating-stepper button { width:44px; height:44px; padding:0; display:grid; place-items:center; border-radius:0; font-size:18px; font-weight:500; cursor:pointer; }
      .heating-stepper button:first-child { border-radius:11px 0 0 11px; }
      .heating-stepper button:last-child { border-radius:0 11px 11px 0; }
      .heating-stepper button:disabled { cursor:not-allowed; opacity:.48; }
      .heating-target-value { display:grid; place-items:center; border-width:0 1px; border-style:solid; border-color:rgba(255,255,255,.09); color:var(--hub-text); font-size:19px; font-weight:500; }
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
      .cover-actions button { min-width:0; min-height:42px; border:0; border-radius:12px; background:rgba(255,255,255,.08); color:#c8bcff; display:flex; align-items:center; justify-content:center; gap:4px; font-size:9px; font-weight:500; cursor:pointer; }
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
      .cleaning-actions button { min-height:46px; padding:0 16px; border:0; border-radius:14px; background:color-mix(in srgb,var(--hub-accent) 18%,rgba(8,15,31,.72)); color:#d8d0ff; display:flex; align-items:center; gap:6px; font-weight:500; cursor:pointer; }
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
      .energy-status { min-height:34px; padding:0 10px; display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.11); border-radius:12px; color:var(--hub-muted); font-size:10px; font-weight:500; }
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
      .segment { min-height:32px; padding:0 12px; border:0; border-radius:10px; background:transparent; color:var(--hub-muted); font-size:11px; font-weight:500; white-space:nowrap; cursor:pointer; }
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
      .stepper button,.cover-control button { width:36px; height:36px; border:0; border-radius:11px; background:var(--hub-surface); color:var(--hub-accent); font-weight:500; cursor:pointer; }
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
      .family-person-heading > span { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; background:var(--person-colour); color:#fff; font-weight:500; }
      .family-person-heading h2 { margin:3px 0 0; font-size:16px; }
      .family-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:15px; }
      .family-facts span { padding:8px; border-radius:12px; background:color-mix(in srgb,var(--person-colour) 8%,var(--hub-surface)); color:var(--hub-muted); font-size:9px; }
      .family-facts strong { display:block; color:var(--hub-text); font-size:16px; }
      .assignment { display:flex; gap:8px; margin-top:13px; padding-top:12px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 16%,transparent); }
      .assignment > div { min-width:0; }
      .assignment strong,.assignment small,.assignment a { display:block; }
      .assignment a { color:var(--hub-accent); font-weight:500; text-decoration-thickness:1px; text-underline-offset:3px; overflow-wrap:anywhere; }
      .assignment small { margin-top:3px; color:var(--hub-muted); font-size:9px; }
      .classroom-health { margin-top:7px; display:flex; align-items:center; gap:5px; color:var(--hub-muted); font-size:10px; font-weight:500; line-height:1.3; }
      .classroom-health ha-icon { flex:0 0 auto; --mdc-icon-size:15px; }
      .classroom-health.is-stale { color:#9b6400; }
      .classroom-locked { opacity:.82; }
      .security-layout { position:relative; height:100%; min-height:0; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(260px,.72fr); gap:14px; }
      .security-main { min-height:0; display:grid; grid-template-rows:repeat(2,minmax(0,1fr)); gap:14px; }
      .security-camera { min-height:0; padding:17px; display:grid; grid-template-rows:auto auto minmax(0,1fr); gap:11px; overflow:hidden; }
      .security-card-heading { display:flex; align-items:center; justify-content:space-between; gap:12px; }
      .security-card-heading h2 { margin:4px 0 0; font-size:19px; }
      .privacy-badge { min-height:34px; padding:0 10px; border:1px solid rgba(255,255,255,.11); border-radius:10px; background:rgba(255,255,255,.06); color:var(--hub-muted); display:flex; align-items:center; gap:5px; font-size:12px; font-weight:500; white-space:nowrap; }
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
      .camera-idle button,.camera-close { min-height:44px; padding:0 13px; border:0; border-radius:12px; background:var(--hub-accent); color:#fff; display:flex; align-items:center; gap:5px; font-size:12px; font-weight:500; cursor:pointer; }
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
      .camera-stream-overlay button { min-height:44px; margin-top:12px; padding:0 14px; border:1px solid rgba(255,255,255,.24); border-radius:12px; background:rgba(255,255,255,.1); color:#fff; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:500; cursor:pointer; }
      .camera-stream-overlay button ha-icon { --mdc-icon-size:18px; }
      .camera-live-indicator { position:absolute; z-index:3; top:9px; left:9px; min-height:30px; padding:0 11px; border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(8,15,31,.82); color:#fff; display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; letter-spacing:.04em; text-transform:uppercase; }
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
      .alarm-actions button { min-width:0; min-height:46px; border:0; border-radius:12px; background:rgba(123,104,211,.17); color:#c9beff; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; font-size:8px; font-weight:500; cursor:pointer; }
      .alarm-actions button.is-danger { background:rgba(176,57,61,.22); color:#ffaaa7; }
      .alarm-actions ha-icon { --mdc-icon-size:17px; }
      .garage-heading { display:flex; align-items:center; gap:10px; }
      .garage-heading > span { width:43px; height:43px; display:grid; place-items:center; border-radius:14px; background:rgba(123,104,211,.18); color:#c5b9ff; }
      .garage-heading h2 { margin:3px 0 0; font-size:18px; }
      .garage-motion { display:flex; align-items:center; gap:6px; margin:13px 0 0; color:var(--hub-muted); font-size:9px; }
      .garage-motion.is-active { color:#ffc06f; }
      .garage-motion.is-unavailable { color:#7f899d; }
      .garage-action { width:100%; min-height:43px; margin-top:13px; border:1px solid rgba(255,255,255,.12); border-radius:12px; background:rgba(123,104,211,.18); color:#d7d0ff; display:flex; align-items:center; justify-content:center; gap:6px; font-size:10px; font-weight:500; cursor:pointer; }
      .security-privacy-note { display:flex; align-items:flex-start; gap:7px; margin:0; padding:10px 12px; border:1px solid rgba(255,255,255,.08); border-radius:12px; background:rgba(8,15,31,.46); color:var(--hub-muted); font-size:8px; line-height:1.35; }
      .security-privacy-note ha-icon { flex:0 0 auto; --mdc-icon-size:16px; color:#a999ff; }
      .confirmation-backdrop { position:absolute; z-index:30; inset:0; display:grid; place-items:center; padding:20px; border-radius:var(--hub-radius); background:rgba(2,7,17,.72); -webkit-backdrop-filter:blur(10px); backdrop-filter:blur(10px); }
      .confirmation-dialog { width:min(390px,90%); padding:25px; border:1px solid rgba(255,255,255,.18); border-radius:22px; background:linear-gradient(155deg,#1a2440,#352c4b); color:#fff; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,.5); }
      .confirmation-dialog > span { width:58px; height:58px; margin:0 auto 13px; display:grid; place-items:center; border-radius:19px; background:rgba(239,164,71,.17); color:#ffc06f; }
      .confirmation-dialog > span ha-icon { --mdc-icon-size:30px; }
      .confirmation-dialog h2 { margin:6px 0 0; font-size:22px; }
      .confirmation-dialog > p:not(.eyebrow) { margin:10px 0 0; color:#bcc4d5; font-size:11px; line-height:1.45; }
      .confirmation-dialog > div { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:20px; }
      .confirmation-dialog button { min-height:46px; border:1px solid rgba(255,255,255,.14); border-radius:13px; background:rgba(255,255,255,.07); color:#fff; font-weight:500; cursor:pointer; }
      .confirmation-dialog button.confirm-primary { border-color:transparent; background:var(--hub-accent); }
      .football-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(260px,.62fr); gap:14px; }
      .football-main { min-height:0; padding:18px; display:grid; grid-template-rows:54px minmax(0,1fr); overflow:hidden; }
      .football-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:12px; align-items:center; }
      .football-toolbar h2 { margin:3px 0 0; font-size:20px; }
      .matchweek-controls { display:flex; align-items:center; gap:4px; }
      .matchweek-controls button { width:48px; height:48px; display:grid; place-items:center; border:0; border-radius:12px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-accent); cursor:pointer; }
      .matchweek-controls button:disabled { opacity:.35; cursor:default; }
      .select-shell { position:relative; min-width:0; display:block; }
      .select-shell select { width:100%; padding-right:36px !important; appearance:none; -webkit-appearance:none; }
      .select-shell > ha-icon { position:absolute; top:50%; right:10px; translate:0 -50%; color:currentColor; pointer-events:none; --mdc-icon-size:18px; }
      .matchweek-controls .select-shell { min-width:88px; color:var(--hub-text); }
      .matchweek-controls select { height:48px; min-width:88px; border:1px solid color-mix(in srgb,var(--hub-muted) 18%,transparent); border-radius:12px; background:var(--hub-surface); color:var(--hub-text); padding:0 10px; font-weight:500; }
      .football-tabs .segment { min-height:30px; }
      .fixture-groups { min-height:0; overflow:auto; padding-right:4px; }
      .fixture-day h3 { margin:13px 0 7px; color:var(--hub-muted); font-size:10px; letter-spacing:.09em; text-transform:uppercase; }
      .fixture { position:relative; min-height:46px; display:grid; grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr); align-items:center; gap:8px; padding:6px 10px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 12%,transparent); overflow:hidden; }
      .fixture.is-spotlight { border-radius:12px; border:1px solid color-mix(in srgb,var(--hub-accent) 26%,transparent); background:color-mix(in srgb,var(--hub-accent) 6%,var(--hub-surface)); margin:4px 0; }
      .fixture.is-live { border-color:#d94848; }
      .team { font-size:12px; font-weight:500; }
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
      .calendar-view { position:relative; display:grid; grid-template-rows:58px 50px 48px minmax(0,1fr); gap:9px; background:linear-gradient(155deg,rgba(250,246,245,.94),rgba(235,230,242,.91)); }
      .calendar-toolbar { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:14px; }
      .calendar-toolbar-actions { display:flex; align-items:center; gap:9px; }
      .calendar-add-event { min-height:48px; padding:0 12px; border:0; border-radius:11px; background:#1463E8; color:#fff; display:flex; align-items:center; gap:5px; font-size:12px; font-weight:500; cursor:pointer; }
      .calendar-add-event ha-icon { --mdc-icon-size:16px; }
      .calendar-context { min-width:max-content; display:flex; align-items:center; gap:9px; color:#0B1830; }
      .calendar-context > ha-icon { --mdc-icon-size:22px; color:#1463E8; }
      .calendar-context > span,.calendar-context strong,.calendar-context small { display:block; }
      .calendar-context strong { font-size:15px; }
      .calendar-context small { margin-top:2px; color:#5E6B80; font-size:12px; font-weight:500; }
      .calendar-modes { flex-wrap:nowrap; }
      .calendar-card-slot { height:100%; min-height:0; overflow:hidden; border:1px solid rgba(255,255,255,.1); background:rgba(7,14,29,.62); --ha-card-background:transparent; --card-background-color:transparent; --ha-card-border-width:0; --ha-card-box-shadow:none; --primary-text-color:#f7f8fc; --secondary-text-color:#b6bdce; }
      .calendar-person-filters { min-width:0; display:flex; align-items:center; gap:7px; overflow-x:auto; scrollbar-width:none; }
      .calendar-person-filters::-webkit-scrollbar { display:none; }
      .calendar-person-filter { flex:0 0 auto; min-height:48px; padding:4px 12px 4px 5px; border:1px solid rgba(26,45,78,.11); border-radius:999px; background:rgba(255,255,255,.7); color:#445069; display:flex; align-items:center; gap:7px; font-size:12px; font-weight:500; cursor:pointer; }
      .calendar-person-filter > span { width:32px; height:32px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; }
      .calendar-person-filter.is-selected { border-color:var(--person-colour); background:color-mix(in srgb,var(--person-colour) 11%,#fff); color:#14213A; box-shadow:0 4px 12px color-mix(in srgb,var(--person-colour) 17%,transparent); }
      .calendar-navigation { min-width:0; display:grid; grid-template-columns:48px 66px minmax(0,1fr) 48px 48px; gap:7px; align-items:center; }
      .calendar-navigation button { min-width:48px; min-height:48px; border:1px solid rgba(26,45,78,.12); border-radius:11px; background:#fff; color:#31405C; font-weight:500; cursor:pointer; }
      .calendar-navigation strong { min-width:0; text-align:center; color:#24314A; font-size:14px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .family-planner-slot { position:relative; min-height:0; overflow:hidden; }
      .family-planner-grid { height:100%; min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; }
      .family-planner-grid.is-day { grid-template-columns:minmax(0,1fr); }
      .family-planner-day { min-width:0; min-height:0; display:grid; grid-template-rows:52px minmax(0,1fr) auto; border:1px solid rgba(38,50,77,.09); border-radius:15px; background:rgba(255,255,255,.68); overflow:hidden; }
      .family-planner-day.is-today { border-color:rgba(20,99,232,.42); background:#fff; box-shadow:0 8px 20px rgba(35,59,94,.1); }
      .family-planner-day > header { padding:7px 7px 6px; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid rgba(38,50,77,.07); }
      .family-planner-day > header > div:first-child { display:flex; align-items:baseline; gap:4px; }
      .family-planner-day > header span { color:#68748A; font-size:12px; font-weight:500; text-transform:uppercase; }
      .family-planner-day > header strong { color:#17233A; font-size:18px; line-height:1; }
      .family-planner-day > header small { color:#8A94A6; font-size:12px; text-transform:uppercase; }
      .day-people { display:flex; flex-direction:row-reverse; }
      .day-people i { width:24px; height:24px; margin-left:-5px; display:grid; place-items:center; border:2px solid #fff; border-radius:50%; background:var(--person-colour); color:#fff; font-size:12px; font-style:normal; font-weight:500; }
      .family-planner-events { min-height:0; padding:6px; display:flex; flex-direction:column; gap:5px; overflow:auto; }
      .family-planner-event { position:relative; width:100%; min-width:0; min-height:48px; padding:7px 6px 7px 9px; border:0; border-radius:10px; background:color-mix(in srgb,var(--calendar-colour) 13%,#fff); color:#1E2A42; display:flex; flex-direction:column; align-items:flex-start; gap:2px; text-align:left; cursor:pointer; overflow:hidden; }
      .family-planner-event::before { content:""; position:absolute; inset:4px auto 4px 0; width:3px; border-radius:4px; background:var(--calendar-colour); }
      .family-planner-event strong { width:100%; overflow:hidden; text-overflow:ellipsis; color:#111C33; font-size:12px; line-height:1.2; }
      .family-planner-event small,.planner-event-time { width:100%; overflow:hidden; text-overflow:ellipsis; color:#68748A; font-size:12px; white-space:nowrap; }
      .planner-event-time { color:var(--calendar-colour); font-weight:500; }
      .planner-ready-state { margin-top:3px; display:flex; align-items:center; gap:3px; color:#7A5720; font-size:12px; font-weight:500; }
      .planner-ready-state ha-icon { --mdc-icon-size:12px; }
      .family-planner-event.is-ready .planner-ready-state { color:#167451; }
      .family-planner-event.is-compact { min-height:20px; padding:2px 4px 2px 8px; gap:0; border-radius:6px; }
      .family-planner-event.is-compact .planner-event-time { display:none; }
      .family-planner-event.is-compact strong { font-size:10px; white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
      .family-planner-event.is-compact .planner-ready-state { display:none; }
      .family-planner-empty { margin:auto; color:#9BA4B4; font-size:12px; }
      .day-ready { padding:6px 7px; border-top:1px solid rgba(38,50,77,.07); background:#FFF8E9; color:#7B581D; display:flex; align-items:center; gap:4px; font-size:12px; font-weight:500; }
      .day-ready ha-icon { --mdc-icon-size:13px; }
      .day-ready.is-ready { background:#ECF9F3; color:#167451; }
      .planner-month-headings { display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:5px; margin-bottom:5px; color:#6D7890; font-size:10px; font-weight:500; text-align:center; text-transform:uppercase; }
      .planner-month-grid { height:calc(100% - 21px); min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); grid-template-rows:repeat(6,minmax(0,1fr)); gap:5px; }
      .planner-month-day { min-width:0; min-height:0; padding:5px; border:1px solid rgba(38,50,77,.09); border-radius:10px; background:rgba(255,255,255,.76); overflow:hidden; }
      .planner-month-day.is-outside { opacity:.48; }
      .planner-month-day.is-today { border-color:#1463E8; box-shadow:inset 0 0 0 1px #1463E8; }
      .planner-month-day > header { height:21px; color:#536078; font-size:11px; }
      .planner-month-day > div { display:grid; gap:3px; }
      .planner-month-more { color:#68748A; font-size:9px; font-weight:500; }
      .planner-agenda-list { height:100%; min-height:0; display:grid; gap:9px; overflow:auto; }
      .planner-agenda-day { display:grid; grid-template-columns:110px minmax(0,1fr); gap:10px; padding:10px; border:1px solid rgba(38,50,77,.09); border-radius:14px; background:rgba(255,255,255,.72); }
      .planner-agenda-day.is-today { border-color:#1463E8; }
      .planner-agenda-day > header { color:#30405F; font-size:12px; }
      .planner-agenda-day > div { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      .calendar-card-slot .embedded-card { height:100%; min-height:0; overflow:auto; }
      .calendar-fallback { position:relative; height:100%; min-height:0; padding:10px; }
      .calendar-legends { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:7px 13px; }
      .calendar-legend { display:flex; align-items:center; gap:5px; color:#42495b; font-size:10px; font-weight:500; }
      .calendar-legend i { width:8px; height:8px; border-radius:50%; background:var(--calendar-colour); box-shadow:0 0 0 3px color-mix(in srgb,var(--calendar-colour) 16%,transparent); }
      .calendar-loading { position:absolute; top:14px; right:18px; z-index:2; display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; background:#fff; color:#4d5568; font-size:9px; box-shadow:0 7px 20px rgba(27,34,53,.12); }
      .calendar-loading span { width:8px; height:8px; border-radius:50%; background:var(--hub-accent); animation:pulse 1.2s ease-in-out infinite; }
      .calendar-warning { position:absolute; z-index:2; bottom:12px; left:50%; transform:translateX(-50%); margin:0; padding:8px 12px; border-radius:12px; background:#fff3d9; color:#704b0d; font-size:9px; box-shadow:0 7px 18px rgba(45,35,14,.14); }
      .calendar-warning.preparation-warning { bottom:48px; }
      .hub-agenda-board { min-width:0; min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; overflow:hidden; }
      .hub-agenda-day { min-width:0; min-height:0; display:grid; grid-template-rows:58px minmax(0,1fr); border:1px solid rgba(81,78,99,.12); border-radius:17px; background:rgba(255,255,255,.62); overflow:hidden; }
      .hub-agenda-day.is-today { border-color:color-mix(in srgb,var(--hub-accent) 45%,transparent); background:color-mix(in srgb,var(--hub-accent) 8%,#fff); box-shadow:inset 0 3px 0 var(--hub-accent); }
      .hub-agenda-day > header { padding:9px 8px 7px; display:grid; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:auto auto; align-items:end; border-bottom:1px solid rgba(81,78,99,.1); color:#242a3a; }
      .hub-agenda-day > header span { align-self:start; color:#656c7f; font-size:9px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; }
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
      .planner-event-location { margin:0 0 10px; display:flex; align-items:center; gap:6px; color:#42506A; font-size:12px; font-weight:500; }
      .planner-event-description { margin:0 0 15px; color:#647087; font-size:12px; line-height:1.45; }
      .planner-checklist { display:grid; gap:7px; }
      .planner-checklist-heading { margin-bottom:3px; display:flex; justify-content:space-between; align-items:center; }
      .planner-checklist-heading h3 { margin:3px 0 0; font-size:17px; }
      .planner-checklist-heading > span { width:38px; height:38px; display:grid; place-items:center; border-radius:13px; background:#FFF2D8; color:#9A681C; }
      .planner-checklist-heading > span.is-ready { background:#E7F7EF; color:#167451; }
      .planner-check-item { width:100%; min-height:48px; border:1px solid #E1E7EF; border-radius:12px; background:#fff; color:#17233A; display:grid; grid-template-columns:minmax(0,1fr) 48px; align-items:center; overflow:hidden; }
      .planner-check-item > button:first-child { min-width:0; min-height:48px; padding:7px 10px; border:0; background:transparent; color:inherit; display:grid; grid-template-columns:27px minmax(0,1fr) auto; align-items:center; gap:8px; text-align:left; cursor:pointer; }
      .planner-check-item > button:first-child > span { width:26px; height:26px; display:grid; place-items:center; border-radius:9px; background:#EFF3F8; color:#718097; }
      .planner-check-item strong { font-size:12px; }
      .planner-check-item small { padding:4px 7px; border-radius:999px; background:color-mix(in srgb,var(--person-colour) 12%,#fff); color:var(--person-colour); font-size:12px; font-weight:500; }
      .planner-remove-item { width:48px; height:48px; border:0; border-left:1px solid #E8EDF3; background:transparent; color:#8B5260; cursor:pointer; }
      .planner-check-item.is-complete { background:#F2FAF6; border-color:#CCEBDD; }
      .planner-check-item.is-complete > button:first-child > span { background:#1B9A6B; color:#fff; }
      .planner-check-item.is-complete strong { color:#668074; text-decoration:line-through; }
      .planner-suggestion { padding:15px; border:1px solid #F0DCB2; border-radius:15px; background:#FFF9EC; display:grid; grid-template-columns:38px minmax(0,1fr); gap:11px; }
      .planner-suggestion > span { width:38px; height:38px; display:grid; place-items:center; border-radius:12px; background:#FFE9B9; color:#A26B17; }
      .planner-suggestion h3 { margin:3px 0 5px; font-size:16px; }
      .planner-suggestion p:not(.eyebrow) { margin:0; color:#6D604A; font-size:12px; line-height:1.45; }
      .planner-suggestion div > div { display:flex; gap:7px; margin-top:11px; }
      .planner-suggestion button { min-height:48px; padding:8px 11px; border:0; border-radius:10px; background:var(--person-colour); color:#fff; font-size:12px; font-weight:500; cursor:pointer; }
      .planner-no-prep { margin:0; padding:15px; border-radius:14px; background:#EFF3F8; color:#68748A; font-size:12px; }
      .planner-checklist-editor { margin-top:14px; padding-top:14px; border-top:1px solid #E1E7EF; display:grid; gap:8px; }
      .planner-editor-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto; gap:7px; }
      .planner-editor-row + .planner-editor-row { grid-template-columns:minmax(0,1fr) auto; }
      .planner-editor-row input,.planner-editor-row select { min-width:0; width:100%; height:48px; padding:0 10px; border:1px solid #D9E1EC; border-radius:10px; background:#fff; color:#152139; font:inherit; font-size:12px; }
      .planner-editor-row button { min-height:48px; padding:0 12px; border:0; border-radius:10px; background:#1463E8; color:#fff; font-size:12px; font-weight:500; cursor:pointer; }
      .planner-modal > footer { min-height:58px; padding:10px 25px; border-top:1px solid #E4E9F1; background:#fff; display:flex; justify-content:space-between; align-items:center; gap:10px; }
      .planner-modal > footer > span { display:flex; align-items:center; gap:5px; color:#68748A; font-size:12px; }
      .planner-add-modal { width:min(700px,94%); }
      .planner-event-form { min-height:0; padding:18px 25px; display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; overflow:auto; }
      .planner-event-form label { display:grid; gap:5px; }
      .planner-event-form label.is-wide { grid-column:1/-1; }
      .planner-event-form label > span { color:#536078; font-size:12px; font-weight:500; text-transform:uppercase; letter-spacing:.04em; }
      .planner-event-form input,.planner-event-form select,.planner-event-form textarea { min-width:0; width:100%; height:48px; padding:0 11px; border:1px solid #D9E1EC; border-radius:11px; background:#fff; color:#152139; font:inherit; font-size:12px; }
      .planner-event-form textarea { height:84px; padding:10px 11px; resize:vertical; }
      .planner-event-form label > small { color:#758096; font-size:11px; }
      .planner-form-error { grid-column:1/-1; min-height:15px; margin:0; color:#B83C4A; font-size:12px; font-weight:500; }
      .planner-add-modal > footer button { min-width:110px; min-height:48px; border:1px solid #D9E1EC; border-radius:11px; background:#fff; color:#42506A; font-weight:500; cursor:pointer; }
      .planner-add-modal > footer { justify-content:flex-end; }
      .planner-add-modal > footer button.planner-save { border-color:#1463E8; background:#1463E8; color:#fff; }
      .hub-agenda-event .event-time { display:block; color:var(--calendar-colour); font-size:8px; font-weight:500; letter-spacing:.04em; }
      .hub-agenda-event strong { display:-webkit-box; margin-top:3px; overflow:hidden; color:#1d2333; font-size:10px; line-height:1.25; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
      .hub-agenda-event small { display:flex; align-items:center; gap:2px; margin-top:5px; overflow:hidden; color:#656c7f; font-size:8px; white-space:nowrap; text-overflow:ellipsis; }
      .hub-agenda-event small ha-icon { --mdc-icon-size:11px; }
      .hub-agenda-empty { margin:12px 4px; color:#8a8f9d; font-size:9px; line-height:1.4; }
      .hub-agenda-more { margin:auto 4px 2px; color:var(--hub-accent); font-size:9px; font-weight:500; }
      .family-dashboard { height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); gap:10px; }
      .family-dashboard.has-kid-switcher { grid-template-rows:auto auto minmax(0,1fr); }
      .family-dashboard.has-claim-feedback { grid-template-rows:auto auto minmax(0,1fr); }
      .family-dashboard.has-kid-switcher.has-claim-feedback { grid-template-rows:auto auto auto minmax(0,1fr); }
      .family-dashboard-heading { min-height:48px; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:0 2px; }
      .family-dashboard-heading h2 { margin:3px 0 0; color:var(--hub-text); font-size:22px; }
      .family-kid-switcher { display:flex; gap:9px; overflow-x:auto; padding:2px; }
      .family-kid-tab { min-width:150px; min-height:58px; padding:8px 14px; display:flex; align-items:center; gap:10px; border:2px solid transparent; border-radius:17px; background:var(--hub-surface); color:var(--hub-text); box-shadow:0 6px 18px rgba(11,24,48,.08); cursor:pointer; }
      .family-kid-tab > span { width:36px; height:36px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; font-weight:500; }
      .family-kid-tab strong { font-size:14px; }
      .family-kid-tab.is-selected { border-color:var(--person-colour); background:color-mix(in srgb,var(--person-colour) 8%,var(--hub-surface)); }
      .family-kid-stage { min-height:0; overflow:auto; }
      .family-kid-stage .family-person { min-height:100%; overflow:visible; }
      .family-kid-stage .family-person.is-kid-mode { padding:22px; }
      .chore-claim-feedback { margin:0; padding:10px 14px; display:flex; align-items:center; gap:8px; border:1px solid #A9DCC1; border-radius:13px; background:#F1FAF5; color:#18794E; font-size:13px; font-weight:500; }
      .chore-claim-feedback ha-icon { --mdc-icon-size:19px; }
      .choreops-link { min-height:48px; padding:0 14px; display:inline-flex; align-items:center; justify-content:center; gap:7px; border:1px solid color-mix(in srgb,var(--hub-accent) 24%,transparent); border-radius:14px; background:color-mix(in srgb,var(--hub-accent) 8%,var(--hub-surface)); color:var(--hub-accent); font-size:12px; font-weight:500; text-decoration:none; }
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
      .family-prep-more { width:100%; min-height:48px; margin-top:8px; padding:7px; border:0; background:transparent; color:var(--person-colour); font-size:12px; font-weight:500; cursor:pointer; }
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
      .family-person.is-kid-mode .chore-list { grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .chore-row.is-kid-card { min-height:126px; grid-template-columns:50px minmax(0,1fr) auto; grid-template-rows:1fr auto; padding:15px; border-width:2px; border-radius:20px; }
      .chore-row.is-kid-card .chore-check { width:48px; height:48px; border-radius:15px; }
      .chore-row.is-kid-card .chore-check ha-icon { --mdc-icon-size:27px; }
      .chore-row.is-kid-card strong { font-size:16px; white-space:normal; }
      .chore-row.is-kid-card small { margin-top:5px; font-size:12px; white-space:normal; }
      .chore-row.is-kid-card > b { align-self:start; padding:5px 8px; border-radius:999px; background:color-mix(in srgb,var(--person-colour) 12%,#fff); font-size:12px; }
      .chore-claim-action { grid-column:1/-1; min-height:48px; border:0; border-radius:13px; background:color-mix(in srgb,var(--person-colour) 35%,#10233D); color:#fff; font-size:13px; font-weight:500; cursor:pointer; }
      .chore-claim-action:disabled { background:#E5EAF0; color:#65738A; opacity:1; }
      .family-summary-grid { min-width:0; margin-top:12px; display:grid; grid-template-columns:repeat(auto-fit,minmax(105px,1fr)); gap:7px; }
      .family-summary-item { min-width:0; min-height:72px; padding:8px; display:grid; grid-template-columns:26px minmax(0,1fr); gap:6px; align-items:center; border:1px solid color-mix(in srgb,var(--person-colour) 16%,transparent); border-radius:13px; background:color-mix(in srgb,var(--person-colour) 4%,var(--hub-surface)); }
      .family-summary-item > span { width:26px; height:26px; display:grid; place-items:center; border-radius:8px; background:color-mix(in srgb,var(--person-colour) 11%,var(--hub-surface)); color:var(--person-colour); }
      .family-summary-item ha-icon { --mdc-icon-size:17px; }
      .family-summary-item p,.family-summary-item strong,.family-summary-item small { display:block; margin:0; overflow-wrap:anywhere; }
      .family-summary-item p { color:var(--hub-text); font-size:12px; font-weight:500; line-height:1.15; }
      .family-summary-item strong { color:var(--hub-text); font-size:12px; line-height:1.2; }
      .family-summary-item small { margin-top:2px; color:var(--hub-muted); font-size:12px; line-height:1.2; }
      .family-summary-item.is-done > span { background:#dff3e8; color:#18794e; }
      .family-summary-item.is-unavailable { opacity:.7; }
      .family-summary-item.is-unavailable > span { background:color-mix(in srgb,var(--hub-muted) 10%,var(--hub-surface)); color:var(--hub-muted); }
      .family-progress { height:6px; margin-top:7px; display:block; overflow:hidden; border-radius:999px; background:color-mix(in srgb,var(--person-colour) 10%,#DCE4EE); }
      .family-progress b { height:100%; display:block; border-radius:inherit; background:var(--person-colour); }
      .reward-claim { min-height:48px; margin-top:8px; padding:0 10px; border:0; border-radius:10px; background:color-mix(in srgb,var(--person-colour) 35%,#10233D); color:#fff; font-size:12px; font-weight:500; cursor:pointer; }
      .reward-claim:disabled { background:#E5EAF0; color:#65738A; opacity:1; }
      .football-empty { min-height:0; height:100%; display:grid; grid-template-columns:90px minmax(0,1fr) auto; gap:20px; align-items:center; padding:26px; border:1px dashed color-mix(in srgb,var(--hub-accent) 32%,transparent); border-radius:18px; background:linear-gradient(145deg,color-mix(in srgb,var(--hub-accent) 7%,#fff),rgba(255,255,255,.5)); }
      .football-orbit { width:82px; height:82px; display:grid; place-items:center; border-radius:50%; background:radial-gradient(circle,#fff 34%,color-mix(in srgb,var(--hub-accent) 18%,#fff) 35% 58%,transparent 59%); color:var(--hub-accent); box-shadow:0 12px 28px rgba(31,36,57,.12); }
      .football-orbit ha-icon { --mdc-icon-size:34px; }
      .football-empty h3 { margin:5px 0 0; color:var(--hub-text); font-size:19px; }
      .football-empty p:last-child { max-width:440px; margin:7px 0 0; color:var(--hub-muted); font-size:12px; line-height:1.45; }
      .empty-clubs { display:flex; align-items:center; gap:8px; }
      .empty-clubs span { width:42px; height:42px; display:grid; place-items:center; border-radius:12px; background:var(--hub-nav); color:#fff; font-size:12px; font-weight:500; }
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

      /* Component layouts retain the complete feature set. Shared Daily brief
         tokens provide one appearance across the shell and every screen. */
      .hub-card { --hub-accent:var(--daily-accent) !important; --hub-background:var(--daily-background) !important; --hub-surface:var(--daily-surface) !important; --hub-text:var(--daily-text) !important; --hub-muted:var(--daily-muted) !important; --hub-nav:var(--daily-strong) !important; --hub-backdrop-start:var(--daily-background) !important; --hub-backdrop-mid:var(--daily-background) !important; --hub-backdrop-end:var(--daily-background) !important; }
      .hub-card,.hub-shell { background:var(--daily-background); color:var(--daily-text); }
      .hub-shell { grid-template-columns:108px minmax(0,1fr); }
      .hub-navigation { padding:18px 12px; gap:18px; background:var(--daily-strong); border:0; box-shadow:12px 0 34px rgba(6,27,58,.08); }
      .hub-brand { width:68px; height:68px; margin:0 auto; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; border:1px solid rgba(255,255,255,.16); border-radius:22px; background:rgba(255,255,255,.09); box-shadow:none; }
      .hub-brand ha-icon { --mdc-icon-size:25px; }
      .hub-brand span { font-size:12px; font-weight:500; letter-spacing:.01em; }
      .hub-nav-items { flex:0 0 auto; justify-content:flex-start; gap:6px; }
      .hub-nav-core { flex:1; }
      .hub-nav-utility { margin-top:auto; }
      .hub-nav-divider { display:block; height:1px; margin:2px 10px 8px; background:rgba(255,255,255,.13); }
      .hub-nav-button { min-height:58px; gap:5px; border:0; border-radius:17px; color:#A8B7CB; }
      .hub-nav-button ha-icon { --mdc-icon-size:23px; }
      .hub-nav-button span { font-size:12px; font-weight:500; }
      .hub-nav-button.is-active { color:var(--daily-strong); background:var(--daily-surface); border:0; box-shadow:0 8px 24px rgba(0,0,0,.18); }
      .hub-content { padding:16px 26px 24px; grid-template-rows:70px minmax(0,1fr); gap:14px; background:var(--daily-background); }
      .hub-topbar { color:var(--daily-text); padding:0; }
      .hub-page-title { display:flex; align-items:baseline; gap:14px; }
      .hub-topbar h1 { margin:0; font-size:34px; line-height:1; letter-spacing:-.035em; font-weight:500; }
      .hub-topbar-date { order:2; margin:0; color:var(--daily-muted); font-size:14px; font-weight:500; }
      .hub-header-actions { gap:10px; }
      .hub-weather-pill { min-height:48px; padding:0 15px; border:1px solid var(--daily-line); border-radius:16px; background:var(--daily-surface); color:var(--daily-text); box-shadow:0 5px 18px rgba(11,24,48,.05); font-size:14px; font-weight:500; }
      .hub-weather-pill ha-icon { color:#E7A93D; }
      .hub-topbar-time { min-width:82px; color:var(--daily-text); font-size:26px; line-height:1; font-weight:500; letter-spacing:-.03em; text-align:right; }
      .eyebrow { color:var(--daily-muted); font-size:12px; line-height:1.2; font-weight:500; letter-spacing:.1em; }
      .surface { color:var(--daily-text); border:1px solid var(--daily-line); background:var(--daily-surface); border-radius:24px; box-shadow:0 12px 32px rgba(21,43,75,.065); -webkit-backdrop-filter:none; backdrop-filter:none; }
      .surface .eyebrow { color:var(--daily-muted); }
      .surface h2,.surface h3,.surface strong { color:var(--daily-text); }
      .section-heading h2 { font-size:20px; }
      .section-heading > span { font-size:12px; }
      .section-heading > button,.text-action { min-width:48px; min-height:48px; padding:0 4px; display:flex; align-items:center; gap:4px; color:var(--daily-accent); font-size:14px; }
      .section-heading > button { margin-top:-8px; }
      .text-action ha-icon { --mdc-icon-size:17px; }
      .supporting { color:var(--daily-muted); font-size:15px; line-height:1.45; }
      .icon-action { width:48px; height:48px; background:var(--daily-accent-soft); color:var(--daily-accent); }

      .today-grid { height:100%; grid-template-columns:repeat(6,minmax(0,1fr)); grid-template-rows:minmax(282px,1.08fr) minmax(226px,.92fr); gap:16px; }
      .today-grid article { padding:24px; }
      .today-grid h2 { font-size:24px; }
      .hero-panel.today-hero { position:relative; grid-column:1/5; display:grid; grid-template-columns:minmax(0,1fr) 132px; grid-template-rows:minmax(0,1fr) auto; gap:18px 26px; overflow:hidden; border:0; background:radial-gradient(circle at 90% 5%,rgba(42,117,209,.32),transparent 38%),linear-gradient(135deg,var(--daily-strong),var(--daily-strong-end)); color:var(--daily-on-strong); box-shadow:0 20px 44px rgba(6,27,58,.22); }
      .today-hero::after { content:""; position:absolute; right:-70px; bottom:-105px; width:260px; height:260px; border:1px solid rgba(255,255,255,.1); border-radius:50%; box-shadow:0 0 0 36px rgba(255,255,255,.025),0 0 0 78px rgba(255,255,255,.018); pointer-events:none; }
      .today-hero-copy { position:relative; z-index:1; align-self:center; }
      .today-hero .eyebrow { color:var(--daily-strong-accent); }
      .today-hero h2 { margin:8px 0 0; color:var(--daily-on-strong); font-size:44px; line-height:1; letter-spacing:-.045em; }
      .today-hero-copy > p:last-child { max-width:520px; margin:14px 0 0; color:var(--daily-strong-muted); font-size:16px; line-height:1.45; }
      .today-weather { position:relative; z-index:1; align-self:center; display:grid; justify-items:end; }
      .today-weather ha-icon { --mdc-icon-size:34px; color:#FFD27B; }
      .today-weather strong { margin-top:8px; color:var(--daily-on-strong); font-size:42px; line-height:1; letter-spacing:-.05em; }
      .today-weather span { margin-top:6px; color:var(--daily-strong-muted); font-size:13px; font-weight:500; }
      .hero-metrics { position:relative; z-index:1; grid-column:1/-1; margin:0; gap:10px; }
      .hero-metrics.has-energy { grid-template-columns:repeat(4,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="1"] { grid-template-columns:minmax(0,1fr); }
      .hero-metrics[data-metric-count="2"] { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .hero-metrics[data-metric-count="3"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .hero-metrics button { min-height:70px; padding:11px 14px; display:flex; align-items:center; gap:11px; border:1px solid rgba(255,255,255,.14); border-radius:16px; background:rgba(255,255,255,.075); }
      .hero-metrics button > ha-icon { flex:0 0 auto; --mdc-icon-size:22px; color:var(--daily-strong-accent); }
      .hero-metrics button > span { min-width:0; }
      .hero-metrics strong { color:var(--daily-on-strong); font-size:16px; }
      .hero-metrics small { display:block; margin-top:3px; color:var(--daily-strong-muted); font-size:12px; }
      .today-next { position:relative; grid-column:5/7; justify-content:flex-start; background:var(--daily-surface); }
      .today-card-icon { width:50px; height:50px; margin-bottom:18px; display:grid; place-items:center; border-radius:16px; background:var(--daily-warning-soft); color:var(--daily-warning); }
      .today-card-icon ha-icon { --mdc-icon-size:24px; }
      .today-card-icon.is-coral { margin:0; background:var(--daily-danger-soft); color:var(--daily-danger); }
      .today-next h2 { margin-top:10px; font-size:28px; line-height:1.14; }
      .today-family,.today-football,.today-music { grid-row:2; justify-content:flex-start; background:var(--daily-surface); }
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
      .person-summary { min-height:60px; padding:10px 12px; border:1px solid color-mix(in srgb,var(--person-colour) 16%,var(--daily-line)); background:color-mix(in srgb,var(--person-colour) 5%,var(--daily-surface)); border-radius:16px; }
      .person-initial { width:38px; height:38px; border:3px solid color-mix(in srgb,var(--person-colour) 72%,var(--daily-surface)); background:var(--daily-text); color:var(--daily-on-strong); font-size:15px; }
      .person-summary strong { font-size:14px; }
      .person-summary small { font-size:12px; }
      .points { color:var(--daily-text); font-size:12px; }
      .featured-fixtures { gap:8px; margin-top:10px; }
      .compact-fixture { min-height:62px; border-color:var(--daily-line); background:var(--daily-soft); border-radius:16px; }
      .compact-fixture[data-favourite-code~="TOT"] { border-left:4px solid #132257; }
      .compact-fixture[data-favourite-code~="AVL"] { border-left:4px solid #670E36; }
      .compact-fixture.is-derby { border-left-color:var(--daily-line); border-right:1px solid var(--daily-line); background:var(--daily-soft); box-shadow:none; }
      .compact-team { font-size:12px; }
      .compact-score { font-size:15px; }
      .compact-fixture-detail { color:var(--daily-muted); font-size:12px; }
      .now-playing { grid-template-columns:64px minmax(0,1fr) 48px; margin-top:13px; }
      .artwork { width:64px; height:64px; background:linear-gradient(145deg,var(--daily-accent),#00A887); }
      .now-playing h2 { font-size:17px; }
      .now-playing p { font-size:13px; }
      .today-music .now-playing,.quiet-music { flex:1; align-content:center; }
      .quiet-music { min-height:92px; display:flex; align-items:center; gap:13px; }
      .quiet-music strong,.quiet-music span { display:block; }
      .quiet-music strong { font-size:16px; }
      .quiet-music span { margin-top:4px; color:var(--daily-muted); font-size:13px; }

      .home-surface { grid-template-rows:64px minmax(0,1fr); gap:14px; }
      .home-toolbar { color:var(--daily-text); padding:0; }
      .home-toolbar h2 { margin-top:5px; font-size:22px; }
      .home-toolbar .eyebrow { color:var(--daily-muted); }
      .home-segments { max-width:72%; padding:4px; background:var(--daily-soft); border-radius:16px; }
      .segment { min-height:48px; padding:0 15px; border-radius:12px; color:var(--daily-muted); font-size:13px; }
      .segment.is-selected { color:var(--daily-on-strong); background:var(--daily-accent); box-shadow:0 5px 14px rgba(20,99,232,.2); }
      .home-segments ha-icon,.calendar-modes ha-icon { --mdc-icon-size:18px; }
      .home-summary-links button { border-color:var(--daily-line); background:var(--daily-surface); color:var(--daily-text); box-shadow:0 8px 20px rgba(21,43,75,.05); }
      .home-summary-links button > ha-icon:first-child { color:var(--daily-accent); }
      .home-summary-links button > ha-icon:last-child,.home-summary-links small { color:var(--daily-muted); }
      .home-summary-links strong { font-size:15px; }
      .home-summary-links small { font-size:12px; }
      .rooms-layout { grid-template-columns:minmax(0,1fr) clamp(340px,31vw,390px); gap:16px; }
      .floorplan-panel { padding:20px; grid-template-rows:58px minmax(0,1fr); gap:12px; }
      .floorplan-heading h2 { font-size:24px; }
      .floorplan-canvas { border:1px solid var(--daily-line); border-radius:20px; background:radial-gradient(circle at 50% 44%,var(--daily-surface) 0,var(--daily-soft) 68%,var(--daily-soft) 100%); }
      .floorplan-backdrop { background:radial-gradient(ellipse at 50% 90%,rgba(41,74,108,.09),transparent 58%); }
      .light-overlay { mix-blend-mode:multiply; }
      .room-hotspot.has-light polygon { fill:color-mix(in srgb,#E7A93D 15%,transparent); filter:drop-shadow(0 0 3px rgba(231,169,61,.65)); }
      .room-hotspot.is-selected polygon,.room-hotspot:focus polygon { fill:color-mix(in srgb,var(--daily-accent) 9%,transparent); stroke:var(--daily-accent); stroke-width:.72; filter:drop-shadow(0 0 3px rgba(20,99,232,.4)); }
      .room-detail.home-drawer { padding:24px; background:var(--daily-surface); }
      .room-title { align-items:flex-start; }
      .room-icon { width:52px; height:52px; border-radius:16px; background:var(--daily-accent-soft); color:var(--daily-accent); }
      .room-title h2 { font-size:26px; }
      .room-title p:last-child { color:var(--daily-muted); font-size:13px; }
      .room-control-list { gap:10px; margin-top:22px; }
      .control-row { grid-template-columns:minmax(0,1fr) 48px; gap:8px; }
      .control-main,.media-room-control,.climate-control,.cover-control { min-height:60px; border:1px solid var(--daily-line); background:var(--daily-soft); color:var(--daily-text); }
      .control-main { padding:10px 14px; }
      .control-main strong,.media-room-control strong,.cover-control strong { font-size:14px; }
      .control-main small,.media-room-control small,.cover-control small { color:var(--daily-muted); font-size:12px; }
      .control-main.is-on { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); }
      .climate-control span,.climate-control small { color:var(--daily-muted); font-size:12px; }
      .climate-control strong { font-size:30px; }
      .stepper button,.cover-control button { width:48px; height:48px; border:1px solid var(--daily-line); background:var(--daily-surface); color:var(--daily-accent); }
      .scene-button { min-height:48px; background:var(--daily-accent-soft); color:var(--daily-accent); font-size:13px; }

      .whole-home-card,.heating-card,.cover-card,.cleaning-panel { border-color:var(--daily-line); background:var(--daily-surface); color:var(--daily-text); }
      .whole-home-heading > span,.heating-card-heading > span,.cover-card-heading > span { width:48px; height:48px; flex-basis:48px; border-radius:15px; background:var(--daily-accent-soft); color:var(--daily-accent); }
      .whole-home-heading h3,.heating-card-heading h3,.cover-card-heading h3 { color:var(--daily-text); font-size:16px; }
      .whole-home-heading p,.heating-card-heading p,.cover-card-heading p { color:var(--daily-muted); font-size:12px; }
      .whole-home-grid { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .heating-grid { grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); }
      .heating-grid[data-zone-count="6"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
      .cover-grid { grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); }
      .whole-home-controls { grid-template-columns:1fr; gap:9px; }
      .whole-home-control { min-height:58px; border-color:var(--daily-line); background:var(--daily-soft); color:var(--daily-text); }
      .whole-home-control.is-on { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); color:var(--daily-warning); }
      .whole-home-control strong,.whole-home-control small { overflow:visible; text-overflow:clip; white-space:normal; line-height:1.2; overflow-wrap:anywhere; }
      .whole-home-control strong { color:inherit; font-size:13px; }
      .whole-home-control small { color:var(--daily-muted); font-size:12px; }
      .heating-card { min-height:190px; }
      .heating-card.is-heating { border-color:var(--daily-warning-line); background:linear-gradient(145deg,var(--daily-warning-soft),var(--daily-surface)); }
      .heating-card.is-off,.heating-card.is-unavailable { background:var(--daily-soft); }
      .heating-card.is-heating .heating-icon,.heating-card.is-heating .heating-status { color:var(--daily-warning); }
      .heating-card-heading .heating-status,.heating-current small,.heating-target-control > small { color:var(--daily-muted); font-size:12px; }
      .heating-current-value,.heating-target-value { color:var(--daily-text); }
      .heating-power { min-width:68px; min-height:48px; border-color:var(--daily-line); background:var(--daily-soft); color:var(--daily-muted); font-size:12px; }
      .heating-power.is-on { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); color:var(--daily-warning); }
      .heating-stepper { grid-template-columns:48px minmax(54px,1fr) 48px; border-color:var(--daily-line); background:var(--daily-soft); }
      .heating-stepper button,.heating-target-value { min-height:48px; color:var(--daily-accent); }
      .heating-stepper button { width:48px; height:48px; }
      .heating-target-value { border-color:var(--daily-line); color:var(--daily-text); }
      .cover-actions { gap:8px; }
      .cover-actions button { min-height:48px; border:1px solid var(--daily-line); background:var(--daily-soft); color:var(--daily-accent); font-size:12px; }
      .cleaning-panel { padding:24px; }
      .cleaning-hero > span { background:linear-gradient(145deg,var(--daily-accent),#00A887); }
      .cleaning-hero p:last-child { color:var(--daily-muted); font-size:13px; }
      .cleaning-facts span { border-color:var(--daily-line); background:var(--daily-soft); }
      .cleaning-facts strong { color:var(--daily-text); font-size:16px; }
      .cleaning-facts small { color:var(--daily-muted); font-size:12px; }
      .cleaning-actions button { min-height:48px; border:1px solid var(--daily-accent-line); background:var(--daily-accent-soft); color:var(--daily-accent); font-size:13px; }
      .vacuum-map-slot,.vacuum-map-placeholder { border-color:var(--daily-line); background:var(--daily-soft); color:var(--daily-muted); }
      .vacuum-map-placeholder { font-size:13px; }

      .energy-hero { border:0; border-radius:24px; background:radial-gradient(circle at 88% 18%,rgba(0,168,135,.25),transparent 32%),linear-gradient(135deg,var(--daily-strong),var(--daily-strong-end)); color:var(--daily-on-strong); box-shadow:0 18px 42px rgba(6,27,58,.2); }
      .energy-hero .eyebrow { color:var(--daily-strong-accent); }
      .energy-hero h2,.energy-hero-status strong { color:var(--daily-on-strong); }
      .energy-hero-status small { color:var(--daily-strong-muted); font-size:12px; }
      .energy-meter { border-color:var(--daily-line); background:var(--daily-surface); color:var(--daily-text); }
      .energy-meter-icon { background:var(--daily-accent-soft); color:var(--daily-accent); }
      .energy-meter.is-gas .energy-meter-icon { background:var(--daily-danger-soft); color:var(--daily-danger); }
      .energy-meter-heading h2 { color:var(--daily-text); font-size:22px; }
      .energy-status { border-color:var(--daily-line); background:var(--daily-soft); color:var(--daily-muted); font-size:12px; }
      .energy-meter.is-stale .energy-status,.energy-meter.is-partial .energy-status,.energy-meter.is-unverified .energy-status { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); color:var(--daily-warning); }
      .energy-primary-metrics > span { border-color:var(--daily-line); background:var(--daily-soft); }
      .energy-primary-metrics small,.energy-tariff small,.energy-freshness { color:var(--daily-muted); font-size:12px; }
      .energy-primary-metrics strong { color:var(--daily-text); font-size:30px; }
      .energy-tariff { border-color:var(--daily-line); }
      .energy-tariff strong { color:var(--daily-text); font-size:14px; }
      .energy-truth-note { border-color:var(--daily-line); background:var(--daily-accent-soft); color:var(--daily-text); }
      .energy-truth-note > ha-icon { color:var(--daily-accent); }
      .energy-truth-note strong { font-size:14px; }
      .energy-truth-note span { color:var(--daily-muted); font-size:12px; }

      .security-layout { grid-template-columns:minmax(0,1fr) clamp(286px,27vw,334px); gap:18px; }
      .security-main { display:grid; grid-template-rows:minmax(0,1fr) auto; gap:14px; }
      .security-stage { min-height:0; padding:18px; display:grid; grid-template-rows:56px minmax(0,1fr); border:0; border-radius:24px; background:var(--daily-strong); color:var(--daily-on-strong); box-shadow:0 18px 42px rgba(6,27,58,.2); overflow:hidden; }
      .security-stage-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:14px; }
      .security-stage-heading .eyebrow { color:var(--daily-strong-accent); }
      .security-stage-heading h2 { margin:3px 0 0; color:var(--daily-on-strong); font-size:24px; }
      .stage-privacy { min-height:38px; padding:0 12px; display:flex; align-items:center; gap:6px; border:1px solid rgba(255,255,255,.15); border-radius:13px; background:rgba(255,255,255,.07); color:var(--daily-strong-muted); font-size:12px; font-weight:500; }
      .stage-privacy ha-icon { --mdc-icon-size:17px; color:var(--daily-strong-accent); }
      .security-stage-media { width:100%; max-width:780px; min-height:0; aspect-ratio:16/9; place-self:center; overflow:hidden; border-radius:18px; background:radial-gradient(circle at 50% 46%,#102F54,#041225 72%); }
      .camera-stage-stack { position:relative; width:100%; height:100%; min-height:0; overflow:hidden; border-radius:18px; background:#041225; }
      .camera-poster-slot { position:relative; min-width:0; min-height:0; overflow:hidden; background:radial-gradient(circle at 50% 46%,#16385f,#041225 72%); color:var(--daily-strong-muted); }
      .camera-poster-slot > .embedded-card { display:block; width:100%; height:100%; min-height:100%; border:0; }
      .camera-stage-poster-slot { position:absolute; inset:0; }
      .camera-poster-fallback { position:absolute; inset:0; display:grid; place-items:center; align-content:center; gap:8px; color:var(--daily-strong-muted); font-size:12px; font-weight:500; }
      .camera-poster-fallback ha-icon { --mdc-icon-size:32px; color:var(--daily-strong-accent); }
      .camera-stage-stack .camera-card-slot { position:absolute; z-index:1; inset:0; opacity:0; transition:opacity .18s ease; }
      .camera-stage-stack.is-live .camera-card-slot { opacity:1; }
      .camera-stage-action { position:absolute; z-index:2; inset:0; width:100%; padding:18px; border:0; background:linear-gradient(180deg,transparent 40%,rgba(4,18,37,.88)); color:var(--daily-on-strong); display:flex; align-items:flex-end; justify-content:space-between; gap:16px; text-align:left; cursor:pointer; }
      .camera-stage-action > span { min-width:0; }
      .camera-stage-action strong,.camera-stage-action small { display:block; }
      .camera-stage-action strong { font-size:17px; }
      .camera-stage-action small { max-width:430px; margin-top:4px; color:var(--daily-strong-muted); font-size:12px; line-height:1.4; }
      .camera-stage-action b { flex:0 0 auto; min-height:48px; padding:0 16px; border-radius:14px; background:var(--daily-accent); display:flex; align-items:center; gap:7px; font-size:13px; }
      .camera-stage-action:disabled { cursor:default; }
      .camera-stage-action:disabled b { background:#53657b; }
      .camera-idle { height:100%; min-height:0; grid-template-columns:70px minmax(0,1fr) auto; gap:18px; padding:24px; border:0; border-radius:18px; background:radial-gradient(circle at 12% 50%,rgba(20,99,232,.25),transparent 34%); }
      .camera-stage-icon { width:64px; height:64px; display:grid; place-items:center; border-radius:20px; background:rgba(255,255,255,.09); color:var(--daily-strong-accent); }
      .camera-stage-icon ha-icon { --mdc-icon-size:34px; }
      .camera-is-starting .camera-stage-icon ha-icon,.camera-is-stopping .camera-stage-icon ha-icon { animation:spin 1.1s linear infinite; }
      .camera-idle strong { color:var(--daily-on-strong); font-size:19px; }
      .camera-idle small { max-width:360px; margin-top:6px; color:var(--daily-strong-muted); font-size:13px; line-height:1.45; }
      .camera-idle button,.camera-close,.camera-select-action { min-height:48px; padding:0 16px; border-radius:14px; background:var(--daily-accent); font-size:13px; }
      .camera-stream { width:100%; height:100%; border-radius:18px; }
      .camera-card-slot,.camera-card-slot::slotted(.embedded-card) { height:100%; min-height:100%; }
      .camera-live-chip { position:absolute; z-index:4; top:12px; left:12px; min-height:34px; padding:0 11px; display:flex; align-items:center; gap:7px; border-radius:12px; background:rgba(4,18,37,.8); color:var(--daily-on-strong); font-size:12px; font-weight:500; }
      .camera-live-chip span { width:8px; height:8px; border-radius:50%; background:#E86E5A; box-shadow:0 0 0 4px rgba(232,110,90,.2); }
      .camera-close { right:12px; bottom:12px; background:rgba(4,18,37,.86); }
      .security-camera-picker { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .security-camera { min-height:174px; padding:0; display:grid; grid-template-columns:minmax(118px,.86fr) minmax(0,1.14fr); grid-template-rows:minmax(174px,1fr); gap:0; border-radius:20px; background:var(--daily-surface); overflow:hidden; }
      .camera-tile-media { position:relative; min-width:0; min-height:174px; overflow:hidden; background:var(--daily-strong); }
      .camera-tile-poster { position:absolute; inset:0; }
      .camera-poster-action { position:absolute; z-index:2; inset:0; width:100%; padding:10px; border:0; background:linear-gradient(180deg,transparent 46%,rgba(4,18,37,.82)); color:var(--daily-on-strong); display:flex; align-items:flex-end; justify-content:flex-start; text-align:left; cursor:pointer; }
      .camera-poster-action > span { min-height:38px; padding:0 10px; border:1px solid rgba(255,255,255,.24); border-radius:11px; background:rgba(4,18,37,.78); display:flex; align-items:center; gap:6px; font-size:12px; font-weight:500; }
      .camera-poster-action:disabled { cursor:default; }
      .camera-tile-details { min-width:0; padding:13px; display:grid; grid-template-rows:auto minmax(0,1fr); align-content:start; gap:9px; }
      .security-camera .security-card-heading { min-width:0; display:grid; align-content:start; justify-content:stretch; gap:7px; }
      .security-camera.is-selected { border-color:var(--daily-accent-line); box-shadow:0 0 0 2px rgba(20,99,232,.09),0 10px 26px rgba(21,43,75,.06); }
      .security-card-heading { min-width:0; align-items:flex-start; flex-wrap:wrap; }
      .security-card-heading > div { min-width:0; }
      .security-card-heading h2 { font-size:18px; overflow-wrap:anywhere; }
      .privacy-badge { flex:0 1 auto; max-width:100%; min-height:34px; padding:7px 9px; border:1px solid var(--daily-line); background:var(--daily-soft); color:var(--daily-muted); font-size:12px; line-height:1.25; white-space:normal; overflow-wrap:anywhere; }
      .privacy-badge ha-icon { --mdc-icon-size:16px; color:var(--daily-accent); }
      .security-signals { gap:6px; }
      .security-camera .security-signals { min-width:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); align-content:start; }
      .security-signal { min-height:48px; grid-template-columns:22px minmax(0,1fr); padding:6px 7px; border:1px solid var(--daily-line); background:var(--daily-soft); }
      .security-signal ha-icon { --mdc-icon-size:18px; color:var(--daily-muted); }
      .security-signal strong,.security-signal small { overflow:visible; white-space:normal; text-overflow:clip; overflow-wrap:anywhere; }
      .security-signal strong { font-size:12px; }
      .security-signal small { color:var(--daily-muted); font-size:12px; }
      .security-signal.is-active { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); }
      .security-signal.is-active ha-icon { color:var(--daily-warning); }
      .security-signal.is-unavailable { background:var(--daily-soft); }
      .camera-select-action { width:100%; min-width:0; justify-content:center; background:var(--daily-accent-soft); color:var(--daily-accent); line-height:1.25; white-space:normal; }
      .security-sidebar { grid-template-rows:minmax(218px,1fr) auto auto; gap:12px; }
      .alarm-panel,.garage-panel { padding:20px; background:var(--daily-surface); }
      .alarm-state { width:48px; height:48px; background:var(--daily-success-soft); color:var(--daily-success); }
      .alarm-state.is-alert { background:var(--daily-danger-soft); color:var(--daily-danger); }
      .alarm-state.is-unavailable { background:var(--daily-soft); color:var(--daily-muted); }
      .alarm-panel > p { margin-top:14px; color:var(--daily-muted); font-size:13px; }
      .alarm-actions { gap:7px; margin-top:16px; }
      .alarm-actions button { min-height:58px; border:1px solid var(--daily-line); background:var(--daily-accent-soft); color:var(--daily-accent); font-size:12px; }
      .alarm-actions button.is-danger { border-color:var(--daily-danger-line); background:var(--daily-danger-soft); color:var(--daily-danger); }
      .alarm-actions ha-icon { --mdc-icon-size:20px; }
      .garage-heading > span { width:48px; height:48px; background:var(--daily-accent-soft); color:var(--daily-accent); }
      .garage-heading h2 { font-size:20px; }
      .garage-motion { margin-top:14px; color:var(--daily-muted); font-size:12px; }
      .garage-action { min-height:50px; border:0; background:var(--daily-accent); color:var(--daily-on-strong); font-size:13px; }
      .security-privacy-note { min-height:58px; align-items:center; padding:11px 13px; border:1px solid var(--daily-line); background:var(--daily-surface); color:var(--daily-muted); font-size:12px; }
      .security-privacy-note ha-icon { --mdc-icon-size:19px; color:#00A887; }
      .confirmation-dialog { background:var(--daily-surface); color:var(--daily-text); border:1px solid var(--daily-line); }
      .confirmation-dialog h2 { color:var(--daily-text); }
      .confirmation-dialog > p:not(.eyebrow) { color:var(--daily-muted); font-size:14px; }
      .confirmation-dialog button { min-height:50px; border-color:var(--daily-line); background:var(--daily-soft); color:var(--daily-text); }
      .confirmation-dialog button.confirm-primary { border-color:var(--daily-accent); background:var(--daily-accent); color:var(--daily-on-strong); }

      .calendar-view { border-color:var(--daily-line); background:var(--daily-surface); }
      .calendar-context strong { color:var(--daily-text); }
      .calendar-legends { color:var(--daily-text); }
      .calendar-legend { color:var(--daily-text); font-size:12px; }
      .calendar-card-slot { border-color:var(--daily-line); background:var(--daily-surface); --ha-card-background:var(--daily-surface); --card-background-color:var(--daily-on-strong); --primary-text-color:var(--daily-text); --secondary-text-color:var(--daily-muted); }
      .calendar-loading { color:var(--daily-text); font-size:12px; }
      .calendar-warning { color:var(--daily-warning); font-size:12px; }
      .hub-agenda-day { border-color:var(--daily-line); background:var(--daily-surface); }
      .hub-agenda-day.is-today { border-color:var(--daily-accent-line); background:var(--daily-accent-soft); }
      .hub-agenda-day > header { border-color:var(--daily-line); color:var(--daily-text); }
      .hub-agenda-day > header span,.hub-agenda-day > header small { color:var(--daily-muted); font-size:12px; }
      .hub-agenda-event { border:1px solid color-mix(in srgb,var(--calendar-colour) 30%,var(--daily-line)); background:color-mix(in srgb,var(--calendar-colour) 8%,var(--daily-surface)); color:var(--daily-text); }
      .hub-agenda-event .event-time,.hub-agenda-event strong,.hub-agenda-event small,.hub-agenda-empty,.hub-agenda-more { font-size:12px; }
      .hub-agenda-event strong { color:var(--daily-text); }
      .hub-agenda-event small,.hub-agenda-empty { color:var(--daily-muted); }

      .family-layout { grid-template-columns:minmax(0,1.45fr) minmax(350px,.8fr); }
      .family-dashboard-heading h2 { color:var(--daily-text); }
      .choreops-link { border-color:var(--daily-accent-line); background:var(--daily-accent-soft); color:var(--daily-accent); }
      .family-person { border-color:var(--daily-line); background:var(--daily-surface); color:var(--daily-text); }
      .family-sidebar { display:flex; flex-direction:column; align-items:stretch; overflow-y:auto; overscroll-behavior:contain; padding-right:4px; scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:var(--daily-muted) transparent; }
      .family-scroll-cue { position:sticky; top:0; z-index:3; flex:0 0 auto; min-height:38px; padding:0 8px; display:flex; align-items:center; justify-content:space-between; gap:10px; border-bottom:1px solid var(--daily-line); background:rgba(244,247,250,.96); color:var(--daily-text); font-size:12px; }
      .family-scroll-cue span { display:flex; align-items:center; gap:4px; color:var(--daily-muted); font-weight:500; }
      .family-scroll-cue ha-icon { --mdc-icon-size:16px; color:var(--daily-accent); }
      .family-sidebar .family-person { flex:0 0 auto; overflow:visible; }
      .family-sidebar::-webkit-scrollbar { width:7px; }
      .family-sidebar::-webkit-scrollbar-thumb { border:2px solid transparent; border-radius:999px; background:var(--daily-muted); background-clip:padding-box; }
      .family-person-heading > span { border:3px solid color-mix(in srgb,var(--person-colour) 72%,var(--daily-surface)); background:var(--daily-text); color:var(--daily-on-strong); }
      .family-facts span { border:1px solid color-mix(in srgb,var(--person-colour) 18%,var(--daily-line)); background:color-mix(in srgb,var(--person-colour) 5%,var(--daily-surface)); color:var(--daily-text); font-size:12px; }
      .family-facts strong { color:var(--daily-text); }
      .chore-heading span { color:var(--daily-muted); font-size:12px; }
      .family-preparation { border-color:color-mix(in srgb,var(--person-colour) 24%,var(--daily-line)); background:color-mix(in srgb,var(--person-colour) 5%,var(--daily-surface)); }
      .family-prep-item { border-color:color-mix(in srgb,var(--person-colour) 20%,var(--daily-line)); background:var(--daily-surface); color:var(--daily-text); }
      .family-prep-item strong { color:var(--daily-text); font-size:13px; }
      .family-prep-item small { color:var(--daily-muted); font-size:12px; }
      .chore-row { border-color:color-mix(in srgb,var(--person-colour) 22%,var(--daily-line)); background:color-mix(in srgb,var(--person-colour) 5%,var(--daily-surface)); }
      .chore-check { background:var(--daily-soft); color:var(--daily-text); }
      .chore-row strong { color:var(--daily-text); font-size:13px; }
      .chore-row small { color:var(--daily-muted); font-size:12px; }
      .family-sidebar .chore-list { grid-template-columns:1fr; }
      .family-sidebar .chore-row strong,.family-sidebar .chore-row small { overflow:visible; white-space:normal; text-overflow:clip; line-height:1.2; overflow-wrap:normal; }
      .family-people-grid .chore-row strong,.family-people-grid .chore-row small { overflow:visible; white-space:normal; text-overflow:clip; line-height:1.25; overflow-wrap:anywhere; }
      .chore-row b { color:var(--daily-text); font-size:12px; }
      .chore-row.is-done { opacity:1; border-color:var(--daily-success-line); background:var(--daily-success-soft); }
      .chore-row.is-done .chore-check { background:var(--daily-success-soft); color:var(--daily-success); }
      .chore-row.is-overdue,.chore-row.is-missed { border-color:var(--daily-danger-line); background:var(--daily-danger-soft); }
      .chore-row.is-overdue .chore-check,.chore-row.is-missed .chore-check { background:var(--daily-danger-soft); color:var(--daily-danger); }
      .chore-row.is-waiting { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); }
      .chore-row.is-waiting .chore-check { background:var(--daily-warning-soft); color:var(--daily-warning); }
      .chore-row.is-unavailable { border-style:dashed; background:var(--daily-soft); }
      .family-summary-item { border-color:color-mix(in srgb,var(--person-colour) 20%,var(--daily-line)); background:color-mix(in srgb,var(--person-colour) 4%,var(--daily-surface)); }
      .family-summary-item > span { background:var(--daily-soft); color:var(--daily-text); }
      .family-summary-item p { color:var(--daily-text); }
      .family-summary-item strong { color:var(--daily-text); }
      .family-summary-item small { color:var(--daily-muted); }
      .family-summary-item.is-done > span { background:var(--daily-success-soft); color:var(--daily-success); }
      .family-summary-item.is-unavailable > span { background:var(--daily-soft); color:var(--daily-muted); }
      .assignment { border-color:var(--daily-line); color:var(--daily-text); }
      .assignment a { color:var(--daily-accent); }
      .assignment small { color:var(--daily-muted); font-size:12px; }
      .classroom-health { color:var(--daily-muted); font-size:12px; }
      .classroom-health.is-stale { color:var(--daily-warning); }

      .media-player-panel { border:0; background:radial-gradient(circle at 85% 10%,rgba(20,99,232,.28),transparent 35%),linear-gradient(145deg,var(--daily-strong),var(--daily-strong-end)); }
      .music-heading .eyebrow { color:var(--daily-strong-accent); }
      .music-heading h2 { color:var(--daily-on-strong); }
      .music-heading > .music-meta { min-height:34px; padding:0 10px; border:1px solid rgba(255,255,255,.14); border-radius:999px; background:#123760; color:var(--daily-strong-muted); font-size:12px; font-weight:500; }
      .media-player-stage { border-color:rgba(255,255,255,.16); background:#07182F; }

      .compact-fixture,.compact-fixture > span,.compact-fixture > strong { color:var(--daily-text); }

      .football-experience { height:100%; min-height:0; display:grid; grid-template-rows:250px minmax(0,1fr); gap:16px; }
      .football-favourites-stage { position:relative; min-height:0; padding:18px 22px; display:flex; flex-direction:column; overflow:hidden; border-radius:24px; background:radial-gradient(circle at 12% 105%,rgba(0,168,135,.24),transparent 34%),radial-gradient(circle at 88% 0,rgba(20,99,232,.3),transparent 34%),var(--daily-strong); color:var(--daily-on-strong); box-shadow:0 18px 42px rgba(6,27,58,.2); }
      .football-favourites-stage::after { content:""; position:absolute; right:50%; bottom:-160px; width:340px; height:340px; transform:translateX(50%); border:1px solid rgba(255,255,255,.055); border-radius:50%; box-shadow:0 0 0 34px rgba(255,255,255,.014),0 0 0 72px rgba(255,255,255,.01); pointer-events:none; }
      .football-hero-heading { position:relative; z-index:1; display:flex; justify-content:space-between; align-items:flex-start; }
      .football-favourites-stage .eyebrow { color:var(--daily-strong-accent); }
      .football-favourites-stage h2 { margin:4px 0 0; color:var(--daily-on-strong); font-size:25px; }
      .football-freshness { max-width:370px; min-height:42px; padding:7px 12px; display:flex; align-items:center; gap:9px; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(255,255,255,.07); }
      .football-freshness > span { min-width:0; }
      .football-freshness > i { width:9px; height:9px; border-radius:50%; background:#00C69D; box-shadow:0 0 0 4px rgba(0,198,157,.16); }
      .football-freshness.is-waiting > i { background:#E7A93D; box-shadow:0 0 0 4px rgba(231,169,61,.16); }
      .football-freshness.is-cached > i { background:#E7A93D; box-shadow:0 0 0 4px rgba(231,169,61,.16); }
      .football-freshness.is-stale > i { background:#E86E5A; box-shadow:0 0 0 4px rgba(232,110,90,.16); }
      .football-freshness strong,.football-freshness small { display:block; color:var(--daily-on-strong); }
      .football-freshness strong { font-size:12px; }
      .football-freshness small { margin-top:2px; color:var(--daily-strong-muted); font-size:12px; line-height:1.25; overflow-wrap:anywhere; }
      .football-health-note { position:relative; z-index:1; width:max-content; max-width:min(430px,62%); margin:7px 0 0 auto; padding:7px 10px; border:1px solid rgba(255,255,255,.14); border-radius:11px; background:rgba(255,255,255,.07); color:var(--daily-strong-muted); font-size:12px; line-height:1.3; }
      .football-health-note.is-cached { border-color:rgba(231,169,61,.45); }
      .football-health-note.is-stale { border-color:rgba(232,110,90,.5); }
      .favourite-hero-grid { position:relative; z-index:1; flex:1; min-height:0; margin-top:10px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
      .football-health-note + .favourite-hero-grid { margin-top:7px; }
      .favourite-hero-card { min-width:0; min-height:0; height:100%; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; overflow:hidden; border:1px solid color-mix(in srgb,var(--club-accent) 40%,rgba(255,255,255,.18)); border-radius:18px; background:radial-gradient(circle at 92% 8%,color-mix(in srgb,var(--club-accent) 22%,transparent),transparent 42%),linear-gradient(135deg,color-mix(in srgb,var(--club-primary) 92%,var(--daily-strong)),color-mix(in srgb,var(--club-primary) 66%,var(--daily-strong))); color:var(--daily-on-strong); box-shadow:0 10px 26px rgba(0,0,0,.18); }
      .favourite-hero-card.is-live { box-shadow:inset 0 0 0 1px rgba(232,110,90,.72),0 10px 26px rgba(0,0,0,.18); }
      .favourite-club-heading,.derby-heading { min-width:0; display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .favourite-club-identity { min-width:0; display:flex; align-items:center; gap:10px; }
      .favourite-club-identity > div,.derby-heading > div { min-width:0; }
      .favourite-club-identity small,.derby-heading small { display:block; color:color-mix(in srgb,var(--club-accent,var(--daily-strong-accent)) 78%,var(--daily-surface)); font-size:12px; font-weight:500; }
      .favourite-club-identity strong,.derby-heading strong { display:block; margin-top:2px; overflow:hidden; color:var(--daily-on-strong); font-size:18px; line-height:1.1; white-space:nowrap; text-overflow:ellipsis; }
      .favourite-match-status { flex:0 0 auto; min-height:28px; padding:0 9px; display:flex; align-items:center; border:1px solid rgba(255,255,255,.2); border-radius:999px; background:rgba(255,255,255,.1); color:var(--daily-on-strong); font-size:12px; font-weight:500; letter-spacing:.05em; }
      .favourite-hero-card.is-live .favourite-match-status { border-color:rgba(255,139,125,.56); background:rgba(180,40,43,.34); }
      .favourite-fixture-summary { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) 30px auto; align-items:end; gap:9px; }
      .favourite-opponent { min-width:0; }
      .favourite-opponent small,.favourite-result small { display:block; color:var(--daily-strong-muted); font-size:12px; line-height:1.2; }
      .favourite-opponent strong { display:block; margin-top:3px; overflow:hidden; color:var(--daily-on-strong); font-size:15px; line-height:1.15; white-space:nowrap; text-overflow:ellipsis; }
      .favourite-result { min-width:74px; text-align:right; }
      .favourite-result strong { display:block; color:var(--daily-on-strong); font-size:22px; line-height:1; letter-spacing:-.025em; }
      .favourite-result small { margin-top:4px; color:var(--club-accent,var(--daily-strong-accent)); font-weight:500; }
      .favourite-fixture-summary.is-empty { grid-template-columns:24px minmax(0,1fr); align-items:center; color:var(--daily-on-strong); }
      .favourite-fixture-summary.is-empty ha-icon { --mdc-icon-size:21px; color:var(--club-accent,var(--daily-strong-accent)); }
      .favourite-fixture-summary.is-empty strong,.favourite-fixture-summary.is-empty small { display:block; color:var(--daily-on-strong); font-size:13px; }
      .favourite-fixture-summary.is-empty small { margin-top:3px; color:var(--daily-strong-muted); font-size:12px; }
      .favourite-hero-card.is-derby { --club-accent:var(--daily-strong-accent); grid-column:1/-1; background:radial-gradient(circle at 12% 20%,rgba(255,255,255,.13),transparent 27%),radial-gradient(circle at 88% 20%,rgba(149,191,229,.22),transparent 28%),linear-gradient(115deg,#132257 0 49.5%,#670E36 50.5% 100%); }
      .derby-heading { align-items:flex-start; }
      .derby-fixture { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) 130px minmax(0,1fr); align-items:center; gap:14px; }
      .derby-team { min-width:0; display:flex; align-items:center; justify-content:flex-end; gap:10px; }
      .derby-team.is-away { flex-direction:row-reverse; }
      .derby-team > strong { overflow:hidden; color:var(--daily-on-strong); font-size:17px; white-space:nowrap; text-overflow:ellipsis; }
      .derby-team.is-away > strong { text-align:right; }
      .team-mark { position:relative; flex:0 0 auto; display:grid; place-items:center; overflow:hidden; border-radius:50%; background:var(--daily-surface); color:var(--daily-strong); box-shadow:0 5px 16px rgba(3,12,28,.18); }
      .team-mark img { position:absolute; inset:11%; width:78%; height:78%; object-fit:contain; background:var(--daily-surface); }
      .team-mark img[hidden] { display:none; }
      .team-mark.is-favourite { width:48px; height:48px; }
      .team-mark.is-favourite strong { font-size:13px; }
      .team-mark.is-small { width:30px; height:30px; }
      .team-mark.is-small strong { font-size:12px; }
      .football-layout { grid-template-columns:minmax(0,1fr) clamp(260px,25vw,320px); gap:16px; }
      .football-main,.favourite-standings { border-color:var(--daily-line); background:var(--daily-surface); }
      .football-main { padding:18px 20px; grid-template-rows:58px minmax(0,1fr); }
      .football-toolbar h2 { font-size:21px; }
      .matchweek-controls { gap:5px; }
      .matchweek-controls button { width:48px; height:48px; background:var(--daily-accent-soft); color:var(--daily-accent); }
      .matchweek-controls .select-shell { min-width:94px; color:var(--daily-text); }
      .matchweek-controls select { height:48px; min-width:94px; border-color:var(--daily-line); background:var(--daily-surface); color:var(--daily-text); font-size:13px; box-shadow:0 4px 12px rgba(21,43,75,.05); }
      .football-tabs .segment { min-height:48px; }
      .fixture-groups { padding-right:5px; }
      .fixture-day h3 { margin:12px 0 7px; color:var(--daily-muted); font-size:12px; }
      .fixture { min-height:58px; grid-template-columns:minmax(0,1fr) 92px minmax(0,1fr); gap:10px; padding:8px 10px; border-color:var(--daily-line); }
      .fixture.is-spotlight { border-color:var(--daily-accent-line); background:var(--daily-accent-soft); }
      .fixture[data-favourite-code~="TOT"] { border-left:4px solid #132257; }
      .fixture[data-favourite-code~="AVL"] { border-left:4px solid #670E36; }
      .fixture.is-family-derby { border-left:1px solid var(--daily-accent-line); box-shadow:none; }
      .fixture.is-family-derby::before,.fixture.is-family-derby::after { content:""; position:absolute; inset-block:0; width:4px; }
      .fixture.is-family-derby::before { left:0; background:#132257; }
      .fixture.is-family-derby::after { right:0; background:#670E36; }
      .fixture.is-live { border-color:#E86E5A; }
      .team { display:flex; align-items:center; gap:8px; color:var(--daily-text); font-size:13px; }
      .away-team { justify-content:flex-end; }
      .fixture-score { font-size:16px; }
      .fixture-score small,.scorers { color:var(--daily-muted); font-size:12px; }
      .favourite-standings { padding:20px; }
      .favourite-standings h2 { font-size:20px; }
      .favourite-standing-list { gap:12px; margin-top:14px; }
      .favourite-standing { min-height:70px; border-color:var(--daily-line); background:color-mix(in srgb,var(--club-accent) 8%,var(--daily-soft)); }
      .favourite-standing strong { color:var(--daily-text); font-size:14px; }
      .favourite-standing small { color:var(--daily-muted); font-size:12px; line-height:1.3; }
      .favourite-standing b { color:var(--club-primary); font-size:19px; }
      .league-table { font-size:13px; }
      .league-table th,.league-table td { padding:9px 8px; border-color:var(--daily-line); }
      .league-table tr.is-spotlight { background:var(--daily-accent-soft); }

      .lights-experience,.heating-experience { height:100%; min-height:0; display:grid; grid-template-rows:auto minmax(0,1fr); gap:14px; }
      .lighting-master,.heating-master { min-height:94px; padding:16px 20px; border-color:var(--daily-line); background:radial-gradient(circle at 76% 0,rgba(39,118,242,.28),transparent 32%),linear-gradient(120deg,var(--daily-strong),var(--daily-strong-end)); color:var(--daily-on-strong); }
      .lighting-master { display:grid; grid-template-columns:minmax(190px,1fr) auto auto; align-items:center; gap:18px; overflow:hidden; }
      .lighting-master-copy,.heating-master-copy { min-width:0; }
      .lighting-master h2,.heating-master h2 { margin:2px 0; color:var(--daily-on-strong); font-size:22px; }
      .lighting-master-copy > span,.heating-master-copy > span { color:var(--daily-strong-muted); font-size:12px; }
      .lighting-master button,.heating-master-actions button,.schedule-editor > button { min-height:48px; padding:0 15px; border:1px solid rgba(255,255,255,.18); border-radius:14px; background:var(--daily-accent); color:var(--daily-on-strong); font-weight:500; }
      .lighting-master-stats { display:flex; align-items:center; gap:8px; }
      .lighting-master-stats > span { min-width:92px; padding:8px 10px; display:grid; grid-template-columns:24px auto; grid-template-rows:auto auto; align-items:center; gap:0 7px; border:1px solid rgba(255,255,255,.14); border-radius:14px; background:rgba(255,255,255,.08); }
      .lighting-master-stats ha-icon { grid-row:1/3; --mdc-icon-size:22px; color:#FFD56A; }
      .lighting-master-stats strong { color:var(--daily-on-strong); font-size:16px; line-height:1; }
      .lighting-master-stats small { color:var(--daily-strong-muted); font-size:12px; }
      .lighting-all-off { display:flex; align-items:center; justify-content:center; gap:7px; white-space:nowrap; }
      .lighting-all-off ha-icon { --mdc-icon-size:20px; }
      .lighting-master button:disabled { opacity:.48; }
      .room-light-master { margin-left:auto; min-height:48px; padding:0 11px; border:1px solid var(--daily-line); border-radius:13px; background:var(--daily-accent-soft); color:var(--daily-accent); display:flex; align-items:center; gap:5px; font-weight:500; }
      .room-light-master.is-on { border-color:var(--daily-warning-line); background:var(--daily-warning-soft); color:var(--daily-warning); }
      .whole-home-card { position:relative; overflow:hidden; background:var(--daily-surface); transition:border-color .2s ease,box-shadow .2s ease; }
      .whole-home-card::before { content:""; position:absolute; inset:0 0 auto; height:4px; background:var(--daily-line); }
      .whole-home-card.has-lights-on { border-color:var(--daily-warning-line); box-shadow:0 14px 34px rgba(123,85,17,.1); }
      .whole-home-card.has-lights-on::before { background:linear-gradient(90deg,#F4B740,#FFD978); }
      .whole-home-controls { grid-template-columns:1fr; gap:8px; }
      .light-device { overflow:hidden; border:1px solid var(--daily-line); border-radius:14px; background:var(--daily-soft); transition:border-color .18s ease,background .18s ease; }
      .light-device.is-on { border-color:var(--daily-warning-line); background:linear-gradient(100deg,var(--daily-warning-soft),var(--daily-warning-soft)); }
      .light-device .whole-home-control { width:100%; min-height:58px; padding:9px 10px; display:grid; grid-template-columns:36px minmax(0,1fr) 32px; gap:9px; border:0; border-radius:0; background:transparent; color:var(--daily-text); }
      .light-device .whole-home-control.is-on { background:transparent; color:var(--daily-warning); }
      .light-control-icon { width:34px; height:34px; display:grid; place-items:center; border-radius:11px; background:var(--daily-accent-soft); color:var(--daily-accent); }
      .light-device.is-on .light-control-icon { background:var(--daily-warning-soft); color:var(--daily-warning); box-shadow:0 0 18px rgba(244,183,64,.28); }
      .light-device .whole-home-control strong { font-size:12px; }
      .light-device .whole-home-control small { margin-top:3px; color:var(--daily-muted); font-size:12px; }
      .light-power-indicator { width:30px; height:30px; display:grid; place-items:center; border-radius:10px; background:var(--daily-soft); color:var(--daily-muted); }
      .light-device.is-on .light-power-indicator { background:#F4B740; color:var(--daily-on-strong); }
      .light-power-indicator ha-icon { --mdc-icon-size:17px; }
      .light-dimmer { min-height:42px; padding:0 10px 8px; display:grid; grid-template-columns:18px minmax(0,1fr) 38px; align-items:center; gap:7px; color:var(--daily-muted); }
      .light-dimmer ha-icon { --mdc-icon-size:16px; }
      .light-dimmer output { color:var(--daily-muted); font-size:12px; font-weight:500; text-align:right; }
      .light-dimmer input { width:100%; height:28px; margin:0; appearance:none; -webkit-appearance:none; background:transparent; cursor:pointer; }
      .light-dimmer input::-webkit-slider-runnable-track { height:6px; border-radius:999px; background:linear-gradient(90deg,#F4B740 0 var(--light-level),var(--daily-line) var(--light-level) 100%); }
      .light-dimmer input::-webkit-slider-thumb { width:18px; height:18px; margin-top:-6px; appearance:none; -webkit-appearance:none; border:3px solid var(--daily-surface); border-radius:50%; background:#E5A51B; box-shadow:0 2px 6px rgba(44,59,82,.3); }
      .light-dimmer input::-moz-range-track { height:6px; border-radius:999px; background:var(--daily-line); }
      .light-dimmer input::-moz-range-progress { height:6px; border-radius:999px; background:#F4B740; }
      .light-dimmer input::-moz-range-thumb { width:14px; height:14px; border:3px solid var(--daily-surface); border-radius:50%; background:#E5A51B; box-shadow:0 2px 6px rgba(44,59,82,.3); }
      .light-dimmer input:disabled { cursor:not-allowed; opacity:.48; }
      .heating-master { display:grid; grid-template-columns:minmax(185px,1fr) auto minmax(330px,auto); align-items:center; gap:14px 18px; overflow:visible; }
      .heating-master-target { align-self:end; display:grid; gap:5px; color:var(--daily-line); font-size:12px; font-weight:500; }
      .master-temperature-stepper { display:grid; grid-template-columns:48px 70px 48px; overflow:hidden; border:1px solid rgba(255,255,255,.2); border-radius:14px; background:rgba(255,255,255,.1); }
      .master-temperature-stepper button { min-height:48px; border:0; background:transparent; color:var(--daily-accent-soft); font-size:20px; font-weight:500; }
      .master-temperature-stepper label { min-width:0; display:flex; align-items:center; justify-content:center; border-inline:1px solid rgba(255,255,255,.14); }
      .master-temperature-stepper input { width:43px; height:46px; padding:0; border:0; outline:0; background:transparent; color:var(--daily-on-strong); font-size:18px; font-weight:500; text-align:right; -moz-appearance:textfield; }
      .master-temperature-stepper input::-webkit-inner-spin-button,.master-temperature-stepper input::-webkit-outer-spin-button { margin:0; -webkit-appearance:none; }
      .master-temperature-stepper b { color:var(--daily-on-strong); font-size:16px; }
      .heating-master-actions { align-self:end; display:grid; grid-template-columns:minmax(132px,1.35fr) repeat(2,minmax(92px,1fr)); gap:8px; }
      .heating-master-actions button { min-width:0; display:flex; align-items:center; justify-content:center; gap:6px; white-space:nowrap; }
      .heating-master-actions button:disabled { opacity:.48; }
      .heating-master-actions ha-icon { --mdc-icon-size:19px; }
      .heating-master .master-schedule { grid-column:1/-1; border-color:rgba(255,255,255,.18); background:rgba(255,255,255,.07); color:var(--daily-on-strong); }
      .heating-master .master-schedule summary small { color:var(--daily-strong-muted); }
      .heating-card { height:max-content; grid-template-rows:auto auto auto; }
      .heating-card.is-schedule-open { grid-column:span 2; }
      .heating-schedule { border:1px solid var(--daily-line); border-radius:14px; background:var(--daily-soft); overflow:visible; }
      .heating-schedule summary { min-height:48px; padding:7px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; cursor:pointer; list-style:none; }
      .heating-schedule summary::-webkit-details-marker { display:none; }
      .heating-schedule summary > span { min-width:0; display:grid; grid-template-columns:22px minmax(0,1fr); align-items:center; gap:1px 6px; }
      .heating-schedule summary > span ha-icon { grid-row:1/3; --mdc-icon-size:19px; color:var(--daily-accent); }
      .heating-schedule summary strong { color:inherit; font-size:12px; }
      .heating-schedule summary small { color:var(--daily-muted); font-size:12px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
      .heating-schedule .schedule-chevron { transition:transform .18s ease; }
      .heating-schedule[open] .schedule-chevron { transform:rotate(180deg); }
      .schedule-editor { padding:12px; display:grid; gap:10px; border-top:1px solid var(--daily-line); }
      .schedule-periods { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .master-schedule .schedule-periods { grid-template-columns:repeat(4,minmax(0,1fr)); }
      .schedule-period { min-width:0; margin:0; padding:9px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; border:1px solid var(--daily-line); border-radius:12px; background:var(--daily-surface); }
      .schedule-period legend { width:100%; padding:0 0 7px; display:grid; grid-template-columns:22px minmax(0,1fr); grid-template-rows:auto auto; align-items:center; gap:1px 7px; color:var(--daily-text); }
      .schedule-period legend > span { grid-row:1/3; width:22px; height:22px; display:grid; place-items:center; border-radius:7px; background:var(--daily-accent-soft); color:var(--daily-accent); font-size:12px; font-weight:500; }
      .schedule-period legend strong { grid-column:2; font-size:12px; line-height:1.15; }
      .schedule-period legend small { grid-column:2; color:var(--daily-muted); font-size:12px; line-height:1.15; }
      .schedule-period label { min-width:0; display:grid; gap:4px; color:var(--daily-muted); font-size:12px; font-weight:500; }
      .schedule-period input { min-width:0; width:100%; height:38px; padding:0 8px; border:1px solid var(--daily-line); border-radius:10px; background:var(--daily-soft); color:var(--daily-text); box-sizing:border-box; font-weight:500; }
      .schedule-temp { min-width:0; display:grid; grid-template-columns:minmax(0,1fr) 24px; align-items:center; overflow:hidden; border:1px solid var(--daily-line); border-radius:10px; background:var(--daily-soft); }
      .schedule-temp input { border:0; border-radius:0; background:transparent; }
      .schedule-temp b { color:var(--daily-muted); font-size:12px; }
      .schedule-editor > button { width:100%; min-height:48px; display:flex; align-items:center; justify-content:center; gap:7px; }
      .cleaning-experience { height:100%; min-height:0; display:grid; grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr); gap:14px; }
      .cleaning-experience .cleaning-panel { display:flex; flex-direction:column; overflow:auto; }
      .cleaning-selectors { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
      .cleaning-selectors label { display:grid; gap:5px; color:var(--daily-muted); font-size:12px; font-weight:500; }
      .cleaning-selectors select { width:100%; height:46px; border:1px solid var(--daily-line); border-radius:13px; background:var(--daily-soft); color:var(--daily-text); padding:0 32px 0 10px; }
      .cleaning-command-grid { display:flex; flex-wrap:wrap; gap:8px; }
      .cleaning-command-grid button { min-height:44px; padding:0 12px; border:1px solid var(--daily-line); border-radius:13px; background:var(--daily-soft); color:var(--daily-accent); display:flex; align-items:center; gap:6px; font-weight:500; }
      .cleaning-consumables { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
      .cleaning-consumables > span { min-height:52px; padding:8px 10px; border:1px solid var(--daily-line); border-radius:13px; display:flex; align-items:center; gap:8px; }
      .cleaning-consumables strong,.cleaning-consumables small { display:block; font-size:11px; }
      .cleaning-map-panel { min-height:0; padding:18px; display:grid; grid-template-rows:auto minmax(0,1fr); gap:10px; border-color:var(--daily-line); background:var(--daily-surface); }
      .vacuum-map-placeholder.is-actionable { padding:24px; display:flex; flex-direction:column; justify-content:center; text-align:center; }
      .vacuum-map-placeholder.is-actionable ha-icon { --mdc-icon-size:44px; color:var(--daily-accent); }
      .vacuum-map-placeholder.is-actionable strong { color:var(--daily-text); font-size:16px; }
      .vacuum-map-placeholder.is-actionable span { max-width:430px; line-height:1.5; }
      .energy-view { grid-template-rows:auto auto minmax(190px,1fr) auto; overflow:auto; }
      .energy-history-grid { min-height:190px; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .energy-history-card { min-height:190px; padding:16px; border-color:var(--daily-line); background:var(--daily-surface); }
      .energy-history-card h2 { margin:2px 0 8px; color:var(--daily-text); font-size:17px; }
      .energy-history-slot { min-height:130px; --ha-card-background:transparent; --card-background-color:transparent; }
      .kid-mission { min-height:88px; padding:13px 15px; display:grid; grid-template-columns:54px minmax(0,1fr) auto; align-items:center; gap:12px; border-radius:18px; background:linear-gradient(120deg,color-mix(in srgb,var(--person-colour) 88%,var(--daily-strong)),var(--daily-strong)); color:var(--daily-on-strong); overflow:hidden; }
      .kid-mission-orbit { width:50px; height:50px; display:grid; place-items:center; border-radius:50%; background:rgba(255,255,255,.14); }
      .kid-mission-orbit ha-icon { --mdc-icon-size:28px; color:var(--daily-on-strong); }
      .kid-mission p,.kid-mission strong { display:block; margin:0; color:var(--daily-on-strong); }
      .kid-mission p { font-size:12px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; }
      .kid-mission strong { margin-top:3px; font-size:16px; }
      .kid-mission i { height:7px; margin-top:9px; display:block; overflow:hidden; border-radius:999px; background:rgba(255,255,255,.18); }
      .kid-mission i b { height:100%; display:block; border-radius:inherit; background:var(--daily-surface); transition:width .35s ease; }
      .kid-mission em { font-style:normal; font-size:22px; font-weight:500; }
      .kid-mission.is-complete { background:linear-gradient(120deg,var(--daily-success),var(--daily-accent)); animation:mission-pop .45s ease; }
      .football-layout.is-fpl { grid-template-columns:minmax(0,1fr); }
      .football-layout.is-fpl .football-main { grid-template-rows:58px minmax(0,1fr); }
      .football-toolbar-spacer { min-width:1px; }
      .fpl-detail { min-height:0; display:grid; grid-template-rows:auto auto minmax(0,1fr); gap:10px; overflow:auto; padding-right:4px; }
      .fpl-entry-selector { display:flex; gap:8px; }
      .fpl-entry-selector button { min-height:48px; padding:0 14px; display:flex; align-items:center; gap:7px; border:1px solid var(--daily-line); border-radius:14px; background:var(--daily-surface); color:var(--daily-text); font-weight:500; cursor:pointer; }
      .fpl-entry-selector button > span { width:28px; height:28px; display:grid; place-items:center; border-radius:9px; background:var(--person-colour); color:var(--daily-on-strong); }
      .fpl-entry-selector button.is-selected { border-color:var(--person-colour); background:color-mix(in srgb,var(--person-colour) 8%,var(--daily-surface)); color:var(--daily-text); }
      .fpl-team-card { min-height:0; padding:14px 16px; border-top:5px solid var(--person-colour); }
      .fpl-team-card header { display:flex; align-items:center; gap:10px; }
      .fpl-team-card header > span { width:42px; height:42px; display:grid; place-items:center; border-radius:14px; background:var(--person-colour); color:var(--daily-on-strong); font-size:18px; font-weight:500; }
      .fpl-team-card header > div { flex:1; min-width:0; }
      .fpl-team-card header h3 { margin:2px 0 0; overflow:hidden; color:var(--daily-text); font-size:17px; white-space:nowrap; text-overflow:ellipsis; }
      .fpl-team-card header > ha-icon { color:#E7A93D; }
      .fpl-scoreboard { margin-top:12px; display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
      .fpl-scoreboard span { padding:10px; border-radius:13px; background:var(--daily-accent-soft); text-align:center; }
      .fpl-scoreboard strong,.fpl-scoreboard small { display:block; }
      .fpl-scoreboard strong { color:var(--daily-text); font-size:19px; }
      .fpl-scoreboard small { margin-top:2px; color:var(--daily-muted); font-size:10px; }
      .fpl-chip { width:max-content; margin:9px 0 0; padding:5px 9px; display:flex; align-items:center; gap:5px; border-radius:999px; background:var(--daily-success-soft); color:var(--daily-accent); font-size:11px; font-weight:500; }
      .fpl-chip ha-icon { --mdc-icon-size:16px; }
      .fpl-detail-grid { min-height:0; display:grid; grid-template-columns:minmax(0,1.65fr) minmax(250px,.75fr); gap:10px; }
      .fpl-squad-panel,.fpl-league-panel { min-height:0; padding:14px; overflow:auto; }
      .fpl-squad-panel .section-heading,.fpl-league-panel .section-heading { display:flex; justify-content:space-between; align-items:center; }
      .fpl-squad-panel h3,.fpl-league-panel h3 { margin:2px 0 0; color:var(--daily-text); }
      .fpl-squad-panel .section-heading > span,.fpl-league-panel .section-heading > span { padding:5px 8px; border-radius:999px; background:var(--daily-soft); color:var(--daily-muted); font-size:10px; font-weight:500; }
      .fpl-pitch { min-height:390px; margin-top:10px; padding:14px 10px; display:grid; align-content:space-around; gap:9px; border-radius:20px; background:linear-gradient(rgba(255,255,255,.07),rgba(255,255,255,.07)),repeating-linear-gradient(0deg,#079B4B 0,#079B4B 64px,#049246 64px,#049246 128px); box-shadow:inset 0 0 0 2px rgba(255,255,255,.72); }
      .fpl-pitch-row { display:flex; justify-content:space-evenly; gap:7px; }
      .fpl-player { position:relative; width:clamp(72px,8.5vw,104px); min-height:88px; padding:5px 4px 7px; display:grid; grid-template-columns:1fr auto; grid-template-rows:43px auto auto; place-items:center; border:1px solid rgba(255,255,255,.44); border-radius:12px; background:rgba(8,44,37,.42); color:var(--daily-on-strong); text-align:center; box-shadow:0 5px 12px rgba(0,0,0,.13); }
      .fpl-player-mark { grid-column:1/-1; position:relative; width:42px; height:42px; display:grid; place-items:center; overflow:hidden; border-radius:50%; background:var(--daily-surface); color:var(--daily-text); }
      .fpl-player-mark img { position:absolute; inset:5px; width:32px; height:32px; object-fit:contain; }
      .fpl-player-mark b { font-size:9px; }
      .fpl-player strong { grid-column:1/-1; max-width:100%; padding:2px 5px; overflow:hidden; border-radius:4px; background:var(--daily-surface); color:var(--daily-text); font-size:10px; white-space:nowrap; text-overflow:ellipsis; }
      .fpl-player small { color:var(--daily-success-soft); font-size:8px; }
      .fpl-player em { min-width:24px; padding:2px 4px; border-radius:4px; background:#2E0A3C; color:var(--daily-on-strong); font-size:10px; font-style:normal; font-weight:500; }
      .fpl-player-badge { position:absolute; left:5px; top:5px; z-index:1; width:20px; height:20px; display:grid; place-items:center; border-radius:50%; background:#2E0A3C; color:var(--daily-on-strong); font-size:10px; font-style:normal; font-weight:500; }
      .fpl-player-warning { position:absolute; right:4px; top:4px; z-index:1; --mdc-icon-size:18px; padding:2px; border-radius:50%; background:#FFE178; color:var(--daily-warning); }
      .fpl-bench { margin-top:9px; padding:9px; border-radius:14px; background:var(--daily-success-soft); }
      .fpl-bench > div { display:flex; justify-content:space-evenly; gap:7px; }
      .fpl-player.is-bench { background:var(--daily-success); }
      .fpl-leagues { margin-top:10px; overflow:auto; }
      .fpl-leagues > span { min-height:42px; display:grid; grid-template-columns:minmax(0,1fr) auto 20px; align-items:center; gap:7px; border-top:1px solid var(--daily-line); color:var(--daily-text); font-size:11px; }
      .fpl-leagues > span strong { overflow-wrap:anywhere; }
      .fpl-leagues > span b { color:var(--daily-text); font-size:12px; }
      .fpl-leagues > span ha-icon { --mdc-icon-size:16px; color:var(--daily-muted); }
      .fpl-leagues > span.is-up ha-icon { color:var(--daily-success); }
      .fpl-leagues > span.is-down ha-icon { color:var(--daily-danger); }
      @keyframes mission-pop { 50% { transform:scale(1.018); } }

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
        .lighting-master { grid-template-columns:minmax(160px,1fr) auto auto; gap:12px; }
        .lighting-master-stats > span { min-width:76px; padding-inline:8px; }
        .heating-master { grid-template-columns:minmax(150px,1fr) auto minmax(300px,auto); gap:12px; }
        .heating-master-actions { grid-template-columns:minmax(116px,1.25fr) repeat(2,minmax(82px,1fr)); }
      }
      @media (max-width:1279px) {
        .heating-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .heating-grid[data-zone-count="6"] { grid-template-columns:repeat(3,minmax(0,1fr)); }
        .heating-grid[data-zone-count="6"] .heating-card { min-height:174px; padding:14px; gap:9px; }
        .heating-grid[data-zone-count="6"] .heating-card-heading > .heating-icon { width:42px; flex-basis:42px; }
        .master-schedule .schedule-periods { grid-template-columns:repeat(2,minmax(0,1fr)); }
      }
      @media (min-width:761px) and (max-width:1279px) {
        :host { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-card,.hub-shell { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); overflow:visible; }
        .hub-content { grid-template-rows:70px auto; }
        .hub-view { min-height:calc(100vh - var(--family-ha-header-offset) - 108px); }
        .lights-experience,.heating-experience,.football-experience,.music-experience { height:auto; min-height:0; }
        .whole-home-grid,.heating-grid { height:auto; overflow:visible; }
        .football-experience { grid-template-rows:auto auto; }
        .football-main,.football-layout.is-fpl .football-main { min-height:0; grid-template-rows:auto auto; overflow:visible; }
        .fpl-detail { min-height:0; grid-template-rows:auto auto auto; overflow:visible; padding-right:0; }
        .fpl-detail-grid { height:auto; align-items:start; }
        .fpl-squad-panel,.fpl-league-panel,.fpl-leagues { overflow:visible; }
        .media-player-panel { height:auto; min-height:0; grid-template-rows:auto auto; }
        .media-player-stage,.media-player-stage .child-card-slot,.media-player-stage .embedded-card { min-height:0; overflow:visible; }
        .media-player-stage .child-card-slot > * { min-height:0; height:auto; }
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
        .calendar-view { grid-template-rows:auto auto minmax(0,1fr); }
        .calendar-toolbar { align-items:stretch; flex-direction:column; }
        .calendar-toolbar-actions { width:100%; display:grid; grid-template-columns:1fr; }
        .calendar-add-event { width:100%; justify-content:center; }
        .calendar-modes { width:100%; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .calendar-modes .segment { justify-content:center; }
        .family-planner-slot { overflow:auto; scrollbar-gutter:stable; }
        .family-planner-grid:not(.is-day) { min-width:980px; }
        .day-people { display:none; }
        .whole-home-grid,.heating-grid,.cover-grid { grid-template-columns:1fr; height:auto; }
        .heating-grid,.heating-grid[data-zone-count="6"] { grid-template-columns:1fr; }
        .cleaning-panel { height:auto; display:flex; flex-direction:column; }
        .vacuum-map-slot,.vacuum-map-placeholder { min-height:320px; }
        .energy-view { height:auto; grid-template-rows:auto auto auto; }
        .energy-hero { align-items:flex-start; flex-direction:column; }
        .energy-meter-grid { grid-template-columns:1fr; }
        .family-dashboard { height:auto; grid-template-rows:auto auto; }
        .family-dashboard.has-kid-switcher { grid-template-rows:auto auto auto; }
        .family-dashboard.has-claim-feedback { grid-template-rows:auto auto auto; }
        .family-dashboard.has-kid-switcher.has-claim-feedback { grid-template-rows:auto auto auto auto; }
        .family-dashboard-heading { align-items:flex-start; flex-wrap:wrap; }
        .family-people-grid { grid-template-columns:1fr; }
        .family-sidebar { display:flex; flex-direction:column; overflow:visible; padding-right:0; scrollbar-gutter:auto; }
        .family-scroll-cue { position:static; }
        .family-summary-grid { grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); }
        .family-person.is-kid-mode .chore-list { grid-template-columns:1fr; }
        .security-main { display:flex; flex-direction:column; }
        .security-stage { min-height:0; }
        .security-stage-media { width:100%; height:auto; min-height:280px; place-self:auto; }
        .security-camera { min-height:174px; }
        .floorplan-canvas { min-height:420px; }
        .music-experience,.media-player-panel { height:auto; min-height:620px; }
        .media-player-panel { grid-template-rows:auto auto; }
        .media-player-stage,.media-player-stage .child-card-slot,.media-player-stage .embedded-card { min-height:0; overflow:visible; }
        .media-player-stage .child-card-slot > * { min-height:0; height:auto; }
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
        .football-tabs { grid-column:1/-1; display:grid; grid-template-columns:repeat(3,1fr); }
        .lighting-master,.heating-master { display:grid; grid-template-columns:1fr; align-items:stretch; }
        .lighting-master-stats { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
        .lighting-master-stats > span { min-width:0; }
        .heating-master-target { justify-self:stretch; }
        .master-temperature-stepper { grid-template-columns:48px minmax(0,1fr) 48px; }
        .heating-master-actions { display:grid; grid-template-columns:1fr; }
        .heating-master .master-schedule { grid-column:auto; }
        .heating-card.is-schedule-open { grid-column:auto; }
        .schedule-periods,.master-schedule .schedule-periods { grid-template-columns:1fr; }
        .cleaning-experience,.energy-history-grid,.fpl-detail-grid { grid-template-columns:1fr; height:auto; }
        .football-layout.is-fpl .football-main { min-height:0; grid-template-rows:auto auto; overflow:visible; }
        .fpl-detail { grid-template-rows:auto auto auto; overflow:visible; padding-right:0; }
        .fpl-squad-panel,.fpl-league-panel,.fpl-leagues { overflow:visible; }
        .fpl-scoreboard { grid-template-columns:repeat(2,minmax(0,1fr)); }
        .fpl-player { width:clamp(60px,20vw,100px); }
      }
      /* Today needs both clubs' latest/live match and next fixture. Stack the
         teams within a row rather than squeezing two names around a score. */
      .compact-fixture:not(.is-empty) { grid-template-columns:minmax(0,1fr) 76px; grid-template-rows:auto auto; gap:3px 10px; padding:10px 12px; }
      .compact-fixture:not(.is-empty) .compact-team { grid-column:1; grid-row:1; overflow:visible; text-align:left; justify-content:flex-start; }
      .compact-fixture:not(.is-empty) .compact-team.is-away { grid-row:2; }
      .compact-fixture:not(.is-empty) .compact-score { grid-column:2; grid-row:1; min-width:0; }
      .compact-fixture:not(.is-empty) .compact-fixture-detail { grid-column:2; grid-row:2; overflow-wrap:anywhere; }
      .compact-fixture .compact-team-name { overflow:visible; white-space:normal; text-overflow:clip; line-height:1.3; }
      .today-grid:has(.today-football[data-fixture-count="3"]),.today-grid:has(.today-football[data-fixture-count="4"]) { height:auto; min-height:100%; grid-template-rows:minmax(282px,auto) minmax(226px,auto); }
      .hub-view:has(.today-football[data-fixture-count="3"]),.hub-view:has(.today-football[data-fixture-count="4"]) { overflow:auto; }
      ${DAILY_BRIEF_STYLES}
      .light-dimmer input:focus-visible,.schedule-period input:focus-visible,.master-temperature-stepper input:focus-visible { outline:3px solid var(--hub-focus); outline-offset:2px; }
      @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
    `;
    // Resolve viewport rules at each breakpoint refresh. WebKit can reuse stale
    // media-query results from a previously mounted shadow stylesheet after zoom.
    // Preference queries remain native so reduced-motion changes apply immediately.
    return styles.replace(/@media\s*([^{}]+)\{/g, (rule, query) => {
      if (!globalThis.matchMedia || !/(?:min|max)-width|orientation/.test(query)) return rule;
      return `@media ${globalThis.matchMedia(query.trim()).matches ? "all" : "not all"} {`;
    });
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
