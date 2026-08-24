import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import {
  APPROVAL_PROJECTS,
  APPROVAL_VIEW_NAMES,
  APPROVAL_ZOOM_PROJECTS,
  APPROVAL_ZOOM_VIEW_NAMES,
  expectedApprovalScreens
} from "../browser-test/v080-approval-manifest.mjs";

const outputRoot = resolve("test-results/v080-approval");
const screenRoot = resolve(outputRoot, "screens");

async function pngFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await pngFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".png")) files.push(path);
  }
  return files;
}

const expected = expectedApprovalScreens();
const expectedPaths = expected.map(({ project, name }) => `${project}/${name}`).sort();
const actualFiles = await pngFiles(screenRoot);
const actualPaths = actualFiles.map((path) => relative(screenRoot, path).split(sep).join("/")).sort();
const missing = expectedPaths.filter((path) => !actualPaths.includes(path));
const unexpected = actualPaths.filter((path) => !expectedPaths.includes(path));

if (missing.length || unexpected.length || actualPaths.length !== expectedPaths.length) {
  throw new Error([
    `v0.8 approval screenshot manifest mismatch: expected ${expectedPaths.length}, found ${actualPaths.length}.`,
    missing.length ? `Missing:\n- ${missing.join("\n- ")}` : "",
    unexpected.length ? `Unexpected:\n- ${unexpected.join("\n- ")}` : ""
  ].filter(Boolean).join("\n"));
}

const screens = [];
for (const expectedScreen of expected) {
  const path = resolve(screenRoot, expectedScreen.project, expectedScreen.name);
  const content = await readFile(path);
  if (content.length < 100) throw new Error(`Approval screenshot is unexpectedly small: ${expectedScreen.project}/${expectedScreen.name}`);
  screens.push({
    ...expectedScreen,
    path: `screens/${expectedScreen.project}/${expectedScreen.name}`,
    bytes: content.length,
    sha256: createHash("sha256").update(content).digest("hex")
  });
}

const manifest = {
  schema_version: 1,
  expected_count: expected.length,
  nominal_count: APPROVAL_PROJECTS.length * APPROVAL_VIEW_NAMES.length,
  zoom_200_count: APPROVAL_ZOOM_PROJECTS.length * APPROVAL_ZOOM_VIEW_NAMES.length,
  projects: APPROVAL_PROJECTS,
  screens
};

await mkdir(outputRoot, { recursive: true });
await writeFile(resolve(outputRoot, "approval-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Verified ${manifest.nominal_count} nominal and ${manifest.zoom_200_count} representative 200% zoom approval screenshots.`);
