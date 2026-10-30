/* Rotacions independents i excepcions puntuals, dades locals sense servidor. */
(()=>{
  const DAY=1440;
  const fmt=n=>String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');
  const minutes=time=>{if(typeof time!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))return NaN;return Number(time.slice(0,2))*60+Number(time.slice(3));};
  const validClock=time=>Number.isFinite(minutes(time));
  const validDate=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T12:00:00Z'))&&new Date(date+'T12:00:00Z').toISOString().slice(0,10)===date;
  const dayIndex=(date,start,length)=>{const a=Date.parse(date+'T12:00:00Z'),b=Date.parse(start+'T12:00:00Z');return (((Math.round((a-b)/86400000)%length)+length)%length);};
  function cleanExtras(raw,children,guardians,maxDays=3640){
    if(raw==null)return [];
    if(!Array.isArray(raw)||raw.length>100)throw Error('Nombre de rotacions addicionals no vàlid');
    const childIds=new Set(children.map(x=>x.id)),guardianIds=new Set(guardians.map(x=>x.id));
    const ids=new Set();
    return raw.map(item=>{
      if(!item||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||
         !validDate(item.startDate)||!Number.isInteger(item.length)||item.length<1||item.length>maxDays||
         !validClock(item.startTime)||!validClock(item.endTime)||minutes(item.startTime)>=minutes(item.endTime)||
         !Array.isArray(item.childIds))throw Error('Hi ha una rotació addicional incorrecta');
      ids.add(item.id);
      const selected=[...new Set(item.childIds.filter(id=>childIds.has(id)))];
      const assignments={};
      for(const id of selected){
        const arr=item.assignments?.[id];
        if(!Array.isArray(arr)||arr.length!==item.length||arr.some(id=>id!==''&&!guardianIds.has(id)))
          throw Error('Assignació incorrecta en una rotació addicional');
        assignments[id]=[...arr];
      }
      return {id:item.id,name:item.name.trim(),startDate:item.startDate,length:item.length,startTime:item.startTime,endTime:item.endTime,childIds:selected,assignments};
    });
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
      if(extra.length||!rotation||!validDate(date)||!childIds.has(childId)||!rotation.childIds.includes(childId))continue;
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
    if(!rotation.childIds.includes(childId))return null;
    const i=dayIndex(date,rotation.startDate,rotation.length),key=rotation.id+'|'+date+'|'+childId,override=state.extraExceptions?.[key];
    const fallback={startTime:rotation.startTime,endTime:rotation.endTime,guardianId:rotation.assignments[childId]?.[i]??'',disabled:false};
    return {...fallback,...override,rotationId:rotation.id,rotationName:rotation.name,childId,date,key,overridden:Boolean(override)};
  }
  function slots(state,date,children,guardians,visibleGuardianIds){
    const out=[],lookup=new Map(guardians.map(g=>[g.id,g])),visible=new Set(visibleGuardianIds);
    for(const rotation of state.extraRotations??[])for(const child of children){
      const item=slotFor(state,rotation,date,child.id);
      if(!item||item.disabled)continue;
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
    return {...rotation,length,assignments};
  }
  function removeChild(state,id){
    for(const r of state.extraRotations??[]){r.childIds=r.childIds.filter(c=>c!==id);delete r.assignments[id];}
    for(const key of Object.keys(state.extraExceptions??{}))if(key.split('|')[2]===id)delete state.extraExceptions[key];
  }
  function removeGuardian(state,id){
    for(const r of state.extraRotations??[])for(const arr of Object.values(r.assignments))for(let i=0;i<arr.length;i++)if(arr[i]===id)arr[i]='';
    for(const entry of Object.values(state.extraExceptions??{}))if(entry.guardianId===id)entry.guardianId='';
  }
  function clearDate(state,date){
    delete state.nightDateTimes?.[date];
    for(const key of Object.keys(state.extraExceptions??{}))if(key.split('|')[1]===date)delete state.extraExceptions[key];
  }
  window.rotationPatterns={minutes,fmt,validClock,validDate,dayIndex,cleanExtras,cleanNightTimes,cleanDateTimes,cleanExtraExceptions,nightTime,slotFor,slots,resized,removeChild,removeGuardian,clearDate};
})();
