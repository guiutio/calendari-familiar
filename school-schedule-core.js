/** Horari ordinari comú i activitats de grup: les activitats del grup substitueixen el tram de la franja de centre. */
(() => {
  function combine(base, extras) {
    const pieces=[];
    for(const session of base) {
      let cursor=session.startTime;
      const overlapping=extras.filter(a=>a.weekday===session.weekday&&a.startTime<session.endTime&&a.endTime>session.startTime)
        .sort((a,b)=>a.startTime.localeCompare(b.startTime));
      let segment=0;
      for(const extra of overlapping) {
        const begin=extra.startTime>session.startTime?extra.startTime:session.startTime;
        const finish=extra.endTime<session.endTime?extra.endTime:session.endTime;
        if(cursor<begin)pieces.push({...session,id:session.id+'-base-'+segment++,startTime:cursor,endTime:begin});
        if(cursor<finish)cursor=finish;
      }
      if(cursor<session.endTime)pieces.push({...session,id:session.id+'-base-'+segment,startTime:cursor,endTime:session.endTime});
    }
    return [...pieces,...extras].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime)||a.endTime.localeCompare(b.endTime));
  }
  function within(base,weekday,start,end) {
    return base.some(a=>a.weekday===weekday&&a.startTime<=start&&a.endTime>=end);
  }
  window.schoolScheduleCore={combine,within};
})();
