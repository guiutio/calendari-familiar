import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const guard=readFileSync(new URL('../scroll-guard.js',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const {render,renderWeek}=context.window.dayTimelineUI;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'},{id:'tercer',name:'Tercer'}];
const empty=Object.fromEntries(children.map(c=>[c.id,[]]));
test('dia: columnes compactes i alçada de 24h sense límit de scroll intern',()=>{
 const html=render('2026-10-28','Dimecres',children,[],empty,'19:00',50);
 assert.match(html,/min-width:346px/); // 52+3*98
 assert.match(html,/data-zoom="50"/);
 assert.doesNotMatch(html,/style="[^"]*height:.*?px" data-day-timeline/);
 assert.match(html,/class="day-timeline-viewport"/);
 assert.match(html,/height:576px/); // graella completa de 24h
});
test('setmana: 7 dies i 3 fills en columnes compactes',()=>{
 const dates=['2026-10-26','2026-10-27','2026-10-28','2026-10-29','2026-10-30','2026-10-31','2026-11-01'];
 const days=dates.map(date=>({date,label:date,activities:[],nightSegments:empty}));
 const html=renderWeek(dates[0],days,children,50);
 assert.match(html,/min-width:2110px/); // 52+7*3*98
 assert.match(html,/--week-day-width:294px/);
 assert.equal((html.match(/class="day-time-column"/g)||[]).length,21);
});
test('marges tàctils per a ambdues vistes i moviment vertical natural de pàgina',()=>{
 const rules=css.slice(css.indexOf('/* v0.5.3'));
 assert.match(rules,/\.day-timeline-viewport \{[\s\S]*?height:auto;[\s\S]*?overflow-x:auto;[\s\S]*?overflow-y:hidden;/);
 assert.match(rules,/\.day-timeline-inner \{width:max-content;min-width:0;/);
 assert.match(rules,/\.day-timeline-headers,\.day-timeline-grid \{grid-template-columns:52px repeat\(var\(--day-child-count\),98px\);/);
 assert.match(rules,/\.week-timeline-head,\.week-timeline-grid \{grid-template-columns:52px repeat\(var\(--week-day-count\),var\(--week-day-width,196px\)\);/);
 assert.match(guard,/const timeline = target\.closest\('\.day-timeline-viewport'\)/);
 assert.match(guard,/const scroller = timeline \? target\.closest\('\.main-area'\)/);
 assert.match(app,/main\.scrollTop = Math\.max\(0, newOffset \+ minuteAtCenter \* newScale - main\.clientHeight \/ 2\)/);
});
