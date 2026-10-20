const ENDPOINT = "family_dashboard_homework/admin";

export async function homeworkAdmin(body, options = {}) {
  return integrationAdmin(ENDPOINT, body, options);
}

export async function integrationAdmin(endpoint, body, {
  token = process.env.SUPERVISOR_TOKEN,
  baseUrl = process.env.HOME_ASSISTANT_REST_URL || "http://supervisor/core/api",
  fetchImpl = globalThis.fetch
} = {}) {
  if (![ENDPOINT, "family_dashboard_departures/admin"].includes(endpoint)) throw new Error("Unknown shared integration endpoint");
  if (typeof token !== "string" || token.length < 10) throw new Error("Home Assistant connection is unavailable");
  const response = await fetchImpl(`${baseUrl}/${endpoint}`, {
    method: body ? "POST" : "GET",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000)
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Check the shared Family Dashboard integration in Home Assistant");
  return payload;
}
