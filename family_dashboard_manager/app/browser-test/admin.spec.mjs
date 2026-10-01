import { test, expect } from "@playwright/test";
import express from "express";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const config = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));
const schema = JSON.parse(await readFile(new URL("../config/family-dashboard.schema.json", import.meta.url), "utf8"));
const adminDirectory = fileURLToPath(new URL("../admin/", import.meta.url));
const inventory = {
  schema_version: 1,
  areas: [
    { id: "living_room", name: "Living room" },
    { id: "kitchen", name: "Kitchen" },
    { id: "hallway", name: "Hallway" }
  ],
  entities: [
    { entity_id: "sensor.app_armor_version", name: "AppArmor version", domain: "sensor" },
    { entity_id: "sensor.living_room_temperature", name: "Living room temperature", area_id: "living_room", device_class: "temperature", domain: "sensor" },
    { entity_id: "sensor.kitchen_temperature", name: "Kitchen temperature", area_id: "kitchen", device_class: "temperature", domain: "sensor" },
    { entity_id: "text.living_room_schedule", name: "Living room Schedule", area_id: "living_room", domain: "text" },
    { entity_id: "select.daddy_choreops_helper", name: "Daddy ChoreOps helper", domain: "select" },
    { entity_id: "select.living_room_auto_schedule", name: "Living room Auto schedule", area_id: "living_room", domain: "select" },
    { entity_id: "button.blinds_identify", name: "Blinds Identify", domain: "button" },
    { entity_id: "button.living_room_refresh_schedule", name: "Living room Refresh schedule", area_id: "living_room", domain: "button" }
  ]
};

let server;
let baseUrl;

test.beforeAll(async () => {
  const app = express();
  app.get("/api/admin/bootstrap", (_request, response) => response.json({
    version: "0.15.0",
    config,
    schema,
    inventory,
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
      navOverflowX: getComputedStyle(nav).overflowX,
      navButtonHeight: nav.querySelector("button").getBoundingClientRect().height
    };
  });
  expect(layout.rootWidth / layout.editorWidth).toBeGreaterThan(0.95);
  expect(layout.navDisplay).toBe("flex");
  expect(layout.navOverflowX).toBe("auto");
  expect(layout.navButtonHeight).toBeGreaterThanOrEqual(44);

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

test("does not present unrelated entities as empty heating mappings", async ({ page }) => {
  await page.goto(baseUrl);
  await expect(page.locator("#status")).toContainText("Active configuration loaded");
  await page.getByRole("button", { name: "Rooms & devices" }).click();

  const hallway = page.locator('input[value="hallway"]').locator('xpath=ancestor::div[contains(@class,"array-item")][1]');
  const emptyTemperature = hallway.locator("label.field").filter({ hasText: "Temperature Sensor" }).locator("select");
  await expect(emptyTemperature).toHaveValue("");
  await expect(emptyTemperature.locator("option").first()).toHaveText("Not configured");
  await expect(emptyTemperature.locator('option[value="sensor.app_armor_version"]')).toHaveCount(0);

  const livingRoom = page.locator('input[value="living_room"]').locator('xpath=ancestor::div[contains(@class,"array-item")][1]');
  const mode = livingRoom.locator("label.field").filter({ hasText: "Mode Entity" }).locator("select");
  const refresh = livingRoom.locator("label.field").filter({ hasText: "Refresh Entity" }).locator("select");
  await expect(mode).toHaveValue("select.living_room_auto_schedule");
  await expect(mode.locator('option[value="select.daddy_choreops_helper"]')).toHaveCount(0);
  await expect(refresh).toHaveValue("button.living_room_refresh_schedule");
  await expect(refresh.locator('option[value="button.blinds_identify"]')).toHaveCount(0);
});
