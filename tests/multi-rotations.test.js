import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const coreSource=readFileSync(new URL('../rotation-patterns.js',import.meta.url),'utf8');
const editorSource=readFileSync(new URL('../rotation-editor.js',import.meta.url),'utf8');
const monthSource=readFileSync(new URL('../month-day-ui.js',import.meta.url),'utf8');
const daySource=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const ctx={window:{}};
vm.runInNewContext(coreSource,ctx);
vm.runInNewContext(editorSource,ctx);
vm.runInNewContext(monthSource,ctx);
vm.runInNewContext(daySource,ctx);
const core=ctx.window.rotationPatterns,editor=ctx.window.rotationEditor;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
const guardians=[{id:'mare',name:'Mare',color:'#ffaacc'},{id:'pare',name:'Pare',color:'#88bbdd'}];
const rotation=(id,name,length,assignments)=>({
 id,name,startDate:'2026-10-26',length,startTime:'16:15',endTime:'17:45',
 childIds:Object.keys(assignments),assignments
});
const state=()=>({version:1,children,guardians,
 rotation:{startDate:'2026-10-26',length:7,changeTime:'19:00',assignments:{elna:Array(7).fill('pare'),blai:Array(7).fill('mare')}},
 nightPatternTimes:{},nightDateTimes:{},extraRotations:[],extraExceptions:{},daySlots:{},overrides:{},bandOverrides:{}});
const plain=v=>JSON.parse(JSON.stringify(v));

test('migra les dades v1 anteriors sense rotacions extres ni hores puntuals',()=>{
 const s=state();
 assert.deepEqual(plain(core.cleanExtras(undefined,children,guardians)),[]);
 assert.deepEqual(plain(core.cleanNightTimes(undefined,s.rotation)),{});
 assert.deepEqual(plain(core.cleanDateTimes(undefined)),{});
 assert.deepEqual(plain(core.cleanExtraExceptions(undefined,[],children,guardians)),{});
 assert.match(ts,/rotationPatterns\.cleanExtras\(obj\.extraRotations,children,guardians,MAX_ROTATION_DAYS\)/);
 assert.match(ts,/rotationPatterns\.cleanNightTimes\(obj\.nightPatternTimes,rotation\)/);
 assert.match(ts,/rotationPatterns\.cleanExtraExceptions\(obj\.extraExceptions,extraRotations,children,guardians\)/);
});
test('pernocta: el dia del patró i la data concreta tenen precedència independent',()=>{
 const s=state();
 s.nightPatternTimes={1:'18:00',6:'21:30'};
 s.nightDateTimes={'2026-11-03':'20:15'};
 assert.equal(core.nightTime('2026-10-26',s.rotation,s.nightPatternTimes,s.nightDateTimes),'19:00');
 assert.equal(core.nightTime('2026-10-27',s.rotation,s.nightPatternTimes,s.nightDateTimes),'18:00');
 assert.equal(core.nightTime('2026-11-03',s.rotation,s.nightPatternTimes,s.nightDateTimes),'20:15');
 assert.equal(core.nightTime('2026-11-10',s.rotation,s.nightPatternTimes,s.nightDateTimes),'18:00');
 assert.equal(core.nightTime('2026-10-25',s.rotation,s.nightPatternTimes,s.nightDateTimes),'21:30');
 assert.deepEqual(plain(core.cleanNightTimes(s.nightPatternTimes,s.rotation)),s.nightPatternTimes);
 assert.throws(()=>core.cleanNightTimes({7:'08:00'},s.rotation));
 assert.throws(()=>core.cleanDateTimes({'2026-02-30':'09:00'}));
 assert.match(ts,/nightChangeTime\(date\)/);
});
test('cada rotació addicional conserva durada i assignacions pròpies',()=>{
 const s=state(),pickup=rotation('pickup','Recollida escola',14,{elna:Array(14).fill('mare'),blai:Array(14).fill('pare')});
 const walk=rotation('walk','Camí a peu',3,{blai:['pare','mare','pare']});
 s.extraRotations=[pickup,walk];
 const loaded=core.cleanExtras(plain(s.extraRotations),children,guardians);
 assert.deepEqual(plain(loaded),plain(s.extraRotations));
 assert.equal(core.dayIndex('2026-11-10',pickup.startDate,pickup.length),1);
 assert.equal(core.dayIndex('2026-11-10',walk.startDate,walk.length),0);
 assert.throws(()=>core.cleanExtras([{...pickup,length:4}],children,guardians));
 assert.throws(()=>core.cleanExtras([{...pickup,endTime:'15:00'}],children,guardians));
 assert.equal(core.slots(s,'2026-10-26',children,guardians,['mare','pare']).length,3);
});
test('rotació addicional: canvis de responsable, hores i supressió puntual',()=>{
 const s=state();s.extraRotations=[rotation('pickup','Recollida escola',14,{elna:Array(14).fill('mare')})];
 let slots=core.slots(s,'2026-10-27',children,guardians,['mare','pare']);
 assert.equal(slots.length,1);assert.equal(slots[0].from,975);assert.equal(slots[0].to,1065);
 let err=editor.saveDate(s,'2026-10-27','pickup','elna',new Map([['startTime','17:00'],['endTime','18:15'],['guardianId','pare']]));
 assert.equal(err,'');
 slots=core.slots(s,'2026-10-27',children,guardians,['mare','pare']);
 assert.equal(slots[0].startTime,'17:00');assert.equal(slots[0].endTime,'18:15');
 assert.equal(slots[0].guardianName,'Pare');assert.equal(slots[0].overridden,true);
 assert.equal(core.slots(s,'2026-11-10',children,guardians,['mare','pare'])[0].guardianName,'Mare');
 const disable=new Map([['startTime','17:00'],['endTime','18:15'],['guardianId','pare'],['disabled','yes']]);
 assert.equal(editor.saveDate(s,'2026-10-27','pickup','elna',disable),'');
 assert.equal(core.slots(s,'2026-10-27',children,guardians,['mare','pare']).length,0);
 assert.throws(()=>core.cleanExtraExceptions({'pickup|2026-10-27|elna':{startTime:'18:00',endTime:'17:00',guardianId:'mare',disabled:false}},s.extraRotations,children,guardians));
 core.clearDate(s,'2026-10-27');assert.equal(Object.keys(s.extraExceptions).length,0);
});
test('afegir i copiar rotacions no toca les altres ni la pernocta',()=>{
 const s=state();
 const a=editor.create(s,'rot-a','2026-10-26');const b=editor.create(s,'rot-b','2026-10-26');
 assert.equal(a.length,7);assert.equal(a.startTime,'16:30');
 editor.click(s,'extra-child',{rotation:'rot-a',child:'blai'},()=>'', '2026-10-26',()=>true);
 editor.click(s,'extra-cell',{rotation:'rot-a',child:'elna',index:'0'},()=>'', '2026-10-26',()=>true);
 editor.click(s,'extra-copy',{rotation:'rot-a',child:'blai',from:'elna'},()=>'', '2026-10-26',()=>true);
 assert.equal(a.assignments.elna[0],a.assignments.blai[0]);
 assert.equal(b.assignments.elna[0],'');
 assert.equal(s.rotation.assignments.elna[0],'pare');
 const units={};
 assert.deepEqual(plain(editor.change(s,{rotation:'rot-a',extraChange:'length'},'3',units)),{save:true});
 assert.equal(a.length,3);
 assert.equal(b.length,7);
 assert.equal(editor.change(s,{rotation:'rot-a',extraChange:'startTime'},'19:00').error,'L’hora final ha de ser posterior a la inicial');
});
test('eliminacions netegen fills, tutors i excepcions de rotacions',()=>{
 const s=state();s.extraRotations=[rotation('pickup','Recollida escola',7,{elna:Array(7).fill('mare'),blai:Array(7).fill('pare')})];
 s.extraExceptions['pickup|2026-10-29|elna']={startTime:'16:00',endTime:'17:00',guardianId:'mare',disabled:false};
 core.removeGuardian(s,'mare');
 assert.equal(s.extraRotations[0].assignments.elna[0],'');
 assert.equal(s.extraExceptions['pickup|2026-10-29|elna'].guardianId,'');
 core.removeChild(s,'elna');
 assert.deepEqual(plain(s.extraRotations[0].childIds),['blai']);
 assert.equal(s.extraExceptions['pickup|2026-10-29|elna'],undefined);
});
test('Dia, Setmana i Mes contenen les franges de rotació i editors',()=>{
 const s=state(),pick=rotation('pickup','Recollida escola',14,{elna:Array(14).fill('mare')});
 s.extraRotations=[pick];
 const extra=core.slots(s,'2026-10-29',children,guardians,['pare','mare']);
 const night={elna:[],blai:[]};
 const day=ctx.window.dayTimelineUI.render('2026-10-29','Dijous',children,[],night,'19:00',50,{},extra);
 assert.match(day,/class="day-extra-block"/);assert.match(day,/data-action="edit-extra-slot" data-date="2026-10-29"/);
 const week=ctx.window.dayTimelineUI.renderWeek('2026-10-26',[{date:'2026-10-29',label:'Dj',activities:[],nightSegments:night,rotatingSlots:extra}],children,50,'2026-10-29','2026-10-29');
 assert.match(week,/day-extra-block/);
 const mini=ctx.window.monthDayUI.mini(children,night,[],{},extra);
 assert.match(mini,/month-mini-extra/);
 assert.match(ts,/data-action="extra-date-choose"/);
 assert.match(ts,/data-action="night-date-time"/);
 assert.match(ts,/data-action="rotation-pattern-time"/);
 assert.match(ts,/rotationEditor\.render\(state,extraRotationOpen,extraRotationUnits\)/);
 assert.match(html,/rotation-patterns\.js\?v=0\.6\.0/);
 assert.match(html,/rotation-editor\.js\?v=0\.6\.0/);
 assert.match(sw,/rotation-patterns\.js\?v=0\.6\.0/);
 assert.match(sw,/rotation-editor\.js\?v=0\.6\.0/);
});
