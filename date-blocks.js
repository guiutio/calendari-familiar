/* Edicions de franges per data i fill, independents dels patrons originals. */
(()=>{
 const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
 const validDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!isNaN(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 const clock=value=>typeof value==='string'&&(value==='24:00'||/^([01]\d|2[0-3]):[0-5]\d$/.test(value));
 const minutes=time=>Number(time.slice(0,2))*60+Number(time.slice(3));
 const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
 const key=(date,childId,sourceId)=>[date,childId,sourceId].map(encodeURIComponent).join('|');
 const color=value=>typeof value==='string'&&(/^#[\da-f]{6}$/i.test(value)||/^hsl\(\d{1,3} \d{1,3}% \d{1,3}%\)$/.test(value));
 function clean(raw,children,guardians){
  if(raw==null)return {};
  if(typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>50000)throw Error('Les edicions puntuals no són vàlides');
  const result={};
  for(const [id,item] of Object.entries(raw)){
   if(!item||!validDate(item.date)||typeof item.childId!=='string'||typeof item.sourceId!=='string'||!item.sourceId||item.sourceId.length>1500||id!==key(item.date,item.childId,item.sourceId)||!['night','activity','rotation','slot','manual'].includes(item.kind)||!item.sourceId.startsWith(item.kind+':')||!clock(item.startTime)||item.startTime==='24:00'||!clock(item.endTime)||minutes(item.startTime)>=minutes(item.endTime)||typeof item.guardianId!=='string'||typeof item.name!=='string'||!item.name.trim()||item.name.length>120||typeof item.note!=='string'||item.note.length>2000||typeof item.disabled!=='boolean'||!color(item.color))throw Error('Hi ha una edició puntual incorrecta');
   if(!children.some(c=>c.id===item.childId))continue;
   if(item.guardianId&&!guardians.some(g=>g.id===item.guardianId))throw Error('El tutor de l’edició puntual no existeix');
   result[id]={date:item.date,childId:item.childId,sourceId:item.sourceId,kind:item.kind,startTime:item.startTime,endTime:item.endTime,guardianId:item.guardianId,name:item.name,note:item.note,disabled:item.disabled,color:item.color};
  }
  return result;
 }
 function sources(date,data){
  const list=[];
  for(const [childId,items] of Object.entries(data.nights))for(const item of items)list.push({date,childId,sourceId:'night:'+item.date,kind:'night',startTime:fmt(item.from),endTime:fmt(item.to),guardianId:item.guardianId??'',name:'Pernocta',note:item.note??'',color:item.guardianColor,item});
  for(const item of data.activities)list.push({date,childId:item.childId,sourceId:'activity:'+encodeURIComponent(item.schoolId)+':'+encodeURIComponent(item.id),kind:'activity',startTime:item.startTime,endTime:item.endTime,guardianId:item.guardianId??'',name:String(item.kind==='Extraescolar'?item.schoolName:item.description||item.kind).slice(0,120),note:item.note??'',color:item.color,item});
  for(const item of data.extra)list.push({date,childId:item.childId,sourceId:'rotation:'+item.rotationId,kind:'rotation',startTime:item.startTime,endTime:item.endTime,guardianId:item.guardianId??'',name:item.rotationName,note:item.note??'',color:item.color,item});
  for(const [childId,items] of Object.entries(data.slots))for(const item of items)list.push({date,childId,sourceId:'slot:'+item.id,kind:'slot',startTime:item.startTime,endTime:item.endTime,guardianId:item.guardianId??'',name:item.label||item.name||'Franja puntual',note:item.note??'',color:item.color,item});
  return list;
 }
 function apply(state,date,children,data){
  const result={nights:{},activities:[],slots:{},extra:[]};
  const allowed=new Set(children.map(c=>c.id));
  const visibleGuardian=id=>!id||state.preferences.visibleGuardians.includes(id);
  const append=(source,edit)=>{
   if(edit?.disabled||!allowed.has(source.childId))return;
   const item={...source.item},current=edit??source,who=state.guardians.find(g=>g.id===current.guardianId);
   item.dateBlock=source.sourceId;item.note=current.note;item.blockName=edit?current.name:'';
   if(edit){
    item.startTime=current.startTime;item.endTime=current.endTime;
    item.guardianId=current.guardianId;item.guardianName=who?.name??'Sense assignar';
    if(source.kind==='activity'){item.start=minutes(current.startTime);item.end=minutes(current.endTime);}
    else{item.from=minutes(current.startTime);item.to=minutes(current.endTime);item.visible=visibleGuardian(current.guardianId);}
    if(source.kind==='night')item.guardianColor=who?.color??'#8795a7';
    if(['slot','manual','rotation'].includes(source.kind)){item.color=who?.color??current.color;item.name=current.name;}
    if(source.kind==='rotation')item.rotationName=current.name;
   }
   if(source.kind==='activity')result.activities.push(item);
   else if(source.kind==='rotation')result.extra.push(item);
   else if(source.kind==='night')(result.nights[source.childId]??=[]).push(item);
   else if(item.visible!==false)(result.slots[source.childId]??=[]).push(item);
  };
  for(const source of sources(date,data))append(source,state.dateEdits?.[key(date,source.childId,source.sourceId)]);
  for(const edit of Object.values(state.dateEdits??{}))if(edit.date===date&&edit.kind==='manual')append({...edit,item:{id:edit.sourceId,childId:edit.childId,label:edit.name}},edit);
  for(const items of Object.values(result.nights))items.sort((a,b)=>a.from-b.from);
  return result;
 }
 function find(state,date,childId,sourceId,data){
  const stored=state.dateEdits?.[key(date,childId,sourceId)];
  if(stored?.disabled)return {...stored};
  const source=sources(date,data).find(s=>s.childId===childId&&(s.item.dateBlock??s.sourceId)===sourceId);
  if(stored)return {...stored};
  return source?{...source,item:undefined,disabled:false}:null;
 }
 function form(state,date,childId,sourceId,data,origin=''){
  if(!state.children.length)return '<h2 class="sheet-title">Afegeix una franja</h2><p class="settings-note">Primer cal afegir un fill al calendari.</p><button type="button" class="primary-btn" data-action="tab" data-tab="people">Afegeix un fill</button><button type="button" class="soft-btn" data-action="close-sheet">Tanca</button>';
  const item=sourceId?find(state,date,childId,sourceId,data):{date,childId:childId||state.children[0]?.id||'',sourceId:'',kind:'manual',name:'Franja puntual',startTime:'09:00',endTime:'10:00',guardianId:'',note:''};
  if(!item)return '<p class="settings-note">Aquesta franja ja no està disponible.</p>';
  const edit=!!sourceId,stored=state.dateEdits?.[key(date,childId,sourceId)];
  return `<div class="sheet-heading"><div><h2 class="sheet-title">${origin==='extracurricular'?'Edita el canvi puntual':edit?'Edita la franja':'Afegeix una franja'}</h2><p class="sheet-subtitle">Només aquesta data i aquest fill</p></div><button type="button" class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div>
  <form data-date-block-form="true" data-origin="${esc(origin)}" data-date="${esc(date)}" data-child="${esc(childId)}" data-source="${esc(sourceId)}" class="month-slot-form date-block-form">
  <div class="form-row"><div class="field"><label for="db-date">Data</label><input id="db-date" name="date" type="date" value="${esc(item.date)}" required ${edit?'readonly':''}></div><div class="field"><label for="db-child">Fill</label><select id="db-child" name="childId" ${edit?'disabled':''} required>${state.children.map(c=>`<option value="${esc(c.id)}" ${c.id===item.childId?'selected':''}>${esc(c.name)}</option>`).join('')}</select></div></div>
  <div class="field"><label for="db-name">Nom de la franja</label><input id="db-name" name="name" maxlength="120" value="${esc(item.name)}" required></div>
  <div class="form-row"><div class="field"><label for="db-start">Inici</label><input id="db-start" type="time" name="startTime" value="${esc(item.startTime)}" required></div><div class="field"><label for="db-end">Final</label><input id="db-end" type="time" name="endTime" value="${esc(item.endTime==='24:00'?'23:59':item.endTime)}" required><label class="month-slot-midnight"><input type="checkbox" name="endAtMidnight" ${item.endTime==='24:00'?'checked':''}> Fins a les 24:00</label></div></div>
  <div class="field"><label for="db-guardian">Tutor responsable</label><select id="db-guardian" name="guardianId"><option value="">Sense tutor assignat</option>${state.guardians.map(g=>`<option value="${esc(g.id)}" ${item.guardianId===g.id?'selected':''}>${esc(g.name)}</option>`).join('')}</select></div>
  <div class="field"><label for="db-note">Nota (opcional)</label><textarea id="db-note" name="note" maxlength="2000" rows="3">${esc(item.note)}</textarea></div>
  ${stored?.disabled?'<label class="month-slot-midnight"><input type="checkbox" name="disabled" checked> Mantenir la franja eliminada aquest dia</label>':''}
  <p class="settings-note">Els horaris i patrons originals es conserven. Pots recuperar la franja des d’«Edita el dia».</p>
  <div class="action-row"><button type="submit" class="primary-btn">Desa els canvis</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button>${edit&&origin!=='extracurricular'?`<button type="button" class="danger-btn" data-action="date-block-delete" data-origin="${esc(origin)}" data-date="${esc(date)}" data-child="${esc(childId)}" data-source="${esc(sourceId)}">Elimina només aquest dia</button>`:''}${stored&&stored.kind!=='manual'&&origin!=='extracurricular'?`<button type="button" class="soft-btn" data-action="date-block-restore" data-origin="${esc(origin)}" data-date="${esc(date)}" data-child="${esc(childId)}" data-source="${esc(sourceId)}">Restaura la franja original</button>`:''}${stored&&origin==='extracurricular'?`<button type="button" class="danger-btn" data-action="date-block-discard" data-origin="${esc(origin)}" data-date="${esc(date)}" data-child="${esc(childId)}" data-source="${esc(sourceId)}">Elimina el canvi puntual</button>`:''}</div>${stored&&origin==='extracurricular'?'<p class="settings-note">Eliminar el canvi puntual recupera la franja original.</p>':''}</form>`;
 }
 function save(state,date,childId,sourceId,values,data,newId){
  if(!validDate(date)||!state.children.some(c=>c.id===childId))return 'Data o fill no vàlid';
  const old=sourceId?find(state,date,childId,sourceId,data):null;
  if(sourceId&&!old)return 'Aquesta franja ja no està disponible';
  const text=name=>String(values.get(name)??'').trim();
  const name=text('name'),note=text('note'),startTime=text('startTime'),endTime=values.has('endAtMidnight')?'24:00':text('endTime'),guardianId=text('guardianId');
  if(!name||name.length>120||note.length>2000)return 'Revisa el nom i la nota de la franja';
  if(!clock(startTime)||startTime==='24:00'||!clock(endTime)||minutes(startTime)>=minutes(endTime))return 'La franja ha de tenir una hora final posterior a la inicial';
  if(guardianId&&!state.guardians.some(g=>g.id===guardianId))return 'Tutor no vàlid';
  const source=sourceId||'manual:'+newId();
  state.dateEdits??={};
  state.dateEdits[key(date,childId,source)]={date,childId,sourceId:source,kind:old?.kind??'manual',name,note,startTime,endTime,guardianId,color:old?.color??'#87b7dd',disabled:!!old?.disabled&&values.has('disabled')};
  return '';
 }
 function remove(state,date,childId,sourceId,data){
  const source=find(state,date,childId,sourceId,data);if(!source)return false;
  const {item,...entry}=source;state.dateEdits??={};state.dateEdits[key(date,childId,sourceId)]={...entry,disabled:true};return true;
 }
 function restore(state,date,childId,sourceId){
  const id=key(date,childId,sourceId),entry=state.dateEdits?.[id];if(!entry)return false;
  if(entry.kind==='manual')entry.disabled=false;else delete state.dateEdits[id];return true;
 }
 function discard(state,date,childId,sourceId){
  const id=key(date,childId,sourceId);if(!state.dateEdits?.[id])return false;
  delete state.dateEdits[id];return true;
 }
 function changes(state,date){
  if(!date)return '';
  const entries=Object.values(state.dateEdits??{}).filter(e=>!date||e.date===date).sort((a,b)=>b.date.localeCompare(a.date)||a.startTime.localeCompare(b.startTime)||a.childId.localeCompare(b.childId)||a.sourceId.localeCompare(b.sourceId));
  const origin=date?'day':'extracurricular';
  const rows=entries.map(e=>{
   const identity=`data-origin="${origin}" data-date="${esc(e.date)}" data-child="${esc(e.childId)}" data-source="${esc(e.sourceId)}"`;
   const status=e.disabled?'Eliminada aquest dia':e.kind==='manual'?'Afegida':'Modificada';
   const type=e.kind==='activity'?(e.sourceId.startsWith('activity:ec%3A')?'Extraescolar':'Escola'):({night:'Pernocta',rotation:'Rotació',slot:'Franja puntual',manual:'Franja puntual'})[e.kind];
   const day=e.date.split('-').reverse().join('/');
   const guardian=state.guardians.find(g=>g.id===e.guardianId)?.name||'Sense tutor assignat';
   return `<li class="date-block-change"><div><strong>${esc(e.name)}</strong><span class="date-block-status">${status}</span><small>${!date?day+' · ':''}${esc(state.children.find(c=>c.id===e.childId)?.name)} · ${type}</small><small>${esc(e.startTime)}–${esc(e.endTime)} · ${esc(guardian)}</small>${e.note?`<p class="date-block-note">${esc(e.note)}</p>`:''}</div><div class="date-block-change-actions"><button type="button" class="soft-btn" data-action="date-block-edit" ${identity} aria-label="Edita el canvi de ${esc(e.name)}, ${esc(state.children.find(c=>c.id===e.childId)?.name)}, ${day}">Edita</button>${e.disabled?`<button type="button" class="soft-btn" data-action="date-block-restore" ${identity}>${e.kind==='manual'?'Recupera':'Restaura original'}</button>`:''}<button type="button" class="soft-btn" data-action="date-block-discard" ${identity}>Desfés el canvi</button></div></li>`;
  }).join('');
  const help='Revisa les franges afegides, modificades i eliminades. Desfer un canvi recupera la franja original; si era una franja afegida, la treu del calendari.';
  return `${date?'<div class="sheet-section-label">Canvis puntuals d’aquest dia</div>':'<section class="card"><h2 class="section-title">Canvis puntuals</h2>'}<p class="settings-note">${help}</p>${entries.length?`<ol class="date-block-changes" aria-label="${date?'Canvis puntuals del dia':'Canvis puntuals del calendari, de més recent a més antic'}">${rows}</ol>`:`<p class="settings-note">${date?'Aquest dia no té canvis puntuals de franges.':'No hi ha canvis puntuals de franges.'}</p>`}${date?'':'</section>'}`;
 }
 function groupChanges(state,{courseId,activityId,groupId}){
  const prefix='activity:'+encodeURIComponent('ec:'+encodeURIComponent(activityId))+':'+encodeURIComponent(['ec',courseId,activityId,groupId].map(encodeURIComponent).join(':')+':');
  const entries=Object.values(state.dateEdits??{}).filter(e=>e.kind==='activity'&&e.sourceId.startsWith(prefix)).sort((a,b)=>a.date.localeCompare(b.date)||a.startTime.localeCompare(b.startTime)||a.childId.localeCompare(b.childId)||a.sourceId.localeCompare(b.sourceId));
  const rows=entries.map(e=>{
   const day=e.date.split('-').reverse().join('/'),child=state.children.find(c=>c.id===e.childId)?.name??'';
   const status=e.disabled?'Eliminada aquest dia':'Modificada';
   return `<li class="person-list-row"><button type="button" class="person-list-open" data-action="date-block-edit" data-origin="extracurricular" data-date="${esc(e.date)}" data-child="${esc(e.childId)}" data-source="${esc(e.sourceId)}" aria-label="Obre el canvi de ${esc(e.name)}, ${esc(child)}, ${day}"><span class="person-list-name">${day} · ${esc(e.name)}<small>${esc(child)} · ${esc(e.startTime)}–${esc(e.endTime)} · ${status}</small></span><span aria-hidden="true">›</span></button></li>`;
  }).join('');
  return `<section class="card"><h2 class="section-title">Canvis puntuals</h2><p class="settings-note">D’aquest grup, de més antic a més recent. Toca un canvi per editar-lo o eliminar-lo.</p>${entries.length?`<ol class="people-list" aria-label="Canvis puntuals del grup, de més antic a més recent">${rows}</ol>`:'<p class="settings-note">Aquest grup no té canvis puntuals.</p>'}</section>`;
 }
 function clearDate(state,date){for(const [id,e] of Object.entries(state.dateEdits??{}))if(e.date===date)delete state.dateEdits[id];}
 function removePerson(state,kind,id,replacement=''){for(const [key,e] of Object.entries(state.dateEdits??{})){if(kind==='child'&&e.childId===id)delete state.dateEdits[key];else if(kind==='guardian'&&e.guardianId===id)e.guardianId=replacement;}}
 window.dateBlocks={key,clean,apply,find,form,save,remove,restore,discard,changes,groupChanges,clearDate,removePerson};
})();
