import { validateConfig } from "./validate-config.mjs";

const q = (value) => JSON.stringify(String(value));

function addEntityList(lines, entities, indent) {
  for (const entity of entities) lines.push(`${indent}- ${q(entity)}`);
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
    lines.push(`${indent}  compact_height: true`);
  }
}

function addMediaCard(lines, config, indent, size) {
  lines.push(`${indent}- type: ${q(config.media.card_type)}`);
  lines.push(`${indent}  size: ${size}`);
  if (size === "large") {
    lines.push(`${indent}  mode: panel`);
    lines.push(`${indent}  height: ${q("calc(100vh - 96px)")}`);
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
}

function addPlaceholder(lines, indent, title, body) {
  lines.push(`${indent}- type: markdown`);
  lines.push(`${indent}  title: ${q(title)}`);
  lines.push(`${indent}  content: ${q(body)}`);
}

function addEntitiesCard(lines, indent, title, entities, emptyMessage) {
  if (entities.length === 0) {
    addPlaceholder(lines, indent, title, emptyMessage);
    return;
  }
  lines.push(`${indent}- type: entities`);
  lines.push(`${indent}  title: ${q(title)}`);
  lines.push(`${indent}  show_header_toggle: false`);
  lines.push(`${indent}  entities:`);
  addEntityList(lines, entities, `${indent}    `);
}

function addTodayView(lines, config) {
  lines.push(`  - title: "Today"`);
  lines.push(`    path: today`);
  lines.push(`    icon: mdi:home-heart`);
  lines.push(`    type: sections`);
  lines.push(`    max_columns: 4`);
  lines.push(`    sections:`);
  lines.push(`      - type: grid`);
  lines.push(`        column_span: 3`);
  lines.push(`        cards:`);
  lines.push(`          - type: markdown`);
  lines.push(`            content: "# {{ now().strftime('%A %d %B') }}"`);
  if (config.features.calendar) addCalendarCard(lines, config, "          ", "today");
  lines.push(`      - type: grid`);
  lines.push(`        cards:`);
  if (config.features.music) addMediaCard(lines, config, "          ", "compact");
  if (config.features.chores) {
    addEntitiesCard(lines, "          ", "Chores", config.chores.summary_entities, "ChoreOps entities will appear after live inventory mapping.");
  }
  if (config.features.football) {
    addEntitiesCard(lines, "          ", "Football", config.football.entities, "Premier League fixtures and results will appear after the data-source proof.");
  }
}

function addCalendarView(lines, config) {
  if (!config.features.calendar) return;
  lines.push(`  - title: "Calendar"`);
  lines.push(`    path: calendar`);
  lines.push(`    icon: mdi:calendar-month`);
  lines.push(`    type: panel`);
  lines.push(`    cards:`);
  addCalendarCard(lines, config, "      ", "calendar");
}

function addHomeView(lines, config) {
  if (!config.features.home) return;
  lines.push(`  - title: "Home"`);
  lines.push(`    path: home`);
  lines.push(`    icon: mdi:home-automation`);
  lines.push(`    type: sections`);
  lines.push(`    max_columns: 4`);
  lines.push(`    sections:`);
  if (config.rooms.length === 0) {
    lines.push(`      - type: grid`);
    lines.push(`        cards:`);
    addPlaceholder(lines, "          ", "Home", "Rooms will appear after live inventory mapping.");
    return;
  }
  for (const room of config.rooms) {
    lines.push(`      - type: grid`);
    lines.push(`        cards:`);
    lines.push(`          - type: heading`);
    lines.push(`            heading: ${q(room.name)}`);
    lines.push(`            icon: mdi:sofa-outline`);
    for (const entityId of room.lights) {
      lines.push(`          - type: tile`);
      lines.push(`            entity: ${q(entityId)}`);
      lines.push(`            features_position: bottom`);
    }
    if (room.climate) {
      lines.push(`          - type: thermostat`);
      lines.push(`            entity: ${q(room.climate)}`);
    }
    if (room.scene) {
      lines.push(`          - type: tile`);
      lines.push(`            entity: ${q(room.scene)}`);
      lines.push(`            tap_action:`);
      lines.push(`              action: toggle`);
    }
  }
}

function addMusicView(lines, config) {
  if (!config.features.music) return;
  lines.push(`  - title: "Music"`);
  lines.push(`    path: music`);
  lines.push(`    icon: mdi:music-circle`);
  lines.push(`    type: panel`);
  lines.push(`    cards:`);
  addMediaCard(lines, config, "      ", "large");
}

function addCollectionView(lines, config, feature, title, path, icon, entities, emptyMessage) {
  if (!config.features[feature]) return;
  lines.push(`  - title: ${q(title)}`);
  lines.push(`    path: ${path}`);
  lines.push(`    icon: ${icon}`);
  lines.push(`    type: sections`);
  lines.push(`    max_columns: 3`);
  lines.push(`    sections:`);
  lines.push(`      - type: grid`);
  lines.push(`        cards:`);
  addEntitiesCard(lines, "          ", title, entities, emptyMessage);
}

export function compileDashboard(input) {
  const config = validateConfig(structuredClone(input));
  const lines = [
    `# Generated by @family-dashboard/manager. Do not edit by hand.`,
    `title: ${q(config.product.title)}`,
    `views:`
  ];
  addTodayView(lines, config);
  addCalendarView(lines, config);
  addHomeView(lines, config);
  addMusicView(lines, config);
  addCollectionView(lines, config, "chores", "Chores", "chores", "mdi:checkbox-marked-circle-auto-outline", config.chores.summary_entities, "ChoreOps will be mapped after the live inventory connection.");
  addCollectionView(lines, config, "football", "Football", "football", "mdi:soccer", config.football.entities, "Premier League fixtures and results will be connected after the data-source proof.");
  addCollectionView(lines, config, "school", "School", "school", "mdi:school-outline", config.school.entities, "Google Classroom and SCOPAY are disabled until their read-only feasibility checks pass.");
  return `${lines.join("\n")}\n`;
}
