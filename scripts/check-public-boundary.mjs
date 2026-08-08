import { readFile, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = [
  "README.md",
  "repository.yaml",
  "family_dashboard_manager/config.yaml",
  "family_dashboard_manager/DOCS.md",
  "family_dashboard_manager/README.md",
  "family_dashboard_manager/app/config",
  "family_dashboard_manager/app/docs",
  "family_dashboard_manager/app/generated",
  "family_dashboard_manager/app/preview"
];
const textExtensions = new Set([".md", ".mjs", ".json", ".svg", ".yaml", ".yml"]);
const forbidden = [
  { label: "private IPv4 address", pattern: /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/ },
  { label: "email address", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i },
  { label: "OpenAI-style API key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/ },
  { label: "concrete tunnel ID", pattern: /\btunnel_[a-f0-9]{32}\b/ },
  { label: "private key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/ }
];

async function filesAt(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => filesAt(join(path, entry.name))));
    return nested.flat();
  } catch (error) {
    if (error?.code === "ENOTDIR") return [path];
    throw error;
  }
}

const files = (await Promise.all(roots.map(filesAt)))
  .flat()
  .filter((path) => textExtensions.has(extname(path)));
const failures = [];
for (const path of files) {
  const content = await readFile(path, "utf8");
  for (const rule of forbidden) {
    if (rule.pattern.test(content)) failures.push(`${path}: ${rule.label}`);
  }
}

if (failures.length) {
  console.error("Public/private repository boundary check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Public/private repository boundary check passed for ${files.length} files.`);
}
