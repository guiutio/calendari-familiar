import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

const context={window:{}};
vm.runInNewContext(read('school-schedule-core.js'),context);
vm.runInNewContext(read('school-timeline.js'),context);
const core=context.window.schoolScheduleCore,ui=context.window.schoolCalendarUI;
const activity=(id,weekday,startTime,endTime,kind='classe',label='')=>({id,weekday,startTime,endTime,kind,label});
const first={id:'base',weekday:0,startTime:'09:00',endTime:'12:00',kind:'classe',label:''};
const child={id:'elna',name:'Elna'};
const group={id:'g',name:'Primer',childIds:['elna'],weeklySchedule:[activity('pati',0,'10:00','10:30','pati')],childSchedules:{},reducedChildSchedules:{}};
const year={id:'2026',startDate:'2026-09-01',endDate:'2027-06-30',groups:[group],holidays:['2026-11-03'],reducedDays:['2026-11-02'],reducedWindow:{startTime:'09:00',endTime:'10:15'}};
const school={id:'escola',name:'Escola',color:'#aabbcc',childIds:['elna'],weeklySchedule:[first],years:[year]};

test('una escola defineix horari ordinari sense grup ni curs',()=>{
 const bare={...school,years:[]};
 const sessions=ui.collect('2026-11-02',[child],[bare],['escola'],(s,y,g,id,d)=>s.weeklySchedule);
 assert.equal(sessions.length,1);
 assert.equal(sessions[0].startTime,'09:00');
 assert.equal(sessions[0].endTime,'12:00');
 assert.equal(ui.collect('2026-11-02',[child],[bare],[],(s)=>s.weeklySchedule).length,0);
});

test('l’activitat del grup substitueix només els minuts ocupats',()=>{
 const combined=core.combine([first],group.weeklySchedule);
 assert.deepEqual(Array.from(combined,x=>[x.startTime,x.endTime,x.kind]),[
   ['09:00','10:00','classe'],['10:00','10:30','pati'],['10:30','12:00','classe']
 ]);
 assert.equal(core.within([first],0,'10:00','10:30'),true);
 assert.equal(core.within([first],0,'12:00','13:00'),false);
 assert.deepEqual(Array.from(core.combine([first],[]),x=>[x.startTime,x.endTime]),[['09:00','12:00']]);
});

test('respecta festius i jornades reduïdes sense inventar hores',()=>{
 const sessions=ui.collect('2026-11-02',[child],[school],['escola'],(s,y,g,id,date)=>{
   const base=core.combine(s.weeklySchedule,g?.weeklySchedule??[]);
   if(y?.reducedDays.includes(date)){
     return base.map(a=>({...a,startTime:a.startTime<'09:00'?'09:00':a.startTime,endTime:a.endTime>'10:15'?'10:15':a.endTime})).filter(a=>a.startTime<a.endTime);
   }
   return base;
 });
 assert.deepEqual(Array.from(sessions,x=>[x.startTime,x.endTime]),[['09:00','10:00'],['10:00','10:15']]);
 assert.equal(ui.collect('2026-11-03',[child],[school],['escola'],()=>[first]).length,0);
});

test('interfície ordinària d’escola i absència de personalització individual',()=>{
 const ts=read('src/app.ts'),html=read('index.html'),sw=read('sw.js'),source=read('app.js');
 assert.match(ts,/function schoolMembershipPanel\(/);
 assert.match(ts,/data-action="school-membership-toggle"/);
 assert.match(ts,/data-action="ordinary-window-edit"/);
 assert.doesNotMatch(ts,/Personalitza l'horari/);
 assert.match(source,/case 'ordinary-window-edit'/);
 assert.match(html,/school-schedule-core\.js\?v=0\.5\.10/);
 assert.match(sw,/school-schedule-core\.js\?v=0\.5\.10/);
});
