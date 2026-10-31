import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const day=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const dayContext={window:{}};
vm.runInNewContext(day,dayContext);
const ui=dayContext.window.dayTimelineUI;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];

test('a Setmana es ressalta tota la columna d’avui i la capçalera, no els altres dies',()=>{
 const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
 const days=dates.map(date=>({date,label:date,activities:[],nightSegments:{}}));
 const output=ui.renderWeek('2026-10-26',days,children,50,'2026-10-29','2026-10-29');
 assert.match(output,/data-timeline-key="week:2026-10-26" data-focus-date="2026-10-29"/);
 assert.match(output,/class="week-day-header today" data-date="2026-10-29"/);
 assert.match(output,/class="week-date-columns today" data-date="2026-10-29"/);
 assert.match(output,/data-action="show-calendar-day" data-date="2026-10-29" aria-current="date"/);
 assert.match(output,/class="week-day-header" data-date="2026-10-28"/);
 assert.match(output,/class="week-date-columns" data-date="2026-10-28"/);
 assert.equal((output.match(/class="week-date-columns today"/g)||[]).length,1);
 assert.equal((output.match(/class="week-day-header today"/g)||[]).length,1);
 const otherFocus=ui.renderWeek('2026-10-26',days,children,50,'2026-10-27','2026-10-29');
 assert.match(otherFocus,/data-focus-date="2026-10-27"/);
 assert.match(otherFocus,/class="week-day-header today" data-date="2026-10-29"/);
});

test('el mes inverteix el fons de tot el requadre i elimina el cercle de la data',()=>{
 assert.match(ts,/class="day-cell[^\n]+\$\{date===today\?'today':''\}/);
 assert.match(ts,/\$\{date===today\?'aria-current="date"':''\}/);
 assert.match(css,/\.month-grid \.day-cell\.today\s*,[\s\S]*?background:#285782;/);
 assert.match(css,/\.month-grid \.day-cell\.today \.day-number\s*\{\s*background:transparent;\s*color:inherit;\s*border-radius:0;/);
 assert.match(css,/:root\[data-theme="dark"\] \.month-grid \.day-cell\.today[\s\S]*?background:#94c5ff;/);
 assert.match(css,/:root\[data-theme="dark"\] \.month-grid \.day-cell\.today \.day-number\s*\{\s*background:transparent;\s*color:inherit;\s*border-radius:0;/);
 assert.match(css,/\.month-grid \.day-cell\.today \.month-mini-child/);
 assert.match(css,/\.week-day-header\.today[\s\S]*?background:#285782;/);
 assert.match(css,/\.week-date-columns\.today \.day-time-column[\s\S]*?background:repeating-linear-gradient/);
 assert.match(html,/styles\.css\?v=0\.7\.1/);
 assert.match(sw,/calendari-familiar-v0\.7\.1/);
});

const between=(a,b)=>{
 const i=app.indexOf(a),j=app.indexOf(b,i);
 assert.ok(i>=0&&j>i,'Expected extract '+a);
 return app.slice(i,j);
};
const renderSource=between('function render() {','function notify(message)');

function simulateRender({oldFocus='',oldLeft=0,focusDate='2026-10-29',start='2026-10-26',visibleWidth=300,scrollWidth=1600}={}){
 let painted=false,searchCount=0;
 const monday=new Date(start+'T12:00:00Z');
 const getDate=index=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+index);return d.toISOString().slice(0,10);};
 const headers=Array.from({length:7},(_,index)=>({
   dataset:{date:getDate(index)},
   getBoundingClientRect:()=>({left:100+52+index*196})
 }));
 const rect=()=>({left:100,top:180});
 const oldTimeline=oldFocus?{
   dataset:{timelineKey:'week:'+start,focusDate:oldFocus,pxPerMinute:'0.4'},
   scrollLeft:oldLeft,getBoundingClientRect:rect
 }:null;
 const newTimeline={
   dataset:{timelineKey:'week:'+start,focusDate,pxPerMinute:'0.4'},
   scrollLeft:0,scrollTop:0,scrollWidth,clientWidth:visibleWidth,
   getBoundingClientRect:rect,
   querySelectorAll:selector=>{
     assert.equal(selector,'.week-day-header');searchCount++;return headers;
   }
 };
 const main={dataset:{scrollKey:'calendar|week|||'},scrollTop:0,clientHeight:700,getBoundingClientRect:()=>({top:0})};
 const $app={
   querySelector:selector=>{
     if(selector==='.day-timeline-viewport')return painted?newTimeline:oldTimeline;
     if(selector==='.main-area')return main;
     return null;
   },
   set innerHTML(value){assert.equal(value,'layout');painted=true;}
 };
 const context=vm.createContext({
   monthPosition:()=>null,stopCalendarScroll:null,mountCalendarScroll:()=>{},$app,tab:'calendar',calendarView:'week',selectedDate:focusDate,
   weekStart:()=>start,schoolNav:{},sheet:null,
   layout:()=> 'layout',calendarPage:()=> '',rotationPage:()=>'',schoolsPage:()=>'',settingsPage:()=>'',
   document:{body:{style:{overflow:''}}}
 });
 vm.runInContext(renderSource,context);vm.runInContext('render()',context);
 return {left:newTimeline.scrollLeft,searchCount};
}

test('en entrar a Setmana el scroll horitzontal col·loca el dia seleccionat després de l’eix d’hores',()=>{
 assert.deepEqual(simulateRender({focusDate:'2026-10-29'}),{left:588,searchCount:1});
 assert.deepEqual(simulateRender({focusDate:'2026-10-26'}),{left:0,searchCount:1});
 assert.deepEqual(simulateRender({focusDate:'2026-11-01'}),{left:1176,searchCount:1});
});

test('amb la mateixa setmana i dia es conserva el scroll manual en editar o canviar el zoom',()=>{
 assert.deepEqual(simulateRender({oldFocus:'2026-10-29',oldLeft:735,focusDate:'2026-10-29'}),{left:735,searchCount:0});
 assert.deepEqual(simulateRender({oldFocus:'2026-10-29',oldLeft:735,focusDate:'2026-10-30'}),{left:784,searchCount:1});
 assert.deepEqual(simulateRender({focusDate:'2026-11-01',visibleWidth:600,scrollWidth:1000}),{left:400,searchCount:1});
});

test('tocar una setmana actual enfoca avui; altres setmanes enfoquen el dilluns',()=>{
 const source=between('function clickAction(button) {',"document.addEventListener('click'");
 const context=vm.createContext({
   sheet:null,calendarView:'month',selectedDate:'2026-10-01',
   isValidDate:s=>/^\d{4}-\d{2}-\d{2}$/.test(s),
   weekStart:s=>s,
   localDate:()=> '2026-10-29',
   addDays:(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);},
   render:()=>{}
 });
 vm.runInContext(source,context);
 for(const [week,expected] of [['2026-10-26','2026-10-29'],['2026-11-02','2026-11-02'],['2026-10-19','2026-10-19']]){
   context.calendarView='month';
   context.clickAction({dataset:{action:'show-calendar-week',date:week}});
   assert.equal(context.selectedDate,expected);
   assert.equal(context.calendarView,'week');
 }
 assert.match(ts,/calendarView==='week'\?selectedDate/);
 assert.match(app,/const keepHorizontalScroll = keepTimeline &&/);
 assert.match(app,/timeline\.scrollLeft = Math\.max\(0, Math\.min\(timeline\.scrollWidth - timeline\.clientWidth, offset\)\)/);
});
