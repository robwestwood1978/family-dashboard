## 0.4.0

- Replace the multi-view third-party YAML tree with one bundled first-party Family Hub panel sized for the 10.5-inch iPad Pro (`1112×834`) and a `1024×768` fallback.
- Add a two-floor interactive room-plan engine with explicit polygon hotspots, light overlays and selected-room low-risk controls; never infer private house geometry.
- Separate the Home Assistant-native private family map from the house floorplan and add per-child ChoreOps/Classroom read-only summaries.
- Add a server-side, last-good-cache Premier League provider covering all 38 matchweeks, results, scorers and a calculated table, with Tottenham and Aston Villa spotlights.
- Package and snapshot the first-party card through a fixed frontend allow-list while preserving household floorplan assets.
- Restore raw hash-verified snapshots so the installed schema-v3 release remains a valid rollback target.
- Keep Cameras & Entry disabled until separately qualified and add Chromium/WebKit tablet browser projects.

## 0.3.0

- Replace the flat v0.2 card grid with the approved warm-glass family command centre using static gradients, opacity and bounded shadows suitable for the older iPad.
- Move navigation to a slim persistent rail and keep the calendar as the dominant Today and Week surface.
- Add progressive Home controls for room lighting, zoned heating, Cameras & Entry and the existing full media experience.
- Add schema-v3 camera, doorbell-event and garage-cover mappings without exposing camera entities, images, streams, states or history through sanitised inventory.
- Render configured camera start/stop-stream buttons and omit heating-only rooms from the Lighting surface.
- Limit the entry surface to one live camera and require a press-and-hold action plus explicit confirmation before garage movement.
- Extend regression coverage for warm-glass rendering, responsive layout, camera-domain validation and garage safety.

## 0.2.0

- Add the schema-v2 presentation contract for landscape, kiosk, legacy-iOS, theme, weather, lists, covers, ChoreOps helper and Team Tracker mappings.
- Replace placeholder view content with Daylight calendar, native weather/to-do/home controls, Mediocre media, ChoreOps legacy-lite and Team Tracker surfaces.
- Add persistent large-touch navigation for every enabled view and preserve normal Home Assistant chrome for administrators.
- Keep calendar event management disabled pending separate live write qualification.
- Add a deterministic 1024 by 768 generic preview and presentation-layer regression coverage.

## 0.1.2

- Make sanitised inventory and rollback snapshot ordering independent of ICU locale data in the minimal Home Assistant app image.
- Add regression coverage for the exact `Internal error. Icu error.` runtime failure.

## 0.1.1

- Fix Home Assistant OS startup by granting the S6 `/init` launcher the read permission required by its shell interpreter.
- Restore the standard S6 runtime paths to the custom AppArmor profile.
- Add a packaging regression check for startup permissions and release-version consistency.

## 0.1.0

- Add deterministic dashboard configuration validation and compilation.
- Add confirmation-bound deployment and rollback snapshots.
- Add sanitised Home Assistant inventory access.
- Add a bounded MCP tool surface on a private loopback interface.
- Add optional outbound-only OpenAI Secure MCP Tunnel support, disabled by default.
