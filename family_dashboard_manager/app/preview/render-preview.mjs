import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateConfig } from "../src/validate-config.mjs";

const VIEW_LABELS = ["Today", "Calendar", "Rooms", "Family", "Music", "Football"];

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function text(x, y, value, { size = 14, weight = 600, fill = "currentColor", anchor = "start", opacity = 1, spacing = 0 } = {}) {
  return `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" opacity="${opacity}" letter-spacing="${spacing}">${escapeXml(value)}</text>`;
}

function rect(x, y, width, height, radius, fill, { stroke = "none", opacity = 1, shadow = false } = {}) {
  const element = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${fill}" stroke="${stroke}" opacity="${opacity}"/>`;
  if (!shadow) return element;
  return `<rect x="${x}" y="${y + 8}" width="${width}" height="${height}" rx="${radius}" fill="#12182B" opacity="0.16"/>${element}`;
}

function circle(cx, cy, radius, fill, { stroke = "none", width = 1, opacity = 1 } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}"/>`;
}

function defs(config) {
  return `<defs>
    <linearGradient id="backdrop" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${config.theme.backdrop_start}"/><stop offset="0.48" stop-color="${config.theme.backdrop_mid}"/><stop offset="1" stop-color="${config.theme.backdrop_end}"/></linearGradient>
    <linearGradient id="hero" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${config.theme.accent}"/><stop offset="1" stop-color="${config.theme.backdrop_end}"/></linearGradient>
  </defs>`;
}

function frame(config, titleValue, subtitleValue, activeView) {
  const width = config.display.target_width;
  const height = config.display.target_height;
  const lines = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" color="${config.theme.text}" role="img" aria-labelledby="title description">`,
    `<title id="title">${escapeXml(config.product.title)} — ${escapeXml(titleValue)} preview</title>`,
    `<desc id="description">First-party Family Hub layout sized for the 10.5-inch iPad Pro.</desc>`,
    '<style>text{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}</style>',
    defs(config),
    rect(0, 0, width, height, 0, "url(#backdrop)"),
    rect(0, 0, 86, height, 0, config.theme.nav_background, { opacity: 0.96 }),
    circle(43, 48, 26, "#FFFFFF", { opacity: 0.14, stroke: "#FFFFFF", width: 1 }),
    text(43, 55, "⌂", { size: 24, weight: 800, fill: "#FFFFFF", anchor: "middle" })
  ];
  VIEW_LABELS.forEach((label, index) => {
    const y = 105 + index * 94;
    const active = label.toLowerCase() === activeView;
    if (active) lines.push(rect(9, y - 28, 68, 72, 21, "url(#hero)", { stroke: "#FFFFFF", shadow: true }));
    lines.push(circle(43, y - 4, 9, active ? "#FFFFFF" : config.theme.muted, { opacity: active ? 1 : 0.65 }));
    lines.push(text(43, y + 27, label, { size: 10, weight: 700, fill: active ? "#FFFFFF" : "#D8DCE6", anchor: "middle" }));
  });
  lines.push(
    text(112, 47, titleValue, { size: 30, weight: 800, fill: "#FFFFFF" }),
    text(113, 72, subtitleValue, { size: 12, weight: 650, fill: "#FFFFFF", opacity: 0.72 }),
    rect(width - 246, 22, 220, 54, 18, "#FFFFFF", { opacity: 0.14, stroke: "#FFFFFF" }),
    text(width - 220, 54, "☀", { size: 21, weight: 800, fill: "#FFD36A" }),
    text(width - 188, 54, "19° · Partly cloudy", { size: 12, weight: 700, fill: "#FFFFFF" })
  );
  return lines;
}

function panel(lines, x, y, width, height, config, { hero = false } = {}) {
  lines.push(rect(x, y, width, height, config.theme.radius_px, hero ? "url(#hero)" : config.theme.surface, {
    opacity: hero ? 0.98 : 0.95,
    stroke: "#FFFFFF",
    shadow: true
  }));
}

export function renderPreview(input) {
  const config = validateConfig(structuredClone(input));
  const children = config.people.filter((person) => person.role === "child");
  const lines = frame(config, "Today", "Monday, 10 August · the family at a glance", "today");
  panel(lines, 108, 100, 618, 260, config, { hero: true });
  lines.push(
    text(136, 136, "AT HOME", { size: 10, weight: 800, fill: "#FFFFFF", opacity: 0.72, spacing: 1.3 }),
    text(136, 182, "2 lights on", { size: 34, weight: 830, fill: "#FFFFFF" }),
    text(136, 211, "Everything else looks settled", { size: 13, weight: 650, fill: "#FFFFFF", opacity: 0.78 })
  );
  [["19.6°", "Average temperature"], [String(config.rooms.length), "Connected rooms"], ["Playing", "Living room"]].forEach((entry, index) => {
    const x = 136 + index * 184;
    lines.push(rect(x, 251, 166, 78, 17, "#FFFFFF", { opacity: 0.13, stroke: "#FFFFFF" }));
    lines.push(text(x + 16, 282, entry[0], { size: 18, weight: 800, fill: "#FFFFFF" }));
    lines.push(text(x + 16, 307, entry[1], { size: 9, weight: 650, fill: "#FFFFFF", opacity: 0.72 }));
  });

  panel(lines, 744, 100, 342, 260, config);
  lines.push(
    text(770, 136, "UP NEXT", { size: 10, weight: 800, fill: config.theme.muted, spacing: 1.2 }),
    text(770, 182, "Family dinner", { size: 24, weight: 820 }),
    text(770, 211, "Today · 18:00", { size: 12, weight: 650, fill: config.theme.muted }),
    rect(770, 292, 156, 38, 14, config.theme.accent, { opacity: 0.1 }),
    text(848, 316, "OPEN CALENDAR", { size: 9, weight: 800, fill: config.theme.accent, anchor: "middle", spacing: 0.7 })
  );

  panel(lines, 108, 380, 310, 410, config);
  lines.push(text(134, 416, "CHILDREN", { size: 10, weight: 800, fill: config.theme.muted, spacing: 1.2 }), text(134, 447, "School & chores", { size: 21, weight: 820 }));
  children.slice(0, 2).forEach((person, index) => {
    const y = 482 + index * 111;
    lines.push(rect(132, y, 262, 89, 18, person.colour, { opacity: 0.09 }));
    lines.push(circle(166, y + 44, 22, person.colour));
    lines.push(text(166, y + 51, person.name.slice(0, 1), { size: 18, weight: 820, fill: "#FFFFFF", anchor: "middle" }));
    lines.push(text(200, y + 35, person.name, { size: 14, weight: 800 }));
    lines.push(text(200, y + 58, `${index + 1} chore${index ? "s" : ""} · 1 assignment`, { size: 10, weight: 650, fill: config.theme.muted }));
    lines.push(text(375, y + 49, `${index ? 37 : 42} pts`, { size: 10, weight: 800, fill: person.colour, anchor: "end" }));
  });

  panel(lines, 438, 380, 330, 410, config);
  lines.push(text(464, 416, "PREMIER LEAGUE", { size: 10, weight: 800, fill: config.theme.muted, spacing: 1.1 }), text(464, 447, "Featured clubs", { size: 21, weight: 820 }));
  [["TOT", "15:00", "BUR"], ["AVL", "17:30", "NEW"]].forEach((fixture, index) => {
    const y = 488 + index * 96;
    lines.push(rect(462, y, 282, 76, 17, config.theme.accent, { opacity: 0.07, stroke: config.theme.accent }));
    lines.push(text(487, y + 34, fixture[0], { size: 14, weight: 820 }));
    lines.push(text(603, y + 34, fixture[1], { size: 13, weight: 820, fill: config.theme.accent, anchor: "middle" }));
    lines.push(text(719, y + 34, fixture[2], { size: 14, weight: 820, anchor: "end" }));
    lines.push(text(603, y + 58, index ? "Aston Villa spotlight" : "Tottenham spotlight", { size: 9, weight: 650, fill: config.theme.muted, anchor: "middle" }));
  });
  lines.push(text(464, 704, "All 38 matchweeks · fixtures, results and table", { size: 10, weight: 650, fill: config.theme.muted }));

  panel(lines, 788, 380, 298, 410, config);
  lines.push(text(814, 416, "NOW PLAYING", { size: 10, weight: 800, fill: config.theme.muted, spacing: 1.1 }), rect(814, 460, 92, 92, 22, "url(#hero)"), text(860, 517, "♫", { size: 34, weight: 800, fill: "#FFFFFF", anchor: "middle" }), text(926, 487, "Family favourites", { size: 15, weight: 800 }), text(926, 511, "Living room", { size: 10, weight: 650, fill: config.theme.muted }), circle(951, 605, 32, config.theme.accent), text(951, 614, "▶", { size: 20, weight: 800, fill: "#FFFFFF", anchor: "middle" }), text(937, 699, "Browse, group and play", { size: 10, weight: 700, fill: config.theme.accent, anchor: "middle" }));
  lines.push(text(110, 818, "Synthetic preview · 1112 × 834 iPad Pro target", { size: 8, weight: 650, fill: "#FFFFFF", opacity: 0.46 }), "</svg>");
  return `${lines.join("\n")}\n`;
}

function scaledPoints(points, x, y, width, height) {
  return points.map(([px, py]) => `${(x + (px / 100) * width).toFixed(1)},${(y + (py / 100) * height).toFixed(1)}`).join(" ");
}

function centroid(points, x, y, width, height) {
  const average = points.reduce((sum, [px, py]) => [sum[0] + px, sum[1] + py], [0, 0]).map((value) => value / points.length);
  return [x + (average[0] / 100) * width, y + (average[1] / 100) * height];
}

export function renderControlsPreview(input) {
  const config = validateConfig(structuredClone(input));
  const floor = config.floorplan.floors.find((entry) => entry.id === config.floorplan.default_floor) || config.floorplan.floors[0];
  const selectedRoomId = floor.room_hotspots[0]?.room_id;
  const selectedRoom = config.rooms.find((room) => room.id === selectedRoomId) || config.rooms[0];
  const lines = frame(config, "Rooms", "Interactive house · tap a room to control it", "rooms");
  panel(lines, 108, 100, 680, 690, config);
  lines.push(text(136, 137, "INTERACTIVE HOUSE", { size: 10, weight: 800, fill: config.theme.muted, spacing: 1.2 }), text(136, 168, "Tap a room to control it", { size: 22, weight: 820 }));
  config.floorplan.floors.forEach((entry, index) => {
    const x = 588 + index * 88;
    const active = entry.id === floor.id;
    lines.push(rect(x, 128, 80, 34, 12, active ? config.theme.accent : "#151D32", { stroke: active ? config.theme.accent : "#FFFFFF", opacity: active ? 1 : 0.82 }));
    lines.push(text(x + 40, 150, entry.name.replace(" floor", ""), { size: 9, weight: 800, fill: active ? "#FFFFFF" : config.theme.muted, anchor: "middle" }));
  });
  lines.push(rect(132, 195, 632, 548, 22, "#11182B", { stroke: "#FFFFFF", opacity: 0.94 }));
  lines.push(rect(156, 219, 584, 500, 8, "#1A233A", { stroke: "#75819A" }));
  lines.push(rect(254, 275, 300, 250, 100, "#F9D56E", { opacity: 0.22 }));
  floor.room_hotspots.forEach((hotspot) => {
    const room = config.rooms.find((entry) => entry.id === hotspot.room_id);
    if (!room) return;
    const selected = room.id === selectedRoom.id;
    const [cx, cy] = centroid(hotspot.points, 156, 219, 584, 500);
    lines.push(`<polygon points="${scaledPoints(hotspot.points, 156, 219, 584, 500)}" fill="${selected ? config.theme.accent : "#FFFFFF"}" fill-opacity="${selected ? 0.16 : 0.035}" stroke="${selected ? config.theme.accent : "#6E7787"}" stroke-width="${selected ? 3 : 1.5}"/>`);
    lines.push(text(cx, cy - 2, room.name, { size: 13, weight: 820, anchor: "middle" }));
    lines.push(text(cx, cy + 18, room.lights.length ? `${selected ? 1 : 0}/${room.lights.length} lights · ${selected ? "20.4°" : "19.2°"}` : "Open room", { size: 8, weight: 650, fill: config.theme.muted, anchor: "middle" }));
  });
  lines.push(rect(156, 694, 378, 28, 10, "#11182B", { opacity: 0.9, stroke: "#FFFFFF" }), text(345, 713, "Illustrative geometry — replace with the private house plan", { size: 8, weight: 750, fill: config.theme.muted, anchor: "middle" }));

  panel(lines, 806, 100, 280, 690, config);
  lines.push(circle(844, 146, 24, config.theme.accent, { opacity: 0.12 }), text(844, 154, "⌂", { size: 20, weight: 800, fill: config.theme.accent, anchor: "middle" }), text(880, 135, "ROOM CONTROLS", { size: 9, weight: 800, fill: config.theme.muted, spacing: 1 }), text(880, 162, selectedRoom.name, { size: 21, weight: 820 }), text(830, 204, "1 light on · 20.4°", { size: 10, weight: 650, fill: config.theme.muted }));
  lines.push(rect(830, 230, 232, 108, 18, "#171F34", { stroke: "#FFFFFF", opacity: 0.92 }), text(850, 257, "TEMPERATURE", { size: 9, weight: 800, fill: config.theme.muted }), text(850, 304, "20.4°", { size: 32, weight: 830 }), text(962, 277, "−", { size: 20, weight: 800, fill: config.theme.accent, anchor: "middle" }), text(1030, 277, "+", { size: 20, weight: 800, fill: config.theme.accent, anchor: "middle" }));
  lines.push(rect(830, 356, 232, 66, 17, "#2B2638", { stroke: "#F2B85C" }), circle(858, 389, 13, "#F2B85C"), text(887, 384, "Living room", { size: 12, weight: 800 }), text(887, 404, "72% · warm", { size: 9, weight: 650, fill: config.theme.muted }));
  lines.push(text(830, 461, "SCENES", { size: 9, weight: 800, fill: config.theme.muted, spacing: 1 }), rect(830, 478, 102, 42, 14, config.theme.accent, { opacity: 0.11 }), text(881, 504, "Relax", { size: 10, weight: 800, fill: config.theme.accent, anchor: "middle" }), rect(944, 478, 118, 42, 14, config.theme.accent, { opacity: 0.11 }), text(1003, 504, "Movie", { size: 10, weight: 800, fill: config.theme.accent, anchor: "middle" }));
  lines.push(text(830, 563, "MUSIC", { size: 9, weight: 800, fill: config.theme.muted, spacing: 1 }), rect(830, 580, 232, 72, 17, "#171F34", { stroke: "#FFFFFF", opacity: 0.92 }), circle(860, 616, 20, config.theme.accent), text(860, 623, "▶", { size: 13, weight: 800, fill: "#FFFFFF", anchor: "middle" }), text(892, 610, "Living room", { size: 12, weight: 800 }), text(892, 630, "Family favourites", { size: 9, weight: 650, fill: config.theme.muted }));
  lines.push(rect(830, 699, 232, 52, 16, config.theme.nav_background), text(946, 731, "LOW-RISK CONTROLS ONLY", { size: 9, weight: 800, fill: "#FFFFFF", anchor: "middle", spacing: 0.7 }), text(110, 818, "Synthetic preview · actual room geometry is never inferred", { size: 8, weight: 650, fill: "#FFFFFF", opacity: 0.46 }), "</svg>");
  return `${lines.join("\n")}\n`;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const [, , inputPath, outputPath, roomsOutputPath] = process.argv;
  if (!inputPath || !outputPath) throw new Error("usage: node preview/render-preview.mjs <input.json> <today.svg> [rooms.svg]");
  const config = JSON.parse(await readFile(resolve(inputPath), "utf8"));
  const output = resolve(outputPath);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, renderPreview(config), "utf8");
  const outputs = [output];
  if (roomsOutputPath) {
    const roomsOutput = resolve(roomsOutputPath);
    await mkdir(dirname(roomsOutput), { recursive: true });
    await writeFile(roomsOutput, renderControlsPreview(config), "utf8");
    outputs.push(roomsOutput);
  }
  process.stdout.write(`${outputs.join("\n")}\n`);
}
