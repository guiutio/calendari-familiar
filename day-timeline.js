/* Vista diària única de 24 hores: pernoctes i activitats escolars superposades. */
(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const PX_PER_MINUTE = 0.8;
  const DAY_MINUTES = 1440;
  const FOCUS_MINUTE = 6 * 60;
  const fmt = minute => minute === DAY_MINUTES ? '24:00' : String(Math.floor(minute / 60)).padStart(2,'0')+':'+String(minute % 60).padStart(2,'0');
  function overnightSegments(date, childId, changeTime, getNight, previousDate, lookupGuardian, visibleGuardianIds) {
    const change = Number(changeTime.slice(0,2)) * 60 + Number(changeTime.slice(3,5));
    const yesterday = previousDate(date);
    return [
      {from:0,to:change,date:yesterday,guardianId:getNight(yesterday,childId)},
      {from:change,to:DAY_MINUTES,date,guardianId:getNight(date,childId)}
    ].filter(segment=>segment.to>segment.from).map(segment=>{
      const guardian=lookupGuardian(segment.guardianId);
      return {...segment,guardianName:guardian?.name??'Sense assignar',guardianColor:guardian?.color??'#8795a7',
        visible:Boolean(guardian&&visibleGuardianIds.includes(guardian.id))};
    });
  }
  // Les franges se superposen com targetes: la més llarga al fons i un
  // petit sagnat per cada nivell, sense repartir l’amplada en columnes.
  function stackTimedBlocks(items) {
    const active=[];
    return items.filter(item=>item.end>item.start).sort((a,b)=>a.start-b.start||b.end-a.end||a.priority-b.priority||String(a.item.id??a.item.rotationId??'').localeCompare(String(b.item.id??b.item.rotationId??''))).map((entry,index)=>{
      for(let i=active.length-1;i>=0;i--)if(active[i].end<=entry.start)active.splice(i,1);
      const depth=active.reduce((level,item)=>Math.max(level,item.depth+1),0);
      const placed={...entry,depth,layer:index+2};
      active.push(placed);
      return placed;
    });
  }
  /** Els dos calendaris comparteixen exactament les mateixes regles de pernocta i escola. */
  function buildColumns(date,children,activities,nightSegments,height,pxPerMinute,customSlots={},rotatingSlots=[]) {
    const columns=children.map(child=>{
      const segments=nightSegments[child.id]??[];
      const visibleNights=segments.filter(s=>s.visible);
      const nights=visibleNights.map((s,index)=>{
        const same=(a,b)=>a&&b&&a.guardianId===b.guardianId&&a.to===b.from;
        const continuedBefore=same(visibleNights[index-1],s),continuedAfter=same(s,visibleNights[index+1]);
        const h=(s.to-s.from)*pxPerMinute;
        const name=escape(s.guardianName);
        const title=`Pernocta · ${s.guardianName} · ${fmt(s.from)}–${fmt(s.to)}. Toca per editar la nit assignada.`;
        return `<button type="button" class="day-night-block${continuedBefore?' night-continues-before':''}${continuedAfter?' night-continues-after':''}" data-action="edit-band" data-date="${escape(s.date)}" data-view-date="${escape(date)}" data-band="nit" data-child="${escape(child.id)}" style="top:${s.from*pxPerMinute}px;height:${h}px;--night-color:${escape(s.guardianColor)}" aria-label="${escape(title)}" title="${escape(title)}"><span class="day-night-title">${name}</span><span class="day-night-subtitle">Pernocta · ${fmt(s.from)}–${fmt(s.to)}</span></button>`;
      }).join('');
      const childActivities=activities.filter(a=>a.childId===child.id);
      const childRotations=rotatingSlots.filter(item=>item.childId===child.id&&item.visible);
      const childOverrides=customSlots[child.id]??[];
      const placed=stackTimedBlocks([
        ...childRotations.map(item=>({item,start:Math.max(0,item.from),end:Math.min(DAY_MINUTES,item.to),priority:0})),
        ...childOverrides.map(item=>({item,start:Math.max(0,item.from),end:Math.min(DAY_MINUTES,item.to),priority:1})),
        ...childActivities.map(item=>({item,start:Math.max(0,item.start),end:Math.min(DAY_MINUTES,item.end),priority:2}))
      ]);
      const positions=new Map(placed.map(entry=>[entry.item,entry]));
      const position=(item,extraStyle)=>{
        const entry=positions.get(item),level=entry.depth+(visibleNights.length?1:0);
        return `data-event-depth="${entry.depth}" style="top:${entry.start*pxPerMinute}px;height:${(entry.end-entry.start)*pxPerMinute}px;--event-indent:min(${level*6}px,30%);--event-layer:${entry.layer};${extraStyle}\"`;
      };
      const overrides=childOverrides.map(slot=>{
        const start=Math.max(0,slot.from),end=Math.min(DAY_MINUTES,slot.to);
        if(end<=start)return '';
        const title=`Assignació puntual · ${slot.name} · ${slot.startTime}–${slot.endTime}. Toca per editar.`;
        return `<button type="button" class="day-slot-block" data-action="day-slot-edit" data-date="${escape(date)}" data-child="${escape(child.id)}" data-slot="${escape(slot.id)}" ${position(slot,`background-color:${escape(slot.color)}`)} title="${escape(title)}" aria-label="${escape(title)}"><span>${escape(slot.name)}</span><small>${escape(slot.startTime)}–${escape(slot.endTime)}</small></button>`;
      }).join('');
      const school=childActivities.map(a=>{
        const start=Math.max(0,a.start),end=Math.min(DAY_MINUTES,a.end);
        if(end<=start)return '';
        const isExtracurricular=a.kind==='Extraescolar';
        const caption=isExtracurricular?`${a.schoolName} · ${a.startTime}–${a.endTime}`:`${a.schoolName} · ${a.kind}${a.description?' · '+a.description:''} · ${a.startTime}–${a.endTime}`;
        const heading=`<span class="day-school-kind">${escape(isExtracurricular?a.schoolName:a.kind)}</span>`;
        const hours=`<span class="day-school-hours">${escape(a.startTime)}–${escape(a.endTime)}</span>`;
        return `<button type="button" class="day-school-block" ${position(a,`--school-event-color:${escape(a.color)}`)} data-action="open-school-activity" data-date="${escape(date)}" data-school="${escape(a.schoolId)}" data-child="${escape(a.childId)}" data-session="${escape(a.id)}" title="${escape(caption)}" aria-label="${escape(caption)}">${isExtracurricular?heading+hours:hours+heading}${!isExtracurricular&&a.description?`<span class="day-school-label">${escape(a.description)}</span>`:''}</button>`;
      }).join('');
      const extras=childRotations.map(item=>{
        if(!positions.has(item))return '';
        const title=`${item.rotationName} · ${item.guardianName} · ${item.startTime}–${item.endTime}. Toca per ajustar només aquest dia.`;
        return `<button type="button" class="day-extra-block ${item.guardianId?'with-guardian':'without-guardian'}" data-action="edit-extra-slot" data-date="${escape(date)}" data-rotation="${escape(item.rotationId)}" data-child="${escape(child.id)}" ${position(item,`--extra-color:${escape(item.color)}`)} title="${escape(title)}" aria-label="${escape(title)}"><span>${escape(item.rotationName)}</span><small>${escape(item.startTime)}–${escape(item.endTime)}</small></button>`;
      }).join('');
      return `<div class="day-time-column" style="height:${height}px;--event-focus-layer:${placed.length+3}" aria-label="${escape(child.name)}">${nights}${overrides}${school}${extras}</div>`;
    }).join('');
    return columns;
  }
  function renderWeek(startDate,days,children,zoom=50,focusDate='',todayDate='',minimumHeight=0) {
    const safeZoom=[25,50,75,100,125,150].includes(zoom)?zoom:50;
    // Omple l'espai disponible sense retallar l'escala demanada amb el zoom.
    const height=Math.max(DAY_MINUTES*PX_PER_MINUTE*safeZoom/100,Number.isFinite(minimumHeight)?minimumHeight:0);
    const pxPerMinute=height/DAY_MINUTES;
    const columnCount=Math.max(1,children.length);
    const tickStep=safeZoom===25?120:60;
    const ticks=Array.from({length:DAY_MINUTES/tickStep+1},(_,i)=>
      `<span class="day-time-tick" style="top:${i*tickStep*pxPerMinute}px">${fmt(i*tickStep)}</span>`).join('');
    const childHeaders=children.map(c=>`<span class="week-child-label">${escape(c.name)}</span>`).join('');
    const head=days.map(day=>`<div class="week-day-header${day.date===todayDate?' today':''}" data-date="${escape(day.date)}">
      <button type="button" class="week-date-button${day.dayOff?' is-day-off':''}" data-action="focus-week-day" data-date="${escape(day.date)}" ${day.date===todayDate?'aria-current="date"':''} title="Mostra el dia ${escape(day.label)}">${escape(day.label)}</button>
      <div class="week-child-headers" style="--week-child-count:${columnCount}">${childHeaders}</div>
    </div>`).join('');
    const dayColumns=days.map(day=>`<div class="week-date-columns${day.date===todayDate?' today':''}" data-date="${escape(day.date)}" style="height:${height}px;--week-child-count:${columnCount}" aria-label="${escape(day.label)}">
      ${children.length?buildColumns(day.date,children,day.activities,day.nightSegments,height,pxPerMinute,day.customSlots,day.rotatingSlots):`<div class="day-time-column" style="height:${height}px"></div>`}</div>`).join('');
    return `<section class="week-timeline" aria-label="Setmana de 24 hores des de ${escape(startDate)}">
      <div class="week-sticky-head"><div class="week-sticky-head-viewport"></div></div>
      <div class="day-timeline-viewport week-timeline-viewport" tabindex="0" role="region"
           aria-label="Calendari setmanal de 24 hores, desplaçament vertical i horitzontal"
           data-timeline-key="week:${escape(startDate)}" data-focus-date="${escape(focusDate)}" data-zoom="${safeZoom}" data-px-per-minute="${pxPerMinute}" style="--hour-height:${60*pxPerMinute}px" data-initial-scroll="${FOCUS_MINUTE*pxPerMinute}">
        <div class="week-timeline-inner" style="--week-child-count:${columnCount};--week-day-count:${days.length};--week-day-width:${columnCount*98}px;min-width:var(--week-min-width,${52+days.length*columnCount*98}px)">
          <div class="week-timeline-head">
            <div class="week-time-corner">Hora</div>${head}
          </div>
          <div class="week-timeline-grid">
            <div class="day-time-axis week-time-axis" style="height:${height}px">${ticks}</div>${dayColumns}
          </div>
        </div>
      </div>
    </section>`;
  }
  function render(date,dateLabel,children,activities,nightSegments,changeTime,zoom=50,customSlots={},rotatingSlots=[],minimumHeight=0) {
    const safeZoom=[25,50,75,100,125,150].includes(zoom)?zoom:50;
    const height=Math.max(DAY_MINUTES*PX_PER_MINUTE*safeZoom/100,Number.isFinite(minimumHeight)?minimumHeight:0);
    const pxPerMinute=height/DAY_MINUTES;
    if(!children.length)return '<p class="settings-note">Selecciona algun fill als filtres.</p>';
    const tickStep=safeZoom===25?120:60;
    const tickMarks=Array.from({length:DAY_MINUTES/tickStep+1},(_,i)=>`<span class="day-time-tick" style="top:${i*tickStep*pxPerMinute}px">${fmt(i*tickStep)}</span>`).join('');
    const columns=buildColumns(date,children,activities,nightSegments,height,pxPerMinute,customSlots,rotatingSlots);
    return `<section class="day-timeline" aria-label="Calendari de 24 hores de ${escape(dateLabel)}">
      <div class="day-timeline-viewport" role="region" tabindex="0" aria-label="Línia temporal de 24 hores, amb desplaçament vertical i horitzontal" data-timeline-key="day:${escape(date)}" data-zoom="${safeZoom}" data-px-per-minute="${pxPerMinute}" style="--hour-height:${60*pxPerMinute}px" data-day-timeline="${escape(date)}" data-initial-scroll="${FOCUS_MINUTE*pxPerMinute}">
        <div class="day-timeline-inner" style="--day-child-count:${children.length};min-width:${52+children.length*98}px">
          <div class="day-timeline-headers"><span>Hora</span>${children.map(c=>`<span>${escape(c.name)}</span>`).join('')}</div>
          <div class="day-timeline-grid"><div class="day-time-axis" style="height:${height}px">${tickMarks}</div>${columns}</div>
        </div>
      </div>
    </section>`;
  }
  window.dayTimelineUI={overnightSegments,stackTimedBlocks,render,renderWeek,PX_PER_MINUTE,FOCUS_MINUTE};
})();
