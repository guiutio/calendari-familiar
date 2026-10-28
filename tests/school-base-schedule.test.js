import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const coreText=readFileSync(new URL('../school-schedule-core.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const timeline=readFileSync(new URL('../school-timeline.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(coreText,context);
vm.runInNewContext(timeline,context);
const {combine}=context.window.schoolScheduleCore;
const {collect}=context.window.schoolCalendarUI;
const lesson=(id,weekday,startTime,endTime,kind='classe')=>({id,weekday,startTime,endTime,kind,label:''});
const base=[lesson('base',0,'09:00','13:00')],groupActivity=[lesson('pati',0,'10:30','11:00','pati')];
const resolverText=app.slice(app.indexOf('function ordinaryBaseForSchool('),app.indexOf('function inReducedWindow('));
assert.ok(resolverText.includes('schoolScheduleForCalendarDay'));
const resolver=new Function('window','parseDate','clippedWeeklySchedule',resolverText+';return schoolScheduleForCalendarDay;')(
 context.window,s=>new Date(s+'T12:00:00'),(a,w)=>a.map(s=>({...s,startTime:s.startTime<w.startTime?w.startTime:s.startTime,endTime:s.endTime>w.endTime?w.endTime:s.endTime})).filter(s=>s.startTime<s.endTime)
);
test('l’activitat de grup substitueix únicament el tram ocupat',()=>{
 const parts=combine(base,groupActivity);
 assert.deepEqual(Array.from(parts,a=>[a.startTime,a.endTime,a.kind]),
  [['09:00','10:30','classe'],['10:30','11:00','pati'],['11:00','13:00','classe']]);
 assert.equal(base[0].startTime,'09:00');
 assert.equal(base[0].endTime,'13:00');
});
test('horari ordinari disponible sense grup i sense curs',()=>{
 const school={id:'centre',name:'Centre',color:'#77aa99',childIds:['elna'],weeklySchedule:base,years:[]};
 const children=[{id:'elna',name:'Elna'}];
 const out=collect('2026-11-02',children,[school],['centre'],resolver);
 assert.equal(out.length,1);
 assert.equal(out[0].startTime,'09:00');
 assert.equal(collect('2026-11-02',children,[school],[],resolver).length,0);
});
test('festius i reduïdes es respecten, conservant les activitats del grup',()=>{
 const school={id:'centre',name:'Centre',color:'#77aa99',childIds:['elna'],weeklySchedule:base};
 const group={childIds:['elna'],weeklySchedule:groupActivity};
 const year={startDate:'2026-09-01',endDate:'2027-06-30',holidays:['2026-11-03'],reducedDays:['2026-11-02'],reducedWindow:{startTime:'10:00',endTime:'12:00'},groups:[group]};
 school.years=[year];
 const children=[{id:'elna',name:'Elna'}];
 const reduced=collect('2026-11-02',children,[school],['centre'],resolver);
 assert.deepEqual(Array.from(reduced,a=>[a.startTime,a.endTime,a.kind]),
 [['10:00','10:30','Classe'],['10:30','11:00','Pati'],['11:00','12:00','Classe']]);
 assert.equal(collect('2026-11-03',children,[school],['centre'],resolver).length,0);
 assert.equal(collect('2027-07-01',children,[school],['centre'],resolver).length,0);
});
test('hores de jornada ordinària al curs, sense franges d’activitats a l’escola',()=>{
 assert.match(app,/function schoolMembershipPanel\(/);
 assert.match(app,/Hores de jornada ordinària/);
 assert.match(app,/data-action="ordinary-window-edit"/);
 assert.match(app,/data-school-form="ordinaryWindow"/);
 assert.doesNotMatch(app,/data-action="school-schedule-add"/);
 assert.doesNotMatch(app,/data-school-form="schoolSchedule"/);
 assert.doesNotMatch(app,/Personalitza l'horari/);
 assert.doesNotMatch(app,/data-action="schedule-target"/);
});
