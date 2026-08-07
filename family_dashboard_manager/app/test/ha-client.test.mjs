import test from "node:test";
import assert from "node:assert/strict";
import { mergeInventory } from "../src/ha-client.mjs";
import { sanitiseInventory } from "../src/sanitise-inventory.mjs";

test("maps entity and device areas before applying the privacy filter", () => {
  const merged = mergeInventory({
    areas: [{ area_id: "living_room", name: "Living room" }],
    devices: [{ id: "device-1", area_id: "living_room", ip_address: "192.168.1.50" }],
    entities: [
      {
        entity_id: "media_player.living_room",
        device_id: "device-1",
        original_name: "Speaker",
        platform: "music_assistant"
      },
      { entity_id: "camera.front_door", device_id: "device-2", platform: "camera" }
    ],
    states: [
      {
        entity_id: "media_player.living_room",
        state: "playing",
        attributes: {
          friendly_name: "Living room",
          supported_features: 123,
          media_title: "Private listening history"
        }
      }
    ]
  });
  const output = sanitiseInventory(merged);
  assert.deepEqual(output.areas, [{ id: "living_room", name: "Living room" }]);
  assert.equal(output.entities.length, 1);
  assert.deepEqual(output.entities[0], {
    entity_id: "media_player.living_room",
    name: "Living room",
    original_name: "Speaker",
    area_id: "living_room",
    integration: "music_assistant",
    platform: "music_assistant",
    supported_features: 123,
    domain: "media_player"
  });
  assert.doesNotMatch(JSON.stringify(output), /192\.168|playing|Private listening history|front_door/);
});
