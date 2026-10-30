/* Editor i operacions de rotacions addicionals; cadascuna té patró propi. */
(()=>{
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const miniDate=(date)=>{const d=new Date(date+'T12:00:00Z');return ['Dl','Dt','Dc','Dj','Dv','Ds','Dg'][(d.getUTCDay()+6)%7];};
 const safeLength=(r)=>r.length%7===0?'weeks':'days';
 const title=(r)=>escape(r.name);
 // El mateix cicle pot aplicar-se en dies diferents a cada fill.
 const activeFor=(r,childId,index)=>window.rotationPatterns.activeFor(r,childId,index);
 const activeIndices=(r,childId,week)=>Array.from({length:r.length},(_,i)=>i)
   .filter(i=>(week===undefined||Math.floor(i/7)===week)&&activeFor(r,childId,i));
 const root=id=>document.querySelector('[data-extra-rotation="'+CSS.escape(id)+'"]');
 function render(state,expanded,units={}){
   const kids=state.children,guardians=state.guardians,rotations=state.extraRotations??[];
   const cards=rotations.map(r=>{
     const open=expanded===r.id,unit=units[r.id]??safeLength(r),scale=unit==='weeks'?7:1;
     const first=r.childIds[0];
     const weeks=Array.from({length:Math.ceil(r.length/7)},(_,week)=>week);
     const allSame=r.childIds.length>1&&r.childIds.every(id=>Array.from({length:r.length},(_,i)=>i)
       .every(i=>activeFor(r,id,i)===activeFor(r,first,i)&&
         (!activeFor(r,id,i)||(r.assignments[id]?.[i]??'')===(r.assignments[first]?.[i]??''))));
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
         <p class="settings-note">Selecciona els fills participants. Toca cada dia de les setmanes per indicar si la franja s’aplica i, si és així, quin tutor té (o deixa-la sense tutor).</p>
         <div class="extra-kids">${kids.map(c=>`<button class="option ${r.childIds.includes(c.id)?'selected':''}" aria-pressed="${r.childIds.includes(c.id)}" data-action="extra-child" data-rotation="${escape(r.id)}" data-child="${escape(c.id)}">${escape(c.name)} ${r.childIds.includes(c.id)?'✓':''}</button>`).join('')}</div>
         ${r.childIds.length>1?`<div class="action-row"><button class="secondary-btn" data-action="extra-all" data-rotation="${escape(r.id)}">Tots igual</button>
         ${allSame?'<span class="settings-note">Tots els fills tenen el mateix patró.</span>':''}</div>`:''}
         ${r.childIds.map((id,n)=>{
           const c=kids.find(k=>k.id===id),arr=r.assignments[id]??[];
           return `<div class="rotation-child"><div class="rotation-child-header"><strong>${escape(c?.name??id)}</strong>
              ${r.childIds.filter(fromId=>fromId!==id).map(fromId=>`<button class="soft-btn" data-action="extra-copy" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-from="${escape(fromId)}">Copiar de ${escape(kids.find(x=>x.id===fromId)?.name??fromId)}</button>`).join('')}</div>
             ${weeks.map(week=>{
               const active=activeIndices(r,id,week);
               return `<div class="rotation-week"><div class="rotation-week-header"><div class="rotation-week-title">Setmana ${week+1}</div>${active.length>1?`<button class="week-fill-btn" data-action="extra-week" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-week="${week}" title="Copia el tutor del primer dia actiu als altres dies actius de la setmana">Copia el primer dia actiu</button>`:''}</div>
               <div class="rotation-days">${Array.from({length:Math.min(7,r.length-week*7)},(_,day)=>{
                 const i=week*7+day,applies=activeFor(r,id,i),g=guardians.find(x=>x.id===arr[i]);
                 const who=g?.name??'Sense tutor';
                 return `<button type="button" class="rotation-cell extra-pattern-cell ${applies?'extra-applies':'extra-inactive'}" data-action="extra-cell" data-rotation="${escape(r.id)}" data-child="${escape(id)}" data-index="${i}" aria-label="${escape(c?.name??id)}, dia ${i+1}, ${applies?escape(who):'No s’aplica'}; toca per editar" title="${applies?escape(who):'No s’aplica'} · toca per configurar"><span class="small-day">${miniDate(addDays(r.startDate,i))}</span><span class="guardian-initial" ${applies?`style="background:${escape(g?.color??'#dbe8f5')}"`:'aria-hidden="true"'}>${applies?escape((g?.name??'∅').slice(0,1)):'×'}</span></button>`;
               }).join('')}</div></div>`;
             }).join('')}</div>`;
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
   const item={id,name:'Nova rotació',startDate:today,length:7,startTime:'16:30',endTime:'17:30',childIds:first?[first]:[],assignments:first?{[first]:Array(7).fill('')}:{},activeDays:Array(7).fill(true),childActiveDays:first?{[first]:Array(7).fill(true)}:{}};
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
   if(action==='extra-child'){
     const id=data.child;if(!state.children.some(c=>c.id===id))return null;
     if(r.childIds.includes(id)){
       r.childIds=r.childIds.filter(c=>c!==id);delete r.assignments[id];
       if(r.childActiveDays)delete r.childActiveDays[id];
       for(const key of Object.keys(state.extraExceptions))if(key.startsWith(r.id+'|')&&key.endsWith('|'+id))delete state.extraExceptions[key];
     }else{
       r.childIds.push(id);r.assignments[id]=Array.from({length:r.length},()=> '');
       window.rotationPatterns.ensureChildDays(r,id);
     }
   }else if(action==='extra-week'){
     const week=Number(data.week),arr=r.assignments[data.child];
     if(!arr||!Number.isInteger(week)||week<0||week>=Math.ceil(r.length/7))return null;
     const days=activeIndices(r,data.child,week);if(!days.length)return null;
     const first=days[0];for(const i of days)arr[i]=arr[first];
   }else if(action==='extra-all'){
     const first=r.childIds[0];if(!first||!r.assignments[first])return null;
     for(const id of r.childIds){
       if(id===first)continue;
       r.childActiveDays??={};
       r.childActiveDays[id]=Array.from({length:r.length},(_,i)=>activeFor(r,first,i));
       r.assignments[id]=[...r.assignments[first]];
     }
   }else if(action==='extra-copy'){
     if(!r.childIds.includes(data.child)||!r.childIds.includes(data.from))return null;
     r.childActiveDays??={};
     r.childActiveDays[data.child]=Array.from({length:r.length},(_,i)=>activeFor(r,data.from,i));
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
       r.length=next.length;r.assignments=next.assignments;r.activeDays=next.activeDays;r.childActiveDays=next.childActiveDays;r.childActiveDays=next.childActiveDays;
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
 function patternDayForm(state,rotationId,childId,index){
   const r=state.extraRotations.find(x=>x.id===rotationId);
   const child=state.children.find(c=>c.id===childId),i=Number(index);
   if(!r||!child||!r.childIds.includes(childId)||!Number.isInteger(i)||i<0||i>=r.length)return '<p class="settings-note">Dia de rotació no disponible.</p>';
   const applies=activeFor(r,childId,i),current=r.assignments[childId]?.[i]??'';
   return `<div class="sheet-heading"><div><h2 class="sheet-title">Dia ${i+1} · ${title(r)}</h2><p class="sheet-subtitle">${escape(child.name)} · ${escape(miniDate(addDays(r.startDate,i)))}, ${escape(addDays(r.startDate,i))}</p></div>
       <button class="sheet-close" data-action="close-sheet" aria-label="Tanca">×</button></div>
     <form data-extra-pattern-day-form="true" data-rotation="${escape(r.id)}" data-child="${escape(childId)}" data-index="${i}" class="extra-pattern-day-form">
       <div class="sheet-section-label">Aquesta franja s’aplica?</div>
       <div class="extra-pattern-applicability">
         <label class="option rotation-tutor-choice"><input class="rotation-guardian-radio" type="radio" name="applies" value="yes" ${applies?'checked':''}><span class="option-left">Sí, s’aplica</span><span class="rotation-choice-check">✓</span></label>
         <label class="option rotation-tutor-choice"><input class="rotation-guardian-radio" type="radio" name="applies" value="no" ${!applies?'checked':''}><span class="option-left">No s’aplica</span><span class="rotation-choice-check">✓</span></label>
       </div>
       <div class="extra-pattern-guardian-choices">
         <div class="sheet-section-label">Qui és el tutor responsable?</div>
         ${state.guardians.map(g=>`<label class="option rotation-tutor-choice"><input class="rotation-guardian-radio" type="radio" name="guardianId" value="${escape(g.id)}" ${current===g.id?'checked':''}><span class="option-left"><span class="color-dot" style="background:${escape(g.color)}"></span>${escape(g.name)}</span><span class="rotation-choice-check">✓</span></label>`).join('')}
         <label class="option rotation-tutor-choice"><input class="rotation-guardian-radio" type="radio" name="guardianId" value="" ${!current?'checked':''}><span class="option-left">Sense tutor assignat</span><span class="rotation-choice-check">✓</span></label>
       </div>
       <div class="action-row"><button type="submit" class="primary-btn">Aplica al patró</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button></div>
       <p class="settings-note">La selecció s’aplicarà a aquest fill i a aquest dia del patró, cada vegada que es repeteixi.</p>
     </form>`;
 }
 function savePatternDay(state,rotationId,childId,index,params){
   const r=state.extraRotations.find(x=>x.id===rotationId),i=Number(index);
   if(!r||!r.childIds.includes(childId)||!Number.isInteger(i)||i<0||i>=r.length)return 'Dia de rotació invàlid';
   const applies=params.get('applies'),guardianId=String(params.get('guardianId')??'');
   if(applies!=='yes'&&applies!=='no')return 'Indica si la franja s’aplica';
   if(guardianId&&!state.guardians.some(g=>g.id===guardianId))return 'Tutor no vàlid';
   // Desactivar una franja no esborra el tutor anterior: es recuperarà en reactivar-la.
   const days=window.rotationPatterns.ensureChildDays(r,childId);
   days[i]=applies==='yes';
   if(applies==='yes')r.assignments[childId][i]=guardianId;
   return '';
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
 window.rotationEditor={render,create,click,change,patternDayForm,savePatternDay,dateForm,datePicker,saveDate};
})();
