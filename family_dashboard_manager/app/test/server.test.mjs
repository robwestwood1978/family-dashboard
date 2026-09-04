import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ClassroomIntegrationStore } from "../src/classroom-integration-store.mjs";
import { DashboardStore } from "../src/manager-store.mjs";
import { createManagerApp } from "../src/server.mjs";

test("serves health and the bounded MCP tool surface", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-server-"));
  const store = new DashboardStore({
    configDir: join(root, "config"),
    dataDir: join(root, "data"),
    resourceDir: join(root, "www", "family-dashboard")
  });
  const classroomStore = new ClassroomIntegrationStore({
    targetDir: join(root, "config", "custom_components", "family_dashboard_classroom"),
    dataDir: join(root, "data")
  });
  const app = createManagerApp({
    store,
    classroomStore,
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
  assert.deepEqual(await health.json(), { status: "ok", version: "0.9.0" });

  const client = new Client({ name: "family-dashboard-test", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
  await client.connect(transport);
  context.after(() => client.close());

  const tools = await client.listTools();
  assert.deepEqual(
    tools.tools.map((tool) => tool.name).sort(),
    [
      "deploy_floorplan_assets",
      "deploy_household_config",
      "get_classroom_authorization_plan",
      "get_classroom_integration_status",
      "get_dashboard_errors",
      "get_dashboard_status",
      "get_sanitised_inventory",
      "install_classroom_integration",
      "read_household_config",
      "reload_dashboard",
      "rollback_classroom_integration",
      "rollback_dashboard",
      "validate_floorplan_assets",
      "validate_household_config"
    ]
  );
  const status = await client.callTool({ name: "get_dashboard_status", arguments: {} });
  assert.equal(status.structuredContent.installed, false);

  const classroom = await client.callTool({ name: "get_classroom_authorization_plan", arguments: {} });
  assert.equal(classroom.structuredContent.phase, "authorization_proof");
  assert.deepEqual(classroom.structuredContent.required_scopes, [
    "https://www.googleapis.com/auth/classroom.courses.readonly",
    "https://www.googleapis.com/auth/classroom.coursework.me.readonly"
  ]);
  assert.equal(classroom.structuredContent.output_contract.maximum_assignment_attributes, 20);
  assert.equal(classroom.structuredContent.output_contract.attributes.data_stale, "boolean");
  assert.doesNotMatch(JSON.stringify(classroom.structuredContent), /child.*password.*value|access_token|refresh_token/i);

  const classroomIntegration = await client.callTool({ name: "get_classroom_integration_status", arguments: {} });
  assert.equal(classroomIntegration.structuredContent.installed_state, "not_installed");
  assert.match(classroomIntegration.structuredContent.bundled_set_hash, /^[a-f0-9]{64}$/);

  const assets = [
    { filename: "ground-floor.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v10H0z"/></svg>' },
    { filename: "first-floor.svg", content: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M1 1h8v8H1z"/></svg>' }
  ];
  const validation = await client.callTool({ name: "validate_floorplan_assets", arguments: { assets } });
  assert.match(validation.structuredContent.asset_set_hash, /^[a-f0-9]{64}$/);
  const deployment = await client.callTool({
    name: "deploy_floorplan_assets",
    arguments: { assets, expected_asset_set_hash: validation.structuredContent.asset_set_hash, confirm: true }
  });
  assert.equal(deployment.structuredContent.assets.length, 2);

  const approvedSizeAssets = [
    {
      filename: "ground-floor.svg",
      content: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><desc>${"x".repeat(210_000)}</desc></svg>`
    },
    assets[1]
  ];
  assert.ok(JSON.stringify({ assets: approvedSizeAssets }).length > 100 * 1024);
  const approvedSizeValidation = await client.callTool({
    name: "validate_floorplan_assets",
    arguments: { assets: approvedSizeAssets }
  });
  assert.match(approvedSizeValidation.structuredContent.asset_set_hash, /^[a-f0-9]{64}$/);
});
