import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { CURRENT_SCHEMA_VERSION } from "./schema-version.mjs";

const BOOTSTRAP_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";
const PREMIER_LEAGUE_BADGE_BASE_URL = "https://resources.premierleague.com/premierleague/badges/70";
const DEFAULT_REST_URL = "http://supervisor/core/api";
const GAMEWEEKS = Object.freeze(Array.from({ length: 38 }, (_, index) => index + 1));
export const FOOTBALL_POLLING_INTERVALS = Object.freeze({
  live: 3 * 60 * 1000,
  matchday: 15 * 60 * 1000,
  quiet: 60 * 60 * 1000
});
const NEAR_KICKOFF_BEFORE_MS = 90 * 60 * 1000;
const NEAR_KICKOFF_AFTER_MS = 3 * 60 * 60 * 1000;
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

function fixtureIsComplete(fixture) {
  return fixture?.finished === true || fixture?.finished_provisional === true;
}

function fixtureKickoffTime(fixture) {
  const timestamp = Date.parse(fixture?.kickoff_time || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function utcDay(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

export function footballRefreshInterval(data, now = new Date()) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(nowMs)) throw new Error("football polling clock is invalid");
  const fixtures = Object.values(data?.gameweeks || {}).flatMap((entries) => Array.isArray(entries) ? entries : []);
  const incomplete = fixtures.filter((fixture) => !fixtureIsComplete(fixture));
  if (incomplete.some((fixture) => fixture.started === true || asInteger(fixture.minutes) > 0)) {
    return FOOTBALL_POLLING_INTERVALS.live;
  }
  if (incomplete.some((fixture) => {
    const kickoff = fixtureKickoffTime(fixture);
    if (kickoff === null) return false;
    const delta = kickoff - nowMs;
    return delta >= -NEAR_KICKOFF_AFTER_MS && delta <= NEAR_KICKOFF_BEFORE_MS;
  })) {
    return FOOTBALL_POLLING_INTERVALS.live;
  }
  const today = utcDay(nowMs);
  if (fixtures.some((fixture) => {
    const kickoff = fixtureKickoffTime(fixture);
    return kickoff !== null && utcDay(kickoff) === today;
  })) {
    return FOOTBALL_POLLING_INTERVALS.matchday;
  }
  return FOOTBALL_POLLING_INTERVALS.quiet;
}

function premierLeagueCrestUrl(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const badgeCode = Number(value);
  if (!Number.isSafeInteger(badgeCode) || badgeCode <= 0) return null;
  return `${PREMIER_LEAGUE_BADGE_BASE_URL}/t${badgeCode}.png`;
}

function normaliseTeam(team) {
  const code = String(team.short_name || "").trim().toUpperCase();
  return {
    id: asInteger(team.id),
    code,
    short_name: code,
    name: CANONICAL_TEAM_NAMES[code] || String(team.name || code),
    crest_url: premierLeagueCrestUrl(team.code)
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
    crest_url: team.crest_url,
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

  for (const fixture of fixtures.filter(fixtureIsComplete)) {
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
      finished_provisional: fixture.finished_provisional === true,
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

export function buildFootballStates(data, footballConfig, {
  dataStatus = "live",
  checkedAt = data.fetched_at,
  refreshIntervalMs = null
} = {}) {
  const suggestedGameweek = data.current_gameweek || data.next_gameweek || 1;
  const nextRefreshAt = Number.isFinite(refreshIntervalMs) && checkedAt
    ? new Date(new Date(checkedAt).getTime() + refreshIntervalMs).toISOString()
    : null;
  const states = [{
    entity_id: footballConfig.index_entity,
    state: String(suggestedGameweek),
    attributes: {
      friendly_name: "Premier League",
      icon: "mdi:soccer",
      provider: data.provider,
      season: data.season,
      data_status: dataStatus,
      poller_status: dataStatus === "live" ? "healthy" : "degraded",
      last_updated: data.fetched_at,
      last_checked: checkedAt,
      next_refresh: nextRefreshAt,
      refresh_interval_seconds: Number.isFinite(refreshIntervalMs) ? Math.round(refreshIntervalMs / 1000) : null,
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
  return { created: response.status === 201 };
}

async function fetchJson(url, fetchImpl, timeoutMs) {
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json", "User-Agent": "family-dashboard-manager/0.7.4" },
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
    this.lastIndexState = null;
  }

  async refresh(footballConfig) {
    let data;
    let dataStatus = "live";
    const checkedAt = this.clock().toISOString();
    try {
      const [bootstrap, fixtures] = await Promise.all([
        fetchJson(BOOTSTRAP_URL, this.fetchImpl, this.timeoutMs),
        fetchJson(FIXTURES_URL, this.fetchImpl, this.timeoutMs)
      ]);
      data = normaliseFootballData({
        bootstrap,
        fixtures,
        spotlightTeamCodes: footballConfig.spotlight_team_codes,
        fetchedAt: checkedAt
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

    const refreshAfterMs = footballRefreshInterval(data, new Date(checkedAt));
    let published = 0;
    const states = buildFootballStates(data, footballConfig, {
      dataStatus,
      checkedAt,
      refreshIntervalMs: refreshAfterMs
    });
    this.lastIndexState = structuredClone(states[0]);
    for (const state of states) {
      const serialised = JSON.stringify({ state: state.state, attributes: state.attributes });
      if (this.publishedHashes.get(state.entity_id) === serialised) continue;
      const publication = await this.publish(state);
      if (state.entity_id === footballConfig.index_entity && publication?.created === true) {
        this.publishedHashes.clear();
      }
      this.publishedHashes.set(state.entity_id, serialised);
      published += 1;
    }
    return {
      data_status: dataStatus,
      fetched_at: data.fetched_at,
      checked_at: checkedAt,
      refresh_after_ms: refreshAfterMs,
      published
    };
  }

  async reportFailure(footballConfig, {
    checkedAt = this.clock().toISOString(),
    retryAfterMs = FOOTBALL_POLLING_INTERVALS.live
  } = {}) {
    const boundedRetryMs = boundedRefreshDelay(retryAfterMs, FOOTBALL_POLLING_INTERVALS.live);
    const previous = this.lastIndexState?.entity_id === footballConfig.index_entity
      ? structuredClone(this.lastIndexState)
      : null;
    const state = previous || {
      entity_id: footballConfig.index_entity,
      state: "unknown",
      attributes: {
        friendly_name: "Premier League",
        icon: "mdi:soccer",
        provider: "fpl",
        season: null,
        last_updated: null,
        current_gameweek: null,
        next_gameweek: null,
        available_gameweeks: GAMEWEEKS
      }
    };
    state.attributes = {
      ...state.attributes,
      data_status: "stale",
      poller_status: "error",
      last_checked: checkedAt,
      next_refresh: new Date(new Date(checkedAt).getTime() + boundedRetryMs).toISOString(),
      refresh_interval_seconds: Math.round(boundedRetryMs / 1000)
    };
    const serialised = JSON.stringify({ state: state.state, attributes: state.attributes });
    if (this.publishedHashes.get(state.entity_id) === serialised) return { published: 0 };
    const publication = await this.publish(state);
    if (publication?.created === true) this.publishedHashes.clear();
    this.publishedHashes.set(state.entity_id, serialised);
    this.lastIndexState = structuredClone(state);
    return { published: 1 };
  }
}

function isPollingConfigReady(config) {
  const football = config?.football;
  return config?.schema_version === CURRENT_SCHEMA_VERSION
    && config?.features?.football === true
    && football?.provider === "fpl"
    && Array.isArray(football.spotlight_team_codes)
    && football.spotlight_team_codes.length > 0
    && typeof football.index_entity === "string"
    && typeof football.gameweek_entity_prefix === "string"
    && typeof football.table_entity === "string";
}

function boundedRefreshDelay(value, fallback) {
  const requested = Number(value);
  if (!Number.isFinite(requested)) return fallback;
  return Math.max(60_000, Math.min(FOOTBALL_POLLING_INTERVALS.quiet, requested));
}

export function createFootballPoller({
  store,
  provider = new FootballProvider(),
  logger = console,
  failureRetryMs = FOOTBALL_POLLING_INTERVALS.live,
  disabledRefreshMs = FOOTBALL_POLLING_INTERVALS.quiet,
  setTimer = globalThis.setTimeout,
  clearTimer = globalThis.clearTimeout
}) {
  let active = false;
  let running = false;
  let timer = null;
  let lastResult = { status: "idle", next_refresh_ms: null };

  const schedule = (delayMs) => {
    if (!active) return;
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void tick();
    }, delayMs);
    timer?.unref?.();
  };

  const tick = async () => {
    if (!active) return { status: "stopped", next_refresh_ms: null };
    if (running) return { status: "skipped", reason: "overlap", next_refresh_ms: null };
    running = true;
    let nextRefreshMs = boundedRefreshDelay(disabledRefreshMs, FOOTBALL_POLLING_INTERVALS.quiet);
    let footballConfig = null;
    try {
      const config = await store.readHouseholdConfig();
      if (!isPollingConfigReady(config)) {
        lastResult = { status: "disabled", next_refresh_ms: nextRefreshMs };
        return lastResult;
      }
      footballConfig = config.football;
      const result = await provider.refresh(footballConfig);
      nextRefreshMs = boundedRefreshDelay(result?.refresh_after_ms, FOOTBALL_POLLING_INTERVALS.matchday);
      lastResult = { status: result?.data_status === "cached" ? "degraded" : "healthy", next_refresh_ms: nextRefreshMs };
      return lastResult;
    } catch (error) {
      nextRefreshMs = boundedRefreshDelay(failureRetryMs, FOOTBALL_POLLING_INTERVALS.live);
      lastResult = { status: "error", error: "refresh_failed", next_refresh_ms: nextRefreshMs };
      if (footballConfig && typeof provider.reportFailure === "function") {
        try {
          await provider.reportFailure(footballConfig, { retryAfterMs: nextRefreshMs });
        } catch {
          logger.error("Family Dashboard football status update failed", "status_publish_failed");
        }
      }
      logger.error("Family Dashboard football update failed", "refresh_failed");
      return lastResult;
    } finally {
      running = false;
      if (active) schedule(nextRefreshMs);
    }
  };

  return {
    start() {
      if (active) return;
      active = true;
      schedule(0);
    },
    stop() {
      active = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    tick,
    status() {
      return { ...lastResult, active, running };
    }
  };
}

export function startFootballPolling(options) {
  const poller = createFootballPoller(options);
  poller.start();
  return () => poller.stop();
}
