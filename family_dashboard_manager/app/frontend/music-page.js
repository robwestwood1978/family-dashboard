// First-party Music surface. Only configured rooms and items returned by HA can be acted on.
const escapeMusic = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cleanMusicText = (value) =>
  typeof value === "string" ? value.slice(0, 1000) : "";
const unwrapMusic = (value) => value?.response ?? value ?? {};
export function musicIdentity(value) {
  let id = String(value || "");
  try {
    id = decodeURIComponent(id);
  } catch {
    /* Keep the original opaque identifier. */
  }
  const spotify = id.match(
    /spotify(?:--[A-Za-z0-9_-]+)?:(?:\/\/)?(track|album|playlist)[:/]([a-zA-Z0-9]+)/,
  );
  return spotify ? `spotify:${spotify[1]}:${spotify[2]}` : id;
}
export function musicImage(value) {
  if (typeof value !== "string") return "";
  if (/^\/(?!\/)/.test(value) || /^https?:\/\//i.test(value)) return value;
  return "";
}
export function normaliseMusicItem(item = {}, type = "track") {
  return {
    name: cleanMusicText(item.name || item.media_title || item.title),
    uri: cleanMusicText(item.uri || item.media_content_id),
    type: cleanMusicText(item.media_type || type),
    artist: cleanMusicText(
      item.media_artist ||
        (item.artists || []).map((a) => a.name).join(", ") ||
        item.album?.name,
    ),
    image: musicImage(item.image || item.media_image || item.thumbnail),
    queueId: cleanMusicText(item.queue_item_id),
    canExpand: Boolean(item.can_expand),
    playable: item.can_play !== false,
    position: item.position,
  };
}
export function musicMatches(item, state) {
  if (!item || !state?.attributes?.media_title) return false;
  const a = state.attributes;
  if (
    item.uri &&
    a.media_content_id &&
    musicIdentity(item.uri) === musicIdentity(a.media_content_id)
  )
    return true;
  const norm = (v) =>
    String(v || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return (
    norm(item.name) === norm(a.media_title) &&
    (!item.artist ||
      !a.media_artist ||
      norm(item.artist) === norm(a.media_artist))
  );
}
export function musicManagedPlayback(native, assistant) {
  const uri = native?.attributes?.media_content_id || "";
  // Direct Spotify playback on Sonos owns its native queue, even if MA retains the same song.
  if (/^(?:x-sonos-spotify:|spotify(?:--[^:]+)?:)/i.test(uri)) return false;
  if (!['playing','paused'].includes(native?.state) || assistant?.state !== native.state) return false;
  return musicMatches(normaliseMusicItem(assistant?.attributes), native);
}
export function musicQueue(response, entity, nativeState, source) {
  const raw = unwrapMusic(response)[entity];
  if (!Array.isArray(raw))
    throw new Error("The player did not return a queue.");
  const items = raw
    .slice(0, 500)
    .map((item, position) => ({ ...normaliseMusicItem(item), position }));
  const index = items.findIndex((item) => musicMatches(item, nativeState));
  return {
    source,
    items: index >= 0 ? items.slice(index + 1) : items,
    positionKnown: index >= 0,
    empty: !items.length,
  };
}

const MUSIC_STYLES = `
:host{display:flex;flex-direction:column;min-height:0;min-width:0;height:100%;color:var(--daily-text,#242628);font:inherit;--m-surface:var(--daily-surface,#fff);--m-soft:var(--daily-soft,#f1f0ed);--m-line:var(--daily-line,#e2e1de);--m-muted:var(--daily-muted,#66686b);--m-accent:var(--daily-accent,#0964d9)}
*{box-sizing:border-box}a{color:var(--m-accent);font-size:14px;display:inline-flex;align-items:center;min-height:48px;padding:8px}button,input,select{font:inherit;color:inherit}button{cursor:pointer;border:0;min-height:48px;padding:10px 14px;border-radius:14px;background:var(--m-soft);font-size:14px;line-height:1.3;font-weight:400}button:disabled{cursor:default;opacity:.55}button:focus-visible,input:focus-visible,select:focus-visible{outline:3px solid var(--m-accent);outline-offset:2px}button[aria-pressed=true],.primary{background:var(--daily-accent-soft,#e7f0ff);color:var(--m-accent)}h2,h3,p{margin:0}h2{font-size:22px;font-weight:500;letter-spacing:-.03em}h3{font-size:17px;font-weight:500}small,.muted{font-size:13px;color:var(--m-muted)}.rooms{display:flex;gap:8px;flex-wrap:wrap;padding-bottom:12px;flex:none}.rooms button{display:flex;align-items:center;gap:8px}.room-dot{width:7px;height:7px;border-radius:50%;background:var(--m-muted)}.room-dot.playing{background:#1c9b71}.group-button{margin-left:auto;border:1px solid var(--m-line);background:var(--m-surface)}
.workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(260px,31%);gap:16px;flex:1;min-height:0}.browse,.queue{border:1px solid var(--m-line);border-radius:22px;background:var(--m-surface);min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column}.browse-head{padding:18px 18px 0;flex:none}.search{display:flex;align-items:center;gap:8px;border:1px solid var(--m-line);border-radius:15px;background:var(--m-soft);padding:4px 5px 4px 14px}.search svg{width:22px;height:22px;flex:none;color:var(--m-muted)}input{min-width:0;width:100%;height:48px;border:0;background:transparent;font-size:16px;outline-offset:0}input::-webkit-search-cancel-button{-webkit-appearance:none}.search button{flex:none;background:var(--m-surface);min-width:48px}.search .submit{color:var(--m-accent)}.filters{display:flex;gap:5px;flex-wrap:wrap;padding:10px 0}.filters button{background:transparent;min-height:48px;padding:8px 12px}.filters button[aria-pressed=true]{background:var(--daily-accent-soft,#e7f0ff);color:var(--m-accent)}.scope{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--m-muted);padding:0 0 10px}.scope input{width:18px;height:18px;flex:none}.content{padding:6px 18px 18px;overflow:auto;overscroll-behavior:contain;min-height:0;flex:1}.section-title{display:flex;justify-content:space-between;align-items:center;gap:8px;margin:10px 0 12px}.section-title p{font-size:13px;color:var(--m-muted);margin-top:4px}.tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:16px}.tile{padding:0;text-align:left;background:transparent;min-width:0;display:flex;flex-direction:column;align-items:stretch;gap:7px}.art{display:grid;place-items:center;flex:none;background:var(--m-soft);color:var(--m-accent);border-radius:12px;overflow:hidden;aspect-ratio:1}.art img{width:100%;height:100%;object-fit:cover}.art:has(img){background:var(--m-soft)}.art svg{width:38%;height:38%;opacity:.65}.tile .name{font-size:14px;font-weight:500;line-height:1.4;overflow-wrap:anywhere}.tile small{font-size:12px}.row{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--m-line);min-height:68px;padding:8px 0;min-width:0}.row .art{width:44px;height:44px;border-radius:9px}.row .text{min-width:0;flex:1}.row .name{display:block;font-size:14px;line-height:1.4;overflow-wrap:anywhere}.row small{display:block;margin-top:3px;line-height:1.4;overflow-wrap:anywhere}.row>button{flex:none;min-width:48px;padding:8px;color:var(--m-accent);background:transparent}.row .open{text-align:left;flex:1;min-width:0;display:flex;gap:10px;align-items:center;padding:0;color:inherit}.empty{padding:28px 8px;line-height:1.6;color:var(--m-muted);max-width:440px}.empty strong{display:block;font-size:20px;font-weight:500;color:var(--daily-text,#242628);margin-bottom:6px}.empty button{margin-top:12px}.queue header{padding:18px;display:flex;gap:8px;align-items:center;border-bottom:1px solid var(--m-line)}.queue header div{flex:1;min-width:0}.queue header small{display:block;margin-top:4px}.queue header button{background:transparent;padding:6px;font-size:13px}.queue-body{overflow:auto;padding:0 18px 18px;min-height:0;flex:1;overscroll-behavior:contain}.now{padding:16px 0;border-bottom:1px solid var(--m-line)}.now>small{display:block;text-transform:uppercase;font-size:12px;letter-spacing:.08em;margin-bottom:8px}.now .row{border:0;padding:0}.source-note{font-size:12px;line-height:1.5;color:var(--m-muted);margin:12px 0}.status{font-size:13px;color:var(--m-muted);line-height:1.5;min-height:24px;flex:none;padding:6px 2px 0}.mobile-switch{display:none}.detail-head{display:flex;gap:14px;align-items:center;padding:8px 0 16px}.detail-head .art{width:86px;height:86px}.detail-head div{min-width:0}.detail-head h2{overflow-wrap:anywhere}.detail-head small{display:block;margin:5px 0}.actions{display:flex;gap:8px;flex-wrap:wrap;padding:4px 0 12px}.back{background:transparent;color:var(--m-accent);padding-left:0}.back:focus-visible{outline-offset:-3px}.group-panel{border:1px solid var(--m-line);border-radius:16px;background:var(--m-surface);padding:16px;margin-bottom:12px;flex:none}.group-panel header{display:flex;justify-content:space-between;align-items:center}.group-panel label{display:inline-flex;gap:8px;align-items:center;min-height:48px;padding-right:18px;font-size:14px}.group-panel input{width:20px;height:20px}.group-panel p{color:var(--m-muted);font-size:13px;line-height:1.5}.notice{padding:12px;border-radius:12px;background:var(--m-soft);font-size:13px;line-height:1.5;margin:8px 0}.number{width:22px;font-size:12px;color:var(--m-muted);text-align:center;flex:none}
@media(max-height:580px){.rooms{flex-wrap:nowrap;overflow:auto;padding-bottom:6px}.rooms button{white-space:nowrap;flex:none}.group-button{display:none!important}.scope{display:none}.browse-head{padding:8px 12px 0}.filters{padding:4px 0}.status{padding-top:2px}}
:host([data-keyboard-open]) .rooms{display:none}
@media(max-width:760px){.workspace{grid-template-columns:minmax(0,1fr)}.mobile-switch{display:flex;gap:8px;margin-bottom:10px;flex:none}.workspace[data-panel=browse] .queue,.workspace[data-panel=queue] .browse{display:none}.rooms{gap:6px}.rooms button{font-size:13px;padding:8px 10px}.group-button{margin-left:0}.browse-head{padding:12px 12px 0}.content{padding:0 12px 12px}.tiles{grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:12px}.workspace{min-height:260px}.search .submit{font-size:13px;padding:8px}.filters button{padding:8px 10px}.queue-body{padding:0 14px 14px}}
`;
const noteIcon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 18V4l10 3v11M9 4v5l10 3"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="16" cy="18" rx="3" ry="3"/></svg>';
const musicArt = (item) =>
  `<span class="art">${item?.image ? `<img src="${escapeMusic(item.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : noteIcon}</span>`;
const TYPES = [
  ["all", "All"],
  ["artist", "Artists"],
  ["track", "Songs"],
  ["album", "Albums"],
  ["playlist", "Playlists"],
];

export class FamilyMusicPage extends (globalThis.HTMLElement || class {}) {
  constructor() {
    super();
    this.attachShadow?.({ mode: "open" });
    this._players = [];
    this._player = "";
    this._query = "";
    this._tab = "playlists";
    this._type = "all";
    this._libraryOnly = false;
    this._items = [];
    this._libraryCache = new Map();
    this._searchCache = new Map();
    this._searchRequests = new Map();
    this._panel = "browse";
    this._queue = null;
    this._serial = 0;
    this._queueSerial = 0;
    this._busy = false;
    this._message = "";
    this.shadowRoot?.addEventListener(
      "error",
      (e) => {
        if (e.target.tagName === "IMG") {
          e.target.parentElement.innerHTML = noteIcon;
        }
      },
      true,
    );
    this.shadowRoot?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.search();
    });
    this.shadowRoot?.addEventListener("input", (e) => {
      if (e.target.matches("[data-query]")) this._query = e.target.value;
    });
    this.shadowRoot?.addEventListener("change", (e) => {
      if (e.target.matches("[data-library-only]")) {
        this._libraryOnly = e.target.checked;
        this.search();
      }
    });
    this.shadowRoot?.addEventListener("click", (e) => {
      void this._click(e);
    });
  }
  connectedCallback() {
    this._resume();
  }
  disconnectedCallback() {
    clearInterval(this._poll);
    this._poll = null;
    this._resumed = false;
  }
  configure({ players = [], initialPlayer, readOnly = false, onRoomChange }) {
    const signature = JSON.stringify([players, readOnly]);
    this._onRoomChange = onRoomChange;
    if (this._configSignature === signature) return;
    this._configSignature = signature;
    this._serial++;
    this._queueSerial++;
    this._entryPromise = null;
    this._players = players.map((p) => ({ ...p }));
    this._readOnly = readOnly;
    this._player = this._players.some((p) => p.entity_id === initialPlayer)
      ? initialPlayer
      : players[0]?.entity_id;
    this._items = [];
    this._resumed = false;
    this._message = readOnly ? "Browse only · Playback locked" : "";
    this._libraryCache.clear();
    this._queue = null;
    this._loaded = false;
    this._render();
    this._resume();
  }
  set hass(value) {
    this._hass = value;
    if (this.isConnected) {
      this._renderRooms();
      this._renderQueue();
      const signature = this._playbackSignature();
      if (signature !== this._stateSignature) {
        this._stateSignature = signature;
        void this.refreshQueue();
      }
      this._resume();
    }
  }
  _playbackSignature() {
    const p = this._room();
    return JSON.stringify([
      p?.entity_id,
      p?.ma_entity_id,
      ...[p?.entity_id, p?.ma_entity_id].map((id) => {
        const s = this._hass?.states?.[id];
        return [
          s?.state,
          s?.attributes?.media_title,
          s?.attributes?.media_content_id,
          s?.attributes?.group_members,
        ];
      }),
    ]);
  }
  _resume() {
    if (!this.isConnected || !this._hass || !this._players.length) return;
    if (this._resumed) return;
    this._resumed = true;
    if (!this._loaded) {
      this._loaded = true;
      void this.loadLibrary();
    }
    void this.refreshQueue();
    if (!this._poll)
      this._poll = setInterval(() => {
        if (globalThis.document?.visibilityState !== "hidden")
          void this.refreshQueue();
      }, 15000);
  }
  _room() {
    return this._players.find((p) => p.entity_id === this._player);
  }
  _coordinator() {
    const room = this._room(),
      id =
        this._hass?.states?.[room?.entity_id]?.attributes?.group_members?.[0];
    return id ? this._players.find((p) => p.entity_id === id) : room;
  }
  selectPlayer(id, notify = true) {
    if (!this._players.some((p) => p.entity_id === id) || id === this._player)
      return;
    this._player = id;
    this._queue = null;
    this._queueSerial++;
    this._renderRooms();
    this._renderQueue();
    void this.refreshQueue();
    if (notify) this._onRoomChange?.(id);
  }
  async _read(domain, service, data = {}, entity) {
    if (!this.isConnected) throw new Error("Open Music to try again.");
    let timer;
    try {
      return await Promise.race([
        this._hass.callWS({
          type: "call_service",
          domain,
          service,
          service_data: data,
          ...(entity ? { target: { entity_id: entity } } : {}),
          return_response: true,
        }),
        new Promise((_, reject) => {
          timer = setTimeout(
            () =>
              reject(
                new Error(
                  "This is taking longer than expected. Please try again.",
                ),
              ),
            45000,
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  async _entry() {
    if (!this._entryPromise)
      this._entryPromise = Promise.resolve(
        this._hass.callApi("GET", "config/config_entries/entry"),
      )
        .then((entries) => {
          const loaded = entries.filter(
            (e) => e.domain === "music_assistant" && e.state === "loaded",
          );
          if (loaded.length !== 1)
            throw new Error(
              loaded.length
                ? "More than one Music Assistant connection is available. Choose one in Home Assistant first."
                : "Music Assistant is not connected.",
            );
          return loaded[0].entry_id;
        })
        .catch((e) => {
          this._entryPromise = null;
          throw e;
        });
    return this._entryPromise;
  }
  _setStatus(text) {
    this._message = text;
    const node = this.shadowRoot.querySelector("[data-status]");
    if (node) node.textContent = text;
  }
  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `<style>${MUSIC_STYLES}</style><nav class="rooms" aria-label="Music rooms"></nav><div data-group></div><div class="mobile-switch"><button data-panel="browse" aria-pressed="${this._panel === "browse"}">Browse music</button><button data-panel="queue" aria-pressed="${this._panel === "queue"}">Up next</button></div><div class="workspace" data-panel="${this._panel}"><section class="browse" aria-label="Browse music"><div class="browse-head"><form class="search" role="search">${'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>'}<input data-query type="search" aria-label="Search music" placeholder="Songs, artists, albums, playlists…" autocomplete="off" value="${escapeMusic(this._query)}"><button type="button" data-clear aria-label="Clear search">×</button><button class="submit" type="submit">Search</button></form><div data-filters></div></div><div class="content" data-content tabindex="-1"></div></section><aside class="queue" aria-label="Up next"><header><div><h3>Up next</h3><small data-queue-room></small></div><button data-refresh-queue aria-label="Refresh Up next">Refresh</button></header><div class="queue-body" data-queue-body></div></aside></div><div class="status" data-status role="status" aria-live="polite"></div>`;
    this._renderRooms();
    this._renderFilters();
    this._renderContent();
    this._renderQueue();
    this._setStatus(this._message);
  }
  _renderRooms() {
    const node = this.shadowRoot.querySelector(".rooms");
    if (!node) return;
    node.innerHTML =
      this._players
        .map(
          (p) =>
            `<button data-room="${escapeMusic(p.entity_id)}" aria-pressed="${p.entity_id === this._player}"><span class="room-dot ${this._hass?.states?.[p.entity_id]?.state === "playing" ? "playing" : ""}" aria-hidden="true"></span>${escapeMusic(p.name)}</button>`,
        )
        .join("") +
      '<button class="group-button" data-group-open>Group rooms</button>';
  }
  _renderFilters() {
    const node = this.shadowRoot.querySelector("[data-filters]");
    if (!node) return;
    node.innerHTML =
      this._tab === "search"
        ? `<nav class="filters" aria-label="Search categories">${TYPES.map(([id, label]) => `<button data-type="${id}" aria-pressed="${id === this._type}">${label}</button>`).join("")}</nav><label class="scope"><input type="checkbox" data-library-only ${this._libraryOnly ? "checked" : ""}>My library only <span>· ${this._libraryOnly ? "Saved music" : "Full catalogue"}</span></label>`
        : `<nav class="filters" aria-label="Your music">${[
            ["playlists", "Playlists"],
            ["favourites", "Favourites"],
            ["recent", "Recently played"],
          ]
            .map(
              ([id, label]) =>
                `<button data-tab="${id}" aria-pressed="${id === this._tab}">${label}</button>`,
            )
            .join("")}</nav>`;
  }
  async _searchItems(entry, query, libraryOnly, force = false) {
    const key = JSON.stringify([
      entry,
      query.toLowerCase(),
      this._type,
      libraryOnly,
    ]);
    const cached = this._searchCache.get(key);
    if (
      !force &&
      cached &&
      Date.now() - cached.at < (cached.items.length ? 300000 : 30000)
    )
      return cached.items;
    if (this._searchRequests.has(key)) return this._searchRequests.get(key);
    const request = this._read("music_assistant", "search", {
      config_entry_id: entry,
      name: query,
      media_type:
        this._type === "all"
          ? ["artist", "track", "album", "playlist"]
          : [this._type],
      limit: this._type === "all" ? 20 : 50,
      library_only: libraryOnly,
    })
      .then((value) => {
        const result = unwrapMusic(value);
        const items = [
          ["artists", "artist"],
          ["tracks", "track"],
          ["albums", "album"],
          ["playlists", "playlist"],
        ]
          .flatMap(([key, type]) =>
            (result[key] || []).map((i) => normaliseMusicItem(i, type)),
          )
          .filter((i) => i.uri && i.name);
        this._searchCache.set(key, { at: Date.now(), items });
        if (this._searchCache.size > 50)
          this._searchCache.delete(this._searchCache.keys().next().value);
        return items;
      })
      .finally(() => this._searchRequests.delete(key));
    this._searchRequests.set(key, request);
    return request;
  }
  async search(force = false) {
    const query = this._query.trim();
    if (!query) {
      this._tab = "playlists";
      this._detail = null;
      this._renderFilters();
      return this.loadLibrary();
    }
    this._tab = "search";
    this._detail = null;
    this._history = [];
    const serial = ++this._serial;
    this._busy = true;
    this._error = "";
    this._searchNotice = "";
    this._items = [];
    this._renderFilters();
    this._renderContent();
    try {
      const entry = await this._entry();
      if (serial !== this._serial || !this.isConnected) return;
      const saved = await this._searchItems(entry, query, true, force);
      if (serial !== this._serial || !this.isConnected) return;
      this._items = saved;
      if (!this._libraryOnly) {
        this._searchNotice =
          "Searching the full catalogue… Saved matches are ready to use below.";
        this._renderContent();
        const catalogue = await this._searchItems(entry, query, false, force);
        if (serial !== this._serial || !this.isConnected) return;
        const unique = new Map(
          catalogue.map((item) => [musicIdentity(item.uri), item]),
        );
        for (const item of saved)
          if (!unique.has(musicIdentity(item.uri)))
            unique.set(musicIdentity(item.uri), item);
        this._items = [...unique.values()];
        this._searchNotice = catalogue.length
          ? ""
          : "The catalogue has not returned any matches. Your music service may be busy or temporarily limiting search. Saved matches remain available.";
      }
    } catch (e) {
      if (serial === this._serial) {
        if (this._items.length)
          this._searchNotice =
            "The catalogue could not be reached. Showing your saved matches.";
        else
          this._error = e.message || "Search is unavailable. Please try again.";
      }
    } finally {
      if (serial === this._serial) {
        this._busy = false;
        this._renderContent();
      }
    }
  }
  async loadLibrary(force = false) {
    const serial = ++this._serial,
      tab = this._tab;
    this._detail = null;
    this._history = [];
    this._busy = true;
    this._error = "";
    this._items = [];
    this._renderFilters();
    this._renderContent();
    try {
      let data = this._libraryCache.get(tab);
      if (force || !data || Date.now() - data.at > 120000) {
        const entry = await this._entry();
        if (serial !== this._serial || !this.isConnected) return;
        const types =
          tab === "favourites"
            ? ["playlist", "album", "track"]
            : tab === "recent"
              ? ["track"]
              : ["playlist"];
        const results = await Promise.all(
          types.map(async (media_type) => {
            const response = unwrapMusic(
              await this._read("music_assistant", "get_library", {
                config_entry_id: entry,
                media_type,
                favorite: tab === "favourites",
                limit: 24,
                ...(tab === "recent" ? { order_by: "last_played_desc" } : {}),
              }),
            );
            return (response.items || []).map((i) =>
              normaliseMusicItem(i, media_type),
            );
          }),
        );
        data = {
          at: Date.now(),
          items: results.flat().filter((i) => i.uri && i.name),
          offset: 24,
          hasMore: results.some((items) => items.length === 24),
        };
        this._libraryCache.set(tab, data);
      }
      if (serial === this._serial && this.isConnected) this._items = data.items;
    } catch (e) {
      if (serial === this._serial)
        this._error = e.message || "Your library could not be loaded.";
    } finally {
      if (serial === this._serial) {
        this._busy = false;
        this._renderContent();
      }
    }
  }
  async loadMore() {
    if (this._busy || this._moreBusy) return;
    const tab = this._tab,
      data = this._libraryCache.get(tab);
    if (!data?.hasMore) return;
    const serial = ++this._serial;
    this._moreBusy = true;
    this._setStatus("Loading more music…");
    this._renderContent();
    try {
      const entry = await this._entry();
      const types =
        tab === "favourites"
          ? ["playlist", "album", "track"]
          : tab === "recent"
            ? ["track"]
            : ["playlist"];
      const results = await Promise.all(
        types.map(async (media_type) => {
          const response = unwrapMusic(
            await this._read("music_assistant", "get_library", {
              config_entry_id: entry,
              media_type,
              favorite: tab === "favourites",
              limit: 24,
              offset: data.offset,
              ...(tab === "recent" ? { order_by: "last_played_desc" } : {}),
            }),
          );
          return (response.items || []).map((i) =>
            normaliseMusicItem(i, media_type),
          );
        }),
      );
      if (serial !== this._serial || !this.isConnected) return;
      const unique = new Map(data.items.map((i) => [i.uri, i]));
      for (const item of results.flat())
        if (item.uri && item.name) unique.set(item.uri, item);
      data.items = [...unique.values()];
      data.offset += 24;
      data.hasMore = results.some((items) => items.length === 24);
      this._items = data.items;
      this._setStatus("");
    } catch (e) {
      if (serial === this._serial)
        this._setStatus(e.message || "Could not load more music. Try again.");
    } finally {
      this._moreBusy = false;
      if (serial === this._serial) this._renderContent();
    }
  }
  _itemButtons(item, index) {
    return `<button data-item-menu="${index}" aria-label="Options for ${escapeMusic(item.name)}">•••</button>`;
  }
  _row(item, index, queue = false) {
    return `<div class="row">${queue ? `<span class="number">${index + 1}</span>` : ""}<button class="open" ${queue ? `data-queue-play="${index}" ${this._readOnly || !this._queue?.positionKnown ? "disabled" : ""}` : `data-open="${index}"`} aria-label="${queue ? "Play" : item.type === "track" ? "Options for" : "Open"} ${escapeMusic(item.name)}">${musicArt(item)}<span class="text"><span class="name">${escapeMusic(item.name)}</span><small>${escapeMusic(item.artist || item.type)}</small></span></button>${queue ? "" : this._itemButtons(item, index)}</div>`;
  }
  _renderContent() {
    const node = this.shadowRoot.querySelector("[data-content]");
    if (!node) return;
    const scroll = node.scrollTop;
    if (this._busy && (!this._items.length || this._detail))
      node.innerHTML = `<div class="empty" role="status"><strong>${this._detail ? "Opening…" : this._tab === "search" ? "Searching…" : "Loading your music…"}</strong>${this._tab === "search" ? `Looking across ${this._libraryOnly ? "your library" : "the catalogue"} for “${escapeMusic(this._query.trim())}”.` : "Your saved music will appear here."}</div>`;
    else if (this._error)
      node.innerHTML = `<div class="empty" role="alert"><strong>Couldn’t load music</strong>${escapeMusic(this._error)}<br><button data-retry>Try again</button></div>`;
    else if (this._detail) {
      const d = this._detail;
      node.innerHTML = `<button class="back" data-back>‹ Back to ${this._tab === "search" ? "results" : "your music"}</button><div class="detail-head">${musicArt(d)}<div><h2>${escapeMusic(d.name)}</h2><small>${escapeMusic(d.artist || d.type)}</small><small>${this._items.length} items shown</small></div></div>${this._actions(-1)}${this._items.length ? this._items.map((item, i) => this._row(item, i)).join("") : '<p class="empty">There are no playable items in this collection.</p>'}`;
    } else if (!this._items.length)
      node.innerHTML = `<div class="empty"><strong>${this._tab === "search" ? "No matches yet" : this._tab === "recent" ? "Nothing played yet" : this._tab === "favourites" ? "Make it yours" : "Your playlists live here"}</strong>${this._tab === "search" ? this._searchNotice || "Try a song title, artist or a different category." : this._tab === "favourites" ? "Favourite music in Music Assistant and it will appear here." : "Search the full catalogue above, or save playlists to your Music Assistant library."}<br>${this._tab === "search" ? `<button data-retry-search>Try catalogue again</button> <a href="https://open.spotify.com/search/${encodeURIComponent(this._query.trim())}" target="_blank" rel="noopener noreferrer">Search in Spotify ↗</a>` : "<button data-library-refresh>Refresh library</button>"}</div>`;
    else if (this._tab === "search") {
      node.innerHTML =
        `${this._searchNotice ? `<p class="notice" role="status">${escapeMusic(this._searchNotice)}${!this._busy ? " <button data-retry-search>Try catalogue again</button>" : ""}</p>` : ""}<div class="section-title"><div><h2>Results for “${escapeMusic(this._query.trim())}”</h2><p>${this._items.length} shown · ${this._libraryOnly ? "My library" : "Full catalogue"}</p></div><button data-show-library>Your music</button></div>` +
        TYPES.slice(1)
          .filter(([id]) => this._items.some((i) => i.type === id))
          .map(([id, label]) => {
            const matches = this._items
              .map((item, i) => ({ item, i }))
              .filter(({ item }) => item.type === id);
            const shown =
              this._type === "all"
                ? matches.slice(0, id === "artist" ? 3 : 5)
                : matches;
            return `<div class="section-title"><h3>${label}</h3>${shown.length < matches.length ? `<button data-type="${id}">See all ${label.toLowerCase()}</button>` : ""}</div>${shown.map(({ item, i }) => this._row(item, i)).join("")}`;
          })
          .join("");
    } else
      node.innerHTML = `<div class="section-title"><div><h2>${this._tab === "playlists" ? "Pick a playlist" : this._tab === "recent" ? "Play it again" : "Your favourites"}</h2><p>${this._tab === "playlists" ? "Saved in your music library" : this._tab === "recent" ? "Recently played in Music Assistant" : "Albums, playlists and songs you love"}</p></div><button data-library-refresh aria-label="Refresh library">Refresh</button></div><div class="tiles">${this._items.map((item, i) => `<button class="tile" data-open="${i}" aria-label="${item.type === "track" ? "Options for" : "Open"} ${escapeMusic(item.name)}">${musicArt(item)}<span class="name">${escapeMusic(item.name)}</span><small>${escapeMusic(item.artist || item.type)}</small></button>`).join("")}</div>${this._libraryCache.get(this._tab)?.hasMore ? `<div class="section-title"><button data-more ${this._moreBusy ? "disabled" : ""}>${this._moreBusy ? "Loading…" : "Load more"}</button></div>` : ""}`;
    node.scrollTop = scroll;
  }
  _actions(index) {
    const target = index === -1 ? this._detail : this._items[index];
    if (!target) return "";
    const canQueue = target.type !== "artist";
    return `<div class="actions" data-actions="${index}">${target.playable ? `<button class="primary" data-play="replace" data-index="${index}" ${this._readOnly ? "disabled" : ""}>Play now</button>${canQueue ? `<button data-play="next" data-index="${index}" ${this._readOnly ? "disabled" : ""}>Play next</button><button data-play="add" data-index="${index}" ${this._readOnly ? "disabled" : ""}>Add to queue</button>` : ""}` : ""}</div>`;
  }
  async open(index) {
    const item = this._items[index];
    if (!item) return;
    if (item.type === "track") {
      this._showActions(index);
      return;
    }
    this._history ||= [];
    this._history.push({
      items: this._items,
      detail: this._detail,
      scroll: this.shadowRoot.querySelector("[data-content]").scrollTop,
    });
    this._detail = item;
    this._busy = true;
    this._error = "";
    const serial = ++this._serial;
    this._renderContent();
    try {
      const room = this._coordinator();
      if (!room?.ma_entity_id)
        throw new Error(
          "This room needs a Music Assistant player to browse collections.",
        );
      const result = await this._hass.callWS({
        type: "media_player/browse_media",
        entity_id: room.ma_entity_id,
        media_content_id: item.uri,
        media_content_type: item.type,
      });
      if (serial !== this._serial || !this.isConnected) return;
      this._items = (result.children || []).map((i) =>
        normaliseMusicItem(
          {
            ...i,
            uri: i.media_content_id,
            media_type:
              i.media_class === "music"
                ? "track"
                : i.media_class || i.media_content_type || "track",
          },
          i.media_content_type,
        ),
      );
      this.shadowRoot.querySelector("[data-content]").scrollTop = 0;
    } catch (e) {
      if (serial === this._serial)
        this._error = e.message || "Could not open this collection.";
    } finally {
      if (serial === this._serial) {
        this._busy = false;
        this._renderContent();
      }
    }
  }
  _showActions(index) {
    const node =
      this.shadowRoot
        .querySelector(`[data-item-menu="${index}"]`)
        ?.closest(".row") ||
      this.shadowRoot.querySelector(`[data-open="${index}"]`);
    if (!node) return;
    const old = this.shadowRoot.querySelector("[data-inline-actions]");
    if (old?.dataset.inlineActions === String(index)) {
      old.remove();
      return;
    }
    old?.remove();
    const holder = document.createElement("div");
    holder.dataset.inlineActions = index;
    holder.innerHTML = this._actions(index);
    node.after(holder);
    holder.querySelector("button")?.focus({ preventScroll: true });
    holder.scrollIntoView({ block: "nearest" });
  }
  async refreshQueue() {
    const room = this._coordinator(),
      serial = ++this._queueSerial;
    if (!room || !this._hass || !this.isConnected) return;
    const native = this._hass.states?.[room.entity_id];
    this._queueLoading = true;
    this._queueError = "";
    this._renderQueue();
    try {
      let queue;
      if (
        room.ma_entity_id &&
        musicManagedPlayback(native, this._hass.states?.[room.ma_entity_id]) &&
        this._hass.services?.mass_queue?.get_queue_items
      ) {
        queue = musicQueue(
          await this._read("mass_queue", "get_queue_items", {
            entity: room.ma_entity_id,
            limit_before: 0,
            limit_after: 100,
          }),
          room.ma_entity_id,
          native,
          "Music Assistant",
        );
      } else if (this._hass.services?.sonos?.get_queue) {
        queue = musicQueue(
          await this._read("sonos", "get_queue", {}, room.entity_id),
          room.entity_id,
          native,
          "Sonos",
        );
      } else
        throw new Error(
          native?.attributes?.media_title
            ? "This source does not expose its queue. Playback controls below still work."
            : "Start some music in this room to see what’s next.",
        );
      if (serial !== this._queueSerial || !this.isConnected) return;
      this._queue = {
        ...queue,
        room: room.entity_id,
        maEntity: room.ma_entity_id,
      };
    } catch (e) {
      if (serial === this._queueSerial) {
        this._queue = null;
        this._queueError = e.message || "Up next is temporarily unavailable.";
      }
    } finally {
      if (serial === this._queueSerial) {
        this._queueLoading = false;
        this._renderQueue();
      }
    }
  }
  _renderQueue() {
    const node = this.shadowRoot.querySelector("[data-queue-body]"),
      label = this.shadowRoot.querySelector("[data-queue-room]");
    if (!node) return;
    const room = this._room(),
      coordinator = this._coordinator();
    if (label) label.textContent = room?.name || "Choose a room";
    const state = this._hass?.states?.[room?.entity_id],
      a = state?.attributes || {},
      current = normaliseMusicItem(a);
    const scroll = node.scrollTop;
    node.innerHTML = `<div class="now"><small>${state?.state === "playing" ? "Now playing" : state?.state === "paused" ? "Paused" : "In this room"}</small>${current.name ? `<div class="row">${musicArt({ ...current, image: musicImage(a.entity_picture) })}<div class="text"><span class="name">${escapeMusic(current.name)}</span><small>${escapeMusic(current.artist)}</small></div></div>` : '<p class="muted">Nothing playing</p>'}</div>${coordinator && coordinator.entity_id !== room?.entity_id ? `<p class="source-note">Grouped with ${escapeMusic(coordinator.name)}</p>` : ""}${this._queueLoading && !this._queue ? '<p class="empty" role="status">Loading Up next…</p>' : this._queueError ? `<p class="empty">${escapeMusic(this._queueError)}</p>` : this._queue ? `<p class="source-note">${this._queue.source} queue${this._queueLoading ? " · Refreshing…" : ""}${!this._queue.positionKnown ? " · This queue is not linked to the current source; showing saved order." : ""}</p>${this._queue.items.length ? this._queue.items.map((item, i) => this._row(item, i, true)).join("") : '<p class="empty">You’ve reached the end of this queue. Find something to play next.</p>'}` : ""}`;
    node.scrollTop = scroll;
  }
  async play(index, enqueue) {
    if (
      this._readOnly ||
      !this.isConnected ||
      !["replace", "next", "add"].includes(enqueue) ||
      this._actionBusy
    )
      return;
    const item = index === -1 ? this._detail : this._items[index],
      room = this._coordinator();
    if (!item?.uri || !room || !room.ma_entity_id || !item.playable) return;
    this._actionBusy = true;
    this._setStatus(`Sending to ${room.name}…`);
    try {
      const native = this._hass.states?.[room.entity_id],
        ma = this._hass.states?.[room.ma_entity_id];
      const external =
        native?.attributes?.media_title &&
        !musicManagedPlayback(native, ma);
      if (enqueue !== "replace" && external) {
        const id = musicIdentity(item.uri);
        if (
          !/^spotify:(track|album|playlist):/.test(id) &&
          !/^spotify:\/\/(track|album|playlist)\//.test(id)
        )
          throw new Error(
            "Play now starts this collection in Music Assistant. To add to this external queue, choose a Spotify song, album or playlist.",
          );
        const uri = id.replace(
          /^spotify:\/\/(track|album|playlist)\//,
          "spotify:$1:",
        );
        await this._hass.callService(
          "media_player",
          "play_media",
          {
            media_content_id: uri,
            media_content_type: item.type === "track" ? "music" : item.type,
            enqueue,
          },
          { entity_id: room.entity_id },
        );
      } else
        await this._hass.callService(
          "music_assistant",
          "play_media",
          { media_id: item.uri, media_type: item.type, enqueue },
          { entity_id: room.ma_entity_id },
        );
      if (
        this.isConnected &&
        room.entity_id === this._coordinator()?.entity_id
      ) {
        this._setStatus(
          `${enqueue === "replace" ? "Play request sent" : enqueue === "next" ? "Play next requested" : "Add to queue requested"} · ${room.name}`,
        );
        void this.refreshQueue();
      }
    } catch (e) {
      this._setStatus(
        e.message || "Could not send that request. Please try again.",
      );
    } finally {
      this._actionBusy = false;
    }
  }
  async playQueue(index) {
    if (
      this._readOnly ||
      !this.isConnected ||
      !this._queue?.positionKnown ||
      this._actionBusy
    )
      return;
    const item = this._queue.items[index],
      room = this._coordinator();
    if (!item || room?.entity_id !== this._queue.room) return;
    this._actionBusy = true;
    try {
      if (this._queue.source === "Sonos")
        await this._hass.callService(
          "sonos",
          "play_queue",
          { queue_position: item.position },
          { entity_id: room.entity_id },
        );
      else if (item.queueId)
        await this._hass.callService("mass_queue", "play_queue_item", {
          entity: room.ma_entity_id,
          queue_item_id: item.queueId,
        });
      this._setStatus(`Play request sent · ${room.name}`);
    } catch {
      this._setStatus(
        "Could not play that queued song. Refresh Up next and try again.",
      );
    } finally {
      this._actionBusy = false;
    }
  }
  _showGroup() {
    const room = this._coordinator(),
      members = this._hass?.states?.[room?.entity_id]?.attributes
        ?.group_members || [room?.entity_id];
    this.shadowRoot.querySelector("[data-group]").innerHTML =
      `<section class="group-panel" aria-label="Group rooms"><header><h3>Play together</h3><button data-group-close aria-label="Close room grouping">Close</button></header><p>Keep ${escapeMusic(room?.name || "this room")} as the main room. Selected rooms will follow its music.</p>${this._players
        .filter((p) => p.can_be_grouped !== false)
        .map(
          (p) =>
            `<label><input type="checkbox" data-group-member="${escapeMusic(p.entity_id)}" ${members.includes(p.entity_id) ? "checked" : ""} ${this._readOnly || p.entity_id === room?.entity_id ? "disabled" : ""}>${escapeMusic(p.name)}</label>`,
        )
        .join(
          "",
        )}<div><button class="primary" data-group-apply ${this._readOnly || !room ? "disabled" : ""}>Apply group</button></div></section>`;
    this.shadowRoot.querySelector("[data-group-close]")?.focus();
  }
  async _applyGroup() {
    if (this._readOnly || !this.isConnected || this._actionBusy) return;
    const room = this._coordinator();
    if (!room || room.can_be_grouped === false) return;
    const selected = [
      ...this.shadowRoot.querySelectorAll("[data-group-member]:checked"),
    ]
      .map((n) => n.dataset.groupMember)
      .filter(
        (id) =>
          id !== room.entity_id &&
          this._players.some(
            (p) => p.entity_id === id && p.can_be_grouped !== false,
          ),
      );
    const old =
      this._hass.states?.[room.entity_id]?.attributes?.group_members || [];
    this._actionBusy = true;
    try {
      for (const id of old.filter(
        (id) =>
          id !== room.entity_id &&
          !selected.includes(id) &&
          this._players.some(
            (p) => p.entity_id === id && p.can_be_grouped !== false,
          ),
      )) {
        if (!this.isConnected) return;
        await this._hass.callService(
          "media_player",
          "unjoin",
          {},
          { entity_id: id },
        );
      }
      if (selected.length && this.isConnected)
        await this._hass.callService(
          "media_player",
          "join",
          { group_members: selected },
          { entity_id: room.entity_id },
        );
      this._setStatus("Room group update requested.");
      this.shadowRoot.querySelector("[data-group]").innerHTML = "";
    } catch {
      this._setStatus(
        "Could not update the group. Check the rooms and try again.",
      );
    } finally {
      this._actionBusy = false;
    }
  }
  async _click(event) {
    const b = event.target.closest("button");
    if (!b) return;
    if (b.dataset.room) this.selectPlayer(b.dataset.room);
    else if (b.hasAttribute("data-clear")) {
      this._query = "";
      this.shadowRoot.querySelector("[data-query]").value = "";
      this._tab = "playlists";
      void this.loadLibrary();
      this.shadowRoot.querySelector("[data-query]").focus();
    } else if (b.dataset.type) {
      this._type = b.dataset.type;
      void this.search();
    } else if (b.dataset.tab) {
      this._tab = b.dataset.tab;
      void this.loadLibrary();
    } else if (b.dataset.panel) {
      this._panel = b.dataset.panel;
      this.shadowRoot.querySelector(".workspace").dataset.panel = this._panel;
      this.shadowRoot
        .querySelectorAll(".mobile-switch button")
        .forEach((n) =>
          n.setAttribute("aria-pressed", n.dataset.panel === this._panel),
        );
    } else if (b.hasAttribute("data-open"))
      void this.open(Number(b.dataset.open));
    else if (b.hasAttribute("data-item-menu"))
      this._showActions(Number(b.dataset.itemMenu));
    else if (b.dataset.play)
      void this.play(Number(b.dataset.index), b.dataset.play);
    else if (b.hasAttribute("data-queue-play"))
      void this.playQueue(Number(b.dataset.queuePlay));
    else if (b.hasAttribute("data-refresh-queue")) void this.refreshQueue();
    else if (b.hasAttribute("data-back")) {
      this._serial++;
      const prior = this._history?.pop();
      this._detail = prior?.detail || null;
      this._items = prior?.items || [];
      this._busy = false;
      this._error = "";
      this._renderContent();
      this.shadowRoot.querySelector("[data-content]").scrollTop =
        prior?.scroll || 0;
    } else if (b.hasAttribute("data-show-library")) {
      this._query = "";
      this.shadowRoot.querySelector("[data-query]").value = "";
      this._tab = "playlists";
      void this.loadLibrary();
    } else if (b.hasAttribute("data-retry-search")) void this.search(true);
    else if (b.hasAttribute("data-more")) void this.loadMore();
    else if (b.hasAttribute("data-library-refresh"))
      void this.loadLibrary(true);
    else if (b.hasAttribute("data-retry")) {
      if (this._detail) {
        const item = this._detail;
        this._detail = null;
        this._items = [item];
        void this.open(0);
      } else if (this._tab === "search") void this.search();
      else void this.loadLibrary(true);
    } else if (b.hasAttribute("data-group-open")) this._showGroup();
    else if (b.hasAttribute("data-group-close")) {
      this.shadowRoot.querySelector("[data-group]").innerHTML = "";
      this.shadowRoot.querySelector("[data-group-open]").focus();
    } else if (b.hasAttribute("data-group-apply")) void this._applyGroup();
  }
}
if (globalThis.customElements && !customElements.get("family-music-page"))
  customElements.define("family-music-page", FamilyMusicPage);
