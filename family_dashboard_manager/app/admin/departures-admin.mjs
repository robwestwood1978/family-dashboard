const DAYS=["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const MODES={drive:"Drive",walk:"Walk",cycle:"Cycle",scoot:"Scoot"};
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const option=(value,label,current)=>`<option value="${esc(value)}" ${value===current?"selected":""}>${esc(label)}</option>`;

export class DeparturesAdmin {
  constructor({root,api,inventory,status}) {
    Object.assign(this,{api,inventory,status});
    root.innerHTML='<section class="departures-admin"><p>Loading school mornings…</p></section>';
    this.root=root.querySelector(".departures-admin");
  }
  message(text,tone="") { if(this.root.isConnected)this.status(text,tone); }
  async load() {
    try {const response=await this.api("api/admin/departures");if(!this.root.isConnected)return;this.data=response.data;this.view=response.view;this.render();}
    catch(error) {
      if(!this.root.isConnected)return;
      this.root.innerHTML=`<h2>School mornings setup</h2><p>${esc(error.message)}</p><p>A small local integration keeps the countdown and spoken reminders running when the iPad changes pages or sleeps.</p><button type="button" class="primary" data-install>Install school mornings integration</button><p>After installation, restart Home Assistant, then add <strong>Family Dashboard School Mornings</strong> under Settings → Devices &amp; services → Add integration.</p><button type="button" class="secondary" data-retry>Check connection</button>`;
      this.root.querySelector("[data-retry]").onclick=()=>this.load();
      this.root.querySelector("[data-install]").onclick=async event=>{
        event.target.disabled=true;
        try {const status=await this.api("api/admin/departures/integration");await this.api("api/admin/departures/integration",{confirm:true,expected_bundle_hash:status.bundled_set_hash,expected_active_hash:status.active_set_hash});this.message("School mornings installed. Restart Home Assistant, add the integration, then check the connection.","success");}
        catch(error){this.message(error.message,"error");}finally{event.target.disabled=false;}
      };
    }
  }
  values() {
    const form=this.root.querySelector("[data-settings-form]"),get=name=>form.elements.namedItem(name);
    return {enabled:get("enabled").checked,times:DAYS.map((_,i)=>get(`time${i}`).value||null),
      speakers:[...form.querySelectorAll("[data-speaker]:checked")].map(input=>input.value),tts_entity:get("tts_entity").value,
      volume:Number(get("volume").value),reminders:get("reminders").value.split(",").map(v=>v.trim()).filter(Boolean).map(Number),
      show_before_minutes:Number(get("show_before_minutes").value),paused_until:get("paused_until").value||null,default_mode:get("default_mode").value};
  }
  render() {
    const settings=this.data.settings;
    const speakers=(this.inventory.entities||[]).filter(e=>e.domain==="media_player"&&e.integration==="sonos"&&!e.disabled_by);
    const voices=(this.inventory.entities||[]).filter(e=>e.domain==="tts"&&!e.disabled_by);
    const savedSpeakers=settings.speakers.filter(id=>!speakers.some(s=>s.entity_id===id)).map(id=>({entity_id:id,name:`${id} (not available)`}));
    const allSpeakers=[...speakers,...savedSpeakers];
    this.root.innerHTML=`<div class="section-heading"><div><p>THE SCHOOL RUN</p><h2>School mornings</h2><span>Usual weekday times and gentle spoken reminders. Changes are shared immediately after review.</span></div></div>
      <section class="homework-admin-card"><h3>Just for today</h3><p>${esc(this.view.today)} · ${esc(this.view.status)}${this.view.overridden?" · One-off time saved":""}</p><form data-today-form><div class="field-grid"><label class="field"><span>Today’s departure time</span><input name="today_time" type="time" required value="${esc(this.view.time||"")}"></label><label class="field"><span>Today’s travel method</span><select name="today_mode" aria-label="Today’s travel method">${Object.entries(MODES).map(([id,name])=>option(id,name,this.view.mode)).join("")}</select></label></div><button class="secondary" type="submit">Change today only</button></form><div class="departure-admin-actions"><button type="button" class="secondary" data-today="skip">Skip today</button><button type="button" class="secondary" data-today="mute">${this.view.muted?"Unmute today":"Mute today"}</button><button type="button" class="secondary" data-today="restore">Restore usual time</button></div><p>These changes leave your usual week intact. Warnings already played will not repeat.</p></section>
      <form data-settings-form><section class="homework-admin-card"><h3>Your usual week</h3><label class="field is-checkbox"><input type="checkbox" name="enabled" ${settings.enabled?"checked":""}><span>Enable school departure reminders</span></label><div class="departure-week">${DAYS.map((day,i)=>`<label class="field"><span>${day}</span><input type="time" name="time${i}" value="${esc(settings.times[i]||"")}"></label>`).join("")}</div><p>Leave a day blank when there is no school run. Times use Home Assistant’s local timezone. Use “Change today” on Today when walking, cycling or scooting needs a different departure time.</p><label class="field"><span>Usual travel method</span><select name="default_mode" aria-label="Usual travel method">${Object.entries(MODES).map(([id,name])=>option(id,name,settings.default_mode)).join("")}</select></label></section>
      <section class="homework-admin-card"><h3>Announcements</h3><p>Choose the Sonos speakers that should speak. Music is lowered for the announcement and then restored.</p><div class="departure-speakers">${allSpeakers.map(s=>`<label class="field is-checkbox"><input type="checkbox" data-speaker value="${esc(s.entity_id)}" ${settings.speakers.includes(s.entity_id)?"checked":""}><span>${esc(s.name||s.entity_id)}</span></label>`).join("")||'<p>No enabled Sonos speakers were found.</p>'}</div><div class="field-grid"><label class="field"><span>Speech provider</span><select name="tts_entity" aria-label="Speech provider">${option("","Choose a speech provider",settings.tts_entity)}${voices.map(v=>option(v.entity_id,v.name||v.entity_id,settings.tts_entity)).join("")}${settings.tts_entity&&!voices.some(v=>v.entity_id===settings.tts_entity)?option(settings.tts_entity,`${settings.tts_entity} (not available)`,settings.tts_entity):""}</select><small>The selected provider processes the fixed school reminder phrases.</small></label><label class="field"><span>Announcement volume (%)</span><input type="number" name="volume" min="1" max="60" value="${settings.volume}"></label><label class="field"><span>Remind before leaving (minutes)</span><input type="text" name="reminders" value="${settings.reminders.join(", ")}" required><small>For example: 20, 10, 5, 0. Zero means “time to leave”. Each reminder plays once.</small></label><label class="field"><span>Show countdown before leaving (minutes)</span><input type="number" name="show_before_minutes" min="20" max="180" value="${settings.show_before_minutes}"></label></div><button type="button" class="secondary" data-test>Play test announcement</button><p>The test uses the saved speakers and volume. Save any changes first.</p></section>
      <section class="homework-admin-card"><h3>Holidays and days off</h3><label class="field"><span>Pause through this date</span><input type="date" name="paused_until" value="${esc(settings.paused_until||"")}"><small>Includes the chosen date. Clear it to resume the usual schedule.</small></label><p>For a single day, use “Skip today” on the countdown. “We’ve left” stops all remaining announcements for today.</p></section>
      <div class="departure-admin-actions"><button class="primary" type="submit">Review school mornings</button><button class="secondary" type="button" data-reload>Reload saved settings</button></div></form>
      ${this.data.last_announcement?`<p role="status">Last announcement: ${esc(this.data.last_announcement.status)} · ${esc(this.data.last_announcement.at)}${this.data.last_announcement.error?` · ${esc(this.data.last_announcement.error)}`:""}</p>`:""}<dialog class="departure-review"><h2>Review school mornings</h2><div data-summary></div><footer><button type="button" class="secondary" data-cancel>Cancel</button><button type="button" class="primary" data-save>Save school mornings</button></footer></dialog>`;
    const todayForm=this.root.querySelector("[data-today-form]");
    const changeToday=async(operation)=>{
      const payload={operation,date:this.view.today};
      if(operation==="override"){payload.time=todayForm.elements.today_time.value;payload.mode=todayForm.elements.today_mode.value;}
      if(operation==="mute")payload.muted=!this.view.muted;
      const buttons=[...this.root.querySelectorAll("[data-today], [data-today-form] button")];buttons.forEach(button=>button.disabled=true);
      try{const response=await this.api("api/admin/departures",{operation:"today",payload,expected_revision:this.data.revision});if(!this.root.isConnected)return;this.data=response.data;this.view=response.view;this.render();this.message("Today’s school run updated. Your usual week is unchanged.","success");}
      catch(error){this.message(error.message,"error");}finally{buttons.forEach(button=>button.disabled=false);}
    };
    todayForm.onsubmit=event=>{event.preventDefault();if(todayForm.reportValidity())changeToday("override");};
    this.root.querySelectorAll("[data-today]").forEach(button=>button.onclick=()=>changeToday(button.dataset.today));
    const form=this.root.querySelector("[data-settings-form]"),test=this.root.querySelector("[data-test]");
    const initial=JSON.stringify(this.values());
    const checkDraft=()=>{test.disabled=JSON.stringify(this.values())!==initial||!settings.speakers.length||!settings.tts_entity;};checkDraft();
    form.oninput=checkDraft;form.onchange=checkDraft;
    this.root.querySelector("[data-reload]").onclick=()=>this.load();
    const dialog=this.root.querySelector("dialog");
    form.onsubmit=event=>{event.preventDefault();if(!form.reportValidity())return;this.candidate=this.values();this.root.querySelector("[data-summary]").innerHTML=`<p>${this.candidate.enabled?"Announcements enabled":"Announcements disabled"}</p><ul>${DAYS.map((day,i)=>`<li>${day}: ${esc(this.candidate.times[i]||"No departure")}</li>`).join("")}</ul><p>Speakers: ${esc(this.candidate.speakers.map(id=>allSpeakers.find(s=>s.entity_id===id)?.name||id).join(", ")||"None")} · ${this.candidate.volume}% volume</p><p>Reminders: ${esc(this.candidate.reminders.join(", "))} minutes</p><p>Pause through: ${esc(this.candidate.paused_until||"Not paused")}</p><p>Today’s one-off time and any warnings already played stay intact.</p>`;dialog.showModal();};
    this.root.querySelector("[data-cancel]").onclick=()=>dialog.close();
    this.root.querySelector("[data-save]").onclick=async event=>{event.target.disabled=true;try{const response=await this.api("api/admin/departures",{operation:"settings",payload:this.candidate,expected_revision:this.data.revision});if(!this.root.isConnected)return;this.data=response.data;this.view=response.view;dialog.close();this.render();this.message("School mornings saved. The countdown and speakers now use these settings.","success");}catch(error){this.message(error.message,"error");}finally{event.target.disabled=false;}};
    test.onclick=async()=>{test.disabled=true;try{await this.api("api/admin/departures",{operation:"test",payload:{},expected_revision:this.data.revision});this.message("Test announcement sent to the saved Sonos speakers.","success");}catch(error){this.message(error.message,"error");}finally{checkDraft();}};
  }
}
