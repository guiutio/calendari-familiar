import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const ui=context.window.dayTimelineUI;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
const people={pare:{id:'pare',name:'Pare',color:'#88bbee'},mare:{id:'mare',name:'Mare',color:'#eebbaa'}};
const guardian=id=>people[id];
const nights={};
for(const c of children)nights[c.id]=ui.overnightSegments('2026-10-28',c.id,'19:00',d=>d==='2026-10-27'?'mare':'pare',()=> '2026-10-27',guardian,['pare','mare']);
const activities=[{childId:'elna',schoolName:'Escola',schoolId:'escola',color:'#78ba64',start:540,end:600,startTime:'09:00',endTime:'10:00',id:'mates',kind:'Classe',description:''}];
const slots=[{id:'slot-1',childId:'elna',startTime:'16:00',endTime:'18:30',guardianId:'mare',guardianName:'Mare',guardianColor:'#eebbaa'}];

test('el mes mostra una miniatura proporcional de 24h, sense les cinc franges',()=>{
 const markup=ui.renderMini('2026-10-28',children,activities,nights,slots);
 assert.equal((markup.match(/class="month-mini-column"/g)||[]).length,2);
 assert.equal((markup.match(/class="month-mini-night"/g)||[]).length,4);
 assert.match(markup,/class="month-mini-school"/);
 assert.match(markup,/class="month-mini-custom"/);
 assert.match(markup,/top:37.5%;height:4.166666666666667%/); // escola 09:00–10:00
 assert.match(markup,/top:66.66666666666667%;height:10.416666666666666%/); // canvi puntual
 assert.doesNotMatch(markup,/mini-band-color|mini-grid/);
 assert.match(ts,/\$\{monthMiniDay\(date,children\)\}/);
 assert.doesNotMatch(ts.slice(ts.indexOf("if(calendarView==='month'){"),ts.indexOf("} else if(calendarView==='week'){")),/miniBands\(date/);
});

test('el detall del dia conserva la cronologia i té controls d’edició i restauració',()=>{
 const markup=ui.render('2026-10-28','Dimecres 28',children,activities,nights,'19:00',50,slots);
 assert.match(markup,/data-action="edit-day-slot" data-date="2026-10-28" data-slot="slot-1"/);
 assert.match(markup,/top:384px;height:60px/); // 16:00–18:30 a zoom 50%
 assert.match(markup,/data-action="edit-band" data-date="2026-10-27" data-band="nit"/);
 assert.match(markup,/day-school-block/);
 const detail=ts.slice(ts.indexOf("} else if(sheet?.type==='day'){"),ts.indexOf("} else if(sheet?.type==='daySlotForm'){"));
 assert.match(detail,/dayTimeline\(date,activeChildren\(\)\)/);
 assert.match(detail,/data-action="new-day-slot"/);
 assert.match(detail,/data-action="restore-day"/);
 assert.doesNotMatch(detail,/fullAgenda\(date\)/);
});

test('les franges puntuals es desen per data i es poden afegir, editar, treure i restaurar',()=>{
 assert.match(ts,/daySlots:Record<string,DaySlot\[\]>/);
 assert.match(ts,/daySlots\[date\]=valid/);
 assert.match(ts,/function daySlotsForView\(date:string\)/);
 assert.match(ts,/case 'delete-day-slot'/);
 assert.match(ts,/case 'restore-day'/);
 assert.match(ts,/delete state\.daySlots\[date\]/);
 assert.match(ts,/if\(form\.dataset\.daySlotForm\)/);
 assert.match(ts,/a\.startTime<endTime&&a\.endTime>startTime/);
 assert.match(css,/\.month-mini-track/);
 assert.match(css,/\.day-custom-block/);
});
