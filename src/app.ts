/** Calendari Familiar · MVP web v0.1 — cap dada familiar no surt del navegador. */
type Child = { id: string; name: string; birthDate: string };
type Guardian = { id: string; name: string; color: string };
type Rotation = { startDate: string; length: number; assignments: Record<string, string[]> };
type ThemeMode = 'auto' | 'light' | 'dark';
type Preferences = { visibleChildren: string[]; visibleGuardians: string[]; theme: ThemeMode };
type AppState = { version: number; children: Child[]; guardians: Guardian[]; rotation: Rotation; overrides: Record<string,string>; preferences: Preferences };
type Tab = 'calendar' | 'rotation' | 'settings';
type Sheet = { type:'filters' } | { type:'day'; date:string } | { type:'rotationCell'; childId:string; index:number } | { type:'rotationWeek'; childId:string; week:number } | null;

const $app = document.getElementById('app')!;
const DB_NAME = 'calendari-familiar-db';
const DB_STORE = 'data';
const DB_KEY = 'app-v1';
const MAX_ROTATION_DAYS = 3640; // 520 setmanes, per limitar el cost de visualitzar el patró
const weekdays = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];
const weekLong = ['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
const months = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const icons: Record<string,string> = {
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-2.85v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-1.51-1H6v-2.85h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-2 .06.06A1.65 1.65 0 0 0 11.09 6a1.65 1.65 0 0 0 1-1.51V4h2.85v.49a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 10a1.65 1.65 0 0 0 1.51 1H21v3h-.09a1.65 1.65 0 0 0-1.51 1Z" transform="translate(-.5 -.5) scale(.94)"/>',
  chevronLeft:'<path d="m15 18-6-6 6-6"/>', chevronRight:'<path d="m9 18 6-6-6-6"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="m20 6-11 11-5-5"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  pencil:'<path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  home:'<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon:'<path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>',
  monitor:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>'
};
function icon(name:string,size=19) {return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;}
function escapeHtml(value:unknown):string {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));}
function localDate(date:Date) {return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
function parseDate(value:string) {const [y,m,d]=value.split('-').map(Number);return new Date(y??2026,(m??1)-1,d??1,12);}
function addDays(date:string,days:number) {const d=parseDate(date); d.setDate(d.getDate()+days);return localDate(d);}
function utcDay(date:string) {const [y,m,d]=date.split('-').map(Number);return Date.UTC(y??2026,(m??1)-1,d??1)/86400000;}
function diffDays(a:string,b:string) {return utcDay(a)-utcDay(b);}
function monthTitle(year:number,month:number) {return `${months[month]} ${year}`;}
function fullDate(date:string) {const d=parseDate(date); const dayIndex=(d.getDay()+6)%7;return `${weekLong[dayIndex]}, ${d.getDate()} d’${months[d.getMonth()]} de ${d.getFullYear()}`;}
function initial(name:string) {return [...name.trim()][0]?.toUpperCase() || '?';}
function newId() {return (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
const DEMO_START_DATE = '2026-10-12'; // Dilluns de la primera setmana
const LEGACY_DEMO_SEQUENCE = ['pare','pare','mare','mare','pare','pare','pare','mare','mare','pare','pare','mare','mare','mare'];
/** Cicle de 10 setmanes, amb excepcions incorporades dins del patró (no com a dates soltes). */
function demoSequence():string[] {
  const weeklyGuardians=['pare','mare','pare','mare','pare','pare','mare','pare','mare','pare'];
  return Array.from({length:70},(_,day)=>{
    const week=Math.floor(day/7); // 0 = setmana 1
    const weekday=day%7; // 0 = dilluns, 6 = diumenge
    if((week===1 || week===6) && weekday===6)return 'pare'; // Diumenge setmanes 2 i 7
    if(week===9 && weekday>=5)return 'mare'; // Dissabte i diumenge setmana 10
    return weeklyGuardians[week]!;
  });
}
function seedState():AppState {
  const sequence=demoSequence();
  return {
    version:1,
    children:[{id:'elna',name:'Elna',birthDate:''},{id:'blai',name:'Blai',birthDate:''}],
    guardians:[{id:'pare',name:'Pare',color:'#8bb8e8'},{id:'mare',name:'Mare',color:'#efafc3'}],
    rotation:{startDate:DEMO_START_DATE,length:sequence.length,assignments:{elna:[...sequence],blai:[...sequence]}},
    overrides:{}, preferences:{visibleChildren:['elna','blai'],visibleGuardians:['pare','mare'],theme:'auto'}
  };
}
function validTheme(value:unknown):ThemeMode {return value==='light'||value==='dark'?value:'auto';}
function isValidDate(s:string) {return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && localDate(parseDate(s))===s;}
function cleanState(raw:unknown):AppState {
  if(!raw || typeof raw!=='object')throw Error('Fitxer sense dades vàlides');
  const obj=raw as Partial<AppState>;
  if(obj.version!==1 || !Array.isArray(obj.children)||!Array.isArray(obj.guardians)||!obj.rotation||!obj.preferences||!obj.overrides) throw Error('Format de còpia no compatible');
  const children=obj.children.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.birthDate==='string').map(c=>({...c,name:c.name.slice(0,70),birthDate:isValidDate(c.birthDate)?c.birthDate:''}));
  const guardians=obj.guardians.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&typeof g.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(g.color)).map(g=>({...g,name:g.name.slice(0,70)}));
  if(!children.length || !guardians.length || children.length>30 || guardians.length>30 || new Set(children.map(x=>x.id)).size!==children.length || new Set(guardians.map(x=>x.id)).size!==guardians.length) throw Error('La còpia conté fills o tutors incorrectes');
  const validGuardians=new Set(guardians.map(x=>x.id));
  const length=obj.rotation.length;
  if(!Number.isInteger(length) || length<1 || length>MAX_ROTATION_DAYS || !isValidDate(obj.rotation.startDate))throw Error('El patró no és vàlid');
  const assignments:Record<string,string[]>={};
  for(const child of children){const seq=obj.rotation.assignments?.[child.id];if(!Array.isArray(seq)||seq.length!==length||seq.some(x=>!validGuardians.has(x)))throw Error('El patró de nits està incomplet');assignments[child.id]=[...seq];}
  const overrides:Record<string,string>={};
  for(const [key,value] of Object.entries(obj.overrides)) {const [date,childId]=key.split('|');if(date && childId && isValidDate(date)&&children.some(c=>c.id===childId)&&validGuardians.has(value))overrides[key]=value;}
  return {version:1,children,guardians,rotation:{startDate:obj.rotation.startDate,length,assignments},overrides,preferences:{visibleChildren:children.filter(c=>obj.preferences!.visibleChildren?.includes(c.id)).map(c=>c.id),visibleGuardians:guardians.filter(g=>obj.preferences!.visibleGuardians?.includes(g.id)).map(g=>g.id),theme:validTheme(obj.preferences.theme)}};
}
/** Actualitza només el patró de mostra v0.1 íntegre i sense editar; mai modifica dades personalitzades. */
function upgradeOriginalDemo(data:AppState):{data:AppState;changed:boolean}{
  const untouched=data.children.length===2
    && data.children[0]?.id==='elna' && data.children[0]?.name==='Elna' && data.children[0]?.birthDate==='2015-10-08'
    && data.children[1]?.id==='blai' && data.children[1]?.name==='Blai' && data.children[1]?.birthDate==='2019-04-16'
    && data.guardians.length===3
    && data.guardians[0]?.id==='pare' && data.guardians[0]?.name==='Pare' && data.guardians[0]?.color==='#8bb8e8'
    && data.guardians[1]?.id==='mare' && data.guardians[1]?.name==='Mare' && data.guardians[1]?.color==='#efafc3'
    && data.guardians[2]?.id==='avia' && data.guardians[2]?.name==='Àvia' && data.guardians[2]?.color==='#c9b4ef'
    && data.rotation.length===14
    && ['elna','blai'].every(id=>JSON.stringify(data.rotation.assignments[id])===JSON.stringify(LEGACY_DEMO_SEQUENCE))
    && Object.keys(data.overrides).length===0
    && JSON.stringify(data.preferences.visibleChildren)===JSON.stringify(['elna','blai'])
    && JSON.stringify(data.preferences.visibleGuardians)===JSON.stringify(['pare','mare','avia']);
  if(!untouched)return {data,changed:false};
  data.children.forEach(c=>c.birthDate='');
  data.guardians=data.guardians.filter(g=>g.id!=='avia');
  data.preferences.visibleGuardians=data.preferences.visibleGuardians.filter(id=>id!=='avia');
  return {data,changed:true};
}
/** Només substitueix les dades de demostració 14 dies sense modificar. 
 * Si hi ha canvis d'usuari en noms, tutors, rotació, filtres o excepcions, es conserva tot. */
function upgradeUntouchedDemo(data:AppState):{data:AppState;changed:boolean}{
  const demoLike=data.children.length===2
    && data.children[0]?.id==='elna' && data.children[0]?.name==='Elna' && data.children[0]?.birthDate===''
    && data.children[1]?.id==='blai' && data.children[1]?.name==='Blai' && data.children[1]?.birthDate===''
    && data.guardians.length===2
    && data.guardians[0]?.id==='pare' && data.guardians[0]?.name==='Pare' && data.guardians[0]?.color==='#8bb8e8'
    && data.guardians[1]?.id==='mare' && data.guardians[1]?.name==='Mare' && data.guardians[1]?.color==='#efafc3'
    && data.rotation.length===LEGACY_DEMO_SEQUENCE.length
    && parseDate(data.rotation.startDate).getDay()===1
    && ['elna','blai'].every(id=>JSON.stringify(data.rotation.assignments[id])===JSON.stringify(LEGACY_DEMO_SEQUENCE))
    && Object.keys(data.overrides).length===0
    && JSON.stringify(data.preferences.visibleChildren)===JSON.stringify(['elna','blai'])
    && JSON.stringify(data.preferences.visibleGuardians)===JSON.stringify(['pare','mare']);
  if(!demoLike)return {data,changed:false};
  data.rotation=seedState().rotation; // Preferències de tema desades intactes
  return {data,changed:true};
}
function upgradeDemo(data:AppState):{data:AppState;changed:boolean}{
  const legacy=upgradeOriginalDemo(data);
  const current=upgradeUntouchedDemo(legacy.data);
  return {data:current.data,changed:legacy.changed||current.changed};
}
function resizedRotation(rotation:Rotation,length:number):Rotation{
  const fallback=defaultGuardian();
  const assignments:Record<string,string[]>={};
  for(const child of state.children){
    const old=rotation.assignments[child.id]??[];
    assignments[child.id]=Array.from({length},(_,i)=>old.length?old[i%old.length]??fallback:fallback);
  }
  return {...rotation,length,assignments};
}
let db:IDBDatabase|null=null;
let storageMode:'indexeddb'|'localStorage'|'session'='session';
let state=seedState();
let viewYear=new Date().getFullYear(),viewMonth=new Date().getMonth();
let tab:Tab='calendar';
let sheet:Sheet=null;
let rotationDraft:Rotation|null=null;
let rotationUnit:'days'|'weeks'='weeks';
let toastTimer:number|null=null;
let writeQueue:Promise<void>=Promise.resolve();
const themeMedia=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const mode=validTheme(state.preferences.theme);
  const effective=mode==='auto'?(themeMedia.matches?'dark':'light'):mode;
  document.documentElement.dataset.theme=effective;
  document.documentElement.style.colorScheme=effective;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',effective==='dark'?'#101722':'#f6f7f8');
  try{localStorage.setItem('calendari-familiar-theme',mode);}catch{/* Emmagatzematge opcional */}
}
themeMedia.addEventListener?.('change',()=>{if(state.preferences.theme==='auto')applyTheme();});
async function openDB():Promise<IDBDatabase> {return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});}
function idbGet():Promise<unknown> {return new Promise((resolve,reject)=>{
  const req=db!.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(DB_KEY);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
function idbPut(data:AppState):Promise<void> {return new Promise((resolve,reject)=>{
  const tx=db!.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(data,DB_KEY);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function loadState(){
  try {db=await openDB();storageMode='indexeddb';const raw=await idbGet();if(raw){const result=upgradeDemo(cleanState(raw));state=result.data;if(result.changed)await idbPut(state);}else await idbPut(state);return;}
  catch(e) {console.warn('IndexedDB no disponible; s’intenta emmagatzematge alternatiu.',e);}
  try{storageMode='localStorage';const raw=localStorage.getItem('calendari-familiar-v1');if(raw){const result=upgradeDemo(cleanState(JSON.parse(raw)));state=result.data;if(result.changed)localStorage.setItem('calendari-familiar-v1',JSON.stringify(state));}else localStorage.setItem('calendari-familiar-v1',JSON.stringify(state));}
  catch(e){console.error('No hi ha emmagatzematge persistent disponible',e);storageMode='session';}
}
function saveState(){
  const snapshot=JSON.parse(JSON.stringify(state)) as AppState;
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
    if(storageMode==='indexeddb'&&db)await idbPut(snapshot);
    else if(storageMode==='localStorage')localStorage.setItem('calendari-familiar-v1',JSON.stringify(snapshot));
  }).catch(e=>{console.error('No s’han desat els canvis',e);notify('No s’ha pogut desar. Exporta una còpia.');});
}
function update(){applyTheme();saveState();render();}
function guardian(id:string):Guardian|undefined {return state.guardians.find(g=>g.id===id);}
function childById(id:string):Child|undefined{return state.children.find(c=>c.id===id);}
function defaultGuardian(){return state.guardians[0]?.id??'';}
function rotationAssignment(date:string,childId:string,rotation=state.rotation):string {
  const arr=rotation.assignments[childId];if(!arr?.length)return defaultGuardian();
  const index=((diffDays(date,rotation.startDate)%rotation.length)+rotation.length)%rotation.length;
  return arr[index]??defaultGuardian();
}
function assigned(date:string,childId:string){return state.overrides[`${date}|${childId}`] ?? rotationAssignment(date,childId);}
function overridden(date:string,childId:string){return Object.hasOwn(state.overrides,`${date}|${childId}`);}
function birthdays(date:string){return state.children.filter(c=>c.birthDate&&c.birthDate.slice(5)===date.slice(5));}
function birthdayAge(date:string,child:Child){return parseInt(date.slice(0,4),10)-parseInt(child.birthDate.slice(0,4),10);}
function groupAssignments(date:string){
  const visible=state.children.filter(c=>state.preferences.visibleChildren.includes(c.id));
  return state.guardians.filter(g=>state.preferences.visibleGuardians.includes(g.id)).map(g=>({guardian:g,children:visible.filter(c=>assigned(date,c.id)===g.id)})).filter(g=>g.children.length);
}
function navButton(target:Tab,label:string,name:string,kind:'side'|'mobile'){
  return `<button type="button" class="${kind==='side'?'nav-button':'mobile-tab'} ${tab===target?'active':''}" data-action="tab" data-tab="${target}" aria-current="${tab===target?'page':'false'}">${icon(name,20)}<span>${label}</span></button>`;
}
function layout(content:string){return `<div class="app-layout"><aside class="sidebar">
  <div class="brand"><span class="brand-mark">${icon('home',22)}</span><span><div class="brand-name">Calendari<br>Familiar</div><div class="brand-caption">El teu espai familiar</div></span></div>
  <nav class="side-nav" aria-label="Navegació">${navButton('calendar','Calendari','calendar','side')}${navButton('rotation','Rotacions','repeat','side')}${navButton('settings','Configuració','settings','side')}</nav>
  <p class="side-foot">${icon('shield',17)}<br><strong>Les dades són teves.</strong><br>Tot queda al teu dispositiu.</p>
  </aside><main class="main-area"><div class="content">${content}<div class="footer">Calendari Familiar · MVP web v0.1.2 · Privat per disseny</div></div></main>
  <nav class="mobile-tabs" aria-label="Navegació principal">${navButton('calendar','Calendari','calendar','mobile')}${navButton('rotation','Rotacions','repeat','mobile')}${navButton('settings','Ajustos','settings','mobile')}</nav></div>${sheet?sheetMarkup():''}<div id="toast-region" aria-live="polite"></div>`;}
function calendarPage(){
  const today=localDate(new Date());
  const visibleCh=state.preferences.visibleChildren.length;
  const visibleG=state.preferences.visibleGuardians.length;
  const filtered=visibleCh!==state.children.length||visibleG!==state.guardians.length;
  const monthStart=new Date(viewYear,viewMonth,1,12);
  const firstDay=(monthStart.getDay()+6)%7;
  const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
  const rows=Math.ceil((firstDay+daysInMonth)/7);
  const starting=localDate(new Date(viewYear,viewMonth,1-firstDay,12));
  const cells=Array.from({length:rows*7},(_,i)=>{
    const date=addDays(starting,i),d=parseDate(date),other=d.getMonth()!==viewMonth,groups=groupAssignments(date);
    const bdays=birthdays(date).filter(c=>state.preferences.visibleChildren.includes(c.id));
    const overrides=state.children.some(c=>overridden(date,c.id));
    return `<button type="button" class="day-cell ${other?'other-month':''} ${date===today?'today':''}" data-action="open-day" data-date="${date}" aria-label="${escapeHtml(fullDate(date))}. ${groups.map(g=>g.children.map(c=>c.name).join(' i ')+' amb '+g.guardian.name).join('; ')||'Sense assignacions visibles'}">
     <span class="day-top"><span class="day-number">${d.getDate()}</span>${overrides?'<span class="change-dot" title="Excepció puntual"></span>':''}</span>
     ${groups.slice(0,3).map(g=>`<span class="assignment" style="background:${g.guardian.color}" title="${escapeHtml(g.children.map(c=>c.name).join(', ')+' · '+g.guardian.name)}">${escapeHtml(g.children.map(c=>initial(c.name)).join('+'))}</span>`).join('')}
     ${groups.length>3?`<span class="birth-label">+${groups.length-3}</span>`:''}
     ${bdays.length?`<span class="birth-label" title="${escapeHtml(bdays.map(c=>`${c.name} fa ${birthdayAge(date,c)} anys`).join(', '))}">🎂 ${escapeHtml(bdays.map(c=>initial(c.name)).join('+'))}</span>`:''}
    </button>`;
  });
  return `<header class="page-heading"><div><div class="eyebrow">EL TEU CALENDARI</div><h1 class="page-title">Calendari Familiar</h1><p class="page-subtitle">Qui dorm amb qui, d’un cop d’ull.</p></div>
   <div class="heading-actions"><button class="filter-button" data-action="open-filters" aria-label="Filtrar fills i tutors">${icon('filter',18)}<span class="filter-copy">Filtres</span>${filtered?'<span class="filter-dot"></span>':''}</button></div></header>
   <section class="calendar-card" aria-label="Calendari mensual"><div class="calendar-toolbar"><div class="calendar-title">${monthTitle(viewYear,viewMonth)}</div><div class="calendar-nav"><button class="soft-btn" data-action="today">Avui</button><button class="btn-icon" data-action="prev-month" aria-label="Mes anterior">${icon('chevronLeft',18)}</button><button class="btn-icon" data-action="next-month" aria-label="Mes següent">${icon('chevronRight',18)}</button></div></div>
   <div class="weekdays">${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="month-grid">${cells.join('')}</div>
   <footer class="calendar-bottom"><div class="legend">${state.guardians.filter(g=>state.preferences.visibleGuardians.includes(g.id)).map(g=>`<span class="legend-entry"><span class="legend-color" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>`).join('')}</div><span class="legend-note">● canvi puntual</span></footer></section>
   ${!visibleCh||!visibleG?'<div class="tip-card">No hi ha assignacions visibles. Revisa els filtres per seleccionar algun fill i tutor.</div>':`<div class="tip-card">${icon('info',18)}<span><strong>Toca qualsevol dia</strong> per veure qui hi dorm i modificar una nit puntual. Les modificacions no alteren la rotació habitual.</span></div>`}`;
}
function rotationPage(){
  const r=rotationDraft??state.rotation;
  return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1><p class="page-subtitle">Defineix el patró habitual de les nits.</p></div></header>
    <section class="card"><div class="panel-header"><h2 class="section-title">Configuració del patró</h2><span class="sample-tag">Repetició automàtica</span></div><p class="section-description">Tria el primer dia del patró i la seva durada. El patró es repeteix indefinidament cap endavant i cap enrere.</p>
    <div class="form-row"><div class="field"><label for="rotation-start">Data d’inici</label><input id="rotation-start" type="date" value="${r.startDate}" data-action="rotation-start" /></div>
    <div class="field"><label for="rotation-length">Durada de la rotació</label><div class="duration-row"><input id="rotation-length" type="number" min="1" max="${rotationUnit==='weeks'?MAX_ROTATION_DAYS/7:MAX_ROTATION_DAYS}" step="1" inputmode="numeric" value="${rotationUnit==='weeks'?Math.ceil(r.length/7):r.length}" data-action="rotation-length" aria-label="Nombre de dies o setmanes" /><select id="rotation-unit" data-action="rotation-unit" aria-label="Unitat de la rotació"><option value="days" ${rotationUnit==='days'?'selected':''}>dies</option><option value="weeks" ${rotationUnit==='weeks'?'selected':''}>setmanes</option></select></div></div></div>
    <p class="duration-help">${r.length} ${r.length===1?'dia':'dies'} de rotació · ${Math.ceil(r.length/7)} ${Math.ceil(r.length/7)===1?'setmana':'setmanes'} ${r.length%7===0?'':'(l’última incompleta)'}. Les nits afegides hereten el patró actual fins que les canviïs.</p>
    <hr><div class="panel-header"><h2 class="section-title">Assignació per fill</h2><button class="secondary-btn" data-action="rotation-same">${icon('copy',14)} Tots igual</button></div><p class="section-description">Toca cada casella per triar el tutor d’aquella nit. La lletra i el color corresponen al tutor.</p>
    ${state.children.map((c,cIndex)=>`<div class="rotation-child"><div class="rotation-child-header"><strong>${escapeHtml(c.name)}</strong>${cIndex>0?`<button class="soft-btn" data-action="rotation-copy" data-child="${escapeHtml(c.id)}" data-from="${escapeHtml(state.children[0]!.id)}">Copiar de ${escapeHtml(state.children[0]!.name)}</button>`:''}</div>
    ${Array.from({length:Math.ceil(r.length/7)},(_,week)=>`<div class="rotation-week"><div class="rotation-week-header"><div class="rotation-week-title">Setmana ${week+1}</div><button class="week-fill-btn" data-action="rotation-week-fill" data-child="${escapeHtml(c.id)}" data-week="${week}" aria-label="Assigna tota la setmana ${week+1} de ${escapeHtml(c.name)}">Assigna setmana</button></div><div class="rotation-days">${Array.from({length:Math.min(7,r.length-week*7)},(_,day)=>{
      const i=week*7+day,g=guardian(r.assignments[c.id]?.[i]??'');
      return `<button class="rotation-cell" data-action="rotation-cell" data-child="${escapeHtml(c.id)}" data-index="${i}" aria-label="${escapeHtml(c.name)}, dia ${i+1}, ${escapeHtml(g?.name??'sense tutor')}"><span class="small-day">${weekdays[(parseDate(addDays(r.startDate,i)).getDay()+6)%7]}</span><span class="guardian-initial" style="background:${g?.color??'#edf0f4'}">${escapeHtml(initial(g?.name??'?'))}</span></button>`;
    }).join('')}</div></div>`).join('')}</div>`).join('')}
    <div class="action-row"><button class="primary-btn" data-action="rotation-save">Desa el patró</button>${rotationDraft?'<button class="soft-btn" data-action="rotation-cancel">Descarta canvis</button>':''}</div>
    <p class="settings-note">Les excepcions de dies concrets tenen prioritat sobre el patró. Si canvies el patró, les excepcions continuaran guardades.</p></section>`;
}
function settingsPage(){
  const storageDescription=storageMode==='indexeddb'?'IndexedDB · desat automàtic':storageMode==='localStorage'?'LocalStorage · mode alternatiu':'Sense persistència garantida';
  return `<header class="page-heading"><div><div class="eyebrow">PREFERÈNCIES</div><h1 class="page-title">Configuració</h1><p class="page-subtitle">Personalitza el teu calendari familiar.</p></div></header>
  <section class="card appearance-card"><h2 class="section-title">Aparença</h2><p class="section-description">Tria el tema de l'aplicació. Automàtic segueix l'aparença de l'iPhone.</p>
  <div class="theme-options" role="group" aria-label="Mode d’aparença">${([['auto','Automàtic','monitor'],['light','Clar','sun'],['dark','Fosc','moon']] as const).map(([mode,label,glyph])=>`<button type="button" class="theme-choice ${validTheme(state.preferences.theme)===mode?'is-selected':''}" data-action="set-theme" data-theme-mode="${mode}" aria-pressed="${validTheme(state.preferences.theme)===mode}">${icon(glyph,19)}<span>${label}</span></button>`).join('')}</div></section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Fills</h2><button class="secondary-btn" data-action="add-child">${icon('plus',14)} Afegir</button></div><p class="section-description">La data de naixement és opcional. Si l’afegeixes, els aniversaris apareixeran al calendari.</p>
  ${state.children.map(c=>`<div class="settings-item"><div class="field"><label for="child-name-${escapeHtml(c.id)}">Nom</label><input id="child-name-${escapeHtml(c.id)}" type="text" maxlength="70" value="${escapeHtml(c.name)}" data-action="child-name" data-child="${escapeHtml(c.id)}" /></div><div class="field"><label for="child-birth-${escapeHtml(c.id)}">Naixement</label><input id="child-birth-${escapeHtml(c.id)}" type="date" value="${escapeHtml(c.birthDate)}" data-action="child-birth" data-child="${escapeHtml(c.id)}" /></div><button class="delete-icon" data-action="delete-child" data-child="${escapeHtml(c.id)}" aria-label="Suprimeix ${escapeHtml(c.name)}" ${state.children.length===1?'disabled':''}>${icon('trash',16)}</button></div>`).join('')}</section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Tutors i responsables</h2><button class="secondary-btn" data-action="add-guardian">${icon('plus',14)} Afegir</button></div><p class="section-description">Tria un color diferent per identificar cada tutor d’un cop d’ull.</p>
  ${state.guardians.map(g=>`<div class="settings-item guardian"><input class="color-input" type="color" value="${g.color}" data-action="guardian-color" data-guardian="${escapeHtml(g.id)}" aria-label="Color de ${escapeHtml(g.name)}" /><div class="field"><label for="guardian-name-${escapeHtml(g.id)}">Nom</label><input id="guardian-name-${escapeHtml(g.id)}" type="text" maxlength="70" value="${escapeHtml(g.name)}" data-action="guardian-name" data-guardian="${escapeHtml(g.id)}" /></div><button class="delete-icon" data-action="delete-guardian" data-guardian="${escapeHtml(g.id)}" aria-label="Suprimeix ${escapeHtml(g.name)}" ${state.guardians.length===1?'disabled':''}>${icon('trash',16)}</button></div>`).join('')}</section>
  <section class="card"><h2 class="section-title">Les teves dades</h2><p class="section-description">Les dades es queden en aquest navegador. Exporta una còpia si canvies de dispositiu o abans de netejar-ne les dades.</p>
  <div class="status-good">${icon('shield',17)} ${escapeHtml(storageDescription)}</div><div class="action-row"><button class="primary-btn" data-action="export">${icon('download',15)} Exporta JSON</button><button class="secondary-btn" data-action="import">${icon('upload',15)} Importa JSON</button><input class="sr-only" id="import-file" type="file" accept=".json,application/json" /></div><hr>
  <div class="panel-header"><h2 class="section-title">Dades d’exemple</h2><span class="sample-tag">Elna i Blai</span></div><p class="settings-note">Restableix les dades fictícies de demostració. Es perdran els canvis actuals, així que exporta una còpia abans si et cal.</p>
  <div class="action-row"><button class="danger-btn" data-action="reset">Restableix les dades d’exemple</button></div></section>`;
}
function sheetMarkup(){
  let contents='';
  if(sheet?.type==='filters'){
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Filtres</h2><p class="sheet-subtitle">Decideix qui vols veure al calendari</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    <div class="sheet-section-label">Fills</div>${state.children.map(c=>filterOption(c.id,c.name,state.preferences.visibleChildren.includes(c.id),'child')).join('')}
    <div class="sheet-section-label">Tutors</div>${state.guardians.map(g=>filterOption(g.id,g.name,state.preferences.visibleGuardians.includes(g.id),'guardian',g.color)).join('')}
    <div class="action-row"><button class="secondary-btn" data-action="filter-all">Mostra-ho tot</button><button class="primary-btn" data-action="close-sheet">Fet</button></div>`;
  } else if(sheet?.type==='day'){
    const date=sheet.date;
    const bdays=birthdays(date);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">${parseDate(date).getDate()} de ${months[parseDate(date).getMonth()]}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    ${bdays.length?`<div class="tip-card" style="margin:0 0 14px;padding:12px">🎂 ${escapeHtml(bdays.map(c=>`${c.name} fa ${birthdayAge(date,c)} anys`).join(' · '))}</div>`:''}
    <div class="sheet-section-label">Amb qui dorm cada fill?</div>${state.children.map(c=>{
      const current=assigned(date,c.id),isOverride=overridden(date,c.id);
      return `<div class="day-member"><div class="member-head"><span class="member-name">${escapeHtml(c.name)}</span><span class="member-source">${isOverride?'● Canvi puntual':'Segons la rotació'}</span></div><div class="guardian-choices">${state.guardians.map(g=>`<button class="guardian-choice ${g.id===current?'is-selected':''}" data-action="assign-night" data-date="${date}" data-child="${escapeHtml(c.id)}" data-guardian="${escapeHtml(g.id)}" aria-pressed="${g.id===current}"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</button>`).join('')}</div>${isOverride?`<div class="action-row" style="margin-top:10px"><button class="soft-btn" data-action="clear-night" data-date="${date}" data-child="${escapeHtml(c.id)}">Torna al patró habitual</button></div>`:''}</div>`;
    }).join('')}<p class="settings-note">Una modificació aquí només canvia la nit seleccionada. Pots tocar un altre tutor per canviar-la.</p>`;
  } else if(sheet?.type==='rotationWeek'){
    const {childId,week}=sheet,c=childById(childId),r=rotationDraft??state.rotation;
    const begin=week*7,end=Math.min(r.length,begin+7);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Assigna una setmana</h2><p class="sheet-subtitle">${escapeHtml(c?.name??'Fill')} · Setmana ${week+1} · Dies ${begin+1}–${end}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    <p class="settings-note">Assigna totes les nits d’aquesta setmana a un mateix tutor. Després podràs ajustar nits concretes.</p>
    ${state.guardians.map(g=>`<button class="option" data-action="rotation-set-week" data-child="${escapeHtml(childId)}" data-week="${week}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span></button>`).join('')}`;
  } else if(sheet?.type==='rotationCell'){
    const {childId,index}=sheet,c=childById(childId),r=rotationDraft??state.rotation;
    const current=r.assignments[childId]?.[index],date=addDays(r.startDate,index);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Tria un tutor</h2><p class="sheet-subtitle">${escapeHtml(c?.name??'Fill')} · Dia ${index+1} · ${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    ${state.guardians.map(g=>`<button class="option ${g.id===current?'selected':''}" data-action="rotation-set-cell" data-child="${escapeHtml(childId)}" data-index="${index}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>${g.id===current?icon('check',17):''}</button>`).join('')}`;
  }
  return `<div class="overlay" data-action="close-backdrop"><section class="sheet" role="dialog" aria-modal="true" aria-label="${sheet?.type==='filters'?'Filtres':'Detall del calendari'}"><div class="sheet-handle"></div>${contents}</section></div>`;
}
function filterOption(id:string,name:string,selected:boolean,kind:'child'|'guardian',color?:string){return `<button class="option ${selected?'selected':''}" aria-pressed="${selected}" data-action="toggle-filter" data-filter-kind="${kind}" data-id="${escapeHtml(id)}"><span class="option-left">${color?`<span class="color-dot" style="background:${color}"></span>`:icon('home',16)}${escapeHtml(name)}</span>${selected?icon('check',17):'<span class="badge-soft">Ocult</span>'}</button>`;}
function render(){
  $app.innerHTML=layout(tab==='calendar'?calendarPage():tab==='rotation'?rotationPage():settingsPage());
  document.body.style.overflow=sheet?'hidden':'';
}
function notify(message:string){
  const host=document.getElementById('toast-region')??$app;
  host.innerHTML=`<div class="toast" role="status">${escapeHtml(message)}</div>`;
  if(toastTimer!==null)window.clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>{const target=document.getElementById('toast-region');if(target)target.innerHTML='';},2900);
}
function goToMonth(delta:number){const d=new Date(viewYear,viewMonth+delta,1,12);viewYear=d.getFullYear();viewMonth=d.getMonth();render();}
function changeTab(value:Tab){tab=value;sheet=null;if(tab==='rotation'){rotationDraft=JSON.parse(JSON.stringify(state.rotation));rotationUnit=state.rotation.length%7===0?'weeks':'days';}render();window.scrollTo({top:0,behavior:'instant'});}
function chooseGuardian(date:string,childId:string,guardianId:string){
  if(guardianId===rotationAssignment(date,childId))delete state.overrides[`${date}|${childId}`];else state.overrides[`${date}|${childId}`]=guardianId;
  update();notify('Nit actualitzada');
}
function removeGuardian(id:string){
  if(state.guardians.length<2)return;
  const g=guardian(id);if(!g||!confirm(`Vols suprimir «${g.name}»? Les seves nits passaran al primer tutor disponible.`))return;
  state.guardians=state.guardians.filter(x=>x.id!==id);const alternate=defaultGuardian();
  Object.values(state.rotation.assignments).forEach(arr=>arr.forEach((v,i)=>{if(v===id)arr[i]=alternate;}));
  Object.keys(state.overrides).forEach(key=>{if(state.overrides[key]===id)state.overrides[key]=alternate;});
  state.preferences.visibleGuardians=state.preferences.visibleGuardians.filter(x=>x!==id);rotationDraft=null;update();
}
function removeChild(id:string){
  if(state.children.length<2)return;
  const c=childById(id);if(!c||!confirm(`Vols suprimir «${c.name}» i totes les seves assignacions?`))return;
  state.children=state.children.filter(x=>x.id!==id);delete state.rotation.assignments[id];
  Object.keys(state.overrides).forEach(key=>{if(key.endsWith(`|${id}`))delete state.overrides[key];});
  state.preferences.visibleChildren=state.preferences.visibleChildren.filter(x=>x!==id);rotationDraft=null;update();
}
async function exportData(){
  await writeQueue;
  const text=JSON.stringify(state,null,2);
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`calendari-familiar-${localDate(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Còpia JSON preparada');
}
async function importData(file:File){
  if(file.size>5_000_000) {notify('El fitxer és massa gran');return;}
  try {const text=await file.text();const imported=cleanState(JSON.parse(text));
    if(!confirm('Vols substituir totes les dades actuals per les del fitxer?'))return;
    state=imported;rotationDraft=null;sheet=null;update();notify('Dades importades correctament');
  }catch(err){notify(err instanceof Error?err.message:'No es pot importar aquest fitxer');}
}
async function resetData(){if(!confirm('Vols restablir les dades de mostra? S’esborraran els canvis actuals.'))return;const theme=state.preferences.theme;state=seedState();state.preferences.theme=theme;rotationDraft=null;sheet=null;update();notify('Dades de mostra restablertes');}
function clickAction(button:HTMLElement){
  const action=button.dataset.action;
  switch(action){
    case 'tab':changeTab(button.dataset.tab as Tab);break;
    case 'set-theme':state.preferences.theme=validTheme(button.dataset.themeMode);update();break;
    case 'open-filters':sheet={type:'filters'};render();break;
    case 'close-sheet':sheet=null;render();break;
    case 'today':{const now=new Date();viewMonth=now.getMonth();viewYear=now.getFullYear();render();break;}
    case 'prev-month':goToMonth(-1);break;
    case 'next-month':goToMonth(1);break;
    case 'open-day':sheet={type:'day',date:button.dataset.date!};render();break;
    case 'toggle-filter':{
      const kind=button.dataset.filterKind==='child'?'visibleChildren':'visibleGuardians',id=button.dataset.id!;
      const selected=state.preferences[kind];state.preferences[kind]=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];update();break;
    }
    case 'filter-all':state.preferences.visibleChildren=state.children.map(c=>c.id);state.preferences.visibleGuardians=state.guardians.map(g=>g.id);update();break;
    case 'assign-night':chooseGuardian(button.dataset.date!,button.dataset.child!,button.dataset.guardian!);break;
    case 'clear-night':delete state.overrides[`${button.dataset.date}|${button.dataset.child}`];update();notify('Patró habitual restaurat');break;
    case 'rotation-cell':sheet={type:'rotationCell',childId:button.dataset.child!,index:Number(button.dataset.index)};render();break;
    case 'rotation-week-fill':sheet={type:'rotationWeek',childId:button.dataset.child!,week:Number(button.dataset.week)};render();break;
    case 'rotation-set-week':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      const week=Number(button.dataset.week),childId=button.dataset.child!,gId=button.dataset.guardian!;
      const end=Math.min(rotationDraft!.length,(week+1)*7);
      for(let i=week*7;i<end;i++)rotationDraft!.assignments[childId]![i]=gId;
      sheet=null;render();notify('Setmana assignada al tutor');break;
    }
    case 'rotation-set-cell':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      rotationDraft!.assignments[button.dataset.child!]![Number(button.dataset.index)]=button.dataset.guardian!;
      sheet=null;render();break;
    }
    case 'rotation-same':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      const first=state.children[0]?.id;if(first){for(const child of state.children)rotationDraft!.assignments[child.id]=[...(rotationDraft!.assignments[first]??[])];}
      render();notify('Patró copiat a tots els fills');break;
    }
    case 'rotation-copy':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      rotationDraft!.assignments[button.dataset.child!]=[...(rotationDraft!.assignments[button.dataset.from!]??[])];
      render();notify('Patró copiat');break;
    }
    case 'rotation-save':{
      if(!rotationDraft)return;
      state.rotation=JSON.parse(JSON.stringify(rotationDraft)) as Rotation;rotationDraft=JSON.parse(JSON.stringify(state.rotation));update();notify('Patró de rotació desat');break;
    }
    case 'rotation-cancel':rotationDraft=JSON.parse(JSON.stringify(state.rotation));render();notify('Canvis descartats');break;
    case 'add-child':{
      const id=newId();const prev=state.children[0];const name=`Fill ${state.children.length+1}`;
      state.children.push({id,name,birthDate:''});state.rotation.assignments[id]=[...(state.rotation.assignments[prev?.id??'']??Array.from({length:state.rotation.length},()=>defaultGuardian()))];state.preferences.visibleChildren.push(id);rotationDraft=null;update();notify('Fill afegit · pots editar-ne el nom');break;
    }
    case 'add-guardian':{
      const palette=['#b2a0e9','#97cbb7','#f0c17c','#8eb9d9','#d6a8bb'];const color=palette[state.guardians.length%palette.length]??'#aabbcc',id=newId();
      state.guardians.push({id,name:`Tutor ${state.guardians.length+1}`,color});state.preferences.visibleGuardians.push(id);update();notify('Tutor afegit · pots editar-ne el nom');break;
    }
    case 'delete-child':removeChild(button.dataset.child!);break;
    case 'delete-guardian':removeGuardian(button.dataset.guardian!);break;
    case 'export':void exportData();break;
    case 'import':document.getElementById('import-file')?.click();break;
    case 'reset':void resetData();break;
  }
}
document.addEventListener('click',event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  const actionButton=target.closest<HTMLElement>('[data-action]');
  if(!actionButton)return;
  if(actionButton.dataset.action==='close-backdrop') {if(target===actionButton){sheet=null;render();}return;}
  if(actionButton.matches('button') && !(actionButton as HTMLButtonElement).disabled)clickAction(actionButton);
});
document.addEventListener('change',event=>{
  const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
  const action=target.dataset.action;
  if(action==='rotation-start'&&rotationDraft&&isValidDate(target.value)){rotationDraft.startDate=target.value;render();}
  else if(action==='rotation-length'&&rotationDraft){
    const count=Number(target.value),factor=rotationUnit==='weeks'?7:1,length=count*factor;
    if(!Number.isSafeInteger(count)||count<1||length>MAX_ROTATION_DAYS){notify('Indica una durada vàlida entre 1 i '+(MAX_ROTATION_DAYS/factor));render();return;}
    rotationDraft=resizedRotation(rotationDraft,length);render();
  } else if(action==='rotation-unit'&&rotationDraft){
    rotationUnit=target.value==='weeks'?'weeks':'days';
    if(rotationUnit==='weeks'&&rotationDraft.length%7!==0){
      rotationDraft=resizedRotation(rotationDraft,Math.ceil(rotationDraft.length/7)*7);
      notify('Durada arrodonida a setmanes completes');
    }
    render();
  } else if(action==='child-name') {const child=childById(target.dataset.child!);if(child){child.name=target.value.trim().slice(0,70)||child.name;update();}}
  else if(action==='child-birth') {const child=childById(target.dataset.child!);if(child){child.birthDate=target.value;update();}}
  else if(action==='guardian-name') {const g=guardian(target.dataset.guardian!);if(g){g.name=target.value.trim().slice(0,70)||g.name;update();}}
  else if(action==='guardian-color') {const g=guardian(target.dataset.guardian!);if(g&&/^#[0-9a-fA-F]{6}$/.test(target.value)){g.color=target.value;update();}}
  else if(target instanceof HTMLInputElement&&target.id==='import-file'&&target.files?.[0]){void importData(target.files[0]);target.value='';}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet){sheet=null;render();}});
async function init(){await loadState();applyTheme();render();if('serviceWorker'in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js').catch(err=>console.warn('Service worker no registrat:',err));
}}
void init();
