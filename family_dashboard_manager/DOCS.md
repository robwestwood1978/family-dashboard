# Family Dashboard Manager

The manager owns only the dedicated Family Dashboard files. It validates household configuration, compiles dashboard YAML, keeps bounded rollback snapshots and can expose those operations to ChatGPT/Codex through an optional outbound-only Secure MCP Tunnel.

## Before installation

This release requires Home Assistant OS 2026.8.0 or newer. Install the integrations and frontend cards used by your private configuration before deploying the dashboard.

The v0.2 presentation profile expects:

- Daylight Calendar Card, Mushroom, Auto-Entities, Team Tracker Card, Mediocre Multi Media Player Card, card-mod and kiosk-mode from HACS;
- ChoreOps and Team Tracker entities when their corresponding views are enabled;
- built-in Home Assistant weather, to-do, light, climate, cover and scene entities for the configured surfaces.

The generated dashboard deliberately avoids WebGL, required animation and event-write controls. With `legacy_ios` enabled, card animation and transitions are suppressed. The non-admin tablet account receives kiosk chrome while an administrator retains the normal Home Assistant header as the parent escape route. Every enabled view also has a large footer navigation control.

## Install

1. Add `https://github.com/robwestwood1978/family-dashboard` as a Home Assistant app repository.
2. Install **Family Dashboard Manager**.
3. Leave **Secure MCP Tunnel** disabled for the first start.
4. Start the app and confirm its log reports that the manager is listening on its private loopback interface.

The app exposes no host port. Its MCP endpoint is reachable only inside its own container by the optional tunnel service.

## One-time dashboard registration

Add the following to Home Assistant's `configuration.yaml` once:

```yaml
lovelace:
  mode: storage
  dashboards:
    family-dashboard:
      mode: yaml
      title: Family Dashboard
      icon: mdi:home-heart
      show_in_sidebar: true
      filename: family-dashboard/dashboard.yaml
```

Check the configuration and restart Home Assistant. The dashboard file will be created by the first confirmed deployment.

The private household file must use schema version 2 for manager v0.2. In addition to the existing product and entity mappings it supplies `display.panel_path`, the presentation theme, weather and list mappings, room icons and covers, the `legacy-lite` ChoreOps helper mapping, and Team Tracker entries. Run `validate_household_config` before any deployment; validation is read-only and returns the exact hash required for a separately confirmed deploy.

Calendar event creation, editing and deletion remain disabled. Apple/iCloud or another CalDAV-backed Home Assistant calendar remains the source of truth until live write behavior is independently proven.

## Secure MCP Tunnel

The tunnel is optional and disabled by default. To enable managed deployments:

1. Create or obtain a `tunnel_id` in OpenAI Platform tunnel settings.
2. Create a runtime API key with Tunnels Read + Use permission.
3. Associate the tunnel with the ChatGPT workspace and Platform organisation that will use it.
4. Stop the app, enable **Secure MCP Tunnel**, enter the tunnel ID and runtime key, then start it again.
5. Confirm the log reports that the tunnel is healthy before adding the tunnel-backed app in ChatGPT developer mode.

The runtime key is stored only in Home Assistant app options and passed to `tunnel-client` through its process environment. It is never accepted in household configuration, written to Git, returned by a manager tool or printed by the start script.

## Tool safety

- Validation never writes live files.
- Deployment requires `confirm=true` plus the exact hash returned by validation.
- Rollback requires `confirm=true`, a known snapshot ID and the exact active hash.
- Inventory excludes cameras, people, location trackers, current states, history, IP/MAC addresses, credentials and arbitrary attributes.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
