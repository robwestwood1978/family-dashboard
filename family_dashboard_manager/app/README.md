# Family Dashboard Manager core

This package is the testable core used by the Family Dashboard Manager Home Assistant app. It deliberately does not inherit the old Vercel/Render application architecture.

The v0.3 core provides:

- a versioned, machine-validated household configuration;
- an explicit ban on secret-bearing keys in configuration;
- a deterministic compiler that generates a separate Home Assistant YAML dashboard;
- Today, Calendar, Home, Music, Chores, Football, and optional School views;
- Daylight Calendar Card (formerly Skylight Calendar Card) for Apple/iCloud calendars exposed through CalDAV;
- Mediocre Multi Media Player Card for Music Assistant and Sonos;
- a warm-glass landscape presentation with non-admin kiosk mode, a slim persistent touch rail and an administrator escape route;
- focused Lighting, Heating and Cameras & Entry subviews, including one live camera at a time and confirmed press-and-hold garage movement;
- native weather, to-do, light, heating and cover controls plus Team Tracker football cards;
- the ChoreOps `legacy-lite` profile, built from Auto-Entities and native tile actions for conservative tablet compatibility;
- an explicit legacy-iOS mode that suppresses card animation and transitions;
- deterministic 1024 by 768 Today and Controls SVG previews that are regression-tested alongside the generated YAML;
- a sanitised Home Assistant inventory contract that excludes camera entities/images/streams, people, location trackers, states, history, addresses, tokens, credentials, and arbitrary attributes;
- a localhost-only MCP server with eight bounded tools;
- confirmation and hash-bound deploy/rollback operations with atomic activation and bounded snapshots.

## Local check

```bash
npm ci
npm run check
```

The generic example configuration compiles to `generated/example-dashboard.yaml` and `preview/family-dashboard-preview.svg`. Both outputs are deterministic and contain synthetic names and events only.

## Repository boundary

- Generic compiler, manager app, schemas, tests, and documentation live in a public Home Assistant app repository.
- Household configuration lives only in the private `family-calendar` repository.
- Credentials and tokens live only in Home Assistant/OpenAI runtime secret stores and are never accepted by this schema.

See `docs/architecture.md` and `docs/manager-contract.md` for the deployment and access model.
