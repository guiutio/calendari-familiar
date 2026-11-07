/* One complete week at a time; horizontal movement inside it stays independent. */
(() => {
 let wheelLocked=false,lastWheel=0,suppressClickUntil=0;
 function mount(viewport,strip,{navigate,focus}){
  const cleanups=[];let timer,touch=null,interacted=false,distance=0;
  const listen=(target,type,handler,options)=>{
   if(!target)return;
   target.addEventListener(type,handler,options);
   cleanups.push(()=>target.removeEventListener(type,handler,options));
  };
  const maxScroll=()=>Math.max(0,(viewport?.scrollWidth??0)-(viewport?.clientWidth??0));
  const left=()=>Math.max(0,Math.min(maxScroll(),viewport?.scrollLeft??0));
  const selectVisible=()=>{
   if(!viewport||!interacted)return;
   interacted=false;
   const edge=viewport.getBoundingClientRect().left+52;
   const days=Array.from(viewport.querySelectorAll('.week-day-header'));
   const closest=days.reduce((best,day)=>!best||Math.abs(day.getBoundingClientRect().left-edge)<Math.abs(best.getBoundingClientRect().left-edge)?day:best,null);
   if(closest)focus(closest.dataset.date);
  };
  const scrolled=()=>{clearTimeout(timer);timer=setTimeout(selectVisible,140);};
  const wheel=(event,wholeWeek)=>{
   const raw=event.deltaX||(event.shiftKey?event.deltaY:0);
   if(!raw||(!event.shiftKey&&Math.abs(raw)<=Math.abs(event.deltaY)))return;
   const now=Date.now();if(now-lastWheel>200){wheelLocked=false;distance=0;}lastWheel=now;
   if(wheelLocked){event.preventDefault();return;}
   const delta=raw*(event.deltaMode===1?16:event.deltaMode===2?(viewport?.clientWidth??300):1);
   const outward=wholeWeek||(delta<0?left()<=1:left()>=maxScroll()-1);
   if(!outward){distance=0;interacted=true;return;}
   event.preventDefault();
   distance=Math.sign(distance)===Math.sign(delta)?distance+delta:delta;
   if(Math.abs(distance)>=64){wheelLocked=true;interacted=false;clearTimeout(timer);navigate(Math.sign(distance));}
  };
  const start=(event,wholeWeek)=>{
   if(event.touches.length!==1){touch=null;return;}
   const point=event.touches[0];
   touch={x:point.clientX,y:point.clientY,scroll:left(),horizontal:false,vertical:false,excess:0,wholeWeek};
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
   event.preventDefault();interacted=true;
   const wanted=touch.scroll+dx,max=maxScroll();
   touch.excess=touch.wholeWeek?dx:wanted<0?wanted:wanted>max?wanted-max:0;
   if(viewport&&!touch.wholeWeek)viewport.scrollLeft=Math.max(0,Math.min(max,wanted));
  };
  const end=()=>{
   if(!touch)return;
   const {horizontal,excess}=touch;touch=null;
   if(!horizontal)return;
   suppressClickUntil=Date.now()+350;
   if(Math.abs(excess)>=64){interacted=false;clearTimeout(timer);navigate(Math.sign(excess));}
   else selectVisible();
  };
  const cancel=()=>{touch=null;interacted=false;};
  const click=event=>{if(Date.now()<suppressClickUntil){event.preventDefault();event.stopPropagation();}};
  for(const [target,wholeWeek] of [[viewport,false],[strip,true]]){
   listen(target,'wheel',event=>wheel(event,wholeWeek),{passive:false});
   listen(target,'touchstart',event=>start(event,wholeWeek),{passive:true});
   listen(target,'touchmove',move,{passive:false});
   listen(target,'touchend',end,{passive:true});
   listen(target,'touchcancel',cancel,{passive:true});
   listen(target,'click',click,true);
  }
  listen(viewport,'scroll',scrolled,{passive:true});
  listen(viewport,'keydown',event=>{
   if(event.altKey&&(event.key==='ArrowLeft'||event.key==='ArrowRight')){event.preventDefault();navigate(event.key==='ArrowLeft'?-1:1);}
   else if(event.key==='ArrowLeft'||event.key==='ArrowRight'){interacted=true;}
  });
  return ()=>{clearTimeout(timer);cleanups.forEach(cleanup=>cleanup());};
 }
 window.weekNavigation={mount};
})();
