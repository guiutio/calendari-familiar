/* Whole weeks when they fit; continuous days in narrower viewports. */
(() => {
 let wheelLocked=false,lastWheel=0,suppressClickUntil=0;
 function fitsWeek(viewport){
  if(!viewport||window.matchMedia?.('(max-width:560px)').matches)return false;
  const width=viewport.querySelectorAll('.week-day-header')[0]?.getBoundingClientRect().width;
  return width>0&&width*7<=viewport.clientWidth-52+1;
 }
 function mount(viewport,strip,{navigate,focus,extend}){
  const cleanups=[];let touch=null,interacted=false,distance=0,filling=false,lastFocusedDate=viewport?.dataset?.focusDate??'';
  const wholeGrid=fitsWeek(viewport);
  if(viewport?.dataset)viewport.dataset.weekMode=wholeGrid?'week':'day';
  const listen=(target,type,handler,options)=>{
   if(!target)return;
   target.addEventListener(type,handler,options);
   cleanups.push(()=>target.removeEventListener(type,handler,options));
  };
  const singleDay=()=>Boolean(window.matchMedia?.('(max-width:560px)').matches);
  const maxScroll=()=>Math.max(0,(viewport?.scrollWidth??0)-(viewport?.clientWidth??0));
  const left=()=>Math.max(0,Math.min(maxScroll(),viewport?.scrollLeft??0));
  const fill=()=>{
   if(!viewport||!extend||filling||wholeGrid)return;
   filling=true;
   try{
    for(const direction of [-1,1]){
     for(let i=0;i<3;i++){
      const remaining=direction<0?left():maxScroll()-left();
      if(remaining>=viewport.clientWidth*2||!extend(direction))break;
     }
    }
   }finally{filling=false;}
  };
  const selectVisible=()=>{
   if(!viewport||!interacted)return;
   interacted=false;
   const edge=viewport.getBoundingClientRect().left+52;
   const days=Array.from(viewport.querySelectorAll('.week-day-header'));
   const first=days[0]?.getBoundingClientRect(),width=first?.width;
   const closest=width>0?days[Math.max(0,Math.min(days.length-1,Math.round((edge-first.left)/width)))]:
    days.reduce((best,day)=>!best||Math.abs(day.getBoundingClientRect().left-edge)<Math.abs(best.getBoundingClientRect().left-edge)?day:best,null);
   if(closest&&closest.dataset.date!==lastFocusedDate){lastFocusedDate=closest.dataset.date;focus(lastFocusedDate);}
  };
  const scrolled=()=>{
   // Un canvi d'amplada pot emetre scroll abans que ResizeObserver torni a muntar la vista.
   if(filling||wholeGrid||fitsWeek(viewport))return;
   interacted=true;
   // Actualitza la barra en el mateix esdeveniment, també durant la inèrcia.
   selectVisible();
   fill();
  };
  const wheel=(event,wholeWeek)=>{
   if(event.ctrlKey||event.metaKey)return;
   wholeWeek=wholeWeek||wholeGrid;
   const mouseWheel=!singleDay()&&window.matchMedia?.('(pointer:fine)').matches;
   if(viewport&&mouseWheel&&!wholeGrid&&!event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX)){
    event.preventDefault();
    fill();
    const scale=event.deltaMode===1?16:event.deltaMode===2?viewport.clientWidth:1;
    viewport.scrollLeft=Math.max(0,Math.min(maxScroll(),left()+event.deltaY*scale));
    scrolled();
    return;
   }
   const verticalWheel=wholeGrid&&mouseWheel&&!event.shiftKey&&Math.abs(event.deltaY)>Math.abs(event.deltaX);
   const raw=verticalWheel?event.deltaY:event.deltaX||(event.shiftKey?event.deltaY:0);
   if(!raw||(!verticalWheel&&!event.shiftKey&&Math.abs(raw)<=Math.abs(event.deltaY)))return;
   if(extend&&!wholeWeek){interacted=true;fill();return;}
   const now=Date.now();if(now-lastWheel>200){wheelLocked=false;distance=0;}lastWheel=now;
   if(wheelLocked){event.preventDefault();return;}
   const delta=raw*(event.deltaMode===1?16:event.deltaMode===2?(viewport?.clientWidth??300):1);
   const outward=wholeWeek||(delta<0?left()<=1:left()>=maxScroll()-1);
   if(!outward){distance=0;interacted=true;return;}
   event.preventDefault();
   distance=Math.sign(distance)===Math.sign(delta)?distance+delta:delta;
   if(Math.abs(distance)>=64){wheelLocked=true;interacted=false;navigate(Math.sign(distance));}
  };
  const start=(event,wholeWeek)=>{
   if(event.touches.length!==1){touch=null;return;}
   const point=event.touches[0];
   touch={x:point.clientX,y:point.clientY,scroll:left(),horizontal:false,vertical:false,excess:0,wholeWeek:wholeWeek||wholeGrid};
  };
  const move=event=>{
   if(!touch||event.touches.length!==1)return;
   const point=event.touches[0],dx=touch.x-point.clientX,dy=touch.y-point.clientY;
   if(!touch.horizontal&&!touch.vertical){
    if(Math.max(Math.abs(dx),Math.abs(dy))<8)return;
    if(Math.abs(dx)>Math.abs(dy)*1.2)touch.horizontal=true;
    else {touch.vertical=true;return;}
   }
   if(!touch.horizontal)return;
   interacted=true;
   const wanted=touch.scroll+dx,max=maxScroll();
   touch.excess=touch.wholeWeek?dx:wanted<0?wanted:wanted>max?wanted-max:0;
   // El mòbil deixa el desplaçament als gestos nadius i al snap CSS.
   if(singleDay()&&!touch.wholeWeek)return;
   event.preventDefault();
   if(viewport&&!touch.wholeWeek)viewport.scrollLeft=Math.max(0,Math.min(max,wanted));
  };
  const end=()=>{
   if(!touch)return;
   const {horizontal,excess,wholeWeek}=touch;touch=null;
   if(!horizontal)return;
   suppressClickUntil=Date.now()+350;
   if(Math.abs(excess)>=64&&(wholeWeek||!extend)){interacted=false;navigate(Math.sign(excess));}
   else if(singleDay()&&!wholeWeek)scrolled();
   else selectVisible();
  };
  const cancel=()=>{touch=null;interacted=false;};
  const click=event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}};
  fill();
  for(const [target,wholeWeek] of [[viewport,false],[strip,true]]){
   listen(target,'wheel',event=>wheel(event,wholeWeek),{passive:false});
   listen(target,'touchstart',event=>start(event,wholeWeek),{passive:true});
   listen(target,'touchmove',move,{passive:false});
   listen(target,'touchend',end,{passive:true});
   listen(target,'touchcancel',cancel,{passive:true});
   listen(target,'click',click,true);
  }
  listen(viewport,'scroll',scrolled,{passive:true});
  listen(viewport,'scrollend',selectVisible,{passive:true});
  listen(viewport,'keydown',event=>{
   if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
   else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
    if(wholeGrid){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
    else interacted=true;
   }
  });
  return ()=>{cleanups.forEach(cleanup=>cleanup());};
 }
 window.weekNavigation={mount,fitsWeek};
})();
