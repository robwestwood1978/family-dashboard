# Family Dashboard Manager

Version 0.6 upgrades the existing Family Dashboard Manager in place. It retains the same Home Assistant app slug, published image, configuration directory, frontend directory, dashboard path and Secure MCP Tunnel. Do not install a second app or create another tunnel.

The v0.6 package remains a read-only qualification build. It renders the richer Home, Calendar, Security and Cleaning surfaces with real states, while Home Assistant write calls stay blocked until physical-iPad and household-action approval.

## Upgrade the existing manager

This release requires Home Assistant OS 2026.8.0 or newer.

1. Create a Home Assistant backup.
2. Refresh the existing `https://github.com/robwestwood1978/family-dashboard` app repository.
3. Update the installed **Family Dashboard Manager** to v0.6.0; do not uninstall it.
4. Keep the existing Secure MCP Tunnel options unchanged and restart the app.
5. Confirm the manager reconnects through the existing tunnel and reports v0.6.0.

The app exposes no host port. Its manager endpoint remains on the private loopback interface inside the same app container.

## Existing Home Assistant registration

Keep the existing dashboard entry and path:

```yaml
lovelace:
  mode: storage
  dashboards:
    family-dashboard:
      mode: yaml
      title: Family Dashboard
      icon: mdi:home-heart
      show_in_sidebar: true
      filename: family-dashboard/dashboard.yaml
```

Keep the existing Lovelace JavaScript module identity and refresh its version query after deployment:

```text
/local/family-dashboard/family-hub-card.js?v=0.6.0
```

The stock Home Assistant Overview remains available to administrators.

## Private floorplans

The manager accepts exactly `ground-floor.svg` and `first-floor.svg`. Each must be a complete inert SVG no larger than 512 KiB. An embedded base64 PNG is allowed; active content, external references and other filenames are rejected. Private assets are not committed to this repository or included in rollback snapshots.

The confirmation-bound transfer is:

1. Call `validate_floorplan_assets` with both files.
2. Check their names, sizes, SHA-256 hashes and returned `asset_set_hash`.
3. Call `deploy_floorplan_assets` with `confirm=true` and that exact asset-set hash.
4. Reference only `/local/family-dashboard/private/ground-floor.svg` and `/local/family-dashboard/private/first-floor.svg` in household configuration.

The files are written only below `/config/www/family-dashboard/private/`.

## Read-only v0.6 deployment

The schema-v6 household configuration must retain the existing panel path and explicitly enable read-only mode:

```json
{
  "schema_version": 6,
  "display": {
    "panel_path": "family-dashboard",
    "read_only": true
  }
}
```

Run `validate_household_config` first. Validation is read-only and returns the exact configuration hash required by `deploy_household_config` with `confirm=true`. Deployment writes only the existing Family Dashboard configuration and fixed frontend allow-list after creating a raw, hash-verified snapshot. Private floorplans are preserved separately.

Call `reload_dashboard` after deployment, then refresh the existing Lovelace resource and tablet.

## Physical qualification

Verify on the target iPad that:

- the existing Family Dashboard and stock Home Assistant Overview both remain available;
- the dashboard shows a **Read-only test** badge;
- Today, Calendar, Home, Family, Security, Music and Football have no horizontal overflow;
- Calendar switches among Day, Week, Month and Agenda, persists hidden calendars, and offers no event creation or editing;
- Home switches among Rooms, Lights, Heating, Blinds & doors and Cleaning;
- both private 3D floors retain the approved geometry, including a U-return stair from Hall to Hall and no stair in Bedroom 4;
- every room hotspot aligns with its visible room;
- Family shows each child's configured ChoreOps routines and no location map unless separately opted in;
- Security shows only exterior signals, opens no stream without **View live**, and exposes no child or bedroom camera;
- alarm and garage actions require confirmation, while read-only mode prevents the service call;
- Music remains contained and scrollable, Football shows provider data or an intentional waiting state, and Classroom remains at the per-child consent boundary;
- light, climate, cover, scene, media, vacuum, camera-button, alarm and garage actions produce no Home Assistant write service calls.

Do not clear `display.read_only` until the target iPad, the exact exterior camera entities and each household action have been separately approved.

## Safety boundary

- Asset and configuration deployment each require `confirm=true` plus the exact hash returned by validation.
- The manager retains the existing app slug, paths, published image identity and tunnel.
- Sanitised inventory excludes camera entities, people, trackers, states, history, addresses, credentials and arbitrary attributes.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
- Rollback verifies raw snapshot hashes and can restore an older installed schema without reinterpreting it as schema v6.

## Google Classroom and football

Classroom stays disabled until each child completes Google's own read-only authorization flow. No child password or OAuth token may be written to household configuration, generated YAML, snapshots or logs.

The browser does not call Fantasy Premier League directly. The manager provides a server-side, last-good-cache feed covering all 38 Premier League matchweeks with Tottenham and Aston Villa spotlights.
