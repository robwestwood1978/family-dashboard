# Architecture decision: first-party Family Hub card

Status: accepted for v0.5 isolated qualification

## Product shell

The dedicated YAML dashboard has one Home Assistant panel view and one bundled `custom:family-hub-card`. The card owns Today, Calendar, Rooms, Family, Music and Football navigation. This avoids constructing a large third-party Lovelace tree on the older tablet while retaining Home Assistant state and service APIs.

The primary CSS viewport is `1112×834`, matching the 10.5-inch iPad Pro in landscape at device-pixel ratio 2. `1024×768` remains a regression profile. The modern shell uses static layered gradients, translucent surfaces and bounded shadows, avoids WebGL and required motion, and honours reduced-motion settings.

## Rooms and floorplan

Rooms is a house floorplan, not the geographic family map. Each floor has either a private static isometric/cutaway base image or an explicitly configured map-named vacuum camera, percentage-coordinate room polygons and optional transparent light overlays. For an Eufy Clean X10 Pro Omni, `camera.robovac_map` is the expected ground-floor source. The authenticated image is rendered directly inside Home Assistant and is never returned through the manager or committed to Git. A room selection reveals only its mapped low-risk controls. Geometry remains explicit private configuration rather than being inferred from entity names or invented from household facts.

## Family and school

When explicitly enabled, Family embeds Home Assistant's native Map card using an allow-list of `person.*` entities, so coordinates remain inside Home Assistant. With household location sharing disabled, v0.5 instead renders a purposeful private family overview. Each child panel reads the explicitly mapped ChoreOps total, points and individual status sensors so named routines and their actual status are visible. Each child has a separate Google authorization proof; the live adapter remains gated until Google's own consent flow succeeds with read-only scopes.

## Football

Fantasy Premier League blocks direct cross-origin browser reads, so the manager fetches its public feeds server-side. The provider publishes one index sensor, one sensor per matchweek and one table sensor. Only changed payloads are republished, and a private last-good cache keeps the UI useful during source failures. Every fixture is retained; Tottenham (`TOT`) and Aston Villa (`AVL`) receive spotlight styling.

## Calendar, media and native cards

The card requests a bounded seven-day window from Home Assistant's calendar API and renders a first-party, tablet-legible agenda without sending calendar data outside Home Assistant. The Map child card is created only when location sharing is enabled. Read-only Music renders mapped Home Assistant media-player states in the first-party shell; an interactive third-party media card is withheld during qualification. No external map or football browser request receives household information.

## Cameras and garage

Doorbell/security camera surfaces are intentionally absent. Schema-v5 retains typed placeholders for a later migration, but v0.5 validation rejects `features.entry=true`. The only camera-domain exception is a map-named vacuum camera used as a read-only floorplan image; no security stream is mounted and no garage or vacuum action is sent.

## Deployment and rollback

The manager writes canonical configuration and generated YAML below `/config/family-dashboard`. It publishes only a fixed allow-list of first-party frontend files below `/config/www/family-dashboard`; unknown private floorplan files are preserved. Snapshots contain raw configuration, YAML and managed frontend files with SHA-256 hashes. Rollback verifies and restores the raw files, allowing a schema-v4 release to be restored by a schema-v5 manager.

Home Assistant remains in storage mode for resources. The first-party JavaScript module therefore has one explicit administrator registration step. The manager does not attempt an unsupported general Lovelace resource service call.
