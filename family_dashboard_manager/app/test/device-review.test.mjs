import test from "node:test";
import assert from "node:assert/strict";
import { deviceReview, stageDevice, stageDisabledRemoval } from "../admin/device-review.mjs";
import { mergeInventory } from "../src/ha-client.mjs";
import { sanitiseInventory } from "../src/sanitise-inventory.mjs";

const config = { rooms: [{ id: "stairs", name: "Upstairs Hall", area_id: "stairs", covers: ["cover.old"], lights: [], climate: "climate.current" }], entry: { garage: { cover_entity: "cover.garage" } }, media: { primary_entity: "media_player.used" } };
const inventory = { areas: [{ id: "stairs", name: "Stairs" }], entities: [
  { entity_id: "cover.stairs", area_id: "stairs", device_class: "shade" },
  { entity_id: "cover.old", disabled_by: "user", device_class: "shade" },
  { entity_id: "cover.garage", device_class: "garage" },
  { entity_id: "cover.door", device_class: "door" },
  { entity_id: "camera.private" },
  { entity_id: "alarm_control_panel.house" },
  { entity_id: "light.hidden", hidden_by: "user" },
  { entity_id: "light.disabled", disabled_by: "integration" },
  { entity_id: "sensor.diagnostic", device_class: "temperature", entity_category: "diagnostic" },
  { entity_id: "sensor.temperature", device_class: "temperature" },
  { entity_id: "sensor.unrelated" },
  { entity_id: "climate.current" },
  { entity_id: "climate.new", area_id: "stairs" },
  { entity_id: "media_player.used" },
  { entity_id: "vacuum.new" }
] };

test("discovers supported unmapped room controls while excluding protected and disabled entries", () => {
  const review = deviceReview(inventory, config);
  assert.deepEqual(review.newDevices.map((entry) => entry.entity_id), ["cover.stairs", "sensor.temperature", "climate.new", "vacuum.new"]);
  assert.equal(review.newDevices[0].room_id, "stairs");
  assert.equal(review.newDevices[0].area_name, "Stairs");
  assert.equal(review.newDevices.at(-1).field, null);
  assert.deepEqual(review.disabledMappings, [{ entity_id: "cover.old", room_id: "stairs", room_name: "Upstairs Hall", field: "covers" }]);
});

test("additions are immutable drafts; duplicate, protected and occupied mappings cannot be staged", () => {
  const next = stageDevice(config, inventory, "cover.stairs", "stairs");
  assert.deepEqual(config.rooms[0].covers, ["cover.old"]);
  assert.deepEqual(next.rooms[0].covers, ["cover.old", "cover.stairs"]);
  assert.deepEqual(next.entry, config.entry);
  assert.throws(() => stageDevice(next, inventory, "cover.stairs", "stairs"));
  assert.throws(() => stageDevice(config, inventory, "cover.garage", "stairs"));
  assert.throws(() => stageDevice(config, inventory, "light.disabled", "stairs"));
  assert.throws(() => stageDevice(config, inventory, "climate.new", "stairs"), /already has heating/);
  assert.throws(() => stageDevice(config, inventory, "cover.stairs", "missing"), /Choose/);
});

test("only confirmed disabled mappings can be removed; outages and inventory omissions preserve mappings", () => {
  const next = stageDisabledRemoval(config, inventory, "cover.old", "stairs", "covers");
  assert.deepEqual(next.rooms[0].covers, []);
  assert.deepEqual(config.rooms[0].covers, ["cover.old"]);
  const enabledInventory = { ...inventory, entities: inventory.entities.map((entity) => ({ ...entity, disabled_by: null })) };
  assert.deepEqual(deviceReview(enabledInventory, config).disabledMappings, []);
  assert.throws(() => stageDisabledRemoval(config, enabledInventory, "cover.old", "stairs", "covers"));
  assert.throws(() => stageDisabledRemoval(config, { entities: [] }, "cover.old", "stairs", "covers"));
});

test("missing and ambiguous areas require explicit room choice", () => {
  const duplicateAreas = { ...config, rooms: [...config.rooms, { id: "other", area_id: "stairs" }] };
  assert.equal(deviceReview(inventory, duplicateAreas).newDevices[0].room_id, "");
  assert.equal(deviceReview(inventory, config).newDevices[1].room_id, "");
});

test("safe inventory retains registry status and inherited device disablement without state or private device IDs", () => {
  const safe = sanitiseInventory(mergeInventory({
    devices: [{ id: "private-device-id", area_id: "stairs", disabled_by: "user" }],
    entities: [{ entity_id: "cover.stairs", device_id: "private-device-id", hidden_by: "integration", entity_category: "config" }],
    states: [{ entity_id: "cover.stairs", state: "unavailable", attributes: { current_position: 20, device_class: "shade" } }]
  }));
  assert.equal(safe.entities[0].disabled_by, "user");
  assert.equal(safe.entities[0].hidden_by, "integration");
  assert.equal(safe.entities[0].entity_category, "config");
  assert.doesNotMatch(JSON.stringify(safe), /private-device-id|unavailable|current_position/);
});
