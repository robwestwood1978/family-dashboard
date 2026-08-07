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
