const ENTITY_ID = /^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/;
const ID = /^[a-z][a-z0-9_]*$/;
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

function validateEntityId(value, path) {
  requireString(value, path);
  if (!ENTITY_ID.test(value)) fail(path, `invalid Home Assistant entity ID: ${value}`);
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

  if (config.schema_version !== 1) fail("config.schema_version", "must equal 1");

  requireObject(config.product, "config.product");
  requireString(config.product.title, "config.product.title");
  requireString(config.product.locale, "config.product.locale");
  requireString(config.product.timezone, "config.product.timezone");

  requireObject(config.display, "config.display");
  if (!["landscape", "portrait"].includes(config.display.orientation)) {
    fail("config.display.orientation", "must be landscape or portrait");
  }
  if (typeof config.display.kiosk !== "boolean") fail("config.display.kiosk", "must be boolean");
  if (typeof config.display.legacy_ios !== "boolean") fail("config.display.legacy_ios", "must be boolean");

  const people = requireArray(config.people, "config.people");
  if (people.length === 0) fail("config.people", "must contain at least one person");
  const personIds = new Set();
  people.forEach((person, index) => {
    const path = `config.people[${index}]`;
    requireObject(person, path);
    requireString(person.id, `${path}.id`);
    if (!ID.test(person.id)) fail(`${path}.id`, "must be a lowercase identifier");
    if (personIds.has(person.id)) fail(`${path}.id`, "must be unique");
    personIds.add(person.id);
    requireString(person.name, `${path}.name`);
    if (!["parent", "child", "household"].includes(person.role)) fail(`${path}.role`, "invalid role");
    if (!COLOUR.test(person.colour)) fail(`${path}.colour`, "must be a six-digit hex colour");
  });

  const features = requireObject(config.features, "config.features");
  for (const feature of ["calendar", "home", "music", "chores", "football", "school"]) {
    if (typeof features[feature] !== "boolean") fail(`config.features.${feature}`, "must be boolean");
  }

  const calendar = requireObject(config.calendar, "config.calendar");
  if (!["custom:daylight-calendar-card", "custom:skylight-calendar-card"].includes(calendar.card_type)) {
    fail("config.calendar.card_type", "unsupported calendar card");
  }
  if (!Number.isInteger(calendar.rolling_days) || calendar.rolling_days < 1 || calendar.rolling_days > 31) {
    fail("config.calendar.rolling_days", "must be an integer from 1 to 31");
  }
  const calendarEntities = requireArray(calendar.entities, "config.calendar.entities");
  calendarEntities.forEach((entry, index) => {
    const path = `config.calendar.entities[${index}]`;
    requireObject(entry, path);
    validateEntityId(entry.entity_id, `${path}.entity_id`);
    if (!COLOUR.test(entry.colour)) fail(`${path}.colour`, "must be a six-digit hex colour");
    requireArray(entry.person_ids, `${path}.person_ids`).forEach((personId) => {
      if (!personIds.has(personId)) fail(`${path}.person_ids`, `unknown person: ${personId}`);
    });
  });
  if (features.calendar && calendarEntities.length === 0) {
    fail("config.calendar.entities", "must not be empty when calendar is enabled");
  }

  const rooms = requireArray(config.rooms, "config.rooms");
  rooms.forEach((room, index) => {
    const path = `config.rooms[${index}]`;
    requireObject(room, path);
    requireString(room.id, `${path}.id`);
    requireString(room.name, `${path}.name`);
    requireString(room.area_id, `${path}.area_id`);
    requireArray(room.lights, `${path}.lights`).forEach((entityId, entityIndex) => {
      validateEntityId(entityId, `${path}.lights[${entityIndex}]`);
    });
    if (room.climate) validateEntityId(room.climate, `${path}.climate`);
    if (room.scene) validateEntityId(room.scene, `${path}.scene`);
  });

  const media = requireObject(config.media, "config.media");
  if (media.card_type !== "custom:mediocre-multi-media-player-card") {
    fail("config.media.card_type", "unsupported media card");
  }
  validateEntityId(media.initial_player, "config.media.initial_player");
  const players = requireArray(media.players, "config.media.players");
  players.forEach((player, index) => {
    const path = `config.media.players[${index}]`;
    validateEntityId(player.entity_id, `${path}.entity_id`);
    requireString(player.name, `${path}.name`);
    if (player.ma_entity_id) validateEntityId(player.ma_entity_id, `${path}.ma_entity_id`);
    if (player.speaker_group_entity_id) {
      validateEntityId(player.speaker_group_entity_id, `${path}.speaker_group_entity_id`);
    }
  });
  if (features.music && players.length === 0) fail("config.media.players", "must not be empty when music is enabled");
  if (players.length && !players.some((player) => player.entity_id === media.initial_player)) {
    fail("config.media.initial_player", "must match one configured player");
  }

  validateEntityCollection({ entities: config.chores.summary_entities ?? [] }, "config.chores");
  validateEntityCollection(config.football, "config.football");
  validateEntityCollection(config.school, "config.school");

  return config;
}
