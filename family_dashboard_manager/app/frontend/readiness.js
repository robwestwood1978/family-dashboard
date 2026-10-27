// Shared, DOM-free school and preparation rules. Browser and Manager use the same dates and identities.
function calendarEventStart(event) {
  if (typeof event?.start === "string") return event.start;
  return event?.start?.dateTime || event?.start?.date || event?.start_time || null;
}
export function readinessDateKey(value, timeZone = "Europe/London") {
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {year:"numeric",month:"2-digit",day:"2-digit",timeZone}).formatToParts(date).filter(part=>part.type!=="literal").map(part=>[part.type,part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function shiftReadinessDate(day, amount) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0,10);
}
function mondayForDateKey(day) {
  return shiftReadinessDate(day, 1 - (new Date(`${day}T12:00:00Z`).getUTCDay() || 7));
}
const dateKey = readinessDateKey;
const shiftDateKey = shiftReadinessDate;
const PREPARATION_MARKER = "Family Dashboard preparation";

function preparationHash(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function familyPlannerEventKey(event = {}) {
  const calendarEntity = event?._calendar?.entity_id || event.calendar_entity_id || "calendar.unknown";
  const start = String(calendarEventStart(event) || "unknown").slice(0, 16);
  const summary = String(event.summary || event.message || "Event").trim().toLocaleLowerCase();
  return `fd-${preparationHash(`${calendarEntity}|${start}|${summary}`)}`;
}


export function preparationDescription(event, personId, templateId, metadata = {}) {
  return [
    PREPARATION_MARKER,
    `Event: ${familyPlannerEventKey(event)}`,
    `Person: ${personId}`,
    `Template: ${templateId}`,
    ...(metadata.source ? [`Source: ${metadata.source}`] : []),
    ...(metadata.dueDate ? [`Date: ${metadata.dueDate}`] : [])
  ].join("\n");
}

export function parsePreparationDescription(description = "") {
  const lines = String(description || "").split(/\r?\n/).map((line) => line.trim());
  if (lines[0] !== PREPARATION_MARKER) return null;
  const fields = Object.fromEntries(lines.slice(1).map((line) => {
    const separator = line.indexOf(":");
    return separator > 0 ? [line.slice(0, separator).trim().toLocaleLowerCase(), line.slice(separator + 1).trim()] : ["", ""];
  }).filter(([key, value]) => key && value));
  return fields.event && fields.person
    ? { eventKey: fields.event, personId: fields.person, templateId: fields.template || "custom",
        ...(fields.owner ? { ownerId: fields.owner } : {}),
        ...(fields.source ? { source: fields.source } : {}),
        ...(fields.date ? { dueDate: fields.date } : {}) }
    : null;
}

export function extractPreparationItems(response = {}) {
  const candidates = [
    response?.items,
    response?.response?.items,
    ...Object.values(response?.response || {}).map((entry) => entry?.items),
    ...Object.values(response || {}).map((entry) => entry?.items)
  ];
  const items = candidates.find(Array.isArray) || [];
  return items.map((item) => ({
    ...item,
    _preparation: parsePreparationDescription(item.description)
  })).filter((item) => item._preparation);
}


// Rotation uses calendar dates, rather than elapsed local hours, across DST.
export function schoolLunchForDate(config, personId, value = new Date()) {
  const menu = config.school?.lunch_menus?.find(entry => entry.person_id === personId);
  const day = dateKey(value, config.product?.timezone || "Europe/London");
  if (!menu || menu.status === "pending") return { status: "pending", day, title: "New menu coming soon" };
  if (day < menu.start_date) return { status: "upcoming", day, title: "Menu starts soon", start: menu.start_date };
  if (day > menu.end_date) return { status: "ended", day, title: "Term menu finished" };
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  if (weekday === 0 || weekday === 6 || menu.closed_dates?.includes(day)) return { status: "closed", day, title: "No school lunch today" };
  const elapsed = Math.round((Date.parse(`${mondayForDateKey(day)}T12:00:00Z`) - Date.parse(`${menu.week_one_date}T12:00:00Z`)) / 604800000);
  const week = ((elapsed % menu.weeks.length) + menu.weeks.length) % menu.weeks.length + 1;
  if (menu.packed_lunch_days?.some(rule => rule.week === week && rule.weekday === weekday)) return { status: "packed", day, week, title: "Packed lunch today" };
  const meal = menu.weeks[week - 1][weekday - 1];
  return { status: "meal", day, week, title: meal.mains[0], alternatives: meal.mains.slice(1), sides: meal.sides || [], dessert: meal.dessert || "" };
}


// Owner is viewing-independent household responsibility, not the signed-in HA account.
export function withPreparationOwner(description, ownerId) {
  if (!parsePreparationDescription(description)) throw new Error("This is not a Family preparation item");
  const lines = String(description).split(/\r?\n/).filter(line=>!/^owner\s*:/i.test(line.trim()));
  if (ownerId) lines.push(`Owner: ${ownerId}`);
  return lines.join("\n");
}
export function packedLunchEvents(config, days) {
  return days.flatMap(day => (config.people || []).filter(person=>person.role === "child" && schoolLunchForDate(config,person.id,day).status === "packed").map(person=>packedLunchEvent(person.id,day)));
}
export function packedLunchEvent(personId, day) {
  return {
    summary:"Packed lunch", start:{date:day}, end:{date:shiftReadinessDate(day,1)},
    _calendar:{entity_id:`calendar.family_dashboard_lunch_${personId}`,person_ids:[personId]},
    _packedLunch:true
  };
}
