/* Resum mensual de 24 h i excepcions horàries puntuals; no altera la rotació base. */
(() => {
  const DAY = 1440;
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const minutes = time => time === '24:00' ? DAY : Number(time.slice(0,2))*60 + Number(time.slice(3,5));
  const validTime = time => typeof time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
  const legacyRanges = {mati:['08:00','12:00'],dinar:['12:00','15:00'],tarda:['15:00','18:00'],sopar:['18:00','21:00']};
  const validKey = key => /^\d{4}-\d{2}-\d{2}\|[^|]+$/.test(key);
  const keyOf = (date,childId) => date + '|' + childId;
  function clean(raw,childIds,guardianIds) {
    if(raw == null)return {};
    if(typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 15000)throw Error('Les franges puntuals no són vàlides');
    const allowedChildren=new Set(childIds),allowedGuardians=new Set(guardianIds),result={};
    let total=0;
    for(const [key,items] of Object.entries(raw)){
      const [date,childId]=key.split('|');
      if(!validKey(key) || !allowedChildren.has(childId))continue;
      if(!Array.isArray(items) || items.length>64)throw Error('Hi ha massa franges en un mateix dia');
      const ids=new Set(),collected=[];
      for(const item of items){
        if(!item || typeof item.id!=='string' || !item.id || item.id.length>100 || ids.has(item.id) ||
          !validTime(item.startTime) || !validTime(item.endTime) ||
          minutes(item.startTime)>=minutes(item.endTime) || typeof item.guardianId!=='string' ||
          (item.guardianId!==''&&!allowedGuardians.has(item.guardianId)))throw Error('Hi ha una franja puntual incorrecta');
        ids.add(item.id);
        collected.push({id:item.id,startTime:item.startTime,endTime:item.endTime,guardianId:item.guardianId});
        if(++total>30000)throw Error('Hi ha massa franges puntuals');
      }
      collected.sort((a,b)=>a.startTime.localeCompare(b.startTime));
      if(collected.some((item,i)=>i>0&&collected[i-1].endTime>item.startTime))throw Error('Hi ha franges puntuals solapades');
      if(collected.length)result[key]=collected;
    }
    return result;
  }
  function hasChanges(state,date){
    return Object.keys(state.overrides||{}).some(k=>k.startsWith(date+'|')) ||
      Object.keys(state.bandOverrides||{}).some(k=>k.startsWith(date+'|')) ||
      Object.keys(state.daySlots||{}).some(k=>k.startsWith(date+'|')&&(state.daySlots[k]||[]).length);
  }
  function slots(state,date,children,guardians,visibleIds){
    const map={},guardianMap=new Map(guardians.map(g=>[g.id,g]));
    for(const child of children){
      const id=child.id,key=keyOf(date,id),items=[];
      for(const slot of state.daySlots?.[key]??[])items.push(slot);
      for(const [band,range] of Object.entries(legacyRanges)){
        const legacyKey=key+'|'+band;
        if(Object.hasOwn(state.bandOverrides||{},legacyKey))
          items.push({id:'legacy:'+band,startTime:range[0],endTime:range[1],guardianId:state.bandOverrides[legacyKey]});
      }
      map[id]=items.map(slot=>{
        const g=guardianMap.get(slot.guardianId);
        return {id:slot.id,childId:id,from:minutes(slot.startTime),to:minutes(slot.endTime),
          startTime:slot.startTime,endTime:slot.endTime,
          guardianId:slot.guardianId,name:g?.name??'Sense assignar',
          color:g&&visibleIds.includes(g.id)?g.color:'#dfe4eb',
          visible:!g || visibleIds.includes(g.id)};
      }).filter(s=>s.visible).sort((a,b)=>a.from-b.from);
    }
    return map;
  }
  function mini(children,nights,activities,customSlots){
    if(!children.length)return '<span class="month-mini-empty">—</span>';
    const rect=(from,to,color,klass,label)=>{
      const top=100*Math.max(0,from)/DAY, height=100*Math.max(0,Math.min(DAY,to)-Math.max(0,from))/DAY;
      return height>0?`<span class="${klass}" style="top:${top}%;height:${height}%;background:${escape(color)}" title="${escape(label)}"></span>`:'';
    };
    return `<span class="month-mini" style="--month-children:${children.length}" aria-hidden="true">
      ${children.map(c=>`<span class="month-mini-child" title="${escape(c.name)}">${escape([...c.name][0]??'?')}</span>`).join('')}
      ${children.map(c=>`<span class="month-mini-column">
        ${(nights[c.id]??[]).filter(n=>n.visible).map(n=>rect(n.from,n.to,n.guardianColor,'month-mini-night',n.guardianName)).join('')}
        ${(customSlots[c.id]??[]).map(s=>rect(s.from,s.to,s.color,'month-mini-custom',s.startTime+'–'+s.endTime+' '+s.name)).join('')}
        ${activities.filter(a=>a.childId===c.id).map(a=>rect(a.start,a.end,a.color,'month-mini-school',a.schoolName)).join('')}
      </span>`).join('')}
    </span>`;
  }
  function find(state,date,childId,id){
    if(id?.startsWith('legacy:')){
      const band=id.slice(7),range=legacyRanges[band],guardianId=state.bandOverrides?.[keyOf(date,childId)+'|'+band];
      return range && guardianId!==undefined ? {id,startTime:range[0],endTime:range[1],guardianId}:undefined;
    }
    return state.daySlots?.[keyOf(date,childId)]?.find(s=>s.id===id);
  }
  function form(date,childId,id,children,guardians,state){
    const item=find(state,date,childId,id),selected=children.some(c=>c.id===childId)?childId:children[0]?.id??'';
    const current=item??{startTime:'09:00',endTime:'10:00',guardianId:guardians[0]?.id??''};
    const edit=!!item;
    return `<div class="sheet-heading"><div><h2 class="sheet-title">${edit?'Edita':'Afegeix'} una franja</h2>
      <p class="sheet-subtitle">${escape(date)} · Només per a aquest dia</p></div>
      <button type="button" class="sheet-close" data-action="open-day" data-date="${escape(date)}" aria-label="Torna al dia">×</button></div>
      <form data-day-slot-form="true" data-date="${escape(date)}" data-child="${escape(childId)}" data-slot="${escape(id??'')}" class="month-slot-form">
      <div class="field"><label for="slot-child">Fill</label><select id="slot-child" name="childId" required ${edit?'disabled':''}>
        ${children.map(c=>`<option value="${escape(c.id)}" ${c.id===selected?'selected':''}>${escape(c.name)}</option>`).join('')}
      </select></div>
      <div class="form-row"><div class="field"><label for="slot-start">Inici</label><input id="slot-start" type="time" name="startTime" value="${escape(current.startTime)}" required></div>
      <div class="field"><label for="slot-end">Final</label><input id="slot-end" type="time" name="endTime" value="${escape(current.endTime)}" required></div></div>
      <div class="field"><label for="slot-guardian">Responsable</label><select id="slot-guardian" name="guardianId">
      <option value="" ${current.guardianId===''?'selected':''}>Sense assignar</option>
      ${guardians.map(g=>`<option value="${escape(g.id)}" ${g.id===current.guardianId?'selected':''}>${escape(g.name)}</option>`).join('')}
      </select></div>
      <p class="settings-note">Aquesta franja puntual no modifica la rotació ni cap altre dia. Les activitats escolars continuen visibles.</p>
      <div class="action-row"><button type="submit" class="primary-btn">Desa la franja</button>
      <button type="button" class="soft-btn" data-action="open-day" data-date="${escape(date)}">Cancel·la</button>
      ${edit?`<button type="button" class="danger-btn" data-action="day-slot-delete" data-date="${escape(date)}" data-child="${escape(childId)}" data-slot="${escape(id)}">Elimina la franja</button>`:''}</div>
      </form>`;
  }
  function remove(state,date,childId,id){
    const key=keyOf(date,childId);
    if(id.startsWith('legacy:')){delete state.bandOverrides[key+'|'+id.slice(7)];return;}
    if(!state.daySlots)return;
    state.daySlots[key]=(state.daySlots[key]??[]).filter(s=>s.id!==id);
    if(!state.daySlots[key].length)delete state.daySlots[key];
  }
  function save(state,date,childId,id,values,newId){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!state.children.some(c=>c.id===childId))return 'Dia o fill no vàlid';
    const startTime=String(values.get('startTime')??''),endTime=String(values.get('endTime')??''),
      guardianId=String(values.get('guardianId')??'');
    if(!validTime(startTime)||!validTime(endTime)||minutes(startTime)>=minutes(endTime))
      return 'La franja ha de tenir una hora final posterior a la inicial';
    if(guardianId&&!state.guardians.some(g=>g.id===guardianId))return 'Responsable no vàlid';
    const old=id?find(state,date,childId,id):undefined;
    if(id&&!old)return 'Aquesta franja ja no existeix';
    const map=slots(state,date,[{id:childId}],state.guardians,state.guardians.map(g=>g.id));
    if((map[childId]??[]).some(s=>s.id!==id&&s.from<minutes(endTime)&&s.to>minutes(startTime)))
      return 'Aquesta franja se solapa amb una altra franja puntual';
    if(old)remove(state,date,childId,id);
    state.daySlots??={};
    const key=keyOf(date,childId);
    (state.daySlots[key]??=[]).push({id:id&&!id.startsWith('legacy:')?id:newId(),
      startTime,endTime,guardianId});
    state.daySlots[key].sort((a,b)=>a.startTime.localeCompare(b.startTime));
    return '';
  }
  function restore(state,date){
    for(const field of ['overrides','bandOverrides','daySlots'])
      for(const key of Object.keys(state[field]||{}))if(key.startsWith(date+'|'))delete state[field][key];
  }
  function removeGuardian(daySlots,id,replacement){
    for(const items of Object.values(daySlots||{}))for(const slot of items)if(slot.guardianId===id)slot.guardianId=replacement;
  }
  function removeChild(daySlots,id){
    for(const key of Object.keys(daySlots||{}))if(key.endsWith('|'+id))delete daySlots[key];
  }
  window.monthDayUI={clean,hasChanges,slots,mini,find,form,remove,save,restore,removeGuardian,removeChild};
})();
