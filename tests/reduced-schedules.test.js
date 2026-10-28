import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js = readFileSync(new URL('../app.js',import.meta.url),'utf8');
function part(start,end){
  const a=js.indexOf(start),b=js.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'Falta bloc: '+start);
  return js.slice(a,b);
}
const lib = new Function(
  part('const SESSION_KINDS','const BANDS')+
  part('function clippedWeeklySchedule','const $app')+
  part('function localDate','const DEMO_START_DATE')+
  part('const SCHOOL_PALETTE','function cleanState(')+
  '\nreturn {clippedWeeklySchedule,ordinaryScheduleForChild,reducedScheduleForChild,scheduleForSchoolDay,cleanSchools};'
)();
const children=[{id:'elna',name:'Elna',birthDate:''},{id:'blai',name:'Blai',birthDate:''}];
const session=(id,weekday,startTime,endTime,kind='classe')=>({id,weekday,startTime,endTime,kind,label:''});
function fixtures(){
  const group={
    id:'g',name:'Primer',tutorName:'',childIds:['elna','blai'],
    weeklySchedule:[
      session('a',0,'08:30','10:30'),
      session('b',0,'12:30','14:00','menjador'),
      session('c',0,'15:00','16:00'),
      session('d',1,'09:00','12:00')],
    childSchedules:{},
    reducedChildSchedules:{}
  };
  const year={
    id:'curs',startDate:'2026-09-01',endDate:'2027-06-30',
    holidays:[],reducedDays:['2026-11-02'],groups:[group],
    reducedWindow:{startTime:'09:00',endTime:'13:00'}
  };
  const school={id:'escola',name:'Escola',address:'',phone:'',years:[year]};
  return {group,year,school};
}

test('retalla els extrems, exclou sessions fora de finestra i preserva originals',()=>{
  const {group,year}=fixtures();
  const before=JSON.stringify(group.weeklySchedule);
  const list=lib.reducedScheduleForChild(group,year,'elna');
  assert.deepEqual(list.map(s=>[s.startTime,s.endTime]),[['09:00','10:30'],['12:30','13:00'],['09:00','12:00']]);
  assert.equal(JSON.stringify(group.weeklySchedule),before);
});

test('la finestra reduïda no s’inventa: sense configuració no hi ha càlcul',()=>{
  const {group,year}=fixtures(); delete year.reducedWindow;
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'elna'),[]);
});

test('l’horari propi ordinari es retalla quan no hi ha un altre reduït',()=>{
  const {group,year}=fixtures();
  group.childSchedules.elna=[session('propi',0,'10:00','14:00')];
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'elna').map(s=>[s.startTime,s.endTime]),[['10:00','13:00']]);
  assert.equal(lib.reducedScheduleForChild(group,year,'blai').length,3);
});

test('horari especial del grup i després del fill, amb precedència i buit explícit',()=>{
  const {group,year}=fixtures();
  group.reducedWeeklySchedule=[session('grup',0,'09:30','11:00')];
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'elna').map(s=>s.id),['grup']);
  group.reducedChildSchedules.elna=[session('elna',0,'10:00','12:30')];
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'elna').map(s=>s.id),['elna']);
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'blai').map(s=>s.id),['grup']);
  group.reducedChildSchedules.elna=[];
  assert.deepEqual(lib.reducedScheduleForChild(group,year,'elna'),[]);
});

test('dies ordinaris, reduïts, festius i fora de curs',()=>{
  const {group,year}=fixtures();
  assert.deepEqual(lib.scheduleForSchoolDay(group,year,'elna','2026-11-02').map(s=>s.startTime),['09:00','12:30']);
  assert.deepEqual(lib.scheduleForSchoolDay(group,year,'elna','2026-11-03').map(s=>s.startTime),['09:00']);
  year.holidays.push('2026-11-02');
  assert.deepEqual(lib.scheduleForSchoolDay(group,year,'elna','2026-11-02'),[]);
  assert.deepEqual(lib.scheduleForSchoolDay(group,year,'elna','2027-07-01'),[]);
});

test('importació i exportació admeten jornades reduïdes i còpies 0.1.9',()=>{
  const {school}=fixtures();
  const legacy=structuredClone(school);delete legacy.years[0].reducedWindow;
  assert.equal(lib.cleanSchools([legacy],children)[0].years[0].reducedWindow,undefined);
  const roundTrip=lib.cleanSchools(JSON.parse(JSON.stringify([school])),children);
  assert.deepEqual(roundTrip[0].years[0].reducedWindow,{startTime:'09:00',endTime:'13:00'});
});

test('rebutja hores reduïdes invàlides i sessions especials fora de l’interval',()=>{
  const x=fixtures().school;
  x.years[0].reducedWindow={startTime:'14:00',endTime:'13:00'};
  assert.throws(()=>lib.cleanSchools([x],children),/interval/);
  x.years[0].reducedWindow={startTime:'09:00',endTime:'13:00'};
  x.years[0].groups[0].reducedWeeklySchedule=[session('fora',0,'08:00','10:00')];
  assert.throws(()=>lib.cleanSchools([x],children),/fora/);
  x.years[0].groups[0].reducedWeeklySchedule=undefined;
  x.years[0].groups[0].reducedChildSchedules={inexistent:[session('x',0,'10:00','11:00')]};
  assert.throws(()=>lib.cleanSchools([x],children),/no matriculat/);
});

test('el formulari d’hores reduïdes és accessible i es mostra amb les dades actuals',()=>{
  assert.match(js,/\['schoolForm', 'yearForm', 'groupForm', 'schoolDayForm', 'reducedWindowForm', 'ordinaryWindowForm', 'scheduleForm'\]/);
  const formFactory=new Function('sheet','schoolById','yearById','schoolYearName','escapeHtml','icon',
    part('function schoolFormMarkup()', '/** Festius/reducció de tots els centres')+
    '\nreturn schoolFormMarkup();');
  const {school,year}=fixtures();
  const html=formFactory({type:'reducedWindowForm',schoolId:'escola',yearId:'curs'},
    ()=>school,()=>year,()=> 'Curs 2026-2027',
    v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;'),()=>'<svg></svg>');
  assert.match(html,/data-school-form="reducedWindow"/);
  assert.match(html,/value="09:00"/);
  assert.match(html,/value="13:00"/);
});
