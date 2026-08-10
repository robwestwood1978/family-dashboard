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

function safeNumber(value, fallback = 0) {
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

function pointsCentroid(points) {
  const sum = points.reduce((current, [x, y]) => ({ x: current.x + x, y: current.y + y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
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
  if (!floor?.vacuum_map_entity) return floor?.base_image || "";
  const mapState = states[floor.vacuum_map_entity];
  const entityPicture = mapState?.attributes?.entity_picture;
  if (typeof entityPicture === "string" && entityPicture.startsWith("/api/camera_proxy/")) {
    const updated = mapState.last_updated || mapState.last_changed;
    if (!updated) return entityPicture;
    return `${entityPicture}${entityPicture.includes("?") ? "&" : "?"}v=${encodeURIComponent(updated)}`;
  }
  return floor.base_image || `/api/camera_proxy/${encodeURIComponent(floor.vacuum_map_entity)}`;
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
    if (!config || config.schema_version !== 4) {
      throw new Error("Family Hub requires a schema-v4 family configuration");
    }
    this._config = config;
    this._view = config.display.default_view || "today";
    this._floor = config.floorplan.default_floor;
    this._room = config.floorplan.floors
      .find((floor) => floor.id === this._floor)?.room_hotspots?.[0]?.room_id || config.rooms[0]?.id || null;
    this._entityIds = relevantEntityIds(config);
    this._signature = "";
    this._scheduleRender(true);
  }

  set hass(hass) {
    this._hass = hass;
    for (const child of this._childCards.values()) child.hass = hass;
    if (!this._config) return;
    const nextSignature = stateSignature(hass?.states || {}, this._entityIds);
    if (nextSignature !== this._signature) {
      this._signature = nextSignature;
      this._scheduleRender();
    }
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
        <button class="weather-pill" type="button" data-more-info="${escapeHtml(this._config.weather.entity_id)}">
          <ha-icon icon="mdi:weather-partly-cloudy" aria-hidden="true"></ha-icon>
          <span>${escapeHtml(weatherText)}</span>
        </button>
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
    const nextCalendar = this._config.calendar.entities
      .map((calendar) => ({ calendar, state: states[calendar.entity_id] }))
      .filter(({ state }) => state?.attributes?.start_time)
      .sort((a, b) => new Date(a.state.attributes.start_time) - new Date(b.state.attributes.start_time))[0];
    const playing = firstPlayingPlayer(this._config, states);
    const featuredFixtures = this._featuredFixtures();
    return `
      <section class="today-grid" aria-label="Today at a glance">
        <article class="surface hero-panel">
          <p class="eyebrow">At home</p>
          <h2>${lightsOn ? `${lightsOn} light${lightsOn === 1 ? "" : "s"} on` : "Everything looks settled"}</h2>
          <div class="hero-metrics">
            <button type="button" data-view="rooms"><strong>${formatTemperature(averageTemperature)}</strong><span>Average temperature</span></button>
            <button type="button" data-view="rooms"><strong>${rooms.length}</strong><span>Connected rooms</span></button>
            <button type="button" data-view="music"><strong>${playing ? "Playing" : "Quiet"}</strong><span>${escapeHtml(playing?.player?.name || "Music")}</span></button>
          </div>
        </article>
        <article class="surface next-panel">
          <p class="eyebrow">Up next</p>
          ${nextCalendar ? `
            <h2>${escapeHtml(nextCalendar.state.attributes.message || nextCalendar.calendar.label)}</h2>
            <p class="supporting">${escapeHtml(formatDay(nextCalendar.state.attributes.start_time, this._config.product.locale, this._config.product.timezone))} · ${escapeHtml(formatTime(nextCalendar.state.attributes.start_time, this._config.product.locale, this._config.product.timezone))}</p>
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
              <button type="button" class="icon-action" data-media-toggle="${escapeHtml(playing.player.entity_id)}" aria-label="Play or pause"><ha-icon icon="${playing.state.state === "playing" ? "mdi:pause" : "mdi:play"}"></ha-icon></button>
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
      return `
        <button type="button" class="person-summary" data-view="family" style="--person-colour:${escapeHtml(person.colour)}">
          <span class="person-initial">${escapeHtml(person.name.slice(0, 1))}</span>
          <span><strong>${escapeHtml(person.name)}</strong><small>${due} chore${due === 1 ? "" : "s"} · ${assignments.length} assignment${assignments.length === 1 ? "" : "s"}</small></span>
          <span class="points">${escapeHtml(pointsState?.state || "0")} pts</span>
        </button>
      `;
    }).join("");
  }

  _renderCalendar() {
    return `
      <section class="single-surface surface embedded-view">
        <div class="section-heading"><div><p class="eyebrow">Family rhythm</p><h2>The next seven days</h2></div><span>Read-only</span></div>
        <div id="calendar-card-slot" class="child-card-slot"></div>
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
            <div><p class="eyebrow">Interactive house</p><h2>Tap a room to control it</h2></div>
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
      const centroid = pointsCentroid(hotspot.points);
      const centroidY = centroid.y * viewHeight / 100;
      const status = [
        summary.totalLights ? `${summary.lightsOn}/${summary.totalLights} lights` : null,
        Number.isFinite(summary.temperature) ? formatTemperature(summary.temperature) : null
      ].filter(Boolean).join(" · ") || "Open room";
      return `
        <g class="room-hotspot ${selectedRoom?.id === room.id ? "is-selected" : ""} ${summary.lightsOn ? "has-light" : ""}" role="button" tabindex="0" data-room="${room.id}" aria-label="${escapeHtml(`${room.name}, ${status}`)}" style="--room-colour:${escapeHtml(summary.colour)}">
          <polygon points="${points}"></polygon>
          <text x="${centroid.x.toFixed(2)}" y="${(centroidY - 1.2).toFixed(2)}" text-anchor="middle">${escapeHtml(room.name)}</text>
          <text class="room-status" x="${centroid.x.toFixed(2)}" y="${(centroidY + 2.7).toFixed(2)}" text-anchor="middle">${escapeHtml(status)}</text>
        </g>
      `;
    }).join("");
    return `
      <div class="floorplan-canvas">
        <div class="floorplan-backdrop" aria-hidden="true"></div>
        <svg class="floorplan-visual" viewBox="0 0 100 ${viewHeight.toFixed(4)}" preserveAspectRatio="xMidYMid meet" role="group" aria-label="Rooms on ${escapeHtml(floor.name)}">
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
    const lights = room.lights.map((entityId) => {
      const state = states[entityId];
      const isOn = state?.state === "on";
      return `
        <div class="control-row">
          <button type="button" class="control-main ${isOn ? "is-on" : ""}" data-toggle="${escapeHtml(entityId)}">
            <ha-icon icon="${ICONS.light}" aria-hidden="true"></ha-icon><span><strong>${escapeHtml(entityName(state, entityId.split(".")[1]))}</strong><small>${isOn ? `${Math.round(safeNumber(state.attributes?.brightness, 255) / 2.55)}%` : titleCase(state?.state || "unavailable")}</small></span>
          </button>
          <button type="button" class="icon-action" data-more-info="${escapeHtml(entityId)}" aria-label="Open light details"><ha-icon icon="mdi:tune"></ha-icon></button>
        </div>
      `;
    }).join("");
    const climate = room.climate ? states[room.climate] : null;
    const climateControl = room.climate ? `
      <div class="climate-control">
        <div><span>Temperature</span><strong>${formatTemperature(summary.temperature)}</strong><small>Target ${formatTemperature(summary.targetTemperature)}</small></div>
        <div class="stepper">
          <button type="button" data-climate-adjust="-0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Lower target temperature">−</button>
          <button type="button" data-climate-adjust="0.5" data-entity="${escapeHtml(room.climate)}" aria-label="Raise target temperature">+</button>
        </div>
      </div>
    ` : "";
    const covers = room.covers.map((entityId) => {
      const state = states[entityId];
      return `
        <div class="cover-control"><span><ha-icon icon="${ICONS.cover}"></ha-icon><strong>${escapeHtml(entityName(state, "Blind"))}</strong><small>${escapeHtml(titleCase(state?.state || "unavailable"))}</small></span><div>
          <button type="button" data-cover-action="open_cover" data-entity="${escapeHtml(entityId)}" aria-label="Open"><ha-icon icon="mdi:arrow-up"></ha-icon></button>
          <button type="button" data-cover-action="stop_cover" data-entity="${escapeHtml(entityId)}" aria-label="Stop"><ha-icon icon="mdi:stop"></ha-icon></button>
          <button type="button" data-cover-action="close_cover" data-entity="${escapeHtml(entityId)}" aria-label="Close"><ha-icon icon="mdi:arrow-down"></ha-icon></button>
        </div></div>
      `;
    }).join("");
    const scenes = room.scenes.map((entityId) => `
      <button type="button" class="scene-button" data-scene="${escapeHtml(entityId)}"><ha-icon icon="${ICONS.scene}"></ha-icon>${escapeHtml(entityName(states[entityId], titleCase(entityId.split(".")[1])))}</button>
    `).join("");
    const media = room.media_players.map((entityId) => {
      const state = states[entityId];
      return `
        <button type="button" class="media-room-control" data-media-toggle="${escapeHtml(entityId)}"><ha-icon icon="${state?.state === "playing" ? "mdi:pause-circle" : "mdi:play-circle"}"></ha-icon><span><strong>${escapeHtml(entityName(state, "Speaker"))}</strong><small>${escapeHtml(state?.attributes?.media_title || titleCase(state?.state || "idle"))}</small></span></button>
      `;
    }).join("");
    return `
      <div class="room-title"><span class="room-icon"><ha-icon icon="${escapeHtml(room.icon)}"></ha-icon></span><div><p class="eyebrow">Room controls</p><h2>${escapeHtml(room.name)}</h2><p>${summary.lightsOn} light${summary.lightsOn === 1 ? "" : "s"} on${Number.isFinite(summary.temperature) ? ` · ${formatTemperature(summary.temperature)}` : ""}</p></div></div>
      <div class="room-control-list">${climateControl}${lights}${covers}</div>
      ${scenes ? `<div class="scene-list"><p class="eyebrow">Scenes</p>${scenes}</div>` : ""}
      ${media ? `<div class="room-media"><p class="eyebrow">Music</p>${media}</div>` : ""}
      ${!climate && !lights && !covers && !scenes && !media ? '<p class="empty-state">No controls are mapped for this room yet.</p>' : ""}
    `;
  }

  _renderFamily() {
    return `
      <section class="family-layout">
        <article class="surface map-panel">
          <div class="section-heading"><div><p class="eyebrow">Family map</p><h2>Presence & location</h2></div><span>Private to Home Assistant</span></div>
          ${this._config.features.location_map ? '<div id="map-card-slot" class="child-card-slot map-slot"></div>' : '<p class="empty-state">The family location map is disabled.</p>'}
        </article>
        <aside class="family-sidebar">
          ${this._config.people.filter((person) => person.role === "child").map((person) => this._renderFamilyPerson(person)).join("")}
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
    return `
      <article class="surface family-person" style="--person-colour:${escapeHtml(person.colour)}">
        <div class="family-person-heading"><span>${escapeHtml(person.name.slice(0, 1))}</span><div><p class="eyebrow">${escapeHtml(person.name)}</p><h2>${escapeHtml(titleCase(states[person.location_entity]?.state || "Location unavailable"))}</h2></div></div>
        <div class="family-facts"><span><strong>${escapeHtml(points || "0")}</strong> chore points</span><span><strong>${due}</strong> due today</span><span><strong>${assignments.length}</strong> assignments</span></div>
        ${nextAssignment ? `<div class="assignment"><ha-icon icon="${ICONS.school}"></ha-icon><div><strong>${escapeHtml(nextAssignment.title || "Assignment")}</strong><small>${escapeHtml(nextAssignment.course || "Google Classroom")} · ${escapeHtml(formatDay(nextAssignment.due_at, this._config.product.locale, this._config.product.timezone))}</small></div></div>` : `<p class="empty-state compact">Classroom assignments will appear after read-only authorization.</p>`}
      </article>
    `;
  }

  _renderMusic() {
    return `
      <section class="single-surface surface embedded-view music-view">
        <div class="section-heading"><div><p class="eyebrow">Spotify & Sonos</p><h2>Browse, group and play</h2></div><span>${this._config.media.players.length} rooms</span></div>
        <div id="music-card-slot" class="child-card-slot"></div>
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
        <span>${escapeHtml(fixture.home?.short_name || fixture.home?.name || "Home")}</span><strong>${escapeHtml(score)}</strong><span>${escapeHtml(fixture.away?.short_name || fixture.away?.name || "Away")}</span>
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
    if (!events.length) return '<p class="empty-state large">No fixtures have been published for this matchweek yet.</p>';
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
    if (this._view === "calendar") {
      this._ensureChildCard("calendar", {
        type: "calendar",
        title: "",
        initial_view: this._config.calendar.initial_view,
        entities: this._config.calendar.entities.map((entry) => entry.entity_id)
      }, "calendar-card-slot");
    }
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
        mode: "panel",
        entity_id: this._config.media.initial_player,
        media_players: this._config.media.players,
        options: {
          player_is_active_when: "playing_or_paused",
          show_volume_step_buttons: true,
          default_tab: "massive"
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
    child.hass = this._hass;
    slot.replaceChildren(child);
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
    const event = new CustomEvent("hass-more-info", {
      bubbles: true,
      composed: true,
      detail: { entityId }
    });
    this.dispatchEvent(event);
  }

  _styles() {
    return `
      :host { display:block; width:100%; min-width:0; color:var(--primary-text-color); }
      *, *::before, *::after { box-sizing:border-box; }
      button, select { font:inherit; }
      button { -webkit-tap-highlight-color:transparent; }
      .hub-card { overflow:hidden; border:0; background:linear-gradient(135deg,var(--hub-backdrop-start),var(--hub-backdrop-mid) 48%,var(--hub-backdrop-end)); color:var(--hub-text); min-height:720px; height:calc(100vh - 8px); }
      .shell { display:grid; grid-template-columns:86px minmax(0,1fr); min-height:720px; height:100%; }
      .navigation { padding:14px 9px; background:color-mix(in srgb,var(--hub-nav) 94%,transparent); display:flex; flex-direction:column; gap:14px; min-height:0; }
      .brand { width:54px; height:54px; margin:0 auto; border-radius:50%; border:1px solid rgba(255,255,255,.45); background:rgba(255,255,255,.12); color:#fff; font-size:24px; font-weight:700; cursor:pointer; }
      .nav-items { display:flex; min-height:0; flex:1; flex-direction:column; justify-content:center; gap:8px; }
      .nav-button { min-height:64px; border:1px solid transparent; border-radius:20px; background:transparent; color:rgba(255,255,255,.72); display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px; cursor:pointer; }
      .nav-button ha-icon { --mdc-icon-size:22px; }
      .nav-button span { font-size:10px; font-weight:600; }
      .nav-button.is-active { color:#fff; background:linear-gradient(145deg,var(--hub-backdrop-end),var(--hub-accent)); border-color:rgba(255,255,255,.35); box-shadow:0 10px 24px rgba(13,18,34,.28); }
      .content { min-width:0; min-height:0; padding:16px 18px 18px; display:grid; grid-template-rows:70px minmax(0,1fr); gap:12px; }
      .topbar { min-width:0; display:flex; justify-content:space-between; align-items:center; color:#fff; padding:0 4px; }
      .topbar h1 { margin:2px 0 0; font-size:30px; line-height:1; font-weight:700; }
      .eyebrow { margin:0; font-size:10px; line-height:1.2; font-weight:700; letter-spacing:.13em; text-transform:uppercase; color:var(--hub-muted); }
      .topbar .eyebrow { color:rgba(255,255,255,.72); }
      .weather-pill { min-height:48px; padding:0 16px; border:1px solid rgba(255,255,255,.28); border-radius:18px; background:rgba(255,255,255,.14); color:#fff; display:flex; align-items:center; gap:9px; cursor:pointer; }
      .view { min-height:0; min-width:0; }
      .surface { background:color-mix(in srgb,var(--hub-surface) 94%,transparent); border:1px solid rgba(255,255,255,.42); border-radius:var(--hub-radius); box-shadow:0 14px 32px rgba(18,24,43,.18); }
      .today-grid { height:100%; display:grid; grid-template-columns:minmax(0,1.35fr) minmax(245px,.9fr) minmax(240px,.85fr); grid-template-rows:minmax(190px,.9fr) minmax(210px,1.1fr); gap:14px; }
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
      .children-panel { grid-row:2; }
      .football-panel { grid-row:2; }
      .now-playing-panel { grid-row:2; }
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
      .rooms-layout { height:100%; display:grid; grid-template-columns:minmax(0,1.7fr) minmax(285px,.72fr); gap:14px; }
      .floorplan-panel { min-width:0; min-height:0; padding:18px; display:grid; grid-template-rows:52px minmax(0,1fr); gap:8px; }
      .floorplan-heading { align-items:center; }
      .segments { display:flex; align-items:center; gap:4px; padding:3px; border-radius:13px; background:color-mix(in srgb,var(--hub-muted) 10%,transparent); }
      .segment { min-height:32px; padding:0 12px; border:0; border-radius:10px; background:transparent; color:var(--hub-muted); font-size:11px; font-weight:700; cursor:pointer; }
      .segment.is-selected { color:#fff; background:var(--hub-accent); }
      .floorplan-canvas { position:relative; min-height:0; overflow:hidden; border-radius:18px; background:linear-gradient(145deg,#d9dde5,#b8c0cd); }
      .floorplan-backdrop { position:absolute; inset:0; background:radial-gradient(circle at 50% 45%,rgba(255,255,255,.8),rgba(255,255,255,.18) 70%); }
      .floorplan-visual { position:absolute; inset:0; width:100%; height:100%; z-index:4; }
      .floorplan-image,.light-overlay { pointer-events:none; }
      .light-overlay { mix-blend-mode:screen; }
      .room-hotspot { cursor:pointer; outline:none; }
      .room-hotspot polygon { fill:rgba(255,255,255,.06); stroke:rgba(32,36,50,.35); stroke-width:.45; vector-effect:non-scaling-stroke; }
      .room-hotspot text { fill:var(--hub-text); font-size:2.5px; font-weight:700; paint-order:stroke; stroke:rgba(255,255,255,.84); stroke-width:.7px; stroke-linejoin:round; pointer-events:none; }
      .room-hotspot .room-status { font-size:1.55px; font-weight:500; fill:var(--hub-muted); }
      .room-hotspot.has-light polygon { fill:color-mix(in srgb,var(--room-colour) 18%,transparent); filter:drop-shadow(0 0 5px var(--room-colour)); }
      .room-hotspot.is-selected polygon,.room-hotspot:focus polygon { fill:color-mix(in srgb,var(--hub-accent) 20%,transparent); stroke:var(--hub-accent); stroke-width:1; }
      .room-detail { padding:20px; min-height:0; overflow:auto; }
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
      .empty-state { color:var(--hub-muted); font-size:12px; line-height:1.45; }
      .empty-state.compact { margin:14px 0 0; font-size:10px; }
      .empty-state.large { display:grid; place-items:center; min-height:260px; text-align:center; }
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
        .rooms-layout { grid-template-columns:minmax(0,1.55fr) minmax(270px,.72fr); }
        .football-layout { grid-template-columns:minmax(0,1.6fr) 250px; }
      }
      @media (max-width:760px) {
        .hub-card { height:auto; min-height:100vh; }
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
