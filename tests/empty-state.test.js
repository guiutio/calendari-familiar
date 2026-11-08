import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const monthSource=readFileSync(new URL('../month-day-ui.js',import.meta.url),'utf8');
const extract=(from,to)=>{
  const start=js.indexOf(from),end=js.indexOf(to,start);
  assert.ok(start>=0 && end>start,'No s’ha trobat '+from);
  return js.slice(start,end);
};
const monthContext={window:{}};
vm.runInNewContext(monthSource,monthContext);
const rotationContext={window:{}};vm.runInNewContext(readFileSync(new URL('../rotation-patterns.js',import.meta.url),'utf8'),rotationContext);
vm.runInNewContext(readFileSync(new URL('../work-schedule.js',import.meta.url),'utf8'),rotationContext);
vm.runInNewContext(readFileSync(new URL('../personal-time-off.js',import.meta.url),'utf8'),rotationContext);
const functions=[
  extract('function emptyState()','const SCHOOL_PALETTE'),
  extract('function cleanState(raw)','let db ='),
  extract('function removeGuardian(id)','async function exportData()'),
  extract('function clearAllData()','function clickAction(button)'),
  extract('function clickAction(button)',"document.addEventListener('click'")
].join('\n');
const makeContext=()=>{
  let saves=0,id=0,confirmed=true;
  const context=vm.createContext({
    monthDayUI:monthContext.window.monthDayUI,
    rotationPatterns:rotationContext.window.rotationPatterns,
    personalTimeOff:rotationContext.window.personalTimeOff,workSchedule:rotationContext.window.workSchedule,
    DEFAULT_CHANGE_TIME:'19:00',MAX_ROTATION_DAYS:3640,
    BANDS:['mati','dinar','tarda','sopar','nit'],
    localDate:d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'),
    parseDate:s=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12);},
    isValidDate:s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&s.split('-').length===3,
    isTimeBand:s=>['mati','dinar','tarda','sopar','nit'].includes(s),
    validChangeTime:s=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s??'')?s:'19:00',
    cleanSchools:()=>[],
    validTheme:s=>s==='dark'||s==='light'?s:'auto',
    validFontSize:s=>s==='large'||s==='xlarge'?s:'normal',
    validTimelineZoom:s=>[25,50,75,100,125,150].includes(s)?s:50,
    confirm:()=>confirmed,
    newId:()=>`fill-${++id}`,
    update:()=>{saves++;},
    notify:()=>{},
    state:null,rotationDraft:null,sheet:null,schoolNav:{},
    tab:'calendar',calendarView:'week',selectedDate:'2026-10-20',
    viewYear:2026,viewMonth:9
  });
  vm.runInContext(functions,context);
  context.state=vm.runInContext('emptyState()',context);
  context.childById=childId=>context.state.children.find(c=>c.id===childId);
  context.guardian=guardianId=>context.state.guardians.find(g=>g.id===guardianId);
  context.defaultGuardian=()=>context.state.guardians[0]?.id??'';
  return {context,get saves(){return saves;},setConfirm:v=>confirmed=v};
};
const asJSON=v=>JSON.parse(JSON.stringify(v));

test('estat buit real: ni fills, ni tutors, ni escoles, ni assignacions',()=>{
  const {context}=makeContext(),data=asJSON(context.state);
  assert.equal(data.version,2);
  for(const name of ['children','guardians','schools'])assert.deepEqual(data[name],[]);
  for(const name of ['overrides','bandOverrides','daySlots'])assert.deepEqual(data[name],{});
  assert.deepEqual(data.extraRotations,[]);
  assert.deepEqual(data.preferences.visibleChildren,[]);
  assert.deepEqual(data.preferences.visibleGuardians,[]);
  assert.equal(data.rotation,undefined);
});
test('el JSON buit es pot importar i reobrir sense restaurar les dades de mostra',()=>{
  const {context}=makeContext();
  const stored=asJSON(context.state);
  context.raw=JSON.parse(JSON.stringify(stored));
  const result=vm.runInContext('cleanState(raw)',context);
  assert.deepEqual(asJSON(result),stored);
  delete context.raw.preferences.showHolyWeek;
  assert.equal(context.cleanState(context.raw).preferences.showHolyWeek,false);
  context.clickAction({dataset:{action:'toggle-holy-week'}});
  assert.equal(context.cleanState(asJSON(context.state)).preferences.showHolyWeek,true);
  assert.match(ts,/if\(children.length>30 \|\| guardians.length>30/);
  assert.doesNotMatch(ts,/if\(!children.length \|\| !guardians.length/);
});
test('es pot afegir el primer fill sense tutors, amb nits sense assignar, i importar-lo',()=>{
  const {context}=makeContext();
  vm.runInContext("clickAction({dataset:{action:'add-child'}})",context);
  assert.equal(context.state.children.length,1);
  assert.equal(context.state.guardians.length,0);
  const id=context.state.children[0].id;
  assert.deepEqual(asJSON(context.sheet),{type:'personDetails',personKey:'child:'+id});
  assert.deepEqual(asJSON(context.state.extraRotations),[]);
  context.raw=asJSON(context.state);
  assert.deepEqual(asJSON(vm.runInContext('cleanState(raw)',context)),context.raw);
  context.raw.extraRotations=[{id:'n',kind:'night',name:'Nit',startDate:'2026-11-01',length:1,startTime:'19:00',endTime:'00:00',childIds:[id],assignments:{[id]:['invalid-guardian']},activeDays:[true]}];
  assert.throws(()=>vm.runInContext('cleanState(raw)',context),/Assignació incorrecta/);
});
test('es pot eliminar l’únic fill i es netegen les referències',()=>{
  const {context}=makeContext();
  vm.runInContext("clickAction({dataset:{action:'add-child'}})",context);
  const id=context.state.children[0].id;
  context.state.overrides['2026-10-30|'+id]='';
  context.state.bandOverrides['2026-10-30|'+id+'|mati']='';
  context.state.daySlots['2026-10-30|'+id]=[{id:'s',startTime:'10:00',endTime:'11:00',guardianId:''}];
  context.state.schools=[{childIds:[id],years:[{groups:[{childIds:[id],childSchedules:{[id]:[]},reducedChildSchedules:{[id]:[]}}]}]}];
  vm.runInContext(`removeChild('${id}')`,context);
  assert.equal(context.sheet,null);
  assert.equal(context.state.children.length,0);
  assert.deepEqual(asJSON(context.state.extraRotations),[]);
  assert.deepEqual(asJSON(context.state.overrides),{});
  assert.deepEqual(asJSON(context.state.bandOverrides),{});
  assert.deepEqual(asJSON(context.state.daySlots),{});
  assert.deepEqual(asJSON(context.state.preferences.visibleChildren),[]);
  assert.deepEqual(asJSON(context.state.schools[0].childIds),[]);
});
test('es pot eliminar el darrer tutor i les nits queden sense assignar',()=>{
  const {context}=makeContext();
  vm.runInContext("clickAction({dataset:{action:'add-child'}})",context);
  vm.runInContext("clickAction({dataset:{action:'add-guardian'}})",context);
  const guardianId=context.state.guardians[0].id;
  const childId=context.state.children[0].id;
  context.state.extraRotations=[{id:'n',kind:'night',name:'Pernocta',startDate:'2026-11-01',length:7,startTime:'19:00',endTime:'00:00',childIds:[childId],assignments:{[childId]:Array(7).fill(guardianId)},activeDays:Array(7).fill(true),nightTimes:{}}];
  vm.runInContext(`removeGuardian('${guardianId}')`,context);
  assert.deepEqual(asJSON(context.state.guardians),[]);
  assert.deepEqual(asJSON(context.state.extraRotations[0].assignments[childId]),Array(7).fill(''));
  context.raw=asJSON(context.state);
  assert.deepEqual(asJSON(vm.runInContext('cleanState(raw)',context)),context.raw);
});
test('esborrar-ho tot requereix confirmació i conserva un estat buit importable',()=>{
  const control=makeContext(),{context}=control;
  vm.runInContext("clickAction({dataset:{action:'add-child'}})",context);
  vm.runInContext("clickAction({dataset:{action:'add-guardian'}})",context);
  context.state.schools=[{id:'centre',name:'Escola'}];
  const before=asJSON(context.state),saves=control.saves;
  control.setConfirm(false);
  vm.runInContext('clearAllData()',context);
  assert.deepEqual(asJSON(context.state),before);
  assert.equal(control.saves,saves);
  control.setConfirm(true);
  vm.runInContext('clearAllData()',context);
  assert.deepEqual(asJSON(context.state.children),[]);
  assert.deepEqual(asJSON(context.state.guardians),[]);
  assert.deepEqual(asJSON(context.state.schools),[]);
  assert.deepEqual(asJSON(context.state.extraRotations),[]);
  assert.equal(context.tab,'general');
  assert.equal(context.calendarView,'month');
  assert.equal(control.saves,saves+1);
  context.raw=asJSON(context.state);
  assert.deepEqual(asJSON(vm.runInContext('cleanState(raw)',context)),context.raw);
});
test('configuració i vistes tenen botons útils fins i tot amb zero fills',()=>{
  assert.match(ts,/data-action="clear-all"/);
  assert.match(js,/case 'clear-all':/);
  assert.doesNotMatch(ts,/data-action="reset"|seedState|upgradeDemo|Elna|Blai/);
  assert.match(ts,/let state=emptyState\(\);/);
  assert.match(ts,/function emptyState\(\):AppState/);
  assert.match(ts,/function removeChild\(id:string\)\{\s*const c=childById/);
  assert.match(ts,/function removeGuardian\(id:string\)\{\s*const g=guardian/);
  assert.match(ts,/data-action="tab" data-tab="people">Ves a Persones/);
  assert.match(ts,/class="calendar-empty-state"/);
  assert.match(ts,/!isValidDate\(date\)\|\|!state.children.length/);
  assert.match(html,/app\.js\?v=0\.17\.9/);
  assert.match(sw,/calendari-familiar-v0\.17\.9/);
});

test('el mes amb zero fills és visualment net i ofereix un botó per començar',()=>{
  assert.equal(monthContext.window.monthDayUI.mini([],{},[],{}),'');
  assert.match(ts,/El calendari encara no té fills\./);
  assert.match(ts,/data-action="tab" data-tab="people">Afegeix un fill/);
  assert.match(js,/El calendari encara no té fills\./);
});

async function simulateLoad(raw,{fallback=false}={}){
 const control=makeContext(),context=control.context,writes=[];
 context.db=null;context.storageMode='session';
 context.openDB=async()=>{if(fallback)throw Error('IndexedDB no disponible');return {};};
 context.idbGet=async()=>raw;
 context.idbPut=async data=>writes.push(asJSON(data));
 context.localStorage={getItem:()=>raw?JSON.stringify(raw):null,setItem:(_key,data)=>writes.push(JSON.parse(data))};
 vm.runInContext(extract('async function loadState()', 'function saveState()'),context);
 await context.loadState();
 return {context,writes};
}
test('la primera obertura desa un calendari buit sense generar dades d’exemple',async()=>{
 for(const fallback of [false,true]){
  const {context,writes}=await simulateLoad(null,{fallback});
  assert.deepEqual(asJSON(context.state.children),[]);
  assert.deepEqual(asJSON(context.state.guardians),[]);
  assert.deepEqual(asJSON(context.state.schools),[]);
  assert.deepEqual(asJSON(context.state.extraRotations),[]);
  assert.equal(writes.length,1);
 }
});
test('actualitzar l’app conserva les dades familiars i les preferències ja desades',async()=>{
 const {context}=makeContext();
 context.clickAction({dataset:{action:'add-child'}});context.clickAction({dataset:{action:'add-guardian'}});
 context.state.children[0].name='Fill personalitzat';
 const childId=context.state.children[0].id,guardianId=context.state.guardians[0].id;
 context.state.extraRotations=[{id:'n',kind:'night',name:'Pernocta',startDate:'2026-11-01',length:7,startTime:'19:00',endTime:'00:00',childIds:[childId],assignments:{[childId]:Array(7).fill(guardianId)},activeDays:Array(7).fill(true),nightTimes:{}}];
 context.state.preferences.theme='dark';context.state.preferences.fontSize='xlarge';context.state.preferences.timelineZoom=25;
 const saved=asJSON(context.state);
 for(const fallback of [false,true]){
  const result=await simulateLoad(saved,{fallback});
  assert.deepEqual(asJSON(result.context.state),saved);
  assert.deepEqual(result.writes,[],'Obrir l’app no substitueix ni torna a omplir dades existents');
 }
});
test('no queda cap opció ni migració que pugui tornar a carregar mostres',()=>{
 assert.doesNotMatch(js,/seedState|demoSequence|upgradeDemo|DEMO_START_DATE|Dades d’exemple|case 'reset':/);
 assert.doesNotMatch(ts,/data-action="reset"/);
});

test('la pernocta antiga migra una sola vegada i conserva assignacions, hores i excepcions',()=>{
 const {context}=makeContext(),raw=asJSON(context.state);
 raw.version=1;
 raw.children=[{id:'a',name:'A',birthDate:''},{id:'b',name:'B',birthDate:''}];
 raw.guardians=[{id:'g',name:'Tutor',color:'#123456'}];
 raw.rotation={startDate:'2026-10-01',length:2,changeTime:'19:00',assignments:{a:['g',''],b:['','g']}};
 raw.nightPatternTimes={1:'20:00'};raw.nightDateTimes={'2026-11-01':'18:00'};
 raw.overrides={'2026-11-01|a':'g'};
 const migrated=context.cleanState(raw);
 assert.equal(migrated.version,2);assert.equal(migrated.rotation,undefined);
 assert.equal(migrated.extraRotations.length,1);
 const night=migrated.extraRotations[0];
 assert.equal(night.kind,'night');assert.equal(night.startDate,'2026-10-01');assert.equal(night.endDate,undefined);
 assert.deepEqual(asJSON(night.childIds),['a','b']);assert.deepEqual(asJSON(night.assignments),raw.rotation.assignments);
 assert.deepEqual(asJSON(night.nightTimes),{1:'20:00'});
 assert.deepEqual(asJSON(migrated.nightDateTimes),{'2026-11-01|a':'18:00','2026-11-01|b':'18:00'});
 assert.deepEqual(asJSON(migrated.overrides),raw.overrides);
 assert.deepEqual(asJSON(context.cleanState(JSON.parse(JSON.stringify(migrated)))),asJSON(migrated));
 migrated.extraRotations=[];
 assert.equal(context.cleanState(JSON.parse(JSON.stringify(migrated))).extraRotations.length,0,'Eliminar la pernocta no la recrea en reobrir');
});

test('la importació rebutja pernoctes superposades i conserva intervals finals a totes les rotacions',()=>{
 const {context}=makeContext(),raw=asJSON(context.state);
 raw.children=[{id:'a',name:'A',birthDate:''}];raw.guardians=[{id:'g',name:'Tutor',color:'#123456'}];
 const night={id:'n1',kind:'night',name:'Pernocta 1',startDate:'2026-11-01',endDate:'2026-11-30',length:1,startTime:'19:00',endTime:'00:00',childIds:['a'],assignments:{a:['g']},activeDays:[true],nightTimes:{}};
 raw.extraRotations=[night,{...night,id:'n2',name:'Pernocta 2',startDate:'2026-11-30',endDate:'2026-12-31'}];
 assert.throws(()=>context.cleanState(raw),/se solapen/);
 raw.extraRotations[1].startDate='2026-12-01';
 raw.extraRotations.push({...night,id:'activity',kind:'activity',name:'Activitat',startTime:'16:00',endTime:'17:00'});
 const restored=context.cleanState(JSON.parse(JSON.stringify(raw)));
 assert.equal(restored.extraRotations.length,3);
 assert.equal(restored.extraRotations.find(r=>r.id==='activity').endDate,'2026-11-30');
 assert.deepEqual(asJSON(context.cleanState(JSON.parse(JSON.stringify(restored)))),asJSON(restored));
});

test('festius, vacances, identitat i filtres personals sobreviuen a exportar i reimportar',()=>{
 const {context}=makeContext();context.clickAction({dataset:{action:'add-child'}});context.clickAction({dataset:{action:'add-guardian'}});
 const key='guardian:'+context.state.guardians[0].id;
 assert.equal(context.personalTimeOff.setHolidays(context.state,key,['2026-11-02','2026-11-03']),'');
 assert.equal(context.personalTimeOff.saveVacation(context.state,key,'',new Map([['name','Nadal'],['startDate','2026-12-22'],['endDate','2027-01-07']]),()=> 'vacation'),'');
 context.personalTimeOff.setMe(context.state,key);context.state.preferences.showPersonalHolidays=false;
 context.personalTimeOff.setColor(context.state,key,'holiday','#be1234');context.personalTimeOff.setColor(context.state,key,'vacation','#3456ab');
 const work=context.workSchedule.draft(context.state,key,undefined,'2026-11-02');
 context.workSchedule.change(work,'weeks','2');work.days[0]=[{startTime:'09:00',endTime:'13:00'},{startTime:'15:00',endTime:'18:00'}];work.endDate='2027-06-30';
 assert.equal(context.workSchedule.save(context.state,key,work,()=> 'job'),'');context.state.preferences.showWorkSchedules=false;
 context.state.preferences.visibleTimeOffPeople=[];
 const stored=asJSON(context.state),restored=context.cleanState(JSON.parse(JSON.stringify(stored)));
 assert.deepEqual(asJSON(restored),stored);
 assert.equal(restored.preferences.mePerson,key);assert.equal(restored.preferences.showPersonalHolidays,false);
 assert.equal(restored.personTimeOff[key].vacations[0].endDate,'2027-01-07');
 assert.equal(restored.personTimeOff[key].holidayColor,'#be1234');assert.equal(restored.personTimeOff[key].vacationColor,'#3456ab');
 assert.equal(restored.preferences.showWorkSchedules,false);assert.equal(restored.personTimeOff[key].workRotations[0].days[0].length,2);assert.equal(restored.personTimeOff[key].workRotations[0].endDate,'2027-06-30');
});

test('les còpies anteriors sense calendaris personals es carreguen amb valors buits i filtres activats',()=>{
 const {context}=makeContext(),raw=asJSON(context.state);delete raw.personTimeOff;
 for(const key of ['mePerson','visibleTimeOffPeople','showPersonalHolidays','showPersonalVacations','showWorkSchedules'])delete raw.preferences[key];
 const restored=context.cleanState(raw);
 assert.deepEqual(asJSON(restored.personTimeOff),{});assert.equal(restored.preferences.mePerson,'');
 assert.deepEqual(asJSON(restored.preferences.visibleTimeOffPeople),[]);
 assert.equal(restored.preferences.showPersonalHolidays,true);assert.equal(restored.preferences.showPersonalVacations,true);assert.equal(restored.preferences.showWorkSchedules,true);
 assert.deepEqual(asJSON(restored.extraRotations),[]);
});

test('les còpies antigues migren el zoom compartit i les noves conserven cada vista',()=>{
 const {context}=makeContext();
 const raw=asJSON(context.state);
 delete raw.preferences.timelineZooms;
 for(const legacy of [25,50,75,100,125,150]){
  raw.preferences.timelineZoom=legacy;
  const migrated=context.cleanState(raw);
  assert.deepEqual(asJSON(migrated.preferences.timelineZooms),{day:legacy,week:legacy});
 }
 raw.preferences.timelineZooms={day:25,week:125};
 const reloaded=context.cleanState(JSON.parse(JSON.stringify(context.cleanState(raw))));
 assert.deepEqual(asJSON(reloaded.preferences.timelineZooms),{day:25,week:125});
 raw.preferences.timelineZooms={day:999,week:'malament'};
 assert.deepEqual(asJSON(context.cleanState(raw).preferences.timelineZooms),{day:50,week:50});
});
