import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context={window:{}};vm.runInNewContext(source,context);
const ui=context.window.dayTimelineUI;
const guardians=[{id:'mare',name:'Mare',color:'#eebacd'},{id:'pare',name:'Pare',color:'#80b2dd'}];
const guardian=id=>guardians.find(g=>g.id===id);
const nights=(_date,_id)=>_date==='2026-10-27'?'mare':'pare';
const prev=_date=>'2026-10-27';
const kids=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
test('hores de canvi de pernocta 19:00, amb dia anterior i següent',()=>{
 const parts=ui.overnightSegments('2026-10-28','elna','19:00',nights,prev,guardian,['mare','pare']);
 assert.deepEqual(Array.from(parts,a=>[a.from,a.to,a.date,a.guardianId]),[
  [0,1140,'2026-10-27','mare'],[1140,1440,'2026-10-28','pare']]);
 const second=ui.overnightSegments('2026-10-28','blai','21:30',nights,prev,guardian,['mare','pare']);
 assert.equal(second[0].to,1290);
 assert.equal(second[1].from,1290);
});
test('filtres de tutors oculten la pernocta però no alteren la línia temporal',()=>{
 const parts=ui.overnightSegments('2026-10-28','elna','19:00',nights,prev,guardian,['pare']);
 assert.deepEqual(Array.from(parts,x=>x.visible),[false,true]);
});
test('la línia temporal conté 24 hores, la nit i l’escola en columnes per fill',()=>{
 const a=ui.overnightSegments('2026-10-28','elna','19:00',nights,prev,guardian,['mare','pare']);
 const htmlOutput=ui.render('2026-10-28',"Dimecres, 28 d'octubre",kids,[{
  childId:'elna',schoolName:'Sant Marc',schoolId:'escola',color:'#77c455',
  start:540,end:990,startTime:'09:00',endTime:'16:30',
  id:'activitat',kind:'Jornada escolar',description:''
 }],{elna:a,blai:[]},'19:00');
 assert.doesNotMatch(htmlOutput,/Dia complet|Inici visible:|Canvi de pernocta:/);
 assert.doesNotMatch(htmlOutput,/day-timeline-intro/);
 assert.match(htmlOutput,/class="day-timeline-viewport"/);
 assert.match(htmlOutput,/data-initial-scroll="144"/);
 assert.match(htmlOutput,/24:00/);
 assert.match(htmlOutput,/day-night-block/);
 assert.match(htmlOutput,/day-school-block/);
 assert.match(htmlOutput,/Sant Marc/);
 assert.match(htmlOutput,/data-action="edit-band" data-date="2026-10-27" data-view-date="2026-10-28" data-band="nit"/);
 assert.match(htmlOutput,/09:00–16:30/);
 assert.match(htmlOutput,/Elna/);assert.match(htmlOutput,/Blai/);
 assert.doesNotMatch(htmlOutput,/class="agenda"/);
});
test('la nova vista només substitueix la graella de cinc franges al dia',()=>{
 assert.match(ts,/schoolInfoForDay\(selectedDate\)\}\$\{dayTimeline\(selectedDate,children\)/);
 assert.match(ts,/monthDayUI\.detail\(/); // detall mensual editable
 assert.match(ts,/monthDayUI\.mini\(/); // miniatura de 24 h
 assert.match(app,/dayTimelineUI\.overnightSegments/);
 assert.match(app,/previousTimeline\.getBoundingClientRect\(\)/);
 assert.match(css.slice(css.indexOf('/* v0.5.3')),/\.day-timeline-viewport \{[\s\S]*?height:auto;/);
 assert.match(html,/day-timeline\.js\?v=0\.6\.5/);
 assert.match(sw,/day-timeline\.js\?v=0\.6\.5/);
});
test('la rotació incorpora la nova hora per defecte, el desament i la importació',()=>{
 assert.match(ts,/const DEFAULT_CHANGE_TIME='19:00'/);
 assert.match(ts,/changeTime:DEFAULT_CHANGE_TIME/);
 assert.match(ts,/changeTime:validChangeTime\(obj\.rotation\.changeTime\)/);
 assert.match(ts,/data-action="rotation-change-time"/);
 assert.match(ts,/rotationDraft\.changeTime=validChangeTime/);
 assert.match(ts,/state\.rotation=JSON\.parse\(JSON\.stringify\(rotationDraft\)\)/);
});
