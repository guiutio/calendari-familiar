import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const setup=()=>{
 const context={window:{}};for(const p of ['month-day-ui.js','day-timeline.js'])vm.runInNewContext(read(p),context);
 const children=[{id:'a',name:'Alba',calendarSymbol:'🦊'},{id:'b',name:'Bruc'},{id:'c',name:'Clara'}],date='2026-11-19';
 const nights={},slots={},activities=[],rotations=[];
 for(const c of children){
  nights[c.id]=[{from:0,to:1140,date:'2026-11-18',guardianId:'g',guardianName:'Guiu',guardianColor:'#123456',visible:true},{from:1140,to:1440,date,guardianId:'g',guardianName:'Guiu',guardianColor:'#123456',visible:true}];
  slots[c.id]=[{id:'slot-'+c.id,childId:c.id,from:1080,to:1110,startTime:'18:00',endTime:'18:30',name:'Visita',color:'#654321',guardianId:'m',guardianName:'Maria'}];
  activities.push({id:'school-'+c.id,childId:c.id,schoolName:'Escola',schoolId:'s',color:'#78aa99',kind:'Jornada escolar',description:'',start:540,end:990,startTime:'09:00',endTime:'16:30'}, {id:'karate-'+c.id,childId:c.id,schoolName:'Karate',schoolId:'ec:k',color:'#bb8855',kind:'Extraescolar',description:'Karate · Grup A',start:1020,end:1080,startTime:'17:00',endTime:'18:00'});
  rotations.push({rotationId:'pickup-'+c.id,childId:c.id,from:990,to:1140,startTime:'16:30',endTime:'19:00',rotationName:'Recollida',color:'#654321',guardianId:'m',guardianName:'Maria',visible:true});
 }
 const mini=(view='month',kids=children)=>context.window.monthDayUI.mini(kids,nights,activities,slots,rotations,view);
 const week=(kids=children)=>context.window.dayTimelineUI.renderWeek(date,[{date,label:'Dijous 19',activities,nightSegments:nights,customSlots:slots,rotatingSlots:rotations}],kids);
 return {context,children,date,nights,slots,activities,rotations,mini,week};
};
const count=(html,cls)=>(html.match(new RegExp('class="'+cls+'(?:[ "])','g'))||[]).length;
const buttonTags=html=>html.match(/<button\b[^>]*>/g)||[];
test('Any i Mes agrupen tots els fills amb contingut idèntic; Mes conserva inicials i emojis',()=>{
 const s=setup(),before=JSON.stringify(s);
 for(const view of ['year','month']){const html=s.mini(view);assert.match(html,/--month-children:1/);assert.equal(count(html,'month-mini-column'),1);assert.match(html,/🦊 B C/);assert.match(html,/Alba, Bruc, Clara/);}
 assert.equal(JSON.stringify(s),before);
 s.nights.b[0].guardianId='other';assert.match(s.mini(),/--month-children:2/,'un tutor diferent no es confon encara que comparteixi color');
});
test('una diferència en escola, rotació o franja privada manté les miniatures separades',()=>{
 for(const change of [s=>s.activities[2].end=900,s=>s.activities[2].schoolName='Altra escola',s=>s.rotations[1].rotationName='Altra rotació',s=>s.slots.b[0].from=1100,s=>s.activities[2].note='Nota privada']){
  const s=setup();change(s);for(const view of ['year','month'])assert.match(s.mini(view),/--month-children:2/);
 }
});
test('Setmana manté tres columnes de noms i dibuixa una única franja de cada contingut compartit',()=>{
 const s=setup(),html=s.week();assert.match(html,/--week-child-count:3/);assert.equal(count(html,'day-time-column'),3);assert.equal(count(html,'week-child-label'),3);
 assert.equal(count(html,'day-night-block'),2);assert.equal(count(html,'day-school-block'),2);assert.equal(count(html,'day-slot-block'),1);assert.equal(count(html,'day-extra-block'),1);
 const merged=buttonTags(html).filter(t=>t.includes('data-shared-blocks='));assert.equal(merged.length,6);assert.ok(merged.every(t=>t.includes('--shared-span:3;')));
 assert.match(html,/slot-a/);assert.match(html,/slot-b/);assert.match(html,/slot-c/,'les referències individuals es conserven a la franja unificada');
});
test('els solapaments privats es queden a la columna pertinent i per damunt de la franja comuna',()=>{
 const s=setup();s.activities.push({...s.activities[0],id:'private',childId:'b',schoolName:'Logopèdia',start:720,end:780,startTime:'12:00',endTime:'13:00'});
 const html=s.week(),columns=html.split('class="day-time-column"').slice(1);
 assert.doesNotMatch(columns[0],/Logopèdia/);assert.match(columns[1],/Logopèdia/);assert.doesNotMatch(columns[2],/Logopèdia/);
 const common=buttonTags(html).find(t=>t.includes('data-session="school-a"')),privateTag=buttonTags(html).find(t=>t.includes('data-session="private"'));
 assert.match(common,/day-shared-block/);assert.doesNotMatch(privateTag,/day-shared-block/);
 assert.ok(Number(privateTag.match(/--event-layer:(\d+)/)[1])>Number(common.match(/--event-layer:(\d+)/)[1]));
});
test('les diferències d’hora, tutor, nota o nom trenquen només la franja afectada',()=>{
 for(const change of [s=>s.activities[2].start=550,s=>s.activities[2].note='Només Bruc',s=>s.activities[2].blockName='Nom diferent',s=>s.activities[2].guardianId='m']){
  const s=setup();change(s);const tags=buttonTags(s.week()).filter(t=>t.includes('data-session="school-'));
  assert.equal(tags.length,3,'A i C no cobreixen el fill B quan el seu contingut és diferent');assert.ok(tags.every(t=>!t.includes('data-shared-blocks')));
  assert.equal(count(s.week(),'day-extra-block'),1,'la rotació comuna es manté unificada');
 }
});
test('s’agrupen subconjunts consecutius i només els fills visibles',()=>{
 const s=setup();s.activities[4].note='Clara sola';
 const tags=buttonTags(s.week()).filter(t=>t.includes('data-session="school-'));assert.equal(tags.length,2);assert.match(tags[0],/--shared-span:2;/);assert.doesNotMatch(tags[1],/day-shared-block/);
 const filtered=s.week([s.children[0],s.children[2]]);assert.match(filtered,/--week-child-count:2/);const refs=buttonTags(filtered).filter(t=>t.includes('data-shared-blocks'));assert.ok(refs.every(t=>!t.includes('&quot;childId&quot;:&quot;b&quot;')));
 assert.equal(s.mini('year',[]),'');assert.match(s.week([]),/00:00/);
});
test('duplicats simultanis dins d’un fill no desapareixen i les dades originals no es modifiquen',()=>{
 const s=setup();s.activities.push({...s.activities[0],id:'second'});const before=JSON.stringify({nights:s.nights,activities:s.activities,slots:s.slots,rotations:s.rotations});
 assert.equal(buttonTags(s.week()).filter(t=>t.includes('data-session="school-')||t.includes('data-session="second"')).length,2);
 assert.equal(JSON.stringify({nights:s.nights,activities:s.activities,slots:s.slots,rotations:s.rotations}),before);
 assert.match(read('styles.css'),/\.day-time-column > \.day-shared-block \{width:calc/);
});
