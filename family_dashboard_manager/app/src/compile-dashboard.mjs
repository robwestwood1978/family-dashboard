import { validateConfig } from "./validate-config.mjs";

const q = (value) => JSON.stringify(String(value));

function rgba(hex, alpha) {
  const red = Number.parseInt(hex.slice(1, 3), 16);
  const green = Number.parseInt(hex.slice(3, 5), 16);
  const blue = Number.parseInt(hex.slice(5, 7), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const VIEW_META = {
  today: { title: "Today", icon: "mdi:home-heart" },
  calendar: { title: "Calendar", icon: "mdi:calendar-month" },
  home: { title: "Home", icon: "mdi:home-automation" },
  music: { title: "Music", icon: "mdi:music-circle" },
  chores: { title: "Chores", icon: "mdi:checkbox-marked-circle-auto-outline" },
  football: { title: "Football", icon: "mdi:soccer" },
  school: { title: "School", icon: "mdi:school-outline" }
};

const VIEW_ORDER = Object.keys(VIEW_META);

function navigationPaths(config) {
  return VIEW_ORDER.filter((path) => path === "today" || config.features[path]);
}

export function getEnabledViewPaths(config) {
  const paths = navigationPaths(config);
  const defaultIndex = paths.indexOf(config.display.default_view);
  if (defaultIndex <= 0) return paths;
  return [paths[defaultIndex], ...paths.slice(0, defaultIndex), ...paths.slice(defaultIndex + 1)];
}

function addCardStyle(lines, indent, config, { accent = config.theme.accent, hero = false } = {}) {
  const background = hero ? config.theme.accent : config.theme.surface;
  const text = hero ? config.theme.surface : config.theme.text;
  lines.push(`${indent}card_mod:`);
  lines.push(`${indent}  style: |`);
  lines.push(`${indent}    ha-card {`);
  lines.push(`${indent}      --primary-color: ${accent};`);
  lines.push(`${indent}      --accent-color: ${accent};`);
  lines.push(`${indent}      --primary-text-color: ${text};`);
  lines.push(`${indent}      --secondary-text-color: ${hero ? config.theme.surface : config.theme.muted};`);
  lines.push(`${indent}      --state-icon-color: ${hero ? config.theme.surface : accent};`);
  lines.push(`${indent}      --paper-item-icon-color: ${hero ? config.theme.surface : accent};`);
  lines.push(`${indent}      background: ${background};`);
  lines.push(`${indent}      color: ${text};`);
  lines.push(`${indent}      border: 1px solid ${rgba(accent, 0.2)};`);
  lines.push(`${indent}      border-radius: ${config.theme.radius_px}px;`);
  lines.push(`${indent}      box-shadow: 0 6px 18px rgba(32, 36, 50, 0.08);`);
  lines.push(`${indent}    }`);
  if (config.display.legacy_ios) {
    lines.push(`${indent}    ha-card, ha-card * {`);
    lines.push(`${indent}      animation: none !important;`);
    lines.push(`${indent}      transition: none !important;`);
    lines.push(`${indent}    }`);
  }
}

function addSectionStart(lines, config, { span = 1, colour = config.theme.background, opacity = 100 } = {}) {
  lines.push(`      - type: grid`);
  if (span > 1) lines.push(`        column_span: ${span}`);
  lines.push(`        background:`);
  lines.push(`          color: ${q(colour)}`);
  lines.push(`          opacity: ${opacity}`);
  lines.push(`        cards:`);
}

function addHeading(lines, indent, heading, icon) {
  lines.push(`${indent}- type: heading`);
  lines.push(`${indent}  heading: ${q(heading)}`);
  lines.push(`${indent}  icon: ${icon}`);
  lines.push(`${indent}  heading_style: title`);
}

function addHeroCard(lines, config, indent) {
  lines.push(`${indent}- type: markdown`);
  lines.push(`${indent}  content: |-`);
  lines.push(`${indent}    # {{ now().strftime('%A') }}`);
  lines.push(`${indent}    ## {{ now().strftime('%d %B %Y') }}`);
  addCardStyle(lines, `${indent}  `, config, { hero: true });
}

function addCalendarCard(lines, config, indent, view) {
  lines.push(`${indent}- type: ${q(config.calendar.card_type)}`);
  lines.push(`${indent}  title: ${q(view === "today" ? "Coming up" : config.product.title)}`);
  lines.push(`${indent}  entities:`);
  for (const calendar of config.calendar.entities) {
    lines.push(`${indent}    - ${q(calendar.entity_id)}`);
  }
  lines.push(`${indent}  default_view: ${q(view === "today" ? "agenda" : config.calendar.default_view)}`);
  lines.push(`${indent}  first_day_of_week: 1`);
  lines.push(`${indent}  locale: ${q(config.product.locale)}`);
  lines.push(`${indent}  use_24hr_schedule: true`);
  lines.push(`${indent}  color_scheme: light`);
  lines.push(`${indent}  header_color: ${q(config.theme.accent)}`);
  lines.push(`${indent}  hide_dark_mode_toggle: true`);
  lines.push(`${indent}  enable_event_management: false`);
  lines.push(`${indent}  event_calendar_friendly_name: true`);
  lines.push(`${indent}  background_transparent: false`);
  lines.push(`${indent}  header_background_transparent: false`);
  if (config.features.weather) {
    lines.push(`${indent}  header_weather_sensor: ${q(config.weather.entity_id)}`);
  }
  lines.push(`${indent}  event_styles:`);
  for (const calendar of config.calendar.entities) {
    lines.push(`${indent}    - match:`);
    lines.push(`${indent}        calendar: ${q(calendar.entity_id)}`);
    lines.push(`${indent}      style:`);
    lines.push(`${indent}        color: ${q(calendar.colour)}`);
    lines.push(`${indent}        font_color: ${q("#FFFFFF")}`);
  }
  if (view === "today") {
    lines.push(`${indent}  rolling_days_agenda: ${Math.min(config.calendar.rolling_days, 3)}`);
    lines.push(`${indent}  agenda_compact_events: true`);
    lines.push(`${indent}  hide_empty_days: true`);
    lines.push(`${indent}  past_event_mode: hide`);
    lines.push(`${indent}  compact_header: true`);
  } else {
    lines.push(`${indent}  rolling_days_schedule: ${config.calendar.rolling_days}`);
    lines.push(`${indent}  past_event_mode: muted`);
  }
  addCardStyle(lines, `${indent}  `, config);
}

function addWeatherCard(lines, config, indent, compact = false) {
  lines.push(`${indent}- type: weather-forecast`);
  lines.push(`${indent}  entity: ${q(config.weather.entity_id)}`);
  lines.push(`${indent}  name: ${q("Home")}`);
  lines.push(`${indent}  show_current: true`);
  lines.push(`${indent}  show_forecast: ${compact ? "false" : "true"}`);
  lines.push(`${indent}  forecast_type: daily`);
  lines.push(`${indent}  round_temperature: true`);
  addCardStyle(lines, `${indent}  `, config);
}

function addTodoCard(lines, config, indent, { entity, title, reminders = false }) {
  lines.push(`${indent}- type: todo-list`);
  lines.push(`${indent}  entity: ${q(entity)}`);
  lines.push(`${indent}  title: ${q(title)}`);
  lines.push(`${indent}  hide_completed: true`);
  lines.push(`${indent}  hide_create: false`);
  lines.push(`${indent}  display_order: ${reminders ? "duedate_asc" : "none"}`);
  lines.push(`${indent}  item_tap_action: toggle`);
  if (reminders) {
    lines.push(`${indent}  due_date_period:`);
    lines.push(`${indent}    calendar:`);
    lines.push(`${indent}      period: day`);
    lines.push(`${indent}      offset: 6`);
  }
  addCardStyle(lines, `${indent}  `, config);
}

function personFor(config, personId) {
  return config.people.find((person) => person.id === personId);
}

function addChoreSummaryCard(lines, config, indent, user, { navigate = true } = {}) {
  const person = personFor(config, user.person_id);
  const secondary = `{{ states('${user.points_entity}') }} points · {{ state_attr('${user.chores_entity}', 'chore_stat_current_due_today') | int(0) }} due today`;
  lines.push(`${indent}- type: custom:mushroom-template-card`);
  lines.push(`${indent}  entity: ${q(user.points_entity)}`);
  lines.push(`${indent}  primary: ${q(person.name)}`);
  lines.push(`${indent}  secondary: ${q(secondary)}`);
  lines.push(`${indent}  icon: mdi:star-circle`);
  lines.push(`${indent}  icon_color: ${q(person.colour)}`);
  lines.push(`${indent}  multiline_secondary: true`);
  lines.push(`${indent}  tap_action:`);
  if (navigate) {
    lines.push(`${indent}    action: navigate`);
    lines.push(`${indent}    navigation_path: ${q(`/${config.display.panel_path}/chores`)}`);
  } else {
    lines.push(`${indent}    action: more-info`);
  }
  addCardStyle(lines, `${indent}  `, config, { accent: person.colour });
}

function addChoreAutoEntities(lines, config, indent, user) {
  const person = personFor(config, user.person_id);
  lines.push(`${indent}- type: custom:auto-entities`);
  lines.push(`${indent}  card:`);
  lines.push(`${indent}    type: grid`);
  lines.push(`${indent}    columns: 1`);
  lines.push(`${indent}    square: false`);
  lines.push(`${indent}  card_param: cards`);
  lines.push(`${indent}  filter:`);
  lines.push(`${indent}    template: |-`);
  const j = `${indent}      `;
  lines.push(`${j}{%- set helper = '${user.dashboard_helper_entity}' -%}`);
  lines.push(`${j}{%- set helpers = state_attr(helper, 'dashboard_helpers') or {} -%}`);
  lines.push(`${j}{%- set helper_entities = helpers.get('chore_helper_eids', []) if helpers is mapping else [] -%}`);
  lines.push(`${j}{%- if helper_entities is string or helper_entities is not iterable -%}`);
  lines.push(`${j}  {%- set helper_entities = [] -%}`);
  lines.push(`${j}{%- endif -%}`);
  lines.push(`${j}{%- set ns = namespace(chores=state_attr(helper, 'chores') | default([], true), visible=0) -%}`);
  lines.push(`${j}{%- for helper_entity in helper_entities -%}`);
  lines.push(`${j}  {%- set ns.chores = ns.chores + (state_attr(helper_entity, 'chores') | default([], true)) -%}`);
  lines.push(`${j}{%- endfor -%}`);
  lines.push(`${j}{%- for chore in ns.chores -%}`);
  lines.push(`${j}  {%- set chore_entity = chore.eid if chore is mapping else chore -%}`);
  lines.push(`${j}  {%- set raw_state = states(chore_entity) -%}`);
  lines.push(`${j}  {%- if chore_entity not in [none, '', 'unknown'] and raw_state not in ['completed', 'approved', 'already_approved', 'completed_by_other'] -%}`);
  lines.push(`${j}    {%- set chore_name = state_attr(chore_entity, 'chore_name') | default(state_attr(chore_entity, 'friendly_name') or chore_entity, true) -%}`);
  lines.push(`${j}    {%- set chore_icon = state_attr(chore_entity, 'icon') | default('mdi:broom', true) -%}`);
  lines.push(`${j}    {%- set claim_button = state_attr(chore_entity, 'claim_button_eid') | default('', true) -%}`);
  lines.push(`${j}    {%- set approve_button = state_attr(chore_entity, 'approve_button_eid') | default('', true) -%}`);
  lines.push(`${j}    {%- set disapprove_button = state_attr(chore_entity, 'disapprove_button_eid') | default('', true) -%}`);
  lines.push(`${j}    {%- set active_button = (disapprove_button or approve_button) if raw_state == 'claimed' else (claim_button or approve_button) -%}`);
  lines.push(`${j}    {%- set tile_colour = 'red' if raw_state in ['overdue', 'missed'] else 'orange' if raw_state == 'due' else 'purple' if raw_state == 'claimed' else 'primary' -%}`);
  lines.push(`${j}    {{ {`);
  lines.push(`${j}      'type': 'tile',`);
  lines.push(`${j}      'entity': chore_entity,`);
  lines.push(`${j}      'name': chore_name,`);
  lines.push(`${j}      'icon': chore_icon,`);
  lines.push(`${j}      'color': tile_colour,`);
  lines.push(`${j}      'vertical': false,`);
  lines.push(`${j}      'state_content': ['state', 'due_date'],`);
  lines.push(`${j}      'tap_action': {`);
  lines.push(`${j}        'action': 'perform-action',`);
  lines.push(`${j}        'perform_action': 'button.press',`);
  lines.push(`${j}        'target': {'entity_id': active_button}`);
  lines.push(`${j}      } if active_button not in ['', none] else {'action': 'none'},`);
  lines.push(`${j}      'hold_action': {'action': 'more-info', 'entity': chore_entity}`);
  lines.push(`${j}    } }},`);
  lines.push(`${j}    {%- set ns.visible = ns.visible + 1 -%}`);
  lines.push(`${j}  {%- endif -%}`);
  lines.push(`${j}{%- endfor -%}`);
  lines.push(`${j}{%- if ns.visible == 0 -%}`);
  lines.push(`${j}  {{ {'type': 'markdown', 'content': '**All caught up.** Nothing needs attention right now.'} }}`);
  lines.push(`${j}{%- endif -%}`);
  addCardStyle(lines, `${indent}  `, config, { accent: person.colour });
}

function addFootballCard(lines, config, indent, entry, compact = false) {
  lines.push(`${indent}- type: ${q(config.football.card_type)}`);
  lines.push(`${indent}  entity: ${q(entry.entity_id)}`);
  lines.push(`${indent}  card_title: ${q(compact ? "Next match" : entry.label)}`);
  lines.push(`${indent}  outline: true`);
  lines.push(`${indent}  outline_color: ${q(config.theme.accent)}`);
  lines.push(`${indent}  show_rank: true`);
  lines.push(`${indent}  show_timeouts: false`);
  addCardStyle(lines, `${indent}  `, config);
}

function addMediaCard(lines, config, indent, size) {
  lines.push(`${indent}- type: ${q(config.media.card_type)}`);
  lines.push(`${indent}  size: ${size}`);
  if (size === "large") {
    lines.push(`${indent}  mode: panel`);
    lines.push(`${indent}  height: ${q("calc(100vh - 188px)")}`);
  }
  lines.push(`${indent}  entity_id: ${q(config.media.initial_player)}`);
  lines.push(`${indent}  media_players:`);
  for (const player of config.media.players) {
    lines.push(`${indent}    - entity_id: ${q(player.entity_id)}`);
    lines.push(`${indent}      name: ${q(player.name)}`);
    if (player.ma_entity_id) lines.push(`${indent}      ma_entity_id: ${q(player.ma_entity_id)}`);
    if (player.speaker_group_entity_id) {
      lines.push(`${indent}      speaker_group_entity_id: ${q(player.speaker_group_entity_id)}`);
    }
    if (typeof player.can_be_grouped === "boolean") {
      lines.push(`${indent}      can_be_grouped: ${player.can_be_grouped}`);
    }
  }
  lines.push(`${indent}  options:`);
  lines.push(`${indent}    player_is_active_when: playing_or_paused`);
  lines.push(`${indent}    show_volume_step_buttons: true`);
  if (size === "large") lines.push(`${indent}    default_tab: massive`);
  addCardStyle(lines, `${indent}  `, config);
}

function addPlaceholder(lines, config, indent, title, body) {
  lines.push(`${indent}- type: markdown`);
  lines.push(`${indent}  title: ${q(title)}`);
  lines.push(`${indent}  content: ${q(body)}`);
  addCardStyle(lines, `${indent}  `, config);
}

function addControlTile(lines, config, indent, entity, kind) {
  lines.push(`${indent}- type: tile`);
  lines.push(`${indent}  entity: ${q(entity)}`);
  lines.push(`${indent}  color: ${q(config.theme.accent)}`);
  lines.push(`${indent}  features_position: bottom`);
  if (kind === "light") {
    lines.push(`${indent}  features:`);
    lines.push(`${indent}    - type: light-brightness`);
  } else if (kind === "climate") {
    lines.push(`${indent}  features:`);
    lines.push(`${indent}    - type: target-temperature`);
  } else if (kind === "cover") {
    lines.push(`${indent}  features:`);
    lines.push(`${indent}    - type: cover-open-close`);
  }
  addCardStyle(lines, `${indent}  `, config);
}

function addSceneTile(lines, config, indent, entity) {
  lines.push(`${indent}- type: tile`);
  lines.push(`${indent}  entity: ${q(entity)}`);
  lines.push(`${indent}  color: ${q(config.theme.accent)}`);
  lines.push(`${indent}  tap_action:`);
  lines.push(`${indent}    action: perform-action`);
  lines.push(`${indent}    perform_action: scene.turn_on`);
  lines.push(`${indent}    target:`);
  lines.push(`${indent}      entity_id: ${q(entity)}`);
  addCardStyle(lines, `${indent}  `, config);
}

function addNavigationFooter(lines, config, activePath) {
  const paths = navigationPaths(config);
  lines.push(`    footer:`);
  lines.push(`      max_width: 1120`);
  lines.push(`      card:`);
  lines.push(`        type: grid`);
  lines.push(`        columns: ${config.display.orientation === "landscape" ? paths.length : Math.min(paths.length, 3)}`);
  lines.push(`        square: false`);
  lines.push(`        cards:`);
  for (const path of paths) {
    const active = path === activePath;
    lines.push(`          - type: button`);
    lines.push(`            name: ${q(VIEW_META[path].title)}`);
    lines.push(`            icon: ${VIEW_META[path].icon}`);
    lines.push(`            show_state: false`);
    lines.push(`            icon_height: 28px`);
    lines.push(`            tap_action:`);
    lines.push(`              action: navigate`);
    lines.push(`              navigation_path: ${q(`/${config.display.panel_path}/${path}`)}`);
    addCardStyle(lines, `            `, config, {
      accent: config.theme.accent,
      hero: active
    });
  }
}

function addViewStart(lines, config, path, maxColumns) {
  lines.push(`  - title: ${q(VIEW_META[path].title)}`);
  lines.push(`    path: ${path}`);
  lines.push(`    icon: ${VIEW_META[path].icon}`);
  lines.push(`    type: sections`);
  lines.push(`    max_columns: ${maxColumns}`);
  lines.push(`    dense_section_placement: false`);
  lines.push(`    sections:`);
}

function addTodayView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 3 : 2;
  addViewStart(lines, config, "today", maxColumns);

  addSectionStart(lines, config, { span: maxColumns, colour: config.theme.accent });
  addHeroCard(lines, config, "          ");

  if (config.features.calendar) {
    addSectionStart(lines, config, { span: Math.min(2, maxColumns) });
    addCalendarCard(lines, config, "          ", "today");
  }

  if (config.features.weather || config.features.chores || config.features.football) {
    addSectionStart(lines, config);
    addHeading(lines, "          ", "At a glance", "mdi:view-dashboard-outline");
    if (config.features.weather) addWeatherCard(lines, config, "          ", true);
    if (config.features.chores) {
      for (const user of config.chores.users) addChoreSummaryCard(lines, config, "          ", user);
    }
    if (config.features.football) {
      for (const entry of config.football.entities.slice(0, 1)) {
        addFootballCard(lines, config, "          ", entry, true);
      }
    }
  }

  if (config.features.lists) {
    addSectionStart(lines, config, { span: Math.min(2, maxColumns) });
    addHeading(lines, "          ", "Family lists", "mdi:format-list-checks");
    addTodoCard(lines, config, "          ", {
      entity: config.lists.reminders_entity,
      title: "Next seven days",
      reminders: true
    });
    addTodoCard(lines, config, "          ", {
      entity: config.lists.shopping_entity,
      title: "Shopping list"
    });
  }

  if (config.features.music) {
    addSectionStart(lines, config);
    addHeading(lines, "          ", "Now playing", "mdi:music-note");
    addMediaCard(lines, config, "          ", "compact");
  }

  addNavigationFooter(lines, config, "today");
}

function addCalendarView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 3 : 2;
  addViewStart(lines, config, "calendar", maxColumns);
  addSectionStart(lines, config, { span: maxColumns });
  addCalendarCard(lines, config, "          ", "calendar");
  addNavigationFooter(lines, config, "calendar");
}

function addHomeView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 3 : 2;
  addViewStart(lines, config, "home", maxColumns);
  for (const room of config.rooms) {
    addSectionStart(lines, config);
    addHeading(lines, "          ", room.name, room.icon);
    for (const entity of room.lights) addControlTile(lines, config, "          ", entity, "light");
    if (room.climate) addControlTile(lines, config, "          ", room.climate, "climate");
    for (const entity of room.covers) addControlTile(lines, config, "          ", entity, "cover");
    if (room.scene) addSceneTile(lines, config, "          ", room.scene);
    if (room.lights.length === 0 && room.covers.length === 0 && !room.climate && !room.scene) {
      addPlaceholder(lines, config, "          ", room.name, "No controls are configured for this room.");
    }
  }
  addNavigationFooter(lines, config, "home");
}

function addMusicView(lines, config) {
  addViewStart(lines, config, "music", 1);
  addSectionStart(lines, config);
  addMediaCard(lines, config, "          ", "large");
  addNavigationFooter(lines, config, "music");
}

function addChoresView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 2 : 1;
  addViewStart(lines, config, "chores", maxColumns);
  for (const user of config.chores.users) {
    const person = personFor(config, user.person_id);
    addSectionStart(lines, config);
    addHeading(lines, "          ", `${person.name}'s chores`, "mdi:star-check-outline");
    addChoreSummaryCard(lines, config, "          ", user, { navigate: false });
    addChoreAutoEntities(lines, config, "          ", user);
  }
  addNavigationFooter(lines, config, "chores");
}

function addFootballView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 2 : 1;
  addViewStart(lines, config, "football", maxColumns);
  for (const entry of config.football.entities) {
    addSectionStart(lines, config);
    addFootballCard(lines, config, "          ", entry);
  }
  addNavigationFooter(lines, config, "football");
}

function addSchoolView(lines, config) {
  const maxColumns = config.display.orientation === "landscape" ? 3 : 1;
  addViewStart(lines, config, "school", maxColumns);
  addSectionStart(lines, config, { span: maxColumns });
  addHeading(lines, "          ", "School", "mdi:school-outline");
  if (config.school.entities.length === 0) {
    addPlaceholder(lines, config, "          ", "School", "Google Classroom and SCOPAY remain disabled until their read-only feasibility checks pass.");
  } else {
    for (const entity of config.school.entities) addControlTile(lines, config, "          ", entity, "entity");
  }
  addNavigationFooter(lines, config, "school");
}

const BUILDERS = {
  today: addTodayView,
  calendar: addCalendarView,
  home: addHomeView,
  music: addMusicView,
  chores: addChoresView,
  football: addFootballView,
  school: addSchoolView
};

export function compileDashboard(input) {
  const config = validateConfig(structuredClone(input));
  const lines = [
    `# Generated by @family-dashboard/manager v0.2.0. Do not edit by hand.`,
    `title: ${q(config.product.title)}`
  ];
  if (config.display.kiosk) {
    lines.push(`kiosk_mode:`);
    lines.push(`  non_admin_settings:`);
    lines.push(`    kiosk: true`);
    lines.push(`    block_context_menu: false`);
    lines.push(`  admin_settings:`);
    lines.push(`    kiosk: false`);
  }
  lines.push(`views:`);
  for (const path of getEnabledViewPaths(config)) BUILDERS[path](lines, config);
  return `${lines.join("\n")}\n`;
}
