# Architecture decision: first-party Family Hub card

Status: accepted for v0.7 controlled live operation

## Product shell

The dedicated YAML dashboard has one Home Assistant panel view and one bundled `custom:family-hub-card`. The card owns Today, Calendar, Home, Family, Security, Music and Football navigation. Home then exposes Rooms, Lights, Heating, Blinds & doors and Cleaning without multiplying top-level destinations.

The primary CSS viewport is `1112×834`, matching the 10.5-inch iPad Pro in landscape at device-pixel ratio 2. `1024×768` remains a regression profile. The shell uses static layered gradients, translucent surfaces and bounded shadows, avoids required motion and honours reduced-motion settings.

## Home and floorplans

Rooms is a private house floorplan, not the geographic family map. Each floor uses an explicitly configured isometric/cutaway image or approved map-named vacuum camera, percentage-coordinate room polygons and optional transparent light overlays. The two deployment assets remain fixed as `ground-floor.svg` and `first-floor.svg`; an inert SVG may embed a base64 PNG while active or external content remains forbidden.

Room, whole-home light, climate, cover and cleaning controls are derived only from explicit household mappings. Before a service call, the card checks the exact entity and a fixed service-name allow-list; light controls use the narrower `light.toggle` service. Geometry and device ownership are never inferred from entity names. An authenticated vacuum map, when configured, renders through a read-only child-card proxy inside Home Assistant and is never returned through the manager or committed to Git.

## Calendar, family and school

Calendar wraps the already-installed Daylight card or its legacy Skylight identity. The outer shell offers Day, Week, Month and Agenda. Event management, add buttons and write services remain disabled; the card's browser storage key preserves hidden-calendar and colour preferences.

When explicitly enabled, Family embeds Home Assistant's native Map card using an allow-list of `person.*` entities, so coordinates stay inside Home Assistant. With location sharing disabled, Family presents the configured household routines instead. Each child has a separate Google authorization proof, and the Classroom adapter remains gated until that child completes Google's consent flow with read-only scopes. Passwords and OAuth tokens never enter dashboard configuration.

## Security

Security admits only `doorbell`, `driveway` and `garden` camera roles. Camera IDs, names and entities containing child, nursery or bedroom hints are rejected. A camera may expose motion, person and ringing signals while its private stream entity is deferred. When an exterior stream entity is explicitly supplied, the picture appears only after **View live**; leaving Security closes the presentation boundary. Alarm and garage changes require a second confirmation dialog.

The v0.7 image sets `MANAGER_REQUIRE_READ_ONLY=false`, allowing a validated household configuration to opt into controlled live mode. Camera start/stop buttons remain exact configured entities, while alarm and garage services are fixed, entity-bound and executed only after the second confirmation. The optional manager flag and `display.read_only` mode remain available as full write locks.

## Music and football

Music hosts the configured Mediocre multi-player card inside a bounded tablet surface. In live mode, its Home Assistant proxy permits only the documented `media_player`, `music_assistant` and `mass_queue` operations needed for playback, volume, grouping, browsing, search and queue management, and only for configured primary/Music Assistant player entities. In read-only mode, service calls remain blocked. Fantasy Premier League is fetched server-side, publishes one index sensor, one sensor per matchweek and a calculated table, and uses a private last-good cache. Tottenham (`TOT`) and Aston Villa (`AVL`) receive spotlight styling.

## Deployment and rollback

The manager writes canonical configuration and generated YAML below `/config/family-dashboard`. It publishes only a fixed allow-list below `/config/www/family-dashboard`; unknown private assets are preserved. Floorplans have their own two-file validation and hash-confirmed deployment. Snapshots contain raw configuration, YAML and managed frontend files with SHA-256 hashes, allowing an older schema release to be restored without reinterpretation by schema v6.

Home Assistant remains in storage mode for resources. The JavaScript module therefore retains one explicit administrator registration or refresh step; the manager does not call a general Lovelace resource service.
