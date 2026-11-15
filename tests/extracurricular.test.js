import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function setup(){
 const ctx=vm.createContext({window:{},Date,Intl});
 for(const file of ['extracurricular.js','month-day-ui.js','day-timeline.js'])vm.runInContext(read(file),ctx);
 const api=ctx.window.extracurricular;
 const state={extracurricularCourses:[],children:[{id:'a',name:'Alba',birthDate:'',calendarSymbol:'🦊'},{id:'b',name:'Bruc',birthDate:''}],preferences:{showExtracurriculars:true}};
 let serial=0;const id=()=>String(++serial);
 const values=fields=>({get:key=>fields[key]??null,getAll:key=>fields[key]??[]});
 const save=(editor,fields)=>api.save(state,editor,values(fields),id);
 const course=()=>save({kind:'course'},{startDate:'2026-09-01',endDate:'2027-06-30'}).nav;
 const activity=(nav,fields={})=>save({kind:'activity',...nav},{name:'Música',...fields}).nav;
 const group=(nav,fields={})=>save({kind:'group',...nav},{name:'Iniciació',childIds:['a'],...fields}).nav;
 const session=(nav,fields={})=>save({kind:'session',...nav},{weekday:'0',startTime:'17:00',endTime:'18:00',label:'Piano',...fields});
 return {ctx,api,state,save,course,activity,group,session};
}
const plain=value=>JSON.parse(JSON.stringify(value));
test('crear i editar el curs, l’extraescolar, el grup i l’activitat setmanal',()=>{
 const s=setup(),c=s.course(),a=s.activity(c,{address:'Carrer Major',phone:'123'}),g=s.group(a);assert.ok(s.session(g).nav);
 const {course,activity,group}=s.api.context(s.state,g);
 assert.equal(course.startDate,'2026-09-01');assert.equal(activity.address,'Carrer Major');assert.equal(activity.phone,'123');
 assert.deepEqual(plain(group.childIds),['a']);assert.equal(group.weeklySchedule[0].label,'Piano');
 s.save({kind:'session',...g,sessionId:group.weeklySchedule[0].id},{weekday:'2',startTime:'18:00',endTime:'19:00',label:''});
 assert.equal(group.weeklySchedule[0].weekday,2);assert.equal(group.weeklySchedule[0].label,'');
 s.save({kind:'group',...g},{name:'Avançat',childIds:['a','b','missing']});assert.deepEqual(plain(group.childIds),['a','b']);
 assert.equal(group.name,'Avançat');assert.equal(group.weeklySchedule.length,1);
 s.save({kind:'activity',...a},{name:'Teatre'});assert.equal(activity.name,'Teatre');assert.equal(activity.groups.length,1);assert.equal(activity.address,'');
});
test('els cursos es mostren del més recent al més antic sense reordenar les dades guardades',()=>{
 const s=setup();s.course();s.save({kind:'course'},{startDate:'2025-09-01',endDate:'2026-06-30'});s.save({kind:'course'},{startDate:'2027-09-01',endDate:'2028-06-30'});
 const before=JSON.stringify(s.state),html=s.api.page(s.state,{});
 assert.ok(html.indexOf('Curs 2027-2028')<html.indexOf('Curs 2026-2027'));assert.ok(html.indexOf('Curs 2026-2027')<html.indexOf('Curs 2025-2026'));
 assert.equal(JSON.stringify(s.state),before);
});
test('dates pròpies opcionals: permeten començar abans i acabar després del curs',()=>{
 const s=setup(),c=s.course(),a=s.activity(c,{startDate:'2026-08-01',endDate:'2027-07-31'}),g=s.group(a);s.session(g);
 assert.equal(s.api.collect(s.state,'2026-08-03',s.state.children).length,1);
 assert.equal(s.api.collect(s.state,'2027-07-26',s.state.children).length,1);
 assert.equal(s.api.collect(s.state,'2026-07-27',s.state.children).length,0);
 assert.equal(s.api.collect(s.state,'2027-08-02',s.state.children).length,0);
 s.save({kind:'activity',...a},{name:'Música',startDate:'2026-08-01',endDate:''});
 assert.deepEqual(plain(s.api.bounds(s.state.extracurricularCourses[0],s.api.context(s.state,a).activity)),['2026-08-01','2027-06-30']);
 s.save({kind:'activity',...a},{name:'Música',startDate:'',endDate:'2027-07-31'});
 assert.deepEqual(plain(s.api.bounds(s.state.extracurricularCourses[0],s.api.context(s.state,a).activity)),['2026-09-01','2027-07-31']);
 s.save({kind:'activity',...a},{name:'Música'});
 assert.equal(s.api.context(s.state,a).activity.startDate,undefined);assert.equal(s.api.collect(s.state,'2026-08-03',s.state.children).length,0);
});
test('validació atòmica de dates, noms, dies, hores i solapaments dins del grup',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);const before=JSON.stringify(s.state);
 for(const [editor,fields] of [
  [{kind:'course',...c},{startDate:'2027-01-01',endDate:'2026-01-01'}],
  [{kind:'course'},{startDate:'2026-09-01',endDate:'2027-06-30'}],
  [{kind:'course'},{startDate:'2026-99-99',endDate:'2027-06-30'}],
  [{kind:'activity',...a},{name:'',startDate:'2026-08-01'}],
  [{kind:'activity',...a},{name:'Música',startDate:'2028-01-01'}],
  [{kind:'group',...g},{name:'',childIds:[]}],
  [{kind:'session',...g},{weekday:'7',startTime:'17:00',endTime:'18:00'}],
  [{kind:'session',...g},{weekday:'',startTime:'17:00',endTime:'18:00'}],
  [{kind:'session',...g},{weekday:'0',startTime:'18:00',endTime:'17:00'}],
  [{kind:'session',...g},{weekday:'0',startTime:'17:30',endTime:'18:30'}],
  [{kind:'session',...g,sessionId:'missing'},{weekday:'1',startTime:'17:00',endTime:'18:00'}],
  [{kind:'activity',courseId:'missing'},{name:'X'}]
 ]){assert.ok(s.save(editor,fields).error);assert.equal(JSON.stringify(s.state),before);}
 assert.ok(s.session(g,{startTime:'18:00',endTime:'19:00'}).nav,'permet activitats consecutives');
});
test('editar les dates del curs valida les dates efectives de totes les extraescolars',()=>{
 const s=setup(),c=s.course(),a=s.activity(c,{startDate:'2027-05-01'}),before=JSON.stringify(s.state);
 assert.ok(s.save({kind:'course',...c},{startDate:'2026-09-01',endDate:'2027-04-30'}).error);assert.equal(JSON.stringify(s.state),before);
 assert.ok(s.save({kind:'course',...c},{startDate:'2026-08-01',endDate:'2027-07-31'}).nav);
 assert.equal(s.api.context(s.state,a).activity.startDate,'2027-05-01');
});
test('reordenar extraescolars i grups conserva inscripcions i horaris i no afecta altres cursos',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);
 const b=s.activity(c,{name:'Natació'}),g2=s.group(a,{name:'Segon'}),other=s.save({kind:'course'},{startDate:'2025-09-01',endDate:'2026-06-30'}).nav;
 const original=JSON.stringify(s.api.context(s.state,g).group);
 assert.equal(s.api.reorder(s.state,c,'ec-activity',b.activityId,0),true);
 assert.equal(s.api.reorder(s.state,a,'ec-group',g2.groupId,0),true);assert.equal(JSON.stringify(s.api.context(s.state,g).group),original);
 assert.equal(s.api.reorder(s.state,other,'ec-activity',a.activityId,0),false);
 for(const index of [-1,2,0.5])assert.equal(s.api.reorder(s.state,a,'ec-group',g.groupId,index),false);
});
test('neteja i reimportació JSON conserven ordre, dates pròpies i activitats, i accepten còpies antigues',()=>{
 const s=setup(),c=s.course(),a=s.activity(c,{startDate:'2026-08-01',endDate:'2027-07-31'}),g=s.group(a);s.session(g);
 const raw=plain(s.state.extracurricularCourses);assert.deepEqual(plain(s.api.clean(raw,s.state.children)),raw);assert.deepEqual(plain(s.api.clean(undefined,s.state.children)),[]);
 const withoutChild=s.api.clean(raw,[]);assert.deepEqual(plain(withoutChild[0].activities[0].groups[0].childIds),[]);
 for(const modify of [
  r=>r.push(r[0]),r=>r[0].activities.push(r[0].activities[0]),r=>r[0].activities[0].groups.push(r[0].activities[0].groups[0]),
  r=>r[0].startDate='2026-02-30',r=>r[0].activities[0].startDate='2028-01-01',r=>r[0].activities[0].groups[0].weeklySchedule[0].weekday=9,
  r=>r[0].activities[0].groups[0].weeklySchedule.push({...r[0].activities[0].groups[0].weeklySchedule[0],id:'other'})
 ]){const copy=plain(raw);modify(copy);assert.throws(()=>s.api.clean(copy,s.state.children));}
});
test('suprimir demana confirmació i només elimina la branca triada',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);const a2=s.activity(c,{name:'Dansa'});
 const data={action:'ec-delete-group',course:c.courseId,activity:a.activityId,group:g.groupId};
 const before=JSON.stringify(s.state);assert.equal(s.api.click(s.state,g,data,()=>false),null);assert.equal(JSON.stringify(s.state),before);
 assert.equal(s.api.click(s.state,g,data,()=>true).changed,true);assert.equal(s.api.context(s.state,a).activity.groups.length,0);
 assert.equal(s.api.context(s.state,a2).activity.name,'Dansa');
 s.api.click(s.state,a,{action:'ec-delete-activity',course:c.courseId,activity:a.activityId},()=>true);assert.equal(s.state.extracurricularCourses[0].activities.length,1);
 s.api.click(s.state,c,{action:'ec-delete-course',course:c.courseId},()=>true);assert.equal(s.state.extracurricularCourses.length,0);
});
test('editar no desa abans d’enviar i els formularis tenen eliminació i camps opcionals',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a),before=JSON.stringify(s.state);
 const result=s.api.click(s.state,c,{action:'ec-edit-course',course:c.courseId},()=>true);assert.equal(JSON.stringify(s.state),before);assert.equal(result.editor.kind,'course');
 for(const [kind,nav] of [['course',c],['activity',a],['group',g]])assert.match(s.api.form(s.state,{kind,...nav}),new RegExp('data-action="ec-delete-'+kind+'"'));
 assert.match(s.api.form(s.state,{kind:'activity',...a}),/Inici propi \(opcional\)/);assert.match(s.api.form(s.state,{kind:'activity',...a}),/fora d’aquest interval/);
});
test('calendari: respecta dies, dates inclusives i fills; permet un fill en diversos grups',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);
 const second=s.group(a,{name:'Segon grup'});s.session(second,{startTime:'19:00',endTime:'20:00'});
 const items=s.api.collect(s.state,'2026-11-02',s.state.children);assert.equal(items.length,2);assert.ok(items.every(item=>item.childId==='a'&&item.kind==='Extraescolar'));
 assert.equal(items[0].start,1020);assert.equal(items[0].end,1080);assert.equal(new Set(items.map(item=>item.id)).size,2);
 assert.equal(s.api.collect(s.state,'2026-11-03',s.state.children).length,0);assert.equal(s.api.collect(s.state,'2026-11-02',[s.state.children[1]]).length,0);
 s.state.preferences.showExtracurriculars=false;assert.equal(s.api.collect(s.state,'2026-11-02',s.state.children).length,0);assert.equal(s.api.legend(s.state),'');
 s.state.preferences.showExtracurriculars=true;assert.match(s.api.legend(s.state),/Música/);
 const html=s.ctx.window.dayTimelineUI.render('2026-11-02','Dilluns',s.state.children,items,{},'19:00',50);
 assert.match(html,/Extraescolar/);assert.match(html,/17:00/);
 const mini=s.ctx.window.monthDayUI.mini(s.state.children,{},items,{});assert.match(mini,/month-mini-school/);
});
test('noms maliciosos es mostren com a text a llistes, formularis i llegenda',()=>{
 const s=setup(),c=s.course(),a=s.activity(c,{name:'<script>mal</script>',address:'<img src=x onerror=mal()>'});
 for(const html of [s.api.page(s.state,c),s.api.form(s.state,{kind:'activity',...a}),s.api.legend(s.state)])assert.doesNotMatch(html,/<script>|<img/);
 assert.match(s.api.page(s.state,c),/&lt;script&gt;/);
});

test('extraescolars abans i després de l’escola i en cap de setmana, sense dependre d’una matrícula escolar',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);
 s.session(g,{startTime:'07:00',endTime:'08:00'});
 s.session(g,{startTime:'18:00',endTime:'20:00'});
 s.session(g,{weekday:'5',startTime:'10:00',endTime:'12:00'});
 s.state.schools=[];s.state.preferences.visibleSchools=[];
 const monday=s.api.collect(s.state,'2026-11-16',s.state.children);
 assert.deepEqual(plain(monday.map(a=>[a.start,a.end])),[[420,480],[1080,1200]]);
 assert.equal(s.api.collect(s.state,'2026-11-21',s.state.children).length,1);
 const html=s.ctx.window.dayTimelineUI.render('2026-11-16','Dilluns',s.state.children,monday,{},'19:00',50);
 assert.match(html,/top:168px;height:24px/);assert.match(html,/top:432px;height:48px/);
 // El nom continua llegible amb el zoom inicial, que amaga la descripció llarga.
 assert.match(html,/<span class="day-school-kind">Música<\/span><span class="day-school-hours">18:00–20:00/);
});

test('una rotació coincident deixa lloc a l’extraescolar i conserva una franja visible a totes les vistes',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);
 const date='2026-11-16',items=s.api.collect(s.state,date,s.state.children);
 const base={childId:'a',from:960,to:1200,startTime:'16:00',endTime:'20:00',visible:true,rotationId:'pickup',rotationName:'Recollida',guardianName:'Tutor',color:'#1357ac'};
 for(const guardianId of ['tutor','']){
  const rotation={...base,guardianId},before=JSON.stringify({items,rotation});
  const day=s.ctx.window.dayTimelineUI.render(date,'Dilluns',s.state.children,items,{},'19:00',50,{},[rotation]);
  const week=s.ctx.window.dayTimelineUI.renderWeek(date,[{date,label:'Dilluns',activities:items,nightSegments:{},rotatingSlots:[rotation]}],s.state.children,50);
  for(const html of [day,week]){
   assert.match(html,/left:calc\(23% \+ 0 \* 77% \/ 1 \+ 3px\);width:calc\(77% \/ 1 - 6px\)/);
   assert.match(html,/day-extra-block (?:with|without)-guardian with-activity/);
   assert.match(html,/data-action="open-school-activity"/);assert.match(html,/data-action="edit-extra-slot"/);
  }
  for(const view of ['month','year']){
   const mini=s.ctx.window.monthDayUI.mini(s.state.children,{},items,{},[rotation],view);
   assert.match(mini,/--schedule-inset:23%/);assert.match(mini,/month-mini-school/);
   assert.match(mini,/month-mini-extra (?:with|without)-guardian with-activity/);
  }
  assert.equal(JSON.stringify({items,rotation}),before,'renderitzar no altera dades ni horaris');
 }
 const css=read('styles.css');
 const layer=selector=>Number(css.match(new RegExp(selector.replaceAll('.', '\\.')+' ?\\{z-index:(\\d+)'))?.[1]);
 assert.ok(layer('.day-school-block')>4,'l’activitat es pinta per sobre de la rotació (capa 4)');
 assert.ok(layer('.month-mini-school')>4);
 assert.match(css,/\.day-extra-block\.with-activity \{left:0;width:100%;\}/);
 assert.match(css,/\.month-mini-extra\.with-activity \{left:0;right:0;\}/);
});

test('només les rotacions visibles del mateix fill que se solapen reserven una franja',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);
 const date='2026-11-16',items=s.api.collect(s.state,date,s.state.children);
 const base={childId:'a',from:1020,to:1080,visible:true,guardianId:'tutor'};
 for(const rotation of [{...base,to:1020,from:960},{...base,from:1080,to:1200},{...base,visible:false},{...base,childId:'b'}]){
  const html=s.ctx.window.dayTimelineUI.render(date,'Dilluns',s.state.children,items,{},'19:00',50,{},[rotation]);
  assert.doesNotMatch(html,/23% \+|with-activity/);assert.match(html,/width:calc\(100% \/ 1 - 6px\)/);
  const mini=s.ctx.window.monthDayUI.mini(s.state.children,{},items,{},[rotation]);
  assert.doesNotMatch(mini,/--schedule-inset|with-activity/);
 }
});

test('eliminar una activitat setmanal deixa intactes el grup i les altres activitats',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);s.session(g,{weekday:'2'});
 const group=s.api.context(s.state,g).group,first=group.weeklySchedule[0].id,second=plain(group.weeklySchedule[1]);
 const result=s.api.click(s.state,g,{action:'ec-delete-session',course:c.courseId,activity:a.activityId,group:g.groupId,session:first},()=>true);
 assert.equal(result.changed,true);assert.equal(group.weeklySchedule.length,1);assert.deepEqual(plain(group.weeklySchedule[0]),second);assert.deepEqual(plain(group.childIds),['a']);
});

test('el mòdul d’extraescolars es carrega abans de l’app i està inclòs a la memòria cau PWA',()=>{
 const version=JSON.parse(read('package.json')).version,resource=`extracurricular.js?v=${version}`,html=read('index.html');
 assert.ok(html.includes(resource));assert.ok(html.indexOf(resource)<html.indexOf(`app.js?v=${version}`));assert.ok(read('sw.js').includes(resource));
});

test('Any i Mes conserven l’escola i les rotacions però les extraescolars només es mostren a Setmana',()=>{
 const s=setup(),c=s.course(),a=s.activity(c),g=s.group(a);s.session(g);
 const school={id:'school-session',childId:'a',schoolId:'school',schoolName:'Escola',color:'#123456',start:540,end:960,startTime:'09:00',endTime:'16:00',kind:'Classe',description:''};
 const rotation={childId:'a',from:960,to:1200,visible:true};
 s.state.guardians=[];Object.assign(s.state.preferences,{visibleSchools:['school'],visibleGuardians:[]});
 Object.assign(s.ctx,{state:s.state,extracurricular:s.api,schoolCalendarUI:{collect:()=>[school]},schoolScheduleForCalendarDay:()=>[],
  dayTimelineUI:s.ctx.window.dayTimelineUI,monthDayUI:s.ctx.window.monthDayUI,nightChangeTime:()=> '19:00',assigned:()=>'',guardian:()=>undefined,
  extraSlots:()=>[rotation],addDays:(day,n)=>new Date(Date.parse(day+'T12:00:00Z')+n*86400000).toISOString().slice(0,10),
  parseDate:day=>new Date(day+'T12:00:00Z'),weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'],workSchedule:{isDayOff:()=>false}});
 const app=read('app.js'),section=(start,end)=>app.slice(app.indexOf(start),app.indexOf(end,app.indexOf(start)));
 vm.runInContext(section('function schoolActivities(', 'function schoolReducedDay(')+section('function monthData(', 'function dayTimeline(')+section('function weekTimelineDays(', 'function miniBands('),s.ctx);
 const before=JSON.stringify(s.state),monthly=s.ctx.monthData('2026-11-16',s.state.children);
 assert.deepEqual(plain(monthly.activities),[school]);assert.deepEqual(plain(monthly.extra),[rotation]);
 const weekly=s.ctx.weekTimelineDays('2026-11-16',s.state.children,1)[0];
 assert.equal(weekly.activities.length,2);assert.equal(weekly.activities[1].kind,'Extraescolar');
 assert.equal(weekly.activities[1].schoolName,'Música');assert.equal(JSON.stringify(s.state),before);
});
