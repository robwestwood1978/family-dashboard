# Family Dashboard Manager contract

The manager is intentionally narrower than a general Home Assistant administration tool.

## Read-only tools

- `get_dashboard_status`: version, installation/resource state, active hashes, last deployment and snapshots.
- `get_sanitised_inventory`: approved areas and safe entity metadata only.
- `read_household_config`: current non-secret Family Dashboard JSON.
- `get_dashboard_errors`: the most recent bounded manager error.
- `get_classroom_authorization_plan`: per-child read-only Google scope and output contract; never credentials.
- `validate_household_config`: validate and compile without changing live files.
- `validate_floorplan_assets`: inspect exactly two inert private SVG assets and return their hash manifest.

## Confirmation-bearing tools

- `deploy_household_config`: snapshot and atomically activate one already-validated configuration and fixed frontend file set.
- `deploy_floorplan_assets`: activate the exact two-file asset set already validated by hash.
- `rollback_dashboard`: hash-verify and restore one known raw snapshot.
- `reload_dashboard`: verify managed files and return the bounded storage-mode resource registration/refresh instruction; it does not call arbitrary Home Assistant services.

Deployment and rollback require `confirm=true` plus the exact validation or active hash.

## Explicitly excluded

- general shell or arbitrary file access;
- reads of `secrets.yaml`, `.storage`, backups, camera images or streams, location history or recorder history;
- exposure of camera entities through sanitised inventory;
- raw IP or MAC addresses;
- arbitrary Home Assistant service calls;
- password, OAuth code or token transport through household configuration;
- editing unrelated dashboards or integrations.

Schema v6 may reference an explicitly supplied safe exterior camera entity and bounded signal/button entities, but the manager never reads a stream. In controlled live mode, the frontend accepts writes only for mapped entities and fixed service sets; setting `display.read_only: true` or the manager safety flag blocks all frontend writes.

## Files and connection

The MCP endpoint binds to `127.0.0.1` inside the Home Assistant app. Optional OpenAI Secure MCP Tunnel connects outbound only. Filesystem policy grants writes to `/config/family-dashboard`, the fixed manager file names under `/config/www/family-dashboard`, and private `/data` state/snapshots. Unknown household assets in the frontend directory are preserved.
