/* Cursos i activitats extraescolars, independents dels centres escolars. */
(() => {
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const days=['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
 const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&value>='0100-01-01'&&value<='9999-12-31'&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const clock=value=>typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value);
 const minutes=value=>Number(value.slice(0,2))*60+Number(value.slice(3));
 const stamp=value=>value.split('-').reverse().join('/');
 const courseName=course=>`Curs ${course.startDate.slice(0,4)}-${course.endDate.slice(0,4)}`;
 const bounds=(course,activity)=>[activity.startDate||course.startDate,activity.endDate||course.endDate];
 const color=id=>`hsl(${[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0)%360} 48% 55%)`;
 const count=(n,one,many)=>`${n} ${n===1?one:many}`;
 const chevron='<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
 const drag='<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h14"/></svg>';
 const text=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
 function array(value,max,message){if(!Array.isArray(value)||value.length>max)throw Error(message);return value;}
 function ids(items,message){const seen=new Set();for(const item of items){if(!item||typeof item.id!=='string'||!item.id.trim()||item.id.length>150||seen.has(item.id))throw Error(message);seen.add(item.id);}return items;}
 function ordered(sessions){return [...sessions].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime)||(a.id??'').localeCompare(b.id??''));}
 function validateSchedule(sessions){
  for(const session of sessions)if(!Number.isInteger(session.weekday)||session.weekday<0||session.weekday>6||!clock(session.startTime)||!clock(session.endTime)||session.startTime>=session.endTime)throw Error('Indica un dia i unes hores vàlides; el final ha de ser posterior a l’inici.');
  const list=ordered(sessions);
  for(let i=1;i<list.length;i++)if(list[i].weekday===list[i-1].weekday&&list[i].startTime<list[i-1].endTime)throw Error('Les activitats del mateix grup no es poden solapar.');
 }
 function validateBounds(course,activity){const [start,end]=bounds(course,activity);if(!date(start)||!date(end)||start>end)throw Error('La data final de l’extraescolar no pot ser anterior a la inicial.');}
 function clean(raw,children){
  if(raw===undefined)return [];
  const childSet=new Set(children.map(child=>child.id));
  return ids(array(raw,60,'La llista de cursos d’extraescolars no és vàlida.'),'Hi ha un curs d’extraescolars invàlid.').map(course=>{
   if(!date(course.startDate)||!date(course.endDate)||course.startDate>course.endDate)throw Error('Les dates d’un curs d’extraescolars no són vàlides.');
   const activities=ids(array(course.activities,100,'La llista d’extraescolars no és vàlida.'),'Hi ha una extraescolar invàlida.').map(activity=>{
    if(!text(activity.name,100))throw Error('Indica el nom de l’extraescolar.');
    for(const key of ['startDate','endDate'])if(activity[key]!==undefined&&activity[key]!==''&&!date(activity[key]))throw Error('Les dates de l’extraescolar no són vàlides.');
    const groups=ids(array(activity.groups,100,'La llista de grups d’extraescolars no és vàlida.'),'Hi ha un grup d’extraescolars invàlid.').map(group=>{
     if(!text(group.name,80))throw Error('Indica el nom del grup.');
     const childIds=[...new Set(array(group.childIds,30,'Els fills del grup no són vàlids.').filter(id=>childSet.has(id)))];
     const weeklySchedule=ids(array(group.weeklySchedule,200,'L’horari del grup no és vàlid.'),'Hi ha una activitat setmanal invàlida.').map(session=>({id:session.id,weekday:session.weekday,startTime:session.startTime,endTime:session.endTime,label:text(session.label,80)}));
     validateSchedule(weeklySchedule);return {id:group.id,name:text(group.name,80),childIds,weeklySchedule};
    });
    const result={id:activity.id,name:text(activity.name,100),address:text(activity.address,200),phone:text(activity.phone,50),groups};
    if(activity.startDate)result.startDate=activity.startDate;if(activity.endDate)result.endDate=activity.endDate;
    validateBounds(course,result);return result;
   });
   return {id:course.id,startDate:course.startDate,endDate:course.endDate,activities};
  });
 }
 function context(state,nav={}){
  const courses=state.extracurricularCourses??[],course=courses.find(item=>item.id===nav.courseId);
  const activity=course?.activities.find(item=>item.id===nav.activityId),group=activity?.groups.find(item=>item.id===nav.groupId);
  return {courses,course,activity,group};
 }
 const attrs=nav=>Object.entries(nav).filter(([,value])=>value).map(([key,value])=>`data-${key.replace('Id','')}="${esc(value)}"`).join(' ');
 const button=(label,action,nav={},cls='secondary-btn')=>`<button type="button" class="${cls}" data-action="ec-${action}" ${attrs(nav)}>${esc(label)}</button>`;
 const crumb=(label,nav={})=>button('‹ '+label,'nav',nav,'school-breadcrumb');
 const heading=(title,subtitle,back='')=>`<header class="page-heading"><div>${back}<div class="eyebrow">EXTRAESCOLARS</div><h1 class="page-title">${esc(title)}</h1>${subtitle?`<p class="page-subtitle">${esc(subtitle)}</p>`:''}</div></header>`;
 const card=(title,addLabel,action,nav,body)=>`<section class="card"><div class="panel-header"><h2 class="section-title">${esc(title)}</h2>${button(addLabel,action,nav)}</div>${body}</section>`;
 function list(items,kind,label,nav,copy){
  if(!items.length)return '<p class="settings-note">Encara no hi ha cap element. Prem «Afegir» per començar.</p>';
  return `<ol class="people-list" data-kind="${kind}" aria-label="${esc(label)}">${items.map(item=>{
   const target={...nav,[kind==='ec-activity'?'activityId':'groupId']:item.id};
   return `<li class="person-list-row" data-id="${esc(item.id)}"><button type="button" class="person-list-open" data-action="ec-nav" ${attrs(target)} aria-label="Obre ${esc(item.name)}">${kind==='ec-activity'?`<span class="person-list-color" style="background:${color(item.id)}" aria-hidden="true"></span>`:''}<span class="person-list-name">${esc(item.name)}<small>${esc(copy(item))}</small></span>${chevron}</button><button type="button" class="person-drag-handle" aria-label="Reordena ${esc(item.name)}" aria-describedby="ec-reorder-help" aria-pressed="false" ${items.length<2?'disabled':''}>${drag}</button></li>`;
  }).join('')}</ol>`;
 }
 function page(state,nav={}){
  const {courses,course,activity,group}=context(state,nav);
  const help='<p id="ec-reorder-help" class="visually-hidden">Arrossega per reordenar. Amb el teclat, fes servir les fletxes amunt i avall, Inici o Fi.</p>';
  if(!course){
   const rows=[...courses].sort((a,b)=>b.startDate.localeCompare(a.startDate)||a.id.localeCompare(b.id));
   return heading('Extraescolars','Cursos, activitats i grups dels fills.')+card('Cursos d’extraescolars','Afegir curs','add-course',{},rows.length?`<ol class="people-list" aria-label="Cursos d’extraescolars, de més recent a més antic">${rows.map(item=>`<li class="person-list-row"><button type="button" class="person-list-open" data-action="ec-nav" ${attrs({courseId:item.id})}><span class="person-list-name">${esc(courseName(item))}<small>${stamp(item.startDate)} – ${stamp(item.endDate)}</small></span>${chevron}</button></li>`).join('')}</ol>`:'<p class="settings-note">Afegeix un curs amb les dates d’inici i final.</p>')+(window.dateBlocks?.changes(state)??'');
  }
  const courseNav={courseId:course.id},activityNav={...courseNav,activityId:activity?.id},groupNav={...activityNav,groupId:group?.id};
  if(!activity)return heading(courseName(course),`${stamp(course.startDate)} – ${stamp(course.endDate)}`,crumb('Extraescolars'))+
   `<section class="card"><div class="panel-header"><h2 class="section-title">Dates del curs</h2>${button('Edita el curs','edit-course',courseNav)}</div><p class="settings-note">Del ${stamp(course.startDate)} al ${stamp(course.endDate)}. Cada extraescolar pot tenir dates pròpies.</p></section>`+
   card('Extraescolars del curs','Afegir extraescolar','add-activity',courseNav,help+list(course.activities,'ec-activity','Extraescolars del curs',courseNav,item=>`${count(item.groups.length,'grup','grups')} · ${bounds(course,item).map(stamp).join(' – ')}`));
  const [start,end]=bounds(course,activity);
  if(!group)return heading(activity.name,`${stamp(start)} – ${stamp(end)}`,crumb(courseName(course),courseNav))+
   `<section class="card"><div class="panel-header"><h2 class="section-title">Dades de l’extraescolar</h2>${button('Edita l’extraescolar','edit-activity',activityNav)}</div>${activity.address?`<p>${esc(activity.address)}</p>`:''}${activity.phone?`<p>Telèfon: ${esc(activity.phone)}</p>`:''}<p class="settings-note">Del ${stamp(start)} al ${stamp(end)}.</p></section>`+
   card('Grups','Afegir grup','add-group',activityNav,help+list(activity.groups,'ec-group','Grups d’extraescolars',activityNav,item=>`${count(item.childIds.length,'fill','fills')} · ${count(item.weeklySchedule.length,'activitat setmanal','activitats setmanals')}`));
  const children=state.children.filter(child=>group.childIds.includes(child.id));
  return heading(group.name,activity.name+' · '+courseName(course),crumb(activity.name,activityNav))+
   `<section class="card"><div class="panel-header"><h2 class="section-title">Grup i fills</h2>${button('Edita el grup','edit-group',groupNav)}</div><p>${children.length?children.map(child=>esc(child.name)).join(', '):'Encara no hi ha fills associats a aquest grup.'}</p></section>`+
   card('Horari setmanal','Afegir activitat','add-session',groupNav,group.weeklySchedule.length?`<ol class="people-list" aria-label="Activitats setmanals">${ordered(group.weeklySchedule).map(session=>`<li class="person-list-row"><button type="button" class="person-list-open" data-action="ec-edit-session" ${attrs({...groupNav,sessionId:session.id})}><span class="person-list-name">${days[session.weekday]} · ${session.startTime}–${session.endTime}${session.label?`<small>${esc(session.label)}</small>`:''}</span>${chevron}</button></li>`).join('')}</ol>`:'<p class="settings-note">Afegeix els dies i les hores de les activitats d’aquest grup.</p>');
 }
 const field=(label,name,type,value='',required=false,max=0)=>`<div class="field"><label for="ec-${name}">${esc(label)}</label><input id="ec-${name}" name="${name}" type="${type}" value="${esc(value)}" ${required?'required':''} ${max?`maxlength="${max}"`:''}></div>`;
 function form(state,editor){
  const {course,activity,group}=context(state,editor),kind=editor.kind;
  const session=group?.weeklySchedule.find(item=>item.id===editor.sessionId);
  const existing=kind==='course'?course:kind==='activity'?activity:kind==='group'?group:session;
  const noun={course:'curs',activity:'extraescolar',group:'grup',session:'activitat'}[kind];
  let body='';
  if(kind==='course'){
   const now=new Date(),year=now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;
   body=field('Data d’inici','startDate','date',course?.startDate??`${year}-09-01`,true)+field('Data de finalització','endDate','date',course?.endDate??`${year+1}-06-30`,true);
  }else if(kind==='activity')body=field('Nom de l’extraescolar','name','text',activity?.name??'',true,100)+field('Adreça (opcional)','address','text',activity?.address??'',false,200)+field('Telèfon (opcional)','phone','tel',activity?.phone??'',false,50)+
   field('Inici propi (opcional)','startDate','date',activity?.startDate??'')+field('Final propi (opcional)','endDate','date',activity?.endDate??'')+`<p class="settings-note">Si deixes una data buida, s’utilitza la del curs: ${stamp(course.startDate)} – ${stamp(course.endDate)}. Les dates pròpies poden quedar fora d’aquest interval.</p>`;
  else if(kind==='group')body=field('Nom del grup','name','text',group?.name??'',true,80)+`<fieldset class="ec-children"><legend>Fills del grup</legend>${state.children.length?state.children.map(child=>`<label><input type="checkbox" name="childIds" value="${esc(child.id)}" ${group?.childIds.includes(child.id)?'checked':''}> ${esc(child.name)}</label>`).join(''):'<p class="settings-note">Afegeix fills a Persones per poder-los associar al grup.</p>'}</fieldset>`;
  else body=`<div class="field"><label for="ec-weekday">Dia de la setmana</label><select id="ec-weekday" name="weekday">${days.map((day,index)=>`<option value="${index}" ${index===(session?.weekday??0)?'selected':''}>${day}</option>`).join('')}</select></div><div class="form-row">${field('Hora d’inici','startTime','time',session?.startTime??'17:00',true)}${field('Hora de finalització','endTime','time',session?.endTime??'18:00',true)}</div>${field('Nom de l’activitat (opcional)','label','text',session?.label??'',false,80)}`;
  return `<div class="sheet-heading"><h2 class="sheet-title">${existing?'Edita':'Afegeix'} ${noun}</h2><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div><form data-ec-form="${kind}" ${attrs(editor)}><div class="school-form-fields">${body}</div><div class="action-row"><button type="submit" class="primary-btn">Desa</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button>${existing?button('Suprimeix '+(kind==='course'?'el curs':kind==='activity'?'l’extraescolar':kind==='group'?'el grup':'l’activitat'),'delete-'+kind,editor,'danger-btn'):''}</div></form>`;
 }
 const navFrom=data=>({courseId:data.course,activityId:data.activity,groupId:data.group});
 function click(state,nav,data,confirmFn){
  const action=data.action.slice(3),target=navFrom(data),{course,activity,group}=context(state,target);
  if(action==='nav')return {nav:target};
  const match=/^(add|edit|delete)-(course|activity|group|session)$/.exec(action);if(!match)return null;
  const [,operation,kind]=match,session=group?.weeklySchedule.find(item=>item.id===data.session);
  if(kind!=='course'&&!course||['group','session'].includes(kind)&&!activity||kind==='session'&&!group)return null;
  const item={course,activity,group,session}[kind];
  if(operation!=='add'&&!item)return null;
  if(operation!=='delete')return {editor:{kind,...target,sessionId:data.session}};
  const title=kind==='course'?courseName(course):item.name??item.label??'activitat';
  if(!confirmFn(`Vols suprimir «${title}»${kind==='course'?' i totes les seves extraescolars i grups':kind==='activity'?' i tots els seus grups':''}?`))return null;
  if(kind==='course'){state.extracurricularCourses=state.extracurricularCourses.filter(item=>item.id!==course.id);return {nav:{},changed:true,message:'Curs suprimit'};}
  if(kind==='activity'){course.activities=course.activities.filter(item=>item.id!==activity.id);return {nav:{courseId:course.id},changed:true,message:'Extraescolar suprimida'};}
  if(kind==='group'){activity.groups=activity.groups.filter(item=>item.id!==group.id);return {nav:{courseId:course.id,activityId:activity.id},changed:true,message:'Grup suprimit'};}
  group.weeklySchedule=group.weeklySchedule.filter(item=>item.id!==session.id);return {nav:target,changed:true,message:'Activitat suprimida'};
 }
 function save(state,editor,values,newId){
  const get=key=>String(values.get(key)??'').trim(),{course,activity,group}=context(state,editor),kind=editor.kind;
  if(editor.courseId&&!course||editor.activityId&&!activity||editor.groupId&&!group)return {error:'Aquest element ja no està disponible.'};
  if(kind!=='course'&&!course||['group','session'].includes(kind)&&!activity||kind==='session'&&!group)return {error:'Aquest element ja no està disponible.'};
  try{
   if(kind==='course'){
    const startDate=get('startDate'),endDate=get('endDate');
    if(!date(startDate)||!date(endDate)||startDate>endDate)throw Error('Indica dates vàlides; el final no pot ser anterior a l’inici.');
    if((state.extracurricularCourses??[]).some(item=>item.id!==course?.id&&item.startDate===startDate&&item.endDate===endDate))throw Error('Aquest curs ja existeix.');
    if(course){for(const item of course.activities)validateBounds({startDate,endDate},item);course.startDate=startDate;course.endDate=endDate;return {nav:{courseId:course.id}};}
    if((state.extracurricularCourses??[]).length>=60)throw Error('No es poden afegir més cursos.');
    const item={id:newId(),startDate,endDate,activities:[]};(state.extracurricularCourses??=[]).push(item);return {nav:{courseId:item.id}};
   }
   if(kind==='activity'){
    const name=get('name').slice(0,100),startDate=get('startDate'),endDate=get('endDate');if(!name)throw Error('Indica el nom de l’extraescolar.');
    if(startDate&&!date(startDate)||endDate&&!date(endDate))throw Error('Les dates pròpies no són vàlides.');
    const fields={name,address:get('address').slice(0,200),phone:get('phone').slice(0,50)};
    if(startDate)fields.startDate=startDate;if(endDate)fields.endDate=endDate;validateBounds(course,fields);
    if(activity){Object.assign(activity,fields);if(!startDate)delete activity.startDate;if(!endDate)delete activity.endDate;return {nav:{courseId:course.id,activityId:activity.id}};}
    if(course.activities.length>=100)throw Error('No es poden afegir més extraescolars en aquest curs.');
    const item={id:newId(),...fields,groups:[]};course.activities.push(item);return {nav:{courseId:course.id,activityId:item.id}};
   }
   if(kind==='group'){
    const name=get('name').slice(0,80);if(!name)throw Error('Indica el nom del grup.');
    const selected=new Set(values.getAll('childIds')),childIds=state.children.filter(child=>selected.has(child.id)).map(child=>child.id);
    if(group){group.name=name;group.childIds=childIds;return {nav:{courseId:course.id,activityId:activity.id,groupId:group.id}};}
    if(activity.groups.length>=100)throw Error('No es poden afegir més grups.');
    const item={id:newId(),name,childIds,weeklySchedule:[]};activity.groups.push(item);return {nav:{courseId:course.id,activityId:activity.id,groupId:item.id}};
   }
   const id=editor.sessionId,session=group.weeklySchedule.find(item=>item.id===id);
   if(id&&!session)throw Error('Aquesta activitat ja no està disponible.');
   if(!/^[0-6]$/.test(get('weekday')))throw Error('Tria un dia de la setmana.');
   const fields={weekday:Number(get('weekday')),startTime:get('startTime'),endTime:get('endTime'),label:get('label').slice(0,80)};
   validateSchedule([...group.weeklySchedule.filter(item=>item.id!==id),fields]);
   if(session)Object.assign(session,fields);else{
    if(group.weeklySchedule.length>=200)throw Error('No es poden afegir més activitats en aquest grup.');
    group.weeklySchedule.push({id:newId(),...fields});
   }
   return {nav:{courseId:course.id,activityId:activity.id,groupId:group.id}};
  }catch(error){return {error:error.message};}
 }
 function reorder(state,nav,kind,id,index){
  const {course,activity}=context(state,nav),items=kind==='ec-activity'?course?.activities:kind==='ec-group'?activity?.groups:null;
  if(!items||!Number.isInteger(index)||index<0||index>=items.length)return false;
  const from=items.findIndex(item=>item.id===id);if(from<0||from===index)return false;
  const [item]=items.splice(from,1);items.splice(index,0,item);return true;
 }
 function collect(state,day,children){
  if(state.preferences?.showExtracurriculars===false||!date(day))return [];
  const weekday=(new Date(day+'T12:00:00Z').getUTCDay()+6)%7,result=[];
  for(const course of state.extracurricularCourses??[])for(const activity of course.activities){
   const [first,last]=bounds(course,activity);if(day<first||day>last)continue;
   for(const group of activity.groups)for(const child of children){
    if(!group.childIds.includes(child.id))continue;
    for(const session of group.weeklySchedule){if(session.weekday!==weekday)continue;
     result.push({id:['ec',course.id,activity.id,group.id,session.id].map(encodeURIComponent).join(':'),schoolId:'ec:'+encodeURIComponent(activity.id),schoolName:activity.name,color:color(activity.id),childId:child.id,startTime:session.startTime,endTime:session.endTime,start:minutes(session.startTime),end:minutes(session.endTime),kind:'Extraescolar',description:[activity.name,group.name,session.label].filter(Boolean).join(' · ')});
    }
   }
  }
  return result.sort((a,b)=>a.start-b.start||a.end-b.end||a.childId.localeCompare(b.childId));
 }
 function legend(state){
  if(state.preferences?.showExtracurriculars===false)return '';
  return (state.extracurricularCourses??[]).flatMap(course=>course.activities.map(activity=>`<span class="legend-entry"><span class="legend-color" style="background:${color(activity.id)}"></span>${esc(activity.name)} · ${esc(courseName(course))}</span>`)).join('');
 }
 window.extracurricular={clean,page,form,click,save,reorder,collect,legend,context,bounds};
})();
