# Family Dashboard Manager core

This package is the testable core used by the Family Dashboard Manager Home Assistant app.

Version 0.7.2 provides:

- a secret-rejecting schema-v6 household contract;
- one generated Home Assistant panel containing the bundled `custom:family-hub-card`;
- seven internal tablet surfaces: Today, Calendar, Home, Family, Security, Music and Football;
- Home sections for Rooms, Lights, Heating, Blinds & doors and Cleaning, backed only by explicitly configured entities;
- a two-floor 3D floorplan engine with private inert SVG assets, percentage-coordinate hotspots, cache-safe revisions and selected-room controls;
- an installed Daylight or legacy Skylight calendar child card with Day, Week, Month and Agenda modes, persistent calendar visibility preferences and event management disabled;
- deliberate doorbell, driveway and garden camera presentation, signals-only camera support, child/bedroom camera rejection, and confirmation-gated alarm and garage actions;
- Eufy vacuum status and bounded controls, while authenticated map images remain inside Home Assistant;
- named ChoreOps routines and a separate per-child, read-only Google Classroom consent boundary;
- the configured Mediocre Spotify/Sonos card and a server-side, last-good-cache Fantasy Premier League provider with Tottenham and Aston Villa spotlights;
- fixed allow-list deployment, inert private floorplan validation and raw hash-verified rollback compatible with older installed schemas;
- sanitised inventory that excludes camera entities, people, trackers, states, history, addresses, credentials and arbitrary attributes;
- deterministic `1112×834` and `1024×768` tablet checks.

The packaged release permits `display.read_only: false` and derives every first-party write from the validated household mapping. The embedded music card is limited to documented media, Music Assistant and queue operations on configured players. Calendar and Classroom stay read-only, camera/map child cards cannot write, and garage/alarm changes remain confirmation-gated. Setting `display.read_only: true` still locks the entire tablet for rollback or diagnostics.

## Local check

```bash
npm ci
npm run check
npm run test:browser
```

The browser suite requires Playwright Chromium and WebKit. CI installs both automatically. The generic example outputs contain synthetic names, entities, fixtures and house geometry only.

See `docs/architecture.md` and `docs/manager-contract.md` for the deployment and access model.
