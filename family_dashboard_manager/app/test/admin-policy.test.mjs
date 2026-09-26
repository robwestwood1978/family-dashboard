import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildAdminBootstrap,
  deployAdminCandidate,
  previewAdminCandidate,
  protectedSectionsForChanges
} from "../src/admin-policy.mjs";
import { canonicalJson, sha256 } from "../src/manager-store.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));

function fakeStore(config = structuredClone(example)) {
  const activeHash = sha256(canonicalJson(config));
  const deployments = [];
  return {
    activeHash,
    deployments,
    async readHouseholdConfig() { return structuredClone(config); },
    async getStatus() {
      return {
        active_config_hash: activeHash,
        private_assets: { "ground-floor.svg": { installed: false }, "first-floor.svg": { installed: false } },
        snapshots: []
      };
    },
    validate(candidate) {
      return {
        config: structuredClone(candidate),
        config_hash: sha256(canonicalJson(candidate)),
        dashboard_hash: "d".repeat(64),
        enabled_views: ["today", "calendar"]
      };
    },
    async deploy(candidate, options) {
      deployments.push({ candidate, options });
      return { resulting_config_hash: options.expectedConfigHash, rollback_snapshot: "snapshot" };
    }
  };
}

test("Admin bootstrap exposes household settings and sanitised inventory without secrets", async () => {
  const store = fakeStore();
  const bootstrap = await buildAdminBootstrap({
    store,
    inventory: async () => ({ schema_version: 1, areas: [], entities: [] }),
    user: { id: "admin", name: "Household owner" }
  });
  assert.equal(bootstrap.config.product.name, example.product.name);
  assert.equal(bootstrap.schema.properties.entry["x-protected"], true);
  assert.equal(bootstrap.schema.properties.display.properties.panel_path.readOnly, true);
  assert.equal(bootstrap.user.name, "Household owner");
  assert.doesNotMatch(JSON.stringify(bootstrap), /access_token|refresh_token|client_secret/i);
});

test("Admin previews exact leaf changes and requires protected acknowledgement", async () => {
  const store = fakeStore();
  const candidate = structuredClone(example);
  candidate.people[0].name = "Different name";
  candidate.entry.alarm_entity = "alarm_control_panel.family_house";
  const preview = await previewAdminCandidate({ store, candidate, expectedActiveHash: store.activeHash });
  assert.equal(preview.change_count, 2);
  assert.deepEqual(preview.protected_sections, ["entry"]);
  assert.equal(preview.requires_protected_acknowledgement, true);
  await assert.rejects(() => deployAdminCandidate({
    store,
    candidate,
    expectedActiveHash: store.activeHash,
    expectedConfigHash: preview.config_hash,
    confirm: true,
    acknowledgeProtected: false
  }), /explicit acknowledgement/);
  const result = await deployAdminCandidate({
    store,
    candidate,
    expectedActiveHash: store.activeHash,
    expectedConfigHash: preview.config_hash,
    confirm: true,
    acknowledgeProtected: true
  });
  assert.equal(result.rollback_snapshot, "snapshot");
  assert.equal(store.deployments.length, 1);
});

test("Admin rejects stale sessions and managed dashboard identity changes", async () => {
  const store = fakeStore();
  await assert.rejects(() => previewAdminCandidate({
    store,
    candidate: structuredClone(example),
    expectedActiveHash: "0".repeat(64)
  }), /changed; reload Admin/);
  const candidate = structuredClone(example);
  candidate.display.panel_path = "different-dashboard";
  await assert.rejects(() => previewAdminCandidate({
    store,
    candidate,
    expectedActiveHash: store.activeHash
  }), /managed and cannot be changed/);
  assert.deepEqual(protectedSectionsForChanges([{ path: "floorplan.floors[0].id" }, { path: "people[0].name" }]), ["floorplan"]);
});
