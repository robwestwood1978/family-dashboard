# Family Dashboard Manager

Version 0.4 upgrades the existing Family Dashboard Manager in place. It keeps the same Home Assistant app slug, published image, configuration directory, frontend directory, dashboard path and Secure MCP Tunnel. Do not install a second app, add a branch repository or create another tunnel.

The first v0.4 household deployment is intentionally read-only. Room, scene, climate, cover, light and media controls are disabled; entity detail dialogs and the full media-player card are withheld. Doorbell/security feeds, garage actions, location mapping, Google Classroom and vacuum controls remain disabled during qualification.

## Upgrade the existing manager

This release requires Home Assistant OS 2026.8.0 or newer.

1. Create a Home Assistant backup.
2. Refresh the existing `https://github.com/robwestwood1978/family-dashboard` app repository.
3. Update the installed **Family Dashboard Manager** to v0.4.1. Do not uninstall it.
4. Keep its existing Secure MCP Tunnel options unchanged and restart the app.
5. Confirm the manager reconnects through the existing tunnel and reports v0.4.1.

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
/local/family-dashboard/family-hub-card.js?v=0.4.1
```

The stock Home Assistant Overview remains available to administrators.

## Private floorplans

The manager accepts exactly two private SVG filenames:

- `ground-floor.svg`
- `first-floor.svg`

Each file must be a complete, inert SVG no larger than 512 KiB. Active content, external references and unapproved filenames are rejected. The plans are never committed to the public repository or included in rollback snapshots.

The confirmation-bound transfer is:

1. Call `validate_floorplan_assets` with both files.
2. Check the returned filenames, sizes, individual SHA-256 hashes and `asset_set_hash`.
3. Call `deploy_floorplan_assets` with `confirm=true` and that exact asset-set hash.
4. Reference only these private URLs in the household configuration:

   ```text
   /local/family-dashboard/private/ground-floor.svg
   /local/family-dashboard/private/first-floor.svg
   ```

The files are written only below `/config/www/family-dashboard/private/`.

## Read-only v0.4 deployment

The schema-v4 household configuration must retain the existing dashboard path and explicitly enable read-only mode:

```json
{
  "display": {
    "panel_path": "family-dashboard",
    "read_only": true
  }
}
```

Run `validate_household_config` first. Validation is read-only and returns the exact configuration hash required by `deploy_household_config` with `confirm=true`.

Deployment writes only the existing Family Dashboard configuration and fixed frontend allow-list. Before replacing those files, the manager creates a raw, hash-verified snapshot of the installed v0.3 configuration, dashboard and managed frontend. Private floorplans remain outside snapshots and are preserved.

Call `reload_dashboard` after deployment, then refresh the existing Lovelace resource and tablet.

## Physical qualification

Verify on the target iPad that:

- the Family Dashboard opens at its existing sidebar entry;
- the stock Home Assistant Overview remains available;
- the dashboard shows a **Read-only test** badge;
- Today, Calendar, Rooms, Family, Music and Football render without horizontal overflow;
- both private floors and all approved room hotspots align correctly;
- taps on light, scene, climate, cover and media controls produce no Home Assistant service calls;
- Music shows its non-interactive status surface;
- no camera, entry, location, Classroom or vacuum control is enabled.

Live device actions require a later qualified release. Do not clear `display.read_only` in v0.4.x.

## Safety boundary

- Asset and configuration deployment each require `confirm=true` plus the exact hash returned by validation.
- The manager retains the existing `family_dashboard_manager` slug, `/config/family-dashboard` configuration directory, `/config/www/family-dashboard` frontend directory and published image identity.
- Inventory excludes cameras, people, trackers, states, history, addresses, credentials and arbitrary attributes.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
- Rollback verifies raw snapshot hashes and can restore the already-installed schema-v3 release without reinterpreting it as schema v4.

## Google Classroom and football

The Classroom adapter stays disabled until each child completes Google's own read-only authorization flow. No child password or OAuth token may be written to household configuration, generated YAML, snapshots or logs.

The browser does not call Fantasy Premier League directly. The manager provides a server-side, last-good-cache feed covering all 38 Premier League matchweeks with Tottenham and Aston Villa spotlights.
