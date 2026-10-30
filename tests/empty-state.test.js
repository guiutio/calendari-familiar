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
const functions=[
  extract('function emptyState()','const SCHOOL_PALETTE'),
  extract('function cleanState(raw)','/** Actualitza només'),
  extract('function upgradeOriginalDemo(data)','function resizedRotation('),
  extract('function removeGuardian(id)','async function exportData()'),
  extract('function clearAllData()','function clickAction(button)'),
  extract('function clickAction(button)',"document.addEventListener('click'")
].join('\n');
const makeContext=()=>{
  let saves=0,id=0,confirmed=true;
  const context=vm.createContext({
    monthDayUI:monthContext.window.monthDayUI,
    rotationPatterns:rotationContext.window.rotationPatterns,
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
  assert.equal(data.version,1);
  for(const name of ['children','guardians','schools'])assert.deepEqual(data[name],[]);
  for(const name of ['overrides','bandOverrides','daySlots'])assert.deepEqual(data[name],{});
  assert.deepEqual(data.rotation.assignments,{});
  assert.deepEqual(data.preferences.visibleChildren,[]);
  assert.deepEqual(data.preferences.visibleGuardians,[]);
  assert.equal(data.rotation.changeTime,'19:00');
});
test('el JSON buit es pot importar i reobrir sense restaurar les dades de mostra',()=>{
  const {context}=makeContext();
  const stored=asJSON(context.state);
  context.raw=JSON.parse(JSON.stringify(stored));
  const result=vm.runInContext('upgradeDemo(cleanState(raw))',context);
  assert.equal(result.changed,false);
  assert.deepEqual(asJSON(result.data),stored);
  assert.match(ts,/if\(children.length>30 \|\| guardians.length>30/);
  assert.doesNotMatch(ts,/if\(!children.length \|\| !guardians.length/);
});
test('es pot afegir el primer fill sense tutors, amb nits sense assignar, i importar-lo',()=>{
  const {context}=makeContext();
  vm.runInContext("clickAction({dataset:{action:'add-child'}})",context);
  assert.equal(context.state.children.length,1);
  assert.equal(context.state.guardians.length,0);
  const id=context.state.children[0].id;
  assert.deepEqual(asJSON(context.state.rotation.assignments[id]),Array(7).fill(''));
  context.raw=asJSON(context.state);
  assert.deepEqual(asJSON(vm.runInContext('cleanState(raw)',context)),context.raw);
  context.raw.rotation.assignments[id][0]='invalid-guardian';
  assert.throws(()=>vm.runInContext('cleanState(raw)',context),/patró de nits/);
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
  assert.equal(context.state.children.length,0);
  assert.deepEqual(asJSON(context.state.rotation.assignments),{});
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
  context.state.rotation.assignments[childId].fill(guardianId);
  vm.runInContext(`removeGuardian('${guardianId}')`,context);
  assert.deepEqual(asJSON(context.state.guardians),[]);
  assert.deepEqual(asJSON(context.state.rotation.assignments[childId]),Array(7).fill(''));
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
  assert.deepEqual(asJSON(context.state.rotation.assignments),{});
  assert.equal(context.tab,'settings');
  assert.equal(context.calendarView,'month');
  assert.equal(control.saves,saves+1);
  context.raw=asJSON(context.state);
  assert.deepEqual(asJSON(vm.runInContext('cleanState(raw)',context)),context.raw);
});
test('configuració i vistes tenen botons útils fins i tot amb zero fills',()=>{
  assert.match(ts,/data-action="clear-all"/);
  assert.match(js,/case 'clear-all':/);
  assert.match(ts,/data-action="reset">Carrega les dades d’exemple/);
  assert.match(ts,/function emptyState\(\):AppState/);
  assert.match(ts,/function removeChild\(id:string\)\{\s*const c=childById/);
  assert.match(ts,/function removeGuardian\(id:string\)\{\s*const g=guardian/);
  assert.match(ts,/data-action="tab" data-tab="settings">Ves a Configuració/);
  assert.match(ts,/class="calendar-empty-state"/);
  assert.match(ts,/!isValidDate\(date\)\|\|!state.children.length/);
  assert.match(html,/app\.js\?v=0\.6\.0/);
  assert.match(sw,/calendari-familiar-v0\.6\.0/);
});

test('el mes amb zero fills és visualment net i ofereix un botó per començar',()=>{
  assert.equal(monthContext.window.monthDayUI.mini([],{},[],{}),'');
  assert.match(ts,/El calendari encara no té fills\./);
  assert.match(ts,/data-action="tab" data-tab="settings">Afegeix un fill/);
  assert.match(js,/El calendari encara no té fills\./);
});
