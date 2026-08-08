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
  calendar: { title: "Calendar", nav: "Week", icon: "mdi:calendar-month" },
  home: { title: "Home", icon: "mdi:home-automation" },
  music: { title: "Music", icon: "mdi:music-circle" },
  chores: { title: "Chores", icon: "mdi:checkbox-marked-circle-auto-outline" },
  football: { title: "Football", icon: "mdi:soccer" },
  school: { title: "School", icon: "mdi:school-outline" }
};

const SUBVIEW_META = {
  lighting: { title: "Lighting", icon: "mdi:lightbulb-group-outline" },
  heating: { title: "Heating", icon: "mdi:radiator" },
  entry: { title: "Cameras & Entry", icon: "mdi:cctv" }
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
  const background = hero
    ? `linear-gradient(135deg, ${accent}, ${config.theme.backdrop_end})`
    : rgba(config.theme.surface, 0.94);
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
  lines.push(`${indent}      border: 1px solid ${hero ? rgba(config.theme.surface, 0.42) : rgba(accent, 0.22)};`);
  lines.push(`${indent}      border-radius: ${config.theme.radius_px}px;`);
  lines.push(`${indent}      box-shadow: 0 14px 34px rgba(19, 26, 46, 0.18);`);
  lines.push(`${indent}    }`);
  if (config.display.legacy_ios) {
    lines.push(`${indent}    ha-card, ha-card * {`);
    lines.push(`${indent}      animation: none !important;`);
    lines.push(`${indent}      transition: none !important;`);
    lines.push(`${indent}    }`);
  }
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
  lines.push(`${indent}  background_opacity: 0`);
  lines.push(`${indent}  header_background_opacity: ${view === "today" ? 100 : 18}`);
  lines.push(`${indent}  compact_height: true`);
  lines.push(`${indent}  compact_width: ${view === "today" ? "true" : "false"}`);
  lines.push(`${indent}  event_color_mode: left-tint`);
  lines.push(`${indent}  event_tint_opacity: 42`);
  lines.push(`${indent}  event_color_bar_width: 8`);
  lines.push(`${indent}  colors:`);
  for (const calendar of config.calendar.entities) {
    lines.push(`${indent}    ${calendar.entity_id}: ${q(calendar.colour)}`);
  }
  lines.push(`${indent}  event_font_colors:`);
  for (const calendar of config.calendar.entities) {
    lines.push(`${indent}    ${calendar.entity_id}: ${q(config.theme.text)}`);
  }
  lines.push(`${indent}  today_style:`);
  lines.push(`${indent}    background_color: ${q(config.theme.accent)}`);
  lines.push(`${indent}    opacity: 0.12`);
  lines.push(`${indent}    border_color: ${q(config.theme.accent)}`);
  lines.push(`${indent}    border_width: 2`);
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
    lines.push(`${indent}  height_scale: 0.82`);
  }
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

function warmBackground(config) {
  return "linear-gradient(135deg, " + config.theme.backdrop_start + " 0%, " +
    config.theme.backdrop_mid + " 48%, " + config.theme.backdrop_end + " 100%)";
}

function addButtonCardStyles(lines, indent, config, {
  background = rgba(config.theme.surface, 0.92),
  colour = config.theme.text,
  accent = config.theme.accent,
  height = "auto",
  align = "start",
  padding = "18px"
} = {}) {
  lines.push(indent + "styles:");
  lines.push(indent + "  card:");
  lines.push(indent + "    - background: " + q(background));
  lines.push(indent + "    - color: " + q(colour));
  lines.push(indent + "    - border: " + q("1px solid " + rgba(config.theme.surface, 0.46)));
  lines.push(indent + "    - border-radius: " + config.theme.radius_px + "px");
  lines.push(indent + "    - box-shadow: " + q("0 14px 34px rgba(19, 26, 46, 0.20)"));
  lines.push(indent + "    - min-height: " + q(height));
  lines.push(indent + "    - padding: " + q(padding));
  lines.push(indent + "  grid:");
  lines.push(indent + "    - grid-template-areas: " + q('"i n" "i s" "i l"'));
  lines.push(indent + "    - grid-template-columns: " + q("54px minmax(0, 1fr)"));
  lines.push(indent + "    - grid-template-rows: " + q("auto auto auto"));
  lines.push(indent + "    - column-gap: " + q("12px"));
  lines.push(indent + "  img_cell:");
  lines.push(indent + "    - justify-self: center");
  lines.push(indent + "    - align-self: center");
  lines.push(indent + "    - width: " + q("44px"));
  lines.push(indent + "    - height: " + q("44px"));
  lines.push(indent + "    - border-radius: " + q("50%"));
  lines.push(indent + "    - background: " + q(rgba(accent, 0.15)));
  lines.push(indent + "    - color: " + q(accent));
  lines.push(indent + "  name:");
  lines.push(indent + "    - justify-self: " + align);
  lines.push(indent + "    - text-align: left");
  lines.push(indent + "    - font-size: " + q("17px"));
  lines.push(indent + "    - font-weight: 760");
  lines.push(indent + "  state:");
  lines.push(indent + "    - justify-self: " + align);
  lines.push(indent + "    - text-align: left");
  lines.push(indent + "    - font-size: " + q("13px"));
  lines.push(indent + "    - font-weight: 680");
  lines.push(indent + "  label:");
  lines.push(indent + "    - justify-self: " + align);
  lines.push(indent + "    - text-align: left");
  lines.push(indent + "    - color: " + q(config.theme.muted));
  lines.push(indent + "    - font-size: " + q("11px"));
  lines.push(indent + "    - font-weight: 620");
  if (config.display.legacy_ios) {
    lines.push(indent + "extra_styles: " + q("* { animation: none !important; transition: none !important; }"));
  }
}

function addNavButton(lines, config, indent, path, active) {
  const meta = VIEW_META[path];
  const background = active
    ? "linear-gradient(135deg, " + config.theme.backdrop_end + ", " + config.theme.accent + ")"
    : rgba(config.theme.nav_background, 0.94);
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  name: " + q(meta.nav || meta.title));
  lines.push(indent + "  icon: " + meta.icon);
  lines.push(indent + "  show_state: false");
  lines.push(indent + "  size: 21px");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: navigate");
  lines.push(indent + "    navigation_path: " + q("/" + config.display.panel_path + "/" + path));
  lines.push(indent + "  styles:");
  lines.push(indent + "    card:");
  lines.push(indent + "      - min-height: " + q("62px"));
  lines.push(indent + "      - padding: " + q("8px 4px"));
  lines.push(indent + "      - background: " + q(background));
  lines.push(indent + "      - border: " + q("1px solid " + rgba(config.theme.surface, active ? 0.70 : 0.16)));
  lines.push(indent + "      - border-radius: " + q("22px"));
  lines.push(indent + "      - box-shadow: " + q(active ? "0 10px 24px rgba(19, 26, 46, 0.28)" : "none"));
  lines.push(indent + "    grid:");
  lines.push(indent + "      - grid-template-areas: " + q('"i" "n"'));
  lines.push(indent + "      - grid-template-rows: " + q("27px 17px"));
  lines.push(indent + "    icon:");
  lines.push(indent + "      - color: " + q(active ? config.theme.surface : rgba(config.theme.surface, 0.82)));
  lines.push(indent + "    name:");
  lines.push(indent + "      - color: " + q(active ? config.theme.surface : rgba(config.theme.surface, 0.68)));
  lines.push(indent + "      - font-size: " + q("10px"));
  lines.push(indent + "      - font-weight: 720");
  if (config.display.legacy_ios) {
    lines.push(indent + "  extra_styles: " + q("* { animation: none !important; transition: none !important; }"));
  }
}

function addNavigationRail(lines, config, indent, activePath) {
  lines.push(indent + "- type: vertical-stack");
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: nav");
  lines.push(indent + "  cards:");
  lines.push(indent + "    - type: custom:button-card");
  lines.push(indent + "      name: W");
  lines.push(indent + "      show_icon: false");
  lines.push(indent + "      tap_action:");
  lines.push(indent + "        action: navigate");
  lines.push(indent + "        navigation_path: " + q("/" + config.display.panel_path + "/today"));
  lines.push(indent + "      styles:");
  lines.push(indent + "        card:");
  lines.push(indent + "          - min-height: " + q("54px"));
  lines.push(indent + "          - border-radius: " + q("50%"));
  lines.push(indent + "          - background: " + q(rgba(config.theme.nav_background, 0.96)));
  lines.push(indent + "          - border: " + q("1px solid " + rgba(config.theme.surface, 0.50)));
  lines.push(indent + "        name:");
  lines.push(indent + "          - color: " + q(config.theme.surface));
  lines.push(indent + "          - font-size: " + q("24px"));
  lines.push(indent + "          - font-weight: 820");
  for (const path of navigationPaths(config)) {
    addNavButton(lines, config, indent + "    ", path, path === activePath);
  }
}

function addViewHeader(lines, config, indent, title, subtitle) {
  lines.push(indent + "- type: markdown");
  lines.push(indent + "  content: |-");
  lines.push(indent + "    # " + title);
  lines.push(indent + "    ## " + subtitle);
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: header");
  lines.push(indent + "  card_mod:");
  lines.push(indent + "    style: |");
  lines.push(indent + "      ha-card {");
  lines.push(indent + "        background: transparent;");
  lines.push(indent + "        border: 0;");
  lines.push(indent + "        box-shadow: none;");
  lines.push(indent + "        color: " + config.theme.surface + ";");
  lines.push(indent + "        padding: 0 4px;");
  lines.push(indent + "      }");
  lines.push(indent + "      h1 { font-size: 30px; line-height: 1.08; margin: 0; font-weight: 820; }");
  lines.push(indent + "      h2 { font-size: 13px; line-height: 1.2; margin: 6px 0 0; opacity: 0.76; font-weight: 650; }");
}

function addHeaderWeather(lines, config, indent) {
  if (!config.features.weather) {
    lines.push(indent + "- type: markdown");
    lines.push(indent + "  content: " + q("{{ now().strftime('%H:%M · %a %d %b') }}"));
    lines.push(indent + "  view_layout:");
    lines.push(indent + "    grid-area: weather");
    addCardStyle(lines, indent + "  ", config, { hero: true });
    return;
  }
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  entity: " + q(config.weather.entity_id));
  lines.push(indent + "  name: " + q("[[[ return entity.attributes.temperature === undefined ? 'Home' : entity.attributes.temperature + '°'; ]]]"));
  lines.push(indent + "  label: " + q("[[[ return (entity.state || 'Weather').replace(/_/g, ' ') + ' · ' + new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); ]]]"));
  lines.push(indent + "  show_state: false");
  lines.push(indent + "  show_label: true");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: more-info");
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: weather");
  addButtonCardStyles(lines, indent + "  ", config, {
    background: rgba(config.theme.surface, 0.18),
    colour: config.theme.surface,
    accent: "#F2B85C",
    height: "64px",
    padding: "10px 14px"
  });
}

function addWarmViewStart(lines, config, path, title, subtitle, { subview = false, activePath = path } = {}) {
  const meta = VIEW_META[path] || SUBVIEW_META[path];
  lines.push("  - title: " + q(meta.title));
  lines.push("    path: " + path);
  lines.push("    icon: " + meta.icon);
  if (subview) lines.push("    subview: true");
  lines.push("    type: custom:grid-layout");
  lines.push("    background: " + q(warmBackground(config)));
  lines.push("    layout:");
  lines.push("      grid-template-columns: " + q("64px minmax(0, 1fr) 214px"));
  lines.push("      grid-template-rows: " + q("78px minmax(0, 1fr)"));
  lines.push("      grid-template-areas: |");
  lines.push('        "nav header weather"');
  lines.push('        "nav main main"');
  lines.push("      grid-gap: " + q("14px 20px"));
  lines.push("      margin: 0");
  lines.push("      padding: " + q("16px"));
  lines.push("      height: " + q("calc(100vh - 8px)"));
  lines.push("      mediaquery:");
  lines.push('        "(max-width: 700px)":');
  lines.push("          grid-template-columns: " + q("56px minmax(0, 1fr)"));
  lines.push("          grid-template-rows: " + q("72px 72px minmax(0, 1fr)"));
  lines.push("          grid-template-areas: |");
  lines.push('            "nav header"');
  lines.push('            "nav weather"');
  lines.push('            "nav main"');
  lines.push("          grid-gap: " + q("10px"));
  lines.push("          padding: " + q("10px"));
  lines.push("    cards:");
  addNavigationRail(lines, config, "      ", activePath);
  addViewHeader(lines, config, "      ", title, subtitle);
  addHeaderWeather(lines, config, "      ");
}

function addEmbeddedGridStart(lines, indent, columns, rows, areas, height) {
  lines.push(indent + "- type: custom:layout-card");
  lines.push(indent + "  layout_type: custom:grid-layout");
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: main");
  lines.push(indent + "  layout:");
  lines.push(indent + "    grid-template-columns: " + q(columns));
  if (rows) lines.push(indent + "    grid-template-rows: " + q(rows));
  if (areas) {
    lines.push(indent + "    grid-template-areas: |");
    for (const area of areas) lines.push(indent + "      " + q(area));
  }
  lines.push(indent + "    grid-gap: " + q("16px"));
  lines.push(indent + "    margin: 0");
  lines.push(indent + "    padding: 0");
  if (height) lines.push(indent + "    height: " + q(height));
  lines.push(indent + "  cards:");
}

function addUpNextCard(lines, config, indent) {
  const primary = config.calendar.entities[0];
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  entity: " + q(primary.entity_id));
  lines.push(indent + "  name: " + q("[[[ const start = entity.attributes.start_time; return start ? new Date(start).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'Up next'; ]]]"));
  lines.push(indent + "  state_display: " + q("[[[ return entity.attributes.message || 'Nothing else scheduled'; ]]]"));
  lines.push(indent + "  label: " + q("[[[ return entity.attributes.location || 'Family calendar'; ]]]"));
  lines.push(indent + "  icon: mdi:calendar-clock");
  lines.push(indent + "  show_state: true");
  lines.push(indent + "  show_label: true");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: more-info");
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: upnext");
  addButtonCardStyles(lines, indent + "  ", config, {
    background: "linear-gradient(135deg, " + config.theme.backdrop_end + ", " + config.theme.accent + ")",
    colour: config.theme.surface,
    accent: "#F2B85C",
    height: "164px",
    padding: "22px"
  });
}

function addTodayLists(lines, config, indent) {
  lines.push(indent + "- type: horizontal-stack");
  lines.push(indent + "  view_layout:");
  lines.push(indent + "    grid-area: lists");
  lines.push(indent + "  cards:");
  addTodoCard(lines, config, indent + "    ", {
    entity: config.lists.reminders_entity,
    title: "Reminders",
    reminders: true
  });
  addTodoCard(lines, config, indent + "    ", {
    entity: config.lists.shopping_entity,
    title: "Shopping"
  });
}

function addWarmTodayView(lines, config) {
  addWarmViewStart(
    lines,
    config,
    "today",
    "{{ 'Good morning' if now().hour < 12 else 'Good afternoon' if now().hour < 18 else 'Good evening' }}",
    "{{ now().strftime('%A %d %B') }} · your family at a glance"
  );
  addEmbeddedGridStart(
    lines,
    "      ",
    "minmax(0, 1.75fr) minmax(250px, 0.9fr)",
    "minmax(170px, 1fr) 152px 164px",
    ['"calendar upnext"', '"calendar chores"', '"lists media"'],
    "calc(100vh - 116px)"
  );
  if (config.features.calendar) {
    addCalendarCard(lines, config, "        ", "today");
    lines.push("          view_layout:");
    lines.push("            grid-area: calendar");
    addUpNextCard(lines, config, "        ");
  }
  if (config.features.chores) {
    lines.push("        - type: vertical-stack");
    lines.push("          view_layout:");
    lines.push("            grid-area: chores");
    lines.push("          cards:");
    for (const user of config.chores.users.slice(0, 2)) {
      addChoreSummaryCard(lines, config, "            ", user);
    }
  }
  if (config.features.lists) addTodayLists(lines, config, "        ");
  if (config.features.music) {
    addMediaCard(lines, config, "        ", "compact");
    lines.push("          view_layout:");
    lines.push("            grid-area: media");
  }
}

function addWarmCalendarView(lines, config) {
  addWarmViewStart(
    lines,
    config,
    "calendar",
    config.product.title,
    "The week ahead · weather, plans and family colour"
  );
  if (config.features.calendar) {
    addCalendarCard(lines, config, "      ", "calendar");
    lines.push("        view_layout:");
    lines.push("          grid-area: main");
  }
}

function addControlPortal(lines, config, indent, {
  title,
  label,
  icon,
  path,
  accent
}) {
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  name: " + q(title));
  lines.push(indent + "  label: " + q(label));
  lines.push(indent + "  icon: " + icon);
  lines.push(indent + "  show_state: false");
  lines.push(indent + "  show_label: true");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: navigate");
  lines.push(indent + "    navigation_path: " + q("/" + config.display.panel_path + "/" + path));
  addButtonCardStyles(lines, indent + "  ", config, {
    background: rgba(config.theme.surface, 0.91),
    accent,
    height: "178px",
    padding: "24px"
  });
}

function addWarmHomeView(lines, config) {
  addWarmViewStart(lines, config, "home", "Home controls", "Choose a focused control surface");
  addEmbeddedGridStart(lines, "      ", "repeat(2, minmax(0, 1fr))", "repeat(2, minmax(0, 1fr))", null, "calc(100vh - 116px)");
  const lightCount = config.rooms.reduce((total, room) => total + room.lights.length, 0);
  const heatingCount = config.rooms.filter((room) => room.climate).length;
  addControlPortal(lines, config, "        ", {
    title: "Lighting",
    label: lightCount + " lights · room brightness and scenes",
    icon: "mdi:lightbulb-group-outline",
    path: "lighting",
    accent: "#F2B85C"
  });
  addControlPortal(lines, config, "        ", {
    title: "Heating",
    label: heatingCount + " zones · temperatures, targets and schedules",
    icon: "mdi:radiator",
    path: "heating",
    accent: "#EE6C62"
  });
  if (config.features.entry) {
    addControlPortal(lines, config, "        ", {
      title: "Cameras & Entry",
      label: config.entry.cameras.length + " cameras · doorbell and garage",
      icon: "mdi:cctv",
      path: "entry",
      accent: "#3FA99D"
    });
  }
  if (config.features.music) {
    addControlPortal(lines, config, "        ", {
      title: "Media",
      label: config.media.players.length + " speakers · browse, group and play",
      icon: "mdi:speaker-multiple",
      path: "music",
      accent: "#5B5BD6"
    });
  }
}

function addRoomControlStack(lines, config, indent, room) {
  lines.push(indent + "- type: vertical-stack");
  lines.push(indent + "  cards:");
  lines.push(indent + "    - type: markdown");
  lines.push(indent + "      content: " + q("### " + room.name));
  addCardStyle(lines, indent + "      ", config, { accent: config.theme.accent });
  for (const entity of room.lights) addControlTile(lines, config, indent + "    ", entity, "light");
  for (const entity of room.covers) addControlTile(lines, config, indent + "    ", entity, "cover");
  if (room.scene) addSceneTile(lines, config, indent + "    ", room.scene);
  if (!room.lights.length && !room.covers.length && !room.scene) {
    addPlaceholder(lines, config, indent + "    ", room.name, "No lighting controls are configured.");
  }
}

function addLightingView(lines, config) {
  addWarmViewStart(lines, config, "lighting", "Lighting", "Tap to toggle · use the slider for brightness", {
    subview: true,
    activePath: "home"
  });
  addEmbeddedGridStart(lines, "      ", "repeat(3, minmax(0, 1fr))", null, null, "calc(100vh - 116px)");
  for (const room of config.rooms) addRoomControlStack(lines, config, "        ", room);
}

function addHeatingView(lines, config) {
  addWarmViewStart(lines, config, "heating", "Heating", "Current temperatures and target control by zone", {
    subview: true,
    activePath: "home"
  });
  addEmbeddedGridStart(lines, "      ", "repeat(3, minmax(0, 1fr))", null, null, "calc(100vh - 116px)");
  for (const room of config.rooms.filter((entry) => entry.climate)) {
    lines.push("        - type: thermostat");
    lines.push("          entity: " + q(room.climate));
    lines.push("          name: " + q(room.name));
    lines.push("          show_current_as_primary: true");
    addCardStyle(lines, "          ", config, { accent: "#EE6C62" });
  }
}

function addCameraCard(lines, config, indent, camera) {
  const primary = camera.id === config.entry.primary_camera_id;
  lines.push(indent + "- type: picture-entity");
  lines.push(indent + "  entity: " + q(camera.entity_id));
  lines.push(indent + "  name: " + q(camera.name));
  lines.push(indent + "  camera_view: " + (primary ? "live" : "auto"));
  lines.push(indent + "  show_name: true");
  lines.push(indent + "  show_state: false");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: more-info");
  addCardStyle(lines, indent + "  ", config, {
    accent: camera.role === "doorbell" ? "#EE6C62" : "#3FA99D"
  });
}

function addEntryStatusCard(lines, config, indent, entity, name, icon, accent) {
  if (!entity) return;
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  entity: " + q(entity));
  lines.push(indent + "  name: " + q(name));
  lines.push(indent + "  icon: " + icon);
  lines.push(indent + "  show_state: true");
  lines.push(indent + "  show_label: true");
  lines.push(indent + "  show_last_changed: true");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: more-info");
  addButtonCardStyles(lines, indent + "  ", config, {
    background: rgba(config.theme.surface, 0.91),
    accent,
    height: "96px",
    padding: "14px"
  });
}

function addGarageCard(lines, config, indent) {
  const garage = config.entry.garage;
  lines.push(indent + "- type: custom:button-card");
  lines.push(indent + "  entity: " + q(garage.cover_entity));
  lines.push(indent + "  name: Garage door");
  lines.push(indent + "  state_display: " + q("[[[ return entity.state === 'open' ? 'Open' : entity.state === 'closed' ? 'Closed' : entity.state; ]]]"));
  lines.push(indent + "  label: " + q("Tap for details · press and hold to move"));
  lines.push(indent + "  icon: mdi:garage");
  lines.push(indent + "  show_state: true");
  lines.push(indent + "  show_label: true");
  lines.push(indent + "  tap_action:");
  lines.push(indent + "    action: more-info");
  lines.push(indent + "  hold_action: |");
  lines.push(indent + "    [[[");
  lines.push(indent + "      const opening = entity.state !== 'open';");
  lines.push(indent + "      return {");
  lines.push(indent + "        action: 'perform-action',");
  lines.push(indent + "        perform_action: opening ? 'cover.open_cover' : 'cover.close_cover',");
  lines.push(indent + "        target: { entity_id: entity.entity_id },");
  lines.push(indent + "        confirmation: {");
  lines.push(indent + "          text: opening");
  lines.push(indent + "            ? 'Check the live driveway view is clear, then confirm opening the garage door.'");
  lines.push(indent + "            : 'Check the live garage view, then confirm closing the garage door.'");
  lines.push(indent + "        }");
  lines.push(indent + "      };");
  lines.push(indent + "    ]]]");
  addButtonCardStyles(lines, indent + "  ", config, {
    background: "linear-gradient(135deg, " + config.theme.nav_background + ", " + config.theme.backdrop_mid + ")",
    colour: config.theme.surface,
    accent: "#F2B85C",
    height: "150px",
    padding: "20px"
  });
}

function addEntryView(lines, config) {
  addWarmViewStart(lines, config, "entry", "Cameras & Entry", "One live stream at a time · doorbell and garage status", {
    subview: true,
    activePath: "home"
  });
  addEmbeddedGridStart(
    lines,
    "      ",
    "minmax(0, 1.65fr) minmax(260px, 0.85fr)",
    null,
    null,
    "calc(100vh - 116px)"
  );
  lines.push("        - type: vertical-stack");
  lines.push("          cards:");
  const ordered = [...config.entry.cameras].sort((a, b) => {
    if (a.id === config.entry.primary_camera_id) return -1;
    if (b.id === config.entry.primary_camera_id) return 1;
    return 0;
  });
  for (const camera of ordered) addCameraCard(lines, config, "            ", camera);
  lines.push("        - type: vertical-stack");
  lines.push("          cards:");
  const doorbell = config.entry.cameras.find((camera) => camera.role === "doorbell") || ordered[0];
  addEntryStatusCard(lines, config, "            ", doorbell.ringing_entity, "Doorbell", "mdi:doorbell-video", "#EE6C62");
  addEntryStatusCard(lines, config, "            ", doorbell.motion_entity, "Front motion", "mdi:motion-sensor", "#F2B85C");
  addEntryStatusCard(lines, config, "            ", doorbell.person_entity, "Person detected", "mdi:account-alert-outline", "#EE6C62");
  addGarageCard(lines, config, "            ");
  if (config.entry.garage.motion_entity) {
    addEntryStatusCard(lines, config, "            ", config.entry.garage.motion_entity, "Garage motion", "mdi:motion-sensor", "#3FA99D");
  }
}

function addWarmMusicView(lines, config) {
  addWarmViewStart(lines, config, "music", "Music", "Choose a room, browse, group speakers and control playback");
  addMediaCard(lines, config, "      ", "large");
  lines.push("        view_layout:");
  lines.push("          grid-area: main");
}

function addWarmChoresView(lines, config) {
  addWarmViewStart(lines, config, "chores", "Chores", "Points, progress and today’s next actions");
  addEmbeddedGridStart(lines, "      ", "repeat(2, minmax(0, 1fr))", null, null, "calc(100vh - 116px)");
  for (const user of config.chores.users) {
    lines.push("        - type: vertical-stack");
    lines.push("          cards:");
    addChoreSummaryCard(lines, config, "            ", user, { navigate: false });
    addChoreAutoEntities(lines, config, "            ", user);
  }
}

function addWarmFootballView(lines, config) {
  addWarmViewStart(lines, config, "football", "Football", "Fixtures, form and the next Premier League story");
  addEmbeddedGridStart(lines, "      ", "repeat(2, minmax(0, 1fr))", null, null, "calc(100vh - 116px)");
  for (const entry of config.football.entities) addFootballCard(lines, config, "        ", entry);
}

function addWarmSchoolView(lines, config) {
  addWarmViewStart(lines, config, "school", "School", "Read-only school information");
  lines.push("      - type: vertical-stack");
  lines.push("        view_layout:");
  lines.push("          grid-area: main");
  lines.push("        cards:");
  if (config.school.entities.length === 0) {
    addPlaceholder(lines, config, "          ", "School", "School integrations remain disabled until read-only feasibility checks pass.");
  } else {
    for (const entity of config.school.entities) addControlTile(lines, config, "          ", entity, "entity");
  }
}

const BUILDERS = {
  today: addWarmTodayView,
  calendar: addWarmCalendarView,
  home: addWarmHomeView,
  music: addWarmMusicView,
  chores: addWarmChoresView,
  football: addWarmFootballView,
  school: addWarmSchoolView
};

export function compileDashboard(input) {
  const config = validateConfig(structuredClone(input));
  const lines = [
    `# Generated by @family-dashboard/manager v0.3.0. Do not edit by hand.`,
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
  if (config.features.home) {
    addLightingView(lines, config);
    addHeatingView(lines, config);
  }
  if (config.features.entry) addEntryView(lines, config);
  return `${lines.join("\n")}\n`;
}
