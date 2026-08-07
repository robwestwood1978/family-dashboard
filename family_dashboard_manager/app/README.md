# Family Dashboard Manager core

This package is the testable core used by the Family Dashboard Manager Home Assistant app. It deliberately does not inherit the old Vercel/Render application architecture.

The v0.2 core provides:

- a versioned, machine-validated household configuration;
- an explicit ban on secret-bearing keys in configuration;
- a deterministic compiler that generates a separate Home Assistant YAML dashboard;
- Today, Calendar, Home, Music, Chores, Football, and optional School views;
- Daylight Calendar Card (formerly Skylight Calendar Card) for Apple/iCloud calendars exposed through CalDAV;
- Mediocre Multi Media Player Card for Music Assistant and Sonos;
- a landscape presentation theme with non-admin kiosk mode, persistent touch navigation and an administrator escape route;
- native weather, to-do, light, heating and cover controls plus Team Tracker football cards;
- the ChoreOps `legacy-lite` profile, built from Auto-Entities and native tile actions for conservative tablet compatibility;
- an explicit legacy-iOS mode that suppresses card animation and transitions;
- a deterministic 1024 by 768 SVG preview that is regression-tested alongside the generated YAML;
- a sanitised Home Assistant inventory contract that excludes cameras, people, location trackers, states, history, addresses, tokens, credentials, and arbitrary attributes;
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
