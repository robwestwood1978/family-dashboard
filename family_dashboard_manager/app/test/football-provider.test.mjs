import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  FOOTBALL_POLLING_INTERVALS,
  FootballProvider,
  buildFootballStates,
  createFootballPoller,
  footballRefreshInterval,
  normaliseFplEntry,
  normaliseFootballData,
  publishHomeAssistantState
} from "../src/football-provider.mjs";
import { CURRENT_SCHEMA_VERSION } from "../src/schema-version.mjs";

const teamCodes = ["TOT", "AVL", "ARS", "BOU", "BRE", "BHA", "BUR", "CHE", "CRY", "EVE", "FUL", "LEE", "LIV", "MCI", "MUN", "NEW", "NFO", "SUN", "WHU", "WOL"];
const badgeCodes = [6, 7, 3, 91, 94, 36, 90, 8, 31, 11, 54, 2, 14, 43, 1, 4, 17, 56, 21, 39];
const teams = teamCodes.map((shortName, index) => ({
  id: index + 1,
  code: badgeCodes[index],
  short_name: shortName,
  name: `Club ${shortName}`
}));
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
  provider: "fpl",
  spotlight_team_codes: ["TOT", "AVL"],
  index_entity: "sensor.family_dashboard_premier_league",
  gameweek_entity_prefix: "sensor.family_dashboard_premier_league_gw_",
  table_entity: "sensor.family_dashboard_premier_league_table"
};

test("normalises a configured household FPL entry without exposing manager identity", () => {
  const entry = normaliseFplEntry(
    { person_id: "ernie", entry_id: 12345 },
    {
      name: "Ernie XI",
      current_event: 6,
      summary_overall_points: 351,
      summary_overall_rank: 120034,
      player_first_name: "Private",
      player_last_name: "Name",
      leagues: { classic: [{ id: 9, name: "Family League", entry_rank: 2, entry_last_rank: 3 }] }
    },
    { current: [{ event: 6, points: 61, total_points: 351, overall_rank: 120034, event_transfers: 1, event_transfers_cost: 0 }] }
  );
  assert.deepEqual(entry, {
    person_id: "ernie", entry_id: 12345, team_name: "Ernie XI", gameweek: 6,
    gameweek_points: 61, total_points: 351, overall_rank: 120034, last_rank: 120034,
    transfers: 1, transfer_cost: 0,
    leagues: [{ id: 9, name: "Family League", rank: 2, previous_rank: 3 }],
    squad_status: "unavailable",
    active_chip: null,
    points_on_bench: null,
    squad: [],
    automatic_subs: []
  });
  assert.doesNotMatch(JSON.stringify(entry), /Private|Name/);
});

test("keeps every classic league and exposes a bounded current-gameweek squad", () => {
  const leagues = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `League ${index + 1}`,
    entry_rank: index + 10,
    entry_last_rank: index + 20
  }));
  const squadBootstrap = {
    teams,
    elements: [
      { id: 101, web_name: "Keeper", element_type: 1, team: 1, event_points: 4, status: "a", chance_of_playing_next_round: 100 },
      { id: 202, web_name: "Captain", element_type: 4, team: 2, event_points: 6, status: "d", chance_of_playing_next_round: 75 },
      { id: 303, web_name: "Bench", element_type: 3, team: 3, event_points: 8, status: "a", chance_of_playing_next_round: null }
    ]
  };
  const entry = normaliseFplEntry(
    { person_id: "rob", entry_id: 67890 },
    { name: "Stranger Mings", current_event: 5, summary_overall_points: 379, summary_overall_rank: 85722, leagues: { classic: leagues } },
    { current: [{ event: 5, points: 51, overall_rank: 85722, event_transfers: 0, event_transfers_cost: 0 }] },
    {
      active_chip: "wildcard",
      entry_history: { points_on_bench: 8 },
      picks: [
        { element: 101, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false },
        { element: 202, position: 11, multiplier: 2, is_captain: true, is_vice_captain: false },
        { element: 303, position: 12, multiplier: 0, is_captain: false, is_vice_captain: true }
      ],
      automatic_subs: [{ element_in: 303, element_out: 202, event: 5 }]
    },
    squadBootstrap
  );

  assert.equal(entry.leagues.length, 12);
  assert.equal(entry.leagues.at(-1).name, "League 12");
  assert.equal(entry.active_chip, "wildcard");
  assert.equal(entry.points_on_bench, 8);
  assert.equal(entry.squad_status, "live");
  assert.deepEqual(entry.squad.map((player) => ({
    name: player.name,
    position: player.position,
    bench: player.bench,
    points: player.contribution_points,
    captain: player.captain,
    team_code: player.team_code,
    availability: player.chance_of_playing
  })), [
    { name: "Keeper", position: "GKP", bench: false, points: 4, captain: false, team_code: "TOT", availability: 100 },
    { name: "Captain", position: "FWD", bench: false, points: 12, captain: true, team_code: "AVL", availability: 75 },
    { name: "Bench", position: "MID", bench: true, points: 8, captain: false, team_code: "ARS", availability: null }
  ]);
  assert.deepEqual(entry.automatic_subs, [{ in: 303, out: 202, event: 5 }]);
});

test("fetches current picks for every configured public FPL entry", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-fpl-picks-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const requested = [];
  const published = [];
  const profile = {
    name: "Stranger Mings",
    current_event: 1,
    summary_overall_points: 51,
    summary_overall_rank: 4021221,
    leagues: { classic: [{ id: 1, name: "League", entry_rank: 10, entry_last_rank: 10 }] }
  };
  const history = { current: [{ event: 1, points: 51, overall_rank: 4021221, event_transfers: 0, event_transfers_cost: 0 }] };
  const picks = {
    entry_history: { points_on_bench: 6 },
    picks: [{ element: 101, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false }],
    automatic_subs: []
  };
  const provider = new FootballProvider({
    fetchImpl: async (url) => {
      requested.push(String(url));
      let payload = fixtures;
      if (String(url).includes("bootstrap-static")) payload = bootstrap;
      else if (String(url).endsWith("/history/")) payload = history;
      else if (String(url).includes("/event/1/picks/")) payload = picks;
      else if (String(url).includes("/api/entry/12345/")) payload = profile;
      return { ok: true, json: async () => payload };
    },
    publish: async (state) => published.push(state),
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date("2026-08-10T08:00:00.000Z")
  });

  const result = await provider.refresh({ ...footballConfig, entries: [{ person_id: "rob", entry_id: 12345 }] });
  assert.equal(result.published, 41);
  assert.equal(requested.some((url) => url.endsWith("/api/entry/12345/event/1/picks/")), true);
  const entryState = published.find((state) => state.entity_id === "sensor.family_dashboard_fpl_rob");
  assert.equal(entryState.attributes.squad.length, 1);
  assert.equal(entryState.attributes.squad_status, "live");
  assert.equal(entryState.attributes.points_on_bench, 6);
});

test("retries a transient picks failure before publishing the squad", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-fpl-retry-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  let picksCalls = 0;
  const published = [];
  const provider = new FootballProvider({
    fetchImpl: async (url) => {
      const source = String(url);
      if (source.includes("/event/1/picks/")) {
        picksCalls += 1;
        if (picksCalls < 3) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({
          entry_history: { points_on_bench: 6 },
          picks: [{ element: 101, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false }],
          automatic_subs: []
        }) };
      }
      const payload = source.includes("bootstrap-static")
        ? bootstrap
        : source.endsWith("/history/")
          ? { current: [{ event: 1, points: 51, overall_rank: 99, event_transfers: 0, event_transfers_cost: 0 }] }
          : source.includes("/api/entry/12345/")
            ? { name: "Team", current_event: 1, summary_overall_points: 51, summary_overall_rank: 99, leagues: { classic: [] } }
            : fixtures;
      return { ok: true, json: async () => payload };
    },
    publish: async (state) => published.push(state),
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date("2026-08-10T08:00:00.000Z"),
    wait: async () => {}
  });

  await provider.refresh({ ...footballConfig, entries: [{ person_id: "rob", entry_id: 12345 }] });
  const entryState = published.find((state) => state.entity_id === "sensor.family_dashboard_fpl_rob");
  assert.equal(picksCalls, 3);
  assert.equal(entryState.attributes.squad_status, "live");
  assert.equal(entryState.attributes.squad.length, 1);
});

test("keeps core FPL scores live when the optional picks feed is unavailable", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-fpl-core-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const published = [];
  const provider = new FootballProvider({
    fetchImpl: async (url) => {
      const source = String(url);
      if (source.includes("/event/1/picks/")) return { ok: false, status: 503 };
      const payload = source.includes("bootstrap-static")
        ? bootstrap
        : source.endsWith("/history/")
          ? { current: [{ event: 1, points: 51, overall_rank: 99, event_transfers: 0, event_transfers_cost: 0 }] }
          : source.includes("/api/entry/12345/")
            ? { name: "Team", current_event: 1, summary_overall_points: 51, summary_overall_rank: 99, leagues: { classic: [] } }
            : fixtures;
      return { ok: true, json: async () => payload };
    },
    publish: async (state) => published.push(state),
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date("2026-08-10T08:00:00.000Z"),
    wait: async () => {}
  });

  const result = await provider.refresh({ ...footballConfig, entries: [{ person_id: "rob", entry_id: 12345 }] });
  assert.equal(result.data_status, "live");
  const entryState = published.find((state) => state.entity_id === "sensor.family_dashboard_fpl_rob");
  assert.equal(entryState.state, "51");
  assert.equal(entryState.attributes.squad_status, "unavailable");
  assert.deepEqual(entryState.attributes.squad, []);
});

test("retains the last good current-gameweek squad when every retry fails", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-fpl-squad-cache-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  let picksAvailable = true;
  const published = [];
  const provider = new FootballProvider({
    fetchImpl: async (url) => {
      const source = String(url);
      if (source.includes("/event/1/picks/")) {
        if (!picksAvailable) return { ok: false, status: 503 };
        return { ok: true, json: async () => ({
          entry_history: { points_on_bench: 6 },
          picks: [{ element: 101, position: 1, multiplier: 1, is_captain: false, is_vice_captain: false }],
          automatic_subs: []
        }) };
      }
      const payload = source.includes("bootstrap-static")
        ? bootstrap
        : source.endsWith("/history/")
          ? { current: [{ event: 1, points: 51, overall_rank: 99, event_transfers: 0, event_transfers_cost: 0 }] }
          : source.includes("/api/entry/12345/")
            ? { name: "Team", current_event: 1, summary_overall_points: 51, summary_overall_rank: 99, leagues: { classic: [] } }
            : fixtures;
      return { ok: true, json: async () => payload };
    },
    publish: async (state) => published.push(state),
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date("2026-08-10T08:00:00.000Z"),
    wait: async () => {}
  });

  await provider.refresh({ ...footballConfig, entries: [{ person_id: "rob", entry_id: 12345 }] });
  picksAvailable = false;
  await provider.refresh({ ...footballConfig, entries: [{ person_id: "rob", entry_id: 12345 }] });
  const entryStates = published.filter((state) => state.entity_id === "sensor.family_dashboard_fpl_rob");
  assert.equal(entryStates.at(-1).attributes.squad_status, "cached");
  assert.equal(entryStates.at(-1).attributes.squad.length, 1);
  assert.equal(entryStates.at(-1).attributes.points_on_bench, 6);
});

test("normalises 38 matchweeks, scorers, the table and both spotlight clubs", () => {
  const data = normaliseFootballData({
    bootstrap,
    fixtures,
    spotlightTeamCodes: footballConfig.spotlight_team_codes,
    fetchedAt: "2026-08-10T08:00:00.000Z"
  });
  assert.equal(Object.keys(data.gameweeks).length, 38);
  assert.equal(data.gameweeks[1].length, 2);
  assert.deepEqual(data.gameweeks[1][0].home, {
    id: 1,
    code: "TOT",
    short_name: "TOT",
    name: "Club TOT",
    crest_url: "https://resources.premierleague.com/premierleague/badges/70/t6.png"
  });
  assert.deepEqual(data.gameweeks[1][0].away, {
    id: 2,
    code: "AVL",
    short_name: "AVL",
    name: "Club AVL",
    crest_url: "https://resources.premierleague.com/premierleague/badges/70/t7.png"
  });
  assert.deepEqual(data.gameweeks[1][0].home_scorers, ["Spurs scorer ×2"]);
  assert.equal(data.gameweeks[1][0].spotlight, true);
  assert.equal(data.gameweeks[1][0].finished_provisional, false);
  assert.deepEqual(data.table.slice(0, 2).map((row) => [row.code, row.points, row.spotlight]), [
    ["TOT", 3, true],
    ["ARS", 0, false]
  ]);
  assert.equal(data.table.find((row) => row.code === "AVL").spotlight, true);
  assert.equal(data.table.find((row) => row.code === "AVL").goal_difference, -1);
  assert.equal(data.table.find((row) => row.code === "TOT").crest_url, "https://resources.premierleague.com/premierleague/badges/70/t6.png");
  assert.equal(data.table.find((row) => row.code === "AVL").crest_url, "https://resources.premierleague.com/premierleague/badges/70/t7.png");
  assert.equal(data.table.every((row) => /^https:\/\/resources\.premierleague\.com\/premierleague\/badges\/70\/t\d+\.png$/.test(row.crest_url)), true);

  const states = buildFootballStates(data, footballConfig);
  assert.equal(states.length, 40);
  assert.equal(states[0].attributes.current_gameweek, 1);
  assert.equal(states[0].attributes.poller_status, "healthy");
  assert.equal(states[1].attributes.events.length, 2);
  assert.equal(states[1].attributes.events[0].home.crest_url, "https://resources.premierleague.com/premierleague/badges/70/t6.png");
  assert.equal(states.at(-1).attributes.rows.length, 20);
  assert.equal(states.at(-1).attributes.rows.find((row) => row.code === "AVL").crest_url, "https://resources.premierleague.com/premierleague/badges/70/t7.png");
});

test("keeps the short team code and refuses unsafe badge codes", () => {
  const unsafeBootstrap = {
    ...bootstrap,
    teams: bootstrap.teams.map((team) => team.id === 1
      ? { ...team, code: "6/../../untrusted.svg", short_name: "tot" }
      : team)
  };
  const data = normaliseFootballData({
    bootstrap: unsafeBootstrap,
    fixtures,
    spotlightTeamCodes: footballConfig.spotlight_team_codes,
    fetchedAt: "2026-08-10T08:00:00.000Z"
  });
  assert.deepEqual({
    code: data.gameweeks[1][0].home.code,
    short_name: data.gameweeks[1][0].home.short_name,
    crest_url: data.gameweeks[1][0].home.crest_url
  }, {
    code: "TOT",
    short_name: "TOT",
    crest_url: null
  });
  assert.equal(data.table.find((row) => row.code === "TOT").crest_url, null);
  assert.doesNotMatch(JSON.stringify(data), /untrusted|\.\.\//);
});

test("reports whether Home Assistant created or updated a REST state", async () => {
  const state = {
    entity_id: footballConfig.index_entity,
    state: "1",
    attributes: { friendly_name: "Premier League" }
  };
  for (const [status, created] of [[201, true], [200, false]]) {
    let request;
    const result = await publishHomeAssistantState(state, {
      token: "test-supervisor-token",
      baseUrl: "http://home-assistant.test/api",
      fetchImpl: async (url, options) => {
        request = { url, options };
        return { ok: true, status };
      }
    });
    assert.deepEqual(result, { created });
    assert.equal(request.url, "http://home-assistant.test/api/states/sensor.family_dashboard_premier_league");
    assert.equal(request.options.method, "POST");
  }
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
    checked_at: "2026-08-10T08:00:00.000Z",
    refresh_after_ms: FOOTBALL_POLLING_INTERVALS.quiet,
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
  assert.equal(cachedPublished[0].attributes.poller_status, "degraded");
  assert.equal(cachedPublished[1].attributes.events[0].home.short_name, "TOT");
});

test("replays every football state when Home Assistant recreates the index after a Core restart", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-football-ha-restart-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const checks = [
    "2026-08-10T08:00:00.000Z",
    "2026-08-10T09:00:00.000Z",
    "2026-08-10T10:00:00.000Z"
  ];
  const homeAssistantStates = new Map();
  const provider = new FootballProvider({
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => String(url).includes("bootstrap-static") ? bootstrap : fixtures
    }),
    publish: async (state) => {
      const created = !homeAssistantStates.has(state.entity_id);
      homeAssistantStates.set(state.entity_id, structuredClone(state));
      return { created };
    },
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date(checks.shift())
  });

  assert.equal((await provider.refresh(footballConfig)).published, 40);
  assert.equal(homeAssistantStates.size, 40);
  assert.equal((await provider.refresh(footballConfig)).published, 1);

  homeAssistantStates.clear();
  const recovered = await provider.refresh(footballConfig);
  assert.equal(recovered.published, 40);
  assert.equal(homeAssistantStates.size, 40);
  assert.equal(homeAssistantStates.has(`${footballConfig.gameweek_entity_prefix}38`), true);
  assert.equal(homeAssistantStates.has(footballConfig.table_entity), true);
});

test("publishes a bounded error index immediately on a first refresh failure", async () => {
  const published = [];
  const provider = new FootballProvider({ publish: async (state) => published.push(state) });
  assert.deepEqual(await provider.reportFailure(footballConfig, {
    checkedAt: "2026-08-21T19:15:00.000Z",
    retryAfterMs: FOOTBALL_POLLING_INTERVALS.live
  }), { published: 1 });
  assert.equal(published.length, 1);
  assert.equal(published[0].entity_id, footballConfig.index_entity);
  assert.equal(published[0].state, "unknown");
  assert.deepEqual({
    data_status: published[0].attributes.data_status,
    poller_status: published[0].attributes.poller_status,
    last_checked: published[0].attributes.last_checked,
    next_refresh: published[0].attributes.next_refresh,
    refresh_interval_seconds: published[0].attributes.refresh_interval_seconds
  }, {
    data_status: "stale",
    poller_status: "error",
    last_checked: "2026-08-21T19:15:00.000Z",
    next_refresh: "2026-08-21T19:18:00.000Z",
    refresh_interval_seconds: 180
  });
  assert.doesNotMatch(JSON.stringify(published[0]), /error_message|upstream|secret/i);
});

test("retains the last gameweek during failure and publishes healthy state on recovery", async (context) => {
  const root = await mkdtemp(join(tmpdir(), "family-dashboard-football-recovery-"));
  context.after(() => rm(root, { recursive: true, force: true }));
  const published = [];
  const checks = ["2026-08-10T08:00:00.000Z", "2026-08-10T09:00:00.000Z"];
  const provider = new FootballProvider({
    fetchImpl: async (url) => ({
      ok: true,
      json: async () => String(url).includes("bootstrap-static") ? bootstrap : fixtures
    }),
    publish: async (state) => published.push(structuredClone(state)),
    cachePath: join(root, "football-cache.json"),
    clock: () => new Date(checks.shift())
  });
  await provider.refresh(footballConfig);
  await provider.reportFailure(footballConfig, {
    checkedAt: "2026-08-10T08:30:00.000Z",
    retryAfterMs: FOOTBALL_POLLING_INTERVALS.live
  });
  const failedIndex = published.at(-1);
  assert.equal(failedIndex.entity_id, footballConfig.index_entity);
  assert.equal(failedIndex.state, "1");
  assert.equal(failedIndex.attributes.current_gameweek, 1);
  assert.equal(failedIndex.attributes.poller_status, "error");

  await provider.refresh(footballConfig);
  const recoveredIndex = published.filter((state) => state.entity_id === footballConfig.index_entity).at(-1);
  assert.equal(recoveredIndex.state, "1");
  assert.equal(recoveredIndex.attributes.data_status, "live");
  assert.equal(recoveredIndex.attributes.poller_status, "healthy");
  assert.equal(recoveredIndex.attributes.last_checked, "2026-08-10T09:00:00.000Z");
});

test("preserves FPL provisional completion and treats it as complete for polling", () => {
  const provisionalFixtures = [{
    ...fixtures[0],
    finished: false,
    finished_provisional: true
  }];
  const data = normaliseFootballData({
    bootstrap,
    fixtures: provisionalFixtures,
    spotlightTeamCodes: footballConfig.spotlight_team_codes,
    fetchedAt: "2026-08-21T21:00:00.000Z"
  });
  assert.equal(data.gameweeks[1][0].finished, false);
  assert.equal(data.gameweeks[1][0].finished_provisional, true);
  assert.equal(data.table.find((row) => row.code === "TOT").played, 1);
  assert.equal(data.table.find((row) => row.code === "TOT").points, 3);
  assert.equal(
    footballRefreshInterval(data, new Date("2026-08-21T21:00:00.000Z")),
    FOOTBALL_POLLING_INTERVALS.matchday
  );
});

test("selects live, matchday and quiet polling cadences from fixture state", () => {
  const base = { gameweeks: { 1: [{ kickoff_time: "2026-08-21T19:00:00Z", started: false, finished: false, finished_provisional: false, minutes: 0 }] } };
  assert.equal(footballRefreshInterval(base, new Date("2026-08-21T17:45:00Z")), FOOTBALL_POLLING_INTERVALS.live);
  assert.equal(footballRefreshInterval(base, new Date("2026-08-21T08:00:00Z")), FOOTBALL_POLLING_INTERVALS.matchday);
  assert.equal(footballRefreshInterval(base, new Date("2026-08-20T08:00:00Z")), FOOTBALL_POLLING_INTERVALS.quiet);
  assert.equal(footballRefreshInterval({ gameweeks: { 1: [{ ...base.gameweeks[1][0], started: true, minutes: 34 }] } }, new Date("2026-08-21T19:34:00Z")), FOOTBALL_POLLING_INTERVALS.live);
});

function pollingConfig(overrides = {}) {
  return {
    schema_version: CURRENT_SCHEMA_VERSION,
    features: { football: true },
    football: footballConfig,
    ...overrides
  };
}

function fakeTimers() {
  const scheduled = [];
  return {
    scheduled,
    setTimer(callback, delay) {
      const timer = { callback, delay, cleared: false, unref() {} };
      scheduled.push(timer);
      return timer;
    },
    clearTimer(timer) {
      timer.cleared = true;
    },
    latestActive() {
      return scheduled.findLast((timer) => !timer.cleared);
    }
  };
}

test("schema-v6 polling starts with an immediate refresh and adopts provider cadence", async () => {
  const timers = fakeTimers();
  const calls = [];
  const poller = createFootballPoller({
    store: { readHouseholdConfig: async () => pollingConfig() },
    provider: {
      async refresh(config) {
        calls.push(config);
        return { data_status: "live", refresh_after_ms: FOOTBALL_POLLING_INTERVALS.live };
      }
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer
  });
  poller.start();
  assert.equal(timers.latestActive().delay, 0);
  const result = await poller.tick();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].index_entity, footballConfig.index_entity);
  assert.deepEqual(result, { status: "healthy", next_refresh_ms: FOOTBALL_POLLING_INTERVALS.live });
  assert.equal(timers.latestActive().delay, FOOTBALL_POLLING_INTERVALS.live);
  poller.stop();
});

test("disabled or invalid household configurations never call the provider", async () => {
  for (const config of [
    pollingConfig({ features: { football: false } }),
    pollingConfig({ schema_version: 5 }),
    pollingConfig({ football: null })
  ]) {
    const timers = fakeTimers();
    let refreshes = 0;
    const poller = createFootballPoller({
      store: { readHouseholdConfig: async () => config },
      provider: { refresh: async () => { refreshes += 1; } },
      setTimer: timers.setTimer,
      clearTimer: timers.clearTimer
    });
    poller.start();
    assert.deepEqual(await poller.tick(), { status: "disabled", next_refresh_ms: FOOTBALL_POLLING_INTERVALS.quiet });
    assert.equal(refreshes, 0);
    poller.stop();
  }
});

test("suppresses overlapping refreshes and schedules once after the active refresh", async () => {
  const timers = fakeTimers();
  let release;
  let refreshes = 0;
  const pending = new Promise((resolve) => { release = resolve; });
  const poller = createFootballPoller({
    store: { readHouseholdConfig: async () => pollingConfig() },
    provider: {
      async refresh() {
        refreshes += 1;
        await pending;
        return { data_status: "live", refresh_after_ms: FOOTBALL_POLLING_INTERVALS.matchday };
      }
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer
  });
  poller.start();
  const first = poller.tick();
  await Promise.resolve();
  assert.deepEqual(await poller.tick(), { status: "skipped", reason: "overlap", next_refresh_ms: null });
  assert.equal(refreshes, 1);
  release();
  await first;
  assert.equal(timers.latestActive().delay, FOOTBALL_POLLING_INTERVALS.matchday);
  poller.stop();
});

test("publishes bounded error health and retries promptly after a failed refresh", async () => {
  const timers = fakeTimers();
  const errors = [];
  const reported = [];
  let storeErrorCalls = 0;
  const poller = createFootballPoller({
    store: {
      readHouseholdConfig: async () => pollingConfig(),
      recordError: async () => { storeErrorCalls += 1; },
      getErrors: async () => { storeErrorCalls += 1; },
      clearError: async () => { storeErrorCalls += 1; }
    },
    provider: {
      refresh: async () => { throw new Error("secret-bearing upstream detail"); },
      reportFailure: async (...parts) => reported.push(parts)
    },
    logger: { error: (...parts) => errors.push(parts) },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer
  });
  poller.start();
  assert.deepEqual(await poller.tick(), {
    status: "error",
    error: "refresh_failed",
    next_refresh_ms: FOOTBALL_POLLING_INTERVALS.live
  });
  assert.deepEqual(errors, [["Family Dashboard football update failed", "refresh_failed"]]);
  assert.doesNotMatch(JSON.stringify(errors), /secret-bearing/);
  assert.equal(reported.length, 1);
  assert.equal(reported[0][0], footballConfig);
  assert.deepEqual(reported[0][1], { retryAfterMs: FOOTBALL_POLLING_INTERVALS.live });
  assert.equal(storeErrorCalls, 0);
  assert.equal(timers.latestActive().delay, FOOTBALL_POLLING_INTERVALS.live);
  poller.stop();
});

test("recovery never overwrites or clears DashboardStore's deployment error slot", async () => {
  const timers = fakeTimers();
  let storeErrorCalls = 0;
  let attempt = 0;
  const store = {
    readHouseholdConfig: async () => pollingConfig(),
    recordError: async () => { storeErrorCalls += 1; },
    getErrors: async () => { storeErrorCalls += 1; },
    clearError: async () => { storeErrorCalls += 1; }
  };
  const poller = createFootballPoller({
    store,
    provider: {
      refresh: async () => {
        attempt += 1;
        if (attempt === 1) throw new Error("source unavailable");
        return { data_status: "live", refresh_after_ms: FOOTBALL_POLLING_INTERVALS.live };
      },
      reportFailure: async () => ({ published: 1 })
    },
    logger: { error() {} },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer
  });
  poller.start();
  await poller.tick();
  await poller.tick();
  assert.equal(storeErrorCalls, 0);
  assert.equal(poller.status().status, "healthy");
  poller.stop();
});

test("logs a bounded code when error-health publication also fails", async () => {
  const timers = fakeTimers();
  const errors = [];
  const poller = createFootballPoller({
    store: { readHouseholdConfig: async () => pollingConfig() },
    provider: {
      refresh: async () => { throw new Error("private source failure"); },
      reportFailure: async () => { throw new Error("private publish failure"); }
    },
    logger: { error: (...parts) => errors.push(parts) },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer
  });
  poller.start();
  await poller.tick();
  assert.deepEqual(errors, [
    ["Family Dashboard football status update failed", "status_publish_failed"],
    ["Family Dashboard football update failed", "refresh_failed"]
  ]);
  assert.doesNotMatch(JSON.stringify(errors), /private source|private publish/);
  poller.stop();
});
