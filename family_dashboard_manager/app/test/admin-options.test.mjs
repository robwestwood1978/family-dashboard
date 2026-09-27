import test from "node:test";
import assert from "node:assert/strict";
import { adminRoomOptions } from "../admin/admin-options.mjs";

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
