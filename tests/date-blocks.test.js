import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
function setup(){
 const ctx=vm.createContext({window:{}});vm.runInContext(read('date-blocks.js'),ctx);const api=ctx.window.dateBlocks;
 const state={children:[{id:'a',name:'Alba'},{id:'b',name:'Bruc'}],guardians:[{id:'g',name:'Guiu',color:'#123456'},{id:'m',name:'Maria',color:'#654321'}],preferences:{visibleGuardians:['g','m'],visibleChildren:['a','b']},dateEdits:{}};
 const date='2026-11-19',data={
  nights:{a:[{from:0,to:1140,date:'2026-11-18',guardianId:'g',guardianName:'Guiu',guardianColor:'#123456',visible:true},{from:1140,to:1440,date,guardianId:'g',guardianName:'Guiu',guardianColor:'#123456',visible:true}]},
  activities:[{id:'school-session',schoolId:'school',childId:'a',schoolName:'Escola',kind:'Jornada escolar',description:'',color:'#78bb99',startTime:'09:00',endTime:'16:30',start:540,end:990},{id:'ec:1:2:3:4',schoolId:'ec:2',childId:'a',schoolName:'Karate',kind:'Extraescolar',description:'Karate · Grup A',color:'hsl(40 48% 55%)',startTime:'17:00',endTime:'18:00',start:1020,end:1080}],
  extra:[{rotationId:'pickup',childId:'a',rotationName:'Recollida',guardianId:'g',guardianName:'Guiu',color:'#123456',from:990,to:1140,startTime:'16:30',endTime:'19:00',visible:true}],
  slots:{a:[{id:'custom',name:'Guiu',guardianId:'g',from:720,to:750,startTime:'12:00',endTime:'12:30',color:'#123456',visible:true}]}
 };
 const values=fields=>{const all={name:'Canvi puntual',startTime:'10:00',endTime:'11:00',guardianId:'m',note:'Portar motxilla',...fields};return {get:k=>all[k]??null,has:k=>Object.hasOwn(all,k)};};
 let count=0;const save=(sourceId,fields={},childId='a',day=date)=>api.save(state,day,childId,sourceId,values(fields),data,()=>String(++count));
 return {ctx,api,state,date,data,values,save};
}
test('edita hores, tutor, nom i nota dels cinc tipus, només per data i fill, sense tocar el patró',()=>{
 for(const sourceId of ['activity:school:school-session','activity:ec%3A2:ec%3A1%3A2%3A3%3A4','rotation:pickup','night:2026-11-18','slot:custom']){
  const s=setup(),before=JSON.stringify(s.data);assert.equal(s.save(sourceId),'');
  const result=s.api.apply(s.state,s.date,s.state.children,s.data);
  const all=[...result.activities,...result.extra,...Object.values(result.nights).flat(),...Object.values(result.slots).flat()];
  const item=all.find(e=>e.dateBlock===sourceId);assert.ok(item);assert.equal(item.startTime,'10:00');assert.equal(item.endTime,'11:00');assert.equal(item.guardianId,'m');assert.equal(item.note,'Portar motxilla');assert.equal(item.blockName,'Canvi puntual');
  assert.equal(JSON.stringify(s.data),before);
  assert.deepEqual(plain(s.api.apply(s.state,'2026-11-20',s.state.children,s.data).activities.map(a=>a.startTime)),['09:00','17:00']);
  assert.deepEqual(plain(s.api.apply(s.state,s.date,[s.state.children[1]],s.data)),{nights:{},activities:[],slots:{},extra:[]});
 }
});
test('eliminar és una excepció recuperable: no suprimeix l’original i es pot restaurar individualment',()=>{
 const s=setup(),source='activity:ec%3A2:ec%3A1%3A2%3A3%3A4',before=JSON.stringify(s.data);
 assert.equal(s.api.remove(s.state,s.date,'a',source,s.data),true);
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities.length,1);
 assert.match(s.api.changes(s.state,s.date),/Eliminada aquest dia/);
 assert.equal(s.api.restore(s.state,s.date,'a',source),true);assert.equal(Object.keys(s.state.dateEdits).length,0);
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities.length,2);assert.equal(JSON.stringify(s.data),before);
});
test('afegir una franja, solapar-la, editar-la i eliminar-la sense perdre’n la recuperació',()=>{
 const s=setup();assert.equal(s.save('',{startTime:'17:00',endTime:'18:00'}),'');
 const result=s.api.apply(s.state,s.date,s.state.children,s.data),manual=result.slots.a.find(x=>x.id==='manual:1');
 assert.ok(manual);assert.equal(manual.name,'Canvi puntual');assert.equal(manual.guardianName,'Maria');
 assert.equal(s.api.save(s.state,s.date,'a','manual:1',s.values({name:'Natació',endAtMidnight:'yes',startTime:'23:00'}),result,()=> 'unused'),'');
 assert.equal(s.state.dateEdits[s.api.key(s.date,'a','manual:1')].endTime,'24:00');
 assert.equal(s.api.remove(s.state,s.date,'a','manual:1',result),true);assert.ok(!s.api.apply(s.state,s.date,s.state.children,s.data).slots.a.some(x=>x.id==='manual:1'));
 assert.equal(s.api.restore(s.state,s.date,'a','manual:1'),true);assert.ok(s.api.apply(s.state,s.date,s.state.children,s.data).slots.a.some(x=>x.id==='manual:1'));
});
test('validació atòmica de dates, hores, identitat, responsable, nota i límits de noms',()=>{
 const s=setup(),before=JSON.stringify(s.state);
 for(const [source,fields,child,day] of [['missing',{}],['',{startTime:'11:00',endTime:'10:00'}],['',{startTime:'24:00'}],['',{guardianId:'unknown'}],['',{name:''}],['',{note:'x'.repeat(2001)}],['',{},'unknown'],['',{},'a','2026-02-30']]){
  assert.ok(s.save(source,fields,child,day));assert.equal(JSON.stringify(s.state),before);
 }
});
test('JSON antic i JSON nou: conserva les edicions, les eliminacions i els fills existents',()=>{
 const s=setup();s.save('night:2026-11-18');s.save('activity:ec%3A2:ec%3A1%3A2%3A3%3A4');s.save('');
 s.api.remove(s.state,s.date,'a','rotation:pickup',s.data);
 assert.deepEqual(plain(s.api.clean(undefined,s.state.children,s.state.guardians)),{});
 assert.deepEqual(plain(s.api.clean(plain(s.state.dateEdits),s.state.children,s.state.guardians)),plain(s.state.dateEdits));
 assert.deepEqual(plain(s.api.clean(s.state.dateEdits,[],s.state.guardians)),{});
 for(const fields of [{color:'#bad; background:url(x)#ff0000'},{date:'2026-99-99'},{guardianId:'unknown'},{note:'x'.repeat(2001)},{kind:'manual',sourceId:'activity:x'}]){
  const raw=plain(s.state.dateEdits),entry=Object.values(raw)[0];Object.assign(entry,fields);assert.throws(()=>s.api.clean(raw,s.state.children,s.state.guardians));
 }
});
test('formularis: crear permet triar data i fill; editar mostra restaura i conserva el text com a text',()=>{
 const s=setup();s.save('activity:ec%3A2:ec%3A1%3A2%3A3%3A4',{name:'<img src=x>',note:'<script>mal</script>'});
 const form=s.api.form(s.state,s.date,'a','activity:ec%3A2:ec%3A1%3A2%3A3%3A4',s.data);
 assert.match(form,/data-date-block-form/);assert.match(form,/name="note"/);assert.match(form,/date-block-delete/);assert.match(form,/date-block-restore/);assert.doesNotMatch(form,/<img|<script>/);assert.match(form,/&lt;script&gt;/);
 assert.doesNotMatch(s.api.form(s.state,s.date,'a','',s.data),/readonly|date-block-delete/);
});
test('les franges s’identifiquen establement després d’aplicar una edició i respecten els filtres',()=>{
 const s=setup(),source='activity:ec%3A2:ec%3A1%3A2%3A3%3A4';s.save(source);
 const result=s.api.apply(s.state,s.date,s.state.children,s.data);
 assert.equal(s.api.find(s.state,s.date,'a',source,result).note,'Portar motxilla');
 s.save('night:2026-11-18');s.state.preferences.visibleGuardians=['g'];
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).nights.a[0].visible,false);
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities.length,2,'els filtres de tutors no amaguen l’escola');
});
test('esborrar un fill/tutor i restaurar un dia només afecta les edicions pertinents',()=>{
 const s=setup();s.save('');s.save('',{},'b');s.save('',{},'a','2026-11-20');
 s.api.removePerson(s.state,'guardian','m','g');assert.ok(Object.values(s.state.dateEdits).every(e=>e.guardianId==='g'));
 s.api.removePerson(s.state,'child','b');assert.ok(Object.values(s.state.dateEdits).every(e=>e.childId==='a'));
 s.api.clearDate(s.state,s.date);assert.equal(Object.values(s.state.dateEdits).length,1);assert.equal(Object.values(s.state.dateEdits)[0].date,'2026-11-20');
});

test('integració: tocar la franja obre el detall puntual; + tria data i editar conserva el desplaçament',()=>{
 const s=setup(),app=read('app.js'),section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
 Object.assign(s.ctx,{state:s.state,dateBlocks:s.api,tab:'calendar',calendarView:'week',selectedDate:s.date,sheet:null,activeChildren:()=>s.state.children,dateBlockSnapshot:()=>s.data,
  isValidDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d),childById:id=>s.state.children.find(c=>c.id===id),render:()=>{},update:()=>{},notify:()=>{},
  viewYear:2026,viewMonth:10,weekFocusTarget:false,parseDate:d=>new Date(d+'T12:00:00Z'),newId:()=> 'new',FormData:class {constructor(form){return new Map(Object.entries(form.values));}}});
 vm.runInContext(section('function clickAction(button)',"document.addEventListener('click'"),s.ctx);
 s.ctx.clickAction({dataset:{action:'edit-band',date:'2026-11-18',viewDate:s.date,child:'a',dateBlock:'night:2026-11-18'}});
 assert.equal(s.ctx.sheet.date,s.date,'la pernocta s’edita a la data que es veu, sense modificar el dia anterior');
 s.ctx.clickAction({dataset:{action:'open-school-activity',date:s.date,child:'a',dateBlock:'activity:school:school-session'}});
 assert.deepEqual(plain(s.ctx.sheet),{type:'dateBlock',date:s.date,childId:'a',sourceId:'activity:school:school-session'});
 vm.runInContext('function submitDateBlock(form,event){'+section('if (form.dataset.dateBlockForm)', 'if (form.dataset.daySlotForm)')+'}',s.ctx);
 s.ctx.submitDateBlock({dataset:{dateBlockForm:'true',date:s.date,child:'a',source:'activity:school:school-session'},values:{name:'Escola puntual',startTime:'10:00',endTime:'16:00',guardianId:'m',note:'Recollida especial'}},{preventDefault(){}});
 assert.equal(s.ctx.sheet,null);assert.equal(s.ctx.weekFocusTarget,false,'editar no recol·loca el dia a l’esquerra');assert.equal(s.ctx.selectedDate,s.date);
 s.ctx.clickAction({dataset:{action:'date-block-edit',date:s.date,child:'a',source:'activity:school:school-session',origin:'day'}});assert.equal(s.ctx.sheet.origin,'day');
 s.ctx.submitDateBlock({dataset:{dateBlockForm:'true',origin:'day',date:s.date,child:'a',source:'activity:school:school-session'},values:{name:'Escola revisada',startTime:'10:00',endTime:'16:00',guardianId:'m',note:'Nota revisada'}},{preventDefault(){}});
 assert.deepEqual(plain(s.ctx.sheet),{type:'dayEdit',date:s.date});
 s.ctx.clickAction({dataset:{action:'date-block-edit',date:s.date,child:'a',source:'activity:school:school-session',origin:'day'}});s.ctx.clickAction({dataset:{action:'close-sheet'}});assert.equal(s.ctx.sheet.type,'dayEdit');
 s.ctx.tab='extracurricular';s.ctx.clickAction({dataset:{action:'date-block-edit',date:s.date,child:'a',source:'activity:school:school-session',origin:'extracurricular'}});assert.equal(s.ctx.sheet.origin,'extracurricular');
 s.ctx.clickAction({dataset:{action:'date-block-discard',date:s.date,child:'a',source:'activity:school:school-session',origin:'extracurricular'}});assert.equal(s.ctx.sheet,null);assert.equal(s.ctx.tab,'extracurricular');assert.equal(Object.keys(s.state.dateEdits).length,0);
 s.ctx.tab='calendar';
 s.ctx.clickAction({dataset:{action:'date-block-add'}});assert.equal(s.ctx.sheet.sourceId,'');assert.equal(s.ctx.sheet.date,s.date);
 s.ctx.submitDateBlock({dataset:{dateBlockForm:'true',date:s.date,child:'a',source:''},values:{date:'2026-11-25',childId:'b',name:'Logopèdia',startTime:'18:00',endTime:'19:00',guardianId:'',note:'Sala 2'}},{preventDefault(){}});
 assert.equal(s.ctx.selectedDate,'2026-11-25');assert.equal(s.ctx.weekFocusTarget,true);assert.equal(Object.values(s.state.dateEdits).find(e=>e.kind==='manual').childId,'b');
});

test('identitats d’escoles amb separadors no col·lideixen i la PWA inclou el nou editor',()=>{
 const s=setup();s.data.activities=[{...s.data.activities[0],id:'b:c',schoolId:'a'},{...s.data.activities[0],id:'c',schoolId:'a:b'}];
 const all=s.api.apply(s.state,s.date,s.state.children,s.data).activities;assert.notEqual(all[0].dateBlock,all[1].dateBlock);
 const version=JSON.parse(read('package.json')).version;assert.ok(read('index.html').includes(`date-blocks.js?v=${version}`));assert.ok(read('sw.js').includes(`date-blocks.js?v=${version}`));
 assert.match(read('styles.css'),/\.week-add-block \{position:fixed;/);assert.match(read('src/app.ts'),/data-action="date-block-add" aria-label="Afegeix una franja"/);
});

test('les franges renderitzades mantenen referències d’edició, notes i tutors sense injectar HTML',()=>{
 const s=setup();vm.runInContext(read('day-timeline.js'),s.ctx);s.save('activity:school:school-session',{note:'<img src=x>'});
 const data=s.api.apply(s.state,s.date,s.state.children,s.data),html=s.ctx.window.dayTimelineUI.renderWeek(s.date,[{date:s.date,label:'Dijous',activities:data.activities,nightSegments:data.nights,customSlots:data.slots,rotatingSlots:data.extra}],s.state.children);
 assert.equal((html.match(/data-date-block="[^\"]+"/g)||[]).length,6);
 assert.match(html,/data-view-date="2026-11-19"[^>]+data-date-block="night:2026-11-18"/);
 assert.match(html,/class="day-block-guardian">Maria/);assert.match(html,/class="day-block-note"[^>]*>&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img/);
 vm.runInContext(read('month-day-ui.js'),s.ctx);assert.equal(s.ctx.window.monthDayUI.hasChanges(s.state,s.date),true);assert.equal(s.ctx.window.monthDayUI.hasChanges(s.state,'2026-11-20'),false);
});


test('la revisió del dia conserva estat, fill, tutor, nota i accions, sense llista global',()=>{
 const s=setup();s.save('activity:ec%3A2:ec%3A1%3A2%3A3%3A4',{name:'Karate puntual',note:'<script>note</script>'});
 s.api.remove(s.state,s.date,'a','rotation:pickup',s.data);s.save('',{name:'Natació'},'b','2026-11-25');
 const day=s.api.changes(s.state,s.date);
 for(const word of ['Alba','Maria','Extraescolar','Modificada','Eliminada aquest dia','data-action="date-block-edit"','data-action="date-block-discard"','data-origin="day"'])assert.ok(day.includes(word),word);
 assert.match(day,/&lt;script&gt;note/);assert.doesNotMatch(day,/<script>|Natació/);
 assert.equal(s.api.changes(s.state),'');
 assert.match(s.api.changes(s.state,'2027-01-01'),/Aquest dia no té canvis puntuals/);
});
test('desfer un canvi recupera l’original o treu una franja afegida, sense tocar la resta',()=>{
 const s=setup(),source='activity:school:school-session';s.save(source);s.save('');s.save('',{},'b');
 assert.equal(s.api.discard(s.state,s.date,'a',source),true);
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities[0].startTime,'09:00');
 assert.equal(s.api.discard(s.state,s.date,'a','manual:1'),true);
 assert.ok(!s.api.apply(s.state,s.date,s.state.children,s.data).slots.a.some(x=>x.id==='manual:1'));
 assert.equal(Object.values(s.state.dateEdits).length,1);assert.equal(Object.values(s.state.dateEdits)[0].childId,'b');
 assert.equal(s.api.discard(s.state,s.date,'a','manual:missing'),false);
});
test('editar una eliminació conserva l’estat fins que es demana recuperar-la explícitament',()=>{
 const s=setup(),source='activity:school:school-session';s.api.remove(s.state,s.date,'a',source,s.data);
 const form=s.api.form(s.state,s.date,'a',source,s.data,'day');assert.match(form,/name="disabled" checked/);assert.match(form,/data-origin="day"/);
 assert.equal(s.save(source,{disabled:'on',note:'Avís de l’absència'}),'');
 assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities.length,1);
 assert.equal(s.api.find(s.state,s.date,'a',source,s.data).note,'Avís de l’absència');
 assert.equal(s.save(source),'');assert.equal(s.api.apply(s.state,s.date,s.state.children,s.data).activities.length,2);
});
test('els canvis són només dins del seu curs, extraescolar i grup, de més antic a més recent',()=>{
 const s=setup();vm.runInContext(read('extracurricular.js'),s.ctx);const ec=s.ctx.window.extracurricular;
 const nav={courseId:'c:1%',activityId:'a:2%',groupId:'g:3%'};
 const groups=[{id:nav.groupId,name:'Grup A',childIds:['a','b'],weeklySchedule:[{id:'session:%',weekday:3,startTime:'17:00',endTime:'18:00'}]},{id:nav.groupId+'2',name:'Grup B',childIds:['a'],weeklySchedule:[{id:'other',weekday:3,startTime:'17:00',endTime:'18:00'}]}];
 const activity={id:nav.activityId,name:'Música',groups},course={id:nav.courseId,startDate:'2026-09-01',endDate:'2027-06-30',activities:[activity,{...activity,id:'other-activity',name:'Teatre'}]};
 s.state.extracurricularCourses=[course,{...course,id:'other-course',activities:[{...activity,name:'Dansa'}]}];
 s.data.activities=ec.collect(s.state,s.date,s.state.children);
 const all=s.api.apply(s.state,s.date,s.state.children,s.data).activities;
 const source=(name,group='Grup A')=>all.find(e=>e.childId==='a'&&e.schoolName===name&&e.description.includes(group)).dateBlock;
 const own=source('Música');s.save(own,{name:'Recent'},'a','2026-11-26');s.save(own,{name:'Antic'},'a','2026-11-12');s.api.remove(s.state,s.date,'a',own,s.data);
 s.save(source('Música','Grup B'),{name:'Altre grup'});s.save(source('Teatre'),{name:'Altra extraescolar'});s.save(source('Dansa'),{name:'Altre curs'});s.save('',{name:'Manual sense grup'});
 for(const page of [{},{courseId:nav.courseId},{courseId:nav.courseId,activityId:nav.activityId}])assert.doesNotMatch(ec.page(s.state,page),/Canvis puntuals/);
 const html=ec.page(s.state,nav);
 assert.ok(html.indexOf('12/11/2026')<html.indexOf('19/11/2026'));assert.ok(html.indexOf('19/11/2026')<html.indexOf('26/11/2026'));
 assert.match(html,/Antic/);assert.match(html,/Recent/);assert.match(html,/Eliminada aquest dia/);
 assert.doesNotMatch(html,/Altre grup|Altra extraescolar|Altre curs|Manual sense grup|date-block-discard|date-block-restore/);
 assert.equal((html.match(/data-action="date-block-edit"/g)||[]).length,3,'la llista només obre el detall');
 const form=s.api.form(s.state,s.date,'a',own,s.data,'extracurricular');
 assert.match(form,/data-action="date-block-discard"/);assert.match(form,/Elimina el canvi puntual/);assert.match(form,/name="disabled" checked/);assert.doesNotMatch(form,/date-block-delete|date-block-restore/);
 activity.groups[0].weeklySchedule=[];activity.groups[0].childIds=[];
 assert.match(ec.page(s.state,nav),/Antic/,'un canvi desat no desapareix si canvia l’horari o la inscripció');
 const before=JSON.stringify(s.state.dateEdits);ec.page(s.state,nav);assert.equal(JSON.stringify(s.state.dateEdits),before,'mostrar la llista no migra ni altera dades');
 assert.deepEqual(plain(s.api.clean(s.state.dateEdits,s.state.children,s.state.guardians)),plain(s.state.dateEdits));
});


test('una franja compartida deixa triar el fill i l’edició puntual només desagrupa aquell fill',()=>{
 const s=setup(),app=read('app.js'),section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
 s.data.activities.push({...s.data.activities[0],childId:'b'});
 Object.assign(s.ctx,{state:s.state,dateBlocks:s.api,tab:'calendar',calendarView:'week',selectedDate:s.date,sheet:null,activeChildren:()=>s.state.children,dateBlockSnapshot:()=>s.data,
  isValidDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d),childById:id=>s.state.children.find(c=>c.id===id),render:()=>{},update:()=>{},notify:()=>{},
  viewYear:2026,viewMonth:10,weekFocusTarget:false,parseDate:d=>new Date(d+'T12:00:00Z'),newId:()=> 'new',FormData:class {constructor(form){return new Map(Object.entries(form.values));}}});
 vm.runInContext(section('function clickAction(button)',"document.addEventListener('click'"),s.ctx);
 vm.runInContext(read('day-timeline.js'),s.ctx);
 const applied=s.api.apply(s.state,s.date,s.state.children,s.data),render=()=>s.ctx.window.dayTimelineUI.renderWeek(s.date,[{date:s.date,label:'Dijous',activities:applied.activities,nightSegments:applied.nights,customSlots:applied.slots,rotatingSlots:applied.extra}],s.state.children);
 const shared=render().match(/<button[^>]*data-session="school-session"[^>]*>/)[0];
 const members=JSON.parse(shared.match(/data-shared-blocks="([^"]+)"/)[1].replaceAll('&quot;','"'));
 s.ctx.clickAction({dataset:{date:s.date,sharedBlocks:JSON.stringify(members),dateBlock:'activity:school:school-session'}});assert.equal(s.ctx.sheet.type,'sharedBlock');assert.equal(s.ctx.sheet.members.length,2);
 s.ctx.clickAction({dataset:{action:'date-block-choose',date:s.date,child:'b',source:'activity:school:school-session'}});assert.equal(s.ctx.sheet.childId,'b');assert.equal(s.ctx.sheet.type,'dateBlock');
 vm.runInContext('function submitDateBlock(form,event){'+section('if (form.dataset.dateBlockForm)', 'if (form.dataset.daySlotForm)')+'}',s.ctx);
 s.ctx.submitDateBlock({dataset:{dateBlockForm:'true',date:s.date,child:'b',source:'activity:school:school-session'},values:{name:'Escola',startTime:'10:00',endTime:'16:30',guardianId:'',note:'Només Bruc'}},{preventDefault(){}});
 const changed=s.api.apply(s.state,s.date,s.state.children,s.data).activities;
 assert.equal(changed.find(e=>e.childId==='a'&&e.id==='school-session').startTime,'09:00');assert.equal(changed.find(e=>e.childId==='b'&&e.id==='school-session').startTime,'10:00');assert.equal(Object.values(s.state.dateEdits).length,1);
 const html=s.ctx.window.dayTimelineUI.renderWeek(s.date,[{date:s.date,label:'Dijous',activities:changed,nightSegments:{}}],s.state.children);
 assert.equal((html.match(/data-session="school-session"/g)||[]).length,2);assert.doesNotMatch(html.match(/<button[^>]*data-session="school-session"[^>]*>/g).join(''),/data-shared-blocks/);
});
