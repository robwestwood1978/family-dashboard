import { createHash, randomUUID } from "node:crypto";
import {
  lstat,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_BUNDLE_DIR = fileURLToPath(new URL("../integrations/family_dashboard_classroom/", import.meta.url));
const DEFAULT_TARGET_DIR = "/config/custom_components/family_dashboard_classroom";
const MANAGED_FILES = Object.freeze([
  "README.md",
  "__init__.py",
  "application_credentials.py",
  "config_flow.py",
  "const.py",
  "coordinator.py",
  "manifest.json",
  "provider.py",
  "sensor.py",
  "strings.json",
  "translations/en.json"
]);
const MANAGED_SET = new Set(MANAGED_FILES);
const MAX_FILE_BYTES = 256 * 1024;
const SNAPSHOT_PATTERN = /^\d{8}T\d{6}Z-[a-f0-9]{12}$/;

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function pathKind(path) {
  try {
    const metadata = await lstat(path);
    if (metadata.isSymbolicLink()) return "symlink";
    if (metadata.isDirectory()) return "directory";
    if (metadata.isFile()) return "file";
    return "other";
  } catch (error) {
    if (error?.code === "ENOENT") return "missing";
    throw error;
  }
}

async function atomicWrite(path, content, { mode = 0o600 } = {}) {
  await mkdir(dirname(path), { recursive: true, mode: mode === 0o644 ? 0o755 : 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, content, { encoding: "utf8", mode });
  await rename(temporary, path);
}

function fileManifest(files) {
  return MANAGED_FILES.map((path) => ({
    path,
    size_bytes: Buffer.byteLength(files[path], "utf8"),
    sha256: sha256(files[path])
  }));
}

function fileSetHash(files) {
  return sha256(canonicalJson(fileManifest(files)));
}

function safeSnapshotId(value) {
  if (typeof value !== "string" || !SNAPSHOT_PATTERN.test(value)) {
    throw new Error("classroom snapshot_id is invalid");
  }
  return value;
}

async function assertNoUnmanagedEntries(directory) {
  const rootEntries = await readdir(directory, { withFileTypes: true });
  for (const entry of rootEntries) {
    if (entry.name === "__pycache__" && entry.isDirectory()) continue;
    if (entry.name === "translations" && entry.isDirectory()) {
      const translations = await readdir(join(directory, entry.name), { withFileTypes: true });
      for (const translation of translations) {
        const relativePath = `translations/${translation.name}`;
        if (!translation.isFile() || !MANAGED_SET.has(relativePath)) {
          throw new Error("installed Classroom integration contains an unmanaged path");
        }
      }
      continue;
    }
    if (!entry.isFile() || !MANAGED_SET.has(entry.name)) {
      throw new Error("installed Classroom integration contains an unmanaged path");
    }
  }
}

async function readManagedDirectory(directory, { missingAllowed = false } = {}) {
  const kind = await pathKind(directory);
  if (kind === "missing" && missingAllowed) return null;
  if (kind !== "directory") throw new Error("Classroom integration path is not a regular directory");
  await assertNoUnmanagedEntries(directory);
  const files = {};
  for (const relativePath of MANAGED_FILES) {
    const path = join(directory, relativePath);
    if (await pathKind(path) !== "file") {
      throw new Error(`Classroom integration managed file is missing: ${relativePath}`);
    }
    const content = await readFile(path, "utf8");
    if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
      throw new Error(`Classroom integration managed file is too large: ${relativePath}`);
    }
    files[relativePath] = content;
  }
  return files;
}

export class ClassroomIntegrationStore {
  constructor({
    bundleDir = DEFAULT_BUNDLE_DIR,
    targetDir = DEFAULT_TARGET_DIR,
    dataDir = process.env.MANAGER_DATA_DIR || "/data",
    snapshotLimit = Number(process.env.MANAGER_SNAPSHOT_LIMIT || 5),
    clock = () => new Date()
  } = {}) {
    this.bundleDir = resolve(bundleDir);
    this.targetDir = resolve(targetDir);
    this.parentDir = dirname(this.targetDir);
    this.stageDir = join(this.parentDir, ".family_dashboard_classroom-staging");
    this.previousDir = join(this.parentDir, ".family_dashboard_classroom-previous");
    this.snapshotDir = resolve(dataDir, "classroom-integration-snapshots");
    this.snapshotLimit = Number.isInteger(snapshotLimit) && snapshotLimit > 0 ? snapshotLimit : 5;
    this.clock = clock;
    this.writeQueue = Promise.resolve();
  }

  withWriteLock(operation) {
    const run = this.writeQueue.then(operation, operation);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async inspectTargetBoundary() {
    const kind = await pathKind(this.parentDir);
    if (kind === "directory") return { ready: true, reason: null };
    return {
      ready: false,
      reason: "Home Assistant custom_components must already exist as a regular directory"
    };
  }

  async assertTargetBoundary() {
    const boundary = await this.inspectTargetBoundary();
    if (!boundary.ready) throw new Error(boundary.reason);
  }

  async readBundle() {
    return readManagedDirectory(this.bundleDir);
  }

  async inspectInstalled() {
    try {
      const files = await readManagedDirectory(this.targetDir, { missingAllowed: true });
      if (files === null) return { state: "not_installed", active_set_hash: null, files: null };
      return { state: "managed", active_set_hash: fileSetHash(files), files };
    } catch (error) {
      return {
        state: "unmanaged",
        active_set_hash: null,
        files: null,
        reason: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async listSnapshots() {
    const snapshotRootKind = await pathKind(this.snapshotDir);
    if (snapshotRootKind === "missing") return [];
    if (snapshotRootKind !== "directory") {
      throw new Error("Classroom integration snapshot path is not a regular directory");
    }
    const entries = await readdir(this.snapshotDir, { withFileTypes: true });
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !SNAPSHOT_PATTERN.test(entry.name)) continue;
      try {
        const metadataPath = join(this.snapshotDir, entry.name, "metadata.json");
        if (await pathKind(metadataPath) !== "file") continue;
        const metadata = JSON.parse(await readFile(metadataPath, "utf8"));
        if (
          metadata.snapshot_id !== entry.name
          || typeof metadata.created_at !== "string"
          || typeof metadata.reason !== "string"
          || typeof metadata.installed !== "boolean"
          || (metadata.file_set_hash !== null && !/^[a-f0-9]{64}$/.test(metadata.file_set_hash))
        ) {
          continue;
        }
        snapshots.push({
          snapshot_id: metadata.snapshot_id,
          created_at: metadata.created_at,
          reason: metadata.reason.slice(0, 160),
          installed: metadata.installed,
          file_set_hash: metadata.file_set_hash
        });
      } catch {
        // An interrupted snapshot has no commit marker and is not offered.
      }
    }
    return snapshots.sort((a, b) => b.created_at < a.created_at ? -1 : b.created_at > a.created_at ? 1 : 0);
  }

  async getStatus() {
    const [bundle, installed, snapshots, boundary] = await Promise.all([
      this.readBundle(),
      this.inspectInstalled(),
      this.listSnapshots(),
      this.inspectTargetBoundary()
    ]);
    return {
      bundled_set_hash: fileSetHash(bundle),
      bundled_files: fileManifest(bundle),
      installed_state: installed.state,
      active_set_hash: installed.active_set_hash,
      install_available: installed.state !== "unmanaged" && boundary.ready,
      restart_required_after_change: true,
      unmanaged_reason: installed.reason ?? null,
      install_blocker: boundary.reason,
      snapshots
    };
  }

  async createSnapshot(installed, reason) {
    if (installed.state === "unmanaged") throw new Error(installed.reason);
    await mkdir(this.snapshotDir, { recursive: true, mode: 0o700 });
    const createdAt = this.clock().toISOString();
    const compactTime = `${createdAt.slice(0, 19).replace(/[-:]/g, "")}Z`;
    const suffix = sha256(`${installed.active_set_hash}:${createdAt}:${randomUUID()}`).slice(0, 12);
    const snapshotId = `${compactTime}-${suffix}`;
    const path = join(this.snapshotDir, snapshotId);
    await mkdir(path, { recursive: false, mode: 0o700 });
    const metadata = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      reason,
      installed: installed.state === "managed",
      file_set_hash: installed.active_set_hash,
      files: installed.files ? fileManifest(installed.files) : []
    };
    try {
      if (installed.files) {
        for (const relativePath of MANAGED_FILES) {
          await atomicWrite(join(path, "integration", relativePath), installed.files[relativePath]);
        }
      }
      await atomicWrite(join(path, "metadata.json"), canonicalJson(metadata));
    } catch (error) {
      await rm(path, { recursive: true, force: true });
      throw error;
    }
    await this.pruneSnapshots();
    return metadata;
  }

  async pruneSnapshots() {
    const snapshots = await this.listSnapshots();
    for (const snapshot of snapshots.slice(this.snapshotLimit)) {
      await rm(join(this.snapshotDir, safeSnapshotId(snapshot.snapshot_id)), { recursive: true, force: false });
    }
  }

  async replaceTarget(files) {
    await this.assertTargetBoundary();
    await rm(this.stageDir, { recursive: true, force: true });
    await rm(this.previousDir, { recursive: true, force: true });
    if (files) {
      await mkdir(this.stageDir, { recursive: false, mode: 0o755 });
      for (const relativePath of MANAGED_FILES) {
        await atomicWrite(join(this.stageDir, relativePath), files[relativePath], { mode: 0o644 });
      }
      const staged = await readManagedDirectory(this.stageDir);
      if (fileSetHash(staged) !== fileSetHash(files)) throw new Error("staged Classroom integration hash mismatch");
    }

    const targetExists = await pathKind(this.targetDir) !== "missing";
    if (targetExists) await rename(this.targetDir, this.previousDir);
    try {
      if (files) await rename(this.stageDir, this.targetDir);
    } catch (error) {
      if (targetExists && await pathKind(this.previousDir) === "directory") {
        await rename(this.previousDir, this.targetDir);
      }
      throw error;
    }
    await rm(this.previousDir, { recursive: true, force: true });
  }

  async install({ expectedBundleHash, expectedActiveHash, confirm } = {}) {
    return this.withWriteLock(async () => {
      if (confirm !== true) throw new Error("confirm must be true before Classroom integration installation");
      const [bundle, installed] = await Promise.all([this.readBundle(), this.inspectInstalled()]);
      if (installed.state === "unmanaged") throw new Error(installed.reason);
      const bundleHash = fileSetHash(bundle);
      if (bundleHash !== expectedBundleHash) throw new Error("expected_bundle_hash does not match the bundled Classroom integration");
      if (installed.active_set_hash !== expectedActiveHash) throw new Error("expected_active_hash does not match the installed Classroom integration");
      await this.assertTargetBoundary();
      const snapshot = await this.createSnapshot(installed, "before Classroom integration install");
      await this.replaceTarget(bundle);
      const resulting = await this.inspectInstalled();
      if (resulting.state !== "managed" || resulting.active_set_hash !== bundleHash) {
        throw new Error("installed Classroom integration hash verification failed");
      }
      return {
        installed_at: this.clock().toISOString(),
        previous_set_hash: installed.active_set_hash,
        resulting_set_hash: resulting.active_set_hash,
        rollback_snapshot: snapshot.snapshot_id,
        home_assistant_restart_required: true,
        oauth_authorizations_created: 0
      };
    });
  }

  async readSnapshot(snapshotId) {
    const id = safeSnapshotId(snapshotId);
    const path = join(this.snapshotDir, id);
    const metadataPath = join(path, "metadata.json");
    let metadata;
    try {
      if (await pathKind(metadataPath) !== "file") {
        throw new Error("Classroom integration snapshot metadata is invalid");
      }
      metadata = JSON.parse(await readFile(metadataPath, "utf8"));
    } catch (error) {
      if (error?.code === "ENOENT") throw new Error("Classroom integration snapshot was not found");
      throw error;
    }
    if (
      metadata.snapshot_id !== id
      || typeof metadata.created_at !== "string"
      || typeof metadata.reason !== "string"
      || typeof metadata.installed !== "boolean"
      || !Array.isArray(metadata.files)
    ) {
      throw new Error("Classroom integration snapshot metadata is invalid");
    }
    if (!metadata.installed) {
      if (metadata.file_set_hash !== null || metadata.files.length) {
        throw new Error("Classroom integration snapshot integrity check failed");
      }
      return { metadata, files: null };
    }
    if (typeof metadata.file_set_hash !== "string" || !/^[a-f0-9]{64}$/.test(metadata.file_set_hash)) {
      throw new Error("Classroom integration snapshot metadata is invalid");
    }
    const files = await readManagedDirectory(join(path, "integration"));
    if (fileSetHash(files) !== metadata.file_set_hash) {
      throw new Error("Classroom integration snapshot integrity check failed");
    }
    const actualManifest = canonicalJson(fileManifest(files));
    if (actualManifest !== canonicalJson(metadata.files)) {
      throw new Error("Classroom integration snapshot file hashes do not match");
    }
    return { metadata, files };
  }

  async rollback({ snapshotId, expectedActiveHash, confirm } = {}) {
    return this.withWriteLock(async () => {
      if (confirm !== true) throw new Error("confirm must be true before Classroom integration rollback");
      const installed = await this.inspectInstalled();
      if (installed.state === "unmanaged") throw new Error(installed.reason);
      if (installed.active_set_hash !== expectedActiveHash) throw new Error("expected_active_hash does not match the installed Classroom integration");
      const snapshot = await this.readSnapshot(snapshotId);
      await this.assertTargetBoundary();
      const safetySnapshot = await this.createSnapshot(installed, `before Classroom rollback to ${snapshotId}`);
      await this.replaceTarget(snapshot.files);
      const resulting = await this.inspectInstalled();
      if (resulting.active_set_hash !== snapshot.metadata.file_set_hash) {
        throw new Error("restored Classroom integration hash verification failed");
      }
      return {
        restored_snapshot: snapshot.metadata.snapshot_id,
        previous_set_hash: installed.active_set_hash,
        resulting_set_hash: resulting.active_set_hash,
        safety_snapshot: safetySnapshot.snapshot_id,
        home_assistant_restart_required: true,
        oauth_authorizations_changed: false
      };
    });
  }
}

export { MANAGED_FILES };
