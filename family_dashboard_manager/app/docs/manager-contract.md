# Family Dashboard Manager contract

The manager is intentionally narrower than a general Home Assistant administration tool.

## Read-only tools

- `get_dashboard_status`: version, installation/resource state, active hashes, last deployment and snapshots.
- `get_sanitised_inventory`: approved areas and safe entity metadata only.
- `read_household_config`: current non-secret Family Dashboard JSON.
- `get_dashboard_errors`: the most recent bounded manager error.
- `get_classroom_authorization_plan`: per-child read-only Google scope and output contract; never credentials.
- `validate_household_config`: validate and compile without changing live files.

## Confirmation-bearing tools

- `deploy_household_config`: snapshot and atomically activate one already-validated configuration and fixed frontend file set.
- `rollback_dashboard`: hash-verify and restore one known raw snapshot.
- `reload_dashboard`: verify managed files and return the bounded storage-mode resource registration/refresh instruction. It does not call arbitrary Home Assistant services.

Deploy and rollback require an exact current/validated hash plus `confirm=true`.

## Explicitly excluded

- general shell or arbitrary file access;
- reads of `secrets.yaml`, `.storage`, backups, camera entities/images/streams, location history or recorder history;
- raw IP or MAC addresses;
- arbitrary Home Assistant service calls;
- password, OAuth code or token transport through household configuration;
- editing unrelated dashboards or integrations;
- camera or garage operation in v0.5.

## Files and connection

The MCP endpoint binds to `127.0.0.1` inside the Home Assistant app. Optional OpenAI Secure MCP Tunnel connects outbound only. Filesystem policy grants writes to `/config/family-dashboard`, the manager's fixed file names under `/config/www/family-dashboard`, and private `/data` state/snapshots. Unknown household assets in the frontend directory are preserved.
