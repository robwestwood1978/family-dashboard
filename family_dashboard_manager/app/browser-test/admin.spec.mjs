import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const config = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../config/family-dashboard.schema.json", import.meta.url), "utf8"));
const adminDirectory = fileURLToPath(new URL("../admin/", import.meta.url));

let server;
let baseUrl;

test.beforeAll(async () => {
  const app = express();
  app.get("/api/admin/bootstrap", (_request, response) => response.json({
    version: "0.12.1",
    config,
    schema,
    inventory: { schema_version: 1, areas: [], entities: [] },
    active_config_hash: "a".repeat(64),
    private_assets: {},
    user: { id: "admin", name: "Household owner" }
  }));
  app.use(express.static(adminDirectory));
  server = createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.afterAll(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("keeps Admin readable in iPad portrait and offers configured rooms", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.goto(baseUrl);
  await expect(page.locator("#status")).toContainText("Active configuration loaded");

  await page.getByRole("button", { name: "Home defaults" }).click();
  const roomSelect = page.locator("label.field").filter({ hasText: "Default Room" }).locator("select");
  const defaultFloorRooms = config.rooms.filter((room) => room.floor_id === config.floorplan.default_floor);
  await expect(roomSelect).toBeVisible();
  await expect(roomSelect.locator("option")).toHaveCount(defaultFloorRooms.length);
  await expect(roomSelect.locator("option")).toHaveText(defaultFloorRooms.map((room) => new RegExp(room.name, "i")));
  await expect(page.locator("label.field").filter({ hasText: "Default Room" }).locator('input[type="text"]')).toHaveCount(0);

  const layout = await page.locator("#editor").evaluate((editor) => {
    const root = editor.querySelector(":scope > .field-grid > .field-group");
    const nav = document.querySelector("#section-nav");
    return {
      editorWidth: editor.getBoundingClientRect().width,
      rootWidth: root.getBoundingClientRect().width,
      navDisplay: getComputedStyle(nav).display,
      navOverflow: nav.scrollWidth > nav.clientWidth
    };
  });
  expect(layout.rootWidth / layout.editorWidth).toBeGreaterThan(0.95);
  expect(layout.navDisplay).toBe("flex");
  expect(layout.navOverflow).toBe(true);

  await page.getByRole("button", { name: "Kiosk & photos" }).click();
  const groupWidths = await page.locator("#editor").evaluate((editor) => {
    const root = editor.querySelector(":scope > .field-grid > .field-group");
    const nested = root.querySelector(":scope > .field-grid > .field-group");
    return {
      root: root.getBoundingClientRect().width,
      nested: nested.getBoundingClientRect().width
    };
  });
  expect(groupWidths.nested / groupWidths.root).toBeGreaterThan(0.85);
});
