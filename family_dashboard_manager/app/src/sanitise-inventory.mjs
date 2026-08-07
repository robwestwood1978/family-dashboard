import { compareText } from "./compare-text.mjs";

const BLOCKED_DOMAINS = new Set(["camera", "device_tracker", "geo_location", "image", "person", "zone"]);
const SAFE_ENTITY_FIELDS = [
  "entity_id",
  "name",
  "original_name",
  "area_id",
  "device_class",
  "integration",
  "platform",
  "supported_features"
];

function cleanString(value, maxLength = 160) {
  return typeof value === "string" ? value.slice(0, maxLength) : undefined;
}

export function sanitiseInventory(input) {
  const areas = Array.isArray(input?.areas) ? input.areas : [];
  const entities = Array.isArray(input?.entities) ? input.entities : [];

  const safeAreas = areas
    .map((area) => ({ id: cleanString(area?.id, 80), name: cleanString(area?.name, 80) }))
    .filter((area) => area.id && area.name)
    .sort((a, b) => compareText(a.name, b.name));

  const safeEntities = entities
    .filter((entity) => typeof entity?.entity_id === "string")
    .filter((entity) => !BLOCKED_DOMAINS.has(entity.entity_id.split(".", 1)[0]))
    .map((entity) => {
      const safe = {};
      for (const field of SAFE_ENTITY_FIELDS) {
        const value = entity[field];
        if (typeof value === "string") safe[field] = cleanString(value);
        if (field === "supported_features" && Number.isInteger(value)) safe[field] = value;
      }
      safe.domain = safe.entity_id.split(".", 1)[0];
      return safe;
    })
    .sort((a, b) => compareText(a.entity_id, b.entity_id));

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    areas: safeAreas,
    entities: safeEntities
  };
}
