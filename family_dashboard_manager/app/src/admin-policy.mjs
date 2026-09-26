import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "./manager-store.mjs";

const DEFAULT_SCHEMA_PATH = fileURLToPath(new URL("../config/family-dashboard.schema.json", import.meta.url));
const PROTECTED_SECTIONS = new Set(["entry", "floorplan", "location", "school"]);
const HIDDEN_PATHS = new Set(["schema_version", "$schema", "display.panel_path"]);

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function valuePreview(value) {
  if (typeof value === "string") return value.length > 120 ? `${value.slice(0, 117)}...` : value;
  if (value === undefined) return null;
  return value;
}

function collectChanges(previous, candidate, path = "", changes = []) {
  if (Object.is(previous, candidate)) return changes;
  if (Array.isArray(previous) && Array.isArray(candidate)) {
    const count = Math.max(previous.length, candidate.length);
    for (let index = 0; index < count; index += 1) {
      collectChanges(previous[index], candidate[index], `${path}[${index}]`, changes);
    }
    return changes;
  }
  if (isObject(previous) && isObject(candidate)) {
    const keys = new Set([...Object.keys(previous), ...Object.keys(candidate)]);
    for (const key of [...keys].sort()) {
      collectChanges(previous[key], candidate[key], path ? `${path}.${key}` : key, changes);
    }
    return changes;
  }
  changes.push({ path, before: valuePreview(previous), after: valuePreview(candidate) });
  return changes;
}

export function protectedSectionsForChanges(changes) {
  return [...new Set(changes
    .map(({ path }) => String(path || "").split(/[.[]/, 1)[0])
    .filter((section) => PROTECTED_SECTIONS.has(section)))].sort();
}

export function sanitiseAdminSchema(schema) {
  const copy = structuredClone(schema);
  copy.properties.schema_version = { ...copy.properties.schema_version, readOnly: true };
  if (copy.properties.$schema) copy.properties.$schema = { ...copy.properties.$schema, readOnly: true };
  copy.properties.display.properties.panel_path = {
    ...copy.properties.display.properties.panel_path,
    readOnly: true,
    description: "Managed dashboard identity. It cannot be changed from Admin."
  };
  for (const section of PROTECTED_SECTIONS) {
    copy.properties[section] = {
      ...copy.properties[section],
      "x-protected": true
    };
  }
  return copy;
}

export async function readAdminSchema(path = DEFAULT_SCHEMA_PATH) {
  return sanitiseAdminSchema(JSON.parse(await readFile(path, "utf8")));
}

export async function buildAdminBootstrap({ store, inventory, user }) {
  const [config, status, schema, availableInventory] = await Promise.all([
    store.readHouseholdConfig(),
    store.getStatus(),
    readAdminSchema(),
    inventory()
  ]);
  if (!config) throw new Error("household configuration is not installed");
  return {
    version: process.env.APP_VERSION || "0.12.0",
    user,
    config,
    schema,
    inventory: availableInventory,
    active_config_hash: status.active_config_hash,
    private_assets: status.private_assets,
    snapshots: status.snapshots.slice(0, 5),
    boundaries: {
      hidden_paths: [...HIDDEN_PATHS],
      protected_sections: [...PROTECTED_SECTIONS],
      secrets: "OAuth credentials, Home Assistant tokens and Secure MCP Tunnel options are never exposed here.",
      choreops: "ChoreOps remains authoritative for chore definitions, schedules, approvals and points."
    }
  };
}

export async function previewAdminCandidate({ store, candidate, expectedActiveHash }) {
  const [current, status] = await Promise.all([store.readHouseholdConfig(), store.getStatus()]);
  if (!current) throw new Error("household configuration is not installed");
  if (expectedActiveHash !== status.active_config_hash) {
    throw new Error("the household configuration changed; reload Admin before saving");
  }
  for (const path of HIDDEN_PATHS) {
    const parts = path.split(".");
    const read = (value) => parts.reduce((entry, key) => entry?.[key], value);
    if (canonicalJson(read(current)) !== canonicalJson(read(candidate))) {
      throw new Error(`${path} is managed and cannot be changed from Admin`);
    }
  }
  const prepared = store.validate(candidate);
  const changes = collectChanges(current, prepared.config);
  const protectedSections = protectedSectionsForChanges(changes);
  return {
    valid: true,
    config: prepared.config,
    config_hash: prepared.config_hash,
    dashboard_hash: prepared.dashboard_hash,
    enabled_views: prepared.enabled_views,
    changes: changes.slice(0, 250),
    change_count: changes.length,
    protected_sections: protectedSections,
    requires_protected_acknowledgement: protectedSections.length > 0,
    active_config_hash: status.active_config_hash
  };
}

export async function deployAdminCandidate({
  store,
  candidate,
  expectedActiveHash,
  expectedConfigHash,
  confirm,
  acknowledgeProtected
}) {
  if (confirm !== true) throw new Error("confirm must be true before Admin deployment");
  const preview = await previewAdminCandidate({ store, candidate, expectedActiveHash });
  if (preview.config_hash !== expectedConfigHash) {
    throw new Error("expected_config_hash does not match the Admin preview");
  }
  if (preview.requires_protected_acknowledgement && acknowledgeProtected !== true) {
    throw new Error("protected household changes require explicit acknowledgement");
  }
  return store.deploy(preview.config, {
    expectedConfigHash: preview.config_hash,
    confirm: true,
    reason: `admin: ${preview.changes.map(({ path }) => path).slice(0, 8).join(", ") || "no household changes"}`
  });
}
