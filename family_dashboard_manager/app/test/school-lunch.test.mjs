import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { schoolLunchForDate, FamilyHubCard } from "../frontend/family-hub-card.js";
import { validateConfig } from "../src/validate-config.mjs";

const example = JSON.parse(await readFile(new URL("../config/example.json",import.meta.url),"utf8"));
function fixture() {
  const config = structuredClone(example);
  config.features.school = false;
  config.school.lunch_menus = [{person_id:"child_one",status:"published",start_date:"2026-11-02",end_date:"2026-12-19",week_one_date:"2026-11-02",
    weeks:Array.from({length:3},(_,week)=>Array.from({length:5},(_,day)=>({mains:[`Main ${week+1}-${day+1}`,"Vegetarian main","Hot alternative"],sides:["Vegetables"],dessert:"Fruit"}))),
    packed_lunch_days:[{week:2,weekday:2}],closed_dates:["2026-11-20"]}, {person_id:"child_two",status:"pending"}];
  return config;
}

test("school lunches rotate across every term week and stop at the term boundary",()=>{
  const config=fixture();
  for (const [day,week] of [["2026-11-02",1],["2026-11-09",2],["2026-11-16",3],["2026-11-23",1],["2026-11-30",2],["2026-12-07",3],["2026-12-14",1]]) {
    const lunch=schoolLunchForDate(config,"child_one",day);
    assert.equal(lunch.week,week);
    assert.equal(lunch.title,`Main ${week}-1`);
  }
  assert.equal(schoolLunchForDate(config,"child_one","2026-12-18").status,"meal");
  assert.equal(schoolLunchForDate(config,"child_one","2026-12-21").status,"ended");
  assert.equal(schoolLunchForDate(config,"child_one","2026-10-30").status,"upcoming");
});

test("packed lunches replace the entire school meal, only on the configured rotation day",()=>{
  const config=fixture();
  for (const day of ["2026-11-10","2026-12-01"]) {
    assert.deepEqual(schoolLunchForDate(config,"child_one",day),{status:"packed",day,week:2,title:"Packed lunch today"});
  }
  for(const day of ["2026-11-03","2026-11-17","2026-11-24","2026-12-08","2026-12-15"]) assert.equal(schoolLunchForDate(config,"child_one",day).status,"meal");
});

test("weekends, closure dates, unpublished menus and household-local dates are explicit",()=>{
  const config=fixture();
  assert.equal(schoolLunchForDate(config,"child_one","2026-11-07").status,"closed");
  assert.equal(schoolLunchForDate(config,"child_one","2026-11-08").status,"closed");
  assert.equal(schoolLunchForDate(config,"child_one","2026-11-20").status,"closed");
  assert.equal(schoolLunchForDate(config,"child_two","2026-11-10").status,"pending");
  config.product.timezone="Pacific/Auckland";
  assert.equal(schoolLunchForDate(config,"child_one",new Date("2026-11-09T12:30:00Z")).status,"packed");
});

test("menu validation requires known children, real dates, full weeks and valid rules",()=>{
  const valid=fixture();assert.equal(validateConfig(valid),valid);
  for(const mutate of [
    c=>c.school.lunch_menus.push(structuredClone(c.school.lunch_menus[0])),
    c=>c.school.lunch_menus[0].person_id="parent_one",
    c=>c.school.lunch_menus[0].start_date="2026-11-31",
    c=>c.school.lunch_menus[0].end_date="2026-10-31",
    c=>c.school.lunch_menus[0].week_one_date="2026-11-03",
    c=>c.school.lunch_menus[0].weeks[0].pop(),
    c=>c.school.lunch_menus[0].packed_lunch_days[0].week=4,
    c=>c.school.lunch_menus[0].closed_dates=["2026-12-30"]
  ]) {const config=fixture();mutate(config);assert.throws(()=>validateConfig(config));}
});

test("weekly meals escape menu text and do not render the replaced meal on packed lunch days",()=>{
  const card=Object.create(FamilyHubCard.prototype);card._config=fixture();card._lunchWeekKey="2026-11-09";
  card._config.school.lunch_menus[0].weeks[1][0].mains[0]='<img src=x onerror=alert(1)>';
  const html=card._renderSchoolLunch({id:"child_one",name:"Child one"});
  assert.match(html,/&lt;img/);assert.doesNotMatch(html,/<img/);
  assert.match(html,/Packed lunch today/);assert.doesNotMatch(html,/Main 2-2/);
  assert.match(html,/Other main meals/);
});
