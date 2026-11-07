/* Horari laboral personal: cicles setmanals, jornades partides i absències. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number(d.slice(0,4))>=100&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const validTime=t=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
 const day=d=>Date.parse(d+'T12:00:00Z')/86400000;
 const date=n=>new Date(n*86400000).toISOString().slice(0,10);
 const addDays=(d,n)=>date(day(d)+n);
 const weekday=d=>(new Date(d+'T12:00:00Z').getUTCDay()+6)%7;
 const monday=d=>addDays(d,-weekday(d));
 const minutes=t=>Number(t.slice(0,2))*60+Number(t.slice(3,5));
 const time=m=>m===1440?'24:00':String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0');
 const fmt=d=>Number(d.slice(8,10))+'/'+Number(d.slice(5,7))+'/'+d.slice(0,4);
 const weekdays=['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
 const owner=(state,key)=>state.guardians.find(p=>'guardian:'+p.id===key);
 const data=(state,key)=>state.personTimeOff?.[key]??{holidays:[],vacations:[]};
 const rotations=(state,key)=>data(state,key).workRotations??[];
 const sorted=list=>list.sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
 function normalize(raw){
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||typeof raw.id!=='string'||!raw.id||raw.id.length>100)throw Error('Rotació de feina incorrecta');
  const name=typeof raw.name==='string'?raw.name.trim():'';
  if(!name||name.length>120)throw Error('Indica un nom de fins a 120 caràcters');
  if(!validDate(raw.startDate)||(raw.endDate!==undefined&&raw.endDate!==''&&(!validDate(raw.endDate)||raw.endDate<raw.startDate)))throw Error('Revisa les dates de la rotació de feina');
  if(!Number.isInteger(raw.weeks)||raw.weeks<1||raw.weeks>12||!Array.isArray(raw.days)||raw.days.length!==raw.weeks*7)throw Error('El cicle ha de tenir entre 1 i 12 setmanes completes');
  const ranges=[];
  const days=raw.days.map((shifts,index)=>{
   if(!Array.isArray(shifts)||shifts.length>8)throw Error('Pots definir fins a 8 franges per dia');
   return shifts.map(s=>{
    if(!s||!validTime(s.startTime)||!validTime(s.endTime)||s.startTime===s.endTime)throw Error('Cada franja ha de tenir hores vàlides i una durada superior a zero');
    const from=index*1440+minutes(s.startTime),to=index*1440+minutes(s.endTime)+(s.endTime<s.startTime?1440:0);
    ranges.push({from,to});return {startTime:s.startTime,endTime:s.endTime};
   }).sort((a,b)=>a.startTime.localeCompare(b.startTime));
  });
  if(!ranges.length)throw Error('Afegeix almenys una franja de feina');
  const cycle=raw.weeks*7*1440;
  const repeated=[...ranges,...ranges.map(r=>({from:r.from+cycle,to:r.to+cycle}))].sort((a,b)=>a.from-b.from);
  for(let i=1;i<repeated.length;i++)if(repeated[i].from<repeated[i-1].to)throw Error('Hi ha franges que se superposen al patró de feina');
  return {id:raw.id,name,startDate:raw.startDate,...(raw.endDate?{endDate:raw.endDate}:{}),weeks:raw.weeks,days};
 }
 function clean(raw){
  if(!Array.isArray(raw)||raw.length>100)throw Error('Rotacions de feina incorrectes');
  const ids=new Set();return sorted(raw.map(r=>{const item=normalize(r);if(ids.has(item.id))throw Error('Identificador de rotació de feina repetit');ids.add(item.id);return item;}));
 }
 function draft(state,key,id,today){
  if(!owner(state,key))return null;
  const existing=rotations(state,key).find(r=>r.id===id);if(id&&!existing)return null;
  return {...(existing?JSON.parse(JSON.stringify(existing)):{id:'',name:'Feina',startDate:today,endDate:'',weeks:1,days:Array.from({length:7},()=>[])}),week:0};
 }
 function change(work,field,value,index,slot,edge){
  if(!work)return false;
  if(['name','startDate','endDate'].includes(field)){work[field]=String(value);return true;}
  if(field==='weeks'){
   const weeks=Number(value);if(!Number.isInteger(weeks)||weeks<1||weeks>12)return false;
   work.days=Array.from({length:weeks*7},(_,i)=>work.days[i]??[]);work.weeks=weeks;work.week=Math.min(work.week,weeks-1);return true;
  }
  if(field==='time'&&Number.isInteger(index)&&Number.isInteger(slot)&&work.days[index]?.[slot]&&['startTime','endTime'].includes(edge)){work.days[index][slot][edge]=String(value);return true;}
  return false;
 }
 function edit(work,action,index,slot){
  if(!work)return false;
  if(action==='week'&&Number.isInteger(index)&&index>=0&&index<work.weeks){work.week=index;return true;}
  if(!Number.isInteger(index)||!work.days[index])return false;
  work.week=Math.floor(index/7);
  if(action==='add'&&work.days[index].length<8){work.days[index].push({startTime:'09:00',endTime:'13:00'});return true;}
  if(action==='remove'&&Number.isInteger(slot)&&work.days[index][slot]){work.days[index].splice(slot,1);return true;}
  if(action==='copy'){
   const source=JSON.parse(JSON.stringify(work.days[index]));
   for(let i=0;i<5;i++)work.days[work.week*7+i]=JSON.parse(JSON.stringify(source));return true;
  }
  return false;
 }
 function readForm(work,fields){
  for(const field of ['name','startDate','endDate','weeks'])if(fields.has(field))change(work,field,fields.get(field));
  work.days.forEach((shifts,i)=>shifts.forEach((s,j)=>{for(const edge of ['startTime','endTime']){const key='work-'+i+'-'+j+'-'+edge;if(fields.has(key))s[edge]=String(fields.get(key));}}));
 }
 function save(state,key,work,newId){
  if(!owner(state,key))return 'Persona no disponible';
  const list=rotations(state,key);if(work.id&&!list.some(r=>r.id===work.id))return 'Aquesta rotació ja no existeix';
  if(!work.id&&list.length>=100)return 'No es poden afegir més de 100 rotacions per persona';
  let item;try{item=normalize({...work,id:work.id||newId()});}catch(error){return error.message;}
  state.personTimeOff??={};state.preferences.visibleTimeOffPeople??=[];
  if(!Object.hasOwn(state.personTimeOff,key)&&!state.preferences.visibleTimeOffPeople.includes(key))state.preferences.visibleTimeOffPeople.push(key);
  state.personTimeOff[key]={...data(state,key),workRotations:sorted([...list.filter(r=>r.id!==item.id),item])};return '';
 }
 function remove(state,key,id){
  if(!owner(state,key))return false;
  const current=state.personTimeOff?.[key];if(!current?.workRotations?.some(r=>r.id===id))return false;
  current.workRotations=current.workRotations.filter(r=>r.id!==id);return true;
 }
 function absence(state,key,d){
  const calendar=data(state,key);if(calendar.holidays.includes(d))return 'Festiu';
  const vacations=calendar.vacations.filter(v=>v.startDate<=d&&v.endDate>=d);
  if(vacations.length)return vacations.map(v=>v.name).join(' · ');
  return '';
 }
 function pattern(r,d){
  if(d<r.startDate||(r.endDate&&d>r.endDate))return [];
  const index=((day(d)-day(monday(r.startDate)))%(r.weeks*7)+r.weeks*7)%(r.weeks*7);return r.days[index]??[];
 }
 function calculateSlots(state,key,d,respectAbsences){
  if(!owner(state,key)||!validDate(d)||(respectAbsences&&absence(state,key,d)))return [];
  const previous=addDays(d,-1),out=[];
  for(const r of rotations(state,key)){
   if(d<r.startDate||(r.endDate&&d>r.endDate))continue;
   for(const s of pattern(r,d))out.push({rotationId:r.id,rotationName:r.name,from:minutes(s.startTime),to:s.endTime<s.startTime?1440:minutes(s.endTime)});
   if(!respectAbsences||!absence(state,key,previous))for(const s of pattern(r,previous))if(s.endTime<s.startTime&&minutes(s.endTime)>0)out.push({rotationId:r.id,rotationName:r.name,from:0,to:minutes(s.endTime)});
  }
  return out.sort((a,b)=>a.from-b.from||a.to-b.to).map(s=>({...s,startTime:time(s.from),endTime:time(s.to)}));
 }
 const slots=(state,key,d)=>calculateSlots(state,key,d,true);
 const scheduledSlots=(state,key,d)=>calculateSlots(state,key,d,false);
 function isDayOff(state,d){
  const key=state.preferences.mePerson;
  if(!owner(state,key)||!validDate(d))return false;
  if(absence(state,key,d))return true;
  const known=rotations(state,key).some(r=>d>=r.startDate&&(!r.endDate||d<=r.endDate));
  return known&&slots(state,key,d).length===0;
 }
 function listMarkup(state,key){
  const list=rotations(state,key);
  return `<div class="school-period work-rotation-list"><div class="panel-header"><strong>Rotacions de feina (${list.length})</strong><button type="button" class="secondary-btn" data-action="work-add" data-person="${esc(key)}">+ Rotació</button></div>${list.length?list.map(r=>`<div class="school-schedule-row"><div><strong>${esc(r.name)}</strong><span class="school-meta">${fmt(r.startDate)}${r.endDate?' – '+fmt(r.endDate):' · sense data final'} · ${r.weeks===1?'cada setmana':'cicle de '+r.weeks+' setmanes'}</span></div><div class="school-schedule-actions"><button type="button" class="school-schedule-edit" data-action="work-edit" data-person="${esc(key)}" data-rotation="${esc(r.id)}">Edita</button><button type="button" class="delete-icon" data-action="work-delete" data-person="${esc(key)}" data-rotation="${esc(r.id)}" aria-label="Suprimeix ${esc(r.name)}">×</button></div></div>`).join(''):'<p class="settings-note">Afegeix els dies i les hores que treballa aquesta persona, amb tantes franges com necessitis per a una jornada partida.</p>'}</div>`;
 }
 function form(state,key,work){
  const p=owner(state,key);if(!p||!work)return '';
  const week=work.week??0,anchor=validDate(work.startDate)?monday(work.startDate):'';
  return `<div class="sheet-heading"><div><h2 class="sheet-title">${work.id?'Edita':'Afegeix'} rotació de feina</h2><p class="sheet-subtitle">${esc(p.name)}</p></div><button type="button" class="sheet-close" data-action="work-cancel" data-person="${esc(key)}" aria-label="Tanca sense desar">×</button></div><form data-work-rotation-form="true" data-person="${esc(key)}"><div class="field"><label>Nom<input type="text" name="name" maxlength="120" value="${esc(work.name)}" data-work-field="name" required></label></div><div class="form-row"><div class="field"><label>Data d’inici<input type="date" name="startDate" value="${esc(work.startDate)}" data-work-field="startDate" required></label></div><div class="field"><label>Data final (opcional)<input type="date" name="endDate" value="${esc(work.endDate??'')}" data-work-field="endDate"></label></div></div><div class="field"><label>El patró es repeteix cada<select name="weeks" data-work-field="weeks">${Array.from({length:12},(_,i)=>`<option value="${i+1}" ${work.weeks===i+1?'selected':''}>${i+1} ${i?'setmanes':'setmana'}</option>`).join('')}</select></label></div><p class="settings-note">La setmana 1 comença el dilluns de la setmana de la data d’inici. El patró només s’aplica dins de les dates indicades. Festius i vacances anul·len la feina programada.</p><div class="work-week-tabs" role="group" aria-label="Setmana del patró">${Array.from({length:work.weeks},(_,i)=>`<button type="button" class="soft-btn ${i===week?'selected':''}" data-action="work-week" data-week="${i}" aria-pressed="${i===week}">Setmana ${i+1}</button>`).join('')}</div><p class="settings-note">${anchor?'Setmana '+(week+1)+': '+fmt(addDays(anchor,week*7))+' – '+fmt(addDays(anchor,week*7+6))+'.':''} Si l’hora final és anterior a la inicial, la franja acaba l’endemà.</p><div class="work-pattern-days">${Array.from({length:7},(_,wday)=>{
   const index=week*7+wday,shifts=work.days[index];
   return `<section class="work-pattern-day"><div class="panel-header"><h3>${weekdays[wday]}</h3><button type="button" class="secondary-btn" data-action="work-shift-add" data-day="${index}" ${shifts.length>=8?'disabled':''}>+ Franja</button></div>${shifts.length?shifts.map((s,j)=>`<div class="work-shift-row"><label class="field">Inici<input type="time" name="work-${index}-${j}-startTime" value="${esc(s.startTime)}" data-work-field="time" data-day="${index}" data-slot="${j}" data-edge="startTime" required></label><label class="field">Final<input type="time" name="work-${index}-${j}-endTime" value="${esc(s.endTime)}" data-work-field="time" data-day="${index}" data-slot="${j}" data-edge="endTime" required></label><button type="button" class="delete-icon" data-action="work-shift-remove" data-day="${index}" data-slot="${j}" aria-label="Elimina la franja ${j+1} de ${weekdays[wday]}">×</button></div>`).join(''):'<p class="settings-note">Sense feina</p>'}${shifts.length?`<button type="button" class="soft-btn work-copy" data-action="work-copy" data-day="${index}">Copia aquestes franges de dilluns a divendres</button>`:''}</section>`;
  }).join('')}</div><div class="action-row"><button type="submit" class="primary-btn">Desa els canvis</button><button type="button" class="soft-btn" data-action="work-cancel" data-person="${esc(key)}">Cancel·la</button></div></form>`;
 }
 function agenda(state,dates){
  if(state.preferences.showWorkSchedules===false)return '';
  const selected=state.preferences.visibleTimeOffPeople??Object.keys(state.personTimeOff??{});
  const people=state.guardians.filter(p=>selected.includes('guardian:'+p.id)&&rotations(state,'guardian:'+p.id).length);
  if(!people.length)return '';
  const rows=dates.filter(validDate).map(d=>{
   const entries=people.map(p=>{
    const key='guardian:'+p.id,items=slots(state,key,d),off=absence(state,key,d);
    if(!items.length&&!off&&dates.length>1)return '';
    const summary=off?esc(off):items.length?items.map(s=>`${s.startTime}–${s.endTime} <span class="work-slot-name">${esc(s.rotationName)}</span>`).join(' · '):'Sense feina programada';
    return `<div class="work-agenda-person"><button type="button" class="work-person-link" data-action="person-time-off" data-person="${esc(key)}">${esc(p.name)}${state.preferences.mePerson===key?' · Jo':''}</button><span>${summary}</span></div>`;
   }).join('');
   return entries?`<div class="work-agenda-day"><h3>${weekdays[weekday(d)]} ${fmt(d)}</h3>${entries}</div>`:'';
  }).join('');
  return `<section class="work-agenda" aria-label="Horari laboral"><h2 class="section-title">Horari laboral</h2>${rows||'<p class="settings-note">Sense feina programada aquests dies.</p>'}</section>`;
 }
 window.workSchedule={validDate,addDays,monday,clean,normalize,draft,change,edit,readForm,save,remove,rotations,absence,slots,scheduledSlots,isDayOff,listMarkup,form,agenda};
})();
