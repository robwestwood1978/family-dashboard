# Family Dashboard Manager

The manager owns the dedicated Family Dashboard configuration, generated YAML panel, first-party frontend card and bounded rollback snapshots. Version 0.4 targets a 10.5-inch iPad Pro in landscape (`1112×834` CSS pixels) and keeps `1024×768` as the fallback regression size.

## Before installation

This release requires Home Assistant OS 2026.8.0 or newer. The v0.4 Family Hub uses:

- the bundled `custom:family-hub-card` for the shell, navigation, floorplan, room controls, family summaries and Premier League presentation;
- native Home Assistant Calendar and Map cards;
- Mediocre Multi Media Player Card when Music is enabled;
- kiosk-mode when non-admin kiosk chrome is requested;
- existing Home Assistant calendar, weather, person, light, climate, cover, scene, media-player and ChoreOps sensor entities selected in the private household configuration.

Doorbell/security camera feeds and garage actions are deliberately disabled in v0.4. A map-named vacuum camera may be used only as a read-only Rooms floorplan source; its image stays inside the authenticated Home Assistant frontend. Calendar presentation and Classroom assignment presentation are read-only. The card does not send household locations, vacuum-map imagery or Google credentials to its football source.

## Install

1. Add `https://github.com/robwestwood1978/family-dashboard` as a Home Assistant app repository.
2. Install **Family Dashboard Manager**.
3. Leave **Secure MCP Tunnel** disabled for the first start.
4. Start the app and confirm its log reports that the manager is listening on its private loopback interface.

The app exposes no host port. Its MCP endpoint is reachable only inside its own container by the optional tunnel service.

## One-time Home Assistant registration

Keep Home Assistant in storage mode and add this one YAML dashboard entry to `configuration.yaml`:

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

Because Lovelace resources are stored by Home Assistant, register this JavaScript module once in **Settings → Dashboards → Resources**:

```text
/local/family-dashboard/family-hub-card.js?v=0.4.0
```

Select **JavaScript module** as the resource type. Administrators retain normal Home Assistant chrome as the parent escape; kiosk-mode applies only to the non-admin tablet profile.

## Private schema-v4 configuration

The private `household.json` supplies only non-secret mappings and presentation choices. In particular:

- each floor supplies either `base_image`, pointing to a private plan below `/config/www/family-dashboard/assets/`, or an explicitly approved `vacuum_map_entity` such as `camera.robovac_map`; when both are present, the private image is the fallback;
- the vacuum-map image is read through Home Assistant's authenticated `entity_picture` URL and is never copied into Git, manager storage, snapshots, logs or ChatGPT;
- each floor declares the source plan's natural `aspect_ratio`; every room has a polygon hotspot expressed as 0–100 percentage coordinates and a matching `floor_id`;
- optional light overlays use transparent images whose opacity follows live light brightness;
- `location.entities` accepts only explicitly opted-in `person.*` entities;
- the football contract publishes all 38 Premier League matchweeks and marks `TOT` and `AVL` as spotlight clubs;
- each child-owned Classroom authorization eventually publishes a read-only assignment sensor named in `school.classroom_students`.

The tracked example floorplans are synthetic. Do not deploy them as a representation of the real house. For the Eufy Clean X10 Pro Omni, use the integration's map camera as the private source and calibrate the percentage-coordinate room hotspots against that image. A separate private static plan remains supported for floors the vacuum has not mapped.

Run `validate_household_config` before deployment. Validation is read-only and returns the exact configuration hash required for a separately confirmed deploy.

## Google Classroom authorization proof

Call `get_classroom_authorization_plan` to inspect the proof contract. Each child signs in through Google's own consent screen using their own Classroom login. The design requests only these read-only scopes:

- `classroom.courses.readonly`
- `classroom.coursework.me.readonly`
- `classroom.student-submissions.me.readonly`

No child password is collected. OAuth codes and tokens must never be written to `household.json`, generated YAML, snapshots or logs. The live adapter stays disabled until this per-child authorization flow has been proven separately.

## Football provider

The browser does not call Fantasy Premier League directly. The manager fetches the public FPL bootstrap and fixtures feeds server-side, normalises fixtures/results/scorers and a calculated table, then publishes bounded Home Assistant sensor attributes. A last-good cache is stored in the app's private `/data` directory. If the source is temporarily unavailable, the dashboard retains cached data instead of failing the card.

## Secure MCP Tunnel

The tunnel is optional and disabled by default. Its runtime key is stored only in Home Assistant app options and passed to `tunnel-client` through its process environment. It is never accepted in household configuration, written to Git, returned by a manager tool or printed by the start script.

## Safety boundary

- Validation never writes live files.
- Deployment requires `confirm=true` plus the exact validated hash.
- The manager writes only `/config/family-dashboard`, its fixed frontend allow-list under `/config/www/family-dashboard`, and its private `/data` directory.
- Unknown household floorplan assets are preserved.
- Rollback verifies raw snapshot hashes and can restore the already-installed schema-v3 release without trying to reinterpret it as schema v4.
- Inventory excludes cameras, people, trackers, states, history, addresses, credentials and arbitrary attributes. An explicitly configured vacuum map is rendered only by the authenticated Home Assistant frontend and is never returned by manager tools.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
