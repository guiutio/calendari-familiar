/* Horari laboral, festius i vacances personals: dades locals i contorns de dies consecutius. */
(()=>{
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const valid=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number(d.slice(0,4))>=100&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
 const fmt=d=>Number(d.slice(8,10))+'/'+Number(d.slice(5,7))+'/'+d.slice(0,4);
 const day=d=>Date.parse(d+'T12:00:00Z')/86400000;
 const people=state=>state.guardians.map(p=>({...p,key:'guardian:'+p.id,category:'Tutor / responsable'}));
 const person=(state,key)=>people(state).find(p=>p.key===key);
 const defaults={holiday:'#d32f2f',vacation:'#168948'};
 const validColor=c=>typeof c==='string'&&/^#[0-9a-fA-F]{6}$/.test(c);
 const color=(state,key,kind)=>{const c=get(state,key)[kind+'Color'];return validColor(c)?c:defaults[kind];};
 const get=(state,key)=>state.personTimeOff?.[key]??{holidays:[],vacations:[]};
 function clean(raw,children,guardians){
  if(raw===undefined)return {};
  if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>120)throw Error('Calendaris personals incorrectes');
  const known=new Set(people({children,guardians}).map(p=>p.key)),out={};
  for(const [key,value] of Object.entries(raw)){
   if(!known.has(key))continue;
   if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Calendari personal incorrecte');
   const holidays=value.holidays??[],vacations=value.vacations??[];
   if(!Array.isArray(holidays)||holidays.length>5000||holidays.some(d=>!valid(d)))throw Error('Dies festius personals incorrectes');
   if(!Array.isArray(vacations)||vacations.length>200)throw Error('Períodes de vacances personals incorrectes');
   const ids=new Set();
   const periods=vacations.map(p=>{
    if(!p||typeof p.id!=='string'||!p.id||p.id.length>100||ids.has(p.id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>120||!valid(p.startDate)||!valid(p.endDate)||p.endDate<p.startDate)throw Error('Període de vacances personal incorrecte');
    ids.add(p.id);return {id:p.id,name:p.name.trim(),startDate:p.startDate,endDate:p.endDate};
   }).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate));
   out[key]={holidays:[...new Set(holidays)].sort(),vacations:periods};
   if(value.workRotations!==undefined)out[key].workRotations=window.workSchedule.clean(value.workRotations);
   for(const kind of ['holiday','vacation']){const field=kind+'Color';if(value[field]!==undefined){if(!validColor(value[field]))throw Error('Color de calendari personal incorrecte');out[key][field]=value[field];}}
  }
  return out;
 }
 function cleanPreferences(raw,children,guardians,data){
  const known=new Set(people({children,guardians}).map(p=>p.key));
  const selected=raw.visibleTimeOffPeople===undefined?Object.keys(data):raw.visibleTimeOffPeople;
  if(!Array.isArray(selected)||['showPersonalHolidays','showPersonalVacations','showWorkSchedules'].some(k=>raw[k]!==undefined&&typeof raw[k]!=='boolean'))throw Error('Filtres de calendaris personals incorrectes');
  return {mePerson:known.has(raw.mePerson)?raw.mePerson:'',visibleTimeOffPeople:[...new Set(selected.filter(k=>known.has(k)))],showPersonalHolidays:raw.showPersonalHolidays??true,showPersonalVacations:raw.showPersonalVacations??true,showWorkSchedules:raw.showWorkSchedules??true};
 }
 function hasData(state,key){const data=get(state,key);return Boolean(data.holidays.length||data.vacations.length||data.workRotations?.length);}
 function firstSave(state,key){
  state.personTimeOff??={};state.preferences.visibleTimeOffPeople??=[];
  if(!Object.hasOwn(state.personTimeOff,key)&&!state.preferences.visibleTimeOffPeople.includes(key))state.preferences.visibleTimeOffPeople.push(key);
 }
 function setHolidays(state,key,dates){
  if(!person(state,key))return 'Persona no disponible';
  if(!Array.isArray(dates)||dates.length>5000||dates.some(d=>!valid(d)))return 'Revisa les dates dels festius';
  firstSave(state,key);state.personTimeOff[key]={...get(state,key),holidays:[...new Set(dates)].sort()};return '';
 }
 function setColor(state,key,kind,value){
  if(!person(state,key)||!['holiday','vacation'].includes(kind)||!validColor(value))return false;
  firstSave(state,key);state.personTimeOff[key]={...get(state,key),[kind+'Color']:value};return true;
 }
 function saveVacation(state,key,id,fields,newId){
  if(!person(state,key))return 'Persona no disponible';
  const name=String(fields.get('name')??'').trim(),startDate=String(fields.get('startDate')??''),endDate=String(fields.get('endDate')??'');
  if(!name||name.length>120)return 'Indica un nom de fins a 120 caràcters';
  if(!valid(startDate)||!valid(endDate)||startDate>endDate)return 'La data final ha de ser igual o posterior a la inicial';
  const current=get(state,key),old=current.vacations.find(p=>p.id===id);
  if(id&&!old)return 'Aquest període ja no existeix';
  if(!old&&current.vacations.length>=200)return 'No es poden afegir més de 200 períodes per persona';
  const item={id:old?.id??newId(),name,startDate,endDate};
  firstSave(state,key);state.personTimeOff[key]={...current,vacations:[...current.vacations.filter(p=>p.id!==id),item].sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate))};return '';
 }
 function deleteVacation(state,key,id){
  const current=state.personTimeOff?.[key];if(!current||!current.vacations.some(p=>p.id===id))return false;
  current.vacations=current.vacations.filter(p=>p.id!==id);return true;
 }
 function removePerson(state,key){
  if(state.personTimeOff)delete state.personTimeOff[key];
  if(state.preferences.mePerson===key)state.preferences.mePerson='';
  if(state.preferences.visibleTimeOffPeople)state.preferences.visibleTimeOffPeople=state.preferences.visibleTimeOffPeople.filter(k=>k!==key);
 }
 function setMe(state,key){if(!person(state,key))return false;state.preferences.mePerson=state.preferences.mePerson===key?'':key;return true;}
 function showAll(state){state.preferences.showWorkSchedules=true;state.preferences.showPersonalHolidays=true;state.preferences.showPersonalVacations=true;state.preferences.visibleTimeOffPeople=people(state).filter(p=>hasData(state,p.key)).map(p=>p.key);}
 function filtered(state){
  const keys=people(state).filter(p=>hasData(state,p.key)).map(p=>p.key),prefs=state.preferences;
  return keys.length>0&&(prefs.showPersonalHolidays===false||prefs.showPersonalVacations===false||prefs.showWorkSchedules===false||keys.some(k=>!(prefs.visibleTimeOffPeople??keys).includes(k)));
 }
 function mergeRanges(raw){
  const sorted=raw.map(p=>({startDate:p.startDate,endDate:p.endDate})).sort((a,b)=>a.startDate.localeCompare(b.startDate)||a.endDate.localeCompare(b.endDate)),out=[];
  for(const p of sorted){const last=out.at(-1);if(last&&day(p.startDate)<=day(last.endDate)+1){if(p.endDate>last.endDate)last.endDate=p.endDate;}else out.push(p);}
  return out;
 }
 function visibleEntries(state,from='0100-01-01',to='9999-12-31'){
  const prefs=state.preferences,out=[],keys=prefs.visibleTimeOffPeople??Object.keys(state.personTimeOff??{});
  for(const p of people(state)){
   if(!keys.includes(p.key))continue;const data=get(state,p.key);
   const clip=ranges=>ranges.filter(r=>r.endDate>=from&&r.startDate<=to).map(r=>({...r,startDay:day(r.startDate),endDay:day(r.endDate)}));
   if(prefs.showPersonalHolidays!==false&&data.holidays.length){const ranges=clip(mergeRanges(data.holidays.map(d=>({startDate:d,endDate:d}))));if(ranges.length)out.push({key:p.key,name:p.name,kind:'holiday',color:color(state,p.key,'holiday'),ranges});}
   if(prefs.showPersonalVacations!==false&&data.vacations.length){const ranges=clip(mergeRanges(data.vacations));if(ranges.length)out.push({key:p.key,name:p.name,kind:'vacation',color:color(state,p.key,'vacation'),ranges});}
  }
  return out;
 }
 function marks(entries,date,monthStart,monthEnd){
  if(!valid(date)||!valid(monthStart)||!valid(monthEnd))return {items:[],label:'',html:''};
  const n=day(date),first=day(monthStart),last=day(monthEnd),weekday=(new Date(date+'T12:00:00Z').getUTCDay()+6)%7,items=[];
  for(const entry of entries)for(const range of entry.ranges){
   const start=Math.max(first,range.startDay??day(range.startDate)),end=Math.min(last,range.endDay??day(range.endDate));
   if(n<start||n>end)continue;
   const top=n-7<start,bottom=n+7>end,left=weekday===0||n-1<start,right=weekday===6||n+1>end;
   items.push({...entry,color:validColor(entry.color)?entry.color:defaults[entry.kind],startDate:range.startDate,endDate:range.endDate,top,bottom,left,right});
  }
  const label=[...new Set(items.map(p=>(p.kind==='holiday'?'Festiu de ':'Vacances de ')+p.name))].join('. ');
  const paint=colors=>{const unique=[...new Set(colors)];return unique.length===1?`linear-gradient(${unique[0]},${unique[0]})`:`repeating-linear-gradient(45deg,${unique.map((c,i)=>`${c} ${i*4}px ${(i+1)*4}px`).join(',')})`;};
  return {items,label,html:items.map(p=>{
   const edges=['top','right','bottom','left'].filter(edge=>p[edge]);
   const style=edges.map(edge=>`--pto-${edge}-paint:${paint(items.filter(q=>q[edge]).map(q=>q.color))}`).join(';');
   return `<span class="personal-outline ${p.kind} ${edges.map(edge=>'pto-'+edge).join(' ')}" style="${style}" data-person-key="${esc(p.key)}" data-personal-kind="${p.kind}" aria-hidden="true"></span>`;
  }).join('')};
 }
 function filterMarkup(state){
  const prefs=state.preferences,available=people(state).filter(p=>hasData(state,p.key)),selected=prefs.visibleTimeOffPeople??available.map(p=>p.key);
  return `<div class="sheet-section-label">Horari laboral</div><p class="settings-note">Festius i vacances a Any i Mes; franges de feina a Dia i Setmana.</p>${[['holiday','Festius personals','showPersonalHolidays'],['vacation','Vacances personals','showPersonalVacations'],['work','Franges de feina','showWorkSchedules']].map(([kind,label,flag])=>`<button class="option ${prefs[flag]!==false?'selected':''}" data-action="person-off-type" data-kind="${kind}" aria-pressed="${prefs[flag]!==false}"><span class="option-left">${label}</span>${prefs[flag]!==false?'✓':'Ocult'}</button>`).join('')}
   ${available.length?`<p class="settings-note">Persones que vols veure:</p>${available.map(p=>`<button class="option ${selected.includes(p.key)?'selected':''}" data-action="person-off-filter" data-person="${esc(p.key)}" aria-pressed="${selected.includes(p.key)}"><span>${esc(p.name)}${prefs.mePerson===p.key?' · Jo':''}<small class="person-category">${p.category}</small><span class="personal-person-colors"><span class="personal-legend" style="border-color:${color(state,p.key,'holiday')}" title="Festius"></span><span class="personal-legend" style="border-color:${color(state,p.key,'vacation')}" title="Vacances"></span></span></span>${selected.includes(p.key)?'✓':'Ocult'}</button>`).join('')}`:'<p class="settings-note">Configura l’horari laboral des de Persones.</p>'}`;
 }
 function legendMarkup(state){
  return visibleEntries(state).map(p=>`<span class="legend-entry"><span class="personal-legend" style="border-color:${p.color}"></span>${p.kind==='holiday'?'Festius personals':'Vacances personals'} · ${esc(p.name)}</span>`).join('');
 }
 const heading=(title,subtitle)=>`<div class="sheet-heading"><div><h2 class="sheet-title">${esc(title)}</h2><p class="sheet-subtitle">${esc(subtitle)}</p></div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div>`;
 function panel(state,key){
  const p=person(state,key);if(!p)return '';const data=get(state,key);
  const colorInput=(kind,label)=>`<input class="color-input" type="color" value="${color(state,key,kind)}" data-action="person-off-color" data-person="${esc(key)}" data-kind="${kind}" aria-label="${label} de ${esc(p.name)}">`;
  return heading('Horari laboral',p.name+(state.preferences.mePerson===key?' · Jo':''))+
   (window.workSchedule?window.workSchedule.listMarkup(state,key):'')+`<div class="school-period"><div class="panel-header"><div class="personal-section-title">${colorInput('holiday','Color dels festius')}<strong>Festius (${data.holidays.length})</strong></div><button type="button" class="secondary-btn" data-action="person-holidays" data-person="${esc(key)}">Tria dies</button></div><div class="school-day-list">${data.holidays.map(d=>`<span class="school-day-pill personal-holiday-pill">${fmt(d)}<button type="button" data-action="person-holiday-delete" data-person="${esc(key)}" data-date="${d}" aria-label="Suprimeix el festiu del ${d}">×</button></span>`).join('')||'<p class="settings-note">Encara no hi ha festius.</p>'}</div></div>
   <div class="school-period"><div class="panel-header"><div class="personal-section-title">${colorInput('vacation','Color de les vacances')}<strong>Vacances (${data.vacations.length})</strong></div><button type="button" class="secondary-btn" data-action="person-vacation-add" data-person="${esc(key)}">+ Període</button></div>
   ${data.vacations.map(v=>`<div class="school-schedule-row"><div><strong>${esc(v.name)}</strong><span class="school-meta">${fmt(v.startDate)} – ${fmt(v.endDate)}</span></div><div class="school-schedule-actions"><button type="button" class="school-schedule-edit" data-action="person-vacation-edit" data-person="${esc(key)}" data-period="${esc(v.id)}">Edita</button><button type="button" class="delete-icon" data-action="person-vacation-delete" data-person="${esc(key)}" data-period="${esc(v.id)}" aria-label="Suprimeix ${esc(v.name)}">×</button></div></div>`).join('')||'<p class="settings-note">Afegeix un període amb nom, inici i final.</p>'}</div><p class="settings-note">Els colors escollits s’apliquen als contorns de les vistes Any i Mes.</p>`;
 }
 const months=['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
 function holidayPicker(state,draft){
  const p=person(state,draft.personKey);if(!p)return '';
  const [year,month]=draft.month.split('-').map(Number),offset=(new Date(Date.UTC(year,month-1,1)).getUTCDay()+6)%7,count=new Date(Date.UTC(year,month,0)).getUTCDate();
  const selected=new Set(draft.dates),title=months[month-1]+' '+year,cells=Array.from({length:offset},()=>'<span aria-hidden="true"></span>');
  for(let d=1;d<=count;d++){const date=draft.month+'-'+String(d).padStart(2,'0');cells.push(`<button type="button" class="school-date-cell ${selected.has(date)?'selected':''}" data-action="person-holiday-toggle" data-date="${date}" aria-label="${date}" aria-pressed="${selected.has(date)}">${d}</button>`);}
  return heading('Tria festius',p.name)+`<p class="settings-note">Marca o desmarca dies de diversos mesos. Pots incloure caps de setmana.</p><div class="school-date-picker personal-holidays" style="--personal-holiday-color:${color(state,p.key,'holiday')}"><div class="school-date-nav"><button type="button" class="soft-btn" data-action="person-holiday-month" data-step="-1" aria-label="Mes anterior" ${draft.month==='0100-01'?'disabled':''}>‹</button><h3>${title}</h3><button type="button" class="soft-btn" data-action="person-holiday-month" data-step="1" aria-label="Mes següent" ${draft.month==='9999-12'?'disabled':''}>›</button></div><div class="school-date-weekdays" aria-hidden="true">${['Dl','Dt','Dc','Dj','Dv','Ds','Dg'].map(d=>`<span>${d}</span>`).join('')}</div><div class="school-date-grid" role="group" aria-label="${title}">${cells.join('')}</div></div><p class="school-date-count" role="status">${draft.dates.length} ${draft.dates.length===1?'dia seleccionat':'dies seleccionats'}</p><div class="action-row"><button type="button" class="primary-btn" data-action="person-holidays-save">Desa els dies</button><button type="button" class="soft-btn" data-action="person-time-off" data-person="${esc(p.key)}">Cancel·la</button></div>`;
 }
 function vacationForm(state,key,id,today){
  const p=person(state,key),v=get(state,key).vacations.find(v=>v.id===id);if(!p||(id&&!v))return '';
  return heading(v?'Edita vacances':'Afegeix vacances',p.name)+`<form data-person-vacation-form="true" data-person="${esc(key)}" data-period="${esc(v?.id??'')}"><div class="school-form-fields"><div class="field"><label>Nom del període<input type="text" name="name" maxlength="120" value="${esc(v?.name??'Vacances')}" required></label></div><div class="form-row"><div class="field"><label>Data d’inici<input type="date" name="startDate" value="${v?.startDate??today}" required></label></div><div class="field"><label>Data final<input type="date" name="endDate" value="${v?.endDate??today}" required></label></div></div></div><p class="settings-note">L’inici i el final estan inclosos.</p><div class="action-row"><button type="submit" class="primary-btn">Desa el període</button><button type="button" class="soft-btn" data-action="person-time-off" data-person="${esc(key)}">Cancel·la</button></div></form>`;
 }
 window.personalTimeOff={valid,color,setColor,people,person,get,clean,cleanPreferences,hasData,setHolidays,saveVacation,deleteVacation,removePerson,setMe,showAll,filtered,mergeRanges,visibleEntries,marks,filterMarkup,legendMarkup,panel,holidayPicker,vacationForm};
})();
