# Family Dashboard Manager core

This package is the testable core used by the Family Dashboard Manager Home Assistant app.

Version 0.5.3 provides:

- a secret-rejecting schema-v5 household contract;
- one generated Home Assistant panel containing the bundled `custom:family-hub-card`;
- internal Today, Calendar, Rooms, Family, Music and Football navigation sized for `1112×834` and regression-tested at `1024×768`;
- a two-floor floorplan engine that can use a private 3D vector dollhouse or a read-only Home Assistant vacuum-map camera, with cache-safe asset revisions, subtle polygon room hotspots, state-coloured/brightness-aware light overlays and selected-room read-only room status;
- a first-party seven-day agenda backed by Home Assistant's calendar API, plus an optional native Map card kept inside the Home Assistant frontend;
- named ChoreOps routines from explicitly mapped individual status sensors and read-only Classroom assignment summaries for configured children;
- the configured Mediocre Spotify/Sonos card rendered accurately and kept scrollable while its Home Assistant write boundary is blocked during read-only qualification;
- a server-side, last-good-cache Fantasy Premier League provider covering all 38 matchweeks, scorers and a calculated table, with Tottenham and Aston Villa spotlights;
- a fixed allow-list deployment for the card and public example assets that preserves private household floorplan files;
- raw, hash-verified rollback compatible with the existing schema-v3 release;
- a sanitised inventory contract excluding cameras, people, location trackers, states, history, addresses, tokens, credentials and arbitrary attributes;
- a localhost-only MCP server with nine bounded tools;
- 10.5-inch iPad Today and Rooms SVG previews plus Chromium/WebKit browser projects.

Doorbell/security camera and garage surfaces are rejected by v0.5 validation. A map-named vacuum camera is accepted only as a read-only floorplan image and provides no vacuum controls. Google Classroom remains at the authorization-proof boundary: no password or OAuth token belongs in the household configuration.

## Local check

```bash
npm ci
npm run check
npm run test:browser
```

The browser suite requires Playwright Chromium and WebKit. CI installs both automatically. The generic example outputs are deterministic and contain synthetic names, entities, fixtures and house geometry only.

See `docs/architecture.md` and `docs/manager-contract.md` for the deployment and access model.
