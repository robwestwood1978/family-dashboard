# Family Dashboard Manager contract

The manager is intentionally narrower than a general Home Assistant administration tool.

## Read-only tools

- `get_dashboard_status`: version, installation/resource state, active hashes, last deployment and snapshots.
- `get_sanitised_inventory`: approved areas and safe entity metadata only.
- `read_household_config`: current non-secret Family Dashboard JSON.
- `get_dashboard_errors`: the most recent bounded manager error.
- `get_classroom_authorization_plan`: exact two-scope, per-child read-only Google consent and bounded sensor contract; never credentials.
- `get_classroom_integration_status`: fixed bundled/installed integration hashes and rollback metadata; never OAuth state.
- `validate_household_config`: validate and compile without changing live files.
- `validate_floorplan_assets`: inspect exactly two inert private SVG assets and return their hash manifest.

## Confirmation-bearing tools

- `deploy_household_config`: snapshot, hash-check and activate one already-validated configuration and fixed frontend file set.
- `deploy_floorplan_assets`: activate the exact two-file asset set already validated by hash.
- `install_classroom_integration`: install only the bundled fixed-file integration after exact bundle/active-hash confirmation; snapshot first and require a separate Home Assistant restart.
- `rollback_classroom_integration`: restore only a known fixed-file integration snapshot after exact active-hash confirmation; never alter OAuth config entries.
- `rollback_dashboard`: hash-verify and restore one known raw snapshot.
- `reload_dashboard`: verify managed files and return the bounded storage-mode resource registration/refresh instruction; it does not call arbitrary Home Assistant services.

Deployment and rollback require `confirm=true` plus the exact validation or active hash.

## Administrator ingress

Home Assistant Supervisor exposes the static Admin page only through the app's administrator-only panel. The Manager additionally requires the documented Supervisor ingress source and ingress-path header. Read returns only the schema, active non-secret configuration, hashes, private-asset metadata and sanitised inventory. Preview requires the active hash; deploy additionally requires the exact preview hash and confirmation. Changes to security, floorplan, location or school require a protected-change acknowledgement. The separate floorplan endpoints retain the fixed two-file inert SVG contract.

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

The HTTP server listens on the app's internal ingress port without publishing a host port. Admin routes require the Supervisor ingress boundary; the `/mcp` route separately enforces a localhost Host header for the existing in-container OpenAI Secure MCP Tunnel, which connects outbound only. Filesystem policy grants writes to `/config/family-dashboard`, the fixed manager file names under `/config/www/family-dashboard`, the fixed `/config/custom_components/family_dashboard_classroom` integration plus its bounded staging and recovery paths, and private `/data` state/snapshots. It grants no access to Home Assistant's `.storage` directory. Unknown household assets in the frontend directory are preserved.
