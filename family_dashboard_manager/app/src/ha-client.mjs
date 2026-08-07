import WebSocket from "ws";
import { sanitiseInventory } from "./sanitise-inventory.mjs";

const DEFAULT_REST_URL = "http://supervisor/core/api";
const DEFAULT_WS_URL = "ws://supervisor/core/websocket";

function requireToken(token) {
  if (typeof token !== "string" || token.length < 10) {
    throw new Error("Home Assistant Supervisor token is unavailable");
  }
  return token;
}

export function mergeInventory({ areas = [], devices = [], entities = [], states = [] } = {}) {
  const deviceAreas = new Map(devices.map((device) => [device.id, device.area_id]).filter(([, areaId]) => areaId));
  const statesByEntity = new Map(states.map((state) => [state.entity_id, state]));
  return {
    areas: areas.map((area) => ({ id: area.area_id, name: area.name })),
    entities: entities.map((entity) => {
      const state = statesByEntity.get(entity.entity_id);
      const attributes = state?.attributes ?? {};
      return {
        entity_id: entity.entity_id,
        name: entity.name || attributes.friendly_name,
        original_name: entity.original_name,
        area_id: entity.area_id || deviceAreas.get(entity.device_id),
        device_class: entity.device_class || attributes.device_class,
        integration: entity.platform,
        platform: entity.platform,
        supported_features: Number.isInteger(attributes.supported_features)
          ? attributes.supported_features
          : undefined
      };
    })
  };
}

export async function callHomeAssistantWebSocket({
  token = process.env.SUPERVISOR_TOKEN,
  url = process.env.HOME_ASSISTANT_WS_URL || DEFAULT_WS_URL,
  WebSocketImpl = WebSocket,
  timeoutMs = 10000
} = {}) {
  requireToken(token);
  const commands = [
    { key: "areas", type: "config/area_registry/list" },
    { key: "devices", type: "config/device_registry/list" },
    { key: "entities", type: "config/entity_registry/list" },
    { key: "states", type: "get_states" }
  ];

  return new Promise((resolve, reject) => {
    const socket = new WebSocketImpl(url);
    const results = {};
    let settled = false;
    let nextId = 1;
    const pending = new Map();
    const timer = setTimeout(() => finish(new Error("Home Assistant inventory request timed out")), timeoutMs);

    function finish(error) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { socket.close(); } catch {}
      if (error) reject(error);
      else resolve(results);
    }

    socket.on("error", (error) => finish(error));
    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        finish(new Error("Home Assistant returned invalid WebSocket JSON"));
        return;
      }
      if (message.type === "auth_required") {
        socket.send(JSON.stringify({ type: "auth", access_token: token }));
        return;
      }
      if (message.type === "auth_invalid") {
        finish(new Error("Home Assistant rejected the Supervisor token"));
        return;
      }
      if (message.type === "auth_ok") {
        for (const command of commands) {
          const id = nextId++;
          pending.set(id, command.key);
          socket.send(JSON.stringify({ id, type: command.type }));
        }
        return;
      }
      if (message.type !== "result" || !pending.has(message.id)) return;
      const key = pending.get(message.id);
      pending.delete(message.id);
      if (!message.success) {
        finish(new Error(`Home Assistant inventory command failed: ${key}`));
        return;
      }
      results[key] = message.result;
      if (pending.size === 0) finish();
    });
  });
}

export async function getSanitisedHomeAssistantInventory(options = {}) {
  const raw = await callHomeAssistantWebSocket(options);
  return sanitiseInventory(mergeInventory(raw));
}

export async function reloadLovelaceResources({
  token = process.env.SUPERVISOR_TOKEN,
  baseUrl = process.env.HOME_ASSISTANT_REST_URL || DEFAULT_REST_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000
} = {}) {
  requireToken(token);
  const response = await fetchImpl(`${baseUrl}/services/lovelace/reload_resources`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: "{}",
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (response.status === 404) {
    return { performed: false, reason: "lovelace.reload_resources is not available" };
  }
  if (!response.ok) {
    throw new Error(`Home Assistant resource reload failed with HTTP ${response.status}`);
  }
  return { performed: true };
}
