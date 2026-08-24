import { test, expect } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  buildFootballStates,
  FOOTBALL_POLLING_INTERVALS,
  normaliseFootballData
} from "../src/football-provider.mjs";
import {
  APPROVAL_ZOOM_PROJECTS,
  APPROVAL_ZOOM_VIEW_NAMES
} from "./v080-approval-manifest.mjs";

const config = JSON.parse(await readFile(new URL("../config/example.json", import.meta.url), "utf8"));
const cardSource = await readFile(new URL("../frontend/family-hub-card.js", import.meta.url), "utf8");
const APPROVAL_NOW = "2026-08-24T15:08:00.000Z";
const APPROVAL_FOOTBALL_CHECKED_AT = Object.freeze({
  live: "2026-08-24T15:07:00.000Z",
  cached: "2026-08-24T14:55:00.000Z",
  stale: "2026-08-24T12:00:00.000Z"
});

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
    "button.example_doorbell_start_stream": state("button.example_doorbell_start_stream", "unknown"),
    "button.example_doorbell_stop_stream": state("button.example_doorbell_stop_stream", "unknown"),
    "button.example_garage_start_stream": state("button.example_garage_start_stream", "unknown"),
    "button.example_garage_stop_stream": state("button.example_garage_stop_stream", "unknown"),
    "alarm_control_panel.example_home": state("alarm_control_panel.example_home", "disarmed", { supported_features: 63 }),
    "binary_sensor.example_doorbell_motion": state("binary_sensor.example_doorbell_motion", "off"),
    "binary_sensor.example_doorbell_person": state("binary_sensor.example_doorbell_person", "off"),
    "binary_sensor.example_doorbell_ringing": state("binary_sensor.example_doorbell_ringing", "off"),
    "binary_sensor.example_garage_motion": state("binary_sensor.example_garage_motion", "off"),
    "binary_sensor.example_garage_person": state("binary_sensor.example_garage_person", "off"),
    "cover.example_garage": state("cover.example_garage", "closed", { current_position: 0, supported_features: 3 }),
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
    "climate.living_room": state("climate.living_room", "heat", { current_temperature: 20.4, temperature: 21, hvac_action: "heating" }),
    "climate.kitchen": state("climate.kitchen", "heat", { current_temperature: 19.2, temperature: 20, hvac_action: "idle" }),
    "climate.child_one_room": state("climate.child_one_room", "heat_cool", { current_temperature: 18.8, temperature: 19 }),
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

function sixZoneHouseholdConfig() {
  const familyConfig = structuredClone(config);
  const roomTemplate = structuredClone(familyConfig.rooms.find((room) => room.id === "hallway"));
  familyConfig.rooms.push(
    {
      ...structuredClone(roomTemplate),
      id: "utility_test",
      name: "Utility test",
      area_id: "utility_test",
      climate: "climate.utility_test",
      icon: "mdi:washing-machine"
    },
    {
      ...structuredClone(roomTemplate),
      id: "upstairs_test",
      name: "Upstairs test",
      area_id: "upstairs_test",
      climate: "climate.upstairs_test",
      icon: "mdi:stairs"
    }
  );
  return familyConfig;
}

function sixZoneStateOverrides() {
  return {
    "climate.utility_test": state("climate.utility_test", "heat", { current_temperature: 20.5, temperature: 19.5, hvac_action: "idle" }),
    "climate.upstairs_test": state("climate.upstairs_test", "unavailable", { temperature: 18 })
  };
}

function approvalFootballStates(mode = "live") {
  const namedTeams = [
    [1, "Tottenham Hotspur", "TOT", 6],
    [2, "Aston Villa", "AVL", 7],
    [3, "Burnley", "BUR", 90],
    [4, "Newcastle United", "NEW", 4],
    [5, "Arsenal", "ARS", 3],
    [6, "Chelsea", "CHE", 8]
  ];
  const teams = [
    ...namedTeams.map(([id, name, shortName, badgeCode]) => ({ id, name, short_name: shortName, code: badgeCode })),
    ...Array.from({ length: 14 }, (_, index) => ({
      id: index + 7,
      name: `Premier League Club ${index + 7}`,
      short_name: `T${String(index + 7).padStart(2, "0")}`,
      code: index + 101
    }))
  ];
  const fetchedAt = APPROVAL_FOOTBALL_CHECKED_AT[mode] || APPROVAL_FOOTBALL_CHECKED_AT.live;
  const fixtureStats = (homeElement, awayElement) => [{
    identifier: "goals_scored",
    h: homeElement ? [{ element: homeElement, value: 2 }] : [],
    a: awayElement ? [{ element: awayElement, value: 1 }] : []
  }];
  const data = normaliseFootballData({
    bootstrap: {
      teams,
      events: [{
        id: 1,
        is_current: true,
        is_next: false,
        deadline_time: "2026-08-21T17:30:00.000Z"
      }],
      elements: [
        { id: 101, web_name: "Solanke" },
        { id: 102, web_name: "Watkins" }
      ]
    },
    fixtures: [
      {
        id: 101,
        event: 1,
        kickoff_time: "2026-08-24T14:00:00.000Z",
        started: true,
        finished: false,
        finished_provisional: false,
        minutes: 67,
        team_h: 1,
        team_a: 2,
        team_h_score: 2,
        team_a_score: 1,
        stats: fixtureStats(101, 102)
      },
      {
        id: 102,
        event: 1,
        kickoff_time: "2026-08-24T11:30:00.000Z",
        started: true,
        finished: false,
        finished_provisional: true,
        minutes: 90,
        team_h: 3,
        team_a: 4,
        team_h_score: 1,
        team_a_score: 1,
        stats: fixtureStats(null, null)
      },
      {
        id: 103,
        event: 1,
        kickoff_time: "2026-08-25T18:45:00.000Z",
        started: false,
        finished: false,
        finished_provisional: false,
        minutes: 0,
        team_h: 5,
        team_a: 6,
        team_h_score: null,
        team_a_score: null,
        stats: fixtureStats(null, null)
      }
    ],
    spotlightTeamCodes: config.football.spotlight_team_codes,
    fetchedAt
  });
  const built = buildFootballStates(data, config.football, {
    dataStatus: mode === "cached" ? "cached" : "live",
    checkedAt: fetchedAt,
    refreshIntervalMs: FOOTBALL_POLLING_INTERVALS.live
  });
  const states = Object.fromEntries(built.map((entry) => [
    entry.entity_id,
    state(entry.entity_id, entry.state, entry.attributes)
  ]));
  if (mode === "stale") {
    states[config.football.index_entity] = state(config.football.index_entity, "1", {
      ...states[config.football.index_entity].attributes,
      data_status: "stale",
      poller_status: "error",
      last_checked: fetchedAt,
      last_updated: fetchedAt
    });
  }
  return states;
}

async function mount(page, familyConfig = config, stateOverrides = {}, runtimeOptions = {}) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.clock.setFixedTime(new Date(runtimeOptions.fixedNow || APPROVAL_NOW));
  await page.route("**/local/family-dashboard/assets/**", async (route) => {
    const filename = new URL(route.request().url()).pathname.split("/").pop();
    const approvedAssets = new Set(["example-ground.svg", "example-first.svg", "example-living-room-light.svg", "example-kitchen-light.svg"]);
    const body = approvedAssets.has(filename)
      ? await readFile(new URL(`../frontend/assets/${filename}`, import.meta.url), "utf8")
      : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#eef0f4"/></svg>';
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body
    });
  });
  await page.route("**/api/camera_proxy/**", async (route) => {
    const isVacuumMap = route.request().url().includes("camera.example_vacuum_map");
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: isVacuumMap
        ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520"><rect width="800" height="520" rx="28" fill="#F1F5F9"/><path d="M92 86h250v128H211v190H92zM368 86h338v142H558v176H368z" fill="#fff" stroke="#A9B7C8" stroke-width="12" stroke-linejoin="round"/><path d="M211 214h157M558 228v176" fill="none" stroke="#A9B7C8" stroke-width="10"/><path d="M130 363c74-18 124-78 166-130 68-83 167-99 260-70 58 18 92 65 118 121-81 0-139 20-184 62-66 62-143 77-228 52-49-15-90-25-132-35z" fill="none" stroke="#1463E8" stroke-width="9" stroke-linecap="round" stroke-dasharray="7 13"/><circle cx="130" cy="363" r="22" fill="#00A887"/><circle cx="674" cy="284" r="22" fill="#1463E8"/><text x="108" y="472" fill="#5E6B80" font-family="system-ui,sans-serif" font-size="24" font-weight="700">Ground floor cleaning map</text></svg>'
        : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60"><rect width="100" height="60" fill="#eef0f4"/></svg>'
    });
  });
  await page.route("https://resources.premierleague.com/premierleague/badges/**", async (route) => {
    const badgeCode = new URL(route.request().url()).pathname.match(/\/t(\d+)\.png$/)?.[1] || "";
    if (badgeCode === "90") {
      await route.abort("failed");
      return;
    }
    const badge = {
      "3": { code: "ARS", background: "#EF0107", accent: "#FFFFFF" },
      "4": { code: "NEW", background: "#111111", accent: "#FFFFFF" },
      "6": { code: "TOT", background: "#132257", accent: "#FFFFFF" },
      "7": { code: "AVL", background: "#7A263A", accent: "#95BFE5" },
      "8": { code: "CHE", background: "#034694", accent: "#FFFFFF" }
    }[badgeCode] || { code: `T${badgeCode || "?"}`, background: "#243B64", accent: "#FFFFFF" };
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90"><path d="M45 4 79 16v25c0 22-13 37-34 45C24 78 11 63 11 41V16Z" fill="${badge.background}" stroke="${badge.accent}" stroke-width="5"/><text x="45" y="53" fill="${badge.accent}" font-family="system-ui,sans-serif" font-size="20" font-weight="800" text-anchor="middle">${badge.code}</text></svg>`
    });
  });
  await page.setContent(`<!doctype html><html><head><base href="http://homeassistant.local/"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><style>:root{--header-height:56px}html,body{margin:0;width:100%;height:100%;overflow:hidden}ha-card{display:block}ha-icon{display:inline-block}.ha-header{position:fixed;inset:0 0 auto 0;z-index:100;height:56px;background:#171a21;color:#fff;display:flex;align-items:center;padding:0 24px 0 76px;font:20px system-ui}.ha-sidebar{position:fixed;inset:56px auto 0 0;width:52px;background:#191b20}.ha-main{position:absolute;inset:0 0 0 52px;overflow:hidden}</style><div class="ha-header">Family Hub</div><div class="ha-sidebar"></div><div class="ha-main"></div></body></html>`);
  await page.evaluate(() => {
    class HaCard extends HTMLElement {}
    class HaIcon extends HTMLElement {
      static get observedAttributes() {
        return ["icon"];
      }
      connectedCallback() {
        this._renderNavigationGlyph();
      }
      attributeChangedCallback() {
        if (this.isConnected) this._renderNavigationGlyph();
      }
      _renderNavigationGlyph() {
        const parent = this.parentElement;
        if (!parent?.matches(".brand,.nav-button")) return;
        const view = parent.classList.contains("brand") ? "brand" : parent.dataset.view;
        const glyph = {
          brand: "⌂",
          today: "T",
          calendar: "C",
          rooms: "H",
          family: "F",
          entry: "S",
          music: "M",
          football: "B"
        }[view] || "•";
        this.textContent = glyph;
        this.dataset.mockGlyph = glyph;
        this.style.cssText = "display:inline-grid;place-items:center;width:var(--mdc-icon-size,22px);height:var(--mdc-icon-size,22px);font:800 11px/1 system-ui,sans-serif;color:currentColor";
      }
    }
    class MockChildCard extends HTMLElement {
      set hass(value) {
        this._hass = value;
        this._renderMockState?.();
      }
      connectedCallback() {
        if (this._eventsBound) return;
        this._eventsBound = true;
        const root = this.shadowRoot || this;
        root.querySelector("[data-mock-service]")?.addEventListener("click", (event) => {
          this._hass?.callService?.("media_player", "media_play_pause", {
            entity_id: event.currentTarget.dataset.mockEntity || "media_player.kitchen"
          });
        });
      }
    }
    if (!customElements.get("ha-card")) customElements.define("ha-card", HaCard);
    if (!customElements.get("ha-icon")) customElements.define("ha-icon", HaIcon);
    if (!customElements.get("mock-child-card")) customElements.define("mock-child-card", MockChildCard);
    window.loadCardHelpers = async () => ({
      createCardElement(cardConfig) {
        const element = document.createElement("mock-child-card");
        window.__childCardCount += 1;
        element.dataset.instanceId = String(window.__childCardCount);
        element.dataset.cardType = cardConfig.type;
        element.dataset.cardMode = cardConfig.mode || "";
        element.dataset.cardHeight = cardConfig.height || "";
        element.dataset.defaultView = cardConfig.default_view || "";
        element.dataset.rollingDaysSchedule = String(cardConfig.rolling_days_schedule ?? "");
        element.dataset.eventManagement = String(cardConfig.enable_event_management ?? "");
        element.dataset.cameraView = cardConfig.camera_view || "";
        element.dataset.aspectRatio = cardConfig.aspect_ratio || "";
        element.dataset.fitMode = cardConfig.fit_mode || "";
        element.dataset.tapAction = cardConfig.tap_action?.action || "";
        element.dataset.holdAction = cardConfig.hold_action?.action || "";
        element.dataset.entity = cardConfig.entity || cardConfig.entity_id || "";
        if (cardConfig.type === "custom:mediocre-multi-media-player-card") {
          const playerEntries = Array.isArray(cardConfig.media_players) ? cardConfig.media_players : [];
          const initialPlayer = playerEntries.find((entry) => entry.entity_id === cardConfig.entity_id) || playerEntries[0] || {};
          const initialEntity = initialPlayer.entity_id || cardConfig.entity_id || "media_player.kitchen";
          const initialName = initialPlayer.name || "Living room";
          const serviceEntity = playerEntries.find((entry) => entry.entity_id === "media_player.kitchen")?.entity_id || initialEntity;
          const playerChips = playerEntries.map((entry, index) => `<span class="mock-chip ${index === 0 ? "is-active" : ""}">${entry.name || `Room ${index + 1}`}</span>`).join("");
          const playerRows = playerEntries.map((entry) => `<div class="mock-player-row"><span><strong>${entry.name || "Room"}</strong><small>${entry.entity_id === initialEntity ? "Playing" : "Ready to join"}</small></span><b>${entry.entity_id === initialEntity ? "Now" : "+"}</b></div>`).join("");
          element.style.height = cardConfig.height || "754px";
          const mediaRoot = element.attachShadow({ mode: "open" });
          mediaRoot.innerHTML = `<style>
            :host{display:block;height:100%;min-height:0;color:var(--mmpc-on-card);font-family:inherit}
            *{box-sizing:border-box}button{font:inherit}
            .mock-media-player{height:100%;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:18px;padding:18px;background:var(--mmpc-card);color:var(--mmpc-on-card);overflow:hidden}
            .mock-massive,.mock-speaker-scroll{min-width:0;min-height:0;overflow:auto;padding:8px;scrollbar-color:rgba(255,255,255,.24) transparent}
            .mock-massive{display:flex;flex-direction:column}.mock-kicker{color:var(--mmpc-on-card-muted);font-size:12px;font-weight:750;letter-spacing:.08em;text-transform:uppercase}
            .mock-now-playing{margin-top:10px}.mock-now-playing strong{display:block;color:var(--mmpc-on-card);font-size:22px}.mock-now-playing small{display:block;margin-top:5px;color:var(--mmpc-on-card-muted);font-size:13px}
            .mock-artwork{min-height:190px;margin:18px 0;display:grid;place-items:center;border:1px solid rgba(255,255,255,.1);border-radius:20px;background:radial-gradient(circle at 32% 28%,rgba(143,216,203,.52),transparent 32%),linear-gradient(145deg,#1463e8,#061b3a);font-size:54px;color:#fff}
            [data-mock-service]{min-width:48px;min-height:48px;align-self:flex-start;padding:0 18px;border:0;border-radius:14px;background:#1463e8;color:#fff;font-weight:800;cursor:pointer}
            .mock-speaker-scroll>strong,.mock-speaker-scroll>h3{display:block;margin:0;color:var(--mmpc-on-card)}.mock-speaker-scroll>h3{margin-top:22px;font-size:15px}
            .mock-chip-scroll{max-width:100%;margin-top:14px;overflow-x:auto}.mock-chip-row{display:flex;width:max-content;gap:8px;padding-bottom:4px}
            .mock-chip{display:inline-block;padding:9px 18px;border:1px solid var(--mmpc-chip-border);border-radius:999px;background:var(--mmpc-chip-background);color:var(--mmpc-chip-foreground);white-space:nowrap}.mock-chip.is-active{border-color:#8fd8cb}
            .mock-player-row,.mock-queue-row{min-height:64px;margin-top:9px;padding:12px 14px;display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid rgba(255,255,255,.08);border-radius:14px;background:rgba(255,255,255,.055)}
            .mock-player-row strong,.mock-player-row small{display:block;color:var(--mmpc-on-card)}.mock-player-row small{margin-top:3px;color:var(--mmpc-on-card-muted);font-size:12px}.mock-player-row b{color:#8fd8cb}
            .mock-queue-row{min-height:54px;color:var(--mmpc-on-card-muted);font-size:13px}.mock-queue-row strong{color:var(--mmpc-on-card)}
            @media(max-width:620px){.mock-media-player{grid-template-columns:1fr;overflow:auto}.mock-massive,.mock-speaker-scroll{overflow:visible}}
          </style><div class="mock-media-player">
            <section class="mock-massive"><span class="mock-kicker">Now playing</span><div class="mock-now-playing"><strong data-mock-state-name>${initialName}</strong><small data-mock-state-track>Dashboard test song · Test artist</small></div><div class="mock-artwork" aria-hidden="true">♫</div><button type="button" data-mock-service data-mock-entity="${serviceEntity}">Play / pause</button></section>
            <section class="mock-speaker-scroll"><strong>Join media players</strong><div class="mock-chip-scroll"><div class="mock-chip-row">${playerChips}</div></div><h3>Player focus</h3>${playerRows}<h3>Up next</h3>${["Family favourites", "Kitchen radio", "Evening mix", "Recently played"].map((name, index) => `<div class="mock-queue-row"><span><strong>${name}</strong><br>Queue item ${index + 1}</span><b>${index + 1}</b></div>`).join("")}</section>
          </div>`;
          element._renderMockState = () => {
            const playerState = element._hass?.states?.[initialEntity];
            const nameNode = mediaRoot.querySelector("[data-mock-state-name]");
            const trackNode = mediaRoot.querySelector("[data-mock-state-track]");
            if (nameNode) nameNode.textContent = initialPlayer.name || playerState?.attributes?.friendly_name || initialName;
            if (trackNode) trackNode.textContent = playerState?.attributes?.media_title
              ? `${playerState.attributes.media_title}${playerState.attributes.media_artist ? ` · ${playerState.attributes.media_artist}` : ""}`
              : "Ready to play";
          };
        } else if (["custom:daylight-calendar-card", "custom:skylight-calendar-card"].includes(cardConfig.type)) {
          const calendarRoot = element.attachShadow({ mode: "open" });
          const calendarLabels = Object.values(cardConfig.calendar_names || {});
          const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
          calendarRoot.innerHTML = `<style>
            :host{display:block;height:100%;min-height:0;color:#0b1830;font-family:inherit}*{box-sizing:border-box}
            .mock-calendar{height:100%;min-height:0;padding:16px;display:grid;grid-template-rows:auto minmax(0,1fr);gap:14px;background:${cardConfig.color_scheme === "light" ? "#fff" : "#111a2d"};color:${cardConfig.color_scheme === "light" ? "#0b1830" : "#fff"}}
            .mock-calendar-head{display:flex;align-items:center;justify-content:space-between;gap:12px}.mock-calendar-head>strong{font-size:15px}.mock-legends{display:flex;gap:12px;flex-wrap:wrap;color:#5e6b80;font-size:12px;font-weight:700}.mock-legends span{display:flex;align-items:center;gap:5px}.mock-legends i{width:8px;height:8px;border-radius:50%;background:#1463e8}.mock-legends span:nth-child(2) i{background:#e76f51}
            .mock-week{min-height:0;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:7px}.mock-day{min-width:0;padding:10px 8px;border:1px solid #dce4ee;border-radius:14px;background:#f8fafc}.mock-day.is-today{border-color:#8db7f8;background:#f1f6ff;box-shadow:inset 0 3px 0 #1463e8}.mock-day header{display:grid;gap:3px;padding-bottom:9px;border-bottom:1px solid #dce4ee}.mock-day header span{color:#5e6b80;font-size:12px;font-weight:800;text-transform:uppercase}.mock-day header strong{font-size:19px}.mock-event{margin-top:9px;padding:8px;border-left:4px solid #1463e8;border-radius:9px;background:#eaf2ff;color:#0b1830;line-height:1.3}.mock-event strong,.mock-event small{display:block;font-size:12px}.mock-event small{margin-top:3px;color:#5e6b80}.mock-event.is-school{border-color:#e76f51;background:#fff0ed}.mock-empty{margin-top:11px;color:#7a8799;font-size:12px}
            [data-mock-calendar-write]{display:none}
            @media(max-width:620px){.mock-calendar{overflow:auto}.mock-week{min-width:760px}}
          </style><div class="mock-calendar"><div class="mock-calendar-head"><strong>${String(cardConfig.default_view || "week-compact").replace("-compact", "").replace(/^./, (letter) => letter.toUpperCase())} view</strong><div class="mock-legends">${calendarLabels.map((label) => `<span><i></i>${label}</span>`).join("")}</div><button type="button" data-mock-calendar-write aria-hidden="true" tabindex="-1">Add event</button></div><div class="mock-week">${weekdays.map((day, index) => `<section class="mock-day ${index === 0 ? "is-today" : ""}"><header><span>${day.slice(0, 3)}</span><strong>${24 + index}</strong></header>${index === 0 ? '<div class="mock-event"><strong>Family dinner</strong><small>16:08</small></div>' : index === 1 ? '<div class="mock-event is-school"><strong>School assembly</strong><small>17:08</small></div>' : '<div class="mock-empty">Nothing planned</div>'}</section>`).join("")}</div></div>`;
          calendarRoot.querySelector("[data-mock-calendar-write]").addEventListener("click", () => {
            element._hass?.callService?.("calendar", "create_event", { entity_id: "calendar.family" });
          });
        } else if (cardConfig.type === "map") {
          const mapRoot = element.attachShadow({ mode: "open" });
          const markerLabels = (cardConfig.entities || []).map((_, index) => index === 0 ? "P" : `C${index}`);
          mapRoot.innerHTML = `<style>
            :host{display:block;height:100%;min-height:0;font-family:inherit}*{box-sizing:border-box}.mock-map{position:relative;height:100%;min-height:260px;overflow:hidden;border-radius:14px;background:#dfece5}.mock-map::before{content:"";position:absolute;inset:-12%;background:linear-gradient(32deg,transparent 47%,rgba(255,255,255,.96) 48% 52%,transparent 53%),linear-gradient(148deg,transparent 43%,rgba(255,255,255,.82) 44% 48%,transparent 49%),radial-gradient(circle at 25% 25%,#c5dfc2 0 18%,transparent 19%),radial-gradient(circle at 78% 70%,#bed8bb 0 21%,transparent 22%),#dce8e2}.mock-water{position:absolute;inset:auto -8% 8% 30%;height:22%;border-radius:50%;background:#b9ddeb;transform:rotate(-8deg)}.mock-place{position:absolute;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.88);color:#516176;font-size:12px;font-weight:700;box-shadow:0 3px 10px rgba(11,24,48,.12)}.mock-place.home{left:42%;top:48%}.mock-place.school{right:13%;top:20%}.mock-marker{position:absolute;width:42px;height:42px;display:grid;place-items:center;border:4px solid #fff;border-radius:50% 50% 50% 8px;background:#1463e8;color:#fff;font-size:13px;font-weight:850;box-shadow:0 5px 14px rgba(11,24,48,.25);transform:rotate(-45deg)}.mock-marker span{transform:rotate(45deg)}.mock-marker:nth-of-type(1){left:34%;top:37%}.mock-marker:nth-of-type(2){left:59%;top:24%;background:#e76f51}.mock-marker:nth-of-type(3){left:68%;top:59%;background:#00a887}.mock-map-tools{position:absolute;right:12px;top:12px;display:grid;gap:7px}.mock-map-tools span{width:38px;height:38px;display:grid;place-items:center;border:1px solid #dce4ee;border-radius:12px;background:#fff;color:#33445c;font-size:18px;font-weight:800;box-shadow:0 4px 12px rgba(11,24,48,.12)}</style><div class="mock-map" aria-label="Representative Home Assistant family map">${markerLabels.map((label) => `<div class="mock-marker"><span>${label}</span></div>`).join("")}<div class="mock-water"></div><span class="mock-place home">Home</span><span class="mock-place school">School</span><div class="mock-map-tools" aria-hidden="true"><span>⌖</span><span>◎</span></div></div>`;
        } else if (cardConfig.type === "picture-entity") {
          const pictureRoot = element.attachShadow({ mode: "open" });
          if (cardConfig.camera_view === "live") {
            pictureRoot.innerHTML = `<style>:host{display:block;height:100%;min-height:140px}.mock-picture{height:100%;min-height:140px;background:radial-gradient(circle at 50% 45%,#17375d,#070d1b 72%);color:#fff;display:grid;place-items:center;font:700 13px system-ui}</style><div class="mock-picture">Secure camera fixture</div>`;
          } else {
            pictureRoot.innerHTML = `<style>:host{display:block;height:100%;min-height:140px;font-family:inherit}.mock-picture{width:100%;height:100%;min-height:140px;display:block;object-fit:contain;background:#f1f5f9}.mock-picture-status{height:100%;min-height:140px;display:grid;place-items:center;background:#f1f5f9;color:#5e6b80;font-family:inherit;font-size:13px;font-weight:700}</style><img class="mock-picture" alt="Representative robot vacuum map"><div class="mock-picture-status" hidden>Map unavailable</div>`;
            element._renderMockState = () => {
              const pictureState = element._hass?.states?.[cardConfig.entity];
              const picture = pictureRoot.querySelector(".mock-picture");
              const status = pictureRoot.querySelector(".mock-picture-status");
              const unavailable = !pictureState || ["unknown", "unavailable"].includes(String(pictureState.state).toLowerCase());
              picture.hidden = unavailable;
              status.hidden = !unavailable;
              if (!unavailable) picture.src = pictureState.attributes?.entity_picture || `/api/camera_proxy/${encodeURIComponent(cardConfig.entity)}`;
            };
          }
          if (cardConfig.camera_view === "live" && window.__cameraPlayerAutoLoad !== false) {
            setTimeout(() => {
              pictureRoot.querySelector(".mock-picture")?.dispatchEvent(new Event("load", { bubbles: true, composed: true }));
            }, window.__cameraPlayerLoadDelayMs || 0);
          }
        } else {
          element.textContent = `${cardConfig.type} card`;
        }
        return element;
      }
    });
    window.__serviceCalls = [];
    window.__serviceBehaviors = {};
    window.__pendingServiceCalls = [];
    window.__childCardCount = 0;
    window.__apiCalls = [];
    window.__cameraPlayerAutoLoad = true;
    window.__cameraPlayerLoadDelayMs = 0;
  });
  await page.addScriptTag({ type: "module", content: cardSource });
  await page.evaluate(async ({ familyConfig, states, runtimeOptions }) => {
    await customElements.whenDefined("family-hub-card");
    const card = document.createElement("family-hub-card");
    document.querySelector(".ha-main").append(card);
    card.setConfig({ family_config: familyConfig });
    card._cameraStartTimeoutMs = runtimeOptions.cameraStartTimeoutMs ?? card._cameraStartTimeoutMs;
    card._cameraStopTimeoutMs = runtimeOptions.cameraStopTimeoutMs ?? card._cameraStopTimeoutMs;
    card._cameraFrameTimeoutMs = runtimeOptions.cameraFrameTimeoutMs ?? card._cameraFrameTimeoutMs;
    card._cameraSlowMessageMs = runtimeOptions.cameraSlowMessageMs ?? card._cameraSlowMessageMs;
    window.__cameraPlayerAutoLoad = runtimeOptions.cameraPlayerAutoLoad ?? true;
    window.__cameraPlayerLoadDelayMs = runtimeOptions.cameraPlayerLoadDelayMs ?? 0;
    window.__serviceBehaviors = runtimeOptions.serviceBehaviors || {};
    card.hass = {
      states,
      callService(domain, service, data) {
        window.__serviceCalls.push({ domain, service, data });
        const key = `${domain}.${service}:${data?.entity_id || ""}`;
        const behavior = window.__serviceBehaviors[key];
        if (behavior === "reject") return Promise.reject(new Error("simulated camera service failure"));
        if (behavior === "pending") {
          return new Promise((resolve, reject) => {
            window.__pendingServiceCalls.push({ key, resolve, reject });
          });
        }
        return Promise.resolve();
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
  }, { familyConfig, states: { ...fixtureStates(), ...stateOverrides }, runtimeOptions });
  await page.waitForFunction(() => document.querySelector("family-hub-card")?.shadowRoot?.querySelector('[data-current-view="today"]'));
  return pageErrors;
}

async function settlePendingService(page, key, outcome = "resolve") {
  await page.evaluate(({ key, outcome }) => {
    const index = window.__pendingServiceCalls.findIndex((entry) => entry.key === key);
    if (index < 0) throw new Error(`No pending service call for ${key}`);
    const [pending] = window.__pendingServiceCalls.splice(index, 1);
    if (outcome === "reject") pending.reject(new Error("simulated pending camera failure"));
    else pending.resolve();
  }, { key, outcome });
}

async function updateEntityState(card, nextState) {
  await card.evaluate((element, value) => {
    element.hass = {
      ...element._hass,
      states: { ...element._hass.states, [value.entity_id]: value }
    };
  }, nextState);
}

async function emitCameraLoad(card, entityId) {
  await card.locator(`[data-card-type="picture-entity"][data-entity="${entityId}"]`).evaluate((player) => {
    player.shadowRoot.querySelector(".mock-picture").dispatchEvent(new Event("load", { bubbles: true, composed: true }));
  });
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
  await expect(card.locator(".preview-pill")).toHaveCount(0);
  await expect(card).not.toContainText(/Controlled live|mapped rooms|fixtures loaded/i);
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
  await card.locator('[data-mock-calendar-write]').evaluate((button) => button.click());
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('[data-view="today"]').first().click();
  await expect(card.locator(".next-panel")).toContainText("Family dinner");
  await expect(card.locator(".next-panel")).not.toContainText("Finished early appointment");

  expect(pageErrors).toEqual([]);
});

test("reports Today Security from confirmed alerts before availability without guessing an open garage", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  const summary = card.locator(".hero-metrics button[data-view='entry']");

  await expect(summary).toContainText("Quiet at home");
  await expect(summary).toContainText("no entry alerts");

  await updateEntityState(card, state("cover.example_garage", "closing", { supported_features: 3 }));
  await expect(summary).toContainText("Check home");

  await updateEntityStates(card, {
    "cover.example_garage": state("cover.example_garage", "closed", { supported_features: 3 }),
    "alarm_control_panel.example_home": state("alarm_control_panel.example_home", "arming", { supported_features: 3 })
  });
  await expect(summary).toContainText("Alarm changing");
  await expect(summary).not.toContainText("Quiet at home");

  await updateEntityState(card, state("alarm_control_panel.example_home", "disarmed", { supported_features: 3 }));
  await updateEntityState(card, state("binary_sensor.example_garage_person", "on"));
  await expect(summary).toContainText("Check home");

  await updateEntityStates(card, {
    "binary_sensor.example_garage_person": state("binary_sensor.example_garage_person", "off"),
    "cover.example_garage": state("cover.example_garage", "unavailable", { supported_features: 3 })
  });
  await expect(summary).toContainText("Status unavailable");
  await expect(summary).toContainText("entry signals are unavailable");
  await expect(summary).not.toContainText(/open entry|garage open/i);

  await updateEntityStates(card, {
    "cover.example_garage": state("cover.example_garage", "closed", { supported_features: 3 }),
    "binary_sensor.example_doorbell_motion": state("binary_sensor.example_doorbell_motion", "unknown")
  });
  await expect(summary).toContainText("Status unavailable");

  await updateEntityStates(card, {
    "binary_sensor.example_doorbell_motion": state("binary_sensor.example_doorbell_motion", "off"),
    "binary_sensor.example_doorbell_ringing": state("binary_sensor.example_doorbell_ringing", "on"),
    "camera.example_garage": state("camera.example_garage", "unavailable")
  });
  await expect(summary).toContainText("Check home");
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
  await expect(livingHeating.locator(".heating-current-value")).toHaveText("20.4°");
  await expect(livingHeating.locator(".heating-target-value")).toHaveText("21°");
  await expect(livingHeating.locator(".heating-status")).toHaveText("Heating");
  await expect(livingHeating.locator(".heating-power")).toHaveText("On");
  await expect(livingHeating.locator(".heating-target-control")).toHaveAttribute("aria-label", "Living room target temperature, currently 21°");
  await expect(livingHeating.locator('button[data-climate-adjust="-0.5"]')).toHaveAttribute("aria-label", "Lower Living room target from 21°");
  await expect(livingHeating.locator('button[data-climate-adjust="0.5"]')).toHaveAttribute("aria-label", "Raise Living room target from 21°");
  await expect(card.locator('[data-climate-card="climate.kitchen"] .heating-status')).toHaveText("Idle");
  await expect(card.locator('[data-climate-card="climate.child_one_room"] .heating-status')).toHaveText("Auto");
  const childTwoHeating = card.locator('[data-climate-card="climate.child_two_room"]');
  await expect(childTwoHeating.locator(".heating-current-value")).toHaveText("—");
  await expect(childTwoHeating.locator(".heating-target-value")).toHaveText("19.5°");
  await expect(childTwoHeating.locator(".heating-status")).toHaveText("Off");
  await expect(childTwoHeating.locator(".heating-power")).toHaveText("Off");
  const heatingControlSizes = await livingHeating.locator(".heating-power, .heating-stepper button").evaluateAll((controls) => controls.map((control) => {
    const bounds = control.getBoundingClientRect();
    return { width: bounds.width, height: bounds.height };
  }));
  expect(heatingControlSizes.every(({ width, height }) => width >= 44 && height >= 44)).toBe(true);
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

test("v0.8 design approval keeps six accessible heating zones contained at every layout tier", async ({ page }, testInfo) => {
  const sixZoneConfig = sixZoneHouseholdConfig();
  const pageErrors = await mount(page, sixZoneConfig, sixZoneStateOverrides());
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="rooms"]').click();
  await card.locator('[data-home-section="heating"]').click();
  await expect(card.locator(".heating-card")).toHaveCount(6);

  const unavailable = card.locator('[data-climate-card="climate.upstairs_test"]');
  const unavailablePower = unavailable.locator(".heating-power");
  await expect(unavailable.locator(".heating-status")).toHaveText("Unavailable");
  await expect(unavailablePower).toHaveText("—");
  await expect(unavailablePower).toHaveAttribute("aria-label", "Upstairs test heating unavailable");
  await expect(unavailablePower).toBeDisabled();
  expect(await unavailablePower.evaluate((button) => button.hasAttribute("aria-pressed"))).toBe(false);

  const layout = await card.locator(".heating-grid").evaluate((grid) => {
    const gridBounds = grid.getBoundingClientRect();
    const cards = [...grid.querySelectorAll(".heating-card")].map((item) => item.getBoundingClientRect());
    const rows = new Map();
    for (const bounds of cards) {
      const top = Math.round(bounds.top);
      rows.set(top, (rows.get(top) || 0) + 1);
    }
    return {
      zoneCount: grid.dataset.zoneCount,
      columnCount: new Set(cards.map((bounds) => Math.round(bounds.left))).size,
      rowCounts: [...rows.values()],
      horizontalOverflow: grid.scrollWidth - grid.clientWidth,
      cardsInsideHorizontalBounds: cards.every((bounds) => bounds.left >= gridBounds.left - 1 && bounds.right <= gridBounds.right + 1),
      widthSpread: Math.max(...cards.map((bounds) => bounds.width)) - Math.min(...cards.map((bounds) => bounds.width))
    };
  });
  const expectedColumns = testInfo.project.use.viewport.width <= 1279 ? 2 : 3;
  expect(layout.zoneCount).toBe("6");
  expect(layout.columnCount).toBe(expectedColumns);
  expect(layout.rowCounts).toEqual(expectedColumns === 2 ? [2, 2, 2] : [3, 3]);
  expect(layout.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(layout.cardsInsideHorizontalBounds).toBe(true);
  expect(layout.widthSpread).toBeLessThanOrEqual(1);
  if (testInfo.project.name.startsWith("approval-")) {
    await captureApproval(page, testInfo, "home-heating-six");
  }
  await card.locator('[data-climate-card="climate.upstairs_test"]').scrollIntoViewIfNeeded();
  await expectNoRootOverflow(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  const wideLayout = await card.locator(".heating-grid").evaluate((grid) => {
    const cards = [...grid.querySelectorAll(".heating-card")].map((item) => item.getBoundingClientRect());
    const rows = new Map();
    for (const bounds of cards) {
      const top = Math.round(bounds.top);
      rows.set(top, (rows.get(top) || 0) + 1);
    }
    return {
      zoneCount: grid.dataset.zoneCount,
      columnCount: new Set(cards.map((bounds) => Math.round(bounds.left))).size,
      rowCounts: [...rows.values()],
      widthSpread: Math.max(...cards.map((bounds) => bounds.width)) - Math.min(...cards.map((bounds) => bounds.width))
    };
  });
  expect(wideLayout.zoneCount).toBe("6");
  expect(wideLayout.columnCount).toBe(3);
  expect(wideLayout.rowCounts).toEqual([3, 3]);
  expect(wideLayout.widthSpread).toBeLessThanOrEqual(1);
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
  await expect(card.locator(".security-privacy-note")).toContainText("Entry cameras only");
  await expect(card.locator(".security-privacy-note")).toContainText("viewer opens only when you choose it");
  await expect(card.locator(".security-privacy-note")).toContainText("Streams started here stop when you close the view or leave Security");

  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator('[data-card-type="picture-entity"][data-camera-view="live"][data-entity="camera.example_doorbell"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await card.locator('button[data-camera-open="garage"]').click();
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator(".camera-is-starting")).toContainText("Waking camera");
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_garage", "preparing"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator('[data-card-type="picture-entity"][data-camera-view="live"][data-entity="camera.example_garage"]')).toBeVisible();
  await card.locator('button[data-camera-close="garage"]').click();
  await updateEntityState(card, state("camera.example_garage", "idle"));

  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Open garage door");
  for (const selector of [".navigation", ".topbar", ".security-main", ".security-sidebar"]) {
    await expect(card.locator(selector)).toHaveAttribute("inert", "");
    await expect(card.locator(selector)).toHaveAttribute("aria-hidden", "true");
  }
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.confirmAction)).toBe("cancel");
  await card.locator('.nav-button[data-view="today"]').evaluate((button) => button.click());
  await expect(card.locator('[data-current-view="entry"]')).toBeVisible();
  await expect(card.locator(".confirmation-dialog")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.confirmAction)).toBe("confirm");
  await updateEntityState(card, state("binary_sensor.example_garage_motion", "on"));
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.confirmAction)).toBe("confirm");
  await page.keyboard.press("Tab");
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.confirmAction)).toBe("cancel");
  await page.keyboard.press("Escape");
  await expect(card.locator(".confirmation-dialog")).toHaveCount(0);
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.secureCoverAction)).toBe("open_cover");

  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await card.locator('button[data-confirm-action="cancel"]').click();
  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await card.locator('button[data-confirm-action="confirm"]').click();

  await card.locator('button[data-alarm-action="alarm_arm_away"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Arm away");
  await card.locator('button[data-confirm-action="confirm"]').click();

  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } },
    { domain: "cover", service: "open_cover", data: { entity_id: "cover.example_garage" } },
    { domain: "alarm_control_panel", service: "alarm_arm_away", data: { entity_id: "alarm_control_panel.example_home" } }
  ]);
  await expectNoRootOverflow(page);
  expect(pageErrors).toEqual([]);
});

test("separates camera wake-up, first-frame buffering, and live readiness without duplicate starts", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "idle")
  }, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 1_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(card.locator('.camera-is-starting[role="status"][aria-busy="true"]')).toContainText("Waking camera");
  await expect(card.locator(".privacy-badge").filter({ hasText: "Waking camera" })).toHaveCount(1);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } }
  ]);

  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  const player = card.locator('[data-card-type="picture-entity"][data-entity="camera.example_doorbell"]');
  await expect(player).toBeVisible();
  await expect(player).toHaveAttribute("aria-hidden", "true");
  await expect(player).toHaveJSProperty("inert", true);
  await expect(card.locator('.camera-is-buffering[role="status"][aria-busy="true"]')).toContainText("Loading video");
  await expect(card.locator(".privacy-badge").filter({ hasText: "Loading video" })).toHaveCount(1);
  const instance = await player.getAttribute("data-instance-id");

  await updateEntityState(card, state("binary_sensor.example_doorbell_motion", "on"));
  await expect(player).toHaveAttribute("data-instance-id", instance);
  await player.evaluate((element) => {
    element.shadowRoot.querySelector(".mock-picture").dispatchEvent(new Event("load", { bubbles: true }));
  });
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await emitCameraLoad(card, "camera.example_doorbell");
  await expect(card.locator(".camera-live-indicator")).toHaveText("Live");
  await expect(card.locator(".privacy-badge").filter({ hasText: /^Live$/ })).toHaveCount(1);
  await expect(card.locator(".camera-is-buffering")).toHaveCount(0);
  await expect(player).not.toHaveAttribute("aria-hidden", "true");
  await expect(player).toHaveJSProperty("inert", false);
  await expect(player).toHaveAttribute("data-instance-id", instance);
  expect(pageErrors).toEqual([]);
});

test("offers a guarded fallback for a slow Garage player without restarting its stream", async ({ page }) => {
  const pageErrors = await mount(page, config, {}, {
    cameraPlayerAutoLoad: false,
    cameraSlowMessageMs: 1_000,
    cameraFrameTimeoutMs: 3_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();
  await updateEntityState(card, state("camera.example_garage", "preparing"));
  await expect(card.locator(".camera-is-starting")).toContainText("Waking camera");

  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator(".camera-is-buffering")).toContainText("Loading video");
  const player = card.locator('[data-entity="camera.example_garage"]');
  await expect(player).toBeVisible();
  const instance = await player.getAttribute("data-instance-id");
  await expect(card.locator('button[data-camera-reveal="garage"]')).toHaveCount(0);
  await expect(card.locator(".camera-is-buffering")).toContainText("can take around 20 seconds", { timeout: 2_000 });
  await expect(card.locator('button[data-camera-reveal="garage"]')).toHaveText("Show video now");
  await card.locator('button[data-camera-reveal="garage"]').click();
  await expect(card.locator(".camera-live-indicator")).toHaveText("Live");
  await expect(player).toHaveAttribute("data-instance-id", instance);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("rejects tampered and stale slow-player reveal actions", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "idle")
  }, {
    cameraPlayerAutoLoad: false,
    cameraSlowMessageMs: 20,
    cameraFrameTimeoutMs: 10_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  const reveal = card.locator('button[data-camera-reveal="doorbell"]');
  await expect(reveal).toBeVisible();
  const staleToken = await reveal.getAttribute("data-camera-session-token");

  await reveal.evaluate((button) => {
    button.dataset.cameraReveal = "child-bedroom";
    button.click();
  });
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await card.locator('button[data-camera-close="doorbell"]').click();
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator('button[data-camera-open="doorbell"]')).toBeEnabled();

  await card.locator('button[data-camera-open="doorbell"]').click();
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  await expect(card.locator('button[data-camera-reveal="doorbell"]')).toBeVisible();
  await card.evaluate((element, token) => {
    element._revealCameraFrame("doorbell", Number(token));
  }, staleToken);
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await card.evaluate((element) => element._evictCameraChild("doorbell"));
  await card.locator('button[data-camera-reveal="doorbell"]').click();
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await expect(card.locator(".camera-live-indicator")).toHaveCount(0);
  await card.evaluate((element) => {
    element._scheduleRender(true);
  });
  await expect(card.locator('[data-entity="camera.example_doorbell"]')).toBeVisible();
  await expect(card.locator('button[data-camera-reveal="doorbell"]')).toBeVisible();
  await card.locator('button[data-camera-reveal="doorbell"]').click();
  await expect(card.locator(".camera-live-indicator")).toHaveText("Live");
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("cancels during buffering and ignores a late player load", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "idle")
  }, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 10_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await card.locator('[data-entity="camera.example_doorbell"]').evaluate((player) => {
    window.__lateCameraPlayer = player;
  });

  await card.locator('button[data-camera-close="doorbell"]').click();
  await expect(card.locator(".camera-is-stopping")).toContainText("Stopping");
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);
  await page.evaluate(() => {
    window.__lateCameraPlayer.shadowRoot.querySelector(".mock-picture").dispatchEvent(new Event("load", { bubbles: true, composed: true }));
  });
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect(card.locator(".camera-live-indicator")).toHaveCount(0);
  await expect(card.locator(".privacy-badge").filter({ hasText: "Tap to stream" })).toHaveCount(2);
  expect(pageErrors).toEqual([]);
});

test("expires stale Security confirmations and never reverses a moving garage door", async ({ page }) => {
  const pageErrors = await mount(page);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();

  await card.locator('button[data-secure-cover-action="open_cover"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Open garage door");
  await updateEntityState(card, state("cover.example_garage", "opening", { current_position: 20, supported_features: 3 }));
  await expect(card.locator(".confirmation-dialog")).toBeVisible();
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.dataset?.confirmAction)).toBe("cancel");
  await card.locator('button[data-confirm-action="confirm"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await expect.poll(() => card.evaluate((element) => element.shadowRoot.activeElement?.getAttribute("aria-label"))).toBe("Garage controls");
  await expect(card.locator(".garage-action")).toHaveText("Opening…");
  await expect(card.locator(".garage-action")).toBeDisabled();
  expect(await card.locator(".garage-action").evaluate((button) => button.hasAttribute("data-secure-cover-action"))).toBe(false);

  await card.locator(".garage-action").evaluate((button) => {
    button.disabled = false;
    button.dataset.secureCoverAction = "close_cover";
    button.dataset.entity = "cover.example_garage";
    button.click();
  });
  await expect(card.locator(".confirmation-dialog")).toHaveCount(0);

  await card.locator('button[data-alarm-action="alarm_arm_away"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Arm away");
  await updateEntityState(card, state("alarm_control_panel.example_home", "armed_home", { supported_features: 63 }));
  await card.locator('button[data-confirm-action="confirm"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("stops an active exterior stream when the camera fails or configuration reloads", async ({ page }) => {
  const pageErrors = await mount(page, config, {}, { cameraStopTimeoutMs: 100 });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator(".camera-card-slot")).toHaveCount(1);

  await updateEntityState(card, state("camera.example_doorbell", "unavailable"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect.poll(() => card.evaluate((element) => element._cameraBlockedIds.size), { timeout: 2_000 }).toBe(1);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect.poll(() => card.evaluate((element) => element._cameraBlockedIds.size)).toBe(0);
  await expect(card.locator('button[data-camera-open="doorbell"]')).toBeEnabled();
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator(".camera-card-slot")).toHaveCount(1);

  await card.evaluate((element, familyConfig) => element.setConfig({ family_config: familyConfig }), config);
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("serializes repeated camera taps and preserves the live player across card rerenders", async ({ page }) => {
  const startKey = "button.press:button.example_doorbell_start_stream";
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "idle")
  }, { serviceBehaviors: { [startKey]: "pending" } });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(card.locator('.camera-is-starting[role="status"][aria-busy="true"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  const player = card.locator('[data-card-type="picture-entity"][data-entity="camera.example_doorbell"]');
  await expect(player).toHaveAttribute("data-aspect-ratio", "16:9");
  await expect(player).toHaveAttribute("data-fit-mode", "cover");
  await expect(player).toHaveAttribute("data-tap-action", "none");
  await expect(player).toHaveAttribute("data-hold-action", "none");
  const firstInstance = await player.getAttribute("data-instance-id");

  await updateEntityState(card, state("binary_sensor.example_doorbell_motion", "on"));
  await card.locator('button[data-alarm-action="alarm_arm_home"]').click();
  await expect(player).toHaveAttribute("data-instance-id", firstInstance);
  await card.locator('button[data-confirm-action="cancel"]').click();
  await expect(player).toHaveAttribute("data-instance-id", firstInstance);

  await settlePendingService(page, startKey);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect(card.locator('[role="alert"]')).toContainText("stream ended");
  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(player).toBeVisible();
  expect(await player.getAttribute("data-instance-id")).not.toBe(firstInstance);
  expect(pageErrors).toEqual([]);
});

test("keeps switching gated behind Stop and recovers camera failures without raw errors", async ({ page }) => {
  const stopKey = "button.press:button.example_doorbell_stop_stream";
  const pageErrors = await mount(page, config, {}, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 1_000,
    serviceBehaviors: { [stopKey]: "pending" }
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator(".camera-is-buffering")).toContainText("Loading video");
  await expect(card.locator('button[data-camera-open="garage"]')).toBeEnabled();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect(card.locator('.camera-is-stopping[role="status"][aria-busy="true"]')).toContainText("Stopping");
  await expect(card.locator('.camera-is-waiting[role="status"][aria-busy="true"]')).toHaveCount(0);
  await expect(card.locator('button[data-camera-open="garage"]')).toContainText("Please wait");
  expect(await card.locator('button[data-camera-open]').evaluateAll((buttons) => {
    return buttons.length > 0 && buttons.every((button) => button.disabled);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);

  await settlePendingService(page, stopKey);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator(".camera-is-buffering")).toContainText("Loading video");
  await emitCameraLoad(card, "camera.example_garage");
  await expect(card.locator('[data-entity="camera.example_garage"][data-camera-view="live"]')).toBeVisible();
  await expect(card.locator(".camera-live-indicator")).toHaveText("Live");
  expect(pageErrors).toEqual([]);
});

test("does not treat unavailable as stopped or start another camera before a fresh idle state", async ({ page }) => {
  const pageErrors = await mount(page, config, {}, {
    cameraPlayerAutoLoad: false,
    cameraStopTimeoutMs: 500,
    cameraFrameTimeoutMs: 1_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect(card.locator(".camera-is-stopping")).toBeVisible();
  await updateEntityState(card, state("camera.example_doorbell", "unavailable"));

  await expect(card.locator(".camera-is-waiting")).toHaveCount(1, { timeout: 2_000 });
  await expect(card.locator(".camera-is-waiting")).toContainText("Waiting for camera");
  expect(await card.locator('button[data-camera-open]').evaluateAll((buttons) => {
    return buttons.length === 2 && buttons.every((button) => button.disabled);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);
  await expect.poll(() => card.evaluate((element) => element._cameraBlockedIds.size)).toBe(1);

  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect.poll(() => card.evaluate((element) => element._cameraBlockedIds.size)).toBe(0);
  await expect(card.locator('button[data-camera-open="garage"]')).toBeEnabled();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("falls back to paired native camera services for the exact configured exterior entity", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "button.example_garage_start_stream": state("button.example_garage_start_stream", "unavailable"),
    "button.example_garage_stop_stream": state("button.example_garage_stop_stream", "unavailable")
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "camera", service: "turn_on", data: { entity_id: "camera.example_garage" } }
  ]);
  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator('[data-entity="camera.example_garage"]')).toBeVisible();
  await card.locator('button[data-camera-close="garage"]').click();
  await updateEntityState(card, state("camera.example_garage", "idle"));
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "camera", service: "turn_on", data: { entity_id: "camera.example_garage" } },
    { domain: "camera", service: "turn_off", data: { entity_id: "camera.example_garage" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("bounds a failed camera start, performs recovery Stop, and enables a friendly Retry", async ({ page }) => {
  const startKey = "button.press:button.example_garage_start_stream";
  const pageErrors = await mount(page, config, {}, {
    cameraStartTimeoutMs: 50,
    cameraStopTimeoutMs: 50,
    serviceBehaviors: { [startKey]: "pending" }
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect(card.locator(".security-stage .camera-is-waiting")).toContainText("Waiting for camera", { timeout: 2_000 });
  await expect(card.locator('button[aria-label="Retry live view"]')).toHaveCount(0);
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_garage", "idle"));
  await expect(card.locator('[role="alert"]')).toContainText("too long to start", { timeout: 2_000 });
  const retryButtons = card.locator('button[aria-label="Retry live view"]');
  await expect(retryButtons).toHaveCount(2);
  expect(await retryButtons.evaluateAll((buttons) => buttons.every((button) => !button.disabled))).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("disables every camera-open control while recovery Stop is pending", async ({ page }) => {
  const startKey = "button.press:button.example_garage_start_stream";
  const stopKey = "button.press:button.example_garage_stop_stream";
  const pageErrors = await mount(page, config, {}, {
    cameraStartTimeoutMs: 500,
    cameraStopTimeoutMs: 500,
    serviceBehaviors: {
      [startKey]: "reject",
      [stopKey]: "pending"
    }
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();

  await expect(card.locator(".camera-is-stopping")).toContainText("Stopping");
  await expect(card.locator(".camera-is-waiting")).toHaveCount(0);
  await expect(card.locator('button[aria-label="Retry live view"]')).toHaveCount(0);
  await expect(card.locator('button[data-camera-open="doorbell"]')).toContainText("Please wait");
  expect(await card.locator('button[data-camera-open]').evaluateAll((buttons) => {
    return buttons.length > 0 && buttons.every((button) => button.disabled);
  })).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } }
  ]);

  await settlePendingService(page, stopKey);
  await updateEntityState(card, state("camera.example_garage", "idle"));
  const retryButtons = card.locator('button[aria-label="Retry live view"]');
  await expect(retryButtons).toHaveCount(2);
  expect(await retryButtons.evaluateAll((buttons) => buttons.every((button) => !button.disabled))).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("times out a missing first frame, stops safely, and exposes Retry only after idle", async ({ page }) => {
  const pageErrors = await mount(page, config, {}, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 2_000,
    cameraStopTimeoutMs: 500
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();
  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls), { timeout: 5_000 }).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } }
  ]);
  await expect.poll(() => card.evaluate((element) => element._cameraBlockedIds.size), { timeout: 2_000 }).toBe(1);
  await expect(card.locator('button[aria-label="Retry live view"]')).toHaveCount(0);
  expect(await card.locator('button[data-camera-open]').evaluateAll((buttons) => {
    return buttons.length > 0 && buttons.every((button) => button.disabled);
  })).toBe(true);
  await updateEntityState(card, state("camera.example_garage", "idle"));
  await expect(card.locator('[role="alert"]')).toContainText("video took too long to load", { timeout: 2_000 });
  const pickerRetry = card.locator('button[data-camera-open="garage"][aria-label="Retry live view"]');
  const stageRetry = card.locator('button[data-camera-stage-open="garage"][aria-label="Retry live view"]');
  await expect(pickerRetry).toBeEnabled();
  await expect(stageRetry).toBeEnabled();
  await expect(card.locator('button[data-camera-open="doorbell"][aria-label="Retry live view"]')).toHaveCount(0);
  await stageRetry.click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } }
  ]);
  expect(pageErrors).toEqual([]);
});

test("configuration reload cancels a pending Start but still completes the authorized Stop", async ({ page }) => {
  const startKey = "button.press:button.example_garage_start_stream";
  const pageErrors = await mount(page, config, {}, {
    serviceBehaviors: { [startKey]: "pending" }
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="garage"]').click();
  await expect(card.locator(".camera-is-starting")).toBeVisible();

  await card.evaluate((element, familyConfig) => element.setConfig({ family_config: familyConfig }), config);
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await settlePendingService(page, startKey);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_garage", "streaming"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await updateEntityState(card, state("camera.example_garage", "idle"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("configuration reload ignores a late first-frame event and completes the exact Stop", async ({ page }) => {
  const pageErrors = await mount(page, config, {}, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 1_000
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator(".camera-is-buffering")).toBeVisible();
  await card.locator('[data-entity="camera.example_doorbell"]').evaluate((player) => {
    window.__lateReloadPlayer = player;
  });

  await card.evaluate((element, familyConfig) => element.setConfig({ family_config: familyConfig }), config);
  await page.evaluate(() => {
    window.__lateReloadPlayer.shadowRoot.querySelector(".mock-picture").dispatchEvent(new Event("load", { bubbles: true, composed: true }));
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect(card.locator(".camera-live-indicator")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("never starts a stream when its configured stop control is missing", async ({ page }) => {
  const startOnlyConfig = structuredClone(config);
  delete startOnlyConfig.entry.cameras[0].stop_stream_entity;
  const pageErrors = await mount(page, startOnlyConfig);
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();

  const doorbell = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(doorbell.locator(".privacy-badge")).toHaveText(/Controls unavailable/);
  await expect(doorbell.locator('button[data-camera-open="doorbell"]')).toBeDisabled();
  await doorbell.locator('button[data-camera-open="doorbell"]').evaluate((button) => {
    button.disabled = false;
    button.click();
  });
  await expect(doorbell.locator(".camera-card-slot")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("fails closed for unexpected camera states and tampered non-exterior camera ids", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "camera.example_garage": state("camera.example_garage", "recording")
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();
  const garage = card.locator(".security-camera").filter({ hasText: "Garage" });
  await expect(garage.locator('button[data-camera-open="garage"]')).toBeDisabled();
  await garage.locator('button[data-camera-open="garage"]').evaluate((button) => {
    button.disabled = false;
    button.click();
  });
  await card.locator('button[data-camera-open="doorbell"]').evaluate((button) => {
    button.dataset.cameraOpen = "child-bedroom";
    button.click();
  });
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("fails Security unavailable states safely without presenting them as clear or actionable", async ({ page }) => {
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "streaming"),
    "camera.example_garage": state("camera.example_garage", "unavailable"),
    "button.example_doorbell_start_stream": state("button.example_doorbell_start_stream", "unavailable"),
    "alarm_control_panel.example_home": state("alarm_control_panel.example_home", "unavailable", { supported_features: 63 }),
    "cover.example_garage": state("cover.example_garage", "unavailable", { supported_features: 3 }),
    "binary_sensor.example_doorbell_motion": null,
    "binary_sensor.example_garage_motion": state("binary_sensor.example_garage_motion", "unknown")
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="entry"]').click();

  const doorbell = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(doorbell.locator(".security-signal.is-unavailable")).toContainText("Unavailable");
  await expect(doorbell.locator(".privacy-badge")).toHaveText(/Ready to view/);
  await expect(doorbell.locator('button[data-camera-open="doorbell"]')).toBeEnabled();
  const garageCamera = card.locator(".security-camera").filter({ hasText: "Garage" });
  await expect(garageCamera.locator(".privacy-badge")).toHaveText(/Camera unavailable/);
  await expect(garageCamera.locator('button[data-camera-open="garage"]')).toBeDisabled();
  await expect(garageCamera.locator('button[data-camera-open="garage"]')).toHaveText("Unavailable");
  await expect(card.locator(".alarm-actions button")).toHaveCount(3);
  expect(await card.locator(".alarm-actions button").evaluateAll((buttons) => buttons.every((button) => button.disabled))).toBe(true);
  await expect(card.locator(".garage-motion")).toHaveText("Motion unavailable");
  await expect(card.locator(".garage-action")).toHaveText("Unavailable");
  await expect(card.locator(".garage-action")).toBeDisabled();
  expect(await card.locator(".garage-action").evaluate((button) => button.hasAttribute("data-secure-cover-action"))).toBe(false);

  await card.evaluate((element) => {
    const root = element.shadowRoot;
    for (const control of root.querySelectorAll('[data-camera-open="doorbell"], [data-camera-open="garage"], [data-alarm-action]')) {
      control.disabled = false;
      control.click();
    }
    const garage = root.querySelector(".garage-action");
    garage.disabled = false;
    garage.dataset.secureCoverAction = "close_cover";
    garage.dataset.entity = "cover.example_garage";
    garage.click();
  });
  await expect(card.locator(".confirmation-dialog")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
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

test("loads only allowlisted crest_url badges and renders initials for untrusted or legacy fields", async ({ page }) => {
  const blockedUrls = [
    "https://hostile.example/team-badge.png",
    "https://resources.premierleague.com/premierleague/badges/70/t701.png",
    "https://resources.premierleague.com/premierleague/badges/70/t702.png",
    "https://resources.premierleague.com/premierleague/badges/70/t703.png"
  ];
  const requestedBlockedUrls = [];
  page.on("request", (request) => {
    if (blockedUrls.includes(request.url())) requestedBlockedUrls.push(request.url());
  });
  await page.route("https://hostile.example/**", (route) => route.abort("blockedbyclient"));

  const events = [
    {
      id: 901,
      kickoff_time: "2026-08-24T18:00:00.000Z",
      started: false,
      finished: false,
      minutes: 0,
      home: {
        name: "Valid Badge",
        short_name: "VAL",
        crest_url: "https://resources.premierleague.com/premierleague/badges/70/t6.png"
      },
      away: {
        name: "Hostile Badge",
        short_name: "BAD",
        crest_url: blockedUrls[0]
      },
      home_score: null,
      away_score: null,
      home_scorers: [],
      away_scorers: [],
      spotlight: true
    },
    {
      id: 902,
      kickoff_time: "2026-08-25T18:00:00.000Z",
      started: false,
      finished: false,
      minutes: 0,
      home: { name: "Legacy Crest", short_name: "LCR", crest: blockedUrls[1] },
      away: { name: "Legacy Badge", short_name: "LBD", badge_url: blockedUrls[2] },
      home_score: null,
      away_score: null,
      home_scorers: [],
      away_scorers: [],
      spotlight: false
    },
    {
      id: 903,
      kickoff_time: "2026-08-26T18:00:00.000Z",
      started: false,
      finished: false,
      minutes: 0,
      home: { name: "Legacy Logo", short_name: "LGO", logo_url: blockedUrls[3] },
      away: { name: "Initials Only", short_name: "INI" },
      home_score: null,
      away_score: null,
      home_scorers: [],
      away_scorers: [],
      spotlight: false
    }
  ];
  const pageErrors = await mount(page, config, {
    "sensor.family_dashboard_premier_league_gw_1": state("sensor.family_dashboard_premier_league_gw_1", "3", { events })
  });
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="football"]').click();

  await expect(card.locator('.football-hero img[src="https://resources.premierleague.com/premierleague/badges/70/t6.png"]')).toBeVisible();
  for (const code of ["BAD", "LCR", "LBD", "LGO", "INI"]) {
    const mark = card.locator(".fixture .team-mark").filter({ hasText: code }).first();
    await expect(mark.locator("img")).toHaveCount(0);
    await expect(mark.locator("strong")).toHaveAttribute("aria-hidden", "false");
  }
  expect(requestedBlockedUrls).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("enforces read-only mode at every interactive control boundary", async ({ page }, testInfo) => {
  const previewConfig = structuredClone(config);
  previewConfig.display.read_only = true;
  previewConfig.media.players.push(
    { entity_id: "media_player.child_one_room", name: "Child one room", can_be_grouped: true },
    { entity_id: "media_player.child_two_room", name: "Child two room", can_be_grouped: true },
    { entity_id: "media_player.garage", name: "Garage", can_be_grouped: true },
    { entity_id: "media_player.upstairs", name: "Upstairs", can_be_grouped: true }
  );
  previewConfig.features.location_map = false;
  previewConfig.location.entities = [];
  for (const person of previewConfig.people) delete person.location_entity;
  const pageErrors = await mount(page, previewConfig);
  const card = page.locator("family-hub-card");

  await expect(card.locator(".preview-pill")).toHaveCount(0);
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
  await card.locator('[data-mock-calendar-write]').evaluate((button) => button.click());
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await card.locator('.nav-button[data-view="entry"]').click();
  await expect(card.locator('button[data-alarm-action="alarm_arm_home"]')).toBeDisabled();
  await expect(card.locator('button[data-secure-cover-action]')).toBeDisabled();
  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator('[data-card-type="picture-entity"][data-entity="camera.example_doorbell"]')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await card.locator('button[data-camera-close="doorbell"]').click();
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);

  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  const readOnlyDoor = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(readOnlyDoor.locator(".privacy-badge")).toHaveText("Stream off");
  await expect(readOnlyDoor.locator('button[data-camera-open="doorbell"]')).toBeDisabled();
  await expect(readOnlyDoor.locator('button[data-camera-open="doorbell"]')).toHaveText("Stream off");
  await expect(card.locator(".security-stage-poster")).toContainText("Stream off");
  await expect(card.locator(".security-stage-poster")).toContainText("Read-only mode will not start this camera.");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toBeDisabled();
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toHaveText("Read only");

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
    const childRoot = child.shadowRoot;
    const chip = childRoot.querySelector(".mock-chip");
    const chipScroll = childRoot.querySelector(".mock-chip-scroll");
    const speakerScroll = childRoot.querySelector(".mock-speaker-scroll");
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
      chipOverflow: getComputedStyle(chipScroll).overflowX,
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
  expect(mediaMetrics.chipOverflow).toBe("auto");
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

async function updateEntityStates(card, nextStates) {
  await card.evaluate((element, values) => {
    element.hass = {
      ...element._hass,
      states: { ...element._hass.states, ...values }
    };
  }, nextStates);
}

async function expectApprovalQuality(page, { hotspots = false, securityLabels = false } = {}) {
  const card = page.locator("family-hub-card");
  await expectNoRootOverflow(page);
  await expect(card).not.toContainText(/Controlled live|mapped(?:\s+rooms|\s+routines)?|fixtures loaded|provider publishes/i);
  const audit = await card.evaluate((element, options) => {
    const root = element.shadowRoot.querySelector(".view");
    const rootRect = root.getBoundingClientRect();
    const renderedHeading = element.shadowRoot.querySelector(".topbar h1");
    const fontFamily = getComputedStyle(renderedHeading).fontFamily;
    const auditRoots = [root];
    for (let index = 0; index < auditRoots.length; index += 1) {
      for (const node of auditRoots[index].querySelectorAll("*")) {
        if (node.shadowRoot) auditRoots.push(node.shadowRoot);
      }
    }
    const queryAuditRoots = (selector) => auditRoots.flatMap((auditRoot) => [...auditRoot.querySelectorAll(selector)]);
    const typography = queryAuditRoots("*")
      .filter((node) => node.children.length === 0 && node.textContent.trim() && node.getClientRects().length)
      .filter((node) => !node.classList.contains("sr-only"))
      .map((node) => ({ text: node.textContent.trim(), size: Number.parseFloat(getComputedStyle(node).fontSize) }))
      .filter(({ size }) => Number.isFinite(size) && size < 12);
    const controls = queryAuditRoots("button:not([disabled]),select:not([disabled])")
      .filter((node) => node.getClientRects().length)
      .map((node) => {
        const bounds = node.getBoundingClientRect();
        return { label: node.getAttribute("aria-label") || node.textContent.trim(), width: bounds.width, height: bounds.height };
      })
      .filter(({ width, height }) => width < 48 || height < 48);
    const hotspotSizes = options.hotspots
      ? queryAuditRoots("[data-room]").filter((node) => node.getClientRects().length).map((node) => {
        const bounds = node.getBoundingClientRect();
        return { room: node.getAttribute("aria-label"), width: bounds.width, height: bounds.height };
      }).filter(({ width, height }) => width < 48 || height < 48)
      : [];
    const securityLabelSelector = [
      ".security-signal strong",
      ".security-signal small",
      ".privacy-badge",
      ".security-card-heading h2",
      ".security-stage-heading h2",
      ".stage-privacy",
      ".camera-select-action",
      ".garage-action",
      ".alarm-actions button",
      ".security-privacy-note"
    ].join(",");
    const clippedSecurityLabels = options.securityLabels
      ? [...root.querySelectorAll(securityLabelSelector)]
        .filter((node) => node.getClientRects().length)
        .map((node) => ({
          text: node.textContent.trim(),
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          height: node.clientHeight,
          scrollHeight: node.scrollHeight
        }))
        .filter(({ width, scrollWidth, height, scrollHeight }) => scrollWidth > width + 1 || scrollHeight > height + 1)
      : [];
    const fragmentedSecurityLabels = options.securityLabels
      ? [...root.querySelectorAll(".security-signal strong,.security-signal small")]
        .filter((node) => node.getClientRects().length)
        .map((node) => {
          const range = document.createRange();
          range.selectNodeContents(node);
          const lines = [...range.getClientRects()]
            .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
            .length;
          return { text: node.textContent.trim(), lines };
        })
        .filter(({ lines }) => lines > 1)
      : [];
    const securityCardBounds = options.securityLabels
      ? [...root.querySelectorAll(".security-camera")].map((node) => {
        const bounds = node.getBoundingClientRect();
        const picker = node.closest(".security-camera-picker")?.getBoundingClientRect();
        const visibleChildren = [...node.querySelectorAll(".security-card-heading,.security-card-heading h2,.privacy-badge,.security-signals,.camera-select-action")]
          .filter((child) => child.getClientRects().length)
          .map((child) => {
            const childBounds = child.getBoundingClientRect();
            return {
              text: child.textContent.trim(),
              outsideCard: childBounds.left < bounds.left - 1
                || childBounds.right > bounds.right + 1
                || childBounds.top < bounds.top - 1
                || childBounds.bottom > bounds.bottom + 1
            };
          })
          .filter(({ outsideCard }) => outsideCard);
        return {
          label: node.textContent.trim(),
          outsidePicker: !picker
            || bounds.left < picker.left - 1
            || bounds.right > picker.right + 1
            || bounds.top < picker.top - 1
            || bounds.bottom > picker.bottom + 1,
          outsideRoot: bounds.left < rootRect.left - 1
            || bounds.right > rootRect.right + 1
            || bounds.top < rootRect.top - 1
            || bounds.bottom > rootRect.bottom + 1,
          visibleChildren
        };
      }).filter(({ outsidePicker, outsideRoot, visibleChildren }) => outsidePicker || outsideRoot || visibleChildren.length)
      : [];
    return { fontFamily, typography, controls, hotspotSizes, clippedSecurityLabels, fragmentedSecurityLabels, securityCardBounds };
  }, { hotspots, securityLabels });
  expect(audit.fontFamily).toMatch(/system-ui/i);
  expect(audit.typography).toEqual([]);
  expect(audit.controls).toEqual([]);
  expect(audit.hotspotSizes).toEqual([]);
  expect(audit.clippedSecurityLabels).toEqual([]);
  expect(audit.fragmentedSecurityLabels).toEqual([]);
  expect(audit.securityCardBounds).toEqual([]);
}

async function expectContrast(card, checks) {
  const results = await card.evaluate((element, requested) => {
    const composedParent = (node) => node?.parentElement || node?.getRootNode?.()?.host || null;
    const parse = (value) => {
      const serialised = String(value).trim().toLowerCase();
      if (!serialised || serialised === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
      const channels = serialised.match(/[-+]?(?:\d*\.)?\d+/g)?.map(Number) || [];
      if (serialised.startsWith("color(srgb")) {
        return { r: (channels[0] || 0) * 255, g: (channels[1] || 0) * 255, b: (channels[2] || 0) * 255, a: channels[3] ?? 1 };
      }
      return { r: channels[0] || 0, g: channels[1] || 0, b: channels[2] || 0, a: channels[3] ?? 1 };
    };
    const luminance = ({ r, g, b }) => {
      const transform = (channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
    };
    const blend = (front, back) => ({
      r: front.r * front.a + back.r * (1 - front.a),
      g: front.g * front.a + back.g * (1 - front.a),
      b: front.b * front.a + back.b * (1 - front.a),
      a: 1
    });
    const isVisible = (node) => {
      if (!node.getClientRects().length) return false;
      for (let current = node; current; current = composedParent(current)) {
        const style = getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (current.hidden || current.getAttribute?.("aria-hidden") === "true") return false;
      }
      return true;
    };
    const backgroundFor = (foregroundNode, selector) => {
      for (let current = foregroundNode; current; current = composedParent(current)) {
        if (current.matches?.(selector)) return current;
      }
      return null;
    };
    const backdropFor = (node) => {
      const chain = [];
      for (let current = node; current; current = composedParent(current)) chain.unshift(current);
      let colour = { r: 255, g: 255, b: 255, a: 1 };
      let unresolvedBackdrop = false;
      for (const current of chain) {
        const style = getComputedStyle(current);
        const background = parse(style.backgroundColor);
        if (background.a >= 0.999) unresolvedBackdrop = false;
        colour = blend(background, colour);
        if (style.backgroundImage !== "none") unresolvedBackdrop = true;
      }
      return { colour, unresolvedBackdrop };
    };
    const roots = [element.shadowRoot];
    for (let index = 0; index < roots.length; index += 1) {
      for (const node of roots[index].querySelectorAll("*")) {
        if (node.shadowRoot) roots.push(node.shadowRoot);
      }
    }
    return requested.flatMap(({ foreground, background, minimum }) => {
      const foregroundNodes = roots.flatMap((root) => [...root.querySelectorAll(foreground)]).filter(isVisible);
      if (!foregroundNodes.length) return [{ foreground, background, minimum, ratio: 0, missing: true }];
      return foregroundNodes.map((foregroundNode, index) => {
        const backgroundNode = backgroundFor(foregroundNode, background);
        if (!backgroundNode) return { foreground, background, minimum, index, ratio: 0, missing: true };
        const { colour: backgroundColour, unresolvedBackdrop } = backdropFor(foregroundNode);
        const foregroundColour = blend(parse(getComputedStyle(foregroundNode).color), backgroundColour);
        const light = Math.max(luminance(foregroundColour), luminance(backgroundColour));
        const dark = Math.min(luminance(foregroundColour), luminance(backgroundColour));
        return {
          foreground,
          background,
          minimum,
          index,
          text: foregroundNode.textContent.trim(),
          ratio: (light + 0.05) / (dark + 0.05),
          unresolvedBackdrop
        };
      });
    });
  }, checks);
  for (const result of results) {
    const label = `${result.foreground}[${result.index ?? "missing"}] “${result.text || ""}” on ${result.background}`;
    expect(result.missing, `${label} must resolve to a visible foreground with the requested backdrop`).not.toBe(true);
    expect(result.unresolvedBackdrop, `${label} must use a measurable composited backdrop`).not.toBe(true);
    expect(result.ratio, label).toBeGreaterThanOrEqual(result.minimum);
  }
}

async function approvalTextSize(page) {
  return page.locator("family-hub-card").evaluate((element) => {
    const heading = element.shadowRoot?.querySelector(".topbar h1");
    if (!heading) return 0;
    const style = getComputedStyle(heading);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return 0;
    return Number.parseFloat(style.fontSize) || 0;
  });
}

async function setApprovalBrowserZoom(page, enabled, restoreState = null) {
  if (enabled) {
    const viewport = page.viewportSize();
    if (!viewport) throw new Error("Approval browser zoom requires a fixed viewport");
    const zoomedViewport = {
      width: Math.max(320, Math.floor(viewport.width / 2)),
      height: Math.max(320, Math.floor(viewport.height / 2))
    };
    const restoreSnapshot = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      const main = document.querySelector(".ha-main");
      if (window.__v080ApprovalZoomRestore) throw new Error("Approval browser zoom is already active");
      const restore = {
        html: html.getAttribute("style"),
        body: body.getAttribute("style"),
        main: main.getAttribute("style"),
        marker: html.getAttribute("data-v080-browser-zoom"),
        x: window.scrollX,
        y: window.scrollY,
        mainX: main.scrollLeft,
        mainY: main.scrollTop
      };
      window.__v080ApprovalZoomRestore = restore;
      html.dataset.v080BrowserZoom = "200";
      html.style.overflow = "auto";
      body.style.overflow = "visible";
      main.style.overflow = "visible";
      main.scrollTo(0, 0);
      window.scrollTo(0, 0);
      return restore;
    });
    try {
      await page.setViewportSize(zoomedViewport);
      await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
      const measuredViewport = await page.evaluate(() => ({
        width: window.innerWidth,
        height: window.innerHeight,
        narrowLayout: matchMedia("(max-width:760px)").matches
      }));
      return { viewport, zoomedViewport, measuredViewport, restoreSnapshot };
    } catch (error) {
      await setApprovalBrowserZoom(page, false, { viewport, restoreSnapshot }).catch(() => {});
      throw error;
    }
  }
  if (!restoreState) return null;
  await page.setViewportSize(restoreState.viewport);
  const restored = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const main = document.querySelector(".ha-main");
    const restore = window.__v080ApprovalZoomRestore;
    if (!restore) return;
    const restoreStyle = (node, value) => value === null ? node.removeAttribute("style") : node.setAttribute("style", value);
    restoreStyle(html, restore.html);
    restoreStyle(body, restore.body);
    restoreStyle(main, restore.main);
    if (restore.marker === null) delete html.dataset.v080BrowserZoom;
    else html.setAttribute("data-v080-browser-zoom", restore.marker);
    main.scrollTo(restore.mainX, restore.mainY);
    window.scrollTo(restore.x, restore.y);
    delete window.__v080ApprovalZoomRestore;
    return {
      html: html.getAttribute("style"),
      body: body.getAttribute("style"),
      main: main.getAttribute("style"),
      marker: html.getAttribute("data-v080-browser-zoom"),
      x: window.scrollX,
      y: window.scrollY,
      mainX: main.scrollLeft,
      mainY: main.scrollTop
    };
  });
  await page.evaluate(() => new Promise((resolveFrame) => requestAnimationFrame(() => requestAnimationFrame(resolveFrame))));
  const measuredViewport = await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  return { ...restored, measuredViewport };
}

async function auditApprovalTextZoom(page, testInfo, name) {
  const beforeTextSize = await approvalTextSize(page);
  const zoomState = await setApprovalBrowserZoom(page, true);
  try {
    const afterTextSize = await approvalTextSize(page);
    const horizontalScale = zoomState.viewport.width / zoomState.measuredViewport.width;
    const verticalScale = zoomState.viewport.height / zoomState.measuredViewport.height;
    const physicalTextScale = (afterTextSize * horizontalScale) / beforeTextSize;
    expect(beforeTextSize, `${name} must expose visible text before zoom`).toBeGreaterThan(0);
    expect(afterTextSize, `${name} must expose visible text after zoom reflow`).toBeGreaterThan(0);
    expect(Math.abs(zoomState.measuredViewport.width - zoomState.zoomedViewport.width), `${name} must use the requested 200% CSS viewport width`).toBeLessThanOrEqual(1);
    expect(Math.abs(zoomState.measuredViewport.height - zoomState.zoomedViewport.height), `${name} must use the requested 200% CSS viewport height`).toBeLessThanOrEqual(1);
    expect(Math.min(horizontalScale, verticalScale), `${name} must exercise a 200% browser-zoom-equivalent viewport`).toBeGreaterThanOrEqual(1.99);
    expect(zoomState.measuredViewport.narrowLayout, `${name} must exercise the responsive layout used by browser zoom`).toBe(true);
    expect(physicalTextScale, `${name} must preserve at least 200%-equivalent physical text scaling`).toBeGreaterThanOrEqual(1.9);
    const navigationButtons = page.locator("family-hub-card").locator(".nav-button");
    for (let index = 0; index < await navigationButtons.count(); index += 1) {
      await expect(navigationButtons.nth(index), `${name} navigation button ${index + 1} must retain an explicit label when its visual label is hidden`).toHaveAttribute("aria-label", /\S/);
    }
    const navigationIcons = page.locator("family-hub-card").locator(".nav-button ha-icon");
    for (let index = 0; index < await navigationIcons.count(); index += 1) {
      await expect(navigationIcons.nth(index), `${name} navigation icon ${index + 1} must remain visibly identifiable when labels collapse`).toHaveAttribute("data-mock-glyph", /\S/);
    }
    const navigationIconGeometry = await navigationIcons.evaluateAll((icons) => icons.map((icon) => {
      const bounds = icon.getBoundingClientRect();
      return { glyph: icon.dataset.mockGlyph, width: bounds.width, height: bounds.height };
    }));
    expect(new Set(navigationIconGeometry.map(({ glyph }) => glyph)).size, `${name} navigation icons must remain visually distinct at 200%`).toBe(navigationIconGeometry.length);
    expect(navigationIconGeometry.every(({ width, height }) => width >= 18 && height >= 18), `${name} navigation icons must retain a usable visual footprint at 200%`).toBe(true);
    const navigationTargetGeometry = await page.locator("family-hub-card").locator(".navigation > .brand, .navigation .nav-button").evaluateAll((buttons) => buttons.map((button) => {
      const bounds = button.getBoundingClientRect();
      return {
        label: button.getAttribute("aria-label"),
        left: bounds.left,
        right: bounds.right,
        top: bounds.top,
        bottom: bounds.bottom
      };
    }));
    expect(navigationTargetGeometry.map(({ label }) => label), `${name} compact navigation must retain its semantic order`).toEqual([
      "Open Today",
      "Today",
      "Calendar",
      "Home",
      "Family",
      "Security",
      "Music",
      "Football"
    ]);
    expect(navigationTargetGeometry.every((target, index, targets) => index === 0 || target.left >= targets[index - 1].right + 1), `${name} compact navigation targets must stay in visual order without overlap`).toBe(true);
    expect(Math.max(...navigationTargetGeometry.map(({ top }) => top)) - Math.min(...navigationTargetGeometry.map(({ top }) => top)), `${name} compact navigation targets must stay on one aligned row`).toBeLessThanOrEqual(1);
    const exposedNavigationButtons = page.locator("family-hub-card").locator(".navigation:not([aria-hidden='true']):not([inert]) .nav-button");
    for (let index = 0; index < await exposedNavigationButtons.count(); index += 1) {
      await expect(exposedNavigationButtons.nth(index), `${name} exposed navigation button ${index + 1} must retain an accessible name`).toHaveAccessibleName(/\S/);
    }
    const audit = await page.locator("family-hub-card").evaluate((element) => {
      const cardRoot = element.shadowRoot;
      const composedParent = (node) => node?.parentElement || node?.getRootNode?.()?.host || null;
      const isComposedWithin = (node, ancestor) => {
        for (let current = node; current; current = composedParent(current)) {
          if (current === ancestor) return true;
        }
        return false;
      };
      const deepestElementFromPoint = (x, y) => {
        let hit = document.elementFromPoint(x, y);
        while (hit?.shadowRoot?.elementFromPoint) {
          const inner = hit.shadowRoot.elementFromPoint(x, y);
          if (!inner || inner === hit) break;
          hit = inner;
        }
        return hit;
      };
      const isTopmost = (rect, parent) => {
        const left = Math.max(0, rect.left);
        const right = Math.min(window.innerWidth, rect.right);
        const top = Math.max(0, rect.top);
        const bottom = Math.min(window.innerHeight, rect.bottom);
        if (right <= left || bottom <= top) return true;
        const y = top + ((bottom - top) / 2);
        return [0.2, 0.5, 0.8].some((fraction) => {
          const x = left + ((right - left) * fraction);
          const hit = deepestElementFromPoint(x, y);
          return hit && (isComposedWithin(hit, parent) || isComposedWithin(parent, hit));
        });
      };
      const nodeLabel = (node) => {
        if (!node) return "unknown";
        const identity = node.id ? `#${node.id}` : [...node.classList || []].slice(0, 2).map((name) => `.${name}`).join("");
        return `${node.localName || "node"}${identity}`;
      };
      const isVisible = (node) => {
        for (let current = node; current; current = composedParent(current)) {
          if (current.nodeType !== Node.ELEMENT_NODE) continue;
          const style = getComputedStyle(current);
          if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
          if (current.hidden || current.inert || current.getAttribute("aria-hidden") === "true" || current.classList.contains("sr-only")) return false;
        }
        return true;
      };
      const roots = [cardRoot];
      for (let index = 0; index < roots.length; index += 1) {
        for (const node of roots[index].querySelectorAll("*")) {
          if (node.shadowRoot) roots.push(node.shadowRoot);
        }
      }
      const textRects = [];
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let textNode = walker.nextNode(); textNode; textNode = walker.nextNode()) {
          const text = textNode.data.replace(/\s+/g, " ").trim();
          const parent = textNode.parentElement;
          if (!text || !parent || !isVisible(parent)) continue;
          const range = document.createRange();
          range.selectNodeContents(textNode);
          const rects = [...range.getClientRects()]
            .filter((rect) => rect.width > 0.5 && rect.height > 0.5)
            .map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }))
            .filter((rect) => isTopmost(rect, parent));
          const visibleRects = rects.map((rect) => {
            const visible = { ...rect };
            for (let ancestor = parent; ancestor; ancestor = composedParent(ancestor)) {
              if (ancestor.nodeType !== Node.ELEMENT_NODE) continue;
              const style = getComputedStyle(ancestor);
              const bounds = ancestor.getBoundingClientRect();
              if (["auto", "scroll", "hidden", "clip"].includes(style.overflowX)) {
                visible.left = Math.max(visible.left, bounds.left);
                visible.right = Math.min(visible.right, bounds.right);
              }
              if (["auto", "scroll", "hidden", "clip"].includes(style.overflowY)) {
                visible.top = Math.max(visible.top, bounds.top);
                visible.bottom = Math.min(visible.bottom, bounds.bottom);
              }
            }
            visible.width = visible.right - visible.left;
            visible.height = visible.bottom - visible.top;
            return visible;
          }).filter((rect) => rect.width > 0.5 && rect.height > 0.5);
          if (rects.length) textRects.push({ text: text.slice(0, 80), parent, rects, visibleRects });
        }
      }
      const clipped = [];
      const clippedKeys = new Set();
      for (const entry of textRects) {
        for (const rect of entry.rects) {
          let horizontalScrollReach = false;
          let verticalScrollReach = false;
          for (let ancestor = entry.parent; ancestor; ancestor = composedParent(ancestor)) {
            if (ancestor.nodeType !== Node.ELEMENT_NODE) continue;
            const style = getComputedStyle(ancestor);
            const overflowX = style.overflowX;
            const overflowY = style.overflowY;
            const bounds = ancestor.getBoundingClientRect();
            const scrollableX = ["auto", "scroll"].includes(overflowX) && ancestor.scrollWidth > ancestor.clientWidth + 1;
            const scrollableY = ["auto", "scroll"].includes(overflowY) && ancestor.scrollHeight > ancestor.clientHeight + 1;
            if (["hidden", "clip"].includes(overflowX) && !horizontalScrollReach && (rect.left < bounds.left - 1 || rect.right > bounds.right + 1)) {
              const key = `${entry.text}|${nodeLabel(ancestor)}|x`;
              if (!clippedKeys.has(key)) clipped.push({ text: entry.text, ancestor: nodeLabel(ancestor), axis: "horizontal" });
              clippedKeys.add(key);
            }
            if (["hidden", "clip"].includes(overflowY) && !verticalScrollReach && (rect.top < bounds.top - 1 || rect.bottom > bounds.bottom + 1)) {
              const key = `${entry.text}|${nodeLabel(ancestor)}|y`;
              if (!clippedKeys.has(key)) clipped.push({ text: entry.text, ancestor: nodeLabel(ancestor), axis: "vertical" });
              clippedKeys.add(key);
            }
            horizontalScrollReach ||= scrollableX;
            verticalScrollReach ||= scrollableY;
          }
        }
      }
      const overlaps = [];
      for (let firstIndex = 0; firstIndex < textRects.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < textRects.length; secondIndex += 1) {
          const first = textRects[firstIndex];
          const second = textRects[secondIndex];
          let intersects = false;
          for (const firstRect of first.visibleRects) {
            for (const secondRect of second.visibleRects) {
              const width = Math.min(firstRect.right, secondRect.right) - Math.max(firstRect.left, secondRect.left);
              const height = Math.min(firstRect.bottom, secondRect.bottom) - Math.max(firstRect.top, secondRect.top);
              if (width > 2 && height > 2) intersects = true;
            }
          }
          if (intersects) overlaps.push({ first: first.text, second: second.text });
        }
      }
      return { clipped, overlaps, textCount: textRects.length };
    });
    expect(audit.textCount, `${name} must audit all visible text at 200%`).toBeGreaterThan(0);
    expect(audit.clipped, `${name} has text clipped by its nearest non-scrollable ancestor at 200%`).toEqual([]);
    expect(audit.overlaps, `${name} has overlapping visible text at 200%`).toEqual([]);
    if (name === "home-heating-six") {
      const heatingLayout = await page.locator("family-hub-card").locator(".heating-grid").evaluate((grid) => {
        const gridBounds = grid.getBoundingClientRect();
        const cards = [...grid.querySelectorAll(".heating-card")].map((item) => item.getBoundingClientRect());
        const rows = new Map();
        for (const bounds of cards) {
          const top = Math.round(bounds.top);
          rows.set(top, (rows.get(top) || 0) + 1);
        }
        return {
          zoneCount: grid.dataset.zoneCount,
          cardCount: cards.length,
          columnCount: new Set(cards.map((bounds) => Math.round(bounds.left))).size,
          rowCounts: [...rows.values()],
          horizontalOverflow: grid.scrollWidth - grid.clientWidth,
          cardsInsideHorizontalBounds: cards.every((bounds) => bounds.left >= gridBounds.left - 1 && bounds.right <= gridBounds.right + 1),
          widthSpread: Math.max(...cards.map((bounds) => bounds.width)) - Math.min(...cards.map((bounds) => bounds.width))
        };
      });
      expect(heatingLayout.zoneCount, `${name} must retain the six-zone contract at 200%`).toBe("6");
      expect(heatingLayout.cardCount, `${name} must render all six zones at 200%`).toBe(6);
      expect(heatingLayout.columnCount, `${name} must reflow to one column at 200%`).toBe(1);
      expect(heatingLayout.rowCounts, `${name} must render one complete zone per row at 200%`).toEqual([1, 1, 1, 1, 1, 1]);
      expect(heatingLayout.horizontalOverflow, `${name} must not overflow horizontally at 200%`).toBeLessThanOrEqual(1);
      expect(heatingLayout.cardsInsideHorizontalBounds, `${name} cards must stay inside the Heating grid at 200%`).toBe(true);
      expect(heatingLayout.widthSpread, `${name} cards must keep equal widths at 200%`).toBeLessThanOrEqual(1);
    }
    if (name.startsWith("football-")) {
      const footballToolbar = page.locator("family-hub-card").locator(".football-toolbar");
      const footballHeading = page.locator("family-hub-card").locator(".football-toolbar > div:first-child");
      const firstFixtureDay = page.locator("family-hub-card").locator(".fixture-day h3").first();
      await expect(footballToolbar, `${name} must render the football toolbar at 200%`).toBeVisible();
      await expect(footballHeading, `${name} must render the football heading at 200%`).toBeVisible();
      await expect(firstFixtureDay, `${name} must render the first fixture date at 200%`).toBeVisible();
      if (name === "football-live") {
        await expect(page.locator("family-hub-card").locator(".football-hero.is-live"), `${name} must retain its live hero at 200%`).toBeVisible();
        await expect(page.locator("family-hub-card").locator(".fixture.is-live").first(), `${name} must retain its live fixture at 200%`).toBeVisible();
        const heroGeometry = await page.locator("family-hub-card").locator(".football-hero").evaluate((hero) => {
          const heroBounds = hero.getBoundingClientRect();
          return [...hero.querySelectorAll(".team-mark.is-hero")].map((mark) => {
            const bounds = mark.getBoundingClientRect();
            return {
              inside: bounds.left >= heroBounds.left - 1
                && bounds.right <= heroBounds.right + 1
                && bounds.top >= heroBounds.top - 1
                && bounds.bottom <= heroBounds.bottom + 1
            };
          });
        });
        expect(heroGeometry.length, `${name} must render both hero crests at 200%`).toBe(2);
        expect(heroGeometry.every(({ inside }) => inside), `${name} hero crests must remain fully inside the hero at 200%`).toBe(true);
      }
      const [toolbarBox, fixtureDayBox] = await Promise.all([footballToolbar.boundingBox(), firstFixtureDay.boundingBox()]);
      expect(toolbarBox, `${name} must measure the football toolbar at 200%`).not.toBeNull();
      expect(fixtureDayBox, `${name} must measure the first fixture date at 200%`).not.toBeNull();
      expect(toolbarBox.y + toolbarBox.height, `${name} football toolbar must not crowd the first fixture date at 200%`).toBeLessThanOrEqual(fixtureDayBox.y - 1);
    }
    if (APPROVAL_ZOOM_PROJECTS.includes(testInfo.project.name) && APPROVAL_ZOOM_VIEW_NAMES.includes(name)) {
      const directory = resolve("test-results/v080-approval/screens", testInfo.project.name);
      await mkdir(directory, { recursive: true });
      const path = resolve(directory, `v080-zoom-${name}.png`);
      await page.screenshot({ path, animations: "disabled", fullPage: true });
      await testInfo.attach(`v0.8 200% zoom ${name} · ${testInfo.project.name}`, { path, contentType: "image/png" });
    }
  } finally {
    const restored = await setApprovalBrowserZoom(page, false, zoomState);
    expect.soft(restored.measuredViewport.width, `${name} must restore the original CSS viewport width`).toBe(zoomState.viewport.width);
    expect.soft(restored.measuredViewport.height, `${name} must restore the original CSS viewport height`).toBe(zoomState.viewport.height);
    for (const key of ["html", "body", "main", "marker", "x", "y", "mainX", "mainY"]) {
      expect.soft(restored[key], `${name} must restore approval zoom state: ${key}`).toBe(zoomState.restoreSnapshot[key]);
    }
  }
}

async function captureApproval(page, testInfo, name, options = {}) {
  await expectApprovalQuality(page, options);
  await page.waitForTimeout(120);
  const directory = resolve("test-results/v080-approval/screens", testInfo.project.name);
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, `v080-${name}.png`);
  await page.screenshot({ path, animations: "disabled" });
  await testInfo.attach(`v0.8 ${name} · ${testInfo.project.name}`, { path, contentType: "image/png" });
  await auditApprovalTextZoom(page, testInfo, name);
}

test("v0.8 design approval captures Today, every Home tab, and global palette smoke views", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("approval-"), "Rendered only by the design approval project");
  const pageErrors = await mount(page, config, {
    ...approvalFootballStates("live"),
    "camera.example_doorbell": state("camera.example_doorbell", "idle"),
    "sensor.child_two_choreops_chore_status_get_dressed": state("sensor.child_two_choreops_chore_status_get_dressed", "pending", {
      chore_name: "Pack school bag, PE kit and filled water bottle",
      default_points: 4
    })
  });
  const card = page.locator("family-hub-card");

  await expect(card.locator(".today-hero")).toContainText("Good afternoon");
  await expect(card.locator(".weather-pill")).toContainText("Partly cloudy");
  await expect(card.locator(".today-weather")).toContainText("Partly cloudy");
  expect((await card.locator(".weather-pill,.today-weather").allTextContents()).join(" ")).not.toContain("Partlycloudy");
  await expect(card.locator(".hero-metrics button[data-view='entry']")).toContainText("Quiet at home");
  await expect(card.locator(".hero-metrics button[data-view='entry']")).not.toContainText("All secure");
  await expectContrast(card, [
    { foreground: ".compact-fixture > span", background: ".compact-fixture", minimum: 4.5 },
    { foreground: ".person-summary small", background: ".person-summary", minimum: 4.5 },
    { foreground: ".person-summary .points", background: ".person-summary", minimum: 4.5 },
    { foreground: ".person-summary .person-initial", background: ".person-summary .person-initial", minimum: 4.5 }
  ]);
  await captureApproval(page, testInfo, "today");

  await updateEntityState(card, state("alarm_control_panel.example_home", "armed_home", { supported_features: 63 }));
  await expect(card.locator(".hero-metrics button[data-view='entry']")).toContainText("Protected");
  await updateEntityState(card, state("alarm_control_panel.example_home", "disarmed", { supported_features: 63 }));

  await card.locator('.nav-button[data-view="rooms"]').click();
  const homeSections = ["rooms", "lights", "heating", "covers", "cleaning"];
  for (const section of homeSections) {
    await card.locator(`[data-home-section="${section}"]`).click();
    await expect(card.locator(`[data-home-section-current="${section}"]`)).toBeVisible();
    if (section === "rooms") {
      await expect(card.locator(".home-drawer")).toBeVisible();
    }
    if (section === "lights") {
      const truncatedLightLabels = await card.locator(".whole-home-control strong,.whole-home-control small").evaluateAll((nodes) => nodes
        .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
        .map((node) => node.textContent.trim()));
      expect(truncatedLightLabels).toEqual([]);
    }
    if (["lights", "heating", "covers"].includes(section)) {
      const gridSelector = section === "lights" ? ".whole-home-grid" : section === "heating" ? ".heating-grid" : ".cover-grid";
      const cardSelector = section === "lights" ? ".whole-home-card" : section === "heating" ? ".heating-card" : ".cover-card";
      const columnCount = await card.locator(gridSelector).evaluate((grid, childSelector) => new Set(
        [...grid.querySelectorAll(childSelector)].map((item) => Math.round(item.getBoundingClientRect().left))
      ).size, cardSelector);
      const viewportWidth = testInfo.project.use.viewport.width;
      const expectedColumns = section === "lights"
        ? viewportWidth <= 1030 ? 2 : 5
        : section === "heating"
          ? viewportWidth <= 1279 ? 2 : 4
          : viewportWidth <= 1030 ? 2 : 4;
      expect(columnCount, `${section} must use the balanced approval grid at ${viewportWidth}px`).toBe(expectedColumns);
    }
    await captureApproval(page, testInfo, `home-${section}`, { hotspots: section === "rooms" });
  }

  for (const [view, name, selector] of [
    ["calendar", "calendar-smoke", ".calendar-view"],
    ["family", "family-smoke", ".family-layout"],
    ["music", "music-smoke", ".media-player-panel"]
  ]) {
    await card.locator(`.nav-button[data-view="${view}"]`).click();
    await expect(card.locator(`[data-current-view="${view}"]`)).toBeVisible();
    await expect(card.locator(selector)).toBeVisible();
    if (view === "family") {
      await expect(card.locator(".map-panel")).toBeVisible();
      await expect(card.locator(".family-sidebar")).toBeVisible();
      await expect(card.locator(".family-scroll-cue")).toContainText("Swipe for everyone");
      const truncatedRoutines = await card.locator(".family-sidebar .chore-row strong,.family-sidebar .chore-row small").evaluateAll((nodes) => {
        return nodes
          .filter((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)
          .map((node) => node.textContent.trim());
      });
      expect(truncatedRoutines).toEqual([]);
      const overwrappedRoutines = await card.locator(".family-sidebar .chore-row strong,.family-sidebar .chore-row small").evaluateAll((nodes) => {
        return nodes
          .map((node) => {
            const range = document.createRange();
            range.selectNodeContents(node);
            const lines = [...range.getClientRects()].filter((rect) => rect.width > 0.5 && rect.height > 0.5).length;
            return { text: node.textContent.trim(), lines };
          })
          .filter(({ lines }) => lines > 2);
      });
      expect(overwrappedRoutines).toEqual([]);
      const internallyScrollablePeople = await card.locator(".family-sidebar .family-person").evaluateAll((people) => people
        .filter((person) => person.scrollHeight > person.clientHeight + 1 || person.scrollWidth > person.clientWidth + 1)
        .map((person) => ({
          name: person.querySelector(".eyebrow")?.textContent?.trim() || "Unknown person",
          horizontalDelta: person.scrollWidth - person.clientWidth,
          verticalDelta: person.scrollHeight - person.clientHeight
        })));
      expect(internallyScrollablePeople).toEqual([]);
      const familyScrollBoundary = await card.locator(".family-sidebar").evaluate((sidebar) => ({
        overflowY: getComputedStyle(sidebar).overflowY,
        needsScroll: sidebar.scrollHeight > sidebar.clientHeight + 1
      }));
      if (familyScrollBoundary.needsScroll) expect(["auto", "scroll"]).toContain(familyScrollBoundary.overflowY);
      await expectContrast(card, [
        { foreground: ".chore-row small", background: ".chore-row", minimum: 4.5 },
        { foreground: ".family-facts span", background: ".family-facts span", minimum: 4.5 },
        { foreground: ".family-person-heading > span", background: ".family-person-heading > span", minimum: 4.5 },
        { foreground: ".chore-row b", background: ".chore-row", minimum: 4.5 }
      ]);
    }
    if (view === "music") {
      await expectContrast(card, [
        { foreground: ".music-meta", background: ".music-meta", minimum: 4.5 },
        { foreground: ".mock-media-player strong", background: ".media-player-stage", minimum: 4.5 },
        { foreground: ".mock-media-player h3", background: ".media-player-stage", minimum: 4.5 },
        { foreground: ".mock-media-player button", background: ".mock-media-player button", minimum: 4.5 }
      ]);
    }
    await captureApproval(page, testInfo, name);
  }
  expect(pageErrors).toEqual([]);
});

test("v0.8 design approval captures the complete secure-camera lifecycle and protected confirmation", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("approval-"), "Rendered only by the design approval project");
  test.setTimeout(120_000);
  const doorbellStopKey = "button.press:button.example_doorbell_stop_stream";
  const garageStartKey = "button.press:button.example_garage_start_stream";
  const pageErrors = await mount(page, config, {
    "camera.example_doorbell": state("camera.example_doorbell", "idle")
  }, {
    cameraPlayerAutoLoad: false,
    cameraFrameTimeoutMs: 120_000,
    cameraSlowMessageMs: 120_000,
    cameraStopTimeoutMs: 120_000,
    serviceBehaviors: {
      [doorbellStopKey]: "pending",
      [garageStartKey]: "reject"
    }
  });
  const card = page.locator("family-hub-card");
  const showSecurityWithConfig = async (familyConfig) => {
    await card.evaluate((element, nextConfig) => element.setConfig({ family_config: nextConfig }), familyConfig);
    await expect(card.locator('[data-current-view="today"]')).toBeVisible();
    await card.locator('.nav-button[data-view="entry"]').click();
    await expect(card.locator('[data-current-view="entry"]')).toBeVisible();
  };
  await card.locator('.nav-button[data-view="entry"]').click();
  await expect(card.locator(".security-stage-poster")).toBeVisible();
  await expectContrast(card, [
    { foreground: ".alarm-actions button.is-danger", background: ".alarm-actions button.is-danger", minimum: 4.5 }
  ]);
  await captureApproval(page, testInfo, "security-idle", { securityLabels: true });

  const readOnlyConfig = structuredClone(config);
  readOnlyConfig.display.read_only = true;
  await showSecurityWithConfig(readOnlyConfig);
  await expect(card.locator(".security-stage-poster")).toContainText("Stream off");
  await expect(card.locator(".security-stage-poster")).toContainText("Read-only mode will not start this camera.");
  await expect(card.locator(".security-stage-poster")).not.toHaveAttribute("role", "alert");
  const readOnlyDoorbell = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(readOnlyDoorbell.locator(".privacy-badge")).toHaveText("Stream off");
  await expect(readOnlyDoorbell.locator('button[data-camera-open="doorbell"]')).toHaveText("Stream off");
  await expect(readOnlyDoorbell.locator('button[data-camera-open="doorbell"]')).toBeDisabled();
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toHaveText("Read only");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toBeDisabled();
  expect(await card.locator("[data-alarm-action],[data-secure-cover-action]").evaluateAll((buttons) => buttons.length === 4 && buttons.every((button) => button.disabled))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await captureApproval(page, testInfo, "security-read-only", { securityLabels: true });

  const signalsOnlyConfig = structuredClone(config);
  const signalsOnlyDoorbell = signalsOnlyConfig.entry.cameras.find((camera) => camera.id === "doorbell");
  delete signalsOnlyDoorbell.entity_id;
  await showSecurityWithConfig(signalsOnlyConfig);
  await expect(card.locator(".security-stage-poster")).toContainText("Signals only");
  await expect(card.locator(".security-stage-poster")).toContainText("Live video is not configured for this entry camera.");
  await expect(card.locator(".security-stage-poster")).not.toHaveAttribute("role", "alert");
  const signalsOnlyDoor = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(signalsOnlyDoor.locator(".privacy-badge")).toHaveText("Signals only");
  await expect(signalsOnlyDoor.locator(".security-signal")).toHaveCount(3);
  await expect(signalsOnlyDoor.locator('button[data-camera-open="doorbell"]')).toHaveText("Signals only");
  await expect(signalsOnlyDoor.locator('button[data-camera-open="doorbell"]')).toBeDisabled();
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toHaveText("Signals only");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await captureApproval(page, testInfo, "security-signals-only", { securityLabels: true });

  await showSecurityWithConfig(config);
  await updateEntityState(card, state("camera.example_doorbell", "recording"));
  const notReadyDoorbell = card.locator(".security-camera").filter({ hasText: "Front door" });
  await expect(notReadyDoorbell.locator(".privacy-badge")).toHaveText("Not ready");
  await expect(notReadyDoorbell.locator('button[data-camera-open="doorbell"]')).toHaveText("Not ready");
  await expect(notReadyDoorbell.locator('button[data-camera-open="doorbell"]')).toBeDisabled();
  await expect(card.locator(".security-stage-poster")).toContainText("Camera not ready");
  await expect(card.locator(".security-stage-poster")).toContainText("Live view cannot start while the camera is in its current state.");
  await expect(card.locator(".security-stage-poster")).not.toHaveAttribute("role", "alert");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toHaveText("Not ready");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toBeDisabled();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([]);
  await captureApproval(page, testInfo, "security-not-ready", { securityLabels: true });
  await updateEntityState(card, state("camera.example_doorbell", "idle"));

  await card.locator('button[data-camera-open="doorbell"]').click();
  await expect(card.locator('.camera-is-starting[aria-busy="true"]')).toContainText("Waking camera");
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } }
  ]);
  await captureApproval(page, testInfo, "security-waking", { securityLabels: true });

  await updateEntityState(card, state("camera.example_doorbell", "streaming"));
  await expect(card.locator('.camera-is-buffering[aria-busy="true"]')).toContainText("Loading video");
  const doorbellPlayer = card.locator('[data-card-type="picture-entity"][data-entity="camera.example_doorbell"]');
  await expect(doorbellPlayer).toBeVisible();
  await expect(doorbellPlayer).toHaveAttribute("aria-hidden", "true");
  await expect(doorbellPlayer).toHaveJSProperty("inert", true);
  await captureApproval(page, testInfo, "security-buffering", { securityLabels: true });

  await card.locator('button[data-alarm-action="alarm_arm_away"]').click();
  await expect(card.locator(".confirmation-dialog")).toContainText("Arm away");
  await expectContrast(card, [
    { foreground: ".confirmation-dialog > p:not(.eyebrow)", background: ".confirmation-dialog", minimum: 4.5 },
    { foreground: ".confirmation-dialog .confirm-primary", background: ".confirmation-dialog .confirm-primary", minimum: 4.5 }
  ]);
  await captureApproval(page, testInfo, "security-confirmation", { securityLabels: true });
  await card.locator('button[data-confirm-action="cancel"]').click();

  await emitCameraLoad(card, "camera.example_doorbell");
  await expect(card.locator(".camera-live-indicator")).toHaveText("Live");
  await expect(card.locator(".camera-is-buffering")).toHaveCount(0);
  await expect(doorbellPlayer).not.toHaveAttribute("aria-hidden", "true");
  await expect(doorbellPlayer).toHaveJSProperty("inert", false);
  await expect(card.locator(".privacy-badge").filter({ hasText: /^Live$/ })).toHaveCount(1);
  await captureApproval(page, testInfo, "security-live", { securityLabels: true });

  await card.locator('button[data-camera-close="doorbell"]').click();
  await expect(card.locator('.camera-is-stopping[aria-busy="true"]')).toContainText("Stopping live view");
  await expect(card.locator(".camera-card-slot")).toHaveCount(0);
  expect(await card.locator("button[data-camera-open]").evaluateAll((buttons) => buttons.length === 2 && buttons.every((button) => button.disabled))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } }
  ]);
  await expect.poll(() => page.evaluate((key) => window.__pendingServiceCalls.some((entry) => entry.key === key), doorbellStopKey)).toBe(true);
  await captureApproval(page, testInfo, "security-stopping", { securityLabels: true });
  await settlePendingService(page, doorbellStopKey);
  await updateEntityState(card, state("camera.example_doorbell", "idle"));
  await expect(card.locator(".camera-is-stopping")).toHaveCount(0);
  await expect(card.locator(".security-stage-poster")).toBeVisible();
  await expect(card.locator('button[data-camera-open="garage"]')).toBeEnabled();

  await card.locator('button[data-camera-open="garage"]').click();
  await expect.poll(() => page.evaluate(() => window.__serviceCalls)).toEqual([
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_doorbell_stop_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_start_stream" } },
    { domain: "button", service: "press", data: { entity_id: "button.example_garage_stop_stream" } }
  ]);
  await expect(card.locator('button[aria-label="Retry live view"]')).toHaveCount(0);
  await updateEntityState(card, state("camera.example_garage", "idle"));
  await expect(card.locator(".security-stage-poster[role='alert']")).toContainText("Live view unavailable", { timeout: 2_000 });
  await expect(card.locator(".security-stage-poster[role='alert']")).toContainText("Live view could not start. Please try again.");
  const retryGarage = card.locator(".security-camera").filter({ hasText: "Garage" });
  await expect(retryGarage.locator(".privacy-badge")).toHaveText("Retry available");
  const garageRetryButtons = card.locator('button[aria-label="Retry live view"]');
  await expect(garageRetryButtons).toHaveCount(2);
  expect(await garageRetryButtons.evaluateAll((buttons) => buttons.every((button) => !button.disabled))).toBe(true);
  await captureApproval(page, testInfo, "security-retry", { securityLabels: true });

  await updateEntityState(card, state("camera.example_garage", "unavailable"));
  await expect(retryGarage.locator(".privacy-badge")).toHaveText("Live view unavailable");
  await expect(card.locator('button[aria-label="Retry live view"]')).toHaveCount(0);
  await expect(retryGarage.locator('button[data-camera-open="garage"]')).toHaveText("Unavailable");
  await expect(retryGarage.locator('button[data-camera-open="garage"]')).toBeDisabled();
  await expect(card.locator('button[data-camera-stage-open="garage"]')).toHaveText("Unavailable");
  await expect(card.locator('button[data-camera-stage-open="garage"]')).toBeDisabled();
  await updateEntityState(card, state("camera.example_garage", "idle"));

  await showSecurityWithConfig(config);
  await updateEntityStates(card, {
    "camera.example_doorbell": state("camera.example_doorbell", "unavailable"),
    "alarm_control_panel.example_home": state("alarm_control_panel.example_home", "triggered", { supported_features: 63 }),
    "binary_sensor.example_doorbell_ringing": state("binary_sensor.example_doorbell_ringing", "on"),
    "cover.example_garage": state("cover.example_garage", "open", { current_position: 100, supported_features: 3 })
  });
  await expect(card.locator(".alarm-panel")).toContainText("Triggered");
  await expect(card.locator(".security-camera").first()).toContainText("Camera unavailable");
  await expect(card.locator('.security-camera').first().locator('button[data-camera-open="doorbell"]')).toHaveText("Unavailable");
  await expect(card.locator('button[data-camera-stage-open="doorbell"]')).toHaveText("Unavailable");
  await captureApproval(page, testInfo, "security-alert-unavailable", { securityLabels: true });
  expect(pageErrors).toEqual([]);
});

test("v0.8 design approval captures live, cached, and stale football health", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("approval-"), "Rendered only by the design approval project");
  expect(Object.values(APPROVAL_FOOTBALL_CHECKED_AT).every((checkedAt) => Date.parse(checkedAt) <= Date.parse(APPROVAL_NOW)), "football approval checks must never be in the future").toBe(true);
  const pageErrors = await mount(page, config, approvalFootballStates("live"));
  const card = page.locator("family-hub-card");
  await card.locator('.nav-button[data-view="football"]').click();
  await expect(card.locator(".football-hero.is-live")).toBeVisible();
  await expect(card.locator(".topbar-time")).toHaveText("16:08");
  await expect(card.locator(".football-freshness.is-live strong")).toHaveText("Scores up to date");
  await expect(card.locator(".football-freshness.is-live small")).toHaveText("Checking every 3 minutes. Checked 16:07.");
  await expect(card.locator('.football-hero img[src="https://resources.premierleague.com/premierleague/badges/70/t6.png"]')).toBeVisible();
  await expect(card.locator('.football-hero img[src="https://resources.premierleague.com/premierleague/badges/70/t7.png"]')).toBeVisible();
  await expect(card.locator('.fixture .team-mark img[src$="/t90.png"]')).toBeHidden();
  await expect(card.locator('.fixture .team-mark').filter({ hasText: "BUR" }).locator("strong")).toHaveAttribute("aria-hidden", "false");
  await expectContrast(card, [
    { foreground: ".fixture .team", background: ".fixture", minimum: 4.5 },
    { foreground: ".spotlight-club small", background: ".spotlight-panel", minimum: 4.5 }
  ]);
  await captureApproval(page, testInfo, "football-live");

  await updateEntityStates(card, approvalFootballStates("cached"));
  await expect(card.locator(".football-freshness.is-cached strong")).toHaveText("Showing saved scores");
  await expect(card.locator(".football-freshness.is-cached small")).toHaveText("Live updates are temporarily unavailable. Checked 15:55.");
  await captureApproval(page, testInfo, "football-cached");

  await updateEntityStates(card, approvalFootballStates("stale"));
  await expect(card.locator(".football-freshness.is-stale strong")).toHaveText("Scores may be delayed");
  await expect(card.locator(".football-freshness.is-stale small")).toHaveText("The latest football check could not complete. Retrying automatically. Checked 13:00.");
  await captureApproval(page, testInfo, "football-stale");
  expect(pageErrors).toEqual([]);
});
