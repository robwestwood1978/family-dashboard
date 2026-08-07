import { createHash, randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { compileDashboard } from "./compile-dashboard.mjs";
import { validateConfig } from "./validate-config.mjs";

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
}

export function canonicalJson(value) {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

export function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function readText(path) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

async function readJson(path) {
  const text = await readText(path);
  return text === null ? null : JSON.parse(text);
}

async function atomicWrite(path, content) {
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
}

function safeSnapshotId(value) {
  if (typeof value !== "string" || !/^\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(value)) {
    throw new Error("snapshot_id is invalid");
  }
  return value;
}

export class DashboardStore {
  constructor({
    configDir = process.env.MANAGER_CONFIG_DIR || "/config/family-dashboard",
    dataDir = process.env.MANAGER_DATA_DIR || "/data",
    snapshotLimit = Number(process.env.MANAGER_SNAPSHOT_LIMIT || 5),
    clock = () => new Date()
  } = {}) {
    this.configDir = resolve(configDir);
    this.dataDir = resolve(dataDir);
    this.snapshotDir = join(this.dataDir, "snapshots");
    this.configPath = join(this.configDir, "household.json");
    this.dashboardPath = join(this.configDir, "dashboard.yaml");
    this.statePath = join(this.dataDir, "state.json");
    this.errorPath = join(this.dataDir, "last-error.json");
    this.snapshotLimit = Number.isInteger(snapshotLimit) && snapshotLimit > 0 ? snapshotLimit : 5;
    this.clock = clock;
    this.writeQueue = Promise.resolve();
  }

  async initialise() {
    await mkdir(this.configDir, { recursive: true, mode: 0o700 });
    await mkdir(this.snapshotDir, { recursive: true, mode: 0o700 });
  }

  validate(candidate) {
    const config = validateConfig(structuredClone(candidate));
    const configText = canonicalJson(config);
    const dashboard = compileDashboard(config);
    const enabledViews = Object.entries(config.features)
      .filter(([, enabled]) => enabled)
      .map(([name]) => name);
    return {
      config,
      configText,
      dashboard,
      config_hash: sha256(configText),
      dashboard_hash: sha256(dashboard),
      enabled_views: ["today", ...enabledViews.filter((view) => view !== "today")]
    };
  }

  async readHouseholdConfig() {
    await this.initialise();
    return readJson(this.configPath);
  }

  async getStatus() {
    await this.initialise();
    const [configText, dashboard, state, snapshots] = await Promise.all([
      readText(this.configPath),
      readText(this.dashboardPath),
      readJson(this.statePath),
      this.listSnapshots()
    ]);
    return {
      app_version: process.env.APP_VERSION || "0.1.0",
      installed: configText !== null && dashboard !== null,
      active_config_hash: configText === null ? null : sha256(configText),
      active_dashboard_hash: dashboard === null ? null : sha256(dashboard),
      last_successful_deployment: state?.last_successful_deployment ?? null,
      validation_state: state?.validation_state ?? (configText === null ? "not_configured" : "unknown"),
      snapshots
    };
  }

  async getErrors() {
    await this.initialise();
    return (await readJson(this.errorPath)) ?? { recorded_at: null, operation: null, message: null };
  }

  async recordError(operation, error) {
    await this.initialise();
    const payload = {
      recorded_at: this.clock().toISOString(),
      operation,
      message: error instanceof Error ? error.message.slice(0, 500) : String(error).slice(0, 500)
    };
    await atomicWrite(this.errorPath, canonicalJson(payload));
  }

  async clearError() {
    await rm(this.errorPath, { force: true });
  }

  async listSnapshots() {
    await mkdir(this.snapshotDir, { recursive: true, mode: 0o700 });
    const entries = await readdir(this.snapshotDir, { withFileTypes: true });
    const snapshots = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || !/^\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(entry.name)) continue;
      const metadata = await readJson(join(this.snapshotDir, entry.name, "metadata.json"));
      if (metadata) snapshots.push(metadata);
    }
    return snapshots.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async createSnapshot(reason) {
    const [configText, dashboard] = await Promise.all([
      readText(this.configPath),
      readText(this.dashboardPath)
    ]);
    if (configText === null || dashboard === null) return null;

    const createdAt = this.clock().toISOString();
    const compactTime = `${createdAt.slice(0, 19).replace(/[-:]/g, "")}Z`;
    const configHash = sha256(configText);
    const snapshotId = `${compactTime}-${configHash.slice(0, 12)}`;
    const path = join(this.snapshotDir, snapshotId);
    await mkdir(path, { recursive: false, mode: 0o700 });
    const metadata = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      reason,
      config_hash: configHash,
      dashboard_hash: sha256(dashboard)
    };
    await Promise.all([
      writeFile(join(path, "household.json"), configText, { encoding: "utf8", mode: 0o600 }),
      writeFile(join(path, "dashboard.yaml"), dashboard, { encoding: "utf8", mode: 0o600 }),
      writeFile(join(path, "metadata.json"), canonicalJson(metadata), { encoding: "utf8", mode: 0o600 })
    ]);
    await this.pruneSnapshots();
    return metadata;
  }

  async pruneSnapshots() {
    const snapshots = await this.listSnapshots();
    for (const snapshot of snapshots.slice(this.snapshotLimit)) {
      const snapshotId = safeSnapshotId(snapshot.snapshot_id);
      const path = resolve(this.snapshotDir, snapshotId);
      if (!path.startsWith(`${this.snapshotDir}/`)) throw new Error("snapshot path escaped its root");
      await rm(path, { recursive: true, force: false });
    }
  }

  withWriteLock(operation) {
    const run = this.writeQueue.then(operation, operation);
    this.writeQueue = run.catch(() => undefined);
    return run;
  }

  async deploy(candidate, { expectedConfigHash, confirm, reason = "deploy" } = {}) {
    return this.withWriteLock(async () => {
      const prepared = this.validate(candidate);
      if (confirm !== true) throw new Error("confirm must be true before deployment");
      if (expectedConfigHash !== prepared.config_hash) {
        throw new Error("expected_config_hash does not match the validated configuration");
      }
      await this.initialise();
      const previous = await this.getStatus();
      const snapshot = await this.createSnapshot(reason);
      await atomicWrite(this.configPath, prepared.configText);
      await atomicWrite(this.dashboardPath, prepared.dashboard);
      const deployedAt = this.clock().toISOString();
      await atomicWrite(this.statePath, canonicalJson({
        last_successful_deployment: deployedAt,
        validation_state: "valid",
        config_hash: prepared.config_hash,
        dashboard_hash: prepared.dashboard_hash
      }));
      await this.clearError();
      return {
        deployed_at: deployedAt,
        previous_config_hash: previous.active_config_hash,
        resulting_config_hash: prepared.config_hash,
        resulting_dashboard_hash: prepared.dashboard_hash,
        rollback_snapshot: snapshot?.snapshot_id ?? null
      };
    });
  }

  async rollback({ snapshotId, expectedActiveHash, confirm } = {}) {
    return this.withWriteLock(async () => {
      if (confirm !== true) throw new Error("confirm must be true before rollback");
      const status = await this.getStatus();
      if (status.active_config_hash !== expectedActiveHash) {
        throw new Error("expected_active_hash does not match the active configuration");
      }
      const id = safeSnapshotId(snapshotId);
      const path = resolve(this.snapshotDir, id);
      if (!path.startsWith(`${this.snapshotDir}/`)) throw new Error("snapshot path escaped its root");
      const [candidate, metadata] = await Promise.all([
        readJson(join(path, "household.json")),
        readJson(join(path, "metadata.json"))
      ]);
      if (!candidate || !metadata) throw new Error("snapshot was not found");
      const prepared = this.validate(candidate);
      if (prepared.config_hash !== metadata.config_hash) throw new Error("snapshot integrity check failed");
      const safetySnapshot = await this.createSnapshot(`before rollback to ${id}`);
      await atomicWrite(this.configPath, prepared.configText);
      await atomicWrite(this.dashboardPath, prepared.dashboard);
      const deployedAt = this.clock().toISOString();
      await atomicWrite(this.statePath, canonicalJson({
        last_successful_deployment: deployedAt,
        validation_state: "valid",
        config_hash: prepared.config_hash,
        dashboard_hash: prepared.dashboard_hash,
        restored_snapshot: id
      }));
      await this.clearError();
      return {
        restored_snapshot: id,
        previous_config_hash: status.active_config_hash,
        resulting_config_hash: prepared.config_hash,
        safety_snapshot: safetySnapshot?.snapshot_id ?? null
      };
    });
  }

  async assertFilesReadable() {
    await Promise.all([stat(this.configPath), stat(this.dashboardPath)]);
    return true;
  }
}
