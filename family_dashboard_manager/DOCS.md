# Family Dashboard Manager

The manager owns only the dedicated Family Dashboard files. It validates household configuration, compiles dashboard YAML, keeps bounded rollback snapshots and can expose those operations to ChatGPT/Codex through an optional outbound-only Secure MCP Tunnel.

## Before installation

This release requires Home Assistant OS 2026.8.0 or newer. Install the integrations and frontend cards used by your private configuration before deploying the dashboard.

The v0.3 warm-glass presentation profile expects:

- Daylight Calendar Card, button-card, layout-card, Mushroom, Auto-Entities, Team Tracker Card, Mediocre Multi Media Player Card, card-mod and kiosk-mode from HACS;
- ChoreOps and Team Tracker entities when their corresponding views are enabled;
- built-in Home Assistant weather, to-do, light, climate, cover, camera, binary-sensor and scene entities for the configured surfaces.

The generated dashboard deliberately avoids WebGL, live blur, required animation and event-write controls. It creates depth with static gradients, opacity and bounded shadows. With `legacy_ios` enabled, card animation and transitions are suppressed. The non-admin tablet account receives kiosk chrome while an administrator retains the normal Home Assistant header as the parent escape route. Every enabled view retains the same large-touch navigation rail.

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

The private household file must use schema version 3 for manager v0.3. In addition to the existing product and entity mappings it supplies the warm-glass backdrop colours, weather and list mappings, room lights/heating/covers, the `legacy-lite` ChoreOps helper mapping, Team Tracker entries, camera IDs, safe doorbell status sensors and the garage cover. Run `validate_household_config` before any deployment; validation is read-only and returns the exact hash required for a separately confirmed deploy.

The Cameras & Entry view loads only the configured primary camera as a live stream; secondary cameras remain lightweight until opened. When a camera maps Home Assistant button entities for stream control, the view provides explicit Start live and Stop live actions. Camera images, streams, states and history are never fetched through the manager MCP tools. Camera entity IDs may appear only in the explicit non-secret household configuration. Garage movement is available only from a press-and-hold action followed by an on-screen confirmation instructing the user to check the relevant camera view.

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
- Inventory excludes camera entities and all camera images/streams, people, location trackers, current states, history, IP/MAC addresses, credentials and arbitrary attributes.
- The manager cannot run arbitrary commands, read arbitrary files or call arbitrary Home Assistant services.
