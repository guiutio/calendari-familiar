/* Rotacions independents i excepcions puntuals, dades locals sense servidor. */
(()=>{
  const DAY=1440;
  const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const minutes=time=>{if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;return Number(time.slice(0,2))*60+Number(time.slice(3));};
  const validClock=time=>Number.isFinite(minutes(time));
  const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  const dayIndex=(date,start,length)=>{const a=Date.parse(date+'T12:00:00Z'),b=Date.parse(start+'T12:00:00Z');return (((Math.round((a-b)/86400000)%length)+length)%length);};
  /** Les rotacions històriques utilitzen activeDays; els nous patrons permeten triar per fill. */
  function activeFor(rotation,childId,index){
    return rotation.childActiveDays?.[childId]?.[index]??rotation.activeDays?.[index]??true;
  }
  function ensureChildDays(rotation,childId){
    if(!rotation.childActiveDays)rotation.childActiveDays={};
    if(!rotation.childActiveDays[childId])rotation.childActiveDays[childId]=Array.from({length:rotation.length},(_,i)=>rotation.activeDays?.[i]??true);
    return rotation.childActiveDays[childId];
  }
  function cleanExtras(raw,children,guardians,maxDays=3640){
    if(raw==null)return [];
    if(!Array.isArray(raw)||raw.length>200)throw Error('Nombre de rotacions addicionals no vàlid');
    const childIds=new Set(children.map(x=>x.id)),guardianIds=new Set(guardians.map(x=>x.id));
    const ids=new Set();
    const rotations=raw.map(item=>{
      const night=item?.kind==='night';
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||
         !validDate(item.startDate)||!Number.isInteger(item.length)||item.length<1||item.length>maxDays||
         !validClock(item.startTime)||(!night&&(!validClock(item.endTime)||minutes(item.startTime)>=minutes(item.endTime)))||
         !Array.isArray(item.childIds)||(item.activeDays!==undefined&&(!Array.isArray(item.activeDays)||item.activeDays.length!==item.length||item.activeDays.some(a=>typeof a!=='boolean'))))throw Error('Hi ha una rotació addicional incorrecta');
      if(item.kind!==undefined&&!['night','activity'].includes(item.kind))throw Error('Tipus de rotació incorrecte');
      if(item.endDate!==undefined&&item.endDate!==''&&(!validDate(item.endDate)||item.endDate<item.startDate))throw Error('La data final ha de ser igual o posterior a la inicial');
      if(item.schoolDaysOnly!==undefined&&typeof item.schoolDaysOnly!=='boolean')throw Error('Condició de dies escolars incorrecta');
      if(item.childActiveDays!==undefined&&(!item.childActiveDays||typeof item.childActiveDays!=='object'||Array.isArray(item.childActiveDays)))throw Error('Dies actius per fill incorrectes');
      ids.add(item.id);
      const selected=[...new Set(item.childIds.filter(id=>childIds.has(id)))];
      const assignments={};
      for(const id of selected){
        const arr=item.assignments?.[id];
        if(!Array.isArray(arr)||arr.length!==item.length||arr.some(id=>id!==''&&!guardianIds.has(id)))
          throw Error('Assignació incorrecta en una rotació addicional');
        assignments[id]=[...arr];
      }
      const childActiveDays={};
      if(item.childActiveDays!==undefined){
        for(const id of selected){
          if(!Object.hasOwn(item.childActiveDays,id))continue;
          const days=item.childActiveDays[id];
          if(!Array.isArray(days)||days.length!==item.length||days.some(v=>typeof v!=='boolean'))throw Error('Dies actius per fill incorrectes');
          childActiveDays[id]=[...days];
        }
      }
      const result={id:item.id,name:item.name.trim(),startDate:item.startDate,length:item.length,startTime:item.startTime,endTime:night?'00:00':item.endTime,childIds:selected,assignments,activeDays:[...(item.activeDays??Array(item.length).fill(true))]};
      if(item.kind!==undefined)result.kind=item.kind;
      if(item.endDate)result.endDate=item.endDate;
      if(night)result.nightTimes=cleanNightTimes(item.nightTimes,{length:item.length,changeTime:item.startTime});
      if(item.childActiveDays!==undefined)result.childActiveDays=childActiveDays;
      if(item.schoolDaysOnly!==undefined)result.schoolDaysOnly=item.schoolDaysOnly;
      return result;
    });
    validateNightOverlaps(rotations);
    return rotations;
  }
  function inRange(rotation,date){return date>=rotation.startDate&&(!rotation.endDate||date<=rotation.endDate);}
  function validateNightOverlaps(rotations){
    const nights=rotations.filter(r=>r.kind==='night');
    for(let i=0;i<nights.length;i++)for(let j=i+1;j<nights.length;j++){
      const a=nights[i],b=nights[j];
      if(a.startDate<=(b.endDate||'9999-12-31')&&b.startDate<=(a.endDate||'9999-12-31')&&a.childIds.some(id=>b.childIds.includes(id)))
        throw Error('Les pernoctes «'+a.name+'» i «'+b.name+'» se solapen per a un mateix fill. Revisa les dates o els fills participants.');
    }
  }
  function legacyNight(rotation,times,children,guardians){
    if(!rotation||!validDate(rotation.startDate)||!Number.isInteger(rotation.length)||rotation.length<1||rotation.length>3640)throw Error('El patró de pernocta antic no és vàlid');
    const assignments={},ids=new Set(guardians.map(g=>g.id));
    for(const child of children){
      const arr=rotation.assignments?.[child.id];
      if(!Array.isArray(arr)||arr.length!==rotation.length||arr.some(id=>id!==''&&!ids.has(id)))throw Error('El patró de nits està incomplet');
      assignments[child.id]=[...arr];
    }
    const startTime=validClock(rotation.changeTime)?rotation.changeTime:'19:00';
    const nightTimes=cleanNightTimes(times,{...rotation,changeTime:startTime});
    return children.length?[{id:'legacy-night',kind:'night',name:'Pernocta',startDate:rotation.startDate,length:rotation.length,startTime,endTime:'00:00',childIds:children.map(c=>c.id),assignments,activeDays:Array(rotation.length).fill(true),nightTimes}]:[];
  }
  function nightRotationFor(rotations,date,childId){return rotations.find(r=>r.kind==='night'&&r.childIds.includes(childId)&&inRange(r,date));}
  function nightAssignment(rotations,date,childId){
    const r=nightRotationFor(rotations,date,childId);if(!r)return '';
    const i=dayIndex(date,r.startDate,r.length);return activeFor(r,childId,i)?r.assignments[childId]?.[i]??'':'';
  }
  function nightTimeFor(rotations,date,childId,dateTimes={}){
    if(Object.hasOwn(dateTimes,date+'|'+childId))return dateTimes[date+'|'+childId];
    if(Object.hasOwn(dateTimes,date))return dateTimes[date];
    const previous=new Date(date+'T12:00:00Z');previous.setUTCDate(previous.getUTCDate()-1);
    const r=nightRotationFor(rotations,date,childId)??nightRotationFor(rotations,previous.toISOString().slice(0,10),childId);
    return r?(r.nightTimes?.[dayIndex(date,r.startDate,r.length)]??r.startTime):'19:00';
  }
  function cleanNightDateTimes(raw,children){
    if(raw==null)return {};
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>50000)throw Error('Hores puntuals incorrectes');
    const ids=new Set(children.map(c=>c.id)),out={};
    for(const [key,time] of Object.entries(raw)){
      const [date,childId,...rest]=key.split('|');
      if(rest.length||!validDate(date)||!validClock(time)||(childId!==undefined&&!ids.has(childId)))throw Error('Hora de canvi puntual incorrecta');
      if(childId!==undefined)out[key]=time;
      else for(const id of ids)if(!Object.hasOwn(raw,date+'|'+id))out[date+'|'+id]=time;
    }
    return out;
  }
  function cleanNightTimes(raw,rotation){
    if(raw==null)return {};
    if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Hores de canvi del patró incorrectes');
    const result={};
    for(const [key,value] of Object.entries(raw)){
      const index=Number(key);
      if(!Number.isInteger(index)||index<0||index>=rotation.length||!validClock(value))throw Error('Hora de canvi del patró incorrecta');
      if(value!==rotation.changeTime)result[index]=value;
    }
    return result;
  }
  function cleanDateTimes(raw){
    if(raw==null)return {};
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>50000)throw Error('Hores puntuals incorrectes');
    const result={};
    for(const [date,time] of Object.entries(raw)){
      if(!validDate(date)||!validClock(time))throw Error('Hora de canvi puntual incorrecta');
      result[date]=time;
    }
    return result;
  }
  function cleanExtraExceptions(raw,rotations,children,guardians){
    if(raw==null)return {};
    if(!raw||typeof raw!=='object'||Array.isArray(raw)||Object.keys(raw).length>50000)throw Error('Excepcions de rotació incorrectes');
    const rotMap=new Map(rotations.map(r=>[r.id,r])),childIds=new Set(children.map(c=>c.id)),guardianIds=new Set(guardians.map(g=>g.id)),result={};
    for(const [key,value] of Object.entries(raw)){
      const [rotationId,date,childId,...extra]=key.split('|'),rotation=rotMap.get(rotationId);
      if(extra.length||!rotation||rotation.kind==='night'||!validDate(date)||!childIds.has(childId)||!rotation.childIds.includes(childId))continue;
      if(!value||typeof value!=='object'||typeof value.disabled!=='boolean'||typeof value.guardianId!=='string'||(value.guardianId!==''&&!guardianIds.has(value.guardianId))||
        !validClock(value.startTime)||!validClock(value.endTime)||minutes(value.startTime)>=minutes(value.endTime))
        throw Error('Excepció de rotació incorrecta');
      result[key]={startTime:value.startTime,endTime:value.endTime,guardianId:value.guardianId,disabled:value.disabled};
    }
    return result;
  }
  function nightTime(date,rotation,dayTimes,dateTimes){
    if(Object.hasOwn(dateTimes,date))return dateTimes[date];
    return dayTimes[dayIndex(date,rotation.startDate,rotation.length)]??rotation.changeTime;
  }
  function slotFor(state,rotation,date,childId){
    if(!rotation.childIds.includes(childId)||!inRange(rotation,date))return null;
    const i=dayIndex(date,rotation.startDate,rotation.length),key=rotation.id+'|'+date+'|'+childId,override=state.extraExceptions?.[key];
    const fallback={startTime:rotation.startTime,endTime:rotation.endTime,guardianId:rotation.assignments[childId]?.[i]??'',disabled:!activeFor(rotation,childId,i)};
    return {...fallback,...override,rotationId:rotation.id,rotationName:rotation.name,childId,date,key,overridden:Boolean(override)};
  }
  function slots(state,date,children,guardians,visibleGuardianIds,hasSchool=()=>false){
    const out=[],lookup=new Map(guardians.map(g=>[g.id,g])),visible=new Set(visibleGuardianIds);
    for(const rotation of state.extraRotations??[])for(const child of children){
      if(rotation.kind==='night')continue;
      const item=slotFor(state,rotation,date,child.id);
      if(!item||item.disabled||(rotation.schoolDaysOnly&&!hasSchool(date,child.id)))continue;
      const guardian=lookup.get(item.guardianId);
      out.push({...item,id:rotation.id+'|'+child.id,from:minutes(item.startTime),to:minutes(item.endTime),
        name:rotation.name,color:guardian?.color??'#98a9b8',guardianName:guardian?.name??'Sense assignar',
        visible:!item.guardianId||visible.has(item.guardianId)});
    }
    return out;
  }
  function resized(rotation,length,children){
    const assignments={};
    for(const id of rotation.childIds.filter(id=>children.some(c=>c.id===id))){
      const old=rotation.assignments[id]??[];
      assignments[id]=Array.from({length},(_,i)=>old.length?old[i%old.length]??'':'');
    }
    const result={...rotation,length,assignments,activeDays:Array.from({length},(_,i)=>rotation.activeDays?.[i%(rotation.activeDays?.length||1)]??true)};
    if(rotation.childActiveDays){
      result.childActiveDays={};
      for(const id of Object.keys(assignments)){
        const old=rotation.childActiveDays[id];
        if(old)result.childActiveDays[id]=Array.from({length},(_,i)=>old[i%old.length]??true);
      }
    }
    return result;
  }
  function removeChild(state,id){
    for(const r of state.extraRotations??[]){r.childIds=r.childIds.filter(c=>c!==id);delete r.assignments[id];if(r.childActiveDays)delete r.childActiveDays[id];}
    for(const key of Object.keys(state.extraExceptions??{}))if(key.split('|')[2]===id)delete state.extraExceptions[key];
  }
  function removeGuardian(state,id,alternate=''){
    for(const r of state.extraRotations??[])for(const arr of Object.values(r.assignments))for(let i=0;i<arr.length;i++)if(arr[i]===id)arr[i]=r.kind==='night'?alternate:'';
    for(const entry of Object.values(state.extraExceptions??{}))if(entry.guardianId===id)entry.guardianId='';
  }
  function clearDate(state,date){
    for(const key of Object.keys(state.nightDateTimes??{}))if(key===date||key.startsWith(date+'|'))delete state.nightDateTimes[key];
    for(const key of Object.keys(state.extraExceptions??{}))if(key.split('|')[1]===date)delete state.extraExceptions[key];
  }
  window.rotationPatterns={inRange,validateNightOverlaps,legacyNight,nightRotationFor,nightAssignment,nightTimeFor,cleanNightDateTimes,minutes,fmt,validClock,validDate,dayIndex,activeFor,ensureChildDays,cleanExtras,cleanNightTimes,cleanDateTimes,cleanExtraExceptions,nightTime,slotFor,slots,resized,removeChild,removeGuardian,clearDate};
})();
