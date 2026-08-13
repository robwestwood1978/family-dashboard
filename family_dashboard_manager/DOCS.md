# Family Dashboard Manager

Version 0.7.3 upgrades the existing Family Dashboard Manager in place. It retains the same Home Assistant app slug, published image, configuration directory, frontend directory, dashboard path and Secure MCP Tunnel. Do not install a second app or create another tunnel.

The accepted schema-v6 dashboard can now run in controlled live mode. First-party actions are restricted to exact validated household entities and fixed services. The configured Sonos/Music Assistant card receives a separate bounded media proxy. Calendar, Classroom, camera presentation cards and the vacuum map remain read-only, while every alarm and garage change still asks for a second confirmation.

## Upgrade the existing manager

This release requires Home Assistant OS 2026.8.0 or newer.

1. Create a Home Assistant backup.
2. Refresh the existing `https://github.com/robwestwood1978/family-dashboard` app repository.
3. Update the installed **Family Dashboard Manager** to v0.7.3; do not uninstall it.
4. Keep the existing Secure MCP Tunnel options unchanged and restart the app.
5. Confirm the manager reconnects through the existing tunnel and reports v0.7.3.

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
/local/family-dashboard/family-hub-card.js?v=0.7.3
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

## Controlled live deployment

The schema-v6 household configuration retains the existing panel path and explicitly opts into live mode:

```json
{
  "schema_version": 6,
  "display": {
    "panel_path": "family-dashboard",
    "read_only": false
  }
}
```

Run `validate_household_config` first. Validation is read-only and returns the exact configuration hash required by `deploy_household_config` with `confirm=true`. Deployment writes only the existing Family Dashboard configuration and fixed frontend allow-list after creating a raw, hash-verified snapshot. Private floorplans are preserved separately.

Call `reload_dashboard` after deployment, refresh the existing Lovelace resource query to v0.7.3, then reload the tablet. To lock every control again without changing schema, redeploy with `display.read_only: true`.

## Live action boundary

- Lights, scenes, heating, blinds and vacuum actions accept only entities listed in validated room/cleaning mappings and fixed service names.
- Music permits playback, volume, grouping, browsing, search and queue operations only for configured primary and Music Assistant player entities.
- Alarm actions accept only the configured alarm entity and the three presented arm-home, arm-away and disarm services. Unavailable entities and unsupported arm modes remain disabled, and confirmation expires if the alarm state changes.
- Garage actions accept only the configured garage cover, require its advertised open/close feature, and still require confirmation. A moving or unavailable garage never offers an enabled action, and confirmation expires if its state changes.
- Camera start/stop requires an exact configured Start/Stop pair belonging to an explicitly configured, available exterior camera. When both Eufy diagnostic buttons are present in Home Assistant, that exact pair is used; when either mapped button is missing or unavailable at runtime, the dashboard may use only the paired `camera.turn_on`/`camera.turn_off` services for that same configured exterior camera. An unpaired configuration still fails closed. An idle camera starts once and waits for Home Assistant to report `streaming`; an already-streaming camera is adopted without another Start command. Switching waits for the previous Stop, and failed or ended sessions evict their player. A signals-only or unavailable camera causes no camera write.
- Calendar event management and Classroom remain read-only. Embedded camera views and the vacuum map receive a read-only Home Assistant proxy.
- Exterior-camera validation continues to reject child, nursery and bedroom hints. Sanitised inventory still omits all camera entities.

## Physical acceptance

On the target iPad, confirm:

- the existing Family Dashboard and stock Home Assistant Overview both remain available;
- the dashboard shows **Controlled live** and has no horizontal overflow at the supported landscape size;
- Calendar switches among Day, Week, Month and Agenda and offers no event creation or editing;
- both private floors retain the accepted Hall-to-Hall U-return stair and no stair enters Bedroom 4;
- each mapped light, scene, heating zone, blind and vacuum action controls only its labelled device;
- Sonos playback, volume and grouping operate only across the five configured zones;
- Security exposes no child or bedroom camera, opens no stream automatically, and asks for confirmation before every alarm or garage change;
- Classroom stays at the per-child read-only consent boundary and location remains disabled unless separately opted in.

Test alarm and garage actions deliberately with an adult present. Home Assistant permissions and any configured alarm PIN remain authoritative; no PIN belongs in dashboard configuration.

## Safety and rollback

- Asset and configuration deployment each require `confirm=true` plus the exact hash returned by validation.
- The manager retains the existing app slug, paths, published image identity and tunnel.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
- Rollback verifies raw snapshot hashes and can restore the accepted v0.6 configuration without reinterpreting it as a newer schema.
- Sanitised inventory excludes camera entities, people, trackers, states, history, addresses, credentials and arbitrary attributes.

## Google Classroom and football

Classroom stays disabled until each child completes Google's own read-only authorization flow. No child password or OAuth token may be written to household configuration, generated YAML, snapshots or logs.

The browser does not call Fantasy Premier League directly. The manager provides a server-side, last-good-cache feed covering all 38 Premier League matchweeks with Tottenham and Aston Villa spotlights.
