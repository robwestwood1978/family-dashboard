import Ajv2020 from "ajv/dist/2020.js";
import { statSync } from "node:fs";
import schema from "../config/family-dashboard.schema.json" with { type: "json" };

const validateSchema = new Ajv2020({ strict: true, allErrors: true }).compile(schema);
const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
const ID = /^[a-z][a-z0-9_]*$/;
const PANEL_PATH = /^[a-z][a-z0-9_-]*$/;
const ICON = /^mdi:[a-z0-9-]+$/;
const COLOUR = /^#[0-9a-f]{6}$/i;
const LOCAL_ASSET = /^\/local\/family-dashboard\/[A-Za-z0-9._/-]+$/;
const VACUUM_MAP_CAMERA = /^camera\.[a-z0-9_]*map[a-z0-9_]*$/;
const TEAM_CODE = /^[A-Z]{3}$/;
const FOOTBALL_PREFIX = /^sensor\.[a-z0-9_]+_$/;
const FORBIDDEN_KEY = /(?:^|_)(?:api_?key|authorization|credential|password|secret|token)(?:$|_)/i;
const IANA_TIMEZONE = /^(?:UTC|[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+)$/;

function fail(path, message) {
  throw new Error(`${path}: ${message}`);
}

function requireObject(value, path) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(path, "must be an object");
  }
  return value;
}

function requireString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string");
  }
  return value;
}

function requireArray(value, path) {
  if (!Array.isArray(value)) fail(path, "must be an array");
  return value;
}

function requireBoolean(value, path) {
  if (typeof value !== "boolean") fail(path, "must be boolean");
}

function requireInteger(value, path, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    fail(path, `must be an integer from ${minimum} to ${maximum}`);
  }
}

function requireNumber(value, path, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    fail(path, `must be a number from ${minimum} to ${maximum}`);
  }
}

function validateId(value, path) {
  requireString(value, path);
  if (!ID.test(value)) fail(path, "must be a lowercase identifier");
}

function validateIcon(value, path) {
  requireString(value, path);
  if (!ICON.test(value)) fail(path, "must be an mdi icon identifier");
}

function validateColour(value, path) {
  if (typeof value !== "string" || !COLOUR.test(value)) {
    fail(path, "must be a six-digit hex colour");
  }
}

function validateEntityId(value, path, requiredDomain) {
  requireString(value, path);
  if (!ENTITY_ID.test(value)) fail(path, `invalid Home Assistant entity ID: ${value}`);
  if (requiredDomain && !value.startsWith(`${requiredDomain}.`)) {
    fail(path, `must use the ${requiredDomain} domain`);
  }
}

function validateLocalAsset(value, path) {
  requireString(value, path);
  if (!LOCAL_ASSET.test(value) || value.includes("..")) {
    fail(path, "must be a safe /local/family-dashboard asset URL");
  }
}

function validateTimezone(value, path) {
  requireString(value, path);
  if (!IANA_TIMEZONE.test(value)) fail(path, "must be a valid IANA timezone");
  try {
    if (!statSync(`/usr/share/zoneinfo/${value}`).isFile()) {
      fail(path, "must be a valid IANA timezone");
    }
  } catch {
    fail(path, "must be a valid IANA timezone");
  }
}

function validateVacuumMapCamera(value, path) {
  validateEntityId(value, path, "camera");
  if (!VACUUM_MAP_CAMERA.test(value)) {
    fail(path, "must use a map-named camera entity such as camera.robovac_map");
  }
}

function rejectSecrets(value, path = "config") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const normalisedKey = key.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    if (FORBIDDEN_KEY.test(normalisedKey)) {
      fail(`${path}.${key}`, "secret-bearing keys are not permitted in dashboard config");
    }
    rejectSecrets(child, `${path}.${key}`);
  }
}

function assertSchema(value) {
  if (validateSchema(value)) return;
  const error = validateSchema.errors?.[0];
  const segments = String(error?.instancePath || "").split("/").filter(Boolean);
  if (error?.keyword === "additionalProperties" && error.params?.additionalProperty) {
    segments.push(error.params.additionalProperty);
  }
  const path = ["config", ...segments].join(".");
  fail(path, error?.message || "does not match schema v5");
}

function validateUnique(values, path, message = "must be unique") {
  if (new Set(values).size !== values.length) fail(path, message);
}

export function validateConfig(config) {
  requireObject(config, "config");
  rejectSecrets(config);

  if (config.schema_version !== 5) fail("config.schema_version", "must equal 5");

  requireObject(config.product, "config.product");
  requireString(config.product.title, "config.product.title");
  if (!/^[a-z]{2}-[A-Z]{2}$/.test(requireString(config.product.locale, "config.product.locale"))) {
    fail("config.product.locale", "must use a language-region locale such as en-GB");
  }
  validateTimezone(config.product.timezone, "config.product.timezone");

  const display = requireObject(config.display, "config.display");
  if (!["landscape", "portrait"].includes(display.orientation)) {
    fail("config.display.orientation", "must be landscape or portrait");
  }
  requireBoolean(display.kiosk, "config.display.kiosk");
  requireBoolean(display.legacy_ios, "config.display.legacy_ios");
  requireBoolean(display.read_only, "config.display.read_only");
  requireString(display.panel_path, "config.display.panel_path");
  if (!PANEL_PATH.test(display.panel_path)) {
    fail("config.display.panel_path", "must be a lowercase dashboard path");
  }
  const viewNames = ["today", "calendar", "rooms", "family", "music", "football"];
  if (!viewNames.includes(display.default_view)) {
    fail("config.display.default_view", "must name a v0.5 dashboard view");
  }
  requireInteger(display.target_width, "config.display.target_width", 768, 2560);
  requireInteger(display.target_height, "config.display.target_height", 600, 1600);

  const theme = requireObject(config.theme, "config.theme");
  for (const key of [
    "accent",
    "background",
    "surface",
    "text",
    "muted",
    "backdrop_start",
    "backdrop_mid",
    "backdrop_end",
    "nav_background"
  ]) {
    validateColour(theme[key], `config.theme.${key}`);
  }
  requireInteger(theme.radius_px, "config.theme.radius_px", 8, 32);

  const people = requireArray(config.people, "config.people");
  if (people.length === 0) fail("config.people", "must contain at least one person");
  const personIds = new Set();
  const personRoles = new Map();
  const personLocationEntities = new Set();
  people.forEach((person, index) => {
    const path = `config.people[${index}]`;
    requireObject(person, path);
    validateId(person.id, `${path}.id`);
    if (personIds.has(person.id)) fail(`${path}.id`, "must be unique");
    personIds.add(person.id);
    requireString(person.name, `${path}.name`);
    if (!["parent", "child", "household"].includes(person.role)) fail(`${path}.role`, "invalid role");
    personRoles.set(person.id, person.role);
    validateColour(person.colour, `${path}.colour`);
    if (person.location_entity) {
      validateEntityId(person.location_entity, `${path}.location_entity`, "person");
      if (personLocationEntities.has(person.location_entity)) {
        fail(`${path}.location_entity`, "must be unique");
      }
      personLocationEntities.add(person.location_entity);
    }
  });

  const features = requireObject(config.features, "config.features");
  const featureNames = [
    "calendar",
    "rooms",
    "family",
    "music",
    "chores",
    "football",
    "lists",
    "weather",
    "school",
    "location_map",
    "entry"
  ];
  for (const feature of featureNames) requireBoolean(features[feature], `config.features.${feature}`);
  if (features.location_map && !features.family) {
    fail("config.features.location_map", "requires the Family view");
  }
  if (features.entry) {
    fail("config.features.entry", "camera and garage controls remain disabled until a separately qualified release");
  }
  if (display.default_view !== "today" && features[display.default_view] !== true) {
    fail("config.display.default_view", "must be enabled in config.features");
  }

  const calendar = requireObject(config.calendar, "config.calendar");
  if (!["listWeek", "dayGridMonth", "dayGridDay"].includes(calendar.initial_view)) {
    fail("config.calendar.initial_view", "unsupported native Home Assistant calendar view");
  }
  requireInteger(calendar.rolling_days, "config.calendar.rolling_days", 1, 31);
  const calendarEntities = requireArray(calendar.entities, "config.calendar.entities");
  const calendarIds = [];
  calendarEntities.forEach((entry, index) => {
    const path = `config.calendar.entities[${index}]`;
    requireObject(entry, path);
    validateId(entry.id, `${path}.id`);
    calendarIds.push(entry.id);
    validateEntityId(entry.entity_id, `${path}.entity_id`, "calendar");
    requireString(entry.label, `${path}.label`);
    validateColour(entry.colour, `${path}.colour`);
    requireArray(entry.person_ids, `${path}.person_ids`).forEach((personId) => {
      if (!personIds.has(personId)) fail(`${path}.person_ids`, `unknown person: ${personId}`);
    });
    if (entry.category && !["family", "personal", "school", "trip", "other"].includes(entry.category)) {
      fail(`${path}.category`, "unsupported calendar category");
    }
  });
  validateUnique(calendarIds, "config.calendar.entities[].id");
  if (features.calendar && calendarEntities.length === 0) {
    fail("config.calendar.entities", "must not be empty when Calendar is enabled");
  }

  const weather = requireObject(config.weather, "config.weather");
  validateEntityId(weather.entity_id, "config.weather.entity_id", "weather");

  const lists = requireObject(config.lists, "config.lists");
  validateEntityId(lists.reminders_entity, "config.lists.reminders_entity", "todo");
  validateEntityId(lists.shopping_entity, "config.lists.shopping_entity", "todo");

  const floorplan = requireObject(config.floorplan, "config.floorplan");
  validateId(floorplan.default_floor, "config.floorplan.default_floor");
  const floors = requireArray(floorplan.floors, "config.floorplan.floors");
  if (floors.length === 0) fail("config.floorplan.floors", "must contain at least one floor");
  const floorIds = new Set();
  const hotspots = new Map();
  const overlayEntities = new Map();
  floors.forEach((floor, floorIndex) => {
    const path = `config.floorplan.floors[${floorIndex}]`;
    requireObject(floor, path);
    validateId(floor.id, `${path}.id`);
    if (floorIds.has(floor.id)) fail(`${path}.id`, "must be unique");
    floorIds.add(floor.id);
    requireString(floor.name, `${path}.name`);
    if (!floor.base_image && !floor.vacuum_map_entity) {
      fail(path, "must define base_image or vacuum_map_entity");
    }
    if (floor.base_image) validateLocalAsset(floor.base_image, `${path}.base_image`);
    if (floor.asset_revision !== undefined) {
      requireString(floor.asset_revision, `${path}.asset_revision`);
      if (!/^[A-Za-z0-9._-]{1,32}$/.test(floor.asset_revision)) {
        fail(`${path}.asset_revision`, "must be a short cache-safe revision");
      }
    }
    if (floor.vacuum_map_entity) validateVacuumMapCamera(floor.vacuum_map_entity, `${path}.vacuum_map_entity`);
    requireNumber(floor.aspect_ratio, `${path}.aspect_ratio`, 0.5, 4);
    if (floor.night_image) validateLocalAsset(floor.night_image, `${path}.night_image`);
    const floorHotspotIds = [];
    requireArray(floor.room_hotspots, `${path}.room_hotspots`).forEach((hotspot, hotspotIndex) => {
      const hotspotPath = `${path}.room_hotspots[${hotspotIndex}]`;
      requireObject(hotspot, hotspotPath);
      validateId(hotspot.room_id, `${hotspotPath}.room_id`);
      floorHotspotIds.push(hotspot.room_id);
      const points = requireArray(hotspot.points, `${hotspotPath}.points`);
      if (points.length < 3) fail(`${hotspotPath}.points`, "must contain at least three points");
      points.forEach((point, pointIndex) => {
        if (!Array.isArray(point) || point.length !== 2 || point.some((value) => typeof value !== "number" || value < 0 || value > 100)) {
          fail(`${hotspotPath}.points[${pointIndex}]`, "must be an [x,y] pair from 0 to 100");
        }
      });
      if (hotspots.has(hotspot.room_id)) fail(`${hotspotPath}.room_id`, "must occur on exactly one floor");
      hotspots.set(hotspot.room_id, floor.id);
    });
    validateUnique(floorHotspotIds, `${path}.room_hotspots[].room_id`);
    const floorOverlays = [];
    requireArray(floor.light_overlays, `${path}.light_overlays`).forEach((overlay, overlayIndex) => {
      const overlayPath = `${path}.light_overlays[${overlayIndex}]`;
      requireObject(overlay, overlayPath);
      validateEntityId(overlay.entity_id, `${overlayPath}.entity_id`, "light");
      validateLocalAsset(overlay.image, `${overlayPath}.image`);
      floorOverlays.push(overlay.entity_id);
      overlayEntities.set(overlay.entity_id, floor.id);
    });
    validateUnique(floorOverlays, `${path}.light_overlays[].entity_id`);
  });
  if (!floorIds.has(floorplan.default_floor)) {
    fail("config.floorplan.default_floor", "must match one configured floor");
  }

  const rooms = requireArray(config.rooms, "config.rooms");
  const roomIds = new Set();
  const roomLights = new Map();
  rooms.forEach((room, index) => {
    const path = `config.rooms[${index}]`;
    requireObject(room, path);
    validateId(room.id, `${path}.id`);
    if (roomIds.has(room.id)) fail(`${path}.id`, "must be unique");
    roomIds.add(room.id);
    requireString(room.name, `${path}.name`);
    validateId(room.floor_id, `${path}.floor_id`);
    if (!floorIds.has(room.floor_id)) fail(`${path}.floor_id`, "must match one configured floor");
    validateId(room.area_id, `${path}.area_id`);
    validateIcon(room.icon, `${path}.icon`);
    const lights = requireArray(room.lights, `${path}.lights`);
    lights.forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.lights[${entityIndex}]`, "light");
      if (roomLights.has(entityId)) fail(`${path}.lights[${entityIndex}]`, "must belong to only one room");
      roomLights.set(entityId, room.floor_id);
    });
    requireArray(room.covers, `${path}.covers`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.covers[${entityIndex}]`, "cover");
    });
    requireArray(room.scenes, `${path}.scenes`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.scenes[${entityIndex}]`, "scene");
    });
    requireArray(room.media_players, `${path}.media_players`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.media_players[${entityIndex}]`, "media_player");
    });
    if (room.climate) validateEntityId(room.climate, `${path}.climate`, "climate");
    if (room.temperature_sensor) {
      validateEntityId(room.temperature_sensor, `${path}.temperature_sensor`, "sensor");
    }
  });
  if (features.rooms && rooms.length === 0) fail("config.rooms", "must not be empty when Rooms is enabled");
  for (const room of rooms) {
    if (!hotspots.has(room.id)) fail("config.floorplan", `missing room hotspot for ${room.id}`);
    if (hotspots.get(room.id) !== room.floor_id) {
      fail("config.floorplan", `room hotspot for ${room.id} is on the wrong floor`);
    }
  }
  for (const [roomId] of hotspots) {
    if (!roomIds.has(roomId)) fail("config.floorplan", `hotspot references unknown room: ${roomId}`);
  }
  for (const [entityId, floorId] of overlayEntities) {
    if (!roomLights.has(entityId)) fail("config.floorplan", `light overlay references an unconfigured light: ${entityId}`);
    if (roomLights.get(entityId) !== floorId) {
      fail("config.floorplan", `light overlay for ${entityId} is on the wrong floor`);
    }
  }

  const media = requireObject(config.media, "config.media");
  if (media.card_type !== "custom:mediocre-multi-media-player-card") {
    fail("config.media.card_type", "unsupported full music card");
  }
  validateEntityId(media.initial_player, "config.media.initial_player", "media_player");
  const players = requireArray(media.players, "config.media.players");
  players.forEach((player, index) => {
    const path = `config.media.players[${index}]`;
    requireObject(player, path);
    validateEntityId(player.entity_id, `${path}.entity_id`, "media_player");
    requireString(player.name, `${path}.name`);
    if (player.ma_entity_id) validateEntityId(player.ma_entity_id, `${path}.ma_entity_id`, "media_player");
    if (player.speaker_group_entity_id) validateEntityId(player.speaker_group_entity_id, `${path}.speaker_group_entity_id`);
    if (player.can_be_grouped !== undefined) requireBoolean(player.can_be_grouped, `${path}.can_be_grouped`);
  });
  validateUnique(players.map((player) => player.entity_id), "config.media.players[].entity_id");
  if (features.music && players.length === 0) fail("config.media.players", "must not be empty when Music is enabled");
  if (players.length && !players.some((player) => player.entity_id === media.initial_player)) {
    fail("config.media.initial_player", "must match one configured player");
  }

  const chores = requireObject(config.chores, "config.chores");
  if (chores.profile !== "choreops-status") fail("config.chores.profile", "unsupported chore presentation profile");
  const choreUsers = requireArray(chores.users, "config.chores.users");
  const chorePersonIds = [];
  choreUsers.forEach((user, index) => {
    const path = `config.chores.users[${index}]`;
    requireObject(user, path);
    if (!personIds.has(user.person_id)) fail(`${path}.person_id`, `unknown person: ${user.person_id}`);
    if (personRoles.get(user.person_id) !== "child") fail(`${path}.person_id`, "must reference a child");
    chorePersonIds.push(user.person_id);
    validateEntityId(user.dashboard_helper_entity, `${path}.dashboard_helper_entity`, "sensor");
    validateEntityId(user.points_entity, `${path}.points_entity`, "sensor");
    validateEntityId(user.chores_entity, `${path}.chores_entity`, "sensor");
    const statusEntities = requireArray(user.status_entities, `${path}.status_entities`);
    if (statusEntities.length === 0) fail(`${path}.status_entities`, "must contain at least one ChoreOps status sensor");
    statusEntities.forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.status_entities[${entityIndex}]`, "sensor");
    });
    validateUnique(statusEntities, `${path}.status_entities`);
  });
  validateUnique(chorePersonIds, "config.chores.users[].person_id");
  if (features.chores && choreUsers.length === 0) fail("config.chores.users", "must not be empty when Chores is enabled");

  const football = requireObject(config.football, "config.football");
  if (football.provider !== "fpl") fail("config.football.provider", "unsupported football provider");
  const teamCodes = requireArray(football.spotlight_team_codes, "config.football.spotlight_team_codes");
  if (teamCodes.length === 0) fail("config.football.spotlight_team_codes", "must not be empty");
  teamCodes.forEach((code, index) => {
    if (typeof code !== "string" || !TEAM_CODE.test(code)) {
      fail(`config.football.spotlight_team_codes[${index}]`, "must be a three-letter team code");
    }
  });
  validateUnique(teamCodes, "config.football.spotlight_team_codes");
  for (const requiredCode of ["TOT", "AVL"]) {
    if (!teamCodes.includes(requiredCode)) {
      fail("config.football.spotlight_team_codes", `must include ${requiredCode}`);
    }
  }
  validateEntityId(football.index_entity, "config.football.index_entity", "sensor");
  if (typeof football.gameweek_entity_prefix !== "string" || !FOOTBALL_PREFIX.test(football.gameweek_entity_prefix)) {
    fail("config.football.gameweek_entity_prefix", "must be a sensor entity prefix ending in underscore");
  }
  validateEntityId(football.table_entity, "config.football.table_entity", "sensor");

  const school = requireObject(config.school, "config.school");
  const classroomStudents = requireArray(school.classroom_students, "config.school.classroom_students");
  const classroomPersonIds = [];
  classroomStudents.forEach((student, index) => {
    const path = `config.school.classroom_students[${index}]`;
    requireObject(student, path);
    if (!personIds.has(student.person_id)) fail(`${path}.person_id`, `unknown person: ${student.person_id}`);
    if (personRoles.get(student.person_id) !== "child") fail(`${path}.person_id`, "must reference a child");
    classroomPersonIds.push(student.person_id);
    validateEntityId(student.assignments_entity, `${path}.assignments_entity`, "sensor");
  });
  validateUnique(classroomPersonIds, "config.school.classroom_students[].person_id");
  if (features.school && classroomStudents.length === 0) {
    fail("config.school.classroom_students", "must not be empty when School is enabled");
  }
  for (const key of ["calendar_entities", "scopay_calendar_entities"]) {
    const entities = requireArray(school[key], `config.school.${key}`);
    entities.forEach((entityId, index) => {
      validateEntityId(entityId, `config.school.${key}[${index}]`, "calendar");
    });
    validateUnique(entities, `config.school.${key}`);
  }

  const location = requireObject(config.location, "config.location");
  const locationEntities = requireArray(location.entities, "config.location.entities");
  locationEntities.forEach((entityId, index) => {
    validateEntityId(entityId, `config.location.entities[${index}]`, "person");
    if (!personLocationEntities.has(entityId)) {
      fail(`config.location.entities[${index}]`, "must match one explicitly configured person location entity");
    }
  });
  validateUnique(locationEntities, "config.location.entities");
  requireInteger(location.hours_to_show, "config.location.hours_to_show", 0, 24);
  if (features.location_map && locationEntities.length === 0) {
    fail("config.location.entities", "must not be empty when the location map is enabled");
  }

  if (config.entry !== undefined) {
    const entry = requireObject(config.entry, "config.entry");
    validateId(entry.primary_camera_id, "config.entry.primary_camera_id");
    const cameras = requireArray(entry.cameras, "config.entry.cameras");
    const cameraIds = new Set();
    cameras.forEach((camera, index) => {
      const path = `config.entry.cameras[${index}]`;
      requireObject(camera, path);
      validateId(camera.id, `${path}.id`);
      if (cameraIds.has(camera.id)) fail(`${path}.id`, "must be unique");
      cameraIds.add(camera.id);
      requireString(camera.name, `${path}.name`);
      validateEntityId(camera.entity_id, `${path}.entity_id`, "camera");
      if (!["doorbell", "driveway", "garden", "other"].includes(camera.role)) fail(`${path}.role`, "unsupported camera role");
      if (camera.motion_entity) validateEntityId(camera.motion_entity, `${path}.motion_entity`, "binary_sensor");
      if (camera.person_entity) validateEntityId(camera.person_entity, `${path}.person_entity`, "binary_sensor");
      if (camera.ringing_entity) validateEntityId(camera.ringing_entity, `${path}.ringing_entity`, "binary_sensor");
      if (camera.start_stream_entity) validateEntityId(camera.start_stream_entity, `${path}.start_stream_entity`, "button");
      if (camera.stop_stream_entity) validateEntityId(camera.stop_stream_entity, `${path}.stop_stream_entity`, "button");
    });
    if (!cameraIds.has(entry.primary_camera_id)) fail("config.entry.primary_camera_id", "must match one configured camera");
    const garage = requireObject(entry.garage, "config.entry.garage");
    validateEntityId(garage.cover_entity, "config.entry.garage.cover_entity", "cover");
    validateId(garage.camera_id, "config.entry.garage.camera_id");
    if (!cameraIds.has(garage.camera_id)) fail("config.entry.garage.camera_id", "must match one configured camera");
    if (garage.motion_entity) validateEntityId(garage.motion_entity, "config.entry.garage.motion_entity", "binary_sensor");
  }

  assertSchema(config);
  return config;
}
