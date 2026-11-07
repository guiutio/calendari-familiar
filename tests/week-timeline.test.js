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
 assert.doesNotMatch(markup,/<details|day-timeline-summary|format de llista/);
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
 for(const date of dates)assert.ok(markup.includes(`data-action="focus-week-day" data-date="${date}"`));
 assert.equal((markup.match(/data-session="matematiques"/g)||[]).length,1);
 assert.ok(markup.includes('data-child="elna"'));
 assert.ok(markup.includes('data-child="blai"'));
 const empty=ui.renderWeek(dates[0],days,[]);
 assert.match(empty,/Selecciona algun fill/);
});
test('les 24 hores omplen l’alçada útil i tots els esdeveniments mantenen la proporció',()=>{
 const markup=ui.renderWeek(dates[0],days,children,50,'','',720);
 assert.match(markup,/data-px-per-minute="0.5"/);
 assert.match(markup,/--hour-height:30px/);
 assert.equal((markup.match(/class="day-time-column" style="height:720px"/g)||[]).length,14);
 assert.match(markup,/top:270px;height:30px/); // escola 09:00–10:00
 assert.match(markup,/top:570px;height:150px/); // pernocta 19:00–24:00
 assert.match(markup,/top:720px">24:00/);
 const zoom=ui.renderWeek(dates[0],days,children,100,'','',720);
 assert.match(zoom,/data-px-per-minute="0.8"/);
 assert.match(zoom,/height:1152px/); // el zoom gran continua permetent scroll vertical
 const quarter=ui.renderWeek(dates[0],days,children,25,'','',720);
 assert.match(quarter,/data-px-per-minute="0.5"/);
 assert.match(quarter,/top:720px">24:00/);
});
for(const calendarView of ['week'])test(`${calendarView}: l’ajust descompta la capçalera, respon als canvis de mida i es cancel·la en sortir`,()=>{
 const fitted=[];let callback,disconnected=false,pending,cancelled;
 const content={innerHTML:''};
 const main={clientWidth:402,clientHeight:780,querySelector:selector=>selector==='.content'?content:{offsetHeight:60}};
 const ctx=vm.createContext({tab:'calendar',calendarView,selectedDate:dates[0],
  weekStart:()=>dates[0],activeChildren:()=>children,weekTimeline:(_date,_children,height)=>{fitted.push(height);return 'fitted';},
  dayTimeline:(_date,_children,height)=>{fitted.push(height);return 'fitted';},
  ResizeObserver:class {constructor(fn){callback=fn;}observe(target){assert.equal(target,main);}disconnect(){disconnected=true;}},
  window:{requestAnimationFrame:fn=>{pending=fn;return 42;},cancelAnimationFrame:id=>{cancelled=id;}},
  render:()=>ctx.fitCalendarTimeline(main),stopCalendarScroll:null});
 vm.runInContext(js.slice(js.indexOf('function fitCalendarTimeline('),js.indexOf('function render()')),ctx);
 ctx.fitCalendarTimeline(main);
 assert.deepEqual(fitted,[720]);assert.equal(content.innerHTML,'fitted');
 callback();assert.equal(pending,undefined); // la primera observació no repinta
 main.clientHeight=580;callback();pending();
 assert.deepEqual(fitted,[720,520]);
 ctx.stopCalendarScroll();assert.equal(disconnected,true);assert.equal(cancelled,0);
 ctx.calendarView='month';ctx.fitCalendarTimeline(main);assert.equal(fitted.length,2);
});
test('la vista setmanal reusa la mateixa estructura de pernoctes i d’activitats que Dia',()=>{
 assert.match(source,/function buildColumns\(/);
 assert.match(source,/function renderWeek\(/);
 assert.match(source,/function render\(/);
 assert.match(ts,/return weekTimeline\(weekStart\(selectedDate\),children\)/);
 assert.doesNotMatch(ts,/content=\`<div class="week-agendas"/);
 assert.match(ts,/calendarView==='week'\?\`week:/);
 assert.match(ts,/case 'show-calendar-day'/);
 assert.match(js,/function weekTimeline\(/);
 assert.match(css,/\.week-timeline-head \{position:sticky;top:0;/);
 assert.match(css,/\.week-time-axis \{position:sticky;left:0;/);
 assert.match(css,/\.week-timeline-viewport \{max-width:100%;/);
});
