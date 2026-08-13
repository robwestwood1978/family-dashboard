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
    "camera.example_doorbell": state("camera.example_doorbell", "streaming"),
    "camera.example_garage": state("camera.example_garage", "idle"),
    "alarm_control_panel.example_home": state("alarm_control_panel.example_home", "disarmed"),
    "binary_sensor.example_doorbell_motion": state("binary_sensor.example_doorbell_motion", "off"),
    "binary_sensor.example_doorbell_person": state("binary_sensor.example_doorbell_person", "on"),
    "binary_sensor.example_doorbell_ringing": state("binary_sensor.example_doorbell_ringing", "off"),
    "binary_sensor.example_garage_motion": state("binary_sensor.example_garage_motion", "off"),
    "binary_sensor.example_garage_person": state("binary_sensor.example_garage_person", "off"),
    "cover.example_garage": state("cover.example_garage", "closed", { current_position: 0 }),
    "vacuum.example_robovac": state("vacuum.example_robovac", "docked", { battery_level: 88 }),
    "sensor.example_robovac_battery": state("sensor.example_robovac_battery", "88"),
    "sensor.example_robovac_task": state("sensor.example_robovac_task", "idle"),
    "sensor.example_robovac_dock": state("sensor.example_robovac_dock", "ready"),
    "light.living_room": state("light.living_room", "on", { friendly_name: "Living room", brightness: 184, rgb_color: [255, 187, 112] }),
    "light.kitchen": state("light.kitchen", "off", { friendly_name: "Kitchen" }),
    "light.hallway": state("light.hallway", "off", { friendly_name: "Hallway" }),
    "light.child_one_room": state("light.child_one_room", "off", { friendly_name: "Child one room" }),
    "light.child_two_room": state("light.child_two_room", "on", { friendly_name: "Child two room", brightness: 90 }),
    "cover.living_room": state("cover.living_room", "open", { friendly_name: "Living room blind", current_position: 60 }),
    "cover.child_one_room": state("cover.child_one_room", "closed", { friendly_name: "Child one blind", current_position: 0 }),
    "cover.child_two_room": state("cover.child_two_room", "closed", { friendly_name: "Child two blind", current_position: 0 }),
    "climate.living_room": state("climate.living_room", "heat", { current_temperature: 20.4, temperature: 21 }),
    "climate.kitchen": state("climate.kitchen", "heat", { current_temperature: 19.2, temperature: 20 }),
    "climate.child_one_room": state("climate.child_one_room", "heat", { current_temperature: 18.8, temperature: 19 }),
    "climate.child_two_room": state("climate.child_two_room", "off", { temperature: 19.5 }),
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
  await page.setContent(`<!doctype html><html><head><base href="http://homeassistant.local/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><style>:root{--header-height:56px}html,body{margin:0;width:100%;height:100%;overflow:hidden}ha-card{display:block}ha-icon{display:inline-block}.ha-header{position:fixed;inset:0 0 auto 0;z-index:100;height:56px;background:#171a21;color:#fff;display:flex;align-items:center;padding:0 24px 0 76px;font:20px system-ui}.ha-sidebar{position:fixed;inset:56px auto 0 0;width:52px;background:#191b20}.ha-main{position:absolute;inset:0 0 0 52px;overflow:hidden}</style><div class="ha-header">Family Hub</div><div class="ha-sidebar"></div><div class="ha-main"></div></body></html>`);
  await page.evaluate(() => {
    class HaCard extends HTMLElement {}
    class HaIcon extends HTMLElement {}
    class MockChildCard extends HTMLElement {
      set hass(value) { this._hass = value; }
      connectedCallback() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        this.querySelector("[data-mock-service]")?.addEventListener("click", () => {
          this._hass?.callService?.("media_player", "media_play_pause", { entity_id: "media_player.kitchen" });
        });
      }
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
        element.dataset.defaultView = cardConfig.default_view || "";
        element.dataset.rollingDaysSchedule = String(cardConfig.rolling_days_schedule ?? "");
        element.dataset.eventManagement = String(cardConfig.enable_event_management ?? "");
        element.dataset.cameraView = cardConfig.camera_view || "";
        element.dataset.entity = cardConfig.entity || cardConfig.entity_id || "";
        if (cardConfig.type === "custom:mediocre-multi-media-player-card") {
          element.style.height = cardConfig.height || "754px";
          element.innerHTML = `<div class="mock-media-player" style="height:100%;min-height:0;display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:14px;background:var(--mmpc-card);color:var(--mmpc-on-card);overflow:hidden">
            <section class="mock-massive" style="min-height:0;overflow:auto;padding:8px"><strong>Kitchen</strong><div style="height:230px;margin:14px auto;background:#131827;border-radius:16px"></div><button type="button" data-mock-service>Play</button><div style="height:150px"></div></section>
            <section class="mock-speaker-scroll" style="min-width:0;min-height:0;overflow:auto;padding:8px"><strong>Join media players</strong><div class="mock-chip-scroll" style="max-width:100%;margin-top:14px;overflow-x:auto"><div style="display:flex;width:max-content;gap:8px"><span class="mock-chip" style="display:inline-block;padding:8px 24px;border:1px solid var(--mmpc-chip-border);border-radius:999px;background:var(--mmpc-chip-background);color:var(--mmpc-chip-foreground)">Garage</span>${["Living Room", "Master Bedroom", "Playroom", "Kitchen"].map((name) => `<span style="display:inline-block;padding:8px 24px;border:1px solid var(--mmpc-chip-border);border-radius:999px;background:var(--mmpc-chip-background);color:var(--mmpc-chip-foreground)">${name}</span>`).join("")}</div></div><h3>Player focus</h3>${["Kitchen", "Living Room", "Playroom", "Master Bedroom", "Garage"].map((name) => `<div style="height:70px;margin-top:8px;padding:16px;background:rgba(255,255,255,.06)">${name}</div>`).join("")}</section>
          </div>`;
        } else if (["custom:daylight-calendar-card", "custom:skylight-calendar-card"].includes(cardConfig.type)) {
          element.innerHTML = `<div class="mock-calendar" style="height:100%;padding:16px;background:#111a2d;color:#fff"><strong>${cardConfig.default_view}</strong><button type="button" data-mock-calendar-write>Add event</button><p>${cardConfig.entities.join(" · ")}</p></div>`;
          element.querySelector("[data-mock-calendar-write]").addEventListener("click", () => {
            element._hass?.callService?.("calendar", "create_event", { entity_id: "calendar.family" });
          });
        } else if (cardConfig.type === "picture-entity") {
          element.innerHTML = `<div class="mock-picture" style="height:100%;min-height:140px;background:#070d1b;color:#fff;display:grid;place-items:center">${cardConfig.entity}</div>`;
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
    document.querySelector(".ha-main").append(card);
    card.setConfig({ family_config: familyConfig });
    card.hass = {
      states,
      callService(domain, service, data) {
        window.__serviceCalls.push({ domain, service, data });
      },
      async callApi(method, path) {
        window.__apiCalls.push({ method, path });
        const school = path.includes("calendar.school");
        const upcoming = {
          summary: school ? "School assembly" : "Family dinner",
          start: { dateTime: new Date(Date.now() + (school ? 7_200_000 : 3_600_000)).toISOString() },
          end: { dateTime: new Date(Date.now() + (school ? 10_800_000 : 7_200_000)).toISOString() },
          location: school ? "School hall" : "Kitchen"
        };
        return school ? [upcoming] : [{
          summary: "Finished early appointment",
          start: { dateTime: new Date(Date.now() - 14_400_000).toISOString() },
          end: { dateTime: new Date(Date.now() - 10_800_000).toISOString() }
        }, upcoming];
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
  await expect(card.locator(".preview-pill")).toHaveText(/Controlled live/);
  await expect(card.locator(".nav-button")).toHaveCount(7);
  await expect(card.locator(".nav-button")).toContainText(["Today", "Calendar", "Home", "Family", "Security", "Music", "Football"]);
  await expectNoRootOverflow(page);

  for (const view of ["calendar", "rooms", "family", "entry", "music", "football", "today"]) {
    await card.locator(`[data-view="${view}"]`).first().click();
    await expect(card.locator(`[data-current-view="${view}"]`)).toBeVisible();
    await expectNoRootOverflow(page);
  }

  await card.locator('[data-view="calendar"]').first().click();
  await expect(card.locator('[data-card-type="custom:daylight-calendar-card"]')).toBeVisible();
  await expect(card.locator("[data-calendar-mode]")).toHaveCount(4);
  await expect(card.locator('[data-card-type="custom:daylight-calendar-card"]')).toHaveAttribute("data-event-management", "false");
  await card.locator('[data-calendar-mode="day"]').click();
  await expect(card.locator('[data-card-type="custom:daylight-calendar-card"]')).toHaveAttribute("data-default-view", "schedule");
  await expect(card.locator('[data-card-type="custom:daylight-calendar-card"]')).toHaveAttribute("data-rolling-days-schedule", "1");
  await card.locator('[data-mock-calendar-write]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('[data-view="today"]').first().click();
  await expect(card.locator(".next-panel")).toContainText("Family dinner");
  await expect(card.locator(".next-panel")).not.toContainText("Finished early appointment");

  expect(pageErrors).toEqual([]);
});

test("renders the interactive floorplan and sends only configured room controls", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="rooms"]').click();
  await expect(card.locator(".floorplan-visual")).toHaveAttribute("viewBox", "1.5000 1.5000 97.0000 57.0000");
  await expect(card.locator(".floorplan-image")).toBeVisible();
  await expect(card.locator(".floorplan-image")).toHaveAttribute("href", /\/api\/camera_proxy\/camera\.example_vacuum_map/);
  await expect(card.locator('[data-room="living_room"]')).toBeVisible();
  await card.locator('[data-room="kitchen"]').click();
  await expect(card.locator(".room-detail h2")).toHaveText("Kitchen");
  await card.locator('button[data-toggle="light.kitchen"]').click();
  await card.locator('button[data-scene="scene.kitchen_bright"]').click();
  await card.locator('button[data-media-toggle="media_player.kitchen"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "light", service: "toggle", data: { entity_id: "light.kitchen" } },
    { domain: "scene", service: "turn_on", data: { entity_id: "scene.kitchen_bright" } },
    { domain: "media_player", service: "media_play_pause", data: { entity_id: "media_player.kitchen" } }
  ]);

  await card.evaluate((element) => {
    const root = element.shadowRoot;
    const light = root.querySelector('button[data-toggle="light.kitchen"]');
    const scene = root.querySelector('button[data-scene="scene.kitchen_bright"]');
    const media = root.querySelector('button[data-media-toggle="media_player.kitchen"]');
    light.dataset.toggle = "light.unmapped";
    scene.dataset.scene = "scene.unmapped";
    media.dataset.mediaToggle = "media_player.unmapped";
    light.click();
    scene.click();
    media.click();
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toHaveLength(3);
  expect(pageErrors).toEqual([]);
});

test("curates lights, heating, blinds and cleaning inside Home", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="rooms"]').click();
  await expect(card.locator("[data-home-section]")).toHaveCount(5);

  await card.locator('[data-home-section="lights"]').click();
  await expect(card.locator('[data-home-section-current="lights"] .whole-home-card')).toHaveCount(5);
  await card.locator('button[data-toggle="light.kitchen"]').click();

  await card.locator('[data-home-section="heating"]').click();
  await expect(card.locator(".heating-card")).toHaveCount(4);
  const livingHeating = card.locator('[data-climate-card="climate.living_room"]');
  await expect(livingHeating.locator(".heating-temperatures > span")).toHaveText(["Current20.4°", "Target21°"]);
  await expect(livingHeating.locator(".heating-power")).toHaveText("On");
  const childTwoHeating = card.locator('[data-climate-card="climate.child_two_room"]');
  await expect(childTwoHeating.locator(".heating-temperatures > span")).toHaveText(["Current—", "Target19.5°"]);
  await expect(childTwoHeating.locator(".heating-power")).toHaveText("Off");
  await livingHeating.locator('button[data-climate-power="turn_off"]').click();
  await childTwoHeating.locator('button[data-climate-power="turn_on"]').click();
  await card.locator('button[data-climate-adjust="0.5"][data-entity="climate.living_room"]').click();
  await livingHeating.locator(".heating-power").evaluate((button) => {
    button.dataset.entity = "climate.unmapped";
    button.click();
    button.dataset.entity = "climate.living_room";
    button.dataset.climatePower = "delete";
    button.click();
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toHaveLength(4);

  await card.locator('[data-home-section="covers"]').click();
  await expect(card.locator(".cover-card")).toHaveCount(4);
  await expect(card.locator(".cover-card")).toContainText(["Living room blind", "Garage door"]);
  await card.locator('button[data-cover-action="close_cover"][data-entity="cover.living_room"]').click();

  await card.locator('[data-home-section="cleaning"]').click();
  await expect(card.locator(".cleaning-panel")).toContainText("Robot vacuum");
  await expect(card.locator('[data-card-type="picture-entity"][data-entity="camera.example_vacuum_map"]')).toBeVisible();
  await card.locator('button[data-vacuum-action="start"]').click();

  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "light", service: "toggle", data: { entity_id: "light.kitchen" } },
    { domain: "climate", service: "turn_off", data: { entity_id: "climate.living_room" } },
    { domain: "climate", service: "turn_on", data: { entity_id: "climate.child_two_room" } },
    { domain: "climate", service: "set_temperature", data: { entity_id: "climate.living_room", temperature: 21.5 } },
    { domain: "cover", service: "close_cover", data: { entity_id: "cover.living_room" } },
    { domain: "vacuum", service: "start", data: { entity_id: "vacuum.example_robovac" } }
  ]);
  await expectNoRootOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("keeps the live music card working inside its configured media boundary", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="music"]').click();
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toBeVisible();
  await card.locator("[data-mock-service]").click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "media_player", service: "media_play_pause", data: { entity_id: "media_player.kitchen" } }
  ]);

  await card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]').evaluate(async (child) => {
    await child._hass.callService("media_player", "media_play_pause", { entity_id: "media_player.unmapped" });
    await child._hass.callService("light", "toggle", { entity_id: "light.kitchen" });
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toHaveLength(1);
  expect(pageErrors).toEqual([]);
});

test("starts cameras deliberately and confirms garage and alarm actions", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await expect(card.locator(".security-camera")).toHaveCount(2);
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect(card.locator(".security-camera").filter({ hasText: /bedroom|child room/i })).toHaveCount(0);

  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator('[data-card-type="picture-entity"][data-camera-view="live"][data-entity="camera.example_doorbell"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } }
  ]);
  await card.locator('button[data-camera-open="garage"]').click();
  await expect(card.locator('[data-card-type="picture-entity"][data-camera-view="live"][data-entity="camera.example_garage"]')).toBeVisible();
  await card.locator('button[data-camera-close="garage"]').click();

  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Open garage door");
  await card.locator('button[data-confirm-action="cancel"]').click();
  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await card.locator('button[data-confirm-action="confirm"]').click();

  await card.locator('button[data-alarm-action="alarm_arm_away"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Arm away");
  await card.locator('button[data-confirm-action="confirm"]').click();

  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } },
    { domain: "cover", service: "open_cover", data: { entity_id: "cover.example_garage" } },
    { domain: "alarm_control_panel", service: "alarm_arm_away", data: { entity_id: "alarm_control_panel.example_home" } }
  ]);
  await expectNoRootOverflow(page);
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

test("enforces read-only mode at every interactive control boundary", async ({ page }, testInfo) => {
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
    for (const control of root.querySelectorAll("[data-toggle], [data-scene], [data-media-toggle], [data-cover-action], [data-climate-adjust], [data-climate-power], [data-vacuum-action], [data-alarm-action], [data-secure-cover-action], [data-more-info]")) {
      control.disabled = false;
      control.click();
    }
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await expect.poll(() => page.evaluate(() => window.__moreInfoEvents)).toBe(0);

  await card.locator('.nav-button[data-view="calendar"]').click();
  await expect(card.locator('[data-card-type="custom:daylight-calendar-card"]')).toHaveAttribute("data-read-only-guard", "service-boundary");
  await card.locator('[data-mock-calendar-write]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('.nav-button[data-view="entry"]').click();
  await expect(card.locator('button[data-alarm-action="alarm_arm_home"]')).toBeDisabled();
  await expect(card.locator('button[data-secure-cover-action]')).toBeDisabled();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator('[data-card-type="picture-entity"][data-entity="camera.example_doorbell"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('.nav-button[data-view="rooms"]').click();
  await card.locator('[data-home-section="cleaning"]').click();
  await expect(card.locator('button[data-vacuum-action="start"]')).toBeDisabled();

  await card.locator('.nav-button[data-view="music"]').click();
  await expect(card.locator(".media-player-panel")).toContainText("Your full music player");
  await expect(card.locator(".music-meta")).toContainText("playback locked");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toBeVisible();
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("aria-disabled", "true");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("data-read-only-guard", "service-boundary");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("data-card-mode", "in-card");
  await expect(card.locator('[data-card-type="custom:mediocre-multi-media-player-card"]')).toHaveAttribute("data-card-height", "100%");
  const mediaMetrics = await card.locator(".media-player-stage").evaluate((stage) => {
    const child = stage.querySelector("mock-child-card");
    const chip = child.querySelector(".mock-chip");
    const chipScroll = child.querySelector(".mock-chip-scroll");
    const speakerScroll = child.querySelector(".mock-speaker-scroll");
    const stageRect = stage.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    const chipStyle = getComputedStyle(chip);
    speakerScroll.scrollTop = 48;
    chipScroll.scrollLeft = 48;
    return {
      childTop: childRect.top,
      childBottom: childRect.bottom,
      stageTop: stageRect.top,
      stageBottom: stageRect.bottom,
      chipColour: chipStyle.color,
      chipBackground: chipStyle.backgroundColor,
      speakerOverflow: getComputedStyle(speakerScroll).overflowY,
      speakerScrollHeight: speakerScroll.scrollHeight,
      speakerClientHeight: speakerScroll.clientHeight,
      speakerScrollTop: speakerScroll.scrollTop,
      chipScrollWidth: chipScroll.scrollWidth,
      chipClientWidth: chipScroll.clientWidth,
      chipScrollLeft: chipScroll.scrollLeft,
      childInert: child.inert
    };
  });
  expect(mediaMetrics.childTop).toBeGreaterThanOrEqual(mediaMetrics.stageTop - 1);
  expect(mediaMetrics.childBottom).toBeLessThanOrEqual(mediaMetrics.stageBottom + 1);
  expect(mediaMetrics.chipColour).toBe("rgb(247, 248, 252)");
  expect(mediaMetrics.chipBackground).toBe("rgba(38, 47, 76, 0.96)");
  expect(mediaMetrics.speakerOverflow).toBe("auto");
  expect(mediaMetrics.speakerScrollHeight).toBeGreaterThanOrEqual(mediaMetrics.speakerClientHeight);
  expect(mediaMetrics.chipScrollWidth).toBeGreaterThan(mediaMetrics.chipClientWidth);
  expect(mediaMetrics.chipScrollLeft).toBeGreaterThan(0);
  expect(mediaMetrics.childInert).toBe(false);
  if (testInfo.project.use.viewport?.height === 768) expect(mediaMetrics.speakerScrollTop).toBeGreaterThan(0);

  await card.locator("[data-mock-service]").evaluate((button) => button.click());
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('.nav-button[data-view="family"]').click();
  await expect(card.locator(".family-rhythm")).toContainText("Actual ChoreOps tasks are shown below");
  await expect(card.locator(".chore-row")).toHaveCount(6);
  await expect(card.locator('[data-card-type="map"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});
