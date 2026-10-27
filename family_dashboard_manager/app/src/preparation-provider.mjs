// The Manager alone creates menu-derived tasks. A single serial loop prevents
// two tablets racing to create the same dated packed-lunch task.
import {
  readinessDateKey, shiftReadinessDate, packedLunchEvents, packedLunchEvent,
  familyPlannerEventKey, preparationDescription, extractPreparationItems
} from "../frontend/readiness.js";

const BASE_URL = "http://supervisor/core/api";
const STATUS_ENTITY = "sensor.family_dashboard_preparation";
export const PREPARATION_POLL_MS = 60_000;

export async function refreshPreparation(config, {
  now = new Date(), token = process.env.SUPERVISOR_TOKEN,
  baseUrl = process.env.HOME_ASSISTANT_REST_URL || BASE_URL,
  fetchImpl = globalThis.fetch, stopped = () => false
} = {}) {
  const prep = config?.calendar?.preparation;
  if (config?.display?.read_only || !config?.features?.calendar || !prep?.enabled || !prep.automatic_lunch) return { skipped:true };
  if (!/^todo\.[a-z0-9_]+$/.test(prep.todo_entity) || typeof token !== "string" || token.length < 10) throw new Error("Shared preparation connection is unavailable");
  const request = async (path, payload) => {
    if (stopped()) throw new Error("Preparation refresh stopped");
    const response = await fetchImpl(`${baseUrl}/${path}`, {
      method:"POST", headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
      body:JSON.stringify(payload), signal:AbortSignal.timeout(10_000)
    });
    if (!response.ok) throw new Error("The shared preparation list could not be refreshed");
    return response.json();
  };
  const todo = (service, data={}) => request(`services/todo/${service}${service === "get_items" ? "?return_response" : ""}`, {entity_id:prep.todo_entity,...data});
  try {
    const today = readinessDateKey(now,config.product.timezone), tomorrow = shiftReadinessDate(today,1);
    const desired = packedLunchEvents(config,[today,tomorrow]);
    const result = await todo("get_items");
    const returned = (result?.service_response || result)?.[prep.todo_entity]?.items;
    if (!Array.isArray(returned)) throw new Error("The shared preparation list returned no items response");
    const items = extractPreparationItems({items:returned});
    const expected = new Set(desired.map(event=>familyPlannerEventKey(event)));
    // Only this provider's current, dated tasks can be withdrawn after a menu
    // correction. Ordinary preparation and old records are never removed.
    for (const item of items) {
      const meta = item._preparation;
      if (meta.source === "packed_lunch" && meta.templateId === "packed_lunch"
          && config.people.some(person=>person.role === "child" && person.id === meta.personId)
          && [today,tomorrow].includes(meta.dueDate)
          && meta.eventKey === familyPlannerEventKey(packedLunchEvent(meta.personId,meta.dueDate))
          && !expected.has(meta.eventKey) && (item.uid || item.id)) {
        await todo("remove_item",{item:item.uid || item.id});
      }
    }
    for (const event of desired) {
      const personId = event._calendar.person_ids[0], key = familyPlannerEventKey(event);
      if (items.some(item=>item._preparation.eventKey === key && item._preparation.personId === personId)) continue;
      await todo("add_item", {
        item:"Pack lunch box", due_date:event.start.date,
        description:preparationDescription(event,personId,"packed_lunch",{source:"packed_lunch",dueDate:event.start.date})
      });
    }
    await request(`states/${STATUS_ENTITY}`, {state:"ready",attributes:{friendly_name:"Shared preparation",last_successful_update:now.toISOString()}});
    return { skipped:false, tasks:desired.length };
  } catch (error) {
    if (!stopped()) {
      await request(`states/${STATUS_ENTITY}`, {state:"unavailable",attributes:{friendly_name:"Shared preparation"}}).catch(()=>{});
    }
    throw error;
  }
}

export function startPreparationPolling({store, refresh = refreshPreparation, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout} = {}) {
  let stopped = false, timer;
  const run = async () => {
    try {
      const config = await store.readHouseholdConfig();
      if (!stopped && !store.requireReadOnly) await refresh(config,{stopped:()=>stopped});
    } catch {
      // No task descriptions, entity data or credentials enter manager logs.
    } finally {
      if (!stopped) { timer = setTimeoutImpl(run,PREPARATION_POLL_MS); timer?.unref?.(); }
    }
  };
  timer = setTimeoutImpl(run,0);
  timer?.unref?.();
  return () => { stopped = true; clearTimeoutImpl(timer); };
}
