export function adminRoomOptions(config, current) {
  const floors = new Map((config?.floorplan?.floors || []).map((floor) => [floor.id, floor.name]));
  const defaultFloor = config?.floorplan?.default_floor;
  const options = (config?.rooms || [])
    .filter((room) => room?.id && (!defaultFloor || room.floor_id === defaultFloor))
    .map((room) => {
      const floor = floors.get(room.floor_id);
      const name = room.name || room.id;
      return [room.id, floor ? `${name} · ${floor}` : name];
    });

  if (current && !options.some(([value]) => value === current)) {
    options.unshift([current, `${current} (currently configured)`]);
  }

  return options;
}

const HEATING_ENTITY_MATCHERS = new Map([
  ["rooms.temperature_sensor", (entity) => entity.device_class === "temperature"],
  ["rooms.heating_schedule.entity_id", (entity) => /schedule/i.test(`${entity.entity_id} ${entity.name || ""} ${entity.original_name || ""}`)],
  ["rooms.heating_schedule.mode_entity", (entity) => /auto schedule/i.test(`${entity.entity_id} ${entity.name || ""} ${entity.original_name || ""}`)],
  ["rooms.heating_schedule.refresh_entity", (entity) => /refresh schedule/i.test(`${entity.entity_id} ${entity.name || ""} ${entity.original_name || ""}`)]
]);

function structuralPath(path) {
  return path.filter((entry) => typeof entry !== "number").join(".");
}

function roomForPath(config, path) {
  return path[0] === "rooms" && Number.isInteger(path[1])
    ? config?.rooms?.[path[1]]
    : null;
}

function entityLabel(entity, areaNames) {
  const name = entity.name || entity.original_name || entity.entity_id;
  const area = entity.area_id ? areaNames.get(entity.area_id) : null;
  return `${name}${area ? ` · ${area}` : ""} · ${entity.entity_id}`;
}

export function adminEntityOptions({ inventory, config, path, domain, current }) {
  const allDomainEntities = (inventory?.entities || []).filter((entity) => entity.domain === domain);
  if (!allDomainEntities.length) return null;

  const matcher = HEATING_ENTITY_MATCHERS.get(structuralPath(path));
  const enabledEntities = allDomainEntities.filter((entity) => !entity.disabled_by && !entity.hidden_by);
  const entities = matcher ? enabledEntities.filter(matcher) : enabledEntities;
  const room = roomForPath(config, path);
  const areaNames = new Map((inventory?.areas || []).map((area) => [area.id, area.name]));
  const options = entities
    .map((entity) => [entity.entity_id, entityLabel(entity, areaNames), entity.area_id === room?.area_id ? 0 : 1])
    .sort((a, b) => a[2] - b[2] || a[1].localeCompare(b[1]))
    .map(([value, text]) => [value, text]);

  if (current && !options.some(([value]) => value === current)) {
    options.unshift([current, `${current} (currently configured)`]);
  }

  return [["", "Not configured"], ...options];
}
