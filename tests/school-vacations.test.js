import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const between=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 let saves=0,ids=0;const messages=[];
 const children=[{id:'c',name:'Fill',birthDate:''}];
 const group={id:'g',name:'Grup',tutorName:'',childIds:['c'],weeklySchedule:Array.from({length:5},(_,weekday)=>({id:'a'+weekday,weekday,startTime:'09:00',endTime:'10:00',label:'Classe',kind:'classe'}))};
 const year={id:'y',startDate:'2026-09-01',endDate:'2027-06-30',holidays:['2026-12-25'],vacations:[],reducedDays:['2026-11-02'],ordinaryWindow:{startTime:'09:00',endTime:'17:00'},reducedWindow:{startTime:'09:00',endTime:'13:00'},groups:[group]};
 const school={id:'s',name:'Centre',color:'#123456',address:'',phone:'',childIds:['c'],weeklySchedule:[],years:[year]};
 const state={children,guardians:[],schools:[school],preferences:{visibleSchools:['s']},rotation:{assignments:{c:['pare','mare']}}};
 const ctx=vm.createContext({window:{},state,MAX_ROTATION_DAYS:3640,DEFAULT_CHANGE_TIME:'19:00',sheet:null,schoolNav:{},
  schoolById:id=>state.schools.find(s=>s.id===id),yearById:(s,id)=>s?.years.find(y=>y.id===id),groupById:(y,id)=>y?.groups.find(g=>g.id===id),childById:id=>children.find(c=>c.id===id),
  shortDate:String,schoolYearName:()=> 'Curs 2026-2027',icon:()=>'',render:()=>{},update:()=>saves++,notify:m=>messages.push(m),
  FormData:class{constructor(form){return new Map(Object.entries(form.fields));}}});
 for(const f of ['school-schedule-core.js','school-timeline.js'])vm.runInContext(readFileSync(new URL('../'+f,import.meta.url),'utf8'),ctx);
 ctx.schoolCalendarUI=ctx.window.schoolCalendarUI;
 vm.runInContext(between('const SESSION_KINDS', 'const BANDS')+between('function clippedWeeklySchedule', 'const $app')+
  between('function escapeHtml(', 'function emptyState(')+between('const SCHOOL_PALETTE','function cleanState(')+
  between('function schoolActivities(', 'function schoolReducedDay(')+between('function schoolInfoForDay(', 'function peoplePage(')+
  between('function schoolFormMarkup()', '/** Festius/reducció de tots els centres')+
  between('function clickAction(button)',"document.addEventListener('click'"),ctx);
 ctx.newId=()=> 'v'+(++ids);
 const body=between('if (!form.dataset.schoolForm)',"document.addEventListener('input'").trim();
 assert.ok(body.endsWith('});'));
 vm.runInContext('function submitSchool(form,event){'+body.slice(0,-3)+'}',ctx);
 const submit=(fields,id='',kind='vacation')=>ctx.submitSchool({dataset:{schoolForm:kind,school:'s',year:'y',vacation:id},fields},{preventDefault(){}});
 const click=(action,id)=>ctx.clickAction({dataset:{action,school:'s',year:'y',vacation:id}});
 return {ctx,state,school,year,group,children,submit,click,messages,get saves(){return saves;}};
}
const christmas={name:'Vacances de Nadal',startDate:'2026-12-21',endDate:'2027-01-08'};

test('afegir, editar i eliminar un període conserva els festius individuals i les dades familiars',()=>{
 const s=setup(),family=JSON.stringify(s.state.rotation);s.submit(christmas);
 assert.equal(s.saves,1);assert.equal(s.year.vacations[0].name,christmas.name);
 const id=s.year.vacations[0].id;
 s.submit({...christmas,name:'Nadal actualitzat',endDate:'2027-01-06'},id);
 assert.equal(s.year.vacations.length,1);assert.equal(s.year.vacations[0].endDate,'2027-01-06');
 s.click('school-vacation-delete',id);
 assert.equal(s.year.vacations.length,0);assert.deepEqual(s.year.holidays,['2026-12-25']);
 assert.equal(JSON.stringify(s.state.rotation),family);assert.equal(s.saves,3);
});
test('cada dia de l’interval, inclosos els extrems i el canvi d’any, queda sense jornada ni activitats escolars',()=>{
 const s=setup();s.submit(christmas);
 for(let d=christmas.startDate;d<=christmas.endDate;d=s.ctx.addDays(d,1)){
  assert.equal(s.ctx.scheduleForSchoolDay(s.group,s.year,'c',d).length,0,d);
  assert.equal(s.ctx.schoolScheduleForCalendarDay(s.school,s.year,s.group,'c',d).length,0,d);
  assert.equal(s.ctx.schoolActivities(d,s.children).length,0,d);
 }
 for(const d of ['2026-12-18','2027-01-11'])assert.ok(s.ctx.schoolActivities(d,s.children).length>0,d);
 assert.match(s.ctx.schoolInfoForDay('2027-01-08'),/Vacances de Nadal/);
 assert.equal(s.ctx.schoolInfoForDay('2027-01-11'),'');
});
test('la recollida escolar respecta les vacances encara que rebi un horari antic sense aquesta lògica',()=>{
 const s=setup();s.submit(christmas);let calls=0;
 const out=s.ctx.window.schoolCalendarUI.collect('2026-12-21',s.children,[s.school],['s'],()=>{calls++;return s.group.weeklySchedule;});
 assert.equal(out.length,0);assert.equal(calls,0);
});
test('les vacances d’un centre no afecten els horaris d’un altre centre',()=>{
 const s=setup();s.submit(christmas);const other=plain(s.school);other.id='other';other.years[0].vacations=[];
 s.state.schools.push(other);s.state.preferences.visibleSchools.push('other');
 const items=s.ctx.schoolActivities('2026-12-21',s.children);
 assert.ok(items.length>0);assert.ok(items.every(item=>item.schoolId==='other'));
});
test('còpies antigues, exportació i reimportació mantenen els períodes amb nom',()=>{
 const s=setup();const legacy=plain(s.school);delete legacy.years[0].vacations;
 assert.deepEqual(plain(s.ctx.cleanSchools([legacy],s.children)[0].years[0].vacations),[]);
 s.submit(christmas);const data=plain(s.ctx.cleanSchools([plain(s.school)],s.children));
 const restored=s.ctx.cleanSchools(JSON.parse(JSON.stringify(data)),s.children);
 assert.deepEqual(plain(restored[0].years[0].vacations),plain(s.year.vacations));
});
test('rebutja noms buits, dates inexistents, intervals invertits, fora del curs i conflictes amb jornada reduïda',()=>{
 const s=setup();
 for(const fields of [{...christmas,name:' '},{...christmas,startDate:'2026-02-30'},{...christmas,endDate:'2026-12-20'},
  {...christmas,startDate:'2026-08-31'},{...christmas,endDate:'2027-07-01'},
  {...christmas,startDate:'2026-11-02',endDate:'2026-11-02'}]){
  s.submit(fields);assert.equal(s.year.vacations.length,0);assert.equal(s.saves,0);
 }
 s.submit({name:'Dia únic',startDate:'2027-02-01',endDate:'2027-02-01'});assert.equal(s.saves,1);
 assert.equal(s.ctx.schoolActivities('2027-02-01',s.children).length,0);
 for(const bad of [{},[{id:'v',name:'',startDate:'2026-12-21',endDate:'2027-01-08'}],
  [{id:'v',...christmas},{id:'v',...christmas}], [{id:'v',...christmas,endDate:'2027-07-01'}]]){
  const raw=plain(s.school);raw.years[0].vacations=bad;
  assert.throws(()=>s.ctx.cleanSchools([raw],s.children));
 }
});
test('els períodes superposats equivalen a la unió de dies festius i eliminar-ne un no altera els altres',()=>{
 const s=setup();s.submit(christmas);const first=s.year.vacations[0].id;
 s.submit({name:'Segon període',startDate:'2026-12-28',endDate:'2027-01-05'});
 s.click('school-vacation-delete',first);
 assert.equal(s.ctx.schoolActivities('2026-12-28',s.children).length,0);
 assert.ok(s.ctx.schoolActivities('2026-12-21',s.children).length>0);
 assert.equal(s.ctx.schoolActivities('2026-12-25',s.children).length,0,'El festiu individual es conserva');
});
test('el formulari té nom i dues dates, i les vacances impedeixen retallar el curs deixant-les fora',()=>{
 const s=setup();s.click('school-vacation-add');const html=s.ctx.schoolFormMarkup();
 assert.match(html,/name="name" type="text"[^>]+required/);
 assert.match(html,/name="startDate" type="date" min="2026-09-01" max="2027-06-30"/);
 assert.match(html,/name="endDate" type="date"/);
 assert.match(html,/inclosos l’inici i el final/);
 s.submit({...christmas,name:'Nadal <especial>'});const id=s.year.vacations[0].id;
 s.click('school-vacation-edit',id);assert.match(s.ctx.schoolFormMarkup(),/Nadal &lt;especial&gt;/);
 const saves=s.saves;s.submit({startDate:'2026-09-01',endDate:'2027-01-01'},'','year');
 assert.equal(s.saves,saves);assert.equal(s.year.endDate,'2027-06-30');
});
