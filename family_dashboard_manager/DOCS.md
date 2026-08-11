# Family Dashboard v0.4 Private Preview

This canary app installs beside the existing Family Dashboard. It uses a distinct Home Assistant app slug, configuration directory, frontend directory, dashboard path and Lovelace resource URL. It does not replace or migrate the existing dashboard.

The preview is intentionally read-only. Room, scene, climate, cover, light and media controls are disabled; entity detail dialogs and the full media-player card are also withheld. Doorbell/security feeds, garage actions, location mapping, Google Classroom and vacuum controls remain disabled for this qualification phase.

## Install the canary app

This branch requires Home Assistant OS 2026.8.0 or newer.

1. Add this exact repository URL in **Settings → Apps → App store → Repositories**:

   ```text
   https://github.com/robwestwood1978/family-dashboard#preview/v0.4.0-private-path
   ```

2. Install **Family Dashboard v0.4 Preview Manager**. Its slug is `family_dashboard_preview`, so it is separate from the existing manager.
3. Leave **Secure MCP Tunnel** disabled for the first start.
4. Start the app and confirm its log says the manager is listening on `127.0.0.1:8099`.

The app has no host port. If remote manager access is needed, create a separate Secure MCP Tunnel connection for this preview instance. Keep its API key only in Home Assistant app options; never copy an existing app's secret or put a key in household configuration.

## Register the separate dashboard

Keep Home Assistant in storage mode and add this second YAML dashboard entry to `configuration.yaml` without changing the existing `family-dashboard` entry:

```yaml
lovelace:
  mode: storage
  dashboards:
    family-dashboard-v040-preview:
      mode: yaml
      title: Family Dashboard v0.4 Preview
      icon: mdi:home-search-outline
      show_in_sidebar: true
      filename: family-dashboard-v040-preview/dashboard.yaml
```

Restart Home Assistant after changing `configuration.yaml`. Then add this JavaScript module in **Settings → Dashboards → Resources**:

```text
/local/family-dashboard-v040-preview/family-hub-card.js?v=0.4.0
```

Select **JavaScript module** as the resource type. The existing `/local/family-dashboard/...` resource remains unchanged.

## Deploy the private preview package

The manager accepts only two private SVG filenames:

- `ground-floor.svg`
- `first-floor.svg`

Each file must be a complete, inert SVG no larger than 512 KiB. Active content, external references and unapproved filenames are rejected. The workflow is deliberately confirmation-bound:

1. Call `validate_floorplan_assets` with both files.
2. Check the returned filenames, sizes, individual SHA-256 hashes and `asset_set_hash`.
3. Call `deploy_floorplan_assets` with `confirm=true` and that exact asset-set hash.
4. Call `validate_household_config` with a schema-v4 configuration that sets:

   ```json
   {
     "display": {
       "panel_path": "family-dashboard-v040-preview",
       "read_only": true
     }
   }
   ```

5. Confirm its exact configuration hash with `deploy_household_config`.
6. Call `reload_dashboard` to verify the generated files and return the bounded resource-refresh instruction.

The private plans are written only below `/config/www/family-dashboard-v040-preview/private/`. The configuration and generated dashboard are written only below `/config/family-dashboard-v040-preview/`.

## Qualification checks

Before approving live controls, verify all of the following on the target tablet:

- both the existing dashboard and the v0.4 preview remain available;
- the stock Home Assistant Overview remains available to administrators;
- the preview shows a **Read-only preview** badge;
- Today, Calendar, Rooms, Family, Music and Football render without horizontal overflow at `1112×834` and `1024×768` landscape sizes;
- both private floors and all approved room hotspots align correctly;
- forced taps on light, scene, climate, cover and media controls produce no Home Assistant service calls;
- Music shows the static preview summary rather than mounting the full player;
- no camera, entry, location or Classroom surface is enabled.

Live device actions require a separate approval and release change. Do not clear `display.read_only` during this private preview.

## Safety boundary

- Validation never writes live files.
- Asset and configuration deployment each require `confirm=true` plus the exact hash from the corresponding validation call.
- The canary writes only its isolated configuration and frontend directories plus its private `/data` directory.
- The existing v0.3 paths are absent from the canary AppArmor write policy.
- The public branch contains no household floorplans, names, entity mappings, credentials or location data.
- Inventory excludes cameras, people, trackers, states, history, addresses, credentials and arbitrary attributes.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.

Rollback snapshots are local to the preview manager and cannot overwrite the existing dashboard.
