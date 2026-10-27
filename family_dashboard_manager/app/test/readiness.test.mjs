import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { FamilyHubCard, familyReadiness, preparationDescription, extractPreparationItems } from "../frontend/family-hub-card.js";
import { packedLunchEvents, parsePreparationDescription, withPreparationOwner } from "../frontend/readiness.js";
import { refreshPreparation, startPreparationPolling } from "../src/preparation-provider.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json",import.meta.url),"utf8"));
function fixture() {
  const config = structuredClone(example);
  config.calendar.preparation.automatic_lunch = true;
  config.school.lunch_menus = [{person_id:"child_one",status:"published",start_date:"2026-11-02",end_date:"2026-12-19",week_one_date:"2026-11-02",weeks:Array.from({length:3},()=>Array.from({length:5},()=>({mains:["Main meal"],sides:[]}))),packed_lunch_days:[{week:2,weekday:2}]}];
  return config;
}
const evening = new Date("2026-11-09T19:30:00Z"), morning = new Date("2026-11-10T07:15:00Z");
function lunchItem(config) {
  const event = packedLunchEvents(config,["2026-11-10"])[0];
  return {uid:"lunch",summary:"Pack lunch box",status:"needs_action",description:preparationDescription(event,"child_one","packed_lunch",{source:"packed_lunch",dueDate:"2026-11-10"})};
}

test("tomorrow's shared lunch identity and progress carry into the school morning",()=>{
  const config = fixture(), item = lunchItem(config);
  item.status = "completed";
  item.description = withPreparationOwner(item.description,"parent");
  const before = familyReadiness(config,extractPreparationItems({items:[item]}),[],[],evening);
  const after = familyReadiness(config,extractPreparationItems({items:[item]}),[],[],morning);
  assert.equal(before.day,after.day);
  assert.equal(before.total,1);
  assert.equal(after.complete,1);
  assert.equal(after.rows[0].ownerId,"parent");
  assert.equal(after.rows[0].id,"lunch");
  assert.equal(familyReadiness(config,[],[],[],morning,"child_two").total,0);
  assert.equal(familyReadiness(config,[],[],[],morning,"parent").rows[0].kind,"waiting");
});

test("school preparation uses existing reading marks and finished-at-home homework",()=>{
  const config = fixture();
  const children = [{id:"child_one",routines:[{id:"reading",kind:"reading",due:"2026-11-10",marks:{record_written:true,adult_signed:true,books_ready:true}}],plans:[{id:"work",title:"Science sheet",due:"2026-11-10",marks:{finished:true}}]}];
  const model = familyReadiness(config,[],[],children,evening);
  assert.deepEqual(model.rows.map(row=>[row.kind,row.completed]),[["waiting",false],["record",true],["plan",true]]);
  children[0].paused_until = "2026-11-10";
  assert.equal(familyReadiness(config,[],[],children,evening).total,1);
  config.school.lunch_menus[0].closed_dates = ["2026-11-10"];
  assert.equal(familyReadiness(config,[],[],children,evening).total,0);
  assert.equal(familyReadiness(config,[],[],[],new Date("2027-01-05T19:00:00Z")).total,0);
});

test("two children's packed lunches have separate identities and no duplicate waiting rows",async()=>{
  const config=fixture();
  config.school.lunch_menus.push({...structuredClone(config.school.lunch_menus[0]),person_id:"child_two"});
  const events=packedLunchEvents(config,["2026-11-10"]);
  const ha=backend();
  await refreshPreparation(config,{now:evening,token:"test-supervisor-token",fetchImpl:ha.fetchImpl});
  const rows=familyReadiness(config,extractPreparationItems({items:ha.items}),[],[],evening).rows;
  assert.equal(rows.length,2);
  assert.ok(rows.every(row=>row.kind==="prep"));
  assert.notEqual(parsePreparationDescription(ha.items[0].description).eventKey,parsePreparationDescription(ha.items[1].description).eventKey);
  assert.equal(events.length,2);
});

test("owner updates preserve metadata, completion and reject unconfigured owners",async()=>{
  const card = Object.create(FamilyHubCard.prototype);
  card._config = fixture();
  card._preparationItems = extractPreparationItems({items:[lunchItem(card._config)]});
  card._scheduleRender = ()=>{};
  card._loadPreparationItems = async()=>{card._preparationItems[0].status="completed";return true;};
  const calls=[];
  card._callPlannerAction = async(...args)=>calls.push(args);
  await card._assignPreparationOwner("lunch","parent");
  assert.equal(calls.length,1);
  assert.deepEqual(Object.keys(calls[0][3]),["item","description"]);
  assert.equal(card._preparationItems[0].status,"completed");
  const meta=parsePreparationDescription(calls[0][3].description);
  assert.equal(meta.ownerId,"parent");
  assert.equal(meta.source,"packed_lunch");
  assert.equal(meta.dueDate,"2026-11-10");
  assert.equal(parsePreparationDescription(withPreparationOwner(calls[0][3].description,"")).ownerId,undefined);
  await card._assignPreparationOwner("lunch","child_one");
  card._config.display.read_only=true;
  await card._assignPreparationOwner("lunch","parent_two");
  assert.equal(calls.length,1);
  card._config.display.read_only=false;
  card._loadPreparationItems=async()=>false;
  await card._assignPreparationOwner("lunch","parent_two");
  assert.match(card._preparationError,/could not be checked/);
  assert.equal(calls.length,1);
});

function backend(items=[]) {
  const calls=[];
  const fetchImpl=async(url,options)=>{
    const body=JSON.parse(options.body);calls.push({url,body});
    if(url.includes("get_items"))return {ok:true,json:async()=>({service_response:{"todo.family_prep":{items:structuredClone(items)}}})};
    if(url.includes("add_item"))items.push({uid:`created-${items.length}`,summary:body.item,description:body.description,status:"needs_action"});
    if(url.includes("remove_item")){const i=items.findIndex(item=>item.uid===body.item);if(i>=0)items.splice(i,1);}
    return {ok:true,json:async()=>[]};
  };
  return {items,calls,fetchImpl};
}

test("one central refresh creates a dated lunch once and preserves completed work and owners",async()=>{
  const config=fixture(), ha=backend();
  const options={now:evening,token:"test-supervisor-token",fetchImpl:ha.fetchImpl};
  await refreshPreparation(config,options);
  assert.equal(ha.items.length,1);
  ha.items[0].status="completed";
  ha.items[0].description=withPreparationOwner(ha.items[0].description,"parent");
  await refreshPreparation(config,{...options,now:morning});
  assert.equal(ha.items.length,1);
  assert.equal(ha.calls.filter(call=>call.url.includes("add_item")).length,1);
  assert.equal(ha.items[0].status,"completed");
  assert.equal(parsePreparationDescription(ha.items[0].description).ownerId,"parent");
  assert.ok(ha.calls.filter(call=>call.url.includes("services/todo")).every(call=>call.body.entity_id===config.calendar.preparation.todo_entity));
});

test("a menu correction withdraws only a current automatic task, and read-only mode writes nothing",async()=>{
  const config=fixture(), ordinary={uid:"ordinary",summary:"Water bottle",description:preparationDescription({summary:"School trip",start:{date:"2026-11-10"}},"child_one","school_trip")};
  const ha=backend([lunchItem(config),ordinary]);
  config.school.lunch_menus[0].closed_dates=["2026-11-10"];
  const options={now:evening,token:"test-supervisor-token",fetchImpl:ha.fetchImpl};
  await refreshPreparation(config,options);
  assert.deepEqual(ha.items.map(item=>item.uid),["ordinary"]);
  config.display.read_only=true;
  const count=ha.calls.length;
  assert.deepEqual(await refreshPreparation(config,options),{skipped:true});
  assert.equal(ha.calls.length,count);
});

test("failed reads never create tasks and polling waits for each refresh before scheduling another",async()=>{
  const config=fixture(),calls=[];
  await assert.rejects(refreshPreparation(config,{now:evening,token:"test-supervisor-token",fetchImpl:async(url)=>{calls.push(url);return {ok:false};}}),/could not be refreshed/);
  assert.equal(calls.filter(url=>url.includes("add_item")).length,0);
  let next,finish,refreshes=0;
  const stop=startPreparationPolling({store:{readHouseholdConfig:async()=>config},setTimeoutImpl:fn=>{next=fn;return 1;},clearTimeoutImpl:()=>{},refresh:async()=>{refreshes++;await new Promise(resolve=>finish=resolve);}});
  const first=next();next=null;
  await Promise.resolve();
  assert.equal(refreshes,1);assert.equal(next,null);
  finish();await first;assert.equal(typeof next,"function");
  stop();
});
