import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const uiSource=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const sandbox={window:{}};vm.runInNewContext(uiSource,sandbox);
const ui=sandbox.window.dayTimelineUI;
const kids=[{id:'elna',name:'Elna'}],guardian={id:'pare',name:'Pare',color:'#8bb8e8'};
const nights=ui.overnightSegments('2026-10-28','elna','19:00',()=>guardian.id,()=> '2026-10-27',()=>guardian,['pare']);
const activity={childId:'elna',schoolName:'Escola',schoolId:'school',color:'#44aa55',start:540,end:600,startTime:'09:00',endTime:'10:00',id:'mat',kind:'Classe',description:''};
const day=zoom=>ui.render('2026-10-28','Dimecres 28',kids,[activity],{elna:nights},'19:00',zoom);
const week=zoom=>ui.renderWeek('2026-10-26',[{date:'2026-10-28',label:'Dimecres 28',activities:[activity],nightSegments:{elna:nights}}],kids,zoom);

test('sis nivells de zoom amb geometria temporal proporcional',()=>{
 const quarter=day(25),half=day(50),normal=day(100),large=day(150);
 assert.match(quarter,/data-zoom="25"/);
 assert.match(quarter,/data-px-per-minute="0.2"/);
 assert.match(quarter,/data-initial-scroll="72"/);
 assert.match(quarter,/height:288px/);
 assert.match(quarter,/top:108px;height:12px/);
 assert.doesNotMatch(quarter,/>01:00<\/span>/);
 assert.match(quarter,/>02:00<\/span>/);
 assert.match(half,/data-zoom="50"/);
 assert.match(half,/data-px-per-minute="0.4"/);
 assert.match(half,/data-initial-scroll="144"/);
 assert.match(half,/height:576px/); // 24 hores * 60 minuts * 0.4
 assert.match(half,/top:216px;height:24px/); // 09:00, durada 60 minuts
 assert.match(normal,/data-px-per-minute="0.8"/);
 assert.match(normal,/top:432px;height:48px/);
 assert.match(large,/data-px-per-minute="1.2"/);
 assert.match(large,/top:648px;height:72px/);
 assert.match(large,/height:1728px/);
});
test('setmana i dia fan servir la mateixa escala de zoom',()=>{
 const half=week(50),normal=week(100),quarter=week(25);
 assert.match(quarter,/data-px-per-minute="0.2"/);
 assert.match(quarter,/top:108px;height:12px/);
 assert.match(half,/data-px-per-minute="0.4"/);
 assert.match(half,/top:216px;height:24px/);
 assert.match(normal,/data-px-per-minute="0.8"/);
 assert.match(normal,/top:432px;height:48px/);
 assert.match(week(150),/height:1728px/);
});
test('el control està només en Dia i Setmana i és accessible',()=>{
 assert.match(ts,/calendarView==='day'\|\|calendarView==='week'/);
 assert.match(ts,/data-action="timeline-zoom"/);
 assert.match(ts,/data-action="timeline-zoom-step"/);
 assert.match(ts,/id="timeline-zoom"/);
 assert.match(ts,/min="0" max="5" step="1"/);
 assert.match(ts,/aria-valuetext/);
 assert.match(js,/const TIMELINE_ZOOM_LEVELS = \[25, 50, 75, 100, 125, 150\]/);
});
test('preferència desada, validada, importable i scroll centrat',()=>{
 assert.match(ts,/timelineZoom:50/);
 assert.match(ts,/TIMELINE_ZOOM_LEVELS.includes\(value\)\?value:50/);
 assert.match(ts,/timelineZoom:validTimelineZoom\(obj\.preferences\.timelineZoom\)/);
 assert.match(ts,/setTimelineZoomForView\(next\)/);
 assert.match(ts,/minuteAtCenter/);
 assert.match(ts,/newOffset\+minuteAtCenter\*newScale-main\.clientHeight\/2/);
 assert.match(ts,/timeline\.scrollLeft=timelineLeft/);
 assert.match(js,/timelineZoomForView\('day'\)/);
 assert.match(js,/timelineZoomForView\('week'\)/);
});
test('gradients horaris segueixen el zoom, i PWA actualitzada',()=>{
 assert.match(css,/--hour-height, 48px/);
 assert.match(css,/\.timeline-zoom-toolbar \{/);
 assert.match(css,/data-zoom="50"/);
 assert.match(css,/data-zoom="25"/);
 assert.match(css,/\.week-timeline-viewport \{/);
 assert.match(css,/overflow-y:hidden;/);
 assert.match(html,/app\.js\?v=0\.16\.23/);
 assert.match(sw,/app\.js\?v=0\.16\.23/);
});

test('Dia i Setmana desen i recuperen zooms independents en canviar de vista i reobrir',()=>{
 const start=js.indexOf('function validTimelineZoom('),end=js.indexOf('function isValidDate(',start);
 const writes=[];
 const ctx=vm.createContext({state:{preferences:{timelineZoom:75}},calendarView:'day',
  TIMELINE_ZOOM_LEVELS:[25,50,75,100,125,150],update:()=>writes.push(JSON.stringify(ctx.state)),sheet:{type:'zoom'}});
 vm.runInContext(js.slice(start,end),ctx);
 vm.runInContext(js.slice(js.indexOf('function clickAction(button)'),js.indexOf("document.addEventListener('click'")),ctx);
 assert.equal(ctx.timelineZoomForView(),75);
 ctx.setTimelineZoomForView(25);
 ctx.calendarView='week';assert.equal(ctx.timelineZoomForView(),75);
 ctx.setTimelineZoomForView(125);
 ctx.calendarView='day';assert.equal(ctx.timelineZoomForView(),25);
 assert.equal(writes.length,2);
 ctx.state=JSON.parse(writes.at(-1));
 assert.equal(ctx.timelineZoomForView('day'),25);assert.equal(ctx.timelineZoomForView('week'),125);
 ctx.calendarView='week';
 ctx.clickAction({dataset:{action:'timeline-zoom-step',step:'1'}});
 assert.equal(ctx.timelineZoomForView('week'),150);
 assert.equal(ctx.timelineZoomForView('day'),25);
 ctx.clickAction({dataset:{action:'timeline-zoom-step',step:'1'}});assert.equal(writes.length,3);
 ctx.calendarView='day';ctx.clickAction({dataset:{action:'timeline-zoom-step',step:'-1'}});assert.equal(writes.length,3);
 ctx.calendarView='month';ctx.setTimelineZoomForView(100);assert.equal(writes.length,3);
});
