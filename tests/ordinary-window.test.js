import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const core=readFileSync(new URL('../school-schedule-core.js',import.meta.url),'utf8');
const timeline=readFileSync(new URL('../school-timeline.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(core,context);
vm.runInNewContext(timeline,context);
const resolveBlock=app.slice(app.indexOf('function ordinaryBaseForSchool('),app.indexOf('function inReducedWindow('));
assert.ok(resolveBlock.includes('function schoolScheduleForCalendarDay('));
const lib=new Function('window','parseDate','clippedWeeklySchedule',resolveBlock+'return {ordinaryBaseForSchool,schoolScheduleForCalendarDay};')(
 context.window,s=>new Date(s+'T12:00:00'),(a,w)=>a.map(s=>({...s,startTime:s.startTime<w.startTime?w.startTime:s.startTime,endTime:s.endTime>w.endTime?w.endTime:s.endTime})).filter(s=>s.startTime<s.endTime)
);
const session=(id,weekday,startTime,endTime,kind='classe')=>({id,weekday,startTime,endTime,kind,label:''});
const school={id:'centre',name:'Centre',color:'#498392',childIds:['elna'],weeklySchedule:[],years:[]};
const year={startDate:'2026-09-01',endDate:'2027-06-30',ordinaryWindow:{startTime:'08:30',endTime:'16:30'},reducedWindow:{startTime:'09:00',endTime:'13:00'},reducedDays:['2026-11-04'],holidays:['2026-11-05'],groups:[]};
school.years=[year];
const group1={childIds:['elna'],weeklySchedule:[session('pati',0,'10:00','10:30','pati')]};
const group2={childIds:['blai'],weeklySchedule:[session('dinar',0,'12:00','13:30','menjador')]};
test('jornada ordinària de curs sense grups, amb entrada i sortida',()=>{
 const monday=lib.schoolScheduleForCalendarDay(school,year,undefined,'elna','2026-11-02');
 assert.deepEqual(JSON.parse(JSON.stringify(monday.map(s=>[s.startTime,s.endTime]))),[['08:30','16:30']]);
 assert.equal(monday[0].id,'__school_window__0');
 assert.equal(lib.schoolScheduleForCalendarDay(school,year,undefined,'elna','2026-11-07').length,0);
 assert.equal(lib.schoolScheduleForCalendarDay(school,year,undefined,'elna','2026-11-05').length,0);
});
test('els grups poden tenir activitats diferents que no canvien la jornada de l’escola',()=>{
 const a=lib.schoolScheduleForCalendarDay(school,year,group1,'elna','2026-11-02');
 const b=lib.schoolScheduleForCalendarDay(school,year,group2,'blai','2026-11-02');
 assert.deepEqual(JSON.parse(JSON.stringify(a.map(s=>[s.startTime,s.endTime]))),[['08:30','10:00'],['10:00','10:30'],['10:30','16:30']]);
 assert.deepEqual(JSON.parse(JSON.stringify(b.map(s=>[s.startTime,s.endTime]))),[['08:30','12:00'],['12:00','13:30'],['13:30','16:30']]);
});
test('jornada reduïda només retalla, festius no afegeixen activitats',()=>{
 const items=lib.schoolScheduleForCalendarDay(school,year,undefined,'elna','2026-11-04');
 assert.deepEqual(JSON.parse(JSON.stringify(items.map(s=>[s.startTime,s.endTime]))),[['09:00','13:00']]);
 const results=context.window.schoolCalendarUI.collect('2026-11-02',[{id:'elna',name:'Elna'}],[school],['centre'],lib.schoolScheduleForCalendarDay);
 assert.equal(results.length,1);
 assert.equal(results[0].kind,'Jornada escolar');
});
test('el validador conserva camps antics i comprova les noves hores',()=>{
 const clean=app.slice(app.indexOf('function cleanSchools('),app.indexOf('function cleanState('));
 assert.match(clean,/year\.ordinaryWindow/);
 assert.match(clean,/ordinaryWindow/);
 assert.match(app,/year\.ordinaryWindow = \{ startTime, endTime \}/);
 assert.match(app,/mode === 'ordinary' && \(!year\?\.ordinaryWindow/);
});
