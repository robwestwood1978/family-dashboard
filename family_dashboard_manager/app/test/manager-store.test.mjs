import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DashboardStore } from "../src/manager-store.mjs";
import example from "../config/example.json" with { type: "json" };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-manager-"));
  let tick = 0;
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    clock: () => new Date(Date.UTC(2026, 7, 7, 12, 0, tick++))
  });
  return { root, store };
}

test("validates without writing live files", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const prepared = store.validate(structuredClone(example));
  assert.match(prepared.config_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(prepared.enabled_views, ["today", "calendar", "home", "music", "chores", "football"]);
  assert.equal((await store.getStatus()).installed, false);
});

test("requires explicit confirmation and the validated hash", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const prepared = store.validate(structuredClone(example));
  await assert.rejects(
    store.deploy(example, { expectedConfigHash: prepared.config_hash, confirm: false }),
    /confirm must be true/
  );
  await assert.rejects(
    store.deploy(example, { expectedConfigHash: "0".repeat(64), confirm: true }),
    /does not match/
  );
});

test("deploys atomically, snapshots and rolls back", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  const first = structuredClone(example);
  const firstPrepared = store.validate(first);
  const firstDeployment = await store.deploy(first, {
    expectedConfigHash: firstPrepared.config_hash,
    confirm: true
  });
  assert.equal(firstDeployment.previous_config_hash, null);
  assert.equal((await store.getStatus()).active_config_hash, firstPrepared.config_hash);

  const second = structuredClone(example);
  second.product.title = "Updated Family Dashboard";
  const secondPrepared = store.validate(second);
  const secondDeployment = await store.deploy(second, {
    expectedConfigHash: secondPrepared.config_hash,
    confirm: true
  });
  assert.match(secondDeployment.rollback_snapshot, /^20260807T120001Z-[a-f0-9]{12}$/);
  assert.equal((await store.getStatus()).active_config_hash, secondPrepared.config_hash);

  const rollback = await store.rollback({
    snapshotId: secondDeployment.rollback_snapshot,
    expectedActiveHash: secondPrepared.config_hash,
    confirm: true
  });
  assert.equal(rollback.resulting_config_hash, firstPrepared.config_hash);
  const active = JSON.parse(await readFile(join(root, "config", "household.json"), "utf8"));
  assert.equal(active.product.title, "Family Dashboard");
});

test("rejects untrusted snapshot identifiers", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(
    store.rollback({ snapshotId: "../../config", expectedActiveHash: "0".repeat(64), confirm: true }),
    /expected_active_hash|snapshot_id/
  );
});

test("sorts multiple snapshots without depending on ICU locale data", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));

  for (const title of ["First", "Second", "Third"]) {
    const candidate = structuredClone(example);
    candidate.product.title = title;
    const prepared = store.validate(candidate);
    await store.deploy(candidate, {
      expectedConfigHash: prepared.config_hash,
      confirm: true
    });
  }

  const originalLocaleCompare = String.prototype.localeCompare;
  String.prototype.localeCompare = () => { throw new Error("Internal error. Icu error."); };
  try {
    const snapshots = (await store.getStatus()).snapshots;
    assert.equal(snapshots.length, 2);
    assert.ok(snapshots[0].created_at > snapshots[1].created_at);
  } finally {
    String.prototype.localeCompare = originalLocaleCompare;
  }
});
