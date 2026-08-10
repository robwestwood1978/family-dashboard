import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FootballProvider,
  buildFootballStates,
  normaliseFootballData
} from "../src/football-provider.mjs";

const teamCodes = ["TOT", "AVL", "ARS", "BOU", "BRE", "BHA", "BUR", "CHE", "CRY", "EVE", "FUL", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "WHU", "WOL"];
const teams = teamCodes.map((code, index) => ({ id: index + 1, short_name: code, name: `Club ${code}` }));
const bootstrap = {
  teams,
  events: Array.from({ length: 38 }, (_, index) => ({
    id: index + 1,
    deadline_time: `2026-08-${String(Math.min(31, 21 + index)).padStart(2, "0")}T18:00:00Z`,
    is_current: index === 0,
    is_next: index === 1
  })),
  elements: [
    { id: 101, web_name: "Spurs scorer" },
    { id: 202, web_name: "Villa scorer" }
  ]
};
const fixtures = [
  {
    id: 1,
    event: 1,
    kickoff_time: "2026-08-21T19:00:00Z",
    started: true,
    finished: true,
    minutes: 90,
    team_h: 1,
    team_a: 2,
    team_h_score: 2,
    team_a_score: 1,
    stats: [{ identifier: "goals_scored", h: [{ element: 101, value: 2 }], a: [{ element: 202, value: 1 }] }]
  },
  {
    id: 2,
    event: 1,
    kickoff_time: "2026-08-22T14:00:00Z",
    started: false,
    finished: false,
    minutes: 0,
    team_h: 3,
    team_a: 4,
    team_h_score: null,
    team_a_score: null,
    stats: []
  }
];
const footballConfig = {
  spotlight_team_codes: ["TOT", "AVL"],
  index_entity: "sensor.family_dashboard_premier_league",
  gameweek_entity_prefix: "sensor.family_dashboard_premier_league_gw_",
  table_entity: "sensor.family_dashboard_premier_league_table"
};

test("normalises 38 matchweeks, scorers, the table and both spotlight clubs", () => {
  const data = normaliseFootballData({
    bootstrap,
    fixtures,
    spotlightTeamCodes: footballConfig.spotlight_team_codes,
    fetchedAt: "2026-08-10T08:00:00.000Z"
  });
  assert.equal(Object.keys(data.gameweeks).length, 38);
  assert.equal(data.gameweeks[1].length, 2);
  assert.deepEqual(data.gameweeks[1][0].home, { id: 1, code: "TOT", short_name: "TOT", name: "Tottenham Hotspur" });
  assert.deepEqual(data.gameweeks[1][0].away, { id: 2, code: "AVL", short_name: "AVL", name: "Aston Villa" });
  assert.deepEqual(data.gameweeks[1][0].home_scorers, ["Spurs scorer ×2"]);
  assert.equal(data.gameweeks[1][0].spotlight, true);
  assert.deepEqual(data.table.slice(0, 2).map((row) => [row.code, row.points, row.spotlight]), [
    ["TOT", 3, true],
    ["ARS", 0, false]
  ]);
  assert.equal(data.table.find((row) => row.code === "AVL").spotlight, true);
  assert.equal(data.table.find((row) => row.code === "AVL").goal_difference, -1);

  const states = buildFootballStates(data, footballConfig);
  assert.equal(states.length, 40);
  assert.equal(states[0].attributes.current_gameweek, 1);
  assert.equal(states[1].attributes.events.length, 2);
  assert.equal(states.at(-1).attributes.rows.length, 20);
});

test("publishes changed live data once and falls back to the last-good cache", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-football-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const cachePath = join(root, "football-cache.json");
  const published = [];
  const fetchImpl = async (url) => ({
    ok: true,
    json: async () => String(url).includes("bootstrap-static") ? bootstrap : fixtures
  });
  const provider = new FootballProvider({
    fetchImpl,
    publish: async (state) => published.push(state),
    cachePath,
    clock: () => new Date("2026-08-10T08:00:00.000Z")
  });

  assert.deepEqual(await provider.refresh(footballConfig), {
    data_status: "live",
    fetched_at: "2026-08-10T08:00:00.000Z",
    published: 40
  });
  assert.equal((await provider.refresh(footballConfig)).published, 0);

  const cachedPublished = [];
  const cachedProvider = new FootballProvider({
    fetchImpl: async () => { throw new Error("source unavailable"); },
    publish: async (state) => cachedPublished.push(state),
    cachePath
  });
  const result = await cachedProvider.refresh(footballConfig);
  assert.equal(result.data_status, "cached");
  assert.equal(result.published, 40);
  assert.equal(cachedPublished[0].attributes.data_status, "cached");
  assert.equal(cachedPublished[1].attributes.events[0].home.short_name, "TOT");
});
