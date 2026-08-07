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

if (!server.includes(`version: "${packageVersion}"`)) {
  failures.push(`server.mjs does not report release version ${packageVersion}`);
}

if (failures.length) {
  console.error("Home Assistant app runtime check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Home Assistant app runtime check passed for v${packageVersion}.`);
}
