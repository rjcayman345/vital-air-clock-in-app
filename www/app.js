
const TECHS=["Nimrod Buro","Deavour Rose","Rohan Dudhnath"];
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const ls={get(k){try{return localStorage.getItem(k)}catch(e){return null}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

let authTech=null,pinFor=null,pinMsg="",techBusy=false,myOff=0,impText="",impRows=null,impMsg="",showLogin=false,update=null,updating=false,appVer=null,upMsg="";
let segs=[],loaded=false,busy=false,store=null,pending=false,online=navigator.onLine;
let tab=location.hash==="#hours"?"hours":"clock";
let tech=TECHS.includes(ls.get("va_tech"))?ls.get("va_tech"):null;
let cust=ls.get("va_cust")?String(ls.get("va_cust")).replace(/GS[Ll]\s*-\s*/g,"VA-"):null,EXTRA=[];
const NONJOB=[["Shop time","Non-job time"],["Parts pickup","Non-job time"],["Training","Non-job time"]];
const allCust=()=>NONJOB.concat(CUST,EXTRA);
const norm=n=>String(n||"").replace(/GS[Ll]\s*-\s*/g,"VA-");
const OT_LIMIT=90*3600000, PERIOD_ANCHOR=new Date(2026,8,28).getTime();
const TYPES={travel:"Travel",work:"Working",break:"Break"};
let picking=false,query="",weekOff=0,filter="All",editId=null,delArm=false,msg="",adding=false,admin=false,mode="week",jobEdit=null,jobDel=null;

/* ---------- time helpers ---------- */
const durOf=(s,now=Date.now())=>Math.max(0,(s.end??now)-s.start);
const hm=ms=>{const m=Math.round(ms/60000);return Math.floor(m/60)+"h "+String(m%60).padStart(2,"0")+"m"};
const hc=ms=>{const m=Math.round(ms/60000);return Math.floor(m/60)+":"+String(m%60).padStart(2,"0")};
const clock=ms=>{const t=Math.floor(ms/1000),p=n=>String(n).padStart(2,"0");return p(Math.floor(t/3600))+":"+p(Math.floor(t/60)%60)+":"+p(t%60)};
const tm=ms=>new Date(ms).toLocaleTimeString([], {hour:"numeric",minute:"2-digit"});
const dayKey=ms=>{const d=new Date(ms);return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const dayName=ms=>new Date(ms).toLocaleDateString([], {weekday:"long",month:"short",day:"numeric",year:"numeric"});
const fullDate=ms=>new Date(ms).toLocaleDateString([], {weekday:"long",month:"long",day:"numeric",year:"numeric"});
const weekLabel=(a,b)=>{const f=ms=>new Date(ms).toLocaleDateString([], {month:"short",day:"numeric"});return f(a)+" – "+f(b-1)+", "+new Date(b-1).getFullYear()};
function dailyTable(list,a,techs,nd){
  const today=dayKey(Date.now()),rows=[];
  const cols=techs?[...techs.map(x=>x.split(" ")[0]),"Total"]:["Travel","Working","Total"];
  const cells=l=>{if(techs){const v=techs.map(x=>{const s=sum(l.filter(y=>y.tech===x));return s.t+s.w});return [...v,v.reduce((p,c)=>p+c,0)]}const s=sum(l);return [s.t,s.w,s.t+s.w]};
  for(let i=0;i<nd;i++){const d=new Date(a);d.setDate(d.getDate()+i);const k=dayKey(d.getTime());
    rows.push(`<tr${k===today?' class="today"':""}><td>${d.toLocaleDateString([], {weekday:"short",month:"short",day:"numeric"})}</td>${cells(list.filter(s=>dayKey(s.start)===k)).map(v=>`<td>${v?hc(v):"–"}</td>`).join("")}</tr>`)}
  return `<div class="scroll"><table><thead><tr><th>Date</th>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody><tfoot><tr><td>${nd>7?"Period total":"Week total"}</td>${cells(list).map(v=>`<td>${hc(v)}</td>`).join("")}</tr></tfoot></table></div>`;
}
const toLocalInput=ms=>ms==null?"":new Date(ms-new Date(ms).getTimezoneOffset()*60000).toISOString().slice(0,16);
function range(off){
  if(mode==="week")return weekRange(off);
  const wks=Math.round((weekRange(0)[0]-PERIOD_ANCHOR)/604800000),d=new Date(PERIOD_ANCHOR);
  d.setDate(d.getDate()+(Math.floor(wks/2)+off)*14);const a=d.getTime();d.setDate(d.getDate()+14);return [a,d.getTime()];
}
function weekRange(off){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7)+off*7);const a=d.getTime();d.setDate(d.getDate()+7);return [a,d.getTime()]}
const siteOf=n=>{const c=allCust().find(x=>x[0]===n);if(!c)return "";return [c[0].includes(":")?c[0].split(":")[0]:"",c[1]].filter(Boolean).join(" · ")};
const shortCust=n=>n.includes(":")?n.split(":").pop():n;
function sum(list){let t=0,w=0;for(const s of list){if(s.type==="travel")t+=durOf(s);else if(s.type!=="break")w+=durOf(s)}return {t,w}}
const paid=list=>{const s=sum(list);return s.t+s.w};
const openSeg=()=>segs.find(s=>s.tech===tech&&s.end==null);

/* ---------- storage: shared timesheet, or this phone only ---------- */
function localStore(){
  const read=()=>{try{return JSON.parse(ls.get("va_punches")||"[]")}catch(e){return []}};
  const save=()=>ls.set("va_punches",JSON.stringify(segs));
  segs=read().map(s=>({...s,cust:norm(s.cust)}));loaded=true;
  try{EXTRA=JSON.parse(ls.get("va_jobs")||"[]")}catch(e){EXTRA=[]}
  return {shared:false,
    async addJob(d){EXTRA.push([d.name,"Added by "+(d.by||"office"),"j"+Date.now()]);ls.set("va_jobs",JSON.stringify(EXTRA))},
    async renameJob(id,name){const j=EXTRA.find(x=>x[2]===id);if(j)j[0]=name;ls.set("va_jobs",JSON.stringify(EXTRA))},
    async delJob(id){EXTRA=EXTRA.filter(x=>x[2]!==id);ls.set("va_jobs",JSON.stringify(EXTRA))},
    async addMany(l){for(const d of l)segs.unshift({id:"l"+Date.now()+Math.random().toString(36).slice(2,6),...d});save();render()},
    async add(d){segs.unshift({id:"l"+Date.now()+Math.random().toString(36).slice(2,6),...d});save();render()},
    async patch(id,f){const s=segs.find(x=>x.id===id);if(s)Object.assign(s,f);save();render()},
    async del(id){segs=segs.filter(x=>x.id!==id);save();render()}};
}
function dbStore(db){
  const col=db.collection("punches");
  // Offline-first: a write shows up in the snapshot instantly and syncs when the phone has signal,
  // so we don't wait on the server's acknowledgement (that would hang with no signal).
  const fire=p=>{p.catch(e=>{msg=e&&e.code==="permission-denied"?"That wasn't saved: the shared timesheet refused the change. Check the Firebase rules and sign-in setup.":"That wasn't saved. Try again.";render()});return Promise.resolve()};
  // What this phone may read depends on who is signed in: the admin sees everyone, a tech only their own entries.
  let unsub=null,scopeKey="";
  const rescope=()=>{
    const key=admin?"admin":authTech?"t:"+authTech:"none";if(key===scopeKey)return;scopeKey=key;
    if(unsub){unsub();unsub=null}
    if(key==="none"){segs=[];loaded=true;render();return}
    loaded=false;
    const q=admin?col.orderBy("start","desc").limit(1000):col.where("tech","==",authTech).limit(1000);
    unsub=q.onSnapshot({includeMetadataChanges:true},snap=>{
      segs=snap.docs.map(d=>{const x=d.data();return {id:d.id,...x,cust:norm(x.cust)}}).sort((x,y)=>y.start-x.start);loaded=true;
      pending=snap.metadata.hasPendingWrites;
      render();
    },()=>{banner("The shared timesheet stopped responding. Check your signal, then reopen the app.")});
  };
  db.collection("jobs").onSnapshot(snap=>{
    EXTRA=snap.docs.map(d=>({id:d.id,...d.data()})).filter(j=>j&&typeof j.name==="string").sort((x,y)=>(x.at||0)-(y.at||0)).map(j=>[norm(j.name),"Added by "+(j.by||"office"),j.id]);render();
  },()=>{});
  return {shared:true,rescope,
    addJob:d=>fire(db.collection("jobs").doc().set(d)),
    renameJob:(id,name)=>fire(db.collection("jobs").doc(id).update({name})),
    delJob:id=>fire(db.collection("jobs").doc(id).delete()),
    add:d=>fire(col.doc().set(d)),
    addMany:l=>{for(let i=0;i<l.length;i+=400){const b=db.batch();l.slice(i,i+400).forEach(d=>b.set(col.doc(),d));fire(b.commit())}return Promise.resolve()},
    patch:(id,f)=>fire(col.doc(id).update(f)),
    del:id=>fire(col.doc(id).delete())};
}
function banner(t){const b=$("#banner");b.textContent=t;b.hidden=!t}
async function act(fn){
  if(busy)return;busy=true;msg="";render();
  try{await fn()}catch(e){
    msg=e&&e.code==="invalid_argument"?"That wasn't saved. Your access to this page is view-only, so ask the office to make you a Contributor.":"That wasn't saved. Check your signal and try again.";
  }
  busy=false;render();
}

/* ---------- actions ---------- */
function start(type){
  if(!tech||(!cust&&type!=="break"))return;
  const noteEl=$("#note"),note=noteEl?noteEl.value.trim():"";
  act(async()=>{
    const now=Date.now(),o=openSeg();
    if(o)await store.patch(o.id,{end:now});
    await store.add({tech,cust:type==="break"&&o?o.cust:cust,type,start:now,end:null,note:type==="break"?"":note});
  });
}
function clockOut(){const o=openSeg();if(o)act(()=>store.patch(o.id,{end:Date.now()}))}

let autoBusy=false;
async function autoClose(){
  if(!store||!loaded||autoBusy)return;autoBusy=true;
  const now=Date.now();
  for(const s of segs.filter(x=>x.end==null)){
    const e=new Date(s.start);e.setHours(23,59,0,0);
    if(now>e.getTime()){try{await store.patch(s.id,{end:Math.max(e.getTime(),s.start+60000),auto:true})}catch(_){}}
  }
  autoBusy=false;
}
setInterval(autoClose,60000);setTimeout(autoClose,4000);
/* ---------- views ---------- */
function render(){
  if(tab==="hours"&&!admin)tab="clock";
  $("#tab-hours").hidden=!admin;
  $("#wrap").classList.toggle("wide",tab==="hours");
  $("#tab-clock").setAttribute("aria-selected",tab==="clock");
  $("#tab-hours").setAttribute("aria-selected",tab==="hours");
  const keepV={},focusId=document.activeElement&&document.activeElement.id;
  ["tpin","pw","imp"].forEach(i=>{const e=$("#"+i);if(e)keepV[i]=e.value});
  const keep=document.activeElement&&document.activeElement.id==="q";
  $("#view").innerHTML=statusBar()+(tab==="clock"?clockView():hoursView());
  $("#view").style.cssText="display:flex;flex-direction:column;gap:16px";
  for(const i in keepV){const e=$("#"+i);if(e){e.value=keepV[i];if(focusId===i){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch(_){}}}}
  if(keep&&$("#q")){const q=$("#q");q.focus();q.setSelectionRange(q.value.length,q.value.length)}
  tick();
}
function statusBar(){
  if(update)return `<div class="note headrow"><span><b>Update available</b> (version ${esc(update.versionName)}). Your hours are safe; this only updates the app.</span><button class="btn plain" data-act="doupdate" ${updating?"disabled":""}>${updating?"Downloading…":"Update now"}</button></div>`;
  if(!store||!store.shared)return "";
  if(!online)return `<div class="note">You're offline. Clock-ins are saved on this phone and will sync as soon as you have signal.</div>`;
  if(pending)return `<div class="note">Syncing…</div>`;
  return "";
}
function myHoursCard(){
  if(!tech)return "";
  const sv=weekOff,sm=mode;mode="week";const [a,b]=weekRange(myOff);mode=sm;
  const mine=segs.filter(s=>s.tech===tech&&s.start>=a&&s.start<b).sort((x,y)=>x.start-y.start),t=sum(mine);
  const days=[...new Set(mine.map(s=>dayKey(s.start)))];
  return `<div class="card"><div class="headrow"><h2>My hours</h2><span class="at">${esc(tech)}</span></div>
    <div class="weeknav"><button class="btn plain" data-act="myprev">‹ Earlier</button><span class="mid">${weekLabel(a,b)}${myOff===0?" · this week":""}</span><button class="btn plain" data-act="mynext" ${myOff>=0?"disabled":""}>Later ›</button></div>
    <div class="totals"><div><span class="label">Travel</span><b>${hm(t.t)}</b></div><div><span class="label">Working</span><b>${hm(t.w)}</b></div><div><span class="label">Total</span><b>${hm(t.t+t.w)}</b></div></div>
    <div class="log">${days.length?days.map(d=>{const l=mine.filter(s=>dayKey(s.start)===d);return `<div class="day">${dayName(l[0].start)}</div>`+l.map(s=>segRow(s,false)).join("")}).join(""):`<div class="empty">${loaded?"No hours logged this week.":"Loading…"}</div>`}</div></div>`;
}
function versionFooter(){
  if(!native())return "";
  return `<div class="at" style="text-align:center">Version ${esc(appVer?appVer.name:"")} · <button class="link" data-act="checkupdate">Check for updates</button>${upMsg?`<br>${esc(upMsg)}`:""}</div>`;
}
function techChips(includeAll){
  const list=includeAll?["All",...TECHS]:TECHS,cur=includeAll?filter:tech;
  return `<div class="chips">${list.map(t=>`<button class="chip" data-tech="${esc(t)}" aria-pressed="${t===cur}">${esc(t)}</button>`).join("")}</div>`;
}
function custPicker(){
  const c=allCust().find(x=>x[0]===cust)||(cust?[cust,""]:null);
  if(c&&!picking)return `<div class="picked"><div><b>${esc(shortCust(c[0]))}</b><small>${esc([c[0].includes(":")?c[0].split(":")[0]:"",c[1]].filter(Boolean).join(" · "))}</small></div><button class="link" data-act="pick">Change</button></div>`;
  const words=query.toLowerCase().split(/\s+/).filter(Boolean);
  const all=allCust(),qn=query.trim().replace(/\s+/g," "),exact=all.some(x=>x[0].toLowerCase()===qn.toLowerCase());
  const hits=all.filter(x=>{const h=(x[0]+" "+x[1]).toLowerCase();return words.every(w=>h.includes(w))});
  return `<input type="search" id="q" placeholder="Search ${all.length} jobs, or type a new one" value="${esc(query)}" autocomplete="off">
  <div class="results">${hits.length?hits.slice(0,40).map(x=>`<button data-cust="${esc(x[0])}"><span>${esc(shortCust(x[0]))}</span>${x[1]||x[0].includes(":")?`<small>${esc([x[0].includes(":")?x[0].split(":")[0]:"",x[1]].filter(Boolean).join(" · "))}</small>`:""}</button>`).join("")+(hits.length>40?`<div class="none">${hits.length-40} more. Keep typing to narrow it down.</div>`:""):`<div class="none">No job matches “${esc(query)}”.</div>`}</div>
  ${qn.length>=3&&!exact?`<button class="btn plain" data-act="addjob" ${busy?"disabled":""}>+ Add “${esc(qn)}” as a new job</button>`:""}`;
}
function segRow(s,showTech){
  const editing=admin&&editId===s.id;
  return `<div class="row"><span class="tag ${s.type}">${TYPES[s.type]||"Working"}</span>
  <div class="who">${esc(shortCust(s.cust))}${siteOf(s.cust)?`<small>${esc(siteOf(s.cust))}</small>`:""}<small>${showTech?esc(s.tech)+" · ":""}${tm(s.start)} – ${s.end==null?"now":tm(s.end)}${s.note?" · "+esc(s.note):""}${s.edited?" · edited":""}${s.type==="break"?" · unpaid":""}${s.auto?` · <b class="flag">auto clock-out, needs review</b>`:""}</small></div>
  <div class="dur"><span ${s.end==null?`data-live="${s.start}"`:""}>${hm(durOf(s))}</span>${admin?`<br><button class="link" data-edit="${esc(s.id)}">${editing?"Close":"Edit"}</button>`:""}</div>
  ${editing?`<div class="editbox">
    <label class="field"><span class="label">Started</span><input type="datetime-local" id="e-start" value="${toLocalInput(s.start)}"></label>
    <label class="field"><span class="label">Ended (blank = still on)</span><input type="datetime-local" id="e-end" value="${toLocalInput(s.end)}"></label>
    <label class="field"><span class="label">Type</span><select id="e-type"><option value="travel"${s.type==="travel"?" selected":""}>Travel</option><option value="work"${s.type==="work"?" selected":""}>Working</option><option value="break"${s.type==="break"?" selected":""}>Break (unpaid)</option></select></label>
    <div class="btns"><button class="btn plain" data-act="save" ${busy?"disabled":""}>Save changes</button><button class="btn del" data-act="del" ${busy?"disabled":""}>${delArm?"Tap again to delete":"Delete entry"}</button></div>
  </div>`:""}</div>`;
}
function clockView(){
  const o=tech?openSeg():null;
  const today=tech?segs.filter(s=>s.tech===tech&&dayKey(s.start)===dayKey(Date.now())).sort((a,b)=>b.start-a.start):[];
  const tot=sum(today);
  const [wa,wb]=weekRange(0);
  const week=tech?segs.filter(s=>s.tech===tech&&s.start>=wa&&s.start<wb):[];
  const stale=o&&Date.now()-o.start>14*3600000;
  return `${techPicker()}
  <div class="card">
    <div class="date">${fullDate(Date.now())}</div>
    <span class="status ${o?o.type:"off"}">${o?(o.type==="travel"?"Travelling":o.type==="break"?"On break (unpaid)":"Working"):"Off the clock"}</span>
    <div class="timer" id="timer" ${o?`data-start="${o.start}"`:""}>${o?clock(durOf(o)):"00:00:00"}</div>
    <div class="at">${!tech?"Tap your name to begin.":o?`at <b>${esc(shortCust(o.cust))}</b> since ${tm(o.start)}`:!loaded?"Loading your hours…":"Pick the job, then start travel or start working."}</div>
    ${stale?`<div class="note">You've been clocked in since ${dayName(o.start)}, ${tm(o.start)}. If you forgot to clock out, clock out now and ask Rohan or Jaime to correct the end time.</div>`:""}
    ${tech?`<div class="field"><span class="label">${o?"Next job":"Job"}</span>${custPicker()}
      ${adding?`<div class="editbox"><label class="field"><span class="label">New job name</span><input type="text" id="newjob" maxlength="120" placeholder="e.g. GSL - 291 / Jane Smith - OLEA 204"></label><div class="btns"><button class="btn work" data-act="addjob" ${busy?"disabled":""}>Save new job</button><button class="btn plain" data-act="canceljob">Cancel</button></div></div>`:`<button class="btn plain" data-act="newjob">+ Add a new job</button>`}</div>
    <label class="field"><span class="label">Note (optional)</span><input type="text" id="note" maxlength="140" placeholder="e.g. compressor change, callback"></label>
    <div class="actions">
      <button class="btn travel" data-act="travel" ${busy||!cust||!loaded||(o&&o.type==="travel"&&o.cust===cust)?"disabled":""}>Start travel</button>
      <button class="btn work" data-act="work" ${busy||!cust||!loaded||(o&&o.type==="work"&&o.cust===cust)?"disabled":""}>Start working</button>
      ${o?`<button class="btn plain wide2" data-act="break" ${busy||o.type==="break"?"disabled":""}>${o.type==="break"?"On break. Tap Start travel or Start working to resume":"Start break (unpaid)"}</button>`:""}
      ${o?`<button class="btn out" data-act="out" ${busy?"disabled":""}>Clock out</button>`:""}
    </div>`:""}
    ${msg?`<div class="note">${esc(msg)}</div>`:""}
  </div>
  ${tech?`<div class="card"><div class="headrow"><h2>Today</h2><span class="at">${new Date().toLocaleDateString([], {weekday:"short",month:"short",day:"numeric",year:"numeric"})}</span></div>
    <div class="totals"><div><span class="label">Travel</span><b>${hm(tot.t)}</b></div><div><span class="label">Working</span><b>${hm(tot.w)}</b></div><div><span class="label">Total</span><b>${hm(tot.t+tot.w)}</b></div></div>
    <div class="log">${today.length?today.map(s=>segRow(s,false)).join(""):`<div class="empty">${loaded?"No time logged today. Your travel and working time will list here as you clock it.":"Loading…"}</div>`}</div>
    <span class="at">${admin?"You're an admin, so you can change or delete any entry with Edit.":"Need a time corrected? Ask Rohan or Jaime. Only they can change entries."}</span>
  </div>
  <div class="card"><div class="headrow"><h2>This week</h2><span class="at">${weekLabel(wa,wb)} · hours:minutes</span></div>${dailyTable(week,wa,null,7)}
    ${(()=>{const m=mode;mode="period";const [pa,pb]=range(0);mode=m;const p=paid(segs.filter(s=>s.tech===tech&&s.start>=pa&&s.start<pb));
      return `<div class="at">Pay period ${weekLabel(pa,pb)}: <b>${hc(p)}</b> of 90:00 regular hours${p>OT_LIMIT?` · <b class="flag">overtime ${hc(p-OT_LIMIT)}</b>`:""}. Breaks are unpaid and not counted.</div>`})()}</div>`:""}
  ${myHoursCard()}
  ${adminCard()}${versionFooter()}`;
}
function hoursView(){
  const [a,b]=range(weekOff);
  const wk=segs.filter(s=>s.start>=a&&s.start<b&&(filter==="All"||s.tech===filter)).sort((x,y)=>x.start-y.start);
  const fmt=ms=>new Date(ms).toLocaleDateString([], {month:"short",day:"numeric"});
  const byTech=TECHS.filter(t=>filter==="All"||t===filter).map(t=>[t,sum(wk.filter(s=>s.tech===t))]);
  const custs=[...new Set(wk.map(s=>s.cust))].map(c=>[c,sum(wk.filter(s=>s.cust===c))]).sort((x,y)=>(y[1].t+y[1].w)-(x[1].t+x[1].w));
  const all=sum(wk);
  const tr=(n,v)=>`<tr><td>${esc(n)}</td><td>${hc(v.t)}</td><td>${hc(v.w)}</td><td>${hc(v.t+v.w)}</td></tr>`;
  const head=`<thead><tr><th></th><th>Travel</th><th>Working</th><th>Total</th></tr></thead>`;
  const days=[...new Set(wk.map(s=>dayKey(s.start)))];
  return `<div class="card">
    <div class="weeknav"><button class="btn plain" data-act="prev">‹ Earlier</button><span class="mid">${weekLabel(a,b)}${weekOff===0?(mode==="week"?" · this week":" · current pay period"):""}</span><button class="btn plain" data-act="next" ${weekOff>=0?"disabled":""}>Later ›</button></div>
    <div class="chips"><button class="chip" data-mode="week" aria-pressed="${mode==="week"}">Week</button><button class="chip" data-mode="period" aria-pressed="${mode==="period"}">Pay period (2 weeks)</button></div>
    ${techChips(true)}
    ${mode==="week"?`<div class="scroll"><table>${head}<tbody>${byTech.map(x=>tr(x[0],x[1])).join("")}</tbody>${filter==="All"?`<tfoot>${tr("All technicians",all)}</tfoot>`:""}</table></div>`
    :`<div class="scroll"><table><thead><tr><th></th><th>Paid</th><th>Regular</th><th>Overtime</th></tr></thead><tbody>${byTech.map(x=>{const p=x[1].t+x[1].w,ot=Math.max(0,p-OT_LIMIT);return `<tr><td>${esc(x[0])}</td><td>${hc(p)}</td><td>${hc(p-ot)}</td><td>${ot?`<b class="flag">${hc(ot)}</b>`:"0:00"}</td></tr>`}).join("")}</tbody></table></div>
    <span class="at">Overtime is paid time over 90:00 in the two-week pay period. Travel and working time both count; breaks don't.</span>`}
    <div class="headrow"><span class="at">${wk.length} ${wk.length===1?"entry":"entries"} in this ${mode==="week"?"week":"pay period"}. Tables show hours:minutes and count time still on the clock.</span>${true?`<button class="btn plain" data-act="pdf">PDF timesheets${filter==="All"?" (all techs)":""}</button><button class="btn plain" data-act="csv" ${wk.length?"":"disabled"}>Download ${mode==="week"?"week":"pay period"} as CSV</button>`:""}</div>
    ${msg?`<div class="note">${esc(msg)}</div>`:""}
  </div>
  <div class="card"><div class="headrow"><h2>Daily hours</h2><span class="at">${filter==="All"?"Total per technician, each day (hours:minutes)":esc(filter)}</span></div>${dailyTable(wk,a,filter==="All"?TECHS:null,mode==="week"?7:14)}</div>
  ${admin&&segs.some(s=>s.auto)?`<div class="card" id="review"><h2>Needs review</h2><span class="at">These were still running at the end of the day, so they were clocked out automatically at 11:59 PM. Tap Edit to set the real end time.</span><div class="log">${segs.filter(s=>s.auto).map(s=>`<div class="day">${dayName(s.start)}</div>`+segRow(s,true)).join("")}</div></div>`:""}
  <div class="card"><h2>By customer</h2>${custs.length?`<div class="scroll"><table>${head}<tbody>${custs.map(x=>tr(shortCust(x[0]),x[1])).join("")}</tbody></table></div>`:`<div class="empty">${loaded?"No hours logged this week. Each job the techs clock into will show here with its travel and working time.":"Loading…"}</div>`}</div>
  <div class="card"><div class="headrow"><h2>Entries</h2><span class="at">${admin?"Admin: tap Edit to change a time":"Only Rohan or Jaime can change times"}</span></div><div class="log">${days.length?days.map(d=>{const list=wk.filter(s=>dayKey(s.start)===d);return `<div class="day">${dayName(list[0].start)}</div>`+list.map(s=>segRow(s,true)).join("")}).join(""):`<div class="empty">${loaded?"Nothing to show for these dates.":"Loading…"}</div>`}</div></div>
  ${importCard()}
  ${admin?`<div class="card" id="jobs"><h2>Added jobs</h2><span class="at">Jobs added from the Clock tab. Renaming one also renames it on the hours already logged.</span><div class="log">${EXTRA.length?EXTRA.map(j=>`<div class="row" style="grid-template-columns:1fr auto"><div class="who">${esc(j[0])}<small>${esc(j[1])}</small></div><div><button class="link" data-jobedit="${esc(j[2])}">${jobEdit===j[2]?"Close":"Rename"}</button></div>
    ${jobEdit===j[2]?`<div class="editbox"><label class="field"><span class="label">Job name</span><input type="text" id="job-name" maxlength="120" value="${esc(j[0])}"></label><div class="btns"><button class="btn plain" data-act="jobsave" ${busy?"disabled":""}>Save name</button><button class="btn del" data-act="jobdel" ${busy?"disabled":""}>${jobDel===j[2]?"Tap again to remove":"Remove job"}</button></div></div>`:""}</div>`).join(""):`<div class="empty">No jobs have been added yet. Any job a tech adds will list here so you can fix its name or remove it.</div>`}</div></div>`:""}
  ${adminCard()}${versionFooter()}`;
}
function csv(){
  const [a,b]=range(weekOff),a2=a;
  const q=v=>'"'+String(v??"").replace(/"/g,'""')+'"';
  const rows=segs.filter(s=>s.start>=a&&s.start<b&&(filter==="All"||s.tech===filter)).sort((x,y)=>x.start-y.start)
    .map(s=>[dayKey(s.start),s.tech,s.cust,s.type==="break"?"Break (unpaid)":TYPES[s.type]||"Working",tm(s.start),s.end==null?"":tm(s.end),(durOf(s)/3600000).toFixed(2),s.note||"",s.auto?"Auto clock-out - needs review":s.edited?"Edited":""].map(q).join(","));
  const data="Date,Technician,Customer,Type,Start,End,Hours,Note,Flag\r\n"+rows.join("\r\n");
  saveFile("vital-air-hours-"+dayKey(a2)+".csv",data);
}
function tick(){
  const now=Date.now(),t=$("#timer");
  if(t&&t.dataset.start)t.textContent=clock(now-Number(t.dataset.start));
  document.querySelectorAll("[data-live]").forEach(e=>{e.textContent=hm(now-Number(e.dataset.live))});
}
setInterval(tick,1000);

/* ---------- events ---------- */
function setTab(t){tab=t;editId=null;msg="";try{history.replaceState(null,"",t==="hours"?"#hours":"#clock")}catch(e){}render()}
$("#view").addEventListener("keydown",e=>{if(e.key==="Enter"&&e.target.id==="pw")adminLogin(e.target.value);if(e.key==="Enter"&&e.target.id==="tpin")techLogin(e.target.value)});
$("#tab-clock").onclick=()=>setTab("clock");
$("#tab-hours").onclick=()=>setTab("hours");
$("#view").addEventListener("input",e=>{if(e.target.id==="q"){query=e.target.value;render()}});
$("#view").addEventListener("click",e=>{
  const b=e.target.closest("button");if(!b)return;
  const d=b.dataset;
  if(d.tech){if(tab==="hours")filter=d.tech;else if(store&&store.shared){pinFor=d.tech;pinMsg="";return render()}else{myOff=0;tech=d.tech;ls.set("va_tech",tech);const o=openSeg();if(o){cust=o.cust}}editId=null;return render()}
  if(d.cust){cust=d.cust;ls.set("va_cust",cust);picking=false;query="";return render()}
  if((d.edit||d.jobedit||["save","del","cleardemo","jobsave","jobdel","imppreview","impgo"].includes(d.act))&&!admin)return;
  if(d.mode){mode=d.mode;weekOff=0;editId=null;return render()}
  if(d.jobedit){jobEdit=jobEdit===d.jobedit?null:d.jobedit;jobDel=null;return render()}
  if(d.edit){editId=editId===d.edit?null:d.edit;delArm=false;return render()}
  switch(d.act){
    case "imppreview":{impText=($("#imp")||{}).value||"";impRows=parseImport(impText);impMsg="";render();break}
    case "impgo":{if(!impRows||!impRows.rows.length)break;const list=impRows.rows.map(({_new,...x})=>x);
      act(async()=>{await store.addMany(list);impMsg=list.length+" entries imported.";impText="";impRows=null})}break;
    case "checkupdate":checkUpdate(true);break;
    case "doupdate":doUpdate();break;
    case "adminon":adminLogin(($("#pw")||{}).value||"");break;
    case "showlogin":showLogin=true;msg="";render();break;
    case "pdf":pdfTimesheets();break;
    case "adminoff":adminLogout();break;
    case "pick":picking=true;render();$("#q")&&$("#q").focus();break;
    case "travel":start("travel");break;
    case "work":start("work");break;
    case "break":start("break");break;
    case "out":clockOut();break;
    case "techin":techLogin(($("#tpin")||{}).value||"");break;
    case "techout":techLogout();break;
    case "pincancel":pinFor=null;pinMsg="";render();break;
    case "myprev":myOff--;render();break;
    case "mynext":myOff++;render();break;
    case "prev":weekOff--;editId=null;render();break;
    case "next":weekOff++;editId=null;render();break;
    case "csv":csv();break;
    case "jobsave":{const id=jobEdit,j=EXTRA.find(x=>x[2]===id),name=$("#job-name").value.trim().replace(/\s+/g," ").slice(0,120);
      if(!j||name.length<3){msg="The job name needs at least 3 letters.";render();break}
      const old=j[0],ids=segs.filter(s=>s.cust===old).map(s=>s.id);
      act(async()=>{await store.renameJob(id,name);for(const sid of ids)await store.patch(sid,{cust:name});if(cust===old){cust=name;ls.set("va_cust",cust)}jobEdit=null})}break;
    case "jobdel":{if(jobDel!==jobEdit){jobDel=jobEdit;render();break}const id=jobEdit;act(async()=>{await store.delJob(id);jobEdit=null;jobDel=null})}break;
    case "newjob":adding=true;render();$("#newjob")&&$("#newjob").focus();break;
    case "canceljob":adding=false;render();break;
    case "addjob":{const name=($("#newjob")&&adding?$("#newjob").value:query).trim().replace(/\s+/g," ").slice(0,120);if(name.length<3){msg="Type the new job's name first (at least 3 letters).";render();break}
      if(allCust().some(x=>x[0].toLowerCase()===name.toLowerCase())){cust=allCust().find(x=>x[0].toLowerCase()===name.toLowerCase())[0];ls.set("va_cust",cust);adding=false;picking=false;query="";render();break}
      act(async()=>{await store.addJob({name,by:tech||"",at:Date.now()});cust=name;ls.set("va_cust",cust);picking=false;query="";adding=false})}break;
    case "cleardemo":{const ids=segs.filter(s=>s.demo).map(s=>s.id);act(async()=>{for(const id of ids)await store.del(id)})}break;
    case "save":{
      const s=Date.parse($("#e-start").value),ev=$("#e-end").value,en=ev?Date.parse(ev):null,ty=$("#e-type").value,id=editId;
      if(!s||(en!=null&&en<=s)){msg="The end time has to be after the start time.";return render()}
      act(async()=>{await store.patch(id,{start:s,end:en,type:ty,edited:true,editedAt:Date.now(),auto:false});editId=null});break}
    case "del":
      if(!delArm){delArm=true;return render()}
      {const id=editId;act(async()=>{await store.del(id);editId=null;delArm=false})}break;
  }
});

/* ---------- files (CSV export) ---------- */
async function saveFile(filename,data,isB64){
  const cap=window.Capacitor,P=cap&&cap.Plugins;
  try{
    if(cap&&cap.isNativePlatform&&cap.isNativePlatform()&&P&&P.Filesystem&&P.Share){
      const r=await P.Filesystem.writeFile(isB64?{path:filename,data,directory:"CACHE"}:{path:filename,data,directory:"CACHE",encoding:"utf8"});
      await P.Share.share({title:filename,url:r.uri,dialogTitle:"Save or send hours"});
      return;
    }
    const blob=isB64?new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:"application/pdf"}):new Blob([data],{type:"text/csv"}),url=URL.createObjectURL(blob),a=document.createElement("a");
    a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }catch(e){if(!/cancel/i.test(String(e&&e.message||e))){msg="The download didn't work on this device.";render()}}
}

/* ---------- office (admin) mode: Rohan signs in with a password ---------- */
// Real protection is in firestore.rules: only the admin account can edit/delete entries.
const adminEmail=()=>String((window.VA_CONFIG&&VA_CONFIG.adminEmail)||"").toLowerCase();
const ADMIN_TECH="Rohan Dudhnath";
// Each tech has their own Firebase login: <first>.<last>@vitalair.app with their PIN as the password.
// Rohan's tech login is his admin account, so one PIN covers both.
const techEmail=n=>n===ADMIN_TECH?adminEmail():n.toLowerCase().replace(/\s+/g,".")+"@vitalair.app";
const isAdminUser=u=>!!u&&!u.isAnonymous&&String(u.email||"").toLowerCase()===adminEmail();
async function adminLogin(pw){
  if(!pw){msg="Enter your PIN.";return render()}
  if(!window.firebase||!firebase.apps.length){msg="Not connected to the shared timesheet.";return render()}
  busy=true;msg="";render();
  try{await firebase.auth().signInWithEmailAndPassword(adminEmail(),pw);msg=""}
  catch(e){msg=/network/i.test(e.code||"")?"No signal. Try again when you're online.":"Wrong PIN."}
  busy=false;render();
}
async function techLogin(pin){
  if(!pinFor)return;if(!pin){pinMsg="Enter your PIN.";return render()}
  techBusy=true;pinMsg="";render();
  try{await firebase.auth().signInWithEmailAndPassword(techEmail(pinFor),pin);pinFor=null;pinMsg=""}
  catch(e){pinMsg=/network/i.test(e.code||"")?"No signal. Try again when you're online.":/too-many/i.test(e.code||"")?"Too many tries. Wait a few minutes.":"Wrong PIN, or your login isn't set up yet. Ask Rohan."}
  techBusy=false;render();
}
async function techLogout(){
  try{await firebase.auth().signOut();await firebase.auth().signInAnonymously()}catch(e){}
  authTech=null;tech=null;cust=null;render();
}
function techPicker(){
  if(!store||!store.shared)return `<div class="field"><span class="label">Technician</span>${techChips(false)}</div>`;
  if(authTech)return `<div class="headrow"><span class="at">Signed in as <b>${esc(authTech)}</b></span><button class="link" data-act="techout">Not you? Sign out</button></div>`;
  return `<div class="field"><span class="label">Technician</span>${techChips(false)}</div>`+(pinFor?`<div class="card"><h2>${esc(pinFor)}</h2><span class="at">Enter your PIN.</span>
    <div class="actions"><input class="pin" style="max-width:none" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" id="tpin" placeholder="PIN"><button class="btn plain" data-act="techin" ${techBusy?"disabled":""}>Sign in</button></div>
    ${pinMsg?`<div class="note">${esc(pinMsg)}</div>`:""}<div><button class="link" data-act="pincancel">Cancel</button></div></div>`:"");
}
async function adminLogout(){
  try{await firebase.auth().signOut();await firebase.auth().signInAnonymously()}catch(e){}
  admin=false;tab="clock";editId=null;render();
}
function adminCard(){
  if(admin)return `<div class="card"><h2>Rohan (admin)</h2><span class="at">Signed in. You can see every timesheet, edit or delete entries, and download PDFs from the Hours tab.</span><div class="btns"><button class="btn plain" data-act="adminoff">Sign out</button></div></div>`;
  if(!showLogin)return `<div style="text-align:center"><button class="link" data-act="showlogin">Office login</button></div>`;
  return `<div class="card"><h2>Office login</h2>
    <div class="chips"><button class="chip" aria-pressed="true" type="button">Rohan (admin)</button></div>
    <div class="actions"><input class="pin" style="max-width:none" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="12" autocomplete="off" id="pw" placeholder="PIN"><button class="btn plain" data-act="adminon" ${busy?"disabled":""}>Sign in</button></div>
    ${msg?`<div class="note">${esc(msg)}</div>`:""}</div>`;
}

/* ---------- import hours (admin) ---------- */
// Paste rows: Date, Technician, Job, Type, Start, End, Note  (tab- or comma-separated; a header row is optional)
function splitRow(line){const out=[];let cur="",q=false;const sep=line.includes("\t")?"\t":",";
  for(let i=0;i<line.length;i++){const c=line[i];
    if(q){if(c==='"'){if(line[i+1]==='"'){cur+='"';i++}else q=false}else cur+=c}
    else if(c==='"')q=true;else if(c===sep){out.push(cur.trim());cur=""}else cur+=c}
  out.push(cur.trim());return out}
function parseDate(t){let m=t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);if(m)return [+m[1],+m[2]-1,+m[3]];
  m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);if(m)return [m[3].length===2?2000+ +m[3]:+m[3],+m[1]-1,+m[2]];return null}
function parseTime(t){const m=t.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?$/i);if(!m)return null;
  let h=+m[1];const mi=+(m[2]||0),ap=(m[3]||"").toLowerCase();
  if(ap){if(h<1||h>12)return null;if(ap[0]==="p"&&h<12)h+=12;if(ap[0]==="a"&&h===12)h=0}
  if(h>23||mi>59)return null;return [h,mi]}
function parseImport(text){
  const rows=[],errs=[];let n=0;
  for(const raw of text.split(/\r?\n/)){
    if(!raw.trim())continue;n++;const c=splitRow(raw);
    if(n===1&&/^date$/i.test(c[0]))continue;
    const [dt,tn,job,ty,st,en,note]=c,d=parseDate(dt||"");
    const t=TECHS.find(x=>x.toLowerCase()===(tn||"").toLowerCase())||TECHS.find(x=>x.split(" ")[0].toLowerCase()===(tn||"").toLowerCase());
    const type=/^trav/i.test(ty||"")?"travel":/^break/i.test(ty||"")?"break":/^(work|working)$/i.test(ty||"")?"work":null;
    const a=parseTime(st||""),b=parseTime(en||"");
    const why=!d?"bad date":!t?"unknown technician":!type?"type must be Travel, Working or Break":!a?"bad start time":!b?"bad end time":!(job||"").trim()?"missing job":null;
    if(why){errs.push(`Line ${n}: ${why} (${raw.slice(0,60)})`);continue}
    const start=new Date(d[0],d[1],d[2],a[0],a[1]).getTime();let end=new Date(d[0],d[1],d[2],b[0],b[1]).getTime();
    if(end<=start)end+=86400000; // finished after midnight
    const w=job.trim(),known=allCust().find(x=>x[0].toLowerCase()===w.toLowerCase())||(w.length>=4&&(h=>h.length===1?h[0]:null)(allCust().filter(x=>x[0].toLowerCase().includes(w.toLowerCase()))));
    rows.push({tech:t,cust:known?known[0]:w,type,start,end,note:(note||"").slice(0,140),edited:true,imported:true,editedAt:Date.now(),_new:!known});
  }
  return {rows,errs};
}
function importCard(){
  if(!admin)return "";
  const r=impRows;
  return `<div class="card"><h2>Import hours</h2>
    <span class="at">Paste one entry per line: <b>Date, Technician, Job, Type, Start, End, Note</b>. Example: <code>2026-10-05, Nimrod Buro, VA-001 / NCB Homes CPN 101, Working, 8:00 AM, 4:30 PM, AC repair</code>. Separate with commas or tabs, so a spreadsheet can be pasted straight in.</span>
    <textarea id="imp" rows="6" style="width:100%;padding:12px;border:1.5px solid var(--line);border-radius:12px;background:var(--bg);font:inherit" placeholder="Paste hours here">${esc(impText)}</textarea>
    <div class="btns"><button class="btn plain" data-act="imppreview">Preview</button></div>
    ${r?`<div class="note">${r.rows.length} entr${r.rows.length===1?"y":"ies"} ready to import${r.errs.length?`, ${r.errs.length} line${r.errs.length===1?"":"s"} skipped`:""}.${r.rows.some(x=>x._new)?" Jobs not found in the list are imported with the name as typed.":""}</div>
      ${r.errs.length?`<div class="at flag">${r.errs.map(esc).join("<br>")}</div>`:""}
      ${r.rows.length?`<div class="log">${r.rows.slice(0,8).map(x=>`<div class="row"><span class="tag ${x.type}">${TYPES[x.type]}</span><div class="who">${esc(shortCust(x.cust))}<small>${esc(x.tech)} · ${new Date(x.start).toLocaleDateString()} ${tm(x.start)} – ${tm(x.end)}</small></div><div class="dur">${hm(x.end-x.start)}</div></div>`).join("")}${r.rows.length>8?`<div class="empty">…and ${r.rows.length-8} more</div>`:""}</div>
      <div class="btns"><button class="btn work" data-act="impgo" ${busy?"disabled":""}>Import ${r.rows.length} entr${r.rows.length===1?"y":"ies"}</button></div>`:""}`:""}
    ${impMsg?`<div class="note">${esc(impMsg)}</div>`:""}</div>`;
}

/* ---------- PDF timesheets ---------- */
function pdfTimesheets(){
  if(!window.jspdf){msg="PDF tools didn't load.";return render()}
  const {jsPDF}=window.jspdf,[a,b]=range(weekOff),label=weekLabel(a,b);
  const doc=new jsPDF({unit:"pt",format:"letter"}),W=doc.internal.pageSize.getWidth();
  const techs=TECHS.filter(t=>filter==="All"||t===filter);
  const list=segs.filter(s=>s.start>=a&&s.start<b);
  const head=(title,sub)=>{doc.setFont("helvetica","bold");doc.setFontSize(18);doc.setTextColor(11,46,87);doc.text("Vital Air",40,50);
    doc.setFontSize(13);doc.setTextColor(16,38,63);doc.text(title,40,74);doc.setFont("helvetica","normal");doc.setFontSize(10);doc.setTextColor(90,109,128);doc.text(sub,40,90);
    doc.text("Generated "+new Date().toLocaleString(),W-40,50,{align:"right"})};
  const th={fillColor:[11,46,87]};
  head("Timesheet summary",label+(mode==="period"?" · pay period (90:00 regular hours)":" · week"));
  doc.autoTable({startY:104,head:[["Technician","Travel","Working","Total","Overtime"]],theme:"grid",headStyles:th,styles:{fontSize:10},
    body:techs.map(t=>{const x=sum(list.filter(s=>s.tech===t)),p=x.t+x.w,ot=mode==="period"?Math.max(0,p-OT_LIMIT):0;return [t,hc(x.t),hc(x.w),hc(p),ot?hc(ot):"–"]}),
    columnStyles:{1:{halign:"right"},2:{halign:"right"},3:{halign:"right"},4:{halign:"right"}}});
  const sm=sum(list.filter(s=>techs.includes(s.tech)));
  doc.setFontSize(9);doc.text("Hours shown as hours:minutes. Breaks are unpaid and not counted.",40,doc.lastAutoTable.finalY+18);
  if(sm.t+sm.w===0)doc.text("No hours were logged in this range.",40,doc.lastAutoTable.finalY+32);
  for(const t of techs){
    doc.addPage();
    const mine=list.filter(s=>s.tech===t).sort((x,y)=>x.start-y.start),x=sum(mine),p=x.t+x.w;
    head(t,label);
    doc.autoTable({startY:104,theme:"grid",headStyles:th,styles:{fontSize:9,cellPadding:4},
      head:[["Date","Job","Type","Start","End","Hours","Note"]],
      body:mine.length?mine.map(s=>[new Date(s.start).toLocaleDateString([],{weekday:"short",month:"short",day:"numeric"}),shortCust(s.cust)+(siteOf(s.cust)?"\n"+siteOf(s.cust):""),s.type==="break"?"Break (unpaid)":TYPES[s.type]||"Working",tm(s.start),s.end==null?"on now":tm(s.end),hc(durOf(s)),[s.note,s.auto?"auto clock-out":"",s.edited?"edited":""].filter(Boolean).join(" · ")]):[[{content:"No hours logged.",colSpan:7,styles:{halign:"center"}}]],
      columnStyles:{1:{cellWidth:170},5:{halign:"right"}}});
    const y=doc.lastAutoTable.finalY+22;
    doc.setFont("helvetica","bold");doc.setFontSize(11);doc.setTextColor(16,38,63);
    doc.text(`Travel ${hc(x.t)}   Working ${hc(x.w)}   Total ${hc(p)}`+(mode==="period"&&p>OT_LIMIT?`   Overtime ${hc(p-OT_LIMIT)}`:""),40,y);
  }
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(120);doc.text(`Page ${i} of ${n}`,W/2,doc.internal.pageSize.getHeight()-20,{align:"center"})}
  saveFile("vital-air-timesheets-"+dayKey(a)+".pdf",doc.output("datauristring").split(",")[1],true);
}

/* ---------- in-app updates (Android APK from the GitHub release) ---------- */
const UPDATE_BASE="https://github.com/rjcayman345/vital-air-clock-in-app/releases/download/latest/";
const native=()=>!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());
async function checkUpdate(manual){
  if(!native())return;
  try{
    const P=Capacitor.Plugins;
    if(!appVer){const i=await P.App.getInfo();appVer={code:Number(i.build)||0,name:i.version}}
    const r=await fetch(UPDATE_BASE+"version.json?t="+Date.now(),{cache:"no-store"});
    if(!r.ok)throw new Error("HTTP "+r.status);
    const v=await r.json();
    update=Number(v.versionCode)>appVer.code?v:null;
    upMsg=manual?(update?"":"You're on the latest version."):"";
  }catch(e){if(manual)upMsg="Couldn't check for updates. Check your signal."}
  render();
}
async function doUpdate(){
  if(!update||updating)return;
  updating=true;render();
  try{
    const r=await Capacitor.Plugins.ApkUpdater.install({url:UPDATE_BASE+"vital-air-time-clock.apk"});
    if(r&&r.needsPermission)upMsg="Allow “Install unknown apps” for Vital Air Time Clock, go back, and tap Update now again.";
  }catch(e){upMsg="The update didn't download. Try again, or get it from the Releases page."}
  updating=false;render();
}
document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkUpdate(false)});

/* ---------- boot ---------- */
window.addEventListener("online",()=>{online=true;render()});
window.addEventListener("offline",()=>{online=false;render()});
render();
(async()=>{
  const cfg=window.VA_CONFIG||{};
  let db=null;
  try{
    if(window.firebase&&cfg.firebase&&cfg.firebase.apiKey&&!/PASTE/i.test(cfg.firebase.apiKey)){
      firebase.initializeApp(cfg.firebase);
      tech=null;
      firebase.auth().onAuthStateChanged(u=>{
        admin=isAdminUser(u);if(admin)showLogin=false;
        authTech=u&&!u.isAnonymous?TECHS.find(t=>techEmail(t).toLowerCase()===String(u.email||"").toLowerCase())||null:null;
        tech=authTech;if(authTech){const o=openSeg();if(o)cust=o.cust}
        if(store&&store.rescope)store.rescope();
        render();
      });
      try{await new Promise(r=>{const un=firebase.auth().onAuthStateChanged(()=>{un();r()})});
        if(!firebase.auth().currentUser)await firebase.auth().signInAnonymously()}catch(e){console.warn("sign-in failed",e);banner("Sign-in to the shared timesheet failed ("+((e&&e.code)||(e&&e.message)||"unknown")+"). "+(/operation-not-allowed|admin-restricted/.test((e&&e.code)||"")?"Turn on Anonymous sign-in in Firebase (Authentication ▸ Sign-in method).":/network/.test((e&&e.code)||"")?"Check this phone's internet connection.":"Send this code to the developer."))}
      db=firebase.firestore();
      try{await db.enablePersistence({synchronizeTabs:true})}catch(e){}
    }
  }catch(e){console.warn(e)}
  if(db){store=dbStore(db);store.rescope()}
  else{store=localStore();banner("The shared timesheet isn't set up yet, so hours are saving on this phone only. See SETUP.md to connect it.")}
  const o=tech&&openSeg();if(o)cust=o.cust;
  render();
  checkUpdate(false);
})();
if("serviceWorker" in navigator&&location.protocol.startsWith("http")){navigator.serviceWorker.register("sw.js").catch(()=>{})}
