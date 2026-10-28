import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../school-schedule-core.js',import.meta.url),'utf8');
const ui=readFileSync(new URL('../school-timeline.js',import.meta.url),'utf8');
const sandbox={window:{}};
vm.runInNewContext(core,sandbox);vm.runInNewContext(ui,sandbox);
const resolverSource=app.slice(app.indexOf('function ordinaryBaseForSchool('),app.indexOf('function inReducedWindow('));
const resolver=new Function('window','parseDate','clippedWeeklySchedule',resolverSource+'return schoolScheduleForCalendarDay;')(
 sandbox.window,date=>new Date(date+'T12:00:00'),(list,w)=>list.map(s=>({...s,startTime:s.startTime<w.startTime?w.startTime:s.startTime,endTime:s.endTime>w.endTime?w.endTime:s.endTime})).filter(s=>s.startTime<s.endTime)
);
const entry=(id,weekday,startTime,endTime,kind='classe')=>({id,weekday,startTime,endTime,kind,label:''});
const school={id:'centre',name:'Centre',color:'#347cc1',childIds:['elna'],weeklySchedule:[]};
const year={id:'curs',startDate:'2026-09-01',endDate:'2027-06-30',ordinaryWindow:{startTime:'09:00',endTime:'16:30'},reducedWindow:{startTime:'09:00',endTime:'13:00'},reducedDays:['2026-11-02'],holidays:[],groups:[]};
const group={id:'grup',childIds:['elna'],weeklySchedule:[entry('normal',0,'10:00','11:00','classe')],reducedWeeklySchedule:undefined};
const children=[{id:'elna',name:'Elna'}];year.groups=[group];school.years=[year];
test('sense franges reduïdes definides el calendari mostra només la jornada escolar',()=>{
  const list=resolver(school,year,group,'elna','2026-11-02');
  assert.deepEqual(Array.from(list,x=>[x.startTime,x.endTime,x.kind]),[['09:00','13:00','altres']]);
  const entries=sandbox.window.schoolCalendarUI.collect('2026-11-02',children,[school],['centre'],resolver);
  assert.equal(entries.length,1);
  assert.equal(entries[0].kind,'Jornada escolar');
});
test('activitats específiques del grup el dia reduït, sense heretar les ordinàries',()=>{
  group.reducedWeeklySchedule=[entry('pati',0,'10:30','11:00','pati'),entry('menjador',0,'12:00','12:30','menjador')];
  const list=resolver(school,year,group,'elna','2026-11-02');
  assert.deepEqual(Array.from(list,x=>[x.startTime,x.endTime,x.kind]),[
    ['09:00','10:30','altres'],['10:30','11:00','pati'],['11:00','12:00','altres'],
    ['12:00','12:30','menjador'],['12:30','13:00','altres']]);
  assert.ok(!list.some(x=>x.id==='normal'));
  assert.deepEqual(Array.from(resolver(school,year,group,'elna','2026-11-09'),x=>x.kind),
    ['altres','classe','altres']);
});
test('activitats reduïdes només s’apliquen als dies marcats, no en festius',()=>{
  group.reducedWeeklySchedule=[entry('pati',0,'10:30','11:00','pati')];
  const thu=resolver(school,year,group,'elna','2026-11-05');
  assert.equal(thu.some(s=>s.id==='pati'),false);
  year.holidays.push('2026-11-02');
  assert.equal(resolver(school,year,group,'elna','2026-11-02').length,0);
  year.holidays=[];
});
test('l’editor de grup ofereix Afegir activitat sense inicialització genèrica',()=>{
  const src=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
  const panel=src.slice(src.indexOf('function schoolReducedPanel('),src.indexOf('function schoolsPage(',src.indexOf('function schoolReducedPanel(')));
  assert.match(panel,/Activitats en jornada reduïda/);
  assert.match(panel,/data-action="schedule-add"/);
  assert.match(panel,/data-action="schedule-edit"/);
  assert.match(panel,/data-action="schedule-delete"/);
  assert.doesNotMatch(panel,/Defineix horari específic/);
  assert.doesNotMatch(panel,/clippedWeeklySchedule/);
  assert.match(app,/group\.reducedWeeklySchedule = entries/);
  assert.match(app,/group\.reducedWeeklySchedule \?\? \[\]/);
});
