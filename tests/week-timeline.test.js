import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const ui=context.window.dayTimelineUI;
const people=[{id:'mare',name:'Mare',color:'#dba0bd'},{id:'pare',name:'Pare',color:'#92b6da'}];
const guardian=id=>people.find(p=>p.id===id);
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
const weekdays=['Dl','Dt','Dc','Dj','Dv','Ds','Dg'];
const days=dates.map((date,i)=>{
 const nightSegments={};
 for(const child of children){
   const assigned=(day)=>day===date?'pare':'mare';
   nightSegments[child.id]=ui.overnightSegments(date,child.id,'19:00',assigned,()=>dates[i-1]??'2026-10-25',guardian,['mare','pare']);
 }
 return {date,label:`${weekdays[i]} ${26+i}`,activities:i===2?[{childId:'elna',schoolName:'Escola',schoolId:'escola',color:'#85bb69',start:540,end:600,startTime:'09:00',endTime:'10:00',id:'matematiques',kind:'Classe',description:''}]:[],nightSegments};
});
test('set dies, amb dues subcolumnes per dia i un sol eix de 24 hores',()=>{
 const markup=ui.renderWeek(dates[0],days,children);
 assert.match(markup,/data-timeline-key="week:2026-10-26"/);
 assert.match(markup,/data-initial-scroll="144"/);
 assert.match(markup,/--week-day-count:7/);
 assert.match(markup,/--week-child-count:2/);
 assert.equal((markup.match(/class="week-day-header"/g)||[]).length,7);
 assert.equal((markup.match(/class="week-date-columns"/g)||[]).length,7);
 assert.equal((markup.match(/class="day-time-column"/g)||[]).length,14);
 assert.equal((markup.match(/class="day-time-axis week-time-axis"/g)||[]).length,1);
 assert.match(markup,/24:00/);
 assert.match(markup,/09:00–10:00/);
 assert.match(markup,/Pernocta/);
});
test('capçaleres navegables amb dates, horaris independents i dades filtrables',()=>{
 const markup=ui.renderWeek(dates[0],days,children);
 for(const date of dates)assert.ok(markup.includes(`data-action="show-calendar-day" data-date="${date}"`));
 assert.equal((markup.match(/data-session="matematiques"/g)||[]).length,1);
 assert.ok(markup.includes('data-child="elna"'));
 assert.ok(markup.includes('data-child="blai"'));
 const empty=ui.renderWeek(dates[0],days,[]);
 assert.match(empty,/Selecciona algun fill/);
});
test('la vista setmanal reusa la mateixa estructura de pernoctes i d’activitats que Dia',()=>{
 assert.match(source,/function buildColumns\(/);
 assert.match(source,/function renderWeek\(/);
 assert.match(source,/function render\(/);
 assert.match(ts,/content=weekTimeline\(weekStart\(selectedDate\),children\)/);
 assert.doesNotMatch(ts,/content=\`<div class="week-agendas"/);
 assert.match(ts,/calendarView==='week'\?\`week:/);
 assert.match(ts,/case 'show-calendar-day'/);
 assert.match(js,/function weekTimeline\(/);
 assert.match(css,/\.week-timeline-head \{position:sticky;top:0;/);
 assert.match(css,/\.week-time-axis \{position:sticky;left:0;/);
 assert.match(css,/\.week-timeline-viewport \{max-width:100%;/);
});
