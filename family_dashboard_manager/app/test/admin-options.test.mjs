import test from "node:test";
import assert from "node:assert/strict";
import { adminEntityOptions, adminRoomOptions } from "../admin/admin-options.mjs";

test("builds Home default-room choices from configured household rooms", () => {
  const options = adminRoomOptions({
    floorplan: {
      default_floor: "ground",
      floors: [
        { id: "ground", name: "Ground floor" },
        { id: "first", name: "First floor" }
      ]
    },
    rooms: [
      { id: "living_room", name: "Living room", floor_id: "ground" },
      { id: "bedroom_1", name: "Bedroom 1", floor_id: "first" }
    ]
  }, "living_room");

  assert.deepEqual(options, [
    ["living_room", "Living room · Ground floor"]
  ]);
});

test("keeps a stale current room visible until the household selects a valid room", () => {
  assert.deepEqual(adminRoomOptions({ rooms: [] }, "old_room"), [
    ["old_room", "old_room (currently configured)"]
  ]);
});

const inventory = {
  areas: [
    { id: "snug", name: "Snug" },
    { id: "utility", name: "Utility" }
  ],
  entities: [
    { entity_id: "sensor.app_armor_version", name: "AppArmor version", domain: "sensor" },
    { entity_id: "sensor.snug_room_temperature", name: "Room temperature", area_id: "snug", device_class: "temperature", domain: "sensor" },
    { entity_id: "select.daddy_choreops_helper", name: "Daddy ChoreOps helper", domain: "select" },
    { entity_id: "select.snug_auto_schedule", name: "Snug Auto schedule", area_id: "snug", domain: "select" },
    { entity_id: "button.blinds_identify", name: "Blinds Identify", domain: "button" },
    { entity_id: "button.snug_refresh_schedule", name: "Snug Refresh schedule", area_id: "snug", domain: "button" },
    { entity_id: "text.snug_schedule", name: "Snug Schedule", area_id: "snug", domain: "text" }
  ]
};

const config = { rooms: [{ id: "snug", area_id: "snug" }] };

test("shows an explicit unconfigured choice instead of selecting an unrelated sensor", () => {
  assert.deepEqual(adminEntityOptions({
    inventory,
    config,
    path: ["rooms", 0, "temperature_sensor"],
    domain: "sensor",
    current: undefined
  }), [
    ["", "Not configured"],
    ["sensor.snug_room_temperature", "Room temperature · Snug · sensor.snug_room_temperature"]
  ]);
});

test("limits heating schedule helpers to the matching semantic entity types", () => {
  assert.deepEqual(adminEntityOptions({
    inventory,
    config,
    path: ["rooms", 0, "heating_schedule", "mode_entity"],
    domain: "select",
    current: undefined
  }), [
    ["", "Not configured"],
    ["select.snug_auto_schedule", "Snug Auto schedule · Snug · select.snug_auto_schedule"]
  ]);

  assert.deepEqual(adminEntityOptions({
    inventory,
    config,
    path: ["rooms", 0, "heating_schedule", "refresh_entity"],
    domain: "button",
    current: undefined
  }), [
    ["", "Not configured"],
    ["button.snug_refresh_schedule", "Snug Refresh schedule · Snug · button.snug_refresh_schedule"]
  ]);
});

test("keeps the configured entity visible when it is no longer in inventory", () => {
  assert.deepEqual(adminEntityOptions({
    inventory,
    config,
    path: ["rooms", 0, "heating_schedule", "entity_id"],
    domain: "text",
    current: "text.old_schedule"
  }), [
    ["", "Not configured"],
    ["text.old_schedule", "text.old_schedule (currently configured)"],
    ["text.snug_schedule", "Snug Schedule · Snug · text.snug_schedule"]
  ]);
});
