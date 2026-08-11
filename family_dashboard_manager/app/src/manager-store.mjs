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
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { compareText } from "./compare-text.mjs";
import { compileDashboard, getEnabledViewPaths } from "./compile-dashboard.mjs";
import { validateConfig } from "./validate-config.mjs";

const DEFAULT_FRONTEND_DIR = fileURLToPath(new URL("../frontend/", import.meta.url));
const DEFAULT_PUBLIC_RESOURCE_BASE = "/local/family-dashboard";
const PRIVATE_FLOORPLAN_FILES = Object.freeze(["ground-floor.svg", "first-floor.svg"]);
const PRIVATE_FLOORPLAN_SET = new Set(PRIVATE_FLOORPLAN_FILES);
const MAX_FLOORPLAN_BYTES = 512 * 1024;
const MANAGED_FRONTEND_FILES = Object.freeze([
  "family-hub-card.js",
  "assets/example-ground.svg",
  "assets/example-first.svg",
  "assets/example-living-room-light.svg",
  "assets/example-kitchen-light.svg"
]);
const MANAGED_FRONTEND_SET = new Set(MANAGED_FRONTEND_FILES);

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

async function atomicWrite(path, content, { mode = 0o600 } = {}) {
  await mkdir(dirname(path), { recursive: true, mode: mode === 0o644 ? 0o755 : 0o700 });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, content, { encoding: "utf8", mode });
  await rename(temporaryPath, path);
}

function safeSnapshotId(value) {
  if (typeof value !== "string" || !/^\d{8}T\d{6}Z-[a-f0-9]{12}$/.test(value)) {
    throw new Error("snapshot_id is invalid");
  }
  return value;
}

function safeManagedFrontendPath(value) {
  if (typeof value !== "string" || !MANAGED_FRONTEND_SET.has(value)) {
    throw new Error("snapshot contains an unmanaged frontend path");
  }
  return value;
}

function safePublicResourceBase(value) {
  if (typeof value !== "string" || !/^\/local\/[a-z][a-z0-9-]*$/.test(value) || value.includes("..")) {
    throw new Error("public resource base is invalid");
  }
  return value;
}

function validateSvgAsset(filename, content) {
  if (!PRIVATE_FLOORPLAN_SET.has(filename)) {
    throw new Error("floorplan filename is not allowed");
  }
  if (typeof content !== "string" || Buffer.byteLength(content, "utf8") > MAX_FLOORPLAN_BYTES) {
    throw new Error(`${filename} must be a UTF-8 SVG no larger than 512 KiB`);
  }
  const trimmed = content.trim();
  if (!/^<svg\b/i.test(trimmed) || !/<\/svg>$/.test(trimmed) || !/\bviewBox\s*=\s*["'][^"']+["']/i.test(trimmed)) {
    throw new Error(`${filename} must be a complete SVG with a viewBox`);
  }
  if (/<!DOCTYPE|<!ENTITY|<script\b|<foreignObject\b|<iframe\b|<object\b|<embed\b|<a\b|<style\b|@import|javascript\s*:|\son[a-z]+\s*=/i.test(content)) {
    throw new Error(`${filename} contains active or unsupported SVG content`);
  }
  const hrefPattern = /\b(?:href|xlink:href)\s*=\s*(["'])(.*?)\1/gi;
  for (const match of content.matchAll(hrefPattern)) {
    if (!/^#[-A-Za-z0-9_.:]+$/.test(match[2]) && !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(match[2])) {
      throw new Error(`${filename} contains an external SVG reference`);
    }
  }
  if (/\b(?:href|xlink:href)\s*=/.test(content.replace(hrefPattern, ""))) {
    throw new Error(`${filename} contains an unquoted SVG reference`);
  }
  for (const match of content.matchAll(/url\(([^)]+)\)/gi)) {
    if (!/^#[-A-Za-z0-9_.:]+$/.test(match[1].trim().replace(/^['"]|['"]$/g, ""))) {
      throw new Error(`${filename} contains an external CSS reference`);
    }
  }
  return {
    filename,
    content,
    size_bytes: Buffer.byteLength(content, "utf8"),
    sha256: sha256(content)
  };
}

export function prepareFloorplanAssets(assets) {
  if (!Array.isArray(assets) || assets.length !== PRIVATE_FLOORPLAN_FILES.length) {
    throw new Error("exactly the ground-floor.svg and first-floor.svg assets are required");
  }
  const prepared = assets.map((asset) => validateSvgAsset(asset?.filename, asset?.content));
  const byFilename = new Map(prepared.map((asset) => [asset.filename, asset]));
  if (byFilename.size !== PRIVATE_FLOORPLAN_FILES.length || PRIVATE_FLOORPLAN_FILES.some((filename) => !byFilename.has(filename))) {
    throw new Error("floorplan assets must contain each allowed filename exactly once");
  }
  const ordered = PRIVATE_FLOORPLAN_FILES.map((filename) => byFilename.get(filename));
  const manifest = ordered.map(({ filename, size_bytes, sha256: hash }) => ({ filename, size_bytes, sha256: hash }));
  return {
    asset_set_hash: sha256(canonicalJson(manifest)),
    assets: manifest,
    files: Object.fromEntries(ordered.map(({ filename, content }) => [filename, content]))
  };
}

export class DashboardStore {
  constructor({
    configDir = process.env.MANAGER_CONFIG_DIR || "/config/family-dashboard",
    dataDir = process.env.MANAGER_DATA_DIR || "/data",
    resourceDir = process.env.MANAGER_RESOURCE_DIR || "/config/www/family-dashboard",
    publicResourceBase = process.env.MANAGER_PUBLIC_RESOURCE_BASE || DEFAULT_PUBLIC_RESOURCE_BASE,
    requireReadOnly = process.env.MANAGER_REQUIRE_READ_ONLY === "true",
    frontendDir = process.env.MANAGER_FRONTEND_DIR || DEFAULT_FRONTEND_DIR,
    snapshotLimit = Number(process.env.MANAGER_SNAPSHOT_LIMIT || 5),
    clock = () => new Date()
  } = {}) {
    this.configDir = resolve(configDir);
    this.dataDir = resolve(dataDir);
    this.resourceDir = resolve(resourceDir);
    this.publicResourceBase = safePublicResourceBase(publicResourceBase);
    this.requireReadOnly = requireReadOnly === true;
    this.frontendDir = resolve(frontendDir);
    this.snapshotDir = join(this.dataDir, "snapshots");
    this.configPath = join(this.configDir, "household.json");
    this.dashboardPath = join(this.configDir, "dashboard.yaml");
    this.resourcePath = join(this.resourceDir, "family-hub-card.js");
    this.privateAssetDir = join(this.resourceDir, "private");
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
    const config = sortValue(validateConfig(structuredClone(candidate)));
    if (this.requireReadOnly && config.display.read_only !== true) {
      throw new Error("this preview manager requires config.display.read_only to be true");
    }
    const configText = canonicalJson(config);
    const dashboard = compileDashboard(config);
    return {
      config,
      configText,
      dashboard,
      config_hash: sha256(configText),
      dashboard_hash: sha256(dashboard),
      enabled_views: getEnabledViewPaths(config),
      resource_url: this.getResourceUrl()
    };
  }

  getResourceUrl() {
    return `${this.publicResourceBase}/family-hub-card.js?v=${process.env.APP_VERSION || "0.4.0"}`;
  }

  getPrivateAssetUrl(filename) {
    if (!PRIVATE_FLOORPLAN_SET.has(filename)) throw new Error("floorplan filename is not allowed");
    return `${this.publicResourceBase}/private/${filename}`;
  }

  async readHouseholdConfig() {
    await this.initialise();
    return readJson(this.configPath);
  }

  async getStatus() {
    await this.initialise();
    const [configText, dashboard, resource, state, snapshots, privateAssets] = await Promise.all([
      readText(this.configPath),
      readText(this.dashboardPath),
      readText(this.resourcePath),
      readJson(this.statePath),
      this.listSnapshots(),
      this.readPrivateAssetStatus()
    ]);
    return {
      app_version: process.env.APP_VERSION || "0.4.0",
      read_only_required: this.requireReadOnly,
      installed: configText !== null && dashboard !== null,
      resource_installed: resource !== null,
      resource_url: this.getResourceUrl(),
      active_config_hash: configText === null ? null : sha256(configText),
      active_dashboard_hash: dashboard === null ? null : sha256(dashboard),
      active_resource_hash: resource === null ? null : sha256(resource),
      private_assets: privateAssets,
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
    return snapshots.sort((a, b) => compareText(b.created_at, a.created_at));
  }

  async readManagedFrontend(directory = this.resourceDir) {
    const entries = await Promise.all(MANAGED_FRONTEND_FILES.map(async (relativePath) => [
      relativePath,
      await readText(join(directory, relativePath))
    ]));
    return Object.fromEntries(entries.filter(([, content]) => content !== null));
  }

  async readBundledFrontend() {
    const files = await this.readManagedFrontend(this.frontendDir);
    const missing = MANAGED_FRONTEND_FILES.filter((relativePath) => files[relativePath] === undefined);
    if (missing.length) throw new Error(`bundled frontend file is missing: ${missing.join(", ")}`);
    return files;
  }

  async writeManagedFrontend(files) {
    await mkdir(this.resourceDir, { recursive: true, mode: 0o755 });
    for (const relativePath of MANAGED_FRONTEND_FILES) {
      if (files[relativePath] === undefined) continue;
      await atomicWrite(join(this.resourceDir, relativePath), files[relativePath], { mode: 0o644 });
    }
  }

  async readPrivateAssetStatus() {
    const entries = await Promise.all(PRIVATE_FLOORPLAN_FILES.map(async (filename) => {
      const content = await readText(join(this.privateAssetDir, filename));
      return [filename, {
        installed: content !== null,
        sha256: content === null ? null : sha256(content),
        url: this.getPrivateAssetUrl(filename)
      }];
    }));
    return Object.fromEntries(entries);
  }

  validateFloorplanAssets(assets) {
    const prepared = prepareFloorplanAssets(assets);
    return {
      asset_set_hash: prepared.asset_set_hash,
      assets: prepared.assets.map((asset) => ({ ...asset, url: this.getPrivateAssetUrl(asset.filename) }))
    };
  }

  async deployFloorplanAssets(assets, { expectedAssetSetHash, confirm } = {}) {
    return this.withWriteLock(async () => {
      const prepared = prepareFloorplanAssets(assets);
      if (confirm !== true) throw new Error("confirm must be true before floorplan deployment");
      if (expectedAssetSetHash !== prepared.asset_set_hash) {
        throw new Error("expected_asset_set_hash does not match the validated floorplans");
      }
      await mkdir(this.privateAssetDir, { recursive: true, mode: 0o755 });
      for (const filename of PRIVATE_FLOORPLAN_FILES) {
        await atomicWrite(join(this.privateAssetDir, filename), prepared.files[filename], { mode: 0o644 });
      }
      await this.clearError();
      return {
        deployed_at: this.clock().toISOString(),
        asset_set_hash: prepared.asset_set_hash,
        assets: prepared.assets.map((asset) => ({
          filename: asset.filename,
          size_bytes: asset.size_bytes,
          sha256: asset.sha256,
          url: this.getPrivateAssetUrl(asset.filename)
        }))
      };
    });
  }

  async assertPrivateAssetsAvailable(config) {
    const prefix = `${this.publicResourceBase}/private/`;
    const references = config.floorplan.floors.flatMap((floor) => [
      floor.base_image,
      floor.night_image,
      ...floor.light_overlays.map((overlay) => overlay.image)
    ]).filter((value) => typeof value === "string" && value.startsWith(prefix));
    for (const reference of references) {
      const filename = reference.slice(prefix.length);
      if (!PRIVATE_FLOORPLAN_SET.has(filename)) throw new Error("configuration references an unapproved private floorplan asset");
      if (await readText(join(this.privateAssetDir, filename)) === null) {
        throw new Error(`private floorplan asset is not installed: ${filename}`);
      }
    }
  }

  async createSnapshot(reason) {
    const [configText, dashboard, frontend] = await Promise.all([
      readText(this.configPath),
      readText(this.dashboardPath),
      this.readManagedFrontend()
    ]);
    if (configText === null || dashboard === null) return null;

    const createdAt = this.clock().toISOString();
    const compactTime = `${createdAt.slice(0, 19).replace(/[-:]/g, "")}Z`;
    const configHash = sha256(configText);
    const snapshotSuffix = sha256(`${configHash}:${createdAt}:${randomUUID()}`).slice(0, 12);
    const snapshotId = `${compactTime}-${snapshotSuffix}`;
    const path = join(this.snapshotDir, snapshotId);
    await mkdir(path, { recursive: false, mode: 0o700 });
    const frontendHashes = Object.fromEntries(
      Object.entries(frontend).map(([relativePath, content]) => [relativePath, sha256(content)])
    );
    const metadata = {
      snapshot_id: snapshotId,
      created_at: createdAt,
      reason,
      config_hash: configHash,
      dashboard_hash: sha256(dashboard),
      frontend_hashes: frontendHashes
    };
    try {
      await Promise.all([
        writeFile(join(path, "household.json"), configText, { encoding: "utf8", mode: 0o600 }),
        writeFile(join(path, "dashboard.yaml"), dashboard, { encoding: "utf8", mode: 0o600 }),
        ...Object.entries(frontend).map(async ([relativePath, content]) => {
          const target = join(path, "frontend", relativePath);
          await mkdir(dirname(target), { recursive: true, mode: 0o700 });
          await writeFile(target, content, { encoding: "utf8", mode: 0o600 });
        })
      ]);
      // Metadata is the snapshot commit marker and is written only after every
      // hash-covered payload has succeeded.
      await writeFile(join(path, "metadata.json"), canonicalJson(metadata), { encoding: "utf8", mode: 0o600 });
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
      const frontend = await this.readBundledFrontend();
      await this.initialise();
      await this.assertPrivateAssetsAvailable(prepared.config);
      const previous = await this.getStatus();
      const snapshot = await this.createSnapshot(reason);

      // Publish inert static assets before the dashboard begins referring to the card.
      // Only this fixed allow-list is written; household floorplan files are preserved.
      await this.writeManagedFrontend(frontend);
      await atomicWrite(this.configPath, prepared.configText);
      await atomicWrite(this.dashboardPath, prepared.dashboard);
      const deployedAt = this.clock().toISOString();
      const resourceHash = sha256(frontend["family-hub-card.js"]);
      await atomicWrite(this.statePath, canonicalJson({
        last_successful_deployment: deployedAt,
        validation_state: "valid",
        config_hash: prepared.config_hash,
        dashboard_hash: prepared.dashboard_hash,
        resource_hash: resourceHash
      }));
      await this.clearError();
      return {
        deployed_at: deployedAt,
        previous_config_hash: previous.active_config_hash,
        resulting_config_hash: prepared.config_hash,
        resulting_dashboard_hash: prepared.dashboard_hash,
        resulting_resource_hash: resourceHash,
        resource_url: prepared.resource_url,
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
      const [configText, dashboard, metadata] = await Promise.all([
        readText(join(path, "household.json")),
        readText(join(path, "dashboard.yaml")),
        readJson(join(path, "metadata.json"))
      ]);
      if (configText === null || dashboard === null || !metadata) throw new Error("snapshot was not found");
      if (sha256(configText) !== metadata.config_hash || sha256(dashboard) !== metadata.dashboard_hash) {
        throw new Error("snapshot integrity check failed");
      }

      const restoredFrontend = {};
      for (const [untrustedPath, expectedHash] of Object.entries(metadata.frontend_hashes || {})) {
        const relativePath = safeManagedFrontendPath(untrustedPath);
        const content = await readText(join(path, "frontend", relativePath));
        if (content === null || sha256(content) !== expectedHash) {
          throw new Error("snapshot frontend integrity check failed");
        }
        restoredFrontend[relativePath] = content;
      }

      const safetySnapshot = await this.createSnapshot(`before rollback to ${id}`);
      await this.writeManagedFrontend(restoredFrontend);
      await atomicWrite(this.configPath, configText);
      await atomicWrite(this.dashboardPath, dashboard);
      const deployedAt = this.clock().toISOString();
      await atomicWrite(this.statePath, canonicalJson({
        last_successful_deployment: deployedAt,
        validation_state: "snapshot_restored",
        config_hash: metadata.config_hash,
        dashboard_hash: metadata.dashboard_hash,
        restored_snapshot: id
      }));
      await this.clearError();
      return {
        restored_snapshot: id,
        previous_config_hash: status.active_config_hash,
        resulting_config_hash: metadata.config_hash,
        resulting_dashboard_hash: metadata.dashboard_hash,
        safety_snapshot: safetySnapshot?.snapshot_id ?? null
      };
    });
  }

  async assertFilesReadable() {
    await Promise.all([stat(this.configPath), stat(this.dashboardPath), stat(this.resourcePath)]);
    return true;
  }
}
