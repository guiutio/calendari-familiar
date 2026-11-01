import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js');
const between=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}],guardians=[{id:'g',name:'Tutor',color:'#aaccee'}];
 const weeklySchedule=Array.from({length:5},(_,weekday)=>({id:'s'+weekday,weekday,startTime:'09:00',endTime:'16:00',kind:'classe',label:''}));
 const group={id:'group',childIds:['elna'],weeklySchedule};
 const year={id:'year',startDate:'2026-09-01',endDate:'2027-06-30',holidays:['2026-11-02'],vacations:[{id:'v',name:'Nadal',startDate:'2026-12-22',endDate:'2027-01-07'}],reducedDays:['2027-06-21'],reducedWindow:{startTime:'09:00',endTime:'13:00'},groups:[group]};
 const school={id:'school',name:'Escola',color:'#aaccbb',childIds:[],weeklySchedule:[],years:[year]};
 const rotation={id:'pickup',name:'Recollida escola',startDate:'2026-10-26',length:7,startTime:'16:30',endTime:'19:30',childIds:['elna','blai'],assignments:{elna:Array(7).fill('g'),blai:Array(7).fill('g')},activeDays:Array(7).fill(true),schoolDaysOnly:true};
 const state={children,guardians,schools:[school],preferences:{visibleGuardians:['g'],visibleSchools:[]},extraRotations:[rotation],extraExceptions:{}};
 const ctx=vm.createContext({window:{},state});
 for(const file of ['school-schedule-core.js','rotation-patterns.js','rotation-editor.js','month-day-ui.js','day-timeline.js'])vm.runInContext(read(file),ctx);
 ctx.rotationPatterns=ctx.window.rotationPatterns;
 vm.runInContext(between('function localDate(', 'function initial(')+
  between('function clippedWeeklySchedule(', 'function inReducedWindow(')+
  between('function childHasSchool(', 'function monthData('),ctx);
 return {ctx,state,children,guardians,school,year,group,rotation,core:ctx.window.rotationPatterns,editor:ctx.window.rotationEditor};
}

test('aplica la condició per fill i data, sense dependre dels filtres ni del solapament horari',()=>{
 const s=setup();
 assert.equal(s.ctx.childHasSchool('2026-11-03','elna'),true);
 assert.equal(s.ctx.childHasSchool('2026-11-03','blai'),false);
 const slots=s.ctx.extraSlots('2026-11-03',s.children);
 assert.deepEqual(plain(slots.map(x=>x.childId)),['elna']);
 assert.equal(slots[0].startTime,'16:30','La recollida després de l’horari escolar continua aplicant-se');
 s.state.preferences.visibleSchools=['school'];
 assert.deepEqual(plain(s.ctx.extraSlots('2026-11-03',s.children)),plain(slots));
});

test('festius, vacances incloent extrems, caps de setmana i dates fora del curs no generen la franja',()=>{
 const s=setup();
 for(const date of ['2026-11-02','2026-12-22','2027-01-07','2026-11-07','2026-11-08','2026-08-31','2027-07-01']){
  assert.equal(s.ctx.childHasSchool(date,'elna'),false,date);
  assert.equal(s.ctx.extraSlots(date,s.children).length,0,date);
 }
 for(const date of ['2026-12-21','2027-01-08'])assert.equal(s.ctx.extraSlots(date,s.children).length,1,date);
});

test('la jornada reduïda és lectiva, també sense hores configurades, i no retalla la rotació',()=>{
 const s=setup();
 for(const configured of [true,false]){
  if(!configured)delete s.year.reducedWindow;
  const slots=s.ctx.extraSlots('2027-06-21',s.children);
  assert.equal(slots.length,1);assert.equal(slots[0].from,990);assert.equal(slots[0].to,1170);
 }
});

test('respecta horaris específics del fill i el calendari de cadascun dels centres',()=>{
 const s=setup();s.group.childSchedules={elna:[]};
 assert.equal(s.ctx.childHasSchool('2026-11-03','elna'),false);
 s.group.childSchedules.elna=[{id:'custom',weekday:2,startTime:'10:00',endTime:'12:00'}];
 assert.equal(s.ctx.childHasSchool('2026-11-03','elna'),false);
 assert.equal(s.ctx.childHasSchool('2026-11-04','elna'),true);
 const other=plain(s.school);other.id='other';other.years[0].holidays=[];other.years[0].groups[0].childIds=['blai'];
 s.state.schools.push(other);
 assert.deepEqual(plain(s.ctx.extraSlots('2026-11-02',s.children).map(x=>x.childId)),['blai']);
 s.state.schools=[];assert.equal(s.ctx.extraSlots('2026-11-04',s.children).length,0);
});

test('una matrícula sense horaris detallats aplica els dies laborables, i un horari amb dies concrets es respecta',()=>{
 const s=setup();s.group.weeklySchedule=[];
 assert.equal(s.ctx.childHasSchool('2026-11-03','elna'),true);
 assert.equal(s.ctx.childHasSchool('2026-11-07','elna'),false);
 s.school.childIds=['blai'];assert.equal(s.ctx.childHasSchool('2026-11-03','blai'),true);
 s.school.weeklySchedule=[{id:'only',weekday:2,startTime:'09:00',endTime:'12:00'}];
 assert.equal(s.ctx.childHasSchool('2026-11-03','elna'),false);
 assert.equal(s.ctx.childHasSchool('2026-11-04','elna'),true);
});

test('els dies inactius i les excepcions es mantenen, i una excepció no evita la condició escolar',()=>{
 const s=setup(),date='2026-11-03',key='pickup|'+date+'|elna';
 s.rotation.activeDays[1]=false;assert.equal(s.ctx.extraSlots(date,s.children).length,0);
 s.state.extraExceptions[key]={startTime:'17:00',endTime:'18:00',guardianId:'g',disabled:false};
 assert.equal(s.ctx.extraSlots(date,s.children)[0].startTime,'17:00');
 s.year.holidays.push(date);assert.equal(s.ctx.extraSlots(date,s.children).length,0);
 s.rotation.schoolDaysOnly=false;assert.equal(s.ctx.extraSlots(date,s.children).length,1,'La resta de dies inactius es conserva');
});

test('l’opció es desa amb l’esborrany i sobreviu l’exportació, importació i canvi de durada',()=>{
 const s=setup(),drafts={};s.rotation.schoolDaysOnly=false;
 const work=s.editor.draftState(s.state,drafts,'pickup');
 const before=s.editor.render(work,'pickup');
 assert.match(before,/type="checkbox" data-extra-change="schoolDaysOnly"/);
 assert.doesNotMatch(before,/data-extra-change="schoolDaysOnly"[^>]*checked/);
 s.editor.change(work,{rotation:'pickup',extraChange:'schoolDaysOnly'},'true',{});
 assert.equal(s.rotation.schoolDaysOnly,false,'Editar no canvia el patró desat');
 assert.match(s.editor.render(work,'pickup'),/data-extra-change="schoolDaysOnly"[^>]*checked/);
 assert.equal(s.editor.saveDraft(s.state,drafts,'pickup'),'');
 assert.equal(s.state.extraRotations[0].schoolDaysOnly,true);
 const restored=s.core.cleanExtras(JSON.parse(JSON.stringify(s.state.extraRotations)),s.children,s.guardians);
 assert.equal(restored[0].schoolDaysOnly,true);
 assert.equal(s.core.resized(restored[0],14,s.children).schoolDaysOnly,true);
});

test('les rotacions antigues continuen sense la restricció i la importació rebutja valors no booleans',()=>{
 const s=setup();delete s.rotation.schoolDaysOnly;
 const restored=s.core.cleanExtras(plain(s.state.extraRotations),s.children,s.guardians);
 assert.equal(restored[0].schoolDaysOnly,undefined);
 assert.equal(s.ctx.extraSlots('2026-11-07',s.children).length,2);
 for(const schoolDaysOnly of ['true',1,null])assert.throws(()=>s.core.cleanExtras([{...s.rotation,schoolDaysOnly}],s.children,s.guardians),/Condició de dies escolars/);
});

test('marcar i desmarcar la casella modifica el valor booleà de l’esborrany sense desar automàticament',()=>{
 const s=setup();s.rotation.schoolDaysOnly=false;
 let change;
 class Input{}
 Object.assign(s.ctx,{document:{addEventListener:(_name,callback)=>{change=callback;}},HTMLInputElement:Input,HTMLSelectElement:class{},
  rotationEditor:s.editor,extraRotationDrafts:{},extraRotationUnits:{},render:()=>{},notify:assert.fail});
 vm.runInContext(between("document.addEventListener('change'", "document.addEventListener('keydown'"),s.ctx);
 const input=new Input();Object.assign(input,{type:'checkbox',value:'on',checked:true,dataset:{extraChange:'schoolDaysOnly',rotation:'pickup'}});
 change({target:input});assert.equal(s.ctx.extraRotationDrafts.pickup.schoolDaysOnly,true);
 assert.equal(s.rotation.schoolDaysOnly,false);
 input.checked=false;change({target:input});assert.equal(s.ctx.extraRotationDrafts.pickup.schoolDaysOnly,false);
 assert.equal(s.rotation.schoolDaysOnly,false);
 input.checked=true;change({target:input});
 assert.equal(s.editor.saveDraft(s.state,s.ctx.extraRotationDrafts,'pickup'),'');
 assert.equal(s.state.extraRotations[0].schoolDaysOnly,true);
});

test('Mes, Setmana i Dia comparteixen la mateixa exclusió de franges sense escola',()=>{
 const s=setup(),date='2026-11-03',extra=s.ctx.extraSlots(date,s.children),nights={elna:[],blai:[]};
 const month=s.ctx.window.monthDayUI.mini(s.children,nights,[],{},extra);
 const day=s.ctx.window.dayTimelineUI.render(date,'Dimarts',s.children,[],nights,'19:00',50,{},extra);
 const week=s.ctx.window.dayTimelineUI.renderWeek('2026-11-02',[{date,label:'Dt',activities:[],nightSegments:nights,rotatingSlots:extra}],s.children,50,date,date);
 assert.equal((month.match(/class="month-mini-extra/g)||[]).length,1);
 for(const html of [day,week]){
  assert.equal((html.match(/data-action="edit-extra-slot"/g)||[]).length,1);
  assert.match(html,/data-rotation="pickup" data-child="elna"/);
  assert.doesNotMatch(html,/data-rotation="pickup" data-child="blai"/);
 }
});
