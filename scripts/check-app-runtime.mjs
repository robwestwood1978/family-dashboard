import { readFile, stat } from "node:fs/promises";

const appRoot = "family_dashboard_manager";
const paths = {
  appArmor: `${appRoot}/apparmor.txt`,
  config: `${appRoot}/config.yaml`,
  dockerfile: `${appRoot}/Dockerfile`,
  package: `${appRoot}/app/package.json`,
  server: `${appRoot}/app/src/server.mjs`,
  managerRun: `${appRoot}/rootfs/etc/services.d/family-dashboard-manager/run`,
  tunnelRun: `${appRoot}/rootfs/etc/services.d/family-dashboard-tunnel/run`
};

const [appArmor, config, dockerfile, packageJson, server] = await Promise.all([
  readFile(paths.appArmor, "utf8"),
  readFile(paths.config, "utf8"),
  readFile(paths.dockerfile, "utf8"),
  readFile(paths.package, "utf8"),
  readFile(paths.server, "utf8")
]);

const failures = [];
const requiredProfileRules = [
  /\/init\s+rix,/,
  /\/run\/\{s6,s6-rc\*,service\}\/\*\*\s+rix,/,
  /\/etc\/services\.d\/\*\*\s+rwix,/,
  /\/etc\/cont-init\.d\/\*\*\s+rwix,/,
  /\/etc\/cont-finish\.d\/\*\*\s+rwix,/
];

for (const rule of requiredProfileRules) {
  if (!rule.test(appArmor)) failures.push(`AppArmor is missing required startup rule ${rule}`);
}
if (!/^profile family_dashboard_preview\b/m.test(appArmor)) {
  failures.push("AppArmor profile does not match the isolated preview app slug");
}
if (!/\/config\/www\/family-dashboard-v040-preview\/\*\*\s+rwk,/.test(appArmor)) {
  failures.push("AppArmor is missing the isolated preview frontend write rule");
}

for (const runScript of [paths.managerRun, paths.tunnelRun]) {
  const [contents, metadata] = await Promise.all([readFile(runScript, "utf8"), stat(runScript)]);
  if (!contents.startsWith("#!/usr/bin/with-contenv bashio\n")) {
    failures.push(`${runScript} does not use the Home Assistant bashio shebang`);
  }
  if ((metadata.mode & 0o111) === 0) failures.push(`${runScript} is not executable`);
}

const packageVersion = JSON.parse(packageJson).version;
const configVersion = config.match(/^version:\s*["']?([^"'\n]+)["']?$/m)?.[1];
const dockerVersion = dockerfile.match(/^ENV APP_VERSION=([^\s\\]+)\s*\\$/m)?.[1];

for (const [source, version] of [
  ["config.yaml", configVersion],
  ["Dockerfile", dockerVersion]
]) {
  if (version !== packageVersion) {
    failures.push(`${source} version ${version ?? "missing"} does not match package version ${packageVersion}`);
  }
}

if (!server.includes(`const APP_VERSION = process.env.APP_VERSION || "${packageVersion}"`)) {
  failures.push(`server.mjs does not report release version ${packageVersion}`);
}
if (!dockerfile.includes("MANAGER_CONFIG_DIR=/config/family-dashboard-v040-preview")) {
  failures.push("Dockerfile does not isolate the preview configuration directory");
}
if (!dockerfile.includes("MANAGER_RESOURCE_DIR=/config/www/family-dashboard-v040-preview")) {
  failures.push("Dockerfile does not isolate the preview frontend directory");
}
if (!dockerfile.includes("MANAGER_REQUIRE_READ_ONLY=true")) {
  failures.push("Dockerfile does not enforce read-only configuration for the preview manager");
}
for (const label of ["io.hass.version", "io.hass.type", "io.hass.arch"]) {
  if (!dockerfile.includes(label)) failures.push(`Dockerfile is missing required local-build label ${label}`);
}
if (/^image:/m.test(config)) {
  failures.push("Canary preview must build locally from its branch instead of publishing a production image");
}
if (!dockerfile.includes("COPY app/frontend ./frontend")) {
  failures.push("Dockerfile does not package the first-party Family Hub frontend");
}
if (!dockerfile.includes("COPY app/config ./config")) {
  failures.push("Dockerfile does not package the schema-v4 runtime validator");
}

if (failures.length) {
  console.error("Home Assistant app runtime check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Home Assistant app runtime check passed for v${packageVersion}.`);
}
