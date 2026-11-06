import test from "node:test";
import assert from "node:assert/strict";
import { FamilyHubCard, familyReadiness } from "../frontend/family-hub-card.js";
import { homeworkHandInTasks } from "../frontend/readiness.js";

const due = "2026-11-06";
function child() {
  return {id:"child_one",name:"Child One",plans:[],routines:[{id:"child_one:maths:"+due,kind:"maths",title:"Hand in maths homework",due,marks:{}}]};
}
function cardFixture() {
  const card=Object.create(FamilyHubCard.prototype);
  card._config={product:{timezone:"Europe/London",locale:"en-GB"},display:{read_only:false,day_rhythm:{}},features:{chores:false},calendar:{preparation:{}},school:{homework_enabled:true},people:[{id:"child_one",name:"Child One",role:"child",colour:"#ee6c62"},{id:"child_two",name:"Child Two",role:"child"}]};
  card._homeworkData={today:due,children:[child()]};
  card._hass={states:{}};
  card._pendingChoreClaims=new Set();card._pendingPreparation=new Set();
  card._scheduleRender=()=>{};
  card._personPreparationGroups=()=>[];
  return card;
}
test("a regular maths hand-in remains tickable even when no maths sheet was added",()=>{
  const tasks=homeworkHandInTasks(child(),due);
  assert.equal(tasks.length,1);
  assert.equal(tasks[0].title,"Hand in maths homework");
  assert.equal(tasks[0].id,"child_one:maths:"+due);
  assert.equal(tasks[0].done,false);
});
test("a dated sheet replaces the generic routine and finished at home still needs a hand-in",()=>{
  const pupil=child();
  pupil.plans=[{id:"maths-plan",kind:"maths",title:"Number bonds",due,marks:{finished:true}}];
  assert.deepEqual(homeworkHandInTasks(pupil,due).map(row=>[row.id,row.done]),[["maths-plan",false]]);
  pupil.plans[0].marks.handed_in=true;
  assert.equal(homeworkHandInTasks(pupil,due)[0].done,true);
  const card=cardFixture();
  const ready=familyReadiness(card._config,[],[],[pupil],new Date(due+"T08:00:00Z"));
  assert.equal(ready.rows.length,0);
});
test("weekly hand-ins honour dates, holiday pauses and overdue dated work",()=>{
  const pupil=child();
  pupil.plans=[{id:"old",kind:"assignment",title:"Science",due:"2026-11-05",marks:{}},{id:"future",kind:"assignment",title:"Passport",due:"2026-11-10",marks:{}}];
  assert.equal(homeworkHandInTasks(pupil,due).length,1);
  assert.equal(homeworkHandInTasks(pupil,due,{includeOverdue:true}).length,2);
  pupil.plans[0].marks.handed_in=true;
  assert.equal(homeworkHandInTasks(pupil,due,{includeOverdue:true}).length,1);
  assert.equal(homeworkHandInTasks(pupil,"2026-11-10")[0].id,"future");
  pupil.paused_until=due;
  assert.equal(homeworkHandInTasks(pupil,due).length,0);
});
test("the child list renders a school hand-in with a checkbox and its own child identity",()=>{
  const card=cardFixture();
  card._taskListDay="tomorrow";
  // The list uses the live clock; use tomorrow relative to that clock for a stable render.
  const parts=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{year:"numeric",month:"2-digit",day:"2-digit",timeZone:"Europe/London"}).formatToParts(new Date()).filter(p=>p.type!=="literal").map(p=>[p.type,p.value]));
  const next=new Date(parts.year+"-"+parts.month+"-"+parts.day+"T12:00:00Z");next.setUTCDate(next.getUTCDate()+1);
  card._homeworkData.children[0].routines[0].due=next.toISOString().slice(0,10);
  const html=card._renderUnifiedTasks(card._config.people[0]);
  assert.match(html,/School hand-ins/);
  assert.match(html,/data-homework-hand-in="child_one:maths:2026-11-06"/);
  assert.match(html,/data-person-id="child_one"/);
  assert.match(html,/Mark handed in: Hand in maths homework/);
});
test("ticking a hand-in saves centrally for the right child, supports undo and suppresses double taps",async()=>{
  const card=cardFixture(),calls=[];
  card._familyPersonId="child_two";
  let resolve;
  card._homeworkRequest=message=>{calls.push(message);return new Promise(r=>resolve=r);};
  const target=card._homeworkData.children[0].routines[0].id;
  const save=card._toggleHomeworkHandIn("child_one",target,true);
  await card._toggleHomeworkHandIn("child_one",target,true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].payload.person_id,"child_one");
  assert.equal(calls[0].payload.field,"handed_in");
  assert.equal(card._homeworkHandInRows("child_one",due)[0].done,false);
  const saved=structuredClone(card._homeworkData);saved.children[0].routines[0].marks.handed_in=true;
  resolve(saved);await save;
  assert.equal(card._homeworkHandInRows("child_one",due)[0].done,true);
  card._homeworkRequest=async message=>{calls.push(message);const data=structuredClone(saved);data.children[0].routines[0].marks.handed_in=message.payload.value;return data;};
  await card._toggleHomeworkHandIn("child_one",target,false);
  assert.equal(card._homeworkHandInRows("child_one",due)[0].done,false);
  assert.notEqual(calls[0].payload.request_id,calls[1].payload.request_id);
});
test("failed saves keep the task open and retries retain the request id; guards reject invalid writes",async()=>{
  const card=cardFixture(),calls=[];
  const target=card._homeworkData.children[0].routines[0].id;
  card._homeworkRequest=async message=>{calls.push(message);throw Error("offline");};
  await card._toggleHomeworkHandIn("child_one",target,true);
  await card._toggleHomeworkHandIn("child_one",target,true);
  assert.equal(calls.length,2);
  assert.equal(calls[0].payload.request_id,calls[1].payload.request_id);
  assert.match(card._homeworkError,/could not be saved/);
  assert.equal(card._homeworkHandInRows("child_one",due)[0].done,false);
  for(const [person,id,value] of [["child_two",target,true],["child_one","unknown",true],["child_one",target,"true"]])await card._toggleHomeworkHandIn(person,id,value);
  card._config.display.read_only=true;
  await card._toggleHomeworkHandIn("child_one",target,true);
  card._config.display.read_only=false;card._config.school.homework_enabled=false;
  await card._toggleHomeworkHandIn("child_one",target,true);
  assert.equal(calls.length,2);
});
