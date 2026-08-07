import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { DashboardStore } from "../src/manager-store.mjs";
import { createManagerApp } from "../src/server.mjs";

test("serves health and the bounded MCP tool surface", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-server-"));
  const store = new DashboardStore({ configDir: join(root, "config"), dataDir: join(root, "data") });
  const app = createManagerApp({
    store,
    inventory: async () => ({ schema_version: 1, generated_at: "2026-08-07T12:00:00.000Z", areas: [], entities: [] }),
    reload: async () => ({ performed: true })
  });
  const listener = app.listen(0, "127.0.0.1");
  await once(listener, "listening");
  const { port } = listener.address();
  context.after(async () => {
    listener.close();
    await rm(root, { recursive: true, force: true });
  });

  const health = await fetch(`http://127.0.0.1:${port}/healthz`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok", version: "0.2.0" });

  const client = new Client({ name: "family-dashboard-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);
  context.after(() => client.close());

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "deploy_household_config",
      "get_dashboard_errors",
      "get_dashboard_status",
      "get_sanitised_inventory",
      "read_household_config",
      "reload_dashboard",
      "rollback_dashboard",
      "validate_household_config"
    ]
  );
  const status = await client.callTool({ name: "get_dashboard_status", arguments: {} });
  assert.equal(status.structuredContent.installed, false);
});
