import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { DashboardStore, sha256 } from "../src/manager-store.mjs";
import example from "../config/example.json" with { type: "json" };

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-manager-"));
  let tick = 0;
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    resourceDir: join(root, "www", "family-dashboard"),
    clock: () => new Date(Date.UTC(2026, 7, 7, 12, 0, tick++))
  });
  return { root, store };
}

test("validates without writing live files", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const prepared = store.validate(structuredClone(example));
  assert.match(prepared.config_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(prepared.enabled_views, ["today", "calendar", "rooms", "family", "entry", "music", "football"]);
  assert.equal(prepared.resource_url, "/local/family-dashboard/family-hub-card.js?v=0.7.3");
  assert.equal((await store.getStatus()).installed, false);
  assert.equal((await store.getStatus()).read_only_required, false);
});

test("optional manager safety mode rejects every configuration that is not read-only", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-read-only-manager-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    resourceDir: join(root, "www", "family-dashboard"),
    publicResourceBase: "/local/family-dashboard",
    requireReadOnly: true
  });
  assert.throws(() => store.validate(structuredClone(example)), /requires config\.display\.read_only/);
  const candidate = structuredClone(example);
  candidate.display.read_only = true;
  assert.match(store.validate(candidate).config_hash, /^[a-f0-9]{64}$/);
  assert.equal((await store.getStatus()).read_only_required, true);
});

test("validates and deploys only the two inert private floorplan SVGs", async (context) => {
  const { root } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    resourceDir: join(root, "www", "family-dashboard"),
    publicResourceBase: "/local/family-dashboard"
  });
  const assets = [
    { filename: "ground-floor.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>' },
    { filename: "first-floor.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="data:image/png;base64,aGVsbG8=" width="10" height="10"/></svg>' }
  ];
  const validation = store.validateFloorplanAssets(assets);
  assert.match(validation.asset_set_hash, /^[a-f0-9]{64}$/);
  assert.equal(validation.assets[0].url, "/local/family-dashboard/private/ground-floor.svg");
  await assert.rejects(
    store.deployFloorplanAssets(assets, { expectedAssetSetHash: validation.asset_set_hash, confirm: false }),
    /confirm must be true/
  );
  const deployment = await store.deployFloorplanAssets(assets, {
    expectedAssetSetHash: validation.asset_set_hash,
    confirm: true
  });
  assert.equal(deployment.assets.length, 2);
  assert.match(await readFile(join(root, "www", "family-dashboard", "private", "ground-floor.svg"), "utf8"), /^<svg/);
  assert.equal((await store.getStatus()).private_assets["first-floor.svg"].installed, true);
});

test("rejects active, external and unapproved floorplan content", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const safe = { filename: "first-floor.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h1v1z"/></svg>' };
  assert.throws(() => store.validateFloorplanAssets([
    { filename: "ground-floor.svg", content: '<svg viewBox="0 0 10 10"><script>alert(1)</script></svg>' },
    safe
  ]), /active or unsupported/);
  assert.throws(() => store.validateFloorplanAssets([
    { filename: "ground-floor.svg", content: '<svg viewBox="0 0 10 10"><image href="https://example.com/plan.png"/></svg>' },
    safe
  ]), /external SVG reference/);
  assert.throws(() => store.validateFloorplanAssets([
    { filename: "upstairs.svg", content: safe.content },
    safe
  ]), /filename is not allowed/);
});

test("refuses a private floorplan config until its referenced floorplans exist", async (context) => {
  const { root } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    resourceDir: join(root, "www", "family-dashboard"),
    publicResourceBase: "/local/family-dashboard"
  });
  const candidate = structuredClone(example);
  candidate.display.read_only = true;
  candidate.display.panel_path = "family-dashboard";
  candidate.floorplan.floors[0].base_image = "/local/family-dashboard/private/ground-floor.svg";
  candidate.floorplan.floors[1].base_image = "/local/family-dashboard/private/first-floor.svg";
  const prepared = store.validate(candidate);
  await assert.rejects(
    store.deploy(candidate, { expectedConfigHash: prepared.config_hash, confirm: true }),
    /private floorplan asset is not installed/
  );
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

test("deploys the card atomically, preserves private assets, snapshots and rolls back", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const privateAsset = join(root, "www", "family-dashboard", "assets", "private-house.svg");
  await mkdir(join(root, "www", "family-dashboard", "assets"), { recursive: true });
  await writeFile(privateAsset, "private floorplan", "utf8");

  const first = structuredClone(example);
  const firstPrepared = store.validate(first);
  const firstDeployment = await store.deploy(first, {
    expectedConfigHash: firstPrepared.config_hash,
    confirm: true
  });
  assert.equal(firstDeployment.previous_config_hash, null);
  const firstStatus = await store.getStatus();
  assert.equal(firstStatus.active_config_hash, firstPrepared.config_hash);
  assert.equal(firstStatus.resource_installed, true);
  assert.match(firstStatus.active_resource_hash, /^[a-f0-9]{64}$/);
  assert.match(await readFile(join(root, "www", "family-dashboard", "family-hub-card.js"), "utf8"), /class FamilyHubCard/);
  assert.equal(await readFile(privateAsset, "utf8"), "private floorplan");

  const second = structuredClone(example);
  second.product.title = "Updated Family Dashboard";
  const secondPrepared = store.validate(second);
  const secondDeployment = await store.deploy(second, {
    expectedConfigHash: secondPrepared.config_hash,
    confirm: true
  });
  assert.match(secondDeployment.rollback_snapshot, /^20260807T120001Z-[a-f0-9]{12}$/);
  assert.equal((await store.getStatus()).active_config_hash, secondPrepared.config_hash);

  await writeFile(join(root, "www", "family-dashboard", "family-hub-card.js"), "test corruption", "utf8");
  const rollback = await store.rollback({
    snapshotId: secondDeployment.rollback_snapshot,
    expectedActiveHash: secondPrepared.config_hash,
    confirm: true
  });
  assert.equal(rollback.resulting_config_hash, firstPrepared.config_hash);
  const active = JSON.parse(await readFile(join(root, "config", "household.json"), "utf8"));
  assert.equal(active.product.title, "Family Dashboard");
  assert.match(await readFile(join(root, "www", "family-dashboard", "family-hub-card.js"), "utf8"), /class FamilyHubCard/);
  assert.equal(await readFile(privateAsset, "utf8"), "private floorplan");
});

test("restores a raw schema-v3 snapshot without trying to validate it as v6", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await store.initialise();
  const oldConfig = '{"schema_version":3,"product":{"title":"Previous release"}}\n';
  const oldDashboard = "title: Previous release\nviews: []\n";
  await writeFile(join(root, "config", "household.json"), oldConfig, "utf8");
  await writeFile(join(root, "config", "dashboard.yaml"), oldDashboard, "utf8");

  const prepared = store.validate(structuredClone(example));
  const deployment = await store.deploy(example, { expectedConfigHash: prepared.config_hash, confirm: true });
  assert.ok(deployment.rollback_snapshot);
  const rollback = await store.rollback({
    snapshotId: deployment.rollback_snapshot,
    expectedActiveHash: prepared.config_hash,
    confirm: true
  });
  assert.equal(rollback.resulting_config_hash, sha256(oldConfig));
  assert.equal(await readFile(join(root, "config", "household.json"), "utf8"), oldConfig);
  assert.equal(await readFile(join(root, "config", "dashboard.yaml"), "utf8"), oldDashboard);
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
