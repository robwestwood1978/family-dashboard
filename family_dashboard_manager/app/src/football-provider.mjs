import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";
const DEFAULT_REST_URL = "http://supervisor/core/api";
const GAMEWEEKS = Object.freeze(Array.from({ length: 38 }, (_, index) => index + 1));
const CANONICAL_TEAM_NAMES = Object.freeze({
  TOT: "Tottenham Hotspur",
  AVL: "Aston Villa"
});

function requireToken(token) {
  if (typeof token !== "string" || token.length < 10) {
    throw new Error("Home Assistant Supervisor token is unavailable");
  }
  return token;
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} is not an array`);
  return value;
}

function asInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function compareStrings(left, right) {
  const a = String(left);
  const b = String(right);
  return a < b ? -1 : a > b ? 1 : 0;
}

function normaliseTeam(team) {
  const code = String(team.short_name || team.code || "").toUpperCase();
  return {
    id: asInteger(team.id),
    code,
    short_name: code,
    name: CANONICAL_TEAM_NAMES[code] || String(team.name || code)
  };
}

function scorerNames(fixture, elementsById, side) {
  const goalStats = requireArray(fixture.stats || [], "fixture.stats")
    .find((entry) => entry.identifier === "goals_scored");
  const entries = Array.isArray(goalStats?.[side]) ? goalStats[side] : [];
  return entries.map((entry) => {
    const player = elementsById.get(asInteger(entry.element));
    const name = player?.web_name || player?.second_name || `Player ${entry.element}`;
    const goals = Math.max(1, asInteger(entry.value, 1));
    return goals > 1 ? `${name} ×${goals}` : name;
  });
}

function calculateTable(teams, fixtures, spotlightCodes) {
  const rows = new Map(teams.map((team) => [team.id, {
    team_id: team.id,
    code: team.code,
    name: team.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goals_for: 0,
    goals_against: 0,
    goal_difference: 0,
    points: 0,
    spotlight: spotlightCodes.has(team.code)
  }]));

  for (const fixture of fixtures.filter((entry) => entry.finished === true)) {
    const home = rows.get(asInteger(fixture.team_h));
    const away = rows.get(asInteger(fixture.team_a));
    if (!home || !away) continue;
    const homeScore = asInteger(fixture.team_h_score);
    const awayScore = asInteger(fixture.team_a_score);
    home.played += 1;
    away.played += 1;
    home.goals_for += homeScore;
    home.goals_against += awayScore;
    away.goals_for += awayScore;
    away.goals_against += homeScore;
    if (homeScore > awayScore) {
      home.won += 1;
      home.points += 3;
      away.lost += 1;
    } else if (awayScore > homeScore) {
      away.won += 1;
      away.points += 3;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  const sorted = [...rows.values()]
    .map((row) => ({ ...row, goal_difference: row.goals_for - row.goals_against }))
    .sort((a, b) => (
      b.points - a.points
      || b.goal_difference - a.goal_difference
      || b.goals_for - a.goals_for
      || compareStrings(a.name, b.name)
    ));
  return sorted.map((row, index) => ({ position: index + 1, ...row }));
}

export function normaliseFootballData({ bootstrap, fixtures, spotlightTeamCodes, fetchedAt }) {
  const teams = requireArray(bootstrap?.teams, "bootstrap.teams").map(normaliseTeam);
  const events = requireArray(bootstrap?.events, "bootstrap.events");
  const players = requireArray(bootstrap?.elements, "bootstrap.elements");
  const rawFixtures = requireArray(fixtures, "fixtures");
  if (teams.length !== 20) throw new Error(`expected 20 Premier League teams, received ${teams.length}`);
  const teamsById = new Map(teams.map((team) => [team.id, team]));
  const elementsById = new Map(players.map((player) => [asInteger(player.id), player]));
  const spotlightCodes = new Set(spotlightTeamCodes);
  for (const code of spotlightCodes) {
    if (!teams.some((team) => team.code === code)) throw new Error(`spotlight team ${code} is unavailable`);
  }

  const gameweeks = Object.fromEntries(GAMEWEEKS.map((gameweek) => [gameweek, []]));
  for (const fixture of rawFixtures) {
    const gameweek = asInteger(fixture.event);
    if (gameweek < 1 || gameweek > 38) continue;
    const home = teamsById.get(asInteger(fixture.team_h));
    const away = teamsById.get(asInteger(fixture.team_a));
    if (!home || !away) continue;
    gameweeks[gameweek].push({
      id: asInteger(fixture.id),
      gameweek,
      kickoff_time: fixture.kickoff_time || null,
      started: fixture.started === true,
      finished: fixture.finished === true,
      minutes: asInteger(fixture.minutes),
      home,
      away,
      home_score: fixture.team_h_score ?? null,
      away_score: fixture.team_a_score ?? null,
      home_scorers: scorerNames(fixture, elementsById, "h"),
      away_scorers: scorerNames(fixture, elementsById, "a"),
      spotlight: spotlightCodes.has(home.code) || spotlightCodes.has(away.code)
    });
  }
  for (const entries of Object.values(gameweeks)) {
    entries.sort((a, b) => compareStrings(a.kickoff_time || "", b.kickoff_time || "") || a.id - b.id);
  }

  const currentEvent = events.find((event) => event.is_current);
  const nextEvent = events.find((event) => event.is_next);
  const currentGameweek = currentEvent ? asInteger(currentEvent.id) : null;
  const nextGameweek = nextEvent ? asInteger(nextEvent.id) : null;
  const season = events[0]?.deadline_time
    ? `${new Date(events[0].deadline_time).getUTCFullYear()}/${String(new Date(events[0].deadline_time).getUTCFullYear() + 1).slice(-2)}`
    : null;

  return {
    provider: "fpl",
    fetched_at: fetchedAt,
    spotlight_team_codes: [...spotlightCodes],
    season,
    current_gameweek: currentGameweek,
    next_gameweek: nextGameweek,
    available_gameweeks: GAMEWEEKS,
    gameweeks,
    table: calculateTable(teams, rawFixtures, spotlightCodes)
  };
}

export function buildFootballStates(data, footballConfig, { dataStatus = "live" } = {}) {
  const suggestedGameweek = data.current_gameweek || data.next_gameweek || 1;
  const states = [{
    entity_id: footballConfig.index_entity,
    state: String(suggestedGameweek),
    attributes: {
      friendly_name: "Premier League",
      icon: "mdi:soccer",
      provider: data.provider,
      season: data.season,
      data_status: dataStatus,
      last_updated: data.fetched_at,
      current_gameweek: data.current_gameweek,
      next_gameweek: data.next_gameweek,
      available_gameweeks: data.available_gameweeks
    }
  }];
  for (const gameweek of GAMEWEEKS) {
    states.push({
      entity_id: `${footballConfig.gameweek_entity_prefix}${gameweek}`,
      state: String(data.gameweeks[gameweek]?.length || 0),
      attributes: {
        friendly_name: `Premier League matchweek ${gameweek}`,
        icon: "mdi:soccer-field",
        gameweek,
        events: data.gameweeks[gameweek] || []
      }
    });
  }
  states.push({
    entity_id: footballConfig.table_entity,
    state: data.table.length ? String(data.table[0]?.code || "ready") : "waiting",
    attributes: {
      friendly_name: "Premier League table",
      icon: "mdi:format-list-numbered",
      season: data.season,
      rows: data.table
    }
  });
  return states;
}

export async function publishHomeAssistantState(state, {
  token = process.env.SUPERVISOR_TOKEN,
  baseUrl = process.env.HOME_ASSISTANT_REST_URL || DEFAULT_REST_URL,
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000
} = {}) {
  requireToken(token);
  const response = await fetchImpl(`${baseUrl}/states/${encodeURIComponent(state.entity_id)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ state: state.state, attributes: state.attributes }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`Home Assistant state publish failed with HTTP ${response.status}`);
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "family-dashboard-manager/0.7.2" },
    signal: AbortSignal.timeout(timeoutMs)
  });
  if (!response.ok) throw new Error(`football source returned HTTP ${response.status}`);
  return response.json();
}

async function writeCache(path, data) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(data)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporaryPath, path);
}

async function readCache(path) {
  try {
    const data = JSON.parse(await readFile(path, "utf8"));
    if (data?.provider !== "fpl" || !data.gameweeks || !Array.isArray(data.table)) {
      throw new Error("football cache has an unsupported shape");
    }
    return data;
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

export class FootballProvider {
  constructor({
    fetchImpl = globalThis.fetch,
    publish = publishHomeAssistantState,
    cachePath = join(process.env.MANAGER_DATA_DIR || "/data", "football-cache.json"),
    clock = () => new Date(),
    timeoutMs = 15000
  } = {}) {
    this.fetchImpl = fetchImpl;
    this.publish = publish;
    this.cachePath = cachePath;
    this.clock = clock;
    this.timeoutMs = timeoutMs;
    this.publishedHashes = new Map();
  }

  async refresh(footballConfig) {
    let data;
    let dataStatus = "live";
    try {
      const [bootstrap, fixtures] = await Promise.all([
        fetchJson(BOOTSTRAP_URL, this.fetchImpl, this.timeoutMs),
        fetchJson(FIXTURES_URL, this.fetchImpl, this.timeoutMs)
      ]);
      data = normaliseFootballData({
        bootstrap,
        fixtures,
        spotlightTeamCodes: footballConfig.spotlight_team_codes,
        fetchedAt: this.clock().toISOString()
      });
      await writeCache(this.cachePath, data);
    } catch (sourceError) {
      data = await readCache(this.cachePath);
      if (!data) throw sourceError;
      const cachedCodes = new Set(data.spotlight_team_codes || []);
      if (footballConfig.spotlight_team_codes.some((code) => !cachedCodes.has(code))) {
        throw new Error("football cache does not match the configured spotlight clubs", { cause: sourceError });
      }
      dataStatus = "cached";
    }

    let published = 0;
    for (const state of buildFootballStates(data, footballConfig, { dataStatus })) {
      const serialised = JSON.stringify({ state: state.state, attributes: state.attributes });
      if (this.publishedHashes.get(state.entity_id) === serialised) continue;
      await this.publish(state);
      this.publishedHashes.set(state.entity_id, serialised);
      published += 1;
    }
    return { data_status: dataStatus, fetched_at: data.fetched_at, published };
  }
}

export function startFootballPolling({
  store,
  provider = new FootballProvider(),
  intervalMs = Number(process.env.FOOTBALL_REFRESH_INTERVAL_MS || 15 * 60 * 1000),
  logger = console
}) {
  let stopped = false;
  let running = false;
  const tick = async () => {
    if (stopped || running) return;
    running = true;
    try {
      const config = await store.readHouseholdConfig();
      if (config?.schema_version === 5 && config?.features?.football === true) {
        await provider.refresh(config.football);
      }
    } catch (error) {
      logger.error("Family Dashboard football update failed", error instanceof Error ? error.message : error);
    } finally {
      running = false;
    }
  };
  const requestedInterval = Number(intervalMs);
  const refreshInterval = Number.isFinite(requestedInterval)
    ? Math.max(60_000, requestedInterval)
    : 15 * 60 * 1000;
  const timer = setInterval(tick, refreshInterval);
  timer.unref?.();
  void tick();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
