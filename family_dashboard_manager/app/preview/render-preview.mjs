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

export function renderPreview(input) {
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

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath] = process.argv;
  if (!inputPath || !outputPath) {
    throw new Error("usage: node preview/render-preview.mjs <input.json> <output.svg>");
  }
  const config = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderPreview(config), "utf8");
  process.stdout.write(`${output}\n`);
}
