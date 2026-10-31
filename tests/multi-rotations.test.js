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
 childIds:Object.keys(assignments),assignments,activeDays:Array(length).fill(true)
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
 assert.equal(editor.savePatternDay(s,'rot-a','elna',0,new Map([['applies','yes'],['guardianId','pare']])), '');
 editor.click(s,'extra-copy',{rotation:'rot-a',child:'blai',from:'elna'},()=>'', '2026-10-26',()=>true);
 assert.equal(a.assignments.elna[0],a.assignments.blai[0]);
 assert.equal(b.assignments.elna[0],'');
 assert.equal(s.rotation.assignments.elna[0],'pare');
 const units={'rot-a':'days'};
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
 assert.match(day,/class="day-extra-block with-guardian"/);assert.match(day,/data-action="edit-extra-slot" data-date="2026-10-29"/);
 const week=ctx.window.dayTimelineUI.renderWeek('2026-10-26',[{date:'2026-10-29',label:'Dj',activities:[],nightSegments:night,rotatingSlots:extra}],children,50,'2026-10-29','2026-10-29');
 assert.match(week,/day-extra-block/);
 const mini=ctx.window.monthDayUI.mini(children,night,[],{},extra);
 assert.match(mini,/month-mini-extra/);
 assert.match(ts,/data-action="extra-date-choose"/);
 assert.match(ts,/data-action="night-date-time"/);
 assert.match(ts,/data-rotation-cell-form="true"/);
 assert.match(ts,/rotationEditor\.render\(state,extraRotationOpen,extraRotationUnits\)/);
 assert.match(html,/rotation-patterns\.js\?v=0\.7\.5/);
 assert.match(html,/rotation-editor\.js\?v=0\.7\.5/);
 assert.match(sw,/rotation-patterns\.js\?v=0\.7\.5/);
 assert.match(sw,/rotation-editor\.js\?v=0\.7\.5/);
});

test('les rotacions complementàries poden excloure dissabtes, diumenges o dies individuals del patró',()=>{
 const s=state(),pickup=rotation('pickup','Recollida escola',7,{elna:Array(7).fill('mare')});
 pickup.activeDays=[true,true,true,true,true,false,false];
 s.extraRotations=[pickup];
 assert.equal(core.slots(s,'2026-10-30',children,guardians,['mare']).length,1);
 assert.equal(core.slots(s,'2026-10-31',children,guardians,['mare']).length,0);
 assert.equal(core.slots(s,'2026-11-01',children,guardians,['mare']).length,0);
 assert.equal(core.slots(s,'2026-11-02',children,guardians,['mare']).length,1);
 const result=editor.savePatternDay(s,'pickup','elna',4,new Map([['applies','no'],['guardianId','mare']]));
 assert.equal(result,'');
 assert.equal(core.slots(s,'2026-10-30',children,guardians,['mare']).length,0);
 const normalized=core.cleanExtras(plain(s.extraRotations),children,guardians);
 assert.deepEqual(plain(normalized[0].activeDays),plain(pickup.activeDays));
 const dateChange=new Map([['startTime','16:15'],['endTime','17:45'],['guardianId','mare']]);
 assert.equal(editor.saveDate(s,'2026-10-30','pickup','elna',dateChange),'');
 assert.equal(core.slots(s,'2026-10-30',children,guardians,['mare']).length,1);
 assert.throws(()=>core.cleanExtras([{...pickup,activeDays:[true]}],children,guardians));
});

test('l’editor de canvi de pernocta afecta el dia visible, no la data de la nit anterior',()=>{
 assert.match(ts,/type:'bandEdit';date:string;childId:string;band:TimeBand;viewDate\?:string/);
 assert.match(ts,/sheet=\{type:'bandEdit',date,childId,band,viewDate:button\.dataset\.viewDate\?\?date\}/);
 assert.match(ts,/visibleDate=sheet\.viewDate\?\?date/);
 assert.match(ts,/data-action="night-date-time" data-date="\$\{escapeHtml\(visibleDate\)\}"/);
 assert.match(ts,/nightChangeTime\(visibleDate\)/);
});

test('les opcions de còpia són bidireccionals a cada rotació',()=>{
 const s=state(),r=rotation('recollida','Recollida',7,{elna:Array(7).fill('mare'),blai:Array(7).fill('pare')});
 s.extraRotations=[r];
 const rendered=editor.render(s,'recollida',{});
 assert.match(rendered,/data-action="extra-copy" data-rotation="recollida" data-child="elna" data-from="blai"/);
 assert.match(rendered,/data-action="extra-copy" data-rotation="recollida" data-child="blai" data-from="elna"/);
 editor.click(s,'extra-copy',{rotation:'recollida',child:'elna',from:'blai'},()=>'', '2026-10-26',()=>true);
 assert.equal(r.assignments.elna[0],'pare');
 assert.equal(r.assignments.blai[0],'pare');
});

test('una franja addicional amb tutor ocupa tota l’amplada; sense tutor deixa veure la responsabilitat',()=>{
 const s=state(),pickup=rotation('pickup','Recollida escola',7,{elna:Array(7).fill('mare'),blai:Array(7).fill('')});
 s.extraRotations=[pickup];
 const date='2026-10-29';
 const assertWidths=()=>{
   const slots=core.slots(s,date,children,guardians,['mare','pare']);
   assert.equal(slots.length,2);
   assert.equal(slots.find(x=>x.childId==='elna').guardianId,'mare');
   assert.equal(slots.find(x=>x.childId==='blai').guardianId,'');
   const nights={elna:[],blai:[]};
   const day=ctx.window.dayTimelineUI.render(date,'Dijous',children,[],nights,'19:00',50,{},slots);
   const week=ctx.window.dayTimelineUI.renderWeek('2026-10-26',[
     {date,label:'Dijous',activities:[],nightSegments:nights,rotatingSlots:slots}
   ],children,50,date,date);
   const miniature=ctx.window.monthDayUI.mini(children,nights,[],{},slots);
   for(const output of [day,week]){
     assert.match(output,/class="day-extra-block with-guardian" data-action="edit-extra-slot"[^>]+data-child="elna"/);
     assert.match(output,/class="day-extra-block without-guardian" data-action="edit-extra-slot"[^>]+data-child="blai"/);
     assert.equal((output.match(/data-action="edit-extra-slot"/g)||[]).length,2);
   }
   assert.match(miniature,/class="month-mini-extra with-guardian"/);
   assert.match(miniature,/class="month-mini-extra without-guardian"/);
   assert.equal((miniature.match(/class="month-mini-extra/g)||[]).length,2);
 };
 assertWidths();
 // Una excepció per data pot deixar una franja sense tutor, sense canviar-ne les hores.
 const params=new Map([['startTime','16:15'],['endTime','17:45'],['guardianId','']]);
 assert.equal(editor.saveDate(s,date,'pickup','elna',params),'');
 const changed=core.slots(s,date,children,guardians,['mare','pare']);
 assert.equal(changed.find(x=>x.childId==='elna').guardianId,'');
 const mini=ctx.window.monthDayUI.mini(children,{elna:[],blai:[]},[],{},changed);
 assert.equal((mini.match(/class="month-mini-extra without-guardian"/g)||[]).length,2);
 const day=ctx.window.dayTimelineUI.render(date,'Dijous',children,[],{elna:[],blai:[]},'19:00',50,{},changed);
 assert.equal((day.match(/class="day-extra-block without-guardian"/g)||[]).length,2);
 // Restaurar torna a mostrar el tutor de la rotació (i amplada completa).
 core.clearDate(s,date);
 assertWidths();
});

test('el posicionament de les barres mensuals i les amplades de Dia/Setmana es defineixen en CSS',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.day-extra-block \{[^\n]*left:23%;width:calc\(77% - 4px\)/);
 assert.match(css,/\.day-extra-block\.with-guardian \{left:0;width:100%;\}/);
 assert.match(css,/\.month-mini-extra \{display:block;position:absolute;z-index:4;left:48%;right:0/);
 assert.match(css,/\.month-mini-extra\.with-guardian \{left:0;right:0;\}/);
 assert.match(html,/month-day-ui\.js\?v=0\.7\.5/);
 assert.match(html,/day-timeline\.js\?v=0\.7\.5/);
 assert.match(sw,/month-day-ui\.js\?v=0\.7\.5/);
 assert.match(sw,/day-timeline\.js\?v=0\.7\.5/);
});


test('les setmanes mostren tots els dies, sense els D1...D7 de la part superior',()=>{
 const s=state(),r=rotation('pickup','Recollida escola',7,{
   elna:['mare','pare','pare','mare','pare','mare','pare'],
   blai:['pare','mare','mare','pare','mare','pare','mare']
 });
 r.activeDays=[false,false,true,false,false,false,false];s.extraRotations=[r];
 const html=editor.render(s,'pickup',{});
 const cells=[...html.matchAll(/data-action="extra-cell"[^>]*data-child="([^"]+)" data-index="([0-9]+)"/g)].map(m=>[m[1],Number(m[2])]);
 assert.equal(cells.length,14);
 for(const id of ['elna','blai'])assert.deepEqual(cells.filter(c=>c[0]===id).map(c=>c[1]),[0,1,2,3,4,5,6]);
 assert.doesNotMatch(html,/class="extra-active-days"/);
 assert.doesNotMatch(html,/data-action="extra-day-toggle"/);
 assert.match(html,/class="rotation-cell extra-pattern-cell extra-inactive"[^>]*data-child="elna" data-index="0"/);
 assert.match(html,/class="rotation-cell extra-pattern-cell extra-applies"[^>]*data-child="elna" data-index="2"/);
 assert.match(html,/Selecciona els fills participants/);
});

test('tocar una casella obre el formulari per decidir si s’aplica i qui és tutor',()=>{
 const s=state(),r=rotation('p','Trajecte',7,{elna:['pare','mare','pare','mare','pare','mare','pare']});
 r.activeDays=[true,false,true,false,false,false,false];s.extraRotations=[r];
 const html=editor.patternDayForm(s,'p','elna',1);
 assert.match(html,/data-extra-pattern-day-form="true"/);
 assert.match(html,/name="applies" value="no" checked/);
 assert.match(html,/name="guardianId" value="mare" checked/);
 assert.match(html,/Sense tutor assignat/);
 assert.match(html,/Aplica al patró/);
 const old=JSON.stringify(r.assignments.elna);
 assert.equal(editor.savePatternDay(s,'p','elna',1,new Map([['applies','yes'],['guardianId','pare']])), '');
 assert.equal(r.assignments.elna[1],'pare');
 assert.equal(s.extraRotations[0].childActiveDays.elna[1],true);
 assert.equal(editor.patternDayForm(s,'p','elna',1).includes('name="applies" value="yes" checked'),true);
 assert.notEqual(JSON.stringify(r.assignments.elna),old);
});

test('la casella es pot desactivar per a l’Elna sense afectar el mateix dia d’en Blai',()=>{
 const s=state(),r=rotation('p','Recollida',7,{
   elna:Array(7).fill('mare'),blai:Array(7).fill('pare')
 });s.extraRotations=[r];
 assert.equal(editor.savePatternDay(s,'p','elna',2,new Map([['applies','no'],['guardianId','mare']])), '');
 assert.equal(core.activeFor(r,'elna',2),false);
 assert.equal(core.activeFor(r,'blai',2),true);
 assert.equal(r.assignments.elna[2],'mare','La desactivació conserva el tutor per a una futura reactivació');
 const slots=core.slots(s,'2026-10-28',children,guardians,['mare','pare']);
 assert.deepEqual(plain(slots.map(item=>item.childId)),['blai']);
 assert.equal(editor.savePatternDay(s,'p','elna',2,new Map([['applies','yes'],['guardianId','']])), '');
 assert.equal(core.activeFor(r,'elna',2),true);
 assert.equal(r.assignments.elna[2],'');
 assert.equal(core.slots(s,'2026-10-28',children,guardians,['mare','pare']).length,2);
});

test('la còpia setmanal només afecta els dies actius del fill seleccionat',()=>{
 const s=state(),r=rotation('p','Recollida',14,{
   elna:['pare','pare','mare','pare','pare','mare','mare','mare','pare','pare','pare','pare','pare','mare']
 });
 r.activeDays=[false,false,true,false,true,false,false,false,false,false,false,false,false,false];s.extraRotations=[r];
 const before=plain(r.assignments.elna),rendered=editor.render(s,'p',{});
 assert.match(rendered,/data-action="extra-week" data-rotation="p" data-child="elna" data-week="0"/);
 assert.doesNotMatch(rendered,/data-action="extra-week" data-rotation="p" data-child="elna" data-week="1"/);
 assert.match(rendered,/Setmana 2/);
 editor.click(s,'extra-week',{rotation:'p',child:'elna',week:'0'},()=>'', '2026-10-26',()=>true);
 assert.equal(r.assignments.elna[4],'mare');
 for(let i=0;i<r.length;i++)if(!r.activeDays[i])assert.equal(r.assignments.elna[i],before[i]);
});

test('Tots igual i Copiar de copien també els dies que s’apliquen, per cada fill',()=>{
 const s=state(),r=rotation('p','Recollida',7,{
   elna:['pare','mare','mare','mare','pare','mare','pare'],
   blai:['mare','pare','pare','pare','mare','pare','mare']
 });r.activeDays=[false,false,true,false,false,false,false];s.extraRotations=[r];
 assert.equal(editor.savePatternDay(s,'p','elna',3,new Map([['applies','yes'],['guardianId','pare']])), '');
 assert.equal(core.activeFor(r,'elna',3),true);
 assert.equal(core.activeFor(r,'blai',3),false);
 editor.click(s,'extra-all',{rotation:'p'},()=>'', '2026-10-26',()=>true);
 assert.deepEqual(plain(r.childActiveDays.blai),plain(r.childActiveDays.elna));
 assert.deepEqual(plain(r.assignments.blai),plain(r.assignments.elna));
 assert.match(editor.render(s,'p',{}),/Tots els fills tenen el mateix patró/);
 assert.equal(editor.savePatternDay(s,'p','elna',4,new Map([['applies','yes'],['guardianId','mare']])), '');
 editor.click(s,'extra-copy',{rotation:'p',child:'blai',from:'elna'},()=>'', '2026-10-26',()=>true);
 assert.equal(core.activeFor(r,'blai',4),true);
 assert.equal(r.assignments.blai[4],'mare');
});

test('els set dies continuen disponibles encara que cap tingui franja activa',()=>{
 const s=state(),r=rotation('p','Recollida',7,{elna:Array(7).fill('mare'),blai:Array(7).fill('pare')});
 r.activeDays=Array(7).fill(false);s.extraRotations=[r];
 const rendered=editor.render(s,'p',{});
 assert.equal((rendered.match(/data-action="extra-cell"/g)||[]).length,14);
 assert.equal((rendered.match(/class="rotation-cell extra-pattern-cell extra-inactive"/g)||[]).length,14);
 assert.match(rendered,/data-action="extra-copy"/);
 assert.match(rendered,/data-action="extra-all"/);
 assert.doesNotMatch(rendered,/data-action="extra-week"/);
 assert.equal(editor.savePatternDay(s,'p','blai',6,new Map([['applies','yes'],['guardianId','']])), '');
 assert.equal(core.activeFor(r,'blai',6),true);
 assert.equal(core.activeFor(r,'elna',6),false);
});

test('es validen les dades de dies actius per fill, amb compatibilitat dels fitxers anteriors',()=>{
 const s=state(),r=rotation('p','Recollida',7,{elna:Array(7).fill('mare'),blai:Array(7).fill('pare')});
 s.extraRotations=[r];
 assert.equal(core.cleanExtras(plain(s.extraRotations),children,guardians)[0].childActiveDays,undefined);
 editor.savePatternDay(s,'p','elna',2,new Map([['applies','no'],['guardianId','mare']]));
 const restored=core.cleanExtras(plain(s.extraRotations),children,guardians);
 assert.equal(restored[0].childActiveDays.elna[2],false);
 assert.equal(core.slotFor({...s,extraExceptions:{}},restored[0],'2026-10-28','elna').disabled,true);
 assert.throws(()=>core.cleanExtras([{...r,childActiveDays:{elna:[true]}}],children,guardians),/Dies actius per fill/);
 assert.throws(()=>core.cleanExtras([{...r,childActiveDays:{elna:Array(7).fill('yes')}}],children,guardians),/Dies actius per fill/);
});

test('no es poden fer canvis amb fills, tutors o dies invàlids',()=>{
 const s=state(),r=rotation('p','Recollida',7,{elna:Array(7).fill('mare')});s.extraRotations=[r];
 const old=JSON.stringify(r);
 for(const [id,day,data] of [
  ['blai',0,new Map([['applies','yes'],['guardianId','mare']])],
  ['elna',7,new Map([['applies','yes'],['guardianId','mare']])],
  ['elna',0,new Map([['applies','maybe'],['guardianId','mare']])],
  ['elna',0,new Map([['applies','yes'],['guardianId','invalid']])]
 ])assert.notEqual(editor.savePatternDay(s,'p',id,day,data),'');
 assert.equal(JSON.stringify(r),old);
});
