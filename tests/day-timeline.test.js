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
 assert.match(ts,/return weekTimeline\(weekStart\(selectedDate\),children\)/);
 assert.match(ts,/monthDayUI\.detail\(/); // detall mensual editable
 assert.match(ts,/monthDayUI\.mini\(/); // miniatura de 24 h
 assert.match(app,/dayTimelineUI\.overnightSegments/);
 assert.match(app,/previousTimeline\.getBoundingClientRect\(\)/);
 assert.match(css.slice(css.indexOf('/* v0.5.3')),/\.day-timeline-viewport \{[\s\S]*?height:auto;/);
 assert.match(html,/day-timeline\.js\?v=0\.27\.2/);
 assert.match(sw,/day-timeline\.js\?v=0\.27\.2/);
});
test('Dia omple l’alçada útil amb la mateixa proporció per a pernoctes i activitats',()=>{
 const segments=ui.overnightSegments('2026-10-28','elna','19:00',nights,prev,guardian,['mare','pare']);
 const render=zoom=>ui.render('2026-10-28','Dimecres',kids,[{childId:'elna',schoolId:'school',schoolName:'Escola',id:'class',kind:'Classe',color:'#77c455',start:540,end:600,startTime:'09:00',endTime:'10:00'}],{elna:segments},'19:00',zoom,{},[],720);
 const html=render(50);
 assert.match(html,/data-px-per-minute="0.5"/);assert.match(html,/--hour-height:30px/);
 assert.match(html,/top:270px;height:30px/);assert.match(html,/top:570px;height:150px/);
 assert.match(html,/top:720px">24:00/);assert.doesNotMatch(html,/<details|day-timeline-summary/);
 assert.match(render(100),/height:1152px/);
});
test('les pernoctes utilitzen l’hora de la rotació aplicable per fill',()=>{
 assert.match(ts,/rotationPatterns\.nightTimeFor\(state\.extraRotations,date,childId,state\.nightDateTimes\)/);
 assert.match(ts,/nightChangeTime\(date,c\.id\)/);
 const context={window:{}};vm.runInNewContext(readFileSync(new URL('../rotation-editor.js',import.meta.url),'utf8'),context);
 const state={children:[],extraRotations:[]};
 assert.equal(context.window.rotationEditor.create(state,'night','2026-11-01','night').startTime,'19:00');
});

test('mateix tutor: elimina la divisió visual sense perdre les dates dels dos editors de pernocta',()=>{
 const date='2026-10-28';
 const segments=ui.overnightSegments(date,'elna','19:00',()=> 'pare',prev,guardian,['pare']);
 const before=JSON.stringify(segments),html=ui.render(date,'Dimecres',kids,[],{elna:segments},'19:00');
 assert.match(html,/class="day-night-block night-continues-after"[^>]*data-date="2026-10-27"/);
 assert.match(html,/class="day-night-block night-continues-before"[^>]*data-date="2026-10-28"/);
 assert.equal((html.match(/data-action="edit-band"/g)||[]).length,2);
 assert.equal(JSON.stringify(segments),before);
 assert.match(css,/\.day-night-block\.night-continues-after \{border-bottom:0;/);
 assert.match(css,/\.day-night-block\.night-continues-before \{border-top:0;/);
 assert.match(css,/\.day-night-block\.night-continues-before > span \{visibility:hidden;/);
 const changed=ui.overnightSegments(date,'elna','19:00',nights,prev,guardian,['pare','mare']);
 assert.doesNotMatch(ui.render(date,'Dimecres',kids,[],{elna:changed},'19:00'),/night-continues/);
 segments[0].visible=false;
 assert.doesNotMatch(ui.render(date,'Dimecres',kids,[],{elna:segments},'19:00'),/night-continues/);
});

test('solapaments: escola, activitats i rotacions sagnades per nivells i reinici en acabar el grup',()=>{
 const entry=(id,start,end,priority=2)=>({item:{id},start,end,priority});
 const items=[entry('karate',1020,1080),entry('school',540,990),entry('pickup',990,1080,0),entry('art',750,810),entry('lunch',720,780),entry('evening',1080,1140)];
 const before=JSON.stringify(items),placed=ui.stackTimedBlocks(items);
 assert.deepEqual(Array.from(placed,e=>[e.item.id,e.depth,e.layer]),[
  ['school',0,2],['lunch',1,3],['art',2,4],['pickup',0,5],['karate',1,6],['evening',0,7]
 ]);
 assert.equal(JSON.stringify(items),before);
 const sameStart=ui.stackTimedBlocks([entry('short',600,660),entry('long',600,900),entry('assignment',600,900,0)]);
 assert.deepEqual(Array.from(sameStart,e=>[e.item.id,e.depth]),[['assignment',0],['long',1],['short',2]]);
});

test('l’amplada es manté amb sagnat limitat, capes independents per fill i les mateixes accions',()=>{
 const activity=(id,childId,start,end)=>({id,childId,start,end,startTime:'09:00',endTime:'16:30',schoolName:id,schoolId:'school',color:'#abc',kind:'Classe',description:''});
 const items=[activity('school','elna',540,990),activity('nested','elna',750,810),activity('other-child','blai',750,810)];
 const html=ui.render('2026-10-28','Dimecres',kids,items,{},'19:00');
 assert.match(html,/data-event-depth="1"[^>]*--event-indent:min\(6px,30%\)[^>]*data-session="nested"/);
 assert.match(html,/data-event-depth="0"[^>]*--event-indent:min\(0px,30%\)[^>]*data-session="other-child"/);
 assert.doesNotMatch(html,/width:calc\(100% \/|left:calc\(.*\*/);
 assert.equal((html.match(/data-action="open-school-activity"/g)||[]).length,3);
 const deep=ui.render('2026-10-28','Dimecres',kids,Array.from({length:20},(_,i)=>activity('deep'+i,'elna',540+i,990-i)),{},'19:00');
 assert.match(deep,/--event-indent:min\(114px,30%\)/);
 assert.match(css,/\.day-time-column > :is\(\[data-event-depth\],\.day-night-block\):focus-visible \{z-index:var\(--event-focus-layer\);\}/);
});
