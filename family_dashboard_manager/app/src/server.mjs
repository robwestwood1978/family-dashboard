import { pathToFileURL } from "node:url";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { localhostHostValidation } from "@modelcontextprotocol/sdk/server/middleware/hostHeaderValidation.js";
import * as z from "zod/v4";
import { startFootballPolling } from "./football-provider.mjs";
import { DashboardStore } from "./manager-store.mjs";
import { getSanitisedHomeAssistantInventory } from "./ha-client.mjs";

const CONFIG_SCHEMA = z.record(z.string(), z.unknown());
const APP_VERSION = process.env.APP_VERSION || "0.6.0";
const MCP_JSON_BODY_LIMIT_BYTES = 1_500_000;
const FLOORPLAN_ASSET_SCHEMA = z.object({
  filename: z.enum(["ground-floor.svg", "first-floor.svg"]),
  content: z.string().min(1).max(600_000)
});

function result(payload) {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload
  };
}

function errorResult(error) {
  return {
    isError: true,
    content: [{
      type: "text",
      text: error instanceof Error ? error.message : String(error)
    }]
  };
}

export function createFamilyDashboardMcpServer({
  store = new DashboardStore(),
  inventory = getSanitisedHomeAssistantInventory,
  reload = async () => ({
    performed: false,
    resource_url: store.getResourceUrl(),
    reason: "Home Assistant uses storage-mode Lovelace resources. Register or refresh this JavaScript module in Settings > Dashboards > Resources, then reload the tablet once."
  })
} = {}) {
  const server = new McpServer({ name: "family-dashboard-manager", version: APP_VERSION });

  const readTool = (name, description, handler) => {
    server.registerTool(name, {
      description,
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false }
    }, async () => {
      try {
        return result(await handler());
      } catch (error) {
        await store.recordError(name, error);
        return errorResult(error);
      }
    });
  };

  readTool(
    "get_dashboard_status",
    "Return only Family Dashboard installation, validation, hashes, deployment time and rollback snapshot metadata.",
    () => store.getStatus()
  );
  readTool(
    "get_sanitised_inventory",
    "Return approved Home Assistant areas and safe entity metadata. Cameras, people, trackers, states, history, addresses, tokens and arbitrary attributes are excluded.",
    () => inventory()
  );
  readTool(
    "read_household_config",
    "Read the current non-secret Family Dashboard household configuration only.",
    async () => ({ config: await store.readHouseholdConfig() })
  );
  readTool(
    "get_dashboard_errors",
    "Return the most recent bounded Family Dashboard manager error without stack traces or unrelated logs.",
    () => store.getErrors()
  );
  readTool(
    "get_classroom_authorization_plan",
    "Return the read-only Google Classroom authorization proof contract. No password, OAuth code, access token or refresh token is requested or exposed.",
    async () => ({
      phase: "authorization_proof",
      account_model: "one child-owned Google authorization per configured Classroom student",
      required_scopes: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
        "https://www.googleapis.com/auth/classroom.student-submissions.me.readonly"
      ],
      dashboard_access: "read_only",
      credential_rules: [
        "Never collect or store a child's Google password.",
        "Never write OAuth tokens into household.json, dashboard.yaml, snapshots or logs.",
        "Do not enable Classroom data until each child completes Google's own consent screen."
      ],
      output_contract: {
        state: "number of open assignments",
        attributes: {
          assignments: [{ title: "string", course: "string", due_at: "ISO-8601 timestamp or null", alternate_link: "Google-hosted URL" }]
        }
      }
    })
  );

  server.registerTool("validate_household_config", {
    description: "Validate and compile a proposed non-secret household configuration without changing live files. The resulting config hash is required for deployment confirmation.",
    inputSchema: { config: CONFIG_SCHEMA },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ config }) => {
    try {
      const prepared = store.validate(config);
      return result({
        valid: true,
        config_hash: prepared.config_hash,
        dashboard_hash: prepared.dashboard_hash,
        enabled_views: prepared.enabled_views
      });
    } catch (error) {
      await store.recordError("validate_household_config", error);
      return errorResult(error);
    }
  });

  server.registerTool("validate_floorplan_assets", {
    description: "Validate the two approved private floorplan SVGs without writing them. Returns the exact asset-set hash required for deployment.",
    inputSchema: { assets: z.array(FLOORPLAN_ASSET_SCHEMA).length(2) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ assets }) => {
    try {
      return result(store.validateFloorplanAssets(assets));
    } catch (error) {
      await store.recordError("validate_floorplan_assets", error);
      return errorResult(error);
    }
  });

  server.registerTool("deploy_floorplan_assets", {
    description: "Deploy the already validated ground-floor.svg and first-floor.svg files to the manager's private asset directory. Requires confirm=true and the exact validated asset-set hash.",
    inputSchema: {
      assets: z.array(FLOORPLAN_ASSET_SCHEMA).length(2),
      expected_asset_set_hash: z.string().regex(/^[a-f0-9]{64}$/),
      confirm: z.boolean()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ assets, expected_asset_set_hash: expectedAssetSetHash, confirm }) => {
    try {
      return result(await store.deployFloorplanAssets(assets, { expectedAssetSetHash, confirm }));
    } catch (error) {
      await store.recordError("deploy_floorplan_assets", error);
      return errorResult(error);
    }
  });

  server.registerTool("deploy_household_config", {
    description: "Deploy one already validated household configuration. Requires confirm=true and the exact config hash returned by validation; snapshots the previous release and writes only the Family Dashboard directory.",
    inputSchema: {
      config: CONFIG_SCHEMA,
      expected_config_hash: z.string().regex(/^[a-f0-9]{64}$/),
      confirm: z.boolean()
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ config, expected_config_hash: expectedConfigHash, confirm }) => {
    try {
      return result(await store.deploy(config, { expectedConfigHash, confirm }));
    } catch (error) {
      await store.recordError("deploy_household_config", error);
      return errorResult(error);
    }
  });

  server.registerTool("rollback_dashboard", {
    description: "Restore one known Family Dashboard snapshot. Requires confirm=true and the exact active config hash to prevent stale or accidental rollback.",
    inputSchema: {
      snapshot_id: z.string().regex(/^\d{8}T\d{6}Z-[a-f0-9]{12}$/),
      expected_active_hash: z.string().regex(/^[a-f0-9]{64}$/),
      confirm: z.boolean()
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
  }, async ({ snapshot_id: snapshotId, expected_active_hash: expectedActiveHash, confirm }) => {
    try {
      return result(await store.rollback({ snapshotId, expectedActiveHash, confirm }));
    } catch (error) {
      await store.recordError("rollback_dashboard", error);
      return errorResult(error);
    }
  });

  server.registerTool("reload_dashboard", {
    description: "Verify the generated Family Dashboard files and return the bounded one-time Lovelace resource registration or refresh step. Requires explicit confirmation and does not call arbitrary Home Assistant services.",
    inputSchema: { confirm: z.boolean() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ confirm }) => {
    try {
      if (confirm !== true) throw new Error("confirm must be true before reload");
      await store.assertFilesReadable();
      return result(await reload());
    } catch (error) {
      await store.recordError("reload_dashboard", error);
      return errorResult(error);
    }
  });

  return server;
}

export function createManagerApp(dependencies = {}) {
  const app = express();
  app.use(express.json({ limit: MCP_JSON_BODY_LIMIT_BYTES }));
  app.use(localhostHostValidation());
  app.get("/healthz", (_request, response) => response.json({ status: "ok", version: APP_VERSION }));
  app.post("/mcp", async (request, response) => {
    const server = createFamilyDashboardMcpServer(dependencies);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response, request.body);
    } catch (error) {
      console.error("MCP request failed", error instanceof Error ? error.message : error);
      if (!response.headersSent) {
        response.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null
        });
      }
    } finally {
      response.on("close", () => {
        transport.close();
        server.close();
      });
    }
  });
  app.get("/mcp", (_request, response) => response.status(405).set("Allow", "POST").send("Method Not Allowed"));
  app.delete("/mcp", (_request, response) => response.status(405).set("Allow", "POST").send("Method Not Allowed"));
  return app;
}

export function startManagerServer({
  port = Number(process.env.MANAGER_PORT || 8099),
  store = new DashboardStore(),
  startPolling = startFootballPolling
} = {}) {
  const app = createManagerApp({ store });
  const stopFootballPolling = startPolling({ store });
  const listener = app.listen(port, "127.0.0.1", (error) => {
    if (error) {
      stopFootballPolling();
      console.error("Family Dashboard Manager failed to start", error);
      process.exitCode = 1;
      return;
    }
    console.log(`Family Dashboard Manager listening on 127.0.0.1:${port}`);
  });
  listener.once("close", stopFootballPolling);
  return listener;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const listener = startManagerServer();
  const shutdown = () => listener.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
