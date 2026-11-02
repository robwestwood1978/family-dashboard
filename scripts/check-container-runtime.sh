#!/usr/bin/env bash
set -euo pipefail

# Exercise the packaged Node/ICU runtime under the same policy used by HA OS.
# Host-side JavaScript tests cannot detect denied ICU data-file access.
command -v apparmor_parser >/dev/null
profile="family_dashboard_manager/apparmor.txt"
image="family-dashboard-runtime:ci"
version="$(node -p "require('./family_dashboard_manager/app/package.json').version")"

docker build --build-arg BUILD_ARCH=amd64 --build-arg BUILD_VERSION="$version" \
  --tag "$image" family_dashboard_manager
sudo apparmor_parser -r "$profile"
trap 'sudo apparmor_parser -R "$profile"' EXIT

docker run --rm --network none --read-only \
  --security-opt apparmor=family_dashboard_manager --entrypoint node "$image" \
  --input-type=module -e '
    import assert from "node:assert/strict";
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit"
    });
    const key = value => Object.fromEntries(formatter.formatToParts(new Date(value))
      .filter(part => part.type !== "literal").map(part => [part.type, part.value]));
    assert.deepEqual(key("2026-03-29T23:30:00Z"), { day: "30", month: "03", year: "2026" });
    assert.deepEqual(key("2026-10-25T23:30:00Z"), { day: "25", month: "10", year: "2026" });
    console.log("Packaged ICU date formatting passed under the production AppArmor policy.");
  '
