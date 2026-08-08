import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getEnabledViewPaths } from "../src/compile-dashboard.mjs";
import { validateConfig } from "../src/validate-config.mjs";

const VIEW_LABELS = {
  today: "Today",
  calendar: "Calendar",
  home: "Home",
  music: "Music",
  chores: "Chores",
  football: "Football",
  school: "School"
};

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text({ x, y, value, size = 14, weight = 500, fill, anchor = "start", spacing = 0 }) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

function card({ x, y, width, height, radius, fill, stroke, strokeOpacity = 1 }) {
  return `<rect x="${x}" y="${y + 4}" width="${width}" height="${height}" rx="${radius}" fill="#202432" opacity="0.055"/><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-opacity="${strokeOpacity}"/>`;
}

function checkbox(x, y, colour, checked = false) {
  const mark = checked
    ? `<path d="M ${x + 5} ${y + 10} l 4 4 l 8 -9" fill="none" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>`
    : "";
  return `<rect x="${x}" y="${y}" width="22" height="22" rx="7" fill="${checked ? colour : "#FFFFFF"}" stroke="${colour}" stroke-width="2"/>${mark}`;
}

function renderAgenda(lines, config, colours) {
  const { surface, text: textColour, muted, accent } = config.theme;
  lines.push(card({ x: 16, y: 104, width: 638, height: 370, radius: 20, fill: surface, stroke: accent, strokeOpacity: 0.18 }));
  lines.push(text({ x: 40, y: 139, value: "Coming up", size: 21, weight: 750, fill: textColour }));
  lines.push(`<rect x="538" y="119" width="92" height="28" rx="14" fill="${accent}" fill-opacity="0.08"/>`);
  lines.push(text({ x: 584, y: 138, value: "3 DAYS", size: 10, weight: 750, fill: accent, anchor: "middle", spacing: 1.1 }));
  lines.push(`<line x1="105" y1="162" x2="105" y2="449" stroke="${accent}" stroke-opacity="0.14" stroke-width="2"/>`);

  const days = [
    {
      label: "TODAY",
      number: "07",
      y: 184,
      events: [
        { time: "08:15", title: "School run", colour: colours[1] },
        { time: "17:30", title: "Library books due", colour: colours[0] }
      ]
    },
    {
      label: "SAT",
      number: "08",
      y: 278,
      events: [
        { time: "10:00", title: "Football practice", colour: colours[2] },
        { time: "18:00", title: "Family dinner", colour: colours[0] }
      ]
    },
    {
      label: "SUN",
      number: "09",
      y: 372,
      events: [{ time: "11:30", title: "Swimming", colour: colours[1] }]
    }
  ];

  for (const day of days) {
    lines.push(text({ x: 41, y: day.y, value: day.label, size: 10, weight: 750, fill: muted, spacing: 1.1 }));
    lines.push(text({ x: 42, y: day.y + 27, value: day.number, size: 24, weight: 780, fill: textColour }));
    day.events.forEach((event, index) => {
      const eventY = day.y - 18 + index * 40;
      lines.push(`<rect x="122" y="${eventY}" width="8" height="30" rx="4" fill="${event.colour}"/>`);
      lines.push(text({ x: 145, y: eventY + 20, value: event.time, size: 12, weight: 650, fill: muted }));
      lines.push(text({ x: 202, y: eventY + 20, value: event.title, size: 14, weight: 650, fill: textColour }));
    });
  }
}

function renderLists(lines, config) {
  const { surface, text: textColour, muted, accent } = config.theme;
  lines.push(card({ x: 16, y: 490, width: 638, height: 168, radius: 20, fill: surface, stroke: accent, strokeOpacity: 0.18 }));
  lines.push(text({ x: 40, y: 524, value: "Family lists", size: 19, weight: 750, fill: textColour }));
  lines.push(`<line x1="327" y1="510" x2="327" y2="638" stroke="${accent}" stroke-opacity="0.12"/>`);
  lines.push(text({ x: 40, y: 552, value: "REMINDERS", size: 10, weight: 750, fill: muted, spacing: 1 }));
  lines.push(checkbox(40, 568, accent));
  lines.push(text({ x: 74, y: 584, value: "Pack PE kit", size: 13, weight: 650, fill: textColour }));
  lines.push(checkbox(40, 606, accent));
  lines.push(text({ x: 74, y: 622, value: "Call the dentist", size: 13, weight: 650, fill: textColour }));
  lines.push(text({ x: 351, y: 552, value: "SHOPPING", size: 10, weight: 750, fill: muted, spacing: 1 }));
  lines.push(checkbox(351, 568, accent));
  lines.push(text({ x: 385, y: 584, value: "Milk and fruit", size: 13, weight: 650, fill: textColour }));
  lines.push(checkbox(351, 606, accent, true));
  lines.push(text({ x: 385, y: 622, value: "Bread", size: 13, weight: 650, fill: muted }));
  lines.push(`<line x1="385" y1="617" x2="425" y2="617" stroke="${muted}"/>`);
}

function renderGlance(lines, config, children) {
  const { surface, text: textColour, muted, accent } = config.theme;

  lines.push(card({ x: 670, y: 104, width: 338, height: 84, radius: 20, fill: surface, stroke: accent, strokeOpacity: 0.18 }));
  lines.push(`<circle cx="706" cy="146" r="21" fill="#F2B84B" fill-opacity="0.14"/>`);
  lines.push(`<circle cx="699" cy="141" r="9" fill="#F2B84B"/><path d="M 700 151 C 709 144, 720 150, 721 159 L 695 159 C 695 155, 697 152, 700 151" fill="#B9C9D9"/>`);
  lines.push(text({ x: 740, y: 139, value: "Home", size: 12, weight: 650, fill: muted }));
  lines.push(text({ x: 740, y: 166, value: "18°", size: 26, weight: 780, fill: textColour }));
  lines.push(text({ x: 819, y: 154, value: "Partly cloudy", size: 12, weight: 600, fill: muted }));

  children.slice(0, 2).forEach((person, index) => {
    const y = 204 + index * 78;
    lines.push(card({ x: 670, y, width: 338, height: 66, radius: 18, fill: surface, stroke: person.colour, strokeOpacity: 0.25 }));
    lines.push(`<circle cx="704" cy="${y + 33}" r="19" fill="${person.colour}" fill-opacity="0.13"/>`);
    lines.push(text({ x: 704, y: y + 39, value: "★", size: 18, weight: 700, fill: person.colour, anchor: "middle" }));
    lines.push(text({ x: 735, y: y + 28, value: person.name, size: 14, weight: 750, fill: textColour }));
    lines.push(text({ x: 735, y: y + 48, value: `${index + 2} due today`, size: 11, weight: 600, fill: muted }));
    lines.push(text({ x: 976, y: y + 39, value: `${(index + 1) * 25} pts`, size: 12, weight: 750, fill: person.colour, anchor: "end" }));
  });

  lines.push(card({ x: 670, y: 360, width: 338, height: 104, radius: 20, fill: surface, stroke: accent, strokeOpacity: 0.18 }));
  lines.push(text({ x: 694, y: 388, value: "NEXT MATCH", size: 10, weight: 750, fill: muted, spacing: 1 }));
  lines.push(text({ x: 694, y: 419, value: "HOME", size: 13, weight: 750, fill: textColour }));
  lines.push(text({ x: 839, y: 419, value: "SAT 15:00", size: 13, weight: 750, fill: accent, anchor: "middle" }));
  lines.push(text({ x: 984, y: 419, value: "AWAY", size: 13, weight: 750, fill: textColour, anchor: "end" }));
  lines.push(text({ x: 694, y: 446, value: config.football.entities[0]?.label ?? "Football", size: 11, weight: 600, fill: muted }));

  lines.push(card({ x: 670, y: 480, width: 338, height: 178, radius: 20, fill: surface, stroke: accent, strokeOpacity: 0.18 }));
  lines.push(text({ x: 694, y: 510, value: "Now playing", size: 17, weight: 750, fill: textColour }));
  lines.push(`<rect x="694" y="528" width="72" height="72" rx="16" fill="${accent}" fill-opacity="0.09"/>`);
  lines.push(`<circle cx="730" cy="564" r="18" fill="${accent}"/><path d="M 725 554 L 725 574 L 740 564 Z" fill="#FFFFFF"/>`);
  lines.push(text({ x: 782, y: 552, value: "Family favourites", size: 14, weight: 750, fill: textColour }));
  lines.push(text({ x: 782, y: 574, value: config.media.players[0]?.name ?? "Living room", size: 12, weight: 600, fill: muted }));
  lines.push(`<line x1="782" y1="593" x2="984" y2="593" stroke="${accent}" stroke-opacity="0.13" stroke-width="5" stroke-linecap="round"/><line x1="782" y1="593" x2="895" y2="593" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`);
  lines.push(`<circle cx="839" cy="626" r="20" fill="${accent}"/><path d="M 834 617 L 834 635 L 847 626 Z" fill="#FFFFFF"/>`);
}

function renderNavigation(lines, config) {
  const { surface, text: textColour, muted, accent, radius_px: radius } = config.theme;
  const paths = getEnabledViewPaths(config);
  const width = 154;
  const gap = 10;
  paths.slice(0, 6).forEach((path, index) => {
    const x = 16 + index * (width + gap);
    const active = path === "today";
    lines.push(`<rect x="${x}" y="680" width="${width}" height="72" rx="${Math.min(radius, 18)}" fill="#202432" opacity="0.055"/><rect x="${x}" y="676" width="${width}" height="76" rx="${Math.min(radius, 18)}" fill="${active ? accent : surface}" stroke="${accent}" stroke-opacity="${active ? 1 : 0.18}"/>`);
    lines.push(`<circle cx="${x + 77}" cy="700" r="9" fill="${active ? "#FFFFFF" : accent}" opacity="${active ? "1" : "0.18"}"/>`);
    if (!active) lines.push(`<circle cx="${x + 77}" cy="700" r="4" fill="${accent}"/>`);
    lines.push(text({ x: x + 77, y: 733, value: VIEW_LABELS[path], size: 12, weight: active ? 750 : 650, fill: active ? "#FFFFFF" : path === "today" ? textColour : muted, anchor: "middle" }));
  });
}

function renderLegacyPreview(input) {
  const config = validateConfig(structuredClone(input));
  const children = config.people.filter((person) => person.role === "child");
  while (children.length < 2) {
    children.push({ name: `Child ${children.length + 1}`, colour: config.theme.accent });
  }
  const calendarColours = [
    config.calendar.entities[0]?.colour ?? config.theme.accent,
    children[0].colour,
    children[1].colour
  ];
  const { background, surface, text: textColour, accent, radius_px: radius } = config.theme;
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768" role="img" aria-labelledby="title description">`,
    `<title id="title">${escapeXml(config.product.title)} — Today view preview</title>`,
    `<desc id="description">Landscape family dashboard preview with calendar, lists, weather, chores, football, music and touch navigation.</desc>`,
    `<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}</style>`,
    `<rect width="1024" height="768" fill="${background}"/>`,
    `<rect x="16" y="16" width="992" height="72" rx="${radius}" fill="${accent}"/>`,
    text({ x: 40, y: 50, value: "Friday", size: 25, weight: 780, fill: surface }),
    text({ x: 40, y: 72, value: "7 August", size: 13, weight: 600, fill: surface }),
    text({ x: 984, y: 49, value: config.product.title, size: 15, weight: 750, fill: surface, anchor: "end" }),
    text({ x: 984, y: 70, value: "LANDSCAPE · FAMILY MODE", size: 9, weight: 700, fill: surface, anchor: "end", spacing: 1.2 })
  ];

  renderAgenda(lines, config, calendarColours);
  renderLists(lines, config);
  renderGlance(lines, config, children);
  renderNavigation(lines, config);
  lines.push(`</svg>`);
  return `${lines.join("\n")}\n`;
}

function warmDefsSvg() {
  return [
    "<defs>",
    '<linearGradient id="fd-bg" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#14233A"/>',
    '<stop offset="0.48" stop-color="#5D3E5C"/>',
    '<stop offset="1" stop-color="#D98B6E"/>',
    "</linearGradient>",
    '<linearGradient id="fd-surface" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#FFFDFC" stop-opacity="0.98"/>',
    '<stop offset="1" stop-color="#F6EEE9" stop-opacity="0.93"/>',
    "</linearGradient>",
    '<linearGradient id="fd-coral" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#FF7968"/>',
    '<stop offset="1" stop-color="#C94865"/>',
    "</linearGradient>",
    '<linearGradient id="fd-navy" x1="0" y1="0" x2="1" y2="1">',
    '<stop offset="0" stop-color="#243653"/>',
    '<stop offset="1" stop-color="#17233A"/>',
    "</linearGradient>",
    '<filter id="fd-shadow" x="-30%" y="-30%" width="160%" height="180%">',
    '<feDropShadow dx="0" dy="12" stdDeviation="12" flood-color="#131A2E" flood-opacity="0.25"/>',
    "</filter>",
    "</defs>"
  ].join("");
}

function warmRect(x, y, width, height, radius, fill, stroke = "none", opacity = 1, shadow = false) {
  return '<rect x="' + x + '" y="' + y + '" width="' + width + '" height="' + height +
    '" rx="' + radius + '" fill="' + fill + '" stroke="' + stroke + '" opacity="' + opacity +
    '"' + (shadow ? ' filter="url(#fd-shadow)"' : "") + "/>";
}

function warmCircle(cx, cy, radius, fill, stroke = "none", strokeWidth = 1, opacity = 1) {
  return '<circle cx="' + cx + '" cy="' + cy + '" r="' + radius + '" fill="' + fill +
    '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" opacity="' + opacity + '"/>';
}

function warmLine(x1, y1, x2, y2, stroke, width = 1, opacity = 1, dash = "") {
  return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
    '" stroke="' + stroke + '" stroke-width="' + width + '" opacity="' + opacity + '"' +
    (dash ? ' stroke-dasharray="' + dash + '"' : "") + "/>";
}

function warmRail(lines, active) {
  const nav = [
    ["Today", "●"],
    ["Week", "▦"],
    ["Home", "⌂"],
    ["Music", "♫"],
    ["Chores", "✓"],
    ["Scores", "⚽"]
  ];
  lines.push(warmRect(18, 30, 62, 707, 31, "#17233A", "#FFFFFF", 0.94, true));
  lines.push(warmCircle(49, 65, 21, "#34425D"));
  lines.push(text({ x: 49, y: 73, value: "W", size: 21, weight: 820, fill: "#FFFFFF", anchor: "middle" }));
  nav.forEach((entry, index) => {
    const y = 102 + index * 78;
    const selected = entry[0].toLowerCase() === active;
    if (selected) lines.push(warmRect(26, y, 46, 61, 20, "url(#fd-coral)", "#FFFFFF", 1, true));
    lines.push(text({ x: 49, y: y + 25, value: entry[1], size: 17, weight: 760, fill: selected ? "#FFFFFF" : "#D6D9E3", anchor: "middle" }));
    lines.push(text({ x: 49, y: y + 47, value: entry[0], size: 8.5, weight: 730, fill: selected ? "#FFFFFF" : "#AAB0C0", anchor: "middle" }));
  });
}

function warmHeader(lines, config, title, subtitle) {
  lines.push(text({ x: 104, y: 49, value: title, size: 29, weight: 820, fill: "#FFFFFF" }));
  lines.push(text({ x: 105, y: 74, value: subtitle, size: 13, weight: 650, fill: "#FFFFFF", opacity: 0.72 }));
  lines.push(warmRect(790, 22, 208, 64, 25, "#FFFFFF", "#FFFFFF", 0.16));
  lines.push(warmCircle(829, 54, 18, "#F2B85C", "none", 1, 0.98));
  lines.push(text({ x: 859, y: 52, value: "18°", size: 23, weight: 820, fill: "#FFFFFF" }));
  lines.push(text({ x: 859, y: 70, value: "Partly cloudy · 16:42", size: 9.5, weight: 650, fill: "#FFFFFF", opacity: 0.76 }));
  lines.push(text({ x: 982, y: 100, value: config.product.title, size: 8, weight: 700, fill: "#FFFFFF", anchor: "end", opacity: 0.44, spacing: 0.6 }));
}

function warmEvent(lines, y, timeValue, titleValue, colour, subtitleValue) {
  lines.push(text({ x: 128, y: y + 31, value: timeValue, size: 12, weight: 760, fill: "#8B8E9C" }));
  lines.push(warmCircle(178, y + 26, 6, colour));
  lines.push(warmRect(198, y, 416, 52, 18, "#FFFFFF", colour, 0.88));
  lines.push(warmCircle(225, y + 26, 16, colour, "none", 1, 0.14));
  lines.push(text({ x: 253, y: y + 22, value: titleValue, size: 14, weight: 760, fill: "#202637" }));
  lines.push(text({ x: 253, y: y + 39, value: subtitleValue, size: 9.5, weight: 650, fill: "#8B8E9C" }));
}

export function renderPreview(input) {
  const config = validateConfig(structuredClone(input));
  const childColours = config.people.filter((person) => person.role === "child").map((person) => person.colour);
  const firstChild = childColours[0] || "#EE6C62";
  const secondChild = childColours[1] || "#3FA99D";
  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768" role="img" aria-labelledby="title description">',
    '<title id="title">' + escapeXml(config.product.title) + " — warm-glass Today view preview</title>",
    '<desc id="description">Landscape family command centre with a calendar-first warm-glass layout.</desc>',
    '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}</style>',
    warmDefsSvg(),
    '<rect width="1024" height="768" fill="url(#fd-bg)"/>',
    warmCircle(890, 62, 145, "#F7B66E", "none", 1, 0.20),
    warmCircle(950, 230, 105, "#EF6C73", "none", 1, 0.10)
  ];

  warmRail(lines, "today");
  warmHeader(lines, config, "Good afternoon, family", "Friday feels organised · two things left today");
  lines.push(warmRect(101, 111, 623, 612, 32, "url(#fd-surface)", "#FFFFFF", 0.98, true));
  lines.push(text({ x: 128, y: 145, value: "YOUR WEEK", size: 9, weight: 820, fill: config.theme.accent, spacing: 1.3 }));
  const days = [["MON", "3"], ["TUE", "4"], ["WED", "5"], ["THU", "6"], ["FRI", "7"], ["SAT", "8"], ["SUN", "9"]];
  days.forEach((day, index) => {
    const x = 166 + index * 80;
    const current = day[0] === "FRI";
    if (current) lines.push(warmRect(x - 24, 156, 48, 74, 22, "#17233A", "none", 1, true));
    lines.push(text({ x, y: 177, value: day[0], size: 8, weight: 820, fill: current ? "#FFFFFF" : "#74798A", anchor: "middle", spacing: 0.7 }));
    lines.push(text({ x, y: 207, value: day[1], size: 21, weight: 830, fill: current ? "#FFFFFF" : "#202637", anchor: "middle" }));
    lines.push(warmCircle(x, 219, 3.5, current ? "#EE6C62" : index % 2 ? secondChild : config.theme.accent));
  });
  lines.push(warmLine(128, 246, 696, 246, "#DCD7D5", 1, 0.76));
  lines.push(text({ x: 128, y: 280, value: "Today’s rhythm", size: 22, weight: 820, fill: "#202637" }));
  lines.push(warmRect(530, 259, 91, 27, 14, config.theme.accent, "none", 0.10));
  lines.push(text({ x: 575, y: 277, value: "4 EVENTS", size: 8, weight: 820, fill: config.theme.accent, anchor: "middle", spacing: 0.8 }));
  lines.push(warmLine(178, 314, 178, 681, "#BFC2CA", 2, 0.58));
  warmEvent(lines, 302, "08:15", "Holiday club drop-off", config.theme.accent, "Finished · everyone checked in");
  warmEvent(lines, 377, "15:45", "Library books collected", "#4F7EA3", "Finished · 3 books renewed");
  warmEvent(lines, 474, "17:00", "Football training", firstChild, "Leave 16:35 · kit is packed");
  warmEvent(lines, 557, "18:30", "Family dinner", secondChild, "Everyone home · kitchen");
  lines.push(warmLine(128, 459, 630, 459, firstChild, 1.4, 0.70, "5 6"));
  lines.push(warmRect(128, 448, 68, 23, 12, firstChild));
  lines.push(text({ x: 162, y: 464, value: "NOW 16:42", size: 8, weight: 820, fill: "#FFFFFF", anchor: "middle" }));

  lines.push(warmRect(649, 208, 349, 226, 28, "url(#fd-coral)", "#FFFFFF", 0.98, true));
  lines.push(text({ x: 675, y: 248, value: "UP NEXT · 18M", size: 9, weight: 820, fill: "#FFFFFF", spacing: 0.9 }));
  lines.push(text({ x: 675, y: 299, value: "17:00", size: 42, weight: 850, fill: "#FFFFFF" }));
  lines.push(text({ x: 675, y: 331, value: "Football training", size: 21, weight: 800, fill: "#FFFFFF" }));
  lines.push(text({ x: 675, y: 355, value: "Child one · Sports Park", size: 11, weight: 650, fill: "#FFFFFF", opacity: 0.82 }));
  lines.push(warmRect(674, 378, 194, 34, 17, "#7E2E4B", "#FFFFFF", 0.38));
  lines.push(warmCircle(692, 395, 6, "#F2B85C"));
  lines.push(text({ x: 707, y: 399, value: "Leave by 16:35 · kit packed", size: 9, weight: 720, fill: "#FFFFFF" }));
  lines.push(warmCircle(959, 395, 19, "#FFFFFF"));
  lines.push(text({ x: 959, y: 402, value: "✓", size: 18, weight: 850, fill: firstChild, anchor: "middle" }));

  lines.push(warmRect(686, 456, 312, 126, 25, "#FFFFFF", "#FFFFFF", 0.16));
  lines.push(text({ x: 708, y: 485, value: "CHORES TODAY", size: 9, weight: 820, fill: "#FFFFFF", opacity: 0.72, spacing: 0.9 }));
  [firstChild, secondChild].forEach((colour, index) => {
    const cx = 733 + index * 142;
    lines.push(warmCircle(cx, 535, 27, "none", "#FFFFFF", 5, 0.22));
    lines.push(warmCircle(cx, 535, 27, "none", colour, 5, 0.96));
    lines.push(warmCircle(cx, 535, 18, colour));
    lines.push(text({ x: cx, y: 541, value: index ? "2" : "3", size: 16, weight: 840, fill: "#FFFFFF", anchor: "middle" }));
    lines.push(text({ x: cx + 39, y: 526, value: index ? "Child two · 50 pts" : "Child one · 75 pts", size: 11, weight: 760, fill: "#FFFFFF" }));
    lines.push(text({ x: cx + 39, y: 547, value: "one left", size: 9, weight: 650, fill: "#FFFFFF", opacity: 0.66 }));
  });

  lines.push(warmRect(686, 602, 312, 120, 25, "url(#fd-navy)", "#FFFFFF", 0.98, true));
  lines.push(warmCircle(727, 662, 29, "#F2B85C", "none", 1, 0.20));
  lines.push(text({ x: 727, y: 670, value: "♫", size: 24, weight: 800, fill: "#F2B85C", anchor: "middle" }));
  lines.push(text({ x: 763, y: 633, value: "NOW PLAYING", size: 8, weight: 820, fill: "#FFFFFF", opacity: 0.62, spacing: 1 }));
  lines.push(text({ x: 763, y: 659, value: "Family favourites", size: 16, weight: 780, fill: "#FFFFFF" }));
  lines.push(text({ x: 763, y: 681, value: config.media.players[0]?.name || "Living room", size: 10, weight: 650, fill: "#FFFFFF", opacity: 0.68 }));
  lines.push(text({ x: 105, y: 752, value: "Deterministic preview · privacy-safe sample content", size: 8, weight: 650, fill: "#FFFFFF", opacity: 0.44, spacing: 0.4 }));
  lines.push("</svg>");
  return lines.join("\n") + "\n";
}

function controlPanel(lines, x, y, width, height, titleValue, subtitleValue, accent, iconValue) {
  lines.push(warmRect(x, y, width, height, 26, "url(#fd-surface)", "#FFFFFF", 0.96, true));
  lines.push(warmCircle(x + 42, y + 43, 22, accent, "none", 1, 0.18));
  lines.push(text({ x: x + 42, y: y + 50, value: iconValue, size: 20, weight: 820, fill: accent, anchor: "middle" }));
  lines.push(text({ x: x + 76, y: y + 36, value: titleValue, size: 18, weight: 800, fill: "#202637" }));
  lines.push(text({ x: x + 76, y: y + 57, value: subtitleValue, size: 10, weight: 650, fill: "#74798A" }));
}

export function renderControlsPreview(input) {
  const config = validateConfig(structuredClone(input));
  const lines = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="768" viewBox="0 0 1024 768" role="img" aria-labelledby="title description">',
    '<title id="title">' + escapeXml(config.product.title) + " — warm-glass controls preview</title>",
    '<desc id="description">Lighting, heating, cameras and entry, and media controls in the approved warm-glass style.</desc>',
    '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}</style>',
    warmDefsSvg(),
    '<rect width="1024" height="768" fill="url(#fd-bg)"/>',
    warmCircle(900, 70, 155, "#F7B66E", "none", 1, 0.18)
  ];
  warmRail(lines, "home");
  warmHeader(lines, config, "Home controls", "Focused controls · large touch targets · details only when needed");

  controlPanel(lines, 101, 112, 438, 278, "Lighting", "Living room · 3 lights on", "#F2B85C", "☀");
  lines.push(text({ x: 129, y: 204, value: "LIVING ROOM", size: 9, weight: 820, fill: "#8A8E9D", spacing: 1 }));
  lines.push(text({ x: 129, y: 245, value: "68%", size: 34, weight: 840, fill: "#202637" }));
  lines.push(text({ x: 208, y: 242, value: "warm white", size: 11, weight: 650, fill: "#74798A" }));
  lines.push(warmLine(129, 284, 505, 284, "#D9D4D0", 12, 1));
  lines.push(warmLine(129, 284, 384, 284, "#F2B85C", 12, 1));
  lines.push(warmCircle(384, 284, 13, "#FFFFFF", "#F2B85C", 4));
  ["Relax", "Bright", "Movie"].forEach((labelValue, index) => {
    const x = 129 + index * 121;
    lines.push(warmRect(x, 321, 106, 42, 18, index === 0 ? "#F2B85C" : "#FFFFFF", "#F2B85C", index === 0 ? 1 : 0.72));
    lines.push(text({ x: x + 53, y: 347, value: labelValue, size: 10, weight: 760, fill: index === 0 ? "#FFFFFF" : "#8B6723", anchor: "middle" }));
  });

  controlPanel(lines, 558, 112, 440, 278, "Heating", "Main zone · scheduled until 18:30", "#EE6C62", "♨");
  lines.push(warmCircle(683, 273, 67, "#FBE4DF", "#EE6C62", 8));
  lines.push(text({ x: 683, y: 268, value: "20.5°", size: 31, weight: 840, fill: "#202637", anchor: "middle" }));
  lines.push(text({ x: 683, y: 292, value: "CURRENT", size: 8, weight: 820, fill: "#8A8E9D", anchor: "middle", spacing: 0.8 }));
  lines.push(text({ x: 812, y: 220, value: "TARGET", size: 9, weight: 820, fill: "#8A8E9D", spacing: 0.8 }));
  lines.push(text({ x: 812, y: 263, value: "21°", size: 35, weight: 840, fill: "#202637" }));
  lines.push(warmRect(812, 292, 146, 48, 20, "#EE6C62"));
  lines.push(text({ x: 885, y: 321, value: "+30 MIN BOOST", size: 9, weight: 820, fill: "#FFFFFF", anchor: "middle" }));

  controlPanel(lines, 101, 409, 438, 313, "Cameras & Entry", "Front doorbell live · garage closed", "#3FA99D", "◉");
  lines.push(warmRect(129, 493, 251, 141, 18, "url(#fd-navy)", "#FFFFFF", 0.96));
  lines.push(warmRect(154, 535, 140, 77, 3, "#5A6577", "#D7DEE9", 0.82));
  lines.push(warmRect(205, 559, 45, 53, 2, "#2B3548", "#FFFFFF", 0.80));
  lines.push(warmCircle(354, 512, 5, "#EE6C62"));
  lines.push(text({ x: 342, y: 516, value: "LIVE", size: 8, weight: 820, fill: "#FFFFFF", anchor: "end" }));
  lines.push(warmRect(397, 493, 114, 64, 20, "#DDF1ED", "#3FA99D", 0.96));
  lines.push(text({ x: 454, y: 519, value: "GARAGE", size: 8, weight: 820, fill: "#26877E", anchor: "middle", spacing: 0.8 }));
  lines.push(text({ x: 454, y: 542, value: "CLOSED", size: 13, weight: 820, fill: "#202637", anchor: "middle" }));
  lines.push(warmRect(397, 570, 114, 64, 20, "#17233A", "#FFFFFF", 0.96));
  lines.push(text({ x: 454, y: 596, value: "HOLD TO", size: 8, weight: 820, fill: "#FFFFFF", anchor: "middle", opacity: 0.64 }));
  lines.push(text({ x: 454, y: 618, value: "REVIEW OPEN", size: 10, weight: 820, fill: "#FFFFFF", anchor: "middle" }));
  lines.push(text({ x: 129, y: 675, value: "Check the live driveway view before confirming movement.", size: 10, weight: 650, fill: "#74798A" }));

  controlPanel(lines, 558, 409, 440, 313, "Media", "Kitchen · grouped with Living room", config.theme.accent, "♫");
  lines.push(warmRect(586, 494, 112, 112, 24, "url(#fd-coral)", "#FFFFFF", 0.98));
  lines.push(warmCircle(642, 550, 31, "#FFFFFF", "none", 1, 0.20));
  lines.push(text({ x: 642, y: 560, value: "♫", size: 28, weight: 820, fill: "#FFFFFF", anchor: "middle" }));
  lines.push(text({ x: 724, y: 518, value: "Family favourites", size: 17, weight: 800, fill: "#202637" }));
  lines.push(text({ x: 724, y: 542, value: "Kitchen + Living room", size: 10, weight: 650, fill: "#74798A" }));
  lines.push(text({ x: 724, y: 580, value: "◀     ▶     ▶▶", size: 20, weight: 800, fill: config.theme.accent }));
  lines.push(warmLine(586, 641, 962, 641, "#D9D4D0", 10));
  lines.push(warmLine(586, 641, 828, 641, config.theme.accent, 10));
  lines.push(warmCircle(828, 641, 12, "#FFFFFF", config.theme.accent, 4));
  lines.push(text({ x: 586, y: 680, value: "QUEUE", size: 9, weight: 820, fill: "#74798A", spacing: 0.9 }));
  lines.push(text({ x: 962, y: 680, value: "BROWSE MUSIC", size: 9, weight: 820, fill: config.theme.accent, anchor: "end", spacing: 0.9 }));
  lines.push(text({ x: 105, y: 752, value: "Deterministic preview · camera scene is illustrative", size: 8, weight: 650, fill: "#FFFFFF", opacity: 0.44, spacing: 0.4 }));
  lines.push("</svg>");
  return lines.join("\n") + "\n";
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath, controlsOutputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("usage: node preview/render-preview.mjs <input.json> <output.svg>");
  }
  const config = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderPreview(config), "utf8");
  const outputs = [output];
  if (controlsOutputPath) {
    const controlsOutput = resolve(controlsOutputPath);
    await mkdir(dirname(controlsOutput), { recursive: true });
    await writeFile(controlsOutput, renderControlsPreview(config), "utf8");
    outputs.push(controlsOutput);
  }
  process.stdout.write(`${outputs.join("\n")}\n`);
}
