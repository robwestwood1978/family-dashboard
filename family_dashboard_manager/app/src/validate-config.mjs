const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
const ID = /^[a-z][a-z0-9_]*$/;
const PANEL_PATH = /^[a-z][a-z0-9_-]*$/;
const ICON = /^mdi:[a-z0-9-]+$/;
const COLOUR = /^#[0-9a-f]{6}$/i;
const FORBIDDEN_KEY = /(?:^|_)(?:api_?key|authorization|credential|password|secret|token)(?:$|_)/i;

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

function validateId(value, path) {
  requireString(value, path);
  if (!ID.test(value)) fail(path, "must be a lowercase identifier");
}

function validateIcon(value, path) {
  requireString(value, path);
  if (!ICON.test(value)) fail(path, "must be an mdi icon identifier");
}

function validateColour(value, path) {
  if (!COLOUR.test(value)) fail(path, "must be a six-digit hex colour");
}

function validateEntityId(value, path, requiredDomain) {
  requireString(value, path);
  if (!ENTITY_ID.test(value)) fail(path, `invalid Home Assistant entity ID: ${value}`);
  if (requiredDomain && !value.startsWith(`${requiredDomain}.`)) {
    fail(path, `must use the ${requiredDomain} domain`);
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

function validateEntityCollection(collection, path) {
  requireObject(collection, path);
  requireArray(collection.entities, `${path}.entities`).forEach((entityId, index) => {
    validateEntityId(entityId, `${path}.entities[${index}]`);
  });
}

export function validateConfig(config) {
  requireObject(config, "config");
  rejectSecrets(config);

  if (config.schema_version !== 2) fail("config.schema_version", "must equal 2");

  requireObject(config.product, "config.product");
  requireString(config.product.title, "config.product.title");
  requireString(config.product.locale, "config.product.locale");
  requireString(config.product.timezone, "config.product.timezone");

  const display = requireObject(config.display, "config.display");
  if (!["landscape", "portrait"].includes(display.orientation)) {
    fail("config.display.orientation", "must be landscape or portrait");
  }
  requireBoolean(display.kiosk, "config.display.kiosk");
  requireBoolean(display.legacy_ios, "config.display.legacy_ios");
  requireString(display.panel_path, "config.display.panel_path");
  if (!PANEL_PATH.test(display.panel_path)) {
    fail("config.display.panel_path", "must be a lowercase dashboard path");
  }
  if (!["today", "calendar", "home", "music", "chores", "football", "school"].includes(display.default_view)) {
    fail("config.display.default_view", "must name a dashboard view");
  }

  const theme = requireObject(config.theme, "config.theme");
  for (const key of ["accent", "background", "surface", "text", "muted"]) {
    validateColour(theme[key], `config.theme.${key}`);
  }
  if (!Number.isInteger(theme.radius_px) || theme.radius_px < 8 || theme.radius_px > 32) {
    fail("config.theme.radius_px", "must be an integer from 8 to 32");
  }

  const people = requireArray(config.people, "config.people");
  if (people.length === 0) fail("config.people", "must contain at least one person");
  const personIds = new Set();
  const personRoles = new Map();
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
  });

  const features = requireObject(config.features, "config.features");
  for (const feature of ["calendar", "home", "music", "chores", "football", "lists", "weather", "school"]) {
    requireBoolean(features[feature], `config.features.${feature}`);
  }
  if (display.default_view !== "today" && features[display.default_view] !== true) {
    fail("config.display.default_view", "must be enabled in config.features");
  }

  const calendar = requireObject(config.calendar, "config.calendar");
  if (!["custom:daylight-calendar-card", "custom:skylight-calendar-card"].includes(calendar.card_type)) {
    fail("config.calendar.card_type", "unsupported calendar card");
  }
  if (!["month", "week-compact", "week-standard", "agenda"].includes(calendar.default_view)) {
    fail("config.calendar.default_view", "unsupported calendar view");
  }
  if (!Number.isInteger(calendar.rolling_days) || calendar.rolling_days < 1 || calendar.rolling_days > 31) {
    fail("config.calendar.rolling_days", "must be an integer from 1 to 31");
  }
  const calendarEntities = requireArray(calendar.entities, "config.calendar.entities");
  const calendarIds = new Set();
  calendarEntities.forEach((entry, index) => {
    const path = `config.calendar.entities[${index}]`;
    requireObject(entry, path);
    validateId(entry.id, `${path}.id`);
    if (calendarIds.has(entry.id)) fail(`${path}.id`, "must be unique");
    calendarIds.add(entry.id);
    validateEntityId(entry.entity_id, `${path}.entity_id`, "calendar");
    requireString(entry.label, `${path}.label`);
    validateColour(entry.colour, `${path}.colour`);
    requireArray(entry.person_ids, `${path}.person_ids`).forEach((personId) => {
      if (!personIds.has(personId)) fail(`${path}.person_ids`, `unknown person: ${personId}`);
    });
  });
  if (features.calendar && calendarEntities.length === 0) {
    fail("config.calendar.entities", "must not be empty when calendar is enabled");
  }

  const weather = requireObject(config.weather, "config.weather");
  validateEntityId(weather.entity_id, "config.weather.entity_id", "weather");

  const lists = requireObject(config.lists, "config.lists");
  validateEntityId(lists.reminders_entity, "config.lists.reminders_entity", "todo");
  validateEntityId(lists.shopping_entity, "config.lists.shopping_entity", "todo");

  const rooms = requireArray(config.rooms, "config.rooms");
  const roomIds = new Set();
  rooms.forEach((room, index) => {
    const path = `config.rooms[${index}]`;
    requireObject(room, path);
    validateId(room.id, `${path}.id`);
    if (roomIds.has(room.id)) fail(`${path}.id`, "must be unique");
    roomIds.add(room.id);
    requireString(room.name, `${path}.name`);
    validateId(room.area_id, `${path}.area_id`);
    validateIcon(room.icon, `${path}.icon`);
    requireArray(room.lights, `${path}.lights`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.lights[${entityIndex}]`, "light");
    });
    requireArray(room.covers, `${path}.covers`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.covers[${entityIndex}]`, "cover");
    });
    if (room.climate) validateEntityId(room.climate, `${path}.climate`, "climate");
    if (room.scene) validateEntityId(room.scene, `${path}.scene`, "scene");
  });
  if (features.home && rooms.length === 0) fail("config.rooms", "must not be empty when home is enabled");

  const media = requireObject(config.media, "config.media");
  if (media.card_type !== "custom:mediocre-multi-media-player-card") {
    fail("config.media.card_type", "unsupported media card");
  }
  validateEntityId(media.initial_player, "config.media.initial_player", "media_player");
  const players = requireArray(media.players, "config.media.players");
  players.forEach((player, index) => {
    const path = `config.media.players[${index}]`;
    requireObject(player, path);
    validateEntityId(player.entity_id, `${path}.entity_id`, "media_player");
    requireString(player.name, `${path}.name`);
    if (player.ma_entity_id) validateEntityId(player.ma_entity_id, `${path}.ma_entity_id`, "media_player");
    if (player.speaker_group_entity_id) {
      validateEntityId(player.speaker_group_entity_id, `${path}.speaker_group_entity_id`);
    }
    if (player.can_be_grouped !== undefined) requireBoolean(player.can_be_grouped, `${path}.can_be_grouped`);
  });
  if (features.music && players.length === 0) fail("config.media.players", "must not be empty when music is enabled");
  if (players.length && !players.some((player) => player.entity_id === media.initial_player)) {
    fail("config.media.initial_player", "must match one configured player");
  }

  const chores = requireObject(config.chores, "config.chores");
  if (chores.profile !== "legacy-lite") fail("config.chores.profile", "unsupported chore presentation profile");
  const choreUsers = requireArray(chores.users, "config.chores.users");
  const chorePersonIds = new Set();
  choreUsers.forEach((user, index) => {
    const path = `config.chores.users[${index}]`;
    requireObject(user, path);
    if (!personIds.has(user.person_id)) fail(`${path}.person_id`, `unknown person: ${user.person_id}`);
    if (personRoles.get(user.person_id) !== "child") fail(`${path}.person_id`, "must reference a child");
    if (chorePersonIds.has(user.person_id)) fail(`${path}.person_id`, "must be unique");
    chorePersonIds.add(user.person_id);
    validateEntityId(user.dashboard_helper_entity, `${path}.dashboard_helper_entity`, "sensor");
    validateEntityId(user.points_entity, `${path}.points_entity`, "sensor");
    validateEntityId(user.chores_entity, `${path}.chores_entity`, "sensor");
  });
  if (features.chores && choreUsers.length === 0) {
    fail("config.chores.users", "must not be empty when chores are enabled");
  }

  const football = requireObject(config.football, "config.football");
  if (football.card_type !== "custom:teamtracker-card") {
    fail("config.football.card_type", "unsupported football card");
  }
  const footballEntities = requireArray(football.entities, "config.football.entities");
  footballEntities.forEach((entry, index) => {
    const path = `config.football.entities[${index}]`;
    requireObject(entry, path);
    validateEntityId(entry.entity_id, `${path}.entity_id`, "sensor");
    requireString(entry.label, `${path}.label`);
  });
  if (features.football && footballEntities.length === 0) {
    fail("config.football.entities", "must not be empty when football is enabled");
  }

  validateEntityCollection(config.school, "config.school");

  return config;
}
