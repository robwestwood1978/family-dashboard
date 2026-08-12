const VIEW_DEFINITIONS = [
  { id: "today", label: "Today", icon: "mdi:home-heart", feature: null },
  { id: "calendar", label: "Calendar", icon: "mdi:calendar-month", feature: "calendar" },
  { id: "rooms", label: "Rooms", icon: "mdi:floor-plan", feature: "rooms" },
  { id: "family", label: "Family", icon: "mdi:account-group", feature: "family" },
  { id: "music", label: "Music", icon: "mdi:music-circle", feature: "music" },
  { id: "football", label: "Football", icon: "mdi:soccer", feature: "football" }
];

const ICONS = {
  light: "mdi:lightbulb-outline",
  climate: "mdi:radiator",
  cover: "mdi:blinds-horizontal",
  media: "mdi:speaker",
  scene: "mdi:creation-outline",
  calendar: "mdi:calendar-clock",
  school: "mdi:school-outline",
  chore: "mdi:checkbox-marked-circle-outline"
};

const htmlEscapeMap = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#039;"
};

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => htmlEscapeMap[character]);
}

export function isControlAction(dataset = {}) {
  return Boolean(
    dataset.toggle
    || dataset.scene
    || dataset.mediaToggle
    || dataset.coverAction
    || dataset.climateAdjust
  );
}

function safeNumber(value, fallback = 0) {
  if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatTemperature(value) {
  const temperature = Number(value);
  return Number.isFinite(temperature) ? `${temperature.toFixed(temperature % 1 ? 1 : 0)}°` : "—";
}

function formatTime(value, locale = "en-GB", timeZone) {
  if (!value) return "TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBC";
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

function formatDay(value, locale = "en-GB", timeZone) {
  if (!value) return "Date TBC";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date TBC";
  return new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone }).format(date);
}

function calendarEventStart(event) {
  if (!event) return null;
  if (typeof event.start === "string") return event.start;
  return event.start?.dateTime || event.start?.date || event.start_time || null;
}

function calendarEventEnd(event) {
  if (!event) return null;
  if (typeof event.end === "string") return event.end;
  return event.end?.dateTime || event.end?.date || event.end_time || null;
}

function isAllDayCalendarEvent(event) {
  return Boolean(event?.start?.date && !event?.start?.dateTime)
    || /^\d{4}-\d{2}-\d{2}$/.test(String(calendarEventStart(event) || ""));
}

function dateKey(value, timeZone) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function isCurrentOrFutureCalendarEvent(event, now = new Date(), timeZone = "Europe/London") {
  const start = calendarEventStart(event);
  if (!start) return false;
  const nowDate = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(nowDate.getTime())) return false;

  const end = calendarEventEnd(event);
  if (end) {
    const endDate = new Date(end);
    if (!Number.isNaN(endDate.getTime())) return endDate.getTime() > nowDate.getTime();
  }

  if (isAllDayCalendarEvent(event)) {
    return String(start).slice(0, 10) >= dateKey(nowDate, timeZone);
  }

  const startDate = new Date(start);
  return !Number.isNaN(startDate.getTime()) && startDate.getTime() >= nowDate.getTime();
}

export function formatPoints(value, locale = "en-GB") {
  const points = safeNumber(value, NaN);
  if (!Number.isFinite(points)) return "0";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(points);
}

function compactClubName(team = {}) {
  const name = String(team.name || team.short_name || "Team");
  return name
    .replace(/^Brighton (?:&|and) Hove Albion$/i, "Brighton")
    .replace(/^Tottenham Hotspur$/i, "Tottenham")
    .replace(/^Wolverhampton Wanderers$/i, "Wolves")
    .replace(/ United$/i, "");
}

function calendarWindow(locale, timeZone, count = 7, now = new Date()) {
  const today = dateKey(now, timeZone);
  const [year, month, day] = today.split("-").map(Number);
  const base = Date.UTC(year, month - 1, day, 12);
  return Array.from({ length: count }, (_, offset) => {
    const date = new Date(base + offset * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return {
      key,
      isToday: offset === 0,
      weekday: new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(date),
      day: new Intl.DateTimeFormat(locale, { day: "numeric", timeZone: "UTC" }).format(date),
      month: new Intl.DateTimeFormat(locale, { month: "short", timeZone: "UTC" }).format(date)
    };
  });
}

export function normaliseChoreStatus(state, entityId = "") {
  const raw = String(state?.state || "unavailable").toLowerCase();
  const presentations = {
    approved: ["Done", "done"],
    completed: ["Done", "done"],
    completed_by_other: ["Done", "done"],
    claimed: ["Awaiting approval", "waiting"],
    overdue: ["Overdue", "overdue"],
    missed: ["Missed", "missed"],
    pending: ["To do", "todo"],
    due: ["To do", "todo"],
    not_my_turn: ["Not your turn", "standby"],
    waiting: ["Later", "standby"],
    standby: ["Later", "standby"],
    unavailable: ["Unavailable", "unavailable"]
  };
  const [label, tone] = presentations[raw] || [titleCase(raw), "standby"];
  const fallbackName = String(entityId).split("_chore_status_")[1] || String(entityId).split(".")[1] || "Chore";
  return {
    name: state?.attributes?.chore_name || titleCase(fallbackName),
    label,
    tone,
    points: safeNumber(state?.attributes?.default_points, NaN),
    due: state?.attributes?.due_date || state?.attributes?.due_at || null
  };
}

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function entityName(state, fallback) {
  return state?.attributes?.friendly_name || fallback || state?.entity_id || "Unavailable";
}

function roomTemperature(room, states) {
  const sensor = room.temperature_sensor ? states[room.temperature_sensor] : null;
  if (sensor) return safeNumber(sensor.state, NaN);
  const climate = room.climate ? states[room.climate] : null;
  return safeNumber(climate?.attributes?.current_temperature, NaN);
}

function firstPlayingPlayer(config, states) {
  return config.media.players
    .map((player) => ({ player, state: states[player.entity_id] }))
    .find(({ state }) => state && ["playing", "paused"].includes(state.state));
}

function lightColour(state, fallback) {
  const rgb = state?.attributes?.rgb_color;
  if (Array.isArray(rgb) && rgb.length >= 3 && rgb.every((value) => Number.isFinite(Number(value)))) {
    return `rgb(${rgb.slice(0, 3).map((value) => Math.max(0, Math.min(255, Number(value)))).join(",")})`;
  }
  return fallback;
}

export function deriveRoomState(room, states = {}, accent = "#5B5BD6") {
  const lightStates = room.lights.map((entityId) => states[entityId]).filter(Boolean);
  const lightsOn = lightStates.filter((state) => state.state === "on");
  const climate = room.climate ? states[room.climate] : null;
  const playing = room.media_players
    .map((entityId) => states[entityId])
    .find((state) => state?.state === "playing");
  const openCovers = room.covers
    .map((entityId) => states[entityId])
    .filter((state) => state && !["closed", "closing"].includes(state.state));
  return {
    lightsOn: lightsOn.length,
    totalLights: room.lights.length,
    temperature: roomTemperature(room, states),
    targetTemperature: safeNumber(climate?.attributes?.temperature, NaN),
    playing: playing ? entityName(playing) : null,
    openCovers: openCovers.length,
    colour: lightColour(lightsOn[0], accent)
  };
}

export function normaliseFixtureStatus(fixture) {
  if (fixture.finished) return "finished";
  if (fixture.started || safeNumber(fixture.minutes) > 0) return "live";
  return "upcoming";
}

export function floorplanImageSource(floor, states = {}) {
  const staticSource = () => {
    const source = floor?.base_image || "";
    if (!source || !floor?.asset_revision) return source;
    return `${source}${source.includes("?") ? "&" : "?"}v=${encodeURIComponent(floor.asset_revision)}`;
  };
  if (!floor?.vacuum_map_entity) return staticSource();
  const mapState = states[floor.vacuum_map_entity];
  const entityPicture = mapState?.attributes?.entity_picture;
  if (typeof entityPicture === "string" && entityPicture.startsWith("/api/camera_proxy/")) {
    const updated = mapState.last_updated || mapState.last_changed;
    if (!updated) return entityPicture;
    return `${entityPicture}${entityPicture.includes("?") ? "&" : "?"}v=${encodeURIComponent(updated)}`;
  }
  return staticSource() || `/api/camera_proxy/${encodeURIComponent(floor.vacuum_map_entity)}`;
}

export function floorplanViewBox(floor, padding = 1.5) {
  const viewHeight = 100 / safeNumber(floor?.aspect_ratio, 1.666667);
  const points = (floor?.room_hotspots || [])
    .flatMap((hotspot) => hotspot?.points || [])
    .filter((point) => Array.isArray(point) && point.length === 2)
    .map(([x, y]) => [safeNumber(x, NaN), safeNumber(y, NaN) * viewHeight / 100])
    .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (!points.length) return `0 0 100 ${viewHeight.toFixed(4)}`;

  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x1 = Math.max(0, Math.min(...xs) - padding);
  const y1 = Math.max(0, Math.min(...ys) - padding);
  const x2 = Math.min(100, Math.max(...xs) + padding);
  const y2 = Math.min(viewHeight, Math.max(...ys) + padding);
  return `${x1.toFixed(4)} ${y1.toFixed(4)} ${(x2 - x1).toFixed(4)} ${(y2 - y1).toFixed(4)}`;
}

function relevantEntityIds(config) {
  const ids = new Set();
  const add = (value) => {
    if (typeof value === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(value)) ids.add(value);
  };
  const walk = (value) => {
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === "object") Object.values(value).forEach(walk);
    else add(value);
  };
  walk(config);
  for (let gameweek = 1; gameweek <= 38; gameweek += 1) {
    ids.add(`${config.football.gameweek_entity_prefix}${gameweek}`);
  }
  return ids;
}

function stateSignature(states, entityIds) {
  const parts = [];
  for (const entityId of entityIds) {
    const state = states[entityId];
    if (!state) continue;
    const attributes = state.attributes || {};
    parts.push([
      entityId,
      state.state,
      state.last_changed,
      state.last_updated,
      attributes.brightness,
      attributes.rgb_color,
      attributes.current_temperature,
      attributes.temperature,
      attributes.media_title,
      attributes.media_artist,
      attributes.message,
      attributes.start_time,
      attributes.chore_name,
      attributes.default_points,
      attributes.due_date,
      attributes.due_at,
      attributes.last_updated,
      attributes.events?.length,
      attributes.rows?.length,
      attributes.assignments?.length
    ].join(":"));
  }
  return parts.join("|");
}

const HTMLElementBase = globalThis.HTMLElement || class {};

export class FamilyHubCard extends HTMLElementBase {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._view = "today";
    this._floor = null;
    this._room = null;
    this._footballTab = "fixtures";
    this._gameweek = null;
    this._entityIds = new Set();
    this._signature = "";
    this._renderPending = false;
    this._childCards = new Map();
    this._calendarEvents = [];
    this._calendarLoading = false;
    this._calendarError = null;
    this._calendarRequestKey = "";
    this._calendarRequest = 0;
    this._readOnlyHassSource = null;
    this._readOnlyHass = null;
    this._boundClick = (event) => this._handleClick(event);
    this._boundChange = (event) => this._handleChange(event);
    this._boundKeydown = (event) => this._handleKeydown(event);
  }

  connectedCallback() {
    this.shadowRoot.addEventListener("click", this._boundClick);
    this.shadowRoot.addEventListener("change", this._boundChange);
    this.shadowRoot.addEventListener("keydown", this._boundKeydown);
    this._scheduleRender(true);
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._boundClick);
    this.shadowRoot.removeEventListener("change", this._boundChange);
    this.shadowRoot.removeEventListener("keydown", this._boundKeydown);
    this._childCards.clear();
  }

  setConfig(cardConfig) {
    const config = typeof cardConfig?.config_json === "string"
      ? JSON.parse(cardConfig.config_json)
      : cardConfig?.family_config;
    if (!config || config.schema_version !== 5) {
      throw new Error("Family Hub requires a schema-v5 family configuration");
    }
    this._config = config;
    this._view = config.display.default_view || "today";
    this._floor = config.floorplan.default_floor;
    this._room = config.floorplan.floors
      .find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || config.rooms[0]?.id || null;
    this._entityIds = relevantEntityIds(config);
    this._signature = "";
    this._calendarEvents = [];
    this._calendarRequestKey = "";
    this._calendarError = null;
    this._scheduleRender(true);
  }

  set hass(hass) {
    this._hass = hass;
    this._readOnlyHassSource = null;
    this._readOnlyHass = null;
    for (const [key, child] of this._childCards.entries()) child.hass = this._hassForChild(key);
    if (!this._config) return;
    const nextSignature = stateSignature(hass?.states || {}, this._entityIds);
    if (nextSignature !== this._signature) {
      this._signature = nextSignature;
      this._scheduleRender();
    }
    this._loadCalendarEvents();
  }

  getCardSize() {
    return 16;
  }

  getGridOptions() {
    return { columns: "full", min_columns: 12 };
  }

  _scheduleRender(force = false) {
    if (!this.isConnected && !force) return;
    if (this._renderPending) return;
    this._renderPending = true;
    const callback = () => {
      this._renderPending = false;
      this._render();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(callback);
    else queueMicrotask(callback);
  }

  _enabledViews() {
    return VIEW_DEFINITIONS.filter((view) => !view.feature || this._config.features[view.feature]);
  }

  _calendarWindow() {
    return calendarWindow(
      this._config.product.locale,
      this._config.product.timezone,
      this._config.calendar.rolling_days
    );
  }

  _calendarFallbackEvents() {
    const states = this._hass?.states || {};
    return this._config.calendar.entities.flatMap((calendar) => {
      const state = states[calendar.entity_id];
      if (!state?.attributes?.start_time) return [];
      return [{
        summary: state.attributes.message || calendar.label,
        start: state.attributes.start_time,
        end: state.attributes.end_time,
        _calendar: calendar
      }];
    });
  }

  async _loadCalendarEvents() {
    if (!this._config?.features?.calendar || !this._hass) return;
    if (typeof this._hass.callApi !== "function") {
      if (!this._calendarEvents.length) this._calendarEvents = this._calendarFallbackEvents();
      return;
    }
    const days = this._calendarWindow();
    const stateVersion = this._config.calendar.entities.map((calendar) => {
      const state = this._hass.states?.[calendar.entity_id];
      return `${calendar.entity_id}:${state?.last_updated || state?.last_changed || "unknown"}`;
    }).join("|");
    const requestKey = `${days[0]?.key || ""}:${stateVersion}`;
    if (requestKey === this._calendarRequestKey) return;
    this._calendarRequestKey = requestKey;
    this._calendarLoading = true;
    this._calendarError = null;
    const requestId = ++this._calendarRequest;
    this._scheduleRender();
    const start = new Date(Date.now() - 43_200_000).toISOString();
    const end = new Date(Date.now() + (this._config.calendar.rolling_days + 1) * 86_400_000).toISOString();
    try {
      const groups = await Promise.all(this._config.calendar.entities.map(async (calendar) => {
        const path = `calendars/${encodeURIComponent(calendar.entity_id)}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`;
        const events = await this._hass.callApi("GET", path);
        return (Array.isArray(events) ? events : []).map((event) => ({ ...event, _calendar: calendar }));
      }));
      if (requestId !== this._calendarRequest) return;
      this._calendarEvents = groups.flat().sort((left, right) => {
        return new Date(calendarEventStart(left) || 0) - new Date(calendarEventStart(right) || 0);
      });
    } catch (error) {
      if (requestId !== this._calendarRequest) return;
      this._calendarEvents = this._calendarFallbackEvents();
      this._calendarError = error?.message || "Calendar events are temporarily unavailable";
    } finally {
      if (requestId === this._calendarRequest) {
        this._calendarLoading = false;
        this._scheduleRender();
      }
    }
  }

  _render() {
    if (!this._config || !this.shadowRoot) return;
    const theme = this._config.theme;
    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card class="hub-card" style="
        --hub-accent:${escapeHtml(theme.accent)};
        --hub-background:${escapeHtml(theme.background)};
        --hub-surface:${escapeHtml(theme.surface)};
        --hub-text:${escapeHtml(theme.text)};
        --hub-muted:${escapeHtml(theme.muted)};
        --hub-nav:${escapeHtml(theme.nav_background)};
        --hub-backdrop-start:${escapeHtml(theme.backdrop_start)};
        --hub-backdrop-mid:${escapeHtml(theme.backdrop_mid)};
        --hub-backdrop-end:${escapeHtml(theme.backdrop_end)};
        --hub-radius:${Number(theme.radius_px)}px;
      ">
        <div class="shell">
          ${this._renderNavigation()}
          <main class="content">
            ${this._renderHeader()}
            <div class="view" data-current-view="${escapeHtml(this._view)}">
              ${this._renderView()}
            </div>
          </main>
        </div>
      </ha-card>
    `;
    this._mountChildCards();
  }

  _renderNavigation() {
    const buttons = this._enabledViews().map((view) => `
      <button class="nav-button ${this._view === view.id ? "is-active" : ""}" type="button" data-view="${view.id}" aria-current="${this._view === view.id ? "page" : "false"}">
        <ha-icon icon="${view.icon}" aria-hidden="true"></ha-icon>
        <span>${escapeHtml(view.label)}</span>
      </button>
    `).join("");
    return `
      <nav class="navigation" aria-label="Family Dashboard views">
        <button class="brand" type="button" data-view="today" aria-label="Open Today"><ha-icon icon="mdi:home-heart" aria-hidden="true"></ha-icon></button>
        <div class="nav-items">${buttons}</div>
      </nav>
    `;
  }

  _renderHeader() {
    const now = new Date();
    const locale = this._config.product.locale;
    const date = new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: this._config.product.timezone
    }).format(now);
    const weather = this._hass?.states?.[this._config.weather.entity_id];
    const temperature = weather?.attributes?.temperature;
    const weatherText = weather
      ? `${formatTemperature(temperature)} · ${titleCase(weather.state)}`
      : "Home";
    const currentDefinition = VIEW_DEFINITIONS.find((view) => view.id === this._view) || VIEW_DEFINITIONS[0];
    return `
      <header class="topbar">
        <div>
          <p class="eyebrow">${escapeHtml(date)}</p>
          <h1>${escapeHtml(currentDefinition.label)}</h1>
        </div>
        <div class="header-actions">
          ${this._config.display.read_only ? '<span class="preview-pill"><ha-icon icon="mdi:eye-outline" aria-hidden="true"></ha-icon>Read-only test</span>' : ""}
          <button class="weather-pill" type="button" data-more-info="${escapeHtml(this._config.weather.entity_id)}" ${this._config.display.read_only ? 'aria-disabled="true"' : ""}>
            <ha-icon icon="mdi:weather-partly-cloudy" aria-hidden="true"></ha-icon>
            <span>${escapeHtml(weatherText)}</span>
          </button>
        </div>
      </header>
    `;
  }

  _renderView() {
    switch (this._view) {
      case "calendar": return this._renderCalendar();
      case "rooms": return this._renderRooms();
      case "family": return this._renderFamily();
      case "music": return this._renderMusic();
      case "football": return this._renderFootball();
      default: return this._renderToday();
    }
  }

  _renderToday() {
    const states = this._hass?.states || {};
    const rooms = this._config.rooms.map((room) => ({ room, summary: deriveRoomState(room, states, this._config.theme.accent) }));
    const lightsOn = rooms.reduce((total, entry) => total + entry.summary.lightsOn, 0);
    const temperatures = rooms.map((entry) => entry.summary.temperature).filter(Number.isFinite);
    const averageTemperature = temperatures.length
      ? temperatures.reduce((total, value) => total + value, 0) / temperatures.length
      : NaN;
    const nextCalendar = (this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents())
      .filter((event) => isCurrentOrFutureCalendarEvent(event, new Date(), this._config.product.timezone))
      .sort((a, b) => new Date(calendarEventStart(a)) - new Date(calendarEventStart(b)))[0];
    const playing = firstPlayingPlayer(this._config, states);
    const featuredFixtures = this._featuredFixtures();
    return `
      <section class="today-grid" aria-label="Today at a glance">
        <article class="surface hero-panel">
          <p class="eyebrow">At home</p>
          <h2>${lightsOn ? `${lightsOn} light${lightsOn === 1 ? "" : "s"} on` : "Everything looks settled"}</h2>
          <div class="hero-metrics">
            <button type="button" data-view="rooms"><strong>${formatTemperature(averageTemperature)}</strong><span>Average temperature</span></button>
            <button type="button" data-view="rooms"><strong>${rooms.length}</strong><span>Mapped rooms</span></button>
            <button type="button" data-view="music"><strong>${playing ? "Playing" : "Quiet"}</strong><span>${escapeHtml(playing?.player?.name || "Music")}</span></button>
          </div>
        </article>
        <article class="surface next-panel">
          <p class="eyebrow">Up next</p>
          ${nextCalendar ? `
            <h2>${escapeHtml(nextCalendar.summary || nextCalendar._calendar?.label || "Family event")}</h2>
            <p class="supporting">${escapeHtml(formatDay(calendarEventStart(nextCalendar), this._config.product.locale, this._config.product.timezone))}${isAllDayCalendarEvent(nextCalendar) ? " · All day" : ` · ${escapeHtml(formatTime(calendarEventStart(nextCalendar), this._config.product.locale, this._config.product.timezone))}`}</p>
            <button class="text-action" type="button" data-view="calendar">Open family calendar</button>
          ` : `
            <h2>No upcoming event is available</h2>
            <p class="supporting">Open Calendar to check the full family week.</p>
            <button class="text-action" type="button" data-view="calendar">Open calendar</button>
          `}
        </article>
        <article class="surface children-panel">
          <div class="section-heading"><div><p class="eyebrow">Children</p><h2>School & chores</h2></div><button type="button" data-view="family">View family</button></div>
          <div class="person-summary-list">${this._renderChildSummaries()}</div>
        </article>
        <article class="surface football-panel">
          <div class="section-heading"><div><p class="eyebrow">Premier League</p><h2>Featured clubs</h2></div><button type="button" data-view="football">All fixtures</button></div>
          <div class="featured-fixtures">${featuredFixtures || '<p class="empty-state">Fixtures will appear after the football provider publishes its first update.</p>'}</div>
        </article>
        <article class="surface now-playing-panel">
          <p class="eyebrow">Now playing</p>
          ${playing ? `
            <div class="now-playing">
              <div class="artwork">${playing.state.attributes.entity_picture ? `<img src="${escapeHtml(playing.state.attributes.entity_picture)}" alt="">` : '<ha-icon icon="mdi:music-note" aria-hidden="true"></ha-icon>'}</div>
              <div><h2>${escapeHtml(playing.state.attributes.media_title || "Music")}</h2><p>${escapeHtml(playing.state.attributes.media_artist || playing.player.name)}</p></div>
              <button type="button" class="icon-action" data-media-toggle="${escapeHtml(playing.player.entity_id)}" aria-label="Play or pause" ${this._config.display.read_only ? 'disabled aria-disabled="true"' : ""}><ha-icon icon="${playing.state.state === "playing" ? "mdi:pause" : "mdi:play"}"></ha-icon></button>
            </div>
          ` : `
            <h2>The house is quiet</h2><p class="supporting">Choose a room and start Spotify from Music.</p>
          `}
        </article>
      </section>
    `;
  }

  _renderChildSummaries() {
    const states = this._hass?.states || {};
    return this._config.people.filter((person) => person.role === "child").map((person) => {
      const chore = this._config.chores.users.find((entry) => entry.person_id === person.id);
      const classroom = this._config.school.classroom_students.find((entry) => entry.person_id === person.id);
      const choreState = chore ? states[chore.chores_entity] : null;
      const pointsState = chore ? states[chore.points_entity] : null;
      const classroomState = classroom ? states[classroom.assignments_entity] : null;
      const due = safeNumber(choreState?.attributes?.chore_stat_current_due_today, 0);
      const assignments = classroomState?.attributes?.assignments || [];
      const nextChore = chore?.status_entities
        ?.map((entityId) => ({ entityId, state: states[entityId] }))
        .find(({ state }) => !["approved", "completed", "completed_by_other"].includes(String(state?.state || "").toLowerCase()));
      const nextChoreName = nextChore ? normaliseChoreStatus(nextChore.state, nextChore.entityId).name : "Routines complete";
      return `
        <button type="button" class="person-summary" data-view="family" style="--person-colour:${escapeHtml(person.colour)}">
          <span class="person-initial">${escapeHtml(person.name.slice(0, 1))}</span>
          <span><strong>${escapeHtml(person.name)}</strong><small>${due} due · ${escapeHtml(nextChoreName)}</small></span>
          <span class="points">${escapeHtml(formatPoints(pointsState?.state, this._config.product.locale))} pts</span>
        </button>
      `;
    }).join("");
  }

  _renderCalendar() {
    const days = this._calendarWindow();
    const events = this._calendarEvents.length ? this._calendarEvents : this._calendarFallbackEvents();
    const timeZone = this._config.product.timezone;
    const locale = this._config.product.locale;
    const legend = this._config.calendar.entities.map((calendar) => `
      <span class="calendar-legend" style="--calendar-colour:${escapeHtml(calendar.colour)}"><i></i>${escapeHtml(calendar.label)}</span>
    `).join("");
    const columns = days.map((day) => {
      const dayEvents = events.filter((event) => dateKey(calendarEventStart(event), timeZone) === day.key);
      return `
        <section class="agenda-day ${day.isToday ? "is-today" : ""}">
          <header><span>${escapeHtml(day.weekday)}</span><strong>${escapeHtml(day.day)}</strong><small>${escapeHtml(day.month)}</small></header>
          <div class="agenda-events">
            ${dayEvents.slice(0, 5).map((event) => {
              const calendar = event._calendar || this._config.calendar.entities[0];
              return `
                <article class="agenda-event" style="--calendar-colour:${escapeHtml(calendar.colour)}">
                  <span class="event-time">${isAllDayCalendarEvent(event) ? "All day" : escapeHtml(formatTime(calendarEventStart(event), locale, timeZone))}</span>
                  <strong>${escapeHtml(event.summary || calendar.label)}</strong>
                  ${event.location ? `<small><ha-icon icon="mdi:map-marker-outline" aria-hidden="true"></ha-icon>${escapeHtml(event.location)}</small>` : ""}
                </article>
              `;
            }).join("") || '<p class="agenda-empty">Nothing planned</p>'}
            ${dayEvents.length > 5 ? `<span class="agenda-more">+${dayEvents.length - 5} more</span>` : ""}
          </div>
        </section>
      `;
    }).join("");
    return `
      <section class="single-surface surface calendar-view">
        <div class="section-heading calendar-heading"><div><p class="eyebrow">Family rhythm</p><h2>The next seven days</h2></div><div class="calendar-legends">${legend}</div></div>
        ${this._calendarLoading ? '<div class="calendar-loading"><span></span>Refreshing the family week…</div>' : ""}
        ${this._calendarError ? '<p class="calendar-warning">Showing the next events held by Home Assistant while the full agenda reconnects.</p>' : ""}
        <div class="agenda-board">${columns}</div>
      </section>
    `;
  }

  _renderRooms() {
    const floor = this._config.floorplan.floors.find((entry) => entry.id === this._floor) || this._config.floorplan.floors[0];
    const selectedRoom = this._config.rooms.find((room) => room.id === this._room)
      || this._config.rooms.find((room) => room.floor_id === floor.id)
      || this._config.rooms[0];
    const floorButtons = this._config.floorplan.floors.map((entry) => `
      <button type="button" class="segment ${entry.id === floor.id ? "is-selected" : ""}" data-floor="${entry.id}">${escapeHtml(entry.name)}</button>
    `).join("");
    return `
      <section class="rooms-layout">
        <article class="surface floorplan-panel">
          <div class="section-heading floorplan-heading">
            <div><p class="eyebrow">Interactive house</p><h2>${this._config.display.read_only ? "Tap a room to explore it" : "Tap a room to control it"}</h2></div>
            <div class="segments" role="group" aria-label="Choose floor">${floorButtons}</div>
          </div>
          ${this._renderFloorplan(floor, selectedRoom)}
        </article>
        <aside class="surface room-detail">${this._renderRoomDetail(selectedRoom)}</aside>
      </section>
    `;
  }

  _renderFloorplan(floor, selectedRoom) {
    const states = this._hass?.states || {};
    const viewHeight = 100 / safeNumber(floor.aspect_ratio, 1.666667);
    const viewBox = floorplanViewBox(floor);
    const imageSource = floorplanImageSource(floor, states);
    const overlays = floor.light_overlays.map((overlay) => {
      const state = states[overlay.entity_id];
      if (state?.state !== "on") return "";
      const opacity = Math.max(0.18, safeNumber(state.attributes?.brightness, 255) / 255);
      return `<image class="light-overlay" href="${escapeHtml(overlay.image)}" x="0" y="0" width="100" height="${viewHeight.toFixed(4)}" preserveAspectRatio="none" opacity="${opacity.toFixed(3)}" aria-hidden="true"></image>`;
    }).join("");
    const hotspots = floor.room_hotspots.map((hotspot) => {
      const room = this._config.rooms.find((entry) => entry.id === hotspot.room_id);
      if (!room) return "";
      const summary = deriveRoomState(room, states, this._config.theme.accent);
      const points = hotspot.points.map(([x, y]) => `${x},${(y * viewHeight / 100).toFixed(4)}`).join(" ");
      const status = [
        summary.totalLights ? `${summary.lightsOn}/${summary.totalLights} lights` : null,
        Number.isFinite(summary.temperature) ? formatTemperature(summary.temperature) : null
      ].filter(Boolean).join(" · ") || "Open room";
      return `
        <g class="room-hotspot ${selectedRoom?.id === room.id ? "is-selected" : ""} ${summary.lightsOn ? "has-light" : ""}" role="button" tabindex="0" data-room="${room.id}" aria-label="${escapeHtml(`${room.name}, ${status}`)}" style="--room-colour:${escapeHtml(summary.colour)}">
          <title>${escapeHtml(`${room.name}, ${status}`)}</title>
          <polygon points="${points}"></polygon>
        </g>
      `;
    }).join("");
    return `
      <div class="floorplan-canvas">
        <div class="floorplan-backdrop" aria-hidden="true"></div>
        <svg class="floorplan-visual" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Rooms on ${escapeHtml(floor.name)}">
          <image class="floorplan-image" href="${escapeHtml(imageSource)}" x="0" y="0" width="100" height="${viewHeight.toFixed(4)}" preserveAspectRatio="none" aria-hidden="true"></image>
          ${overlays}
          ${hotspots}
        </svg>
      </div>
    `;
  }

  _renderRoomDetail(room) {
    if (!room) return '<p class="empty-state">Choose a room.</p>';
    const states = this._hass?.states || {};
    const summary = deriveRoomState(room, states, this._config.theme.accent);
    const readOnly = this._config.display.read_only === true;
    const disabled = readOnly ? ' disabled aria-disabled="true"' : "";
    const lights = room.lights.map((entityId) => {
      const state = states[entityId];
      const isOn = state?.state === "on";
      return `
        <div class="control-row">
          <button type="button" class="control-main ${isOn ? "is-on" : ""}" data-toggle="${escapeHtml(entityId)}"${disabled}>
            <ha-icon icon="${ICONS.light}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(entityName(state, entityId.split(".")[1]))}</strong><small>${isOn ? `${Math.round(safeNumber(state.attributes?.brightness, 255) / 2.55)}%` : titleCase(state?.state || "unavailable")}</small></span>
          </button>
          <button type="button" class="icon-action" data-more-info="${escapeHtml(entityId)}" aria-label="Open light details"${disabled}><ha-icon icon="mdi:tune"></ha-icon></button>
        </div>
      `;
    }).join("");
    const climate = room.climate ? states[room.climate] : null;
    const climateControl = room.climate ? `
      <div class="climate-control">
        <div><span>Temperature</span><strong>${formatTemperature(summary.temperature)}</strong><small>Target ${formatTemperature(summary.targetTemperature)}</small></div>
        <div class="stepper">
          <button type="button" data-climate-adjust="-0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Lower target temperature"${disabled}>−</button>
          <button type="button" data-climate-adjust="0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Raise target temperature"${disabled}>+</button>
        </div>
      </div>
    ` : "";
    const covers = room.covers.map((entityId) => {
      const state = states[entityId];
      return `
        <div class="cover-control"><span><ha-icon icon="${ICONS.cover}"></ha-icon><strong>${escapeHtml(entityName(state, "Blind"))}</strong><small>${escapeHtml(titleCase(state?.state || "unavailable"))}</small></span><div>
          <button type="button" data-cover-action="open_cover" data-entity="${escapeHtml(entityId)}" aria-label="Open"${disabled}><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button type="button" data-cover-action="stop_cover" data-entity="${escapeHtml(entityId)}" aria-label="Stop"${disabled}><ha-icon icon="mdi:stop"></ha-icon></button>
          <button type="button" data-cover-action="close_cover" data-entity="${escapeHtml(entityId)}" aria-label="Close"${disabled}><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        </div></div>
      `;
    }).join("");
    const scenes = room.scenes.map((entityId) => `
      <button type="button" class="scene-button" data-scene="${escapeHtml(entityId)}"${disabled}><ha-icon icon="${ICONS.scene}"></ha-icon>${escapeHtml(entityName(states[entityId], titleCase(entityId.split(".")[1])))}</button>
    `).join("");
    const media = room.media_players.map((entityId) => {
      const state = states[entityId];
      return `
        <button type="button" class="media-room-control" data-media-toggle="${escapeHtml(entityId)}"${disabled}><ha-icon icon="${state?.state === "playing" ? "mdi:pause-circle" : "mdi:play-circle"}"></ha-icon><span><strong>${escapeHtml(entityName(state, "Speaker"))}</strong><small>${escapeHtml(state?.attributes?.media_title || titleCase(state?.state || "idle"))}</small></span></button>
      `;
    }).join("");
    return `
      <div class="room-title"><span class="room-icon"><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><p class="eyebrow">${readOnly ? "Read-only room" : "Room controls"}</p><h2>${escapeHtml(room.name)}</h2><p>${summary.lightsOn} light${summary.lightsOn === 1 ? "" : "s"} on${Number.isFinite(summary.temperature) ? ` · ${formatTemperature(summary.temperature)}` : ""}</p></div></div>
      ${readOnly ? '<p class="read-only-note"><ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon>Controls are disabled while this version is being checked.</p>' : ""}
      <div class="room-control-list">${climateControl}${lights}${covers}</div>
      ${scenes ? `<div class="scene-list"><p class="eyebrow">Scenes</p>${scenes}</div>` : ""}
      ${media ? `<div class="room-media"><p class="eyebrow">Music</p>${media}</div>` : ""}
      ${!climate && !lights && !covers && !scenes && !media ? '<p class="empty-state">No controls are mapped for this room yet.</p>' : ""}
    `;
  }

  _renderFamily() {
    const locationEnabled = this._config.features.location_map;
    const children = this._config.people.filter((person) => person.role === "child");
    const states = this._hass?.states || {};
    const allChoreStates = this._config.chores.users.flatMap((user) => (user.status_entities || []).map((entityId) => states[entityId]));
    const completed = allChoreStates.filter((state) => ["approved", "completed", "completed_by_other"].includes(String(state?.state || "").toLowerCase())).length;
    const due = this._config.chores.users.reduce((total, user) => total + safeNumber(states[user.chores_entity]?.attributes?.chore_stat_current_due_today, 0), 0);
    if (!locationEnabled) {
      return `
        <section class="family-dashboard">
          <article class="surface family-rhythm">
            <div><p class="eyebrow">Today together</p><h2>Small routines, visible progress</h2><p>Actual ChoreOps tasks are shown below. This test stays read-only.</p></div>
            <div class="rhythm-stats"><span><strong>${due}</strong> due today</span><span><strong>${completed}</strong> completed</span><span><strong>${allChoreStates.length}</strong> routines mapped</span></div>
          </article>
          <div class="family-people-grid">${children.map((person) => this._renderFamilyPerson(person)).join("")}</div>
        </section>
      `;
    }
    return `
      <section class="family-layout">
        <article class="surface map-panel">
          <div class="section-heading"><div><p class="eyebrow">${locationEnabled ? "Family map" : "Family overview"}</p><h2>${locationEnabled ? "Presence & location" : "Private family summary"}</h2></div><span>${locationEnabled ? "Private to Home Assistant" : "Location sharing off"}</span></div>
          ${locationEnabled ? '<div id="map-card-slot" class="child-card-slot map-slot"></div>' : '<p class="empty-state">Location sharing is disabled.</p>'}
        </article>
        <aside class="family-sidebar">
          ${children.map((person) => this._renderFamilyPerson(person)).join("")}
        </aside>
      </section>
    `;
  }

  _renderFamilyPerson(person) {
    const states = this._hass?.states || {};
    const chore = this._config.chores.users.find((entry) => entry.person_id === person.id);
    const classroom = this._config.school.classroom_students.find((entry) => entry.person_id === person.id);
    const assignments = classroom ? (states[classroom.assignments_entity]?.attributes?.assignments || []) : [];
    const points = chore ? states[chore.points_entity]?.state : "0";
    const due = chore ? safeNumber(states[chore.chores_entity]?.attributes?.chore_stat_current_due_today, 0) : 0;
    const nextAssignment = [...assignments].sort((a, b) => new Date(a.due_at || 0) - new Date(b.due_at || 0))[0];
    const presence = this._config.features.location_map && person.location_entity
      ? titleCase(states[person.location_entity]?.state || "Location unavailable")
      : "Family member";
    const choreRows = (chore?.status_entities || []).map((entityId) => {
      const state = states[entityId];
      const presentation = normaliseChoreStatus(state, entityId);
      return `
        <li class="chore-row is-${escapeHtml(presentation.tone)}">
          <span class="chore-check"><ha-icon icon="${presentation.tone === "done" ? "mdi:check" : presentation.tone === "overdue" ? "mdi:alert" : "mdi:circle-small"}" aria-hidden="true"></ha-icon></span>
          <span><strong>${escapeHtml(presentation.name)}</strong><small>${escapeHtml(presentation.label)}${presentation.due ? ` · ${escapeHtml(formatTime(presentation.due, this._config.product.locale, this._config.product.timezone))}` : ""}</small></span>
          ${Number.isFinite(presentation.points) ? `<b>+${presentation.points}</b>` : ""}
        </li>
      `;
    }).join("");
    return `
      <article class="surface family-person" style="--person-colour:${escapeHtml(person.colour)}">
        <div class="family-person-heading"><span>${escapeHtml(person.name.slice(0, 1))}</span><div><p class="eyebrow">${escapeHtml(person.name)}</p><h2>${escapeHtml(presence)}</h2></div></div>
        <div class="family-facts"><span><strong>${escapeHtml(points || "0")}</strong> chore points</span><span><strong>${due}</strong> due today</span><span><strong>${assignments.length}</strong> assignments</span></div>
        <div class="chore-heading"><p class="eyebrow">Today’s routines</p><span>${choreRows ? `${(chore?.status_entities || []).length} mapped` : "Not mapped"}</span></div>
        ${choreRows ? `<ul class="chore-list">${choreRows}</ul>` : '<p class="empty-state compact">No individual ChoreOps status sensors are mapped.</p>'}
        ${nextAssignment ? `<div class="assignment"><ha-icon icon="${ICONS.school}"></ha-icon><div><strong>${escapeHtml(nextAssignment.title || "Assignment")}</strong><small>${escapeHtml(nextAssignment.course || "Google Classroom")} · ${escapeHtml(formatDay(nextAssignment.due_at, this._config.product.locale, this._config.product.timezone))}</small></div></div>` : ""}
      </article>
    `;
  }

  _renderMusic() {
    const readOnly = this._config.display.read_only;
    return `
      <section class="music-experience">
        <article class="surface media-player-panel">
          <div class="section-heading music-heading"><div><p class="eyebrow">Spotify · Sonos</p><h2>${readOnly ? "Your full music player" : "Browse, group and play"}</h2></div><span class="music-meta">${this._config.media.players.length} rooms${readOnly ? ' · <ha-icon icon="mdi:lock-outline" aria-hidden="true"></ha-icon> playback locked' : ""}</span></div>
          <div class="media-player-stage ${readOnly ? "is-read-only" : ""}">
            <div id="music-card-slot" class="child-card-slot"></div>
          </div>
        </article>
      </section>
    `;
  }

  _footballState() {
    const states = this._hass?.states || {};
    const index = states[this._config.football.index_entity];
    const suggested = safeNumber(index?.attributes?.current_gameweek || index?.attributes?.next_gameweek || index?.state, 1);
    const gameweek = Math.max(1, Math.min(38, this._gameweek || suggested || 1));
    const gameweekState = states[`${this._config.football.gameweek_entity_prefix}${gameweek}`];
    const table = states[this._config.football.table_entity];
    return { index, gameweek, gameweekState, table };
  }

  _featuredFixtures() {
    const { gameweekState } = this._footballState();
    const fixtures = gameweekState?.attributes?.events || [];
    return fixtures.filter((fixture) => fixture.spotlight).slice(0, 2).map((fixture) => this._renderCompactFixture(fixture)).join("");
  }

  _renderCompactFixture(fixture) {
    const status = normaliseFixtureStatus(fixture);
    const score = status === "upcoming"
      ? formatTime(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)
      : `${fixture.home_score ?? "–"}–${fixture.away_score ?? "–"}`;
    return `
      <button type="button" class="compact-fixture" data-view="football">
        <span title="${escapeHtml(fixture.home?.name || "Home")}">${escapeHtml(compactClubName(fixture.home))}</span><strong>${escapeHtml(score)}</strong><span title="${escapeHtml(fixture.away?.name || "Away")}">${escapeHtml(compactClubName(fixture.away))}</span>
        <small>${escapeHtml(status === "live" ? `LIVE · ${fixture.minutes || 0}'` : formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone))}</small>
      </button>
    `;
  }

  _renderFootball() {
    const { index, gameweek, gameweekState, table } = this._footballState();
    const events = gameweekState?.attributes?.events || [];
    const available = index?.attributes?.available_gameweeks || Array.from({ length: 38 }, (_, position) => position + 1);
    this._gameweek = gameweek;
    return `
      <section class="football-layout">
        <article class="surface football-main">
          <div class="football-toolbar">
            <div><p class="eyebrow">Premier League</p><h2>Matchweek ${gameweek}</h2></div>
            <div class="matchweek-controls">
              <button type="button" data-gameweek="${Math.max(1, gameweek - 1)}" ${gameweek <= 1 ? "disabled" : ""} aria-label="Previous matchweek"><ha-icon icon="mdi:chevron-left"></ha-icon></button>
              <label><span class="sr-only">Choose matchweek</span><select data-gameweek-select>${available.map((entry) => `<option value="${entry}" ${entry === gameweek ? "selected" : ""}>MW ${entry}</option>`).join("")}</select></label>
              <button type="button" data-gameweek="${Math.min(38, gameweek + 1)}" ${gameweek >= 38 ? "disabled" : ""} aria-label="Next matchweek"><ha-icon icon="mdi:chevron-right"></ha-icon></button>
            </div>
            <div class="segments football-tabs" role="group" aria-label="Football view">
              <button type="button" class="segment ${this._footballTab === "fixtures" ? "is-selected" : ""}" data-football-tab="fixtures">Fixtures</button>
              <button type="button" class="segment ${this._footballTab === "table" ? "is-selected" : ""}" data-football-tab="table">Table</button>
            </div>
          </div>
          ${this._footballTab === "table" ? this._renderLeagueTable(table) : this._renderFixtures(events)}
        </article>
        <aside class="football-sidebar">
          <article class="surface spotlight-panel"><p class="eyebrow">Spotlight</p><h2>Tottenham & Aston Villa</h2>${this._renderSpotlightClubs(events)}</article>
          <article class="surface provider-panel"><p class="eyebrow">Data</p><h2>${events.length ? `${events.length} fixtures loaded` : "Waiting for first update"}</h2><p>${escapeHtml(index?.attributes?.last_updated ? `Updated ${formatTime(index.attributes.last_updated, this._config.product.locale, this._config.product.timezone)}` : "The cached provider will retain the last good matchweek if the source is unavailable.")}</p></article>
        </aside>
      </section>
    `;
  }

  _renderFixtures(events) {
    if (!events.length) return `
      <div class="football-empty">
        <span class="football-orbit"><ha-icon icon="mdi:soccer" aria-hidden="true"></ha-icon></span>
        <div><p class="eyebrow">Between matchweeks</p><h3>The next fixtures are still in the tunnel</h3><p>Tottenham and Aston Villa will be highlighted here as soon as the provider publishes this matchweek.</p></div>
        <div class="empty-clubs"><span>TOT</span><i></i><span>AVL</span></div>
      </div>
    `;
    const grouped = new Map();
    for (const fixture of events) {
      const key = formatDay(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(fixture);
    }
    return `<div class="fixture-groups">${[...grouped.entries()].map(([day, fixtures]) => `
      <section class="fixture-day"><h3>${escapeHtml(day)}</h3>${fixtures.map((fixture) => this._renderFixture(fixture)).join("")}</section>
    `).join("")}</div>`;
  }

  _renderFixture(fixture) {
    const status = normaliseFixtureStatus(fixture);
    const score = status === "upcoming"
      ? formatTime(fixture.kickoff_time, this._config.product.locale, this._config.product.timezone)
      : `${fixture.home_score ?? "–"} — ${fixture.away_score ?? "–"}`;
    const scorers = [
      ...(fixture.home_scorers || []).map((name) => `${name} (H)`),
      ...(fixture.away_scorers || []).map((name) => `${name} (A)`)
    ];
    return `
      <div class="fixture ${fixture.spotlight ? "is-spotlight" : ""} ${status === "live" ? "is-live" : ""}">
        <span class="team home-team">${escapeHtml(fixture.home?.name || "Home")}</span>
        <strong class="fixture-score">${escapeHtml(score)}<small>${status === "live" ? `LIVE · ${fixture.minutes || 0}'` : status === "finished" ? "FT" : ""}</small></strong>
        <span class="team away-team">${escapeHtml(fixture.away?.name || "Away")}</span>
        ${scorers.length ? `<span class="scorers">${escapeHtml(scorers.join(" · "))}</span>` : ""}
      </div>
    `;
  }

  _renderLeagueTable(tableState) {
    const rows = tableState?.attributes?.rows || [];
    if (!rows.length) return '<p class="empty-state large">The table will appear after the football provider publishes results.</p>';
    return `
      <div class="league-table-wrap"><table class="league-table"><thead><tr><th>#</th><th>Club</th><th>P</th><th>W</th><th>D</th><th>L</th><th>GD</th><th>Pts</th></tr></thead><tbody>
        ${rows.map((row) => `<tr class="${row.spotlight ? "is-spotlight" : ""}"><td>${row.position}</td><td><strong>${escapeHtml(row.name)}</strong></td><td>${row.played}</td><td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.goal_difference > 0 ? "+" : ""}${row.goal_difference}</td><td><strong>${row.points}</strong></td></tr>`).join("")}
      </tbody></table></div>
    `;
  }

  _renderSpotlightClubs(events) {
    return this._config.football.spotlight_team_codes.map((code) => {
      const fixture = events.find((entry) => entry.home?.short_name === code || entry.away?.short_name === code);
      const name = fixture?.home?.short_name === code ? fixture.home.name : fixture?.away?.name;
      return `
        <div class="spotlight-club"><span class="club-badge">${escapeHtml(code)}</span><div><strong>${escapeHtml(name || (code === "TOT" ? "Tottenham Hotspur" : code === "AVL" ? "Aston Villa" : code))}</strong><small>${fixture ? `${fixture.home.name} v ${fixture.away.name}` : "No fixture in this matchweek"}</small></div></div>
      `;
    }).join("");
  }

  _mountChildCards() {
    if (!this._hass || !globalThis.loadCardHelpers) return;
    if (this._view === "family" && this._config.features.location_map) {
      this._ensureChildCard("map", {
        type: "map",
        auto_fit: true,
        fit_zones: true,
        hours_to_show: this._config.location.hours_to_show,
        entities: this._config.location.entities
      }, "map-card-slot");
    }
    if (this._view === "music") {
      this._ensureChildCard("music", {
        type: this._config.media.card_type,
        size: "large",
        mode: "in-card",
        height: "100%",
        entity_id: this._config.media.initial_player,
        media_players: this._config.media.players,
        options: {
          player_is_active_when: "playing_or_paused",
          show_volume_step_buttons: true,
          default_tab: "massive",
          transparent_background_on_home: true
        }
      }, "music-card-slot");
    }
  }

  async _ensureChildCard(key, cardConfig, slotId) {
    const slot = this.shadowRoot.getElementById(slotId);
    if (!slot) return;
    let child = this._childCards.get(key);
    if (!child) {
      try {
        const helpers = await globalThis.loadCardHelpers();
        child = helpers.createCardElement(cardConfig);
        child.classList.add("embedded-card");
        this._childCards.set(key, child);
      } catch (error) {
        slot.innerHTML = `<p class="empty-state">This Home Assistant card could not load: ${escapeHtml(error?.message || error)}</p>`;
        return;
      }
    }
    if (key === "music") {
      const readOnly = this._config.display.read_only === true;
      child.inert = false;
      if (readOnly) {
        child.setAttribute("aria-disabled", "true");
        child.dataset.readOnlyGuard = "service-boundary";
      } else {
        child.removeAttribute("aria-disabled");
        delete child.dataset.readOnlyGuard;
      }
    }
    child.hass = this._hassForChild(key);
    slot.replaceChildren(child);
  }

  _hassForChild(key) {
    if (key !== "music" || !this._config?.display?.read_only || !this._hass) return this._hass;
    if (this._readOnlyHassSource === this._hass && this._readOnlyHass) return this._readOnlyHass;
    const source = this._hass;
    this._readOnlyHassSource = source;
    this._readOnlyHass = new Proxy(source, {
      get(target, property) {
        if (property === "callService") return () => undefined;
        if (property === "callApi") {
          return (method, ...args) => String(method || "GET").toUpperCase() === "GET"
            ? target.callApi?.(method, ...args)
            : Promise.resolve(undefined);
        }
        if (property === "callWS") {
          return (message, ...args) => message?.type === "call_service"
            ? Promise.resolve(undefined)
            : target.callWS?.(message, ...args);
        }
        const value = Reflect.get(target, property, target);
        return typeof value === "function" ? value.bind(target) : value;
      }
    });
    return this._readOnlyHass;
  }

  _handleKeydown(event) {
    const target = event.target.closest?.("[data-room]");
    if (!target || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    this._selectRoom(target.dataset.room);
  }

  _handleChange(event) {
    const select = event.target.closest?.("[data-gameweek-select]");
    if (!select) return;
    this._gameweek = Math.max(1, Math.min(38, safeNumber(select.value, 1)));
    this._scheduleRender(true);
  }

  _handleClick(event) {
    const target = event.target.closest?.("button, [data-room]");
    if (!target) return;
    if (target.dataset.view) {
      if (!this._enabledViews().some((view) => view.id === target.dataset.view)) return;
      this._view = target.dataset.view;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.floor) {
      this._floor = target.dataset.floor;
      this._room = this._config.floorplan.floors.find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || null;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.room) {
      this._selectRoom(target.dataset.room);
      return;
    }
    if (target.dataset.footballTab) {
      this._footballTab = target.dataset.footballTab;
      this._scheduleRender(true);
      return;
    }
    if (target.dataset.gameweek) {
      this._gameweek = safeNumber(target.dataset.gameweek, 1);
      this._scheduleRender(true);
      return;
    }
    if (this._config.display.read_only && (isControlAction(target.dataset) || target.dataset.moreInfo)) return;
    if (target.dataset.moreInfo) {
      this._showMoreInfo(target.dataset.moreInfo);
      return;
    }
    if (target.dataset.toggle) {
      this._hass?.callService?.("homeassistant", "toggle", { entity_id: target.dataset.toggle });
      return;
    }
    if (target.dataset.scene) {
      this._hass?.callService?.("scene", "turn_on", { entity_id: target.dataset.scene });
      return;
    }
    if (target.dataset.mediaToggle) {
      this._hass?.callService?.("media_player", "media_play_pause", { entity_id: target.dataset.mediaToggle });
      return;
    }
    if (target.dataset.coverAction && target.dataset.entity) {
      this._hass?.callService?.("cover", target.dataset.coverAction, { entity_id: target.dataset.entity });
      return;
    }
    if (target.dataset.climateAdjust && target.dataset.entity) {
      const state = this._hass?.states?.[target.dataset.entity];
      const current = safeNumber(state?.attributes?.temperature, NaN);
      if (Number.isFinite(current)) {
        this._hass.callService("climate", "set_temperature", {
          entity_id: target.dataset.entity,
          temperature: Math.round((current + safeNumber(target.dataset.climateAdjust)) * 2) / 2
        });
      }
    }
  }

  _selectRoom(roomId) {
    const room = this._config.rooms.find((entry) => entry.id === roomId);
    if (!room) return;
    this._room = roomId;
    this._floor = room.floor_id;
    this._scheduleRender(true);
  }

  _showMoreInfo(entityId) {
    if (this._config.display.read_only) return;
    const event = new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId }
    });
    this.dispatchEvent(event);
  }

  _styles() {
    return `
      :host { --family-ha-header-offset:var(--header-height,56px); display:block; width:100%; min-width:0; min-height:664px; height:calc(100vh - var(--family-ha-header-offset)); margin-top:var(--family-ha-header-offset); color:var(--primary-text-color); }
      *, *::before, *::after { box-sizing:border-box; }
      button, select { font:inherit; }
      button { -webkit-tap-highlight-color:transparent; }
      .hub-card { overflow:hidden; border:0; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); color:var(--hub-text); min-height:100%; height:100%; }
      .shell { display:grid; grid-template-columns:86px minmax(0,1fr); min-height:100%; height:100%; background:radial-gradient(circle at 82% 8%,rgba(232,148,126,.72) 0,rgba(232,148,126,0) 34%),radial-gradient(circle at 34% 106%,rgba(123,104,211,.48) 0,rgba(123,104,211,0) 42%),linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 54%,var(--hub-backdrop-end)); }
      .navigation { padding:14px 9px; background:linear-gradient(180deg,color-mix(in srgb,var(--hub-nav) 96%,transparent),color-mix(in srgb,var(--hub-nav) 86%,var(--hub-accent))); border-right:1px solid rgba(255,255,255,.1); display:flex; flex-direction:column; gap:14px; min-height:0; }
      .brand { width:54px; height:54px; margin:0 auto; border-radius:50%; border:1px solid rgba(255,255,255,.45); background:rgba(255,255,255,.12); color:#fff; font-size:24px; font-weight:700; cursor:pointer; }
      .nav-items { display:flex; min-height:0; flex:1; flex-direction:column; justify-content:center; gap:8px; }
      .nav-button { min-height:64px; border:1px solid transparent; border-radius:20px; background:transparent; color:rgba(255,255,255,.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; }
      .nav-button ha-icon { --mdc-icon-size:22px; }
      .nav-button span { font-size:10px; font-weight:600; }
      .nav-button.is-active { color:#fff; background:linear-gradient(145deg,var(--hub-backdrop-end),var(--hub-accent)); border-color:rgba(255,255,255,.35); box-shadow:0 10px 24px rgba(13,18,34,.28); }
      .content { min-width:0; min-height:0; padding:12px 18px 16px; display:grid; grid-template-rows:56px minmax(0,1fr); gap:10px; background:linear-gradient(135deg,rgba(17,28,51,.18),rgba(183,101,98,.12)); }
      .topbar { min-width:0; display:flex; justify-content:space-between; align-items:center; color:#fff; padding:0 4px; }
      .topbar h1 { margin:2px 0 0; font-size:30px; line-height:1; font-weight:700; }
      .eyebrow { margin:0; font-size:10px; line-height:1.2; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--hub-muted); }
      .topbar .eyebrow { color:rgba(255,255,255,.72); }
      .header-actions { display:flex; align-items:center; gap:9px; }
      .preview-pill { min-height:36px; padding:0 12px; border:1px solid rgba(255,255,255,.34); border-radius:14px; display:flex; align-items:center; gap:7px; background:rgba(255,255,255,.13); color:#fff; font-size:11px; font-weight:700; }
      .preview-pill ha-icon { --mdc-icon-size:18px; }
      .weather-pill { min-height:48px; padding:0 16px; border:1px solid rgba(255,255,255,.28); border-radius:18px; background:rgba(255,255,255,.14); color:#fff; display:flex; align-items:center; gap:9px; cursor:pointer; }
      .view { min-height:0; min-width:0; }
      .surface { color:var(--hub-text); background:linear-gradient(145deg,color-mix(in srgb,var(--hub-surface) 82%,transparent),color-mix(in srgb,var(--hub-backdrop-mid) 72%,transparent)); border:1px solid rgba(255,255,255,.16); border-radius:var(--hub-radius); box-shadow:0 20px 52px rgba(3,8,24,.3),inset 0 1px 0 rgba(255,255,255,.1); -webkit-backdrop-filter:blur(22px) saturate(1.18); backdrop-filter:blur(22px) saturate(1.18); }
      .today-grid { height:100%; display:grid; grid-template-columns:minmax(0,1.35fr) minmax(245px,.9fr) minmax(240px,.85fr); grid-template-rows:minmax(190px,.82fr) minmax(210px,1.18fr); gap:14px; }
      .today-grid article { padding:20px; min-width:0; overflow:hidden; }
      .today-grid h2 { margin:7px 0 0; font-size:22px; line-height:1.16; }
      .supporting { margin:8px 0 0; color:var(--hub-muted); font-size:13px; }
      .hero-panel { grid-column:span 2; background:linear-gradient(140deg,color-mix(in srgb,var(--hub-accent) 86%,#000),var(--hub-backdrop-end)); color:#fff; }
      .hero-panel .eyebrow { color:rgba(255,255,255,.7); }
      .hero-panel h2 { font-size:30px; }
      .hero-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:10px; margin-top:22px; }
      .hero-metrics button { text-align:left; min-height:74px; padding:12px 14px; border:1px solid rgba(255,255,255,.2); background:rgba(255,255,255,.12); color:#fff; border-radius:16px; cursor:pointer; }
      .hero-metrics strong,.hero-metrics span { display:block; }
      .hero-metrics strong { font-size:18px; }
      .hero-metrics span { margin-top:4px; font-size:10px; opacity:.74; }
      .next-panel { display:flex; flex-direction:column; }
      .next-panel .text-action { margin-top:auto; }
      .text-action,.section-heading button { width:max-content; border:0; padding:5px 0; background:transparent; color:var(--hub-accent); font-size:12px; font-weight:700; cursor:pointer; }
      .children-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .football-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .now-playing-panel { grid-row:2; display:flex; flex-direction:column; justify-content:center; }
      .section-heading { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
      .section-heading h2 { margin:4px 0 0; font-size:19px; }
      .section-heading > span { color:var(--hub-muted); font-size:11px; }
      .person-summary-list { display:grid; gap:8px; margin-top:14px; }
      .person-summary { width:100%; border:0; background:color-mix(in srgb,var(--person-colour) 9%,var(--hub-surface)); padding:10px; border-radius:15px; display:grid; grid-template-columns:36px minmax(0,1fr) auto; align-items:center; gap:9px; text-align:left; color:var(--hub-text); cursor:pointer; }
      .person-initial { width:34px; height:34px; display:grid; place-items:center; border-radius:50%; background:var(--person-colour); color:#fff; font-weight:700; }
      .person-summary strong,.person-summary small { display:block; }
      .person-summary small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .points { font-size:11px; font-weight:700; color:var(--person-colour); }
      .featured-fixtures { display:grid; gap:8px; margin-top:12px; }
      .compact-fixture { border:1px solid color-mix(in srgb,var(--hub-accent) 18%,transparent); border-radius:15px; background:var(--hub-surface); min-height:60px; padding:9px 10px; color:var(--hub-text); display:grid; grid-template-columns:minmax(0,1fr) auto minmax(0,1fr); gap:7px; align-items:center; cursor:pointer; }
      .compact-fixture > span { min-width:0; overflow:hidden; font-size:10px; font-weight:650; white-space:nowrap; text-overflow:ellipsis; }
      .compact-fixture span:last-of-type { text-align:right; }
      .compact-fixture small { grid-column:1/-1; color:var(--hub-muted); font-size:9px; text-align:center; }
      .now-playing { display:grid; grid-template-columns:58px minmax(0,1fr) 38px; gap:12px; align-items:center; margin-top:14px; }
      .artwork { width:58px; height:58px; border-radius:14px; overflow:hidden; display:grid; place-items:center; background:linear-gradient(145deg,var(--hub-accent),var(--hub-backdrop-end)); color:#fff; }
      .artwork img { width:100%; height:100%; object-fit:cover; }
      .now-playing h2 { font-size:16px; margin:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .now-playing p { margin:4px 0 0; color:var(--hub-muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .icon-action { width:38px; height:38px; padding:0; display:grid; place-items:center; border:0; border-radius:50%; background:color-mix(in srgb,var(--hub-accent) 12%,var(--hub-surface)); color:var(--hub-accent); cursor:pointer; }
      .single-surface { height:100%; padding:18px; overflow:hidden; }
      .embedded-view { display:grid; grid-template-rows:48px minmax(0,1fr); gap:10px; }
      .child-card-slot { min-height:0; overflow:auto; border-radius:16px; }
      .child-card-slot > * { display:block; min-height:100%; }
      .rooms-layout { height:100%; display:grid; grid-template-columns:minmax(0,3.2fr) minmax(232px,1fr); gap:12px; }
      .floorplan-panel { min-width:0; min-height:0; padding:14px; display:grid; grid-template-rows:48px minmax(0,1fr); gap:7px; }
      .floorplan-heading { align-items:center; }
      .segments { display:flex; flex-shrink:0; align-items:center; gap:4px; padding:3px; border-radius:13px; background:color-mix(in srgb,var(--hub-muted) 10%,transparent); }
      .segment { min-height:32px; padding:0 12px; border:0; border-radius:10px; background:transparent; color:var(--hub-muted); font-size:11px; font-weight:700; white-space:nowrap; cursor:pointer; }
      .segment.is-selected { color:#fff; background:var(--hub-accent); }
      .floorplan-canvas { position:relative; min-height:0; overflow:hidden; border-radius:18px; background:radial-gradient(circle at 52% 34%,rgba(100,91,145,.38) 0,rgba(20,28,52,.88) 52%,rgba(7,13,29,.96) 100%); border:1px solid rgba(255,255,255,.14); }
      .floorplan-backdrop { position:absolute; inset:0; background:linear-gradient(145deg,rgba(255,255,255,.07),transparent 48%),radial-gradient(ellipse at 50% 80%,rgba(3,8,24,.62),transparent 55%); }
      .floorplan-visual { position:absolute; inset:0; width:100%; height:100%; z-index:4; }
      .floorplan-image,.light-overlay { pointer-events:none; }
      .light-overlay { mix-blend-mode:screen; }
      .room-hotspot { cursor:pointer; outline:none; }
      .room-hotspot polygon { fill:transparent; stroke:transparent; stroke-width:.45; vector-effect:non-scaling-stroke; transition:fill .18s ease,stroke .18s ease,filter .18s ease; }
      .room-hotspot.has-light polygon { fill:color-mix(in srgb,var(--room-colour) 12%,transparent); filter:drop-shadow(0 0 4px var(--room-colour)); }
      .room-hotspot.is-selected polygon,.room-hotspot:focus polygon { fill:color-mix(in srgb,var(--hub-accent) 8%,transparent); stroke:#b9aaff; stroke-width:.72; filter:drop-shadow(0 0 4px var(--hub-accent)); }
      .room-detail { padding:16px; min-height:0; overflow:auto; }
      .read-only-note { display:flex; align-items:center; gap:7px; margin:14px 0 0; padding:10px 12px; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-muted); font-size:11px; }
      .read-only-note ha-icon { --mdc-icon-size:17px; color:var(--hub-accent); }
      .read-only-music { display:grid; place-items:center; grid-template-columns:minmax(0,1fr) 130px; padding:42px; }
      .read-only-music h2 { margin:7px 0 0; font-size:30px; }
      .read-only-music > ha-icon { --mdc-icon-size:112px; color:color-mix(in srgb,var(--hub-accent) 58%,transparent); }
      button:disabled { cursor:not-allowed; opacity:.58; }
      .room-title { display:flex; gap:12px; align-items:center; }
      .room-icon { width:46px; height:46px; border-radius:15px; display:grid; place-items:center; background:color-mix(in srgb,var(--hub-accent) 12%,var(--hub-surface)); color:var(--hub-accent); }
      .room-title h2 { margin:3px 0 0; font-size:22px; }
      .room-title p:last-child { margin:3px 0 0; color:var(--hub-muted); font-size:11px; }
      .room-control-list { display:grid; gap:9px; margin-top:18px; }
      .control-row { display:grid; grid-template-columns:minmax(0,1fr) 38px; gap:7px; align-items:center; }
      .control-main,.media-room-control { min-height:54px; border:1px solid color-mix(in srgb,var(--hub-muted) 13%,transparent); border-radius:15px; background:var(--hub-surface); color:var(--hub-text); display:flex; gap:10px; align-items:center; text-align:left; padding:9px 12px; cursor:pointer; }
      .control-main.is-on { color:var(--hub-text); background:color-mix(in srgb,#f2b85c 18%,var(--hub-surface)); }
      .control-main strong,.control-main small,.media-room-control strong,.media-room-control small { display:block; }
      .control-main small,.media-room-control small { margin-top:2px; color:var(--hub-muted); font-size:10px; }
      .climate-control { padding:14px; border-radius:16px; background:linear-gradient(145deg,color-mix(in srgb,#ee6c62 12%,var(--hub-surface)),var(--hub-surface)); display:flex; align-items:center; justify-content:space-between; }
      .climate-control span,.climate-control strong,.climate-control small { display:block; }
      .climate-control span { color:var(--hub-muted); font-size:10px; }
      .climate-control strong { margin-top:2px; font-size:27px; }
      .climate-control small { color:var(--hub-muted); font-size:10px; }
      .stepper { display:flex; gap:5px; }
      .stepper button,.cover-control button { width:36px; height:36px; border:0; border-radius:11px; background:var(--hub-surface); color:var(--hub-accent); font-weight:700; cursor:pointer; }
      .cover-control { min-height:60px; border-radius:15px; background:var(--hub-surface); padding:9px 10px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
      .cover-control > span { display:grid; grid-template-columns:25px minmax(0,1fr); grid-template-rows:auto auto; column-gap:7px; align-items:center; }
      .cover-control > span ha-icon { grid-row:1/3; }
      .cover-control strong,.cover-control small { display:block; }
      .cover-control small { color:var(--hub-muted); font-size:10px; }
      .cover-control > div { display:flex; gap:4px; }
      .scene-list,.room-media { margin-top:18px; display:flex; gap:7px; flex-wrap:wrap; }
      .scene-list .eyebrow,.room-media .eyebrow { flex-basis:100%; }
      .scene-button { min-height:40px; padding:0 12px; border:0; border-radius:13px; background:color-mix(in srgb,var(--hub-accent) 10%,var(--hub-surface)); color:var(--hub-accent); display:flex; align-items:center; gap:6px; cursor:pointer; }
      .media-room-control { width:100%; }
      .family-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.55fr) minmax(310px,.72fr); gap:14px; }
      .map-panel { padding:18px; min-height:0; display:grid; grid-template-rows:48px minmax(0,1fr); gap:9px; overflow:hidden; }
      .map-slot { overflow:hidden; }
      .family-sidebar { min-height:0; display:grid; grid-template-rows:repeat(2,minmax(0,1fr)); gap:14px; }
      .family-person { padding:18px; min-height:0; overflow:auto; }
      .family-person-heading { display:flex; align-items:center; gap:10px; }
      .family-person-heading > span { width:42px; height:42px; border-radius:50%; display:grid; place-items:center; background:var(--person-colour); color:#fff; font-weight:700; }
      .family-person-heading h2 { margin:3px 0 0; font-size:16px; }
      .family-facts { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:15px; }
      .family-facts span { padding:8px; border-radius:12px; background:color-mix(in srgb,var(--person-colour) 8%,var(--hub-surface)); color:var(--hub-muted); font-size:9px; }
      .family-facts strong { display:block; color:var(--hub-text); font-size:16px; }
      .assignment { display:flex; gap:8px; margin-top:13px; padding-top:12px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 16%,transparent); }
      .assignment strong,.assignment small { display:block; }
      .assignment small { margin-top:3px; color:var(--hub-muted); font-size:9px; }
      .football-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(260px,.62fr); gap:14px; }
      .football-main { min-height:0; padding:18px; display:grid; grid-template-rows:54px minmax(0,1fr); overflow:hidden; }
      .football-toolbar { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:12px; align-items:center; }
      .football-toolbar h2 { margin:3px 0 0; font-size:20px; }
      .matchweek-controls { display:flex; align-items:center; gap:4px; }
      .matchweek-controls button { width:34px; height:34px; display:grid; place-items:center; border:0; border-radius:10px; background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); color:var(--hub-accent); cursor:pointer; }
      .matchweek-controls button:disabled { opacity:.35; cursor:default; }
      .matchweek-controls select { height:34px; min-width:76px; border:1px solid color-mix(in srgb,var(--hub-muted) 18%,transparent); border-radius:10px; background:var(--hub-surface); color:var(--hub-text); padding:0 8px; }
      .football-tabs .segment { min-height:30px; }
      .fixture-groups { min-height:0; overflow:auto; padding-right:4px; }
      .fixture-day h3 { margin:13px 0 7px; color:var(--hub-muted); font-size:10px; letter-spacing:.09em; text-transform:uppercase; }
      .fixture { min-height:46px; display:grid; grid-template-columns:minmax(0,1fr) 82px minmax(0,1fr); align-items:center; gap:8px; padding:6px 10px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 12%,transparent); }
      .fixture.is-spotlight { border-radius:12px; border:1px solid color-mix(in srgb,var(--hub-accent) 26%,transparent); background:color-mix(in srgb,var(--hub-accent) 6%,var(--hub-surface)); margin:4px 0; }
      .fixture.is-live { border-color:#d94848; }
      .team { font-size:12px; font-weight:600; }
      .away-team { text-align:right; }
      .fixture-score { text-align:center; font-size:14px; }
      .fixture-score small { display:block; margin-top:2px; color:var(--hub-muted); font-size:8px; }
      .fixture.is-live .fixture-score small { color:#d94848; }
      .scorers { grid-column:1/-1; text-align:center; color:var(--hub-muted); font-size:8px; }
      .football-sidebar { min-height:0; display:grid; grid-template-rows:minmax(0,1fr) auto; gap:14px; }
      .spotlight-panel,.provider-panel { padding:18px; overflow:hidden; }
      .spotlight-panel h2,.provider-panel h2 { margin:5px 0 0; font-size:18px; }
      .spotlight-club { display:flex; align-items:center; gap:10px; margin-top:14px; padding-top:13px; border-top:1px solid color-mix(in srgb,var(--hub-muted) 14%,transparent); }
      .club-badge { width:42px; height:42px; display:grid; place-items:center; border-radius:13px; background:var(--hub-nav); color:#fff; font-size:11px; font-weight:700; }
      .spotlight-club strong,.spotlight-club small { display:block; }
      .spotlight-club small { margin-top:3px; color:var(--hub-muted); font-size:9px; }
      .provider-panel p:last-child { margin:8px 0 0; color:var(--hub-muted); font-size:10px; line-height:1.4; }
      .league-table-wrap { min-height:0; overflow:auto; margin-top:10px; }
      .league-table { width:100%; border-collapse:collapse; font-size:11px; }
      .league-table th,.league-table td { padding:7px 8px; text-align:right; border-bottom:1px solid color-mix(in srgb,var(--hub-muted) 12%,transparent); }
      .league-table th:nth-child(2),.league-table td:nth-child(2) { text-align:left; }
      .league-table tr.is-spotlight { background:color-mix(in srgb,var(--hub-accent) 9%,var(--hub-surface)); }
      .calendar-view { position:relative; display:grid; grid-template-rows:52px minmax(0,1fr); gap:10px; background:linear-gradient(155deg,rgba(250,246,245,.94),rgba(235,230,242,.91)); }
      .calendar-heading { align-items:center; }
      .calendar-legends { display:flex; align-items:center; flex-wrap:wrap; justify-content:flex-end; gap:7px 13px; }
      .calendar-legend { display:flex; align-items:center; gap:5px; color:#42495b; font-size:10px; font-weight:700; }
      .calendar-legend i { width:8px; height:8px; border-radius:50%; background:var(--calendar-colour); box-shadow:0 0 0 3px color-mix(in srgb,var(--calendar-colour) 16%,transparent); }
      .calendar-loading { position:absolute; top:14px; right:18px; z-index:2; display:flex; align-items:center; gap:7px; padding:7px 10px; border-radius:999px; background:#fff; color:#4d5568; font-size:9px; box-shadow:0 7px 20px rgba(27,34,53,.12); }
      .calendar-loading span { width:8px; height:8px; border-radius:50%; background:var(--hub-accent); animation:pulse 1.2s ease-in-out infinite; }
      .calendar-warning { position:absolute; z-index:2; bottom:12px; left:50%; transform:translateX(-50%); margin:0; padding:8px 12px; border-radius:12px; background:#fff3d9; color:#704b0d; font-size:9px; box-shadow:0 7px 18px rgba(45,35,14,.14); }
      .agenda-board { min-width:0; min-height:0; display:grid; grid-template-columns:repeat(7,minmax(0,1fr)); gap:7px; overflow:hidden; }
      .agenda-day { min-width:0; min-height:0; display:grid; grid-template-rows:58px minmax(0,1fr); border:1px solid rgba(81,78,99,.12); border-radius:17px; background:rgba(255,255,255,.62); overflow:hidden; }
      .agenda-day.is-today { border-color:color-mix(in srgb,var(--hub-accent) 45%,transparent); background:color-mix(in srgb,var(--hub-accent) 8%,#fff); box-shadow:inset 0 3px 0 var(--hub-accent); }
      .agenda-day > header { padding:9px 8px 7px; display:grid; grid-template-columns:minmax(0,1fr) auto; grid-template-rows:auto auto; align-items:end; border-bottom:1px solid rgba(81,78,99,.1); color:#242a3a; }
      .agenda-day > header span { align-self:start; color:#656c7f; font-size:9px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; }
      .agenda-day > header strong { grid-row:1/3; font-size:25px; line-height:1; }
      .agenda-day > header small { color:#7a8090; font-size:9px; }
      .agenda-events { min-height:0; padding:7px; display:flex; flex-direction:column; gap:6px; overflow:auto; }
      .agenda-event { position:relative; min-width:0; padding:8px 7px 8px 10px; border-radius:11px; background:color-mix(in srgb,var(--calendar-colour) 10%,#fff); color:#222838; box-shadow:0 4px 12px rgba(30,35,54,.07); }
      .agenda-event::before { content:""; position:absolute; inset:5px auto 5px 0; width:3px; border-radius:3px; background:var(--calendar-colour); }
      .agenda-event .event-time { display:block; color:var(--calendar-colour); font-size:8px; font-weight:850; letter-spacing:.04em; }
      .agenda-event strong { display:-webkit-box; margin-top:3px; overflow:hidden; color:#1d2333; font-size:10px; line-height:1.25; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
      .agenda-event small { display:flex; align-items:center; gap:2px; margin-top:5px; overflow:hidden; color:#656c7f; font-size:8px; white-space:nowrap; text-overflow:ellipsis; }
      .agenda-event small ha-icon { --mdc-icon-size:11px; }
      .agenda-empty { margin:12px 4px; color:#8a8f9d; font-size:9px; line-height:1.4; }
      .agenda-more { margin:auto 4px 2px; color:var(--hub-accent); font-size:9px; font-weight:750; }
      .family-dashboard { height:100%; display:grid; grid-template-rows:116px minmax(0,1fr); gap:14px; }
      .family-rhythm { padding:20px 22px; display:flex; align-items:center; justify-content:space-between; gap:18px; background:linear-gradient(125deg,color-mix(in srgb,var(--hub-accent) 86%,#1b2342),color-mix(in srgb,var(--hub-backdrop-end) 82%,#db8e72)); color:#fff; }
      .family-rhythm .eyebrow { color:rgba(255,255,255,.7); }
      .family-rhythm h2 { margin:5px 0 0; font-size:22px; }
      .family-rhythm p:last-child { margin:5px 0 0; color:rgba(255,255,255,.72); font-size:11px; }
      .rhythm-stats { display:grid; grid-template-columns:repeat(3,88px); gap:8px; }
      .rhythm-stats span { min-height:70px; padding:10px; border:1px solid rgba(255,255,255,.2); border-radius:15px; background:rgba(255,255,255,.12); color:rgba(255,255,255,.72); font-size:9px; }
      .rhythm-stats strong { display:block; margin-bottom:3px; color:#fff; font-size:22px; }
      .family-people-grid { min-height:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .family-people-grid .family-person { padding:18px 20px; }
      .chore-heading { display:flex; align-items:center; justify-content:space-between; margin-top:14px; }
      .chore-heading span { color:var(--hub-muted); font-size:9px; }
      .chore-list { margin:8px 0 0; padding:0; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; list-style:none; }
      .chore-row { min-width:0; min-height:54px; display:grid; grid-template-columns:28px minmax(0,1fr) auto; gap:7px; align-items:center; padding:7px 9px; border:1px solid color-mix(in srgb,var(--person-colour) 16%,transparent); border-radius:13px; background:color-mix(in srgb,var(--person-colour) 7%,rgba(255,255,255,.72)); }
      .chore-check { width:26px; height:26px; display:grid; place-items:center; border-radius:9px; background:color-mix(in srgb,var(--person-colour) 14%,#fff); color:var(--person-colour); }
      .chore-check ha-icon { --mdc-icon-size:16px; }
      .chore-row strong,.chore-row small { display:block; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
      .chore-row strong { color:var(--hub-text); font-size:10px; }
      .chore-row small { margin-top:2px; color:var(--hub-muted); font-size:8px; }
      .chore-row b { color:var(--person-colour); font-size:9px; }
      .chore-row.is-done { opacity:.7; }
      .chore-row.is-done .chore-check { background:#dff3e8; color:#18794e; }
      .chore-row.is-overdue { border-color:#e9978f; background:#fff0ef; }
      .chore-row.is-overdue .chore-check { background:#f9d5d1; color:#a9362d; }
      .chore-row.is-waiting .chore-check { background:#fff0cf; color:#8b5b00; }
      .football-empty { min-height:0; height:100%; display:grid; grid-template-columns:90px minmax(0,1fr) auto; gap:20px; align-items:center; padding:26px; border:1px dashed color-mix(in srgb,var(--hub-accent) 32%,transparent); border-radius:18px; background:linear-gradient(145deg,color-mix(in srgb,var(--hub-accent) 7%,#fff),rgba(255,255,255,.5)); }
      .football-orbit { width:82px; height:82px; display:grid; place-items:center; border-radius:50%; background:radial-gradient(circle,#fff 34%,color-mix(in srgb,var(--hub-accent) 18%,#fff) 35% 58%,transparent 59%); color:var(--hub-accent); box-shadow:0 12px 28px rgba(31,36,57,.12); }
      .football-orbit ha-icon { --mdc-icon-size:34px; }
      .football-empty h3 { margin:5px 0 0; color:var(--hub-text); font-size:19px; }
      .football-empty p:last-child { max-width:440px; margin:7px 0 0; color:var(--hub-muted); font-size:11px; line-height:1.45; }
      .empty-clubs { display:flex; align-items:center; gap:8px; }
      .empty-clubs span { width:42px; height:42px; display:grid; place-items:center; border-radius:12px; background:var(--hub-nav); color:#fff; font-size:10px; font-weight:800; }
      .empty-clubs i { width:16px; height:1px; background:color-mix(in srgb,var(--hub-muted) 32%,transparent); }
      .empty-state { color:var(--hub-muted); font-size:12px; line-height:1.45; }
      .empty-state.compact { margin:14px 0 0; font-size:10px; }
      .empty-state.large { display:grid; place-items:center; min-height:260px; text-align:center; }
      .surface .eyebrow { color:rgba(223,228,241,.64); }
      .surface h2,.surface h3,.surface strong { color:var(--hub-text); }
      .next-panel { background:linear-gradient(155deg,rgba(24,34,62,.9),rgba(55,43,73,.76)); }
      .children-panel { background:linear-gradient(155deg,rgba(27,39,65,.88),rgba(54,39,65,.74)); }
      .football-panel { background:linear-gradient(155deg,rgba(25,39,55,.88),rgba(55,45,66,.74)); }
      .now-playing-panel { background:linear-gradient(155deg,rgba(30,29,56,.9),rgba(67,43,76,.76)); }
      .person-summary { border:1px solid color-mix(in srgb,var(--person-colour) 26%,transparent); background:color-mix(in srgb,var(--person-colour) 14%,rgba(12,20,39,.72)); }
      .compact-fixture { border-color:rgba(255,255,255,.12); background:rgba(10,18,36,.54); }
      .room-detail { background:linear-gradient(160deg,rgba(25,34,58,.92),rgba(48,38,64,.82)); }
      .read-only-note,.control-main,.media-room-control,.climate-control,.cover-control { border-color:rgba(255,255,255,.1); background:rgba(10,18,36,.48); }
      .stepper button,.cover-control button { background:rgba(255,255,255,.09); color:#bcaeff; }
      .calendar-view { background:linear-gradient(155deg,rgba(18,27,49,.94),rgba(48,38,67,.9)); }
      .calendar-legend { color:#dce1ef; }
      .agenda-day { border-color:rgba(255,255,255,.11); background:rgba(8,16,33,.52); }
      .agenda-day.is-today { border-color:color-mix(in srgb,var(--hub-accent) 72%,#fff); background:color-mix(in srgb,var(--hub-accent) 16%,rgba(8,16,33,.72)); box-shadow:inset 0 3px 0 #a999ff; }
      .agenda-day > header { border-color:rgba(255,255,255,.09); color:#fff; }
      .agenda-day > header span,.agenda-day > header small { color:#aeb7ca; }
      .agenda-event { border:1px solid color-mix(in srgb,var(--calendar-colour) 32%,rgba(255,255,255,.08)); background:color-mix(in srgb,var(--calendar-colour) 19%,rgba(13,21,40,.92)); color:#fff; box-shadow:0 7px 18px rgba(1,5,16,.22); }
      .agenda-event strong { color:#f7f8fc; }
      .agenda-event small { color:#b7bfd0; }
      .agenda-empty { color:#8f99ad; }
      .family-person { background:linear-gradient(155deg,color-mix(in srgb,var(--person-colour) 13%,rgba(20,29,51,.94)),rgba(32,29,52,.88)); }
      .family-facts span { border:1px solid color-mix(in srgb,var(--person-colour) 17%,transparent); background:color-mix(in srgb,var(--person-colour) 10%,rgba(8,15,31,.55)); }
      .chore-row { border-color:color-mix(in srgb,var(--person-colour) 25%,transparent); background:color-mix(in srgb,var(--person-colour) 11%,rgba(8,15,31,.62)); }
      .chore-check { background:color-mix(in srgb,var(--person-colour) 22%,rgba(8,15,31,.72)); }
      .chore-row.is-overdue { border-color:#d56e69; background:rgba(112,38,42,.42); }
      .chore-row.is-overdue .chore-check { background:rgba(202,74,69,.34); color:#ffaaa3; }
      .football-main,.spotlight-panel,.provider-panel { background:linear-gradient(155deg,rgba(18,30,48,.93),rgba(47,38,61,.88)); }
      .football-empty { border-color:rgba(255,255,255,.12); background:radial-gradient(circle at 10% 50%,rgba(123,104,211,.22),transparent 28%),linear-gradient(145deg,rgba(11,20,40,.86),rgba(39,32,57,.78)); }
      .football-orbit { background:radial-gradient(circle,rgba(169,153,255,.95) 0 34%,rgba(123,104,211,.3) 35% 58%,transparent 59%); color:#fff; box-shadow:0 12px 28px rgba(1,5,16,.34); }
      .football-empty p:last-child { color:#aeb7ca; }
      .fixture { border-color:rgba(255,255,255,.09); }
      .fixture.is-spotlight { border-color:color-mix(in srgb,var(--hub-accent) 52%,transparent); background:color-mix(in srgb,var(--hub-accent) 13%,rgba(9,17,34,.72)); }
      .club-badge { background:linear-gradient(145deg,#111c35,#473b70); border:1px solid rgba(255,255,255,.12); }
      .league-table th,.league-table td { border-color:rgba(255,255,255,.08); }
      .league-table tr.is-spotlight { background:color-mix(in srgb,var(--hub-accent) 15%,rgba(8,15,31,.62)); }
      .matchweek-controls select { border-color:rgba(255,255,255,.12); background:rgba(8,15,31,.66); }
      .music-experience { height:100%; }
      .media-player-panel { height:100%; min-height:0; padding:20px; display:grid; grid-template-rows:58px minmax(0,1fr); gap:12px; overflow:hidden; background:radial-gradient(circle at 85% 10%,rgba(123,104,211,.32),transparent 35%),linear-gradient(145deg,rgba(16,25,48,.96),rgba(52,38,70,.9)); }
      .music-heading { align-items:center; }
      .music-heading h2 { font-size:24px; }
      .music-meta { display:flex; align-items:center; gap:4px; white-space:nowrap; }
      .music-meta ha-icon { --mdc-icon-size:14px; color:#b7a8ff; }
      .media-player-stage { position:relative; min-height:0; overflow:hidden; overscroll-behavior:contain; border:1px solid rgba(255,255,255,.12); border-radius:18px; background:rgba(6,12,27,.62); }
      .media-player-stage .child-card-slot { height:100%; overflow:hidden; touch-action:pan-x pan-y; border-radius:0; --ha-card-background:transparent; --card-background-color:transparent; --primary-background-color:transparent; --secondary-background-color:rgba(255,255,255,.06); --primary-text-color:#f7f8fc; --secondary-text-color:#b6bdce; --mmpc-card:transparent; --mmpc-on-card:#f7f8fc; --mmpc-on-card-muted:#b6bdce; --mmpc-on-card-divider:rgba(255,255,255,.12); --mmpc-chip-background:rgba(38,47,76,.96); --mmpc-chip-foreground:#f7f8fc; --mmpc-chip-border:rgba(255,255,255,.18); }
      .media-player-stage .embedded-card { height:100%; min-height:0; overflow:hidden; --ha-card-border-width:0; --ha-card-box-shadow:none; }
      @keyframes pulse { 0%,100% { opacity:.45; transform:scale(.8); } 50% { opacity:1; transform:scale(1); } }
      .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
      button:focus-visible,select:focus-visible,.room-hotspot:focus-visible { outline:3px solid color-mix(in srgb,var(--hub-accent) 60%,#fff); outline-offset:2px; }
      @media (max-width:1030px) {
        .shell { grid-template-columns:74px minmax(0,1fr); }
        .navigation { padding-inline:7px; }
        .brand { width:50px; height:50px; }
        .nav-button { min-height:60px; }
        .content { padding-inline:14px; }
        .today-grid { grid-template-columns:minmax(0,1.25fr) minmax(225px,.88fr) minmax(220px,.82fr); }
        .today-grid article { padding:17px; }
        .rooms-layout { grid-template-columns:minmax(0,2.9fr) minmax(224px,1fr); }
        .football-layout { grid-template-columns:minmax(0,1.6fr) 250px; }
      }
      @media (max-width:760px) {
        :host { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .hub-card { height:auto; min-height:calc(100vh - var(--family-ha-header-offset)); }
        .shell { display:block; }
        .navigation { position:sticky; top:0; z-index:20; flex-direction:row; padding:7px; overflow-x:auto; }
        .brand { flex:0 0 44px; width:44px; height:44px; }
        .nav-items { flex-direction:row; justify-content:flex-start; }
        .nav-button { flex:0 0 64px; min-height:48px; }
        .nav-button span { display:none; }
        .content { display:block; padding:10px; }
        .topbar { min-height:64px; }
        .view { min-height:620px; }
        .today-grid,.rooms-layout,.family-layout,.football-layout { display:flex; flex-direction:column; height:auto; }
        .hero-panel { grid-column:auto; }
        .family-sidebar { display:flex; flex-direction:column; }
        .floorplan-canvas { min-height:420px; }
        .football-main { min-height:620px; }
      }
      @media (prefers-reduced-motion:reduce) { *,*::before,*::after { animation:none !important; transition:none !important; scroll-behavior:auto !important; } }
    `;
  }
}

if (globalThis.customElements && !globalThis.customElements.get("family-hub-card")) {
  globalThis.customElements.define("family-hub-card", FamilyHubCard);
  globalThis.customCards = globalThis.customCards || [];
  globalThis.customCards.push({
    type: "family-hub-card",
    name: "Family Hub",
    preview: false,
    description: "A room-first family dashboard for Home Assistant"
  });
}
