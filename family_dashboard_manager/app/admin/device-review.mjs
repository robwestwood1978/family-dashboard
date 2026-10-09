// Discovery prepares draft mappings only. The existing review/save flow owns deployment.
const ARRAY_FIELDS = { light: "lights", cover: "covers", scene: "scenes", media_player: "media_players" };
const SINGLE_FIELDS = { climate: "climate", sensor: "temperature_sensor" };
const TYPES = { light: "Light", cover: "Blind", scene: "Scene", media_player: "Speaker / player", climate: "Heating", sensor: "Temperature", vacuum: "Vacuum" };

function mappedEntities(value, output = new Set()) {
  if (typeof value === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(value)) output.add(value);
  else if (Array.isArray(value)) value.forEach((entry) => mappedEntities(entry, output));
  else if (value && typeof value === "object") Object.values(value).forEach((entry) => mappedEntities(entry, output));
  return output;
}

function supported(entity) {
  const domain = entity.entity_id?.split(".")[0];
  if (!Object.hasOwn(TYPES, domain)) return false;
  if (domain === "cover" && !["blind", "shade", "curtain", "shutter"].includes(entity.device_class)) return false;
  if (domain === "sensor" && entity.device_class !== "temperature") return false;
  return !entity.disabled_by && !entity.hidden_by && !entity.entity_category;
}

export function deviceReview(inventory, config) {
  const mapped = mappedEntities(config);
  const entities = inventory?.entities || [];
  const areas = new Map((inventory?.areas || []).map((area) => [area.id, area.name]));
  const newDevices = entities.filter((entity) => supported(entity) && !mapped.has(entity.entity_id)).map((entity) => {
    const domain = entity.entity_id.split(".")[0];
    const rooms = (config.rooms || []).filter((room) => entity.area_id && room.area_id === entity.area_id);
    return {
      ...entity, domain, type: TYPES[domain], name: entity.name || entity.original_name || entity.entity_id,
      area_name: areas.get(entity.area_id) || "No area assigned",
      room_id: rooms.length === 1 ? rooms[0].id : "",
      field: ARRAY_FIELDS[domain] || SINGLE_FIELDS[domain] || null,
      section: domain === "vacuum" ? "cleaning" : "rooms"
    };
  });
  const disabledMappings = [];
  const disabled = new Set(entities.filter((entity) => entity.disabled_by).map((entity) => entity.entity_id));
  for (const room of config.rooms || []) {
    for (const field of [...Object.values(ARRAY_FIELDS), ...Object.values(SINGLE_FIELDS)]) {
      const values = Array.isArray(room[field]) ? room[field] : room[field] ? [room[field]] : [];
      for (const entityId of values) if (disabled.has(entityId)) disabledMappings.push({ entity_id: entityId, room_id: room.id, room_name: room.name, field });
    }
  }
  return { newDevices, disabledMappings };
}

export function stageDevice(config, inventory, entityId, roomId) {
  const device = deviceReview(inventory, config).newDevices.find((entry) => entry.entity_id === entityId);
  if (!device?.field) throw new Error("This device needs setup in its dedicated section.");
  const candidate = structuredClone(config);
  const room = candidate.rooms.find((entry) => entry.id === roomId);
  if (!room) throw new Error("Choose a dashboard room first.");
  if (Object.hasOwn(ARRAY_FIELDS, device.domain)) {
    room[device.field] = [...(room[device.field] || []), entityId];
  } else {
    if (room[device.field]) throw new Error(`This room already has ${device.type.toLowerCase()} configured. Review its mapping in Rooms & devices.`);
    room[device.field] = entityId;
  }
  return candidate;
}

export function stageDisabledRemoval(config, inventory, entityId, roomId, field) {
  if (!deviceReview(inventory, config).disabledMappings.some((entry) => entry.entity_id === entityId && entry.room_id === roomId && entry.field === field)) {
    throw new Error("This mapping is no longer confirmed disabled. Refresh the device list.");
  }
  const candidate = structuredClone(config);
  const room = candidate.rooms.find((entry) => entry.id === roomId);
  if (Array.isArray(room[field])) room[field] = room[field].filter((entry) => entry !== entityId);
  else delete room[field];
  return candidate;
}
