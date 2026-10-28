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
  /** Els dos calendaris comparteixen exactament les mateixes regles de pernocta i escola. */
  function buildColumns(date,children,activities,nightSegments,height,pxPerMinute) {
    const columns=children.map(child=>{
      const segments=nightSegments[child.id]??[];
      const nights=segments.filter(s=>s.visible).map(s=>{
        const h=(s.to-s.from)*pxPerMinute;
        const name=escape(s.guardianName);
        const title=`Pernocta · ${s.guardianName} · ${fmt(s.from)}–${fmt(s.to)}. Toca per editar la nit assignada.`;
        return `<button type="button" class="day-night-block" data-action="edit-band" data-date="${escape(s.date)}" data-band="nit" data-child="${escape(child.id)}" style="top:${s.from*pxPerMinute}px;height:${h}px;--night-color:${escape(s.guardianColor)}" aria-label="${escape(title)}" title="${escape(title)}"><span class="day-night-title">${name}</span><span class="day-night-subtitle">Pernocta · ${fmt(s.from)}–${fmt(s.to)}</span></button>`;
      }).join('');
      const childActivities=activities.filter(a=>a.childId===child.id).sort((a,b)=>a.start-b.start||a.end-b.end);
      const laneEnds=[];
      const placed=childActivities.map(a=>{
        let lane=laneEnds.findIndex(end=>end<=a.start);
        if(lane<0){lane=laneEnds.length;laneEnds.push(a.end);}else laneEnds[lane]=a.end;
        return {a,lane};
      });
      const laneCount=Math.max(1,laneEnds.length);
      const school=placed.map(({a,lane})=>{
        const start=Math.max(0,a.start),end=Math.min(DAY_MINUTES,a.end);
        if(end<=start)return '';
        const caption=`${a.schoolName} · ${a.kind}${a.description?' · '+a.description:''} · ${a.startTime}–${a.endTime}`;
        const top=start*pxPerMinute, h=(end-start)*pxPerMinute;
        return `<button type="button" class="day-school-block" style="top:${top}px;height:${h}px;left:calc(${lane} * 100% / ${laneCount} + 3px);width:calc(100% / ${laneCount} - 6px);--school-event-color:${escape(a.color)}" data-action="open-school-activity" data-date="${escape(date)}" data-school="${escape(a.schoolId)}" data-child="${escape(a.childId)}" data-session="${escape(a.id)}" title="${escape(caption)}" aria-label="${escape(caption)}"><span class="day-school-hours">${escape(a.startTime)}–${escape(a.endTime)}</span><span class="day-school-kind">${escape(a.kind)}</span>${a.description?`<span class="day-school-label">${escape(a.description)}</span>`:''}</button>`;
      }).join('');
      return `<div class="day-time-column" style="height:${height}px" aria-label="${escape(child.name)}">${nights}${school}</div>`;
    }).join('');
    return columns;
  }
  function renderWeek(startDate,days,children,zoom=50) {
    const safeZoom=[25,50,75,100,125,150].includes(zoom)?zoom:50;
    const pxPerMinute=PX_PER_MINUTE*safeZoom/100;
    if(!children.length)return '<p class="settings-note">Selecciona algun fill als filtres.</p>';
    const height=DAY_MINUTES*pxPerMinute;
    const tickStep=safeZoom===25?120:60;
    const ticks=Array.from({length:DAY_MINUTES/tickStep+1},(_,i)=>
      `<span class="day-time-tick" style="top:${i*tickStep*pxPerMinute}px">${fmt(i*tickStep)}</span>`).join('');
    const childHeaders=children.map(c=>`<span class="week-child-label">${escape(c.name)}</span>`).join('');
    const head=days.map(day=>`<div class="week-day-header">
      <button type="button" class="week-date-button" data-action="show-calendar-day" data-date="${escape(day.date)}" title="Obre el dia ${escape(day.label)}">${escape(day.label)}</button>
      <div class="week-child-headers" style="--week-child-count:${children.length}">${childHeaders}</div>
    </div>`).join('');
    const dayColumns=days.map(day=>`<div class="week-date-columns" style="height:${height}px;--week-child-count:${children.length}" aria-label="${escape(day.label)}">
      ${buildColumns(day.date,children,day.activities,day.nightSegments,height,pxPerMinute)}</div>`).join('');
    const list=days.map(day=>`<li><strong>${escape(day.label)}</strong><ul>${children.map(c=>{
      const parts=day.nightSegments[c.id]??[];
      return `<li>${escape(c.name)}: ${parts.filter(x=>x.visible).map(x=>`${fmt(x.from)}–${fmt(x.to)} ${escape(x.guardianName)}`).join('; ')||'Sense responsable visible'}${day.activities.filter(a=>a.childId===c.id).map(a=>`; ${escape(a.startTime)}–${escape(a.endTime)} ${escape(a.kind)} (${escape(a.schoolName)})`).join('')}</li>`;
    }).join('')}</ul></li>`).join('');
    return `<section class="week-timeline" aria-label="Setmana de 24 hores des de ${escape(startDate)}">
      <div class="day-timeline-viewport week-timeline-viewport" tabindex="0" role="region"
           aria-label="Calendari setmanal de 24 hores, desplaçament vertical i horitzontal"
           data-timeline-key="week:${escape(startDate)}" data-zoom="${safeZoom}" data-px-per-minute="${pxPerMinute}" style="--hour-height:${60*pxPerMinute}px" data-initial-scroll="${FOCUS_MINUTE*pxPerMinute}">
        <div class="week-timeline-inner" style="--week-child-count:${children.length};--week-day-count:${days.length};min-width:${52+days.length*children.length*145}px">
          <div class="week-timeline-head">
            <div class="week-time-corner">Hora</div>${head}
          </div>
          <div class="week-timeline-grid">
            <div class="day-time-axis week-time-axis" style="height:${height}px">${ticks}</div>${dayColumns}
          </div>
        </div>
      </div>
      <details class="day-timeline-summary"><summary>Pernoctes i activitats de tota la setmana en format de llista</summary><ul>${list}</ul></details>
    </section>`;
  }
  function render(date,dateLabel,children,activities,nightSegments,changeTime,zoom=50) {
    const safeZoom=[25,50,75,100,125,150].includes(zoom)?zoom:50;
    const pxPerMinute=PX_PER_MINUTE*safeZoom/100;
    if(!children.length)return '<p class="settings-note">Selecciona algun fill als filtres.</p>';
    const height=DAY_MINUTES*pxPerMinute;
    const tickStep=safeZoom===25?120:60;
    const tickMarks=Array.from({length:DAY_MINUTES/tickStep+1},(_,i)=>`<span class="day-time-tick" style="top:${i*tickStep*pxPerMinute}px">${fmt(i*tickStep)}</span>`).join('');
    const columns=buildColumns(date,children,activities,nightSegments,height,pxPerMinute);
    const list=children.map(child=>{
      const nights=nightSegments[child.id]??[];
      return `<li><strong>${escape(child.name)}</strong>: ${nights.filter(s=>s.visible).map(s=>`${fmt(s.from)}–${fmt(s.to)} ${escape(s.guardianName)}`).join('; ')||'Sense responsable visible'}${activities.filter(a=>a.childId===child.id).map(a=>`; ${escape(a.startTime)}–${escape(a.endTime)} ${escape(a.kind)} (${escape(a.schoolName)})`).join('')}</li>`;
    }).join('');
    return `<section class="day-timeline" aria-label="Calendari de 24 hores de ${escape(dateLabel)}">
      <div class="day-timeline-viewport" role="region" tabindex="0" aria-label="Línia temporal de 24 hores, amb desplaçament vertical i horitzontal" data-timeline-key="day:${escape(date)}" data-zoom="${safeZoom}" data-px-per-minute="${pxPerMinute}" style="--hour-height:${60*pxPerMinute}px;height:${Math.min(768,Math.ceil(height+42))}px" data-day-timeline="${escape(date)}" data-initial-scroll="${FOCUS_MINUTE*pxPerMinute}">
        <div class="day-timeline-inner" style="--day-child-count:${children.length};min-width:${52+children.length*145}px">
          <div class="day-timeline-headers"><span>Hora</span>${children.map(c=>`<span>${escape(c.name)}</span>`).join('')}</div>
          <div class="day-timeline-grid"><div class="day-time-axis" style="height:${height}px">${tickMarks}</div>${columns}</div>
        </div>
      </div>
      <details class="day-timeline-summary"><summary>Consultar les assignacions i les activitats en format de llista</summary><ul>${list}</ul></details>
    </section>`;
  }
  window.dayTimelineUI={overnightSegments,render,renderWeek,PX_PER_MINUTE,FOCUS_MINUTE};
})();
