# Family Dashboard Manager contract

The manager is intentionally narrower than a general Home Assistant administration tool.

## Read tools

- `get_dashboard_status`: installed version, active config hash, last successful deployment and validation state.
- `get_sanitised_inventory`: approved areas and safe entity metadata only.
- `read_household_config`: current non-secret Family Dashboard JSON.
- `get_dashboard_errors`: bounded Family Dashboard compiler/reload errors only.

## Write tools

- `validate_household_config`: validate without changing live files.
- `deploy_household_config`: compile, snapshot, atomically activate and health-check one validated config.
- `rollback_dashboard`: restore one known Family Dashboard snapshot.
- `reload_dashboard`: reload only Lovelace resources/config needed by Family Dashboard.

Every write tool returns the previous and resulting config hashes. Deploy and rollback are confirmation-bearing operations.

## Explicitly excluded

- general shell or arbitrary file access;
- reads of `secrets.yaml`, `.storage`, backups, camera entities/images/streams, location history or recorder history (explicit camera entity IDs may exist only in user-supplied non-secret household configuration);
- raw IP or MAC addresses;
- arbitrary Home Assistant service calls;
- credential or token transport;
- editing unrelated dashboards or integrations.

## Connection

The manager exposes an MCP Streamable HTTP endpoint on `127.0.0.1` inside the Home Assistant app. OpenAI Secure MCP Tunnel runs as an optional second service in the same container and connects outbound over HTTPS. The runtime API key is kept in Home Assistant's password-typed app option and process environment; it is never returned by a tool or stored in Git.

The app receives only the minimum Home Assistant API access required for registry metadata, config validation and Lovelace reload. Filesystem policy allows writes only to the dedicated Family Dashboard directory and its rollback snapshots.
