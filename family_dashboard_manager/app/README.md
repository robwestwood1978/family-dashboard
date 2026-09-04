# Family Dashboard Manager core

This package is the testable core used by the Family Dashboard Manager Home Assistant app.

Version 0.9.0 provides:

- a secret-rejecting schema-v6 household contract;
- one generated Home Assistant panel containing the bundled `custom:family-hub-card`;
- eight internal tablet surfaces: Today, Calendar, Home, Family, Security, Music, Energy and Football;
- Home sections for Rooms, Lights, Heating, Blinds & doors and Cleaning, backed only by explicitly configured entities, with an optional preferred starting room;
- optional electricity and gas smart-meter summaries for honest today-so-far usage, cost, tariff and freshness presentation; no live-power value is inferred;
- a two-floor 3D floorplan engine with private inert SVG assets, percentage-coordinate hotspots, cache-safe revisions and selected-room controls;
- an installed Daylight or legacy Skylight calendar child card with Day, Week, Month and Agenda modes, persistent calendar visibility preferences and event management disabled;
- immediate authenticated stills for doorbell, driveway and garden cameras, with the image itself opening a single native Home Assistant live camera card; **Live** requires a ready video frame, stalls return to loading, sessions expire after two minutes, teardown is enforced on close/switch/navigation/backgrounding, and bounded recovery never disguises a failed stream;
- Eufy vacuum status and bounded controls, while authenticated map images remain inside Home Assistant;
- named ChoreOps jobs, one optional featured reward, badge and achievement summary per child, an optional live-mode link to the native ChoreOps dashboard, plus a first-party per-child Google Classroom integration with exactly two read-only scopes, a 15-minute coordinator and no more than 20 assignment attributes;
- the configured Mediocre Spotify/Sonos card and an adaptive, last-good-cache Fantasy Premier League provider with live freshness, provisional full-time handling, Home Assistant Core restart recovery at the next three-, 15- or 60-minute polling boundary, fixed-origin club crests, and Tottenham and Aston Villa spotlights;
- fixed allow-list deployment, inert private floorplan validation and raw hash-verified rollback compatible with older installed schemas;
- sanitised inventory that excludes camera entities, people, trackers, states, history, addresses, credentials and arbitrary attributes;
- deterministic `1112×834` and `1024×768` tablet checks.

The packaged release permits `display.read_only: false` and derives every first-party write from the validated household mapping. The facade supplied to the embedded music card accepts only documented media, Music Assistant and queue operations on configured players. Calendar and Classroom stay read-only, while camera/map child facades provide no write methods and garage/alarm changes remain confirmation-gated. Home Assistant child cards run in the same page and are not sandboxed, so only trusted administrator-installed cards are supported. Setting `display.read_only: true` still locks the entire tablet for rollback or diagnostics.

## Local check

```bash
npm ci
npm run check
npm run test:browser
```

The browser suite requires Playwright Chromium and WebKit. CI installs both automatically. The generic example outputs contain synthetic names, entities, fixtures and house geometry only.

See `docs/architecture.md` and `docs/manager-contract.md` for the deployment and access model.
