/* Editor i operacions de rotacions addicionals; cadascuna té patró propi. */
(()=>{
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const miniDate=(date)=>{const d=new Date(date+'T12:00:00Z');return ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'][(d.getUTCDay()+6)%7];};
 const safeLength=(r)=>r.length%7===0?'weeks':'days';
 const title=(r)=>escape(r.name);
 const root=id=>document.querySelector('[data-extra-rotation="'+CSS.escape(id)+'"]');
 function render(state,expanded,units={}){
   const kids=state.children,guardians=state.guardians,rotations=state.extraRotations??[];
   const cards=rotations.map(r=>{
     const open=expanded===r.id,unit=units[r.id]??safeLength(r),scale=unit==='weeks'?7:1;
     const first=r.childIds[0],allSame=r.childIds.length>1&&r.childIds.every(id=>JSON.stringify(r.assignments[id])===JSON.stringify(r.assignments[first]));
     return `<section class="card extra-rotation-card" data-extra-rotation="${escape(r.id)}">
       <div class="panel-header"><div><h2 class="section-title">${title(r)}</h2><p class="settings-note">${r.length} dies · ${escape(r.startTime)}–${escape(r.endTime)} · ${r.childIds.length} fills</p></div>
       <div class="action-row"><button class="secondary-btn" data-action="extra-toggle" data-rotation="${escape(r.id)}">${open?'Tanca':'Edita'}</button><button class="delete-icon" data-action="extra-delete" data-rotation="${escape(r.id)}" aria-label="Suprimeix ${title(r)}">×</button></div></div>
       ${open?`<div class="extra-editor">
         <div class="field"><label>Nom de la rotació<input data-extra-change="name" data-rotation="${escape(r.id)}" maxlength="80" value="${title(r)}"></label></div>
         <div class="form-row"><div class="field"><label>Comença<input type="date" data-extra-change="startDate" data-rotation="${escape(r.id)}" value="${escape(r.startDate)}"></label></div>
         <div class="field"><label>Durada<input type="number" min="1" max="${Math.floor(3640/scale)}" data-extra-change="length" data-rotation="${escape(r.id)}" value="${r.length/scale}" step="1"></label>
           <select data-extra-change="unit" data-rotation="${escape(r.id)}" aria-label="Unitat de la rotació"><option value="days" ${unit==='days'?'selected':''}>dies</option><option value="weeks" ${unit==='weeks'?'selected':''}>setmanes</option></select></div></div>
         <div class="form-row"><div class="field"><label>Inici de la franja<input type="time" data-extra-change="startTime" data-rotation="${escape(r.id)}" value="${escape(r.startTime)}"></label></div>
         <div class="field"><label>Final de la franja<input type="time" data-extra-change="endTime" data-rotation="${escape(r.id)}" value="${escape(r.endTime)}"></label></div></div>
         <p class="settings-note">Selecciona els dies en què existeix aquesta franja i els fills participants. Les caselles de responsables són independents per a cada fill.</p>
         <div class="extra-active-days">${Array.from({length:r.length},(_,i)=>`<button type="button" class="extra-day-toggle ${r.activeDays?.[i]===false?'inactive':'active'}" aria-pressed="${r.activeDays?.[i]!==false}" data-action="extra-day-toggle" data-rotation="${escape(r.id)}" data-index="${i}" title="Dia ${i+1}: ${r.activeDays?.[i]===false?'sense franja':'amb franja'}">D${i+1} ${r.activeDays?.[i]===false?'—':'✓'}</button>`).join('')}</div>
         <div class="extra-kids">${kids.map(c=>`<button class="option ${r.childIds.includes(c.id)?'selected':''}" aria-pressed="${r.childIds.includes(c.id)}" data-action="extra-child" data-rotation="${escape(r.id)}" data-child="${escape(c.id)}">${escape(c.name)} ${r.childIds.includes(c.id)?'✓':''}</button>`).join('')}</div>
         ${r.childIds.length>1?`<div class="action-row"><button class="secondary-btn" data-action="extra-all" data-rotation="${escape(r.id)}">Tots igual</button>
         ${allSame?'<span class="settings-note">Tots els fills tenen el mateix patró.</span>':''}</div>`:''}
         ${r.childIds.map((id,n)=>{
           const c=kids.find(k=>k.id===id),arr=r.assignments[id]??[];
           return `<div class="rotation-child"><div class="rotation-child-header"><strong>${escape(c?.name??id)}</strong>
              ${r.childIds.filter(fromId=>fromId!==id).map(fromId=>`<button class="soft-btn" data-action="extra-copy" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-from="${escape(fromId)}">Copiar de ${escape(kids.find(x=>x.id===fromId)?.name??fromId)}</button>`).join('')}</div>
             ${Array.from({length:Math.ceil(r.length/7)},(_,week)=>`<div class="rotation-week"><div class="rotation-week-header"><div class="rotation-week-title">Setmana ${week+1}</div><button class="week-fill-btn" data-action="extra-week" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-week="${week}" title="Aplica a tota la setmana el responsable del primer dia">Copia el primer dia a la setmana</button></div>
             <div class="rotation-days">${Array.from({length:Math.min(7,r.length-week*7)},(_,day)=>{
               const i=week*7+day,g=guardians.find(x=>x.id===arr[i]);
               return `<button type="button" class="rotation-cell" data-action="extra-cell" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-index="${i}" title="${escape(g?.name??'Sense assignar')} · toca per canviar"><span class="small-day">${miniDate(addDays(r.startDate,i))}</span><span class="guardian-initial" style="background:${escape(g?.color??'#e1e6ee')}">${escape((g?.name??'—').slice(0,1))}</span></button>`;
             }).join('')}</div></div>`).join('')}</div>`;
         }).join('')}
       </div>`:''}
     </section>`;
   });
   return `<div class="extra-rotation-section"><div class="panel-header"><h2 class="section-title">Altres rotacions</h2><button class="secondary-btn" data-action="extra-add">+ Nova rotació</button></div>
     <p class="section-description">Recollida d'escola, trajectes, activitats o qualsevol altre motiu. Cada rotació té dates, durada i horari independents de la pernocta; pots assignar un responsable per fill i fer excepcions al calendari.</p>
     ${cards.join('')||'<p class="settings-note">Encara no has creat cap rotació addicional.</p>'}</div>`;
 }
 function addDays(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
 function nextGuardian(current,guardians){const choices=['',...guardians.map(g=>g.id)];return choices[(choices.indexOf(current)+1)%choices.length]??'';}
 function create(state,id,today){
   const first=state.children[0]?.id;
   const item={id,name:'Nova rotació',startDate:today,length:7,startTime:'16:30',endTime:'17:30',childIds:first?[first]:[],assignments:first?{[first]:Array(7).fill('')}:{ },activeDays:Array(7).fill(true)};
   state.extraRotations.push(item);return item;
 }
 function click(state,action,data,newId,today,confirmFn){
   const r=state.extraRotations.find(x=>x.id===data.rotation);
   if(action==='extra-add')return {open:create(state,newId(),today).id,save:true};
   if(!r)return null;
   if(action==='extra-toggle')return {open:data.rotation,save:false,toggle:true};
   if(action==='extra-delete'){if(!confirmFn('Vols eliminar «'+r.name+'» i totes les seves excepcions?'))return null;
     state.extraRotations=state.extraRotations.filter(x=>x.id!==r.id);
     for(const key of Object.keys(state.extraExceptions))if(key.startsWith(r.id+'|'))delete state.extraExceptions[key];
     return {open:null,save:true};
   }
   if(action==='extra-day-toggle'){
     const index=Number(data.index);if(!Number.isInteger(index)||index<0||index>=r.length)return null;
     if(!r.activeDays)r.activeDays=Array(r.length).fill(true);
     r.activeDays[index]=!r.activeDays[index];
   }else if(action==='extra-child'){
     const id=data.child;if(!state.children.some(c=>c.id===id))return null;
     if(r.childIds.includes(id)){r.childIds=r.childIds.filter(c=>c!==id);delete r.assignments[id];
       for(const key of Object.keys(state.extraExceptions))if(key.startsWith(r.id+'|')&&key.endsWith('|'+id))delete state.extraExceptions[key];
     }else{r.childIds.push(id);r.assignments[id]=Array.from({length:r.length},()=> '');}
   }else if(action==='extra-cell'){
     if(!r.childIds.includes(data.child))return null;
     const index=Number(data.index);if(!Number.isInteger(index)||index<0||index>=r.length)return null;
     r.assignments[data.child][index]=nextGuardian(r.assignments[data.child][index],state.guardians);
   }else if(action==='extra-week'){
     const arr=r.assignments[data.child],index=Number(data.week)*7;if(!arr||index<0||index>=r.length)return null;
     for(let i=index;i<Math.min(r.length,index+7);i++)arr[i]=arr[index];
   }else if(action==='extra-all'){
     const first=r.childIds[0];if(!first)return null;for(const id of r.childIds)r.assignments[id]=[...r.assignments[first]];
   }else if(action==='extra-copy'){
     if(!r.childIds.includes(data.child)||!r.childIds.includes(data.from))return null;
     r.assignments[data.child]=[...r.assignments[data.from]];
   }else return null;
   return {open:r.id,save:true};
 }
 function change(state,data,value,units){
   const r=state.extraRotations.find(x=>x.id===data.rotation);if(!r)return null;
   const field=data.extraChange;
   if(field==='unit'){
     units[r.id]=value==='weeks'?'weeks':'days';
     if(units[r.id]==='weeks'&&r.length%7!==0){
       const next=window.rotationPatterns.resized(r,Math.ceil(r.length/7)*7,state.children);
       r.length=next.length;r.assignments=next.assignments;r.activeDays=next.activeDays;
       return {save:true};
     }
     return {save:false};
   }
   if(field==='name'){if(!value.trim())return {error:'El nom no pot ser buit'};r.name=value.trim().slice(0,80);}
   else if(field==='startDate'){if(!window.rotationPatterns.validDate(value))return {error:'Data incorrecta'};r.startDate=value;}
   else if(field==='length'){
     const scale=(units[r.id]??safeLength(r))==='weeks'?7:1,n=Number(value)*scale;
     if(!Number.isInteger(n)||n<1||n>3640)return {error:'Durada incorrecta'};
     const next=window.rotationPatterns.resized(r,n,state.children);
     r.length=next.length;r.assignments=next.assignments;r.activeDays=next.activeDays;
   }else if(field==='startTime'||field==='endTime'){
     if(!window.rotationPatterns.validClock(value))return {error:'Hora incorrecta'};
     const from=field==='startTime'?value:r.startTime,to=field==='endTime'?value:r.endTime;
     if(window.rotationPatterns.minutes(from)>=window.rotationPatterns.minutes(to))return {error:'L’hora final ha de ser posterior a la inicial'};
     r[field]=value;
   }else return null;
   return {save:true};
 }
 function dateForm(state,date,rotationId,childId){
   const r=state.extraRotations.find(x=>x.id===rotationId),child=state.children.find(c=>c.id===childId);
   if(!r||!child)return '<p class="settings-note">Rotació no disponible.</p>';
   const slot=window.rotationPatterns.slotFor(state,r,date,childId);
   if(!slot)return '<p class="settings-note">Aquest fill no participa en aquesta rotació.</p>';
   return `<div class="sheet-heading"><div><h2 class="sheet-title">${title(r)}</h2><p class="sheet-subtitle">${escape(child.name)} · ${escape(date)}</p></div>
     <button class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div>
     <p class="settings-note">Canvi només per aquesta data. El patró de rotació no es modificarà.</p>
     <form data-extra-date-form="true" data-date="${escape(date)}" data-rotation="${escape(rotationId)}" data-child="${escape(childId)}">
       <div class="form-row"><div class="field"><label>Inici<input type="time" name="startTime" value="${escape(slot.startTime)}" required></label></div>
       <div class="field"><label>Final<input type="time" name="endTime" value="${escape(slot.endTime)}" required></label></div></div>
       <div class="field"><label>Responsable<select name="guardianId"><option value="">Sense assignar</option>${state.guardians.map(g=>`<option value="${escape(g.id)}" ${slot.guardianId===g.id?'selected':''}>${escape(g.name)}</option>`).join('')}</select></label></div>
       <label class="extra-disabled"><input type="checkbox" name="disabled" value="yes" ${slot.disabled?'checked':''}> No hi ha aquesta franja avui</label>
       <div class="action-row"><button class="primary-btn" type="submit">Desa el canvi puntual</button>${slot.overridden?`<button class="soft-btn" data-action="extra-date-clear" type="button" data-date="${escape(date)}" data-rotation="${escape(rotationId)}" data-child="${escape(childId)}">Restaura la rotació</button>`:''}</div>
     </form>`;
 }
 function datePicker(state,date){
   return `<div class="sheet-heading"><div><h2 class="sheet-title">Rotacions d'aquest dia</h2><p class="sheet-subtitle">${escape(date)}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div>
   <p class="settings-note">Tria una franja i un fill per modificar-la només en aquesta data.</p>
   ${(state.extraRotations??[]).map(r=>`<div class="sheet-section-label">${title(r)} · ${escape(r.startTime)}–${escape(r.endTime)}</div>
     ${r.childIds.map(id=>`<button class="option" data-action="edit-extra-slot" data-date="${escape(date)}" data-rotation="${escape(r.id)}" data-child="${escape(id)}">${escape(state.children.find(c=>c.id===id)?.name??id)}</button>`).join('')}`).join('')||'<p>Encara no hi ha rotacions addicionals.</p>'}`;
 }
 function saveDate(state,date,rotationId,childId,params){
   const r=state.extraRotations.find(x=>x.id===rotationId),p=window.rotationPatterns;
   if(!r||!r.childIds.includes(childId)||!p.validDate(date))return 'Rotació o data invàlida';
   const startTime=String(params.get('startTime')??''),endTime=String(params.get('endTime')??''),guardianId=String(params.get('guardianId')??''),disabled=params.has('disabled');
   if(!p.validClock(startTime)||!p.validClock(endTime)||p.minutes(startTime)>=p.minutes(endTime))return 'L’hora final ha de ser posterior a la inicial';
   if(guardianId&&!state.guardians.some(g=>g.id===guardianId))return 'Responsable invàlid';
   const original=p.slotFor({...state,extraExceptions:{}},r,date,childId);
   const key=rotationId+'|'+date+'|'+childId;
   if(disabled===original.disabled&&startTime===original.startTime&&endTime===original.endTime&&guardianId===original.guardianId)delete state.extraExceptions[key];
   else state.extraExceptions[key]={startTime,endTime,guardianId,disabled};
   return '';
 }
 window.rotationEditor={render,create,click,change,dateForm,datePicker,saveDate};
})();
