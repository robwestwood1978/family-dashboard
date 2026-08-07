# Architecture decision: Home Assistant-native dashboard

Status: accepted for Phase 0

## Product shell

The product is a dedicated Home Assistant YAML dashboard. Home Assistant remains in storage mode for existing dashboards and loads Family Dashboard as one additional YAML dashboard. This preserves all current dashboards and lets the new product reuse installed HACS cards directly.

The initial views are Today, Calendar, Home, Music, Chores, Football, and an optional School view. The tablet uses a separate non-admin Home Assistant user and Family Dashboard as its personal default. Kiosk mode hides Home Assistant chrome for non-admin users only; administrators retain normal chrome, and a large persistent footer links every enabled product view.

## Calendar

Apple/iCloud remains the household system of record. Home Assistant's existing CalDAV entities supply events to Daylight Calendar Card, formerly Skylight Calendar Card. Event create/edit/delete support must be proven against the live CalDAV entities before write controls are enabled.

## Media

Mediocre Multi Media Player Card is the incumbent UI. It is configured with each Sonos player plus its corresponding Music Assistant entity. The large Music view owns browsing, search, queue and grouping; Today uses the compact presentation. Sonos Card and SpotifyPlus are optional supporting surfaces only if real-device testing proves a clear gap.

## Chores and football

The Chores view uses ChoreOps dashboard-helper attributes through Auto-Entities and emits native tile actions. The `legacy-lite` profile follows the integration's conservative dashboard pattern and avoids animation-heavy presentation. Football uses Team Tracker Card against explicitly configured Team Tracker sensor entities.

## Code and configuration

Generic code and releases are public and contain no household facts. The private repository contains the production JSON configuration and release references. The compiler rejects common secret-bearing keys before generating YAML. HACS installs the selected frontend cards; Home Assistant's app-store repository mechanism installs the manager.

## Deployment

Family Dashboard Manager is a small Home Assistant app. It validates a proposed configuration, compiles it into the dedicated Family Dashboard path, retains rollback snapshots, asks Home Assistant to reload its Lovelace resources, and reports health. It does not pull the private repository and therefore requires no GitHub credential.

The manager's MCP endpoint binds only to the app container's loopback interface. OpenAI's official `tunnel-client` can run as an optional second service in the same container; it is disabled by default and makes outbound HTTPS connections only after a tunnel ID and runtime key are configured in Home Assistant.

One static entry in `configuration.yaml` points Home Assistant to the generated dashboard. After that bootstrap, normal releases update only the dedicated Family Dashboard directory.

## Compatibility

The target is an older iPad in landscape. Until exact-device qualification is complete, the dashboard uses native Home Assistant sections, standard cards, no required WebGL and no bleeding-edge browser API. Schema v2 carries a `legacy_ios` switch; when enabled, card animation and transitions are disabled. The tracked 1024 by 768 SVG preview is a deterministic composition reference, while real-device qualification remains the authority for rendering and interaction.
