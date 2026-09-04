import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { ClassroomIntegrationStore, MANAGED_FILES } from "../src/classroom-integration-store.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-classroom-"));
  let tick = 0;
  const targetDir = join(root, "config", "custom_components", "family_dashboard_classroom");
  await mkdir(join(root, "config", "custom_components"), { recursive: true });
  const store = new ClassroomIntegrationStore({
    targetDir,
    dataDir: join(root, "data"),
    clock: () => new Date(Date.UTC(2026, 8, 4, 12, 0, tick++))
  });
  return { root, store, targetDir };
}

test("installs only the fixed hash-guarded Classroom file set", async (context) => {
  const { root, store, targetDir } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const before = await store.getStatus();
  assert.equal(before.installed_state, "not_installed");
  assert.match(before.bundled_set_hash, /^[a-f0-9]{64}$/);
  assert.deepEqual(before.bundled_files.map((file) => file.path), MANAGED_FILES);

  await assert.rejects(
    store.install({
      expectedBundleHash: before.bundled_set_hash,
      expectedActiveHash: null,
      confirm: false
    }),
    /confirm must be true/
  );
  await assert.rejects(
    store.install({ expectedBundleHash: "0".repeat(64), expectedActiveHash: null, confirm: true }),
    /expected_bundle_hash/
  );

  const installed = await store.install({
    expectedBundleHash: before.bundled_set_hash,
    expectedActiveHash: null,
    confirm: true
  });
  assert.equal(installed.resulting_set_hash, before.bundled_set_hash);
  assert.equal(installed.oauth_authorizations_created, 0);
  assert.equal(installed.home_assistant_restart_required, true);
  assert.match(installed.rollback_snapshot, /^20260904T120000Z-[a-f0-9]{12}$/);
  assert.match(await readFile(join(targetDir, "manifest.json"), "utf8"), /family_dashboard_classroom/);
  assert.equal((await store.getStatus()).active_set_hash, before.bundled_set_hash);
});

test("rolls a first install back to absence without touching OAuth storage", async (context) => {
  const { root, store, targetDir } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const before = await store.getStatus();
  const installed = await store.install({
    expectedBundleHash: before.bundled_set_hash,
    expectedActiveHash: null,
    confirm: true
  });

  const rolledBack = await store.rollback({
    snapshotId: installed.rollback_snapshot,
    expectedActiveHash: installed.resulting_set_hash,
    confirm: true
  });

  assert.equal(rolledBack.resulting_set_hash, null);
  assert.equal(rolledBack.oauth_authorizations_changed, false);
  assert.equal((await store.getStatus()).installed_state, "not_installed");
  await assert.rejects(readFile(join(targetDir, "manifest.json"), "utf8"), /ENOENT/);
});

test("snapshots and restores a complete prior managed version", async (context) => {
  const { root, store, targetDir } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const initial = await store.getStatus();
  await store.install({
    expectedBundleHash: initial.bundled_set_hash,
    expectedActiveHash: null,
    confirm: true
  });
  const providerPath = join(targetDir, "provider.py");
  const oldProvider = `${await readFile(providerPath, "utf8")}\n# previous managed build\n`;
  await writeFile(providerPath, oldProvider, "utf8");
  const previous = await store.getStatus();
  assert.notEqual(previous.active_set_hash, initial.bundled_set_hash);

  const upgraded = await store.install({
    expectedBundleHash: initial.bundled_set_hash,
    expectedActiveHash: previous.active_set_hash,
    confirm: true
  });
  assert.equal(upgraded.resulting_set_hash, initial.bundled_set_hash);

  const restored = await store.rollback({
    snapshotId: upgraded.rollback_snapshot,
    expectedActiveHash: upgraded.resulting_set_hash,
    confirm: true
  });
  assert.equal(restored.resulting_set_hash, previous.active_set_hash);
  assert.equal(await readFile(providerPath, "utf8"), oldProvider);
});

test("fails closed for unmanaged files, symlinks and stale active hashes", async (context) => {
  const { root, store, targetDir } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const before = await store.getStatus();
  const installed = await store.install({
    expectedBundleHash: before.bundled_set_hash,
    expectedActiveHash: null,
    confirm: true
  });
  await assert.rejects(
    store.install({
      expectedBundleHash: before.bundled_set_hash,
      expectedActiveHash: "0".repeat(64),
      confirm: true
    }),
    /expected_active_hash/
  );
  await writeFile(join(targetDir, "unmanaged.py"), "unsafe", "utf8");
  const unmanaged = await store.getStatus();
  assert.equal(unmanaged.installed_state, "unmanaged");
  assert.equal(unmanaged.install_available, false);
  await assert.rejects(
    store.install({
      expectedBundleHash: before.bundled_set_hash,
      expectedActiveHash: installed.resulting_set_hash,
      confirm: true
    }),
    /unmanaged path/
  );

  await unlink(join(targetDir, "unmanaged.py"));
  const providerPath = join(targetDir, "provider.py");
  await unlink(providerPath);
  await symlink(join(targetDir, "const.py"), providerPath);
  assert.equal((await store.getStatus()).installed_state, "unmanaged");
});

test("requires the fixed custom_components parent directory", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  await rm(join(root, "config", "custom_components"), { recursive: true, force: true });
  const status = await store.getStatus();
  assert.equal(status.install_available, false);
  await assert.rejects(
    store.install({
      expectedBundleHash: status.bundled_set_hash,
      expectedActiveHash: null,
      confirm: true
    }),
    /must already exist as a regular directory/
  );
  assert.equal((await store.getStatus()).snapshots.length, 0);
});

test("rejects a tampered rollback snapshot", async (context) => {
  const { root, store } = await fixture();
  context.after(() => rm(root, { recursive: true, force: true }));
  const before = await store.getStatus();
  const installed = await store.install({
    expectedBundleHash: before.bundled_set_hash,
    expectedActiveHash: null,
    confirm: true
  });
  const safety = await store.install({
    expectedBundleHash: before.bundled_set_hash,
    expectedActiveHash: installed.resulting_set_hash,
    confirm: true
  });
  await writeFile(
    join(root, "data", "classroom-integration-snapshots", safety.rollback_snapshot, "integration", "provider.py"),
    "tampered",
    "utf8"
  );

  await assert.rejects(
    store.rollback({
      snapshotId: safety.rollback_snapshot,
      expectedActiveHash: safety.resulting_set_hash,
      confirm: true
    }),
    /managed file is missing|integrity check|too large/
  );
});
