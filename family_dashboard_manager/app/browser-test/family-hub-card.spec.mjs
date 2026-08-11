import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const config = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));
const cardSource = await readFile(new URL("../frontend/family-hub-card.js", import.meta.url), "utf8");

function state(entityId, value, attributes = {}) {
  return {
    entity_id: entityId,
    state: String(value),
    attributes,
    last_changed: "2026-08-10T08:00:00.000Z",
    last_updated: "2026-08-10T08:00:00.000Z"
  };
}

function fixtureStates() {
  const states = {
    "weather.home": state("weather.home", "partlycloudy", { temperature: 19.5 }),
    "calendar.family": state("calendar.family", "on", { message: "Family dinner", start_time: "2026-08-10T18:00:00+01:00" }),
    "calendar.school": state("calendar.school", "off", {}),
    "person.example_parent": state("person.example_parent", "home"),
    "person.example_child_one": state("person.example_child_one", "school"),
    "person.example_child_two": state("person.example_child_two", "home"),
    "camera.example_vacuum_map": state("camera.example_vacuum_map", "idle", { entity_picture: "/api/camera_proxy/camera.example_vacuum_map?token=browser-fixture" }),
    "light.living_room": state("light.living_room", "on", { friendly_name: "Living room", brightness: 184, rgb_color: [255, 187, 112] }),
    "light.kitchen": state("light.kitchen", "off", { friendly_name: "Kitchen" }),
    "light.hallway": state("light.hallway", "off", { friendly_name: "Hallway" }),
    "light.child_one_room": state("light.child_one_room", "off", { friendly_name: "Child one room" }),
    "light.child_two_room": state("light.child_two_room", "on", { friendly_name: "Child two room", brightness: 90 }),
    "climate.living_room": state("climate.living_room", "heat", { current_temperature: 20.4, temperature: 21 }),
    "climate.kitchen": state("climate.kitchen", "heat", { current_temperature: 19.2, temperature: 20 }),
    "climate.child_one_room": state("climate.child_one_room", "heat", { current_temperature: 18.8, temperature: 19 }),
    "climate.child_two_room": state("climate.child_two_room", "heat", { current_temperature: 19.1, temperature: 19.5 }),
    "sensor.living_room_temperature": state("sensor.living_room_temperature", "20.4"),
    "sensor.kitchen_temperature": state("sensor.kitchen_temperature", "19.2"),
    "media_player.living_room": state("media_player.living_room", "playing", { friendly_name: "Living room", media_title: "Dashboard test song", media_artist: "Test artist" }),
    "media_player.kitchen": state("media_player.kitchen", "idle", { friendly_name: "Kitchen" }),
    "sensor.child_one_choreops_points": state("sensor.child_one_choreops_points", "42"),
    "sensor.child_two_choreops_points": state("sensor.child_two_choreops_points", "37"),
    "sensor.child_one_choreops_chores": state("sensor.child_one_choreops_chores", "2", { chore_stat_current_due_today: 2 }),
    "sensor.child_two_choreops_chores": state("sensor.child_two_choreops_chores", "1", { chore_stat_current_due_today: 1 }),
    "sensor.child_one_choreops_chore_status_brush_teeth": state("sensor.child_one_choreops_chore_status_brush_teeth", "pending", { chore_name: "Brush teeth", default_points: 3 }),
    "sensor.child_one_choreops_chore_status_get_dressed": state("sensor.child_one_choreops_chore_status_get_dressed", "claimed", { chore_name: "Get dressed", default_points: 4 }),
    "sensor.child_one_choreops_chore_status_go_to_bed_at_bedtime": state("sensor.child_one_choreops_chore_status_go_to_bed_at_bedtime", "approved", { chore_name: "Bedtime", default_points: 5 }),
    "sensor.child_two_choreops_chore_status_brush_teeth": state("sensor.child_two_choreops_chore_status_brush_teeth", "overdue", { chore_name: "Brush teeth", default_points: 3 }),
    "sensor.child_two_choreops_chore_status_get_dressed": state("sensor.child_two_choreops_chore_status_get_dressed", "pending", { chore_name: "Get dressed", default_points: 4 }),
    "sensor.child_two_choreops_chore_status_go_to_bed_at_bedtime": state("sensor.child_two_choreops_chore_status_go_to_bed_at_bedtime", "completed", { chore_name: "Bedtime", default_points: 5 }),
    "sensor.family_dashboard_classroom_child_one": state("sensor.family_dashboard_classroom_child_one", "1", { assignments: [{ title: "Science revision", course: "Science", due_at: "2026-08-12T15:00:00Z" }] }),
    "sensor.family_dashboard_classroom_child_two": state("sensor.family_dashboard_classroom_child_two", "1", { assignments: [{ title: "Read chapter four", course: "English", due_at: "2026-08-13T15:00:00Z" }] }),
    "sensor.family_dashboard_premier_league": state("sensor.family_dashboard_premier_league", "1", { current_gameweek: 1, available_gameweeks: Array.from({ length: 38 }, (_, index) => index + 1), last_updated: "2026-08-10T08:00:00Z" })
  };
  states["sensor.family_dashboard_premier_league_gw_1"] = state("sensor.family_dashboard_premier_league_gw_1", "10", {
    events: [
      { id: 1, kickoff_time: "2026-08-21T19:00:00Z", started: false, finished: false, minutes: 0, home: { name: "Tottenham Hotspur", short_name: "TOT" }, away: { name: "Burnley", short_name: "BUR" }, home_score: null, away_score: null, home_scorers: [], away_scorers: [], spotlight: true },
      { id: 2, kickoff_time: "2026-08-22T14:00:00Z", started: false, finished: false, minutes: 0, home: { name: "Aston Villa", short_name: "AVL" }, away: { name: "Newcastle", short_name: "NEW" }, home_score: null, away_score: null, home_scorers: [], away_scorers: [], spotlight: true }
    ]
  });
  for (let gameweek = 2; gameweek <= 38; gameweek += 1) {
    states[`sensor.family_dashboard_premier_league_gw_${gameweek}`] = state(`sensor.family_dashboard_premier_league_gw_${gameweek}`, "0", { events: [] });
  }
  states["sensor.family_dashboard_premier_league_table"] = state("sensor.family_dashboard_premier_league_table", "TOT", {
    rows: [
      { position: 1, code: "TOT", name: "Tottenham Hotspur", played: 1, won: 1, drawn: 0, lost: 0, goal_difference: 2, points: 3, spotlight: true },
      { position: 2, code: "AVL", name: "Aston Villa", played: 1, won: 1, drawn: 0, lost: 0, goal_difference: 1, points: 3, spotlight: true }
    ]
  });
  return states;
}

async function mount(page, familyConfig = config) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.route("**/local/family-dashboard/assets/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eef0f4"/></svg>'
    });
  });
  await page.route("**/api/camera_proxy/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#eef0f4"/></svg>'
    });
  });
  await page.setContent(`<!doctype html><html><head><base href="http://homeassistant.local/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><style>:root{--header-height:56px}html,body{margin:0;width:100%;height:100%;overflow:hidden}ha-card{display:block}ha-icon{display:inline-block}.ha-header{position:fixed;inset:0 0 auto 0;z-index:100;height:56px;background:#171a21;color:#fff;display:flex;align-items:center;padding:0 24px;font:20px system-ui}</style><div class="ha-header">Family Hub</div></body></html>`);
  await page.evaluate(() => {
    class HaCard extends HTMLElement {}
    class HaIcon extends HTMLElement {}
    class MockChildCard extends HTMLElement {
      set hass(value) { this._hass = value; }
    }
    if (!customElements.get("ha-card")) customElements.define("ha-card", HaCard);
    if (!customElements.get("ha-icon")) customElements.define("ha-icon", HaIcon);
    if (!customElements.get("mock-child-card")) customElements.define("mock-child-card", MockChildCard);
    window.loadCardHelpers = async () => ({
      createCardElement(cardConfig) {
        const element = document.createElement("mock-child-card");
        element.dataset.cardType = cardConfig.type;
        element.dataset.cardMode = cardConfig.mode || "";
        element.dataset.cardHeight = cardConfig.height || "";
        if (cardConfig.type === "custom:mediocre-multi-media-player-card") {
          element.style.height = cardConfig.height || "754px";
          element.innerHTML = `<div class="mock-media-player" style="height:100%;padding:18px;background:var(--mmpc-card);color:var(--mmpc-on-card)"><strong>Kitchen</strong><div style="margin-top:14px"><span class="mock-chip" style="display:inline-block;padding:8px 24px;border:1px solid var(--mmpc-chip-border);border-radius:999px;background:var(--mmpc-chip-background);color:var(--mmpc-chip-foreground)">Kitchen</span></div></div>`;
        } else {
          element.textContent = `${cardConfig.type} card`;
        }
        return element;
      }
    });
    window.__serviceCalls = [];
    window.__apiCalls = [];
  });
  await page.addScriptTag({ type: "module", content: cardSource });
  await page.evaluate(async ({ familyConfig, states }) => {
    await customElements.whenDefined("family-hub-card");
    const card = document.createElement("family-hub-card");
    document.body.append(card);
    card.setConfig({ family_config: familyConfig });
    card.hass = {
      states,
      callService(domain, service, data) {
        window.__serviceCalls.push({ domain, service, data });
      },
      async callApi(method, path) {
        window.__apiCalls.push({ method, path });
        const school = path.includes("calendar.school");
        return [{
          summary: school ? "School assembly" : "Family dinner",
          start: { dateTime: new Date(Date.now() + (school ? 7_200_000 : 3_600_000)).toISOString() },
          end: { dateTime: new Date(Date.now() + (school ? 10_800_000 : 7_200_000)).toISOString() },
          location: school ? "School hall" : "Kitchen"
        }];
      }
    };
  }, { familyConfig, states: fixtureStates() });
  await page.waitForFunction(() => document.querySelector("family-hub-card")?.shadowRoot?.querySelector('[data-current-view="today"]'));
  return pageErrors;
}

async function expectNoRootOverflow(page) {
  const metrics = await page.locator("family-hub-card").evaluate((card) => {
    const root = card.shadowRoot;
    const hub = root.querySelector(".hub-card");
    const navigation = root.querySelector(".navigation").getBoundingClientRect();
    const content = root.querySelector(".content").getBoundingClientRect();
    const topbar = root.querySelector(".topbar").getBoundingClientRect();
    const view = root.querySelector(".view").getBoundingClientRect();
    const header = document.querySelector(".ha-header").getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    return {
      documentOverflow: document.documentElement.scrollWidth - window.innerWidth,
      hubOverflow: hub.scrollWidth - hub.clientWidth,
      navigationEndsBeforeContent: navigation.right <= content.left + 1,
      headerEndsBeforeView: topbar.bottom <= view.top + 1,
      cardRight: cardRect.right,
      cardTop: cardRect.top,
      cardBottom: cardRect.bottom,
      headerBottom: header.bottom,
      topbarTop: topbar.top,
      viewBottom: view.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  });
  expect(metrics.documentOverflow).toBeLessThanOrEqual(1);
  expect(metrics.hubOverflow).toBeLessThanOrEqual(1);
  expect(metrics.navigationEndsBeforeContent).toBe(true);
  expect(metrics.headerEndsBeforeView).toBe(true);
  expect(metrics.cardRight).toBeLessThanOrEqual(metrics.viewportWidth + 1);
  expect(metrics.cardTop).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
  expect(metrics.topbarTop).toBeGreaterThanOrEqual(metrics.headerBottom - 1);
  expect(metrics.viewBottom).toBeLessThanOrEqual(metrics.cardBottom + 1);
  expect(metrics.cardBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
}

test("fits the supported iPad landscapes and exposes every approved surface", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await expect(card.locator(".nav-button")).toHaveCount(6);
  await expect(card.locator(".nav-button")).toContainText(["Today", "Calendar", "Rooms", "Family", "Music", "Football"]);
  await expectNoRootOverflow(page);

  for (const view of ["calendar", "rooms", "family", "music", "football", "today"]) {
    await card.locator(`[data-view="${view}"]`).first().click();
    await expect(card.locator(`[data-current-view="${view}"]`)).toBeVisible();
    await expectNoRootOverflow(page);
  }

  await card.locator('[data-view="calendar"]').first().click();
  await expect(card.locator(".agenda-event")).toHaveCount(2);
  await expect(card.locator(".agenda-board")).toContainText("Family dinner");
  await expect(card.locator(".agenda-board")).toContainText("School assembly");

  expect(pageErrors).toEqual([]);
});

test("renders the interactive floorplan and sends only the selected low-risk control", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="rooms"]').click();
  await expect(card.locator(".floorplan-visual")).toHaveAttribute("viewBox", "0.0000 0.0000 100.0000 60.0000");
  await expect(card.locator(".floorplan-image")).toBeVisible();
  await expect(card.locator(".floorplan-image")).toHaveAttribute("href", /\/api\/camera_proxy\/camera\.example_vacuum_map/);
  await expect(card.locator('[data-room="living_room"]')).toBeVisible();
  await card.locator('[data-room="kitchen"]').click();
  await expect(card.locator(".room-detail h2")).toHaveText("Kitchen");
  await card.locator('button[data-toggle="light.kitchen"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "homeassistant", service: "toggle", data: { entity_id: "light.kitchen" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("keeps the family map private and spotlights both requested clubs", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="family"]').click();
  await expect(card.locator('[data-card-type="map"]')).toBeVisible();
  await expect(card.locator(".family-person")).toHaveCount(2);
  await expect(card.locator(".family-person")).toContainText(["Science revision", "Read chapter four"]);
  await expect(card.locator(".chore-row")).toHaveCount(6);
  await expect(card.locator(".family-person")).toContainText(["Brush teeth", "Get dressed"]);

  await card.locator('.nav-button[data-view="football"]').click();
  await expect(card.locator(".spotlight-panel")).toContainText("Tottenham & Aston Villa");
  await expect(card.locator(".fixture.is-spotlight")).toHaveCount(2);
  await expect(card.locator(".spotlight-club")).toContainText(["Tottenham Hotspur", "Aston Villa"]);
  expect(pageErrors).toEqual([]);
});

test("enforces read-only mode at every interactive control boundary", async ({ page }) => {
  const previewConfig = structuredClone(config);
  previewConfig.display.read_only = true;
  previewConfig.features.location_map = false;
  previewConfig.location.entities = [];
  for (const person of previewConfig.people) delete person.location_entity;
  const pageErrors = await mount(page, previewConfig);
  const card = page.locator("family-hub-card");

  await expect(card.locator(".preview-pill")).toHaveText(/Read-only test/);
  await expect(card.locator('[data-media-toggle="media_player.living_room"]')).toBeDisabled();

  await card.locator('.nav-button[data-view="rooms"]').click();
  await card.locator('[data-room="kitchen"]').click();
  await expect(card.locator(".read-only-note")).toBeVisible();
  await expect(card.locator('button[data-toggle="light.kitchen"]')).toBeDisabled();

  await card.evaluate((element) => {
    window.__moreInfoEvents = 0;
    element.addEventListener("hass-more-info", () => { window.__moreInfoEvents += 1; });
    const root = element.shadowRoot;
    for (const control of root.querySelectorAll("[data-toggle], [data-scene], [data-media-toggle], [data-cover-action], [data-climate-adjust], [data-more-info]")) {
      control.disabled = false;
      control.click();
    }
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.__moreInfoEvents)).toBe(0);

  await card.locator('.nav-button[data-view="music"]').click();
  await expect(card.locator(".media-player-panel")).toContainText("Your full music player");
  await expect(card.locator(".media-preview-badge")).toContainText("controls locked for this test");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toBeVisible();
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("aria-disabled", "true");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("data-card-mode", "in-card");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("data-card-height", "100%");
  const mediaMetrics = await card.locator(".media-player-stage").evaluate((stage) => {
    const child = stage.querySelector("mock-child-card");
    const chip = child.querySelector(".mock-chip");
    const stageRect = stage.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const chipStyle = getComputedStyle(chip);
    return {
      childTop: childRect.top,
      childBottom: childRect.bottom,
      stageTop: stageRect.top,
      stageBottom: stageRect.bottom,
      chipColour: chipStyle.color,
      chipBackground: chipStyle.backgroundColor
    };
  });
  expect(mediaMetrics.childTop).toBeGreaterThanOrEqual(mediaMetrics.stageTop - 1);
  expect(mediaMetrics.childBottom).toBeLessThanOrEqual(mediaMetrics.stageBottom + 1);
  expect(mediaMetrics.chipColour).toBe("rgb(247, 248, 252)");
  expect(mediaMetrics.chipBackground).toBe("rgba(38, 47, 76, 0.96)");

  await card.locator('.nav-button[data-view="family"]').click();
  await expect(card.locator(".family-rhythm")).toContainText("Actual ChoreOps tasks are shown below");
  await expect(card.locator(".chore-row")).toHaveCount(6);
  await expect(card.locator('[data-card-type="map"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
