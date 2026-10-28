/* Línia temporal escolar; no modifica mai les dades familiars. */
(() => {
  const types = {classe:'Classe',pati:'Pati',menjador:'Menjador',extraescolar:'Extraescolar',altres:'Altres'};
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const minutes = value => {const [h,m]=value.split(':').map(Number);return h*60+m;};
  const hour = value => String(Math.floor(value / 60)).padStart(2,'0')+':00';
  function collect(date,children,schools,visibleIds,getSessions) {
    const result=[];
    for(const school of schools) {
      if(!visibleIds.includes(school.id))continue;
      const years=school.years??[];
      const applicable=years.filter(year=>date>=year.startDate&&date<=year.endDate);
      if(years.length&&!applicable.length)continue;
      for(const year of applicable.length?applicable:[undefined]) {
        if(year?.holidays.includes(date))continue;
        for(const child of children) {
          const group=year?.groups.find(g=>g.childIds.includes(child.id));
          if(!(school.childIds??[]).includes(child.id)&&!group)continue;
          for(const session of getSessions(school,year,group,child.id,date)) {
            const start=minutes(session.startTime),end=minutes(session.endTime);
            if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
            result.push({id:session.id,childId:child.id,schoolId:school.id,schoolName:school.name,color:school.color,
              startTime:session.startTime,endTime:session.endTime,start,end,
              kind:types[session.kind]??types.classe,description:session.label??''});
          }
        }
      }
    }
    return result.sort((a,b)=>a.start-b.start||a.end-b.end||a.childId.localeCompare(b.childId));
  }
  function range(items) {
    if(!items.length)return null;
    return [Math.floor(Math.min(...items.map(a=>a.start))/60)*60,Math.ceil(Math.max(...items.map(a=>a.end))/60)*60];
  }
  function render(date,dateLabel,children,activities,commonRange=null,empty=false,reduced=false) {
    if(!activities.length)return empty?'<p class="school-timeline-empty">No hi ha activitats escolars amb hores definides en aquest dia per als fills visibles.</p>':'';
    const bounds=commonRange??range(activities);
    if(!bounds)return '';
    const [first,last]=bounds,scale=.9,height=(last-first)*scale;
    const ticks=Array.from({length:Math.floor((last-first)/60)+1},(_,i)=>{
      const minute=first+i*60;
      return `<span class="school-time-tick" style="top:${(minute-first)*scale}px">${hour(minute)}</span>`;
    }).join('');
    const columns=children.map(c=>activities.filter(a=>a.childId===c.id));
    const blocks=columns.map(items=>{
      const laneEnds=[];
      const placed=items.map(a=>{
        let lane=laneEnds.findIndex(end=>end<=a.start);
        if(lane<0){lane=laneEnds.length;laneEnds.push(a.end);}else laneEnds[lane]=a.end;
        return {a,lane};
      });
      const lanes=Math.max(1,laneEnds.length);
      return `<div class="school-timeline-column" style="height:${height}px">${placed.map(({a,lane})=>{
        const title=`${a.schoolName} · ${a.kind}${a.description?' · '+a.description:''} · ${a.startTime}–${a.endTime}`;
        return `<button type="button" class="school-timeline-event" style="top:${(a.start-first)*scale}px;height:${(a.end-a.start)*scale}px;left:calc(${lane} * 100% / ${lanes} + 2px);width:calc(100% / ${lanes} - 4px);--activity-color:${a.color}" data-action="open-school-activity" data-date="${date}" data-child="${esc(a.childId)}" data-school="${esc(a.schoolId)}" data-session="${esc(a.id)}" title="${esc(title)}" aria-label="${esc(title)}"><span class="school-event-hour">${a.startTime}–${a.endTime}</span><span class="school-event-kind">${esc(a.kind)}</span>${a.description?`<span class="school-event-description">${esc(a.description)}</span>`:''}</button>`;
      }).join('')}</div>`;
    }).join('');
    const list=columns.map((items,i)=>items.map(a=>`<li><strong>${esc(children[i]?.name??'Fill')}</strong> · ${a.startTime}–${a.endTime} · ${esc(a.kind)}${a.description?' · '+esc(a.description):''} · ${esc(a.schoolName)}</li>`).join('')).join('');
    return `<section class="school-timeline" aria-label="Horari escolar de ${esc(dateLabel)}">
      <div class="school-timeline-heading"><strong>Horari escolar</strong><span>${hour(first)}–${hour(last)}</span>${reduced?'<span class="school-timeline-reduced">Jornada reduïda</span>':''}</div>
      <div class="school-timeline-scroll"><div class="school-timeline-inner" style="--child-count:${children.length};min-width:${48+children.length*115}px">
        <div class="school-timeline-corner">Hora</div>${children.map(c=>`<div class="school-timeline-child">${esc(c.name)}</div>`).join('')}
        <div class="school-timeline-axis" style="height:${height}px">${ticks}</div>${blocks}
      </div></div>
      <details class="school-timeline-details"><summary>Activitats i hores en format de llista (${activities.length})</summary><ul>${list}</ul></details>
    </section>`;
  }
  window.schoolCalendarUI={collect,range,render};
})();
