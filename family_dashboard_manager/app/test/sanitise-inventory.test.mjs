import test from "node:test";
import assert from "node:assert/strict";
import { sanitiseInventory } from "../src/sanitise-inventory.mjs";

test("keeps only safe inventory fields and filters sensitive domains", () => {
  const output = sanitiseInventory({
    areas: [{ id: "living_room", name: "Living room", floor_id: "ground" }],
    entities: [
      {
        entity_id: "media_player.living_room",
        name: "Living room",
        area_id: "living_room",
        integration: "music_assistant",
        supported_features: 123,
        state: "playing",
        attributes: { ip_address: "192.168.1.10", mac: "00:11:22:33:44:55" },
        token: "do-not-copy"
      },
      { entity_id: "camera.front_door", name: "Front door", access_token: "secret" },
      { entity_id: "device_tracker.phone", name: "Phone", latitude: 1, longitude: 2 }
    ]
  });

  assert.deepEqual(output.areas, [{ id: "living_room", name: "Living room" }]);
  assert.equal(output.entities.length, 1);
  assert.deepEqual(output.entities[0], {
    entity_id: "media_player.living_room",
    name: "Living room",
    area_id: "living_room",
    integration: "music_assistant",
    supported_features: 123,
    domain: "media_player"
  });
  assert.doesNotMatch(JSON.stringify(output), /192\.168|00:11|secret|playing/);
});

test("sorts inventory without depending on ICU locale data", () => {
  const originalLocaleCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = () => { throw new Error("Internal error. Icu error."); };
  try {
    const output = sanitiseInventory({
      areas: [
        { id: "living_room", name: "Living room" },
        { id: "kitchen", name: "Kitchen" }
      ],
      entities: [
        { entity_id: "media_player.living_room" },
        { entity_id: "light.kitchen" }
      ]
    });

    assert.deepEqual(output.areas.map((area) => area.id), ["kitchen", "living_room"]);
    assert.deepEqual(output.entities.map((entity) => entity.entity_id), [
      "light.kitchen",
      "media_player.living_room"
    ]);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
});
