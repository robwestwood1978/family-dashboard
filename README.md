# Family Dashboard

Family Dashboard is a Home Assistant-native family display for calendars, room controls, music, chores, football and school information. It is designed for a landscape tablet and keeps household configuration separate from the public installation code.

![Generic 1112 by 834 Today view preview](./family_dashboard_manager/app/preview/family-dashboard-preview.svg)

![Generic 1112 by 834 interactive Rooms preview](./family_dashboard_manager/app/preview/family-dashboard-rooms-preview.svg)

The repository currently contains one experimental Home Assistant app:

## Family Dashboard Manager

The manager validates a non-secret household configuration, compiles a dedicated Home Assistant YAML panel, packages its first-party Family Hub card, creates rollback snapshots, and exposes a deliberately narrow MCP tool surface for managed deployments.

- Supports `aarch64` and `amd64` Home Assistant OS installations.
- Writes only `/config/family-dashboard`, a fixed frontend allow-list below `/config/www/family-dashboard`, and its own `/data` directory.
- Uses Home Assistant's internal API only for sanitised inventory and bounded Premier League state sensors.
- Does not expose a host port, general shell, arbitrary filesystem access or arbitrary service calls.
- Can run OpenAI Secure MCP Tunnel as an optional, disabled-by-default second service in the same app container.

[![Open your Home Assistant instance and show the app store with this repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_store.svg)](https://my.home-assistant.io/redirect/supervisor_store/?repository_url=https%3A%2F%2Fgithub.com%2Frobwestwood1978%2Ffamily-dashboard)

See [the app documentation](./family_dashboard_manager/DOCS.md) for installation and the one-time Home Assistant dashboard registration.

## Repository boundary

This public repository contains generic source, schemas, tests and release packaging only. Names, calendar IDs, room mappings, entity IDs and feature choices belong in a separate private configuration repository. Passwords, tokens and API keys belong only in Home Assistant app options or integration storage and are rejected by the household configuration validator.

HACS remains the installer for the optional Mediocre Multi Media Player Card and kiosk-mode dependencies. The Family Hub shell, house floorplan, room controls, family summaries and football presentation are bundled with the manager itself.

Version 0.4 adds an explicit two-floor interactive house plan, including a read-only Home Assistant vacuum-map source, keeps the geographic family map as a separate Home Assistant-native surface, covers all 38 Premier League matchweeks with Tottenham and Aston Villa spotlights, and defines a read-only per-child Google Classroom authorization proof. Doorbell/security feeds, garage actions and vacuum controls remain disabled until separately qualified.

## Development

```bash
cd family_dashboard_manager/app
npm ci
npm run check
```

The app is experimental until it has been installed and qualified against a real Home Assistant OS system.
