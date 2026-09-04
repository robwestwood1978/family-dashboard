# Family Dashboard

Family Dashboard is a Home Assistant-native family display for calendars, room controls, music, chores, football and school information. It is designed for a landscape tablet and keeps household configuration separate from the public installation code.

The release workflow renders the current v0.9 component at both supported iPad
sizes. The older synthetic SVGs in `app/preview` are retained only as deterministic
compiler fixtures; they are not current design previews.

The repository currently contains one experimental Home Assistant app:

## Family Dashboard Manager

The manager validates a non-secret household configuration, compiles a dedicated Home Assistant YAML panel, packages its first-party Family Hub card, creates rollback snapshots, and exposes a deliberately narrow MCP tool surface for managed deployments.

- Supports `aarch64` and `amd64` Home Assistant OS installations.
- Dashboard deployment writes only `/config/family-dashboard`, a fixed frontend allow-list below `/config/www/family-dashboard`, and the app's own `/data` directory. A separate confirmed Classroom installer may manage only `/config/custom_components/family_dashboard_classroom` through a hash-verified staged replacement with snapshot recovery.
- Uses Home Assistant's internal API only for sanitised inventory and bounded Premier League state sensors.
- Does not expose a host port, general shell, arbitrary filesystem access or arbitrary service calls.
- Can run OpenAI Secure MCP Tunnel as an optional, disabled-by-default second service in the same app container.

[![Open your Home Assistant instance and show the app store with this repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_store.svg)](https://my.home-assistant.io/redirect/supervisor_store/?repository_url=https%3A%2F%2Fgithub.com%2Frobwestwood1978%2Ffamily-dashboard)

See [the app documentation](./family_dashboard_manager/DOCS.md) for installation and the one-time Home Assistant dashboard registration.

## Repository boundary

This public repository contains generic source, schemas, tests and release packaging only. Names, calendar IDs, room mappings, entity IDs and feature choices belong in a separate private configuration repository. Passwords, tokens and API keys belong only in Home Assistant app options or integration storage and are rejected by the household configuration validator.

HACS remains the installer for the Daylight/legacy Skylight calendar, Mediocre Multi Media Player Card and kiosk-mode dependencies. The Family Hub shell, floorplan engine, Home controls, family summaries, Security boundary and football presentation are bundled with the manager itself; private household artwork stays outside this repository.

Version 0.9 turns the accepted schema-v6 tablet into a polished family operating surface. It keeps live controls on validated entity allow-lists, adds honest electricity/gas summaries, treats Tottenham and Aston Villa equally, uses ChoreOps as the source of truth for jobs and rewards, and opens exterior cameras through a still-first native Home Assistant live view. Alarm and garage changes still require a fresh second confirmation; Calendar and Classroom remain read-only, and no child or bedroom camera can enter Security.

## Development

```bash
cd family_dashboard_manager/app
npm ci
npm run check
```

The app is experimental until it has been installed and qualified against a real Home Assistant OS system.
