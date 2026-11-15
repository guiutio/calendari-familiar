/* Pointer capture keeps the same drag gesture on touch screens, mouse and pen. */
(() => {
 function mount(root,commit){
  let drag=null,frame=0;
  const animations=new WeakMap();
  const rows=list=>Array.from(list.querySelectorAll('.person-list-row'));
  const reduced=()=>window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  function rearrange(list,change){
   const items=rows(list).filter(row=>row!==drag?.row);
   const before=items.map(row=>row.getBoundingClientRect().top);
   items.forEach(row=>animations.get(row)?.cancel());
   change();
   if(!reduced())items.forEach((row,i)=>{
    const offset=before[i]-row.getBoundingClientRect().top;
    if(offset&&row.animate)animations.set(row,row.animate([{transform:`translateY(${offset}px)`},{transform:'translateY(0)'}],{duration:160,easing:'ease-out'}));
   });
  }
  function preview(){
   if(!drag)return;
   const {row,list,placeholder,y,offset,height,top}=drag;
   row.style.transform=`translateY(${y-offset-top}px)`;
   const others=rows(list).filter(item=>item!==row);
   const center=y-offset+height/2;
   const next=others.find(item=>center<item.getBoundingClientRect().top+item.getBoundingClientRect().height/2);
   // The fixed row is still in the list so pointer capture never changes owner.
   const order=Array.from(list.children).filter(item=>item!==row);
   const index=next?order.indexOf(next):order.length;
   const current=order.indexOf(placeholder);
   if(index!==current&&index!==current+1)rearrange(list,()=>list.insertBefore(placeholder,next??null));
  }
  function scrollParent(row){
   for(let parent=row.parentElement;parent;parent=parent.parentElement){
    if(/auto|scroll/.test(getComputedStyle(parent).overflowY)&&parent.scrollHeight>parent.clientHeight)return parent;
   }
   return document.scrollingElement;
  }
  function tick(){
   if(!drag)return;
   if(!drag.row.isConnected){finish(false);return;}
   const scroller=drag.scroller;
   const bounds=scroller===document.scrollingElement?{top:0,bottom:window.innerHeight}:scroller.getBoundingClientRect();
   const edge=48;
   const speed=drag.y<bounds.top+edge?-Math.min(12,(bounds.top+edge-drag.y)/4):drag.y>bounds.bottom-edge?Math.min(12,(drag.y-bounds.bottom+edge)/4):0;
   if(speed){scroller.scrollTop+=speed;preview();}
   frame=requestAnimationFrame(tick);
  }
  function finish(drop){
   if(!drag)return;
   const current=drag;drag=null;cancelAnimationFrame(frame);
   const {row,list,placeholder,handle,original,pointer}=current;
   const index=Array.from(list.children).filter(item=>item!==row).indexOf(placeholder);
   row.classList.remove('person-dragging');row.removeAttribute('style');
   if(drop)list.insertBefore(row,placeholder);
   else list.insertBefore(row,rows(list).filter(item=>item!==row)[original]??null);
   placeholder.remove();
   handle.setAttribute('aria-pressed','false');
   if(handle.hasPointerCapture?.(pointer))handle.releasePointerCapture(pointer);
   if(row.isConnected){
    handle.focus({preventScroll:true});
    if(drop&&index!==original)commit(list.dataset.kind,row.dataset.id,index);
   }
  }
  root.addEventListener('pointerdown',event=>{
   const handle=event.target.closest?.('.person-drag-handle');
   if(!handle||handle.disabled||event.button!==0||event.isPrimary===false||drag)return;
   const row=handle.closest('.person-list-row'),list=row.closest('.people-list');
   const items=rows(list);if(items.length<2)return;
   event.preventDefault();handle.focus({preventScroll:true});
   const rect=row.getBoundingClientRect(),placeholder=document.createElement('li');
   placeholder.className='person-drag-placeholder';placeholder.style.height=`${rect.height}px`;placeholder.setAttribute('aria-hidden','true');
   list.insertBefore(placeholder,row);
   drag={handle,row,list,placeholder,original:items.indexOf(row),pointer:event.pointerId,y:event.clientY,offset:event.clientY-rect.top,height:rect.height,top:rect.top,
    scroller:scrollParent(row)};
   row.classList.add('person-dragging');
   Object.assign(row.style,{top:`${rect.top}px`,left:`${rect.left}px`,width:`${rect.width}px`,height:`${rect.height}px`});
   handle.setAttribute('aria-pressed','true');handle.setPointerCapture(event.pointerId);
   frame=requestAnimationFrame(tick);
  });
  root.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.pointer)return;
   event.preventDefault();drag.y=event.clientY;preview();
  });
  root.addEventListener('pointerup',event=>{if(drag&&event.pointerId===drag.pointer)finish(true);});
  root.addEventListener('pointercancel',event=>{if(drag&&event.pointerId===drag.pointer)finish(false);});
  root.addEventListener('lostpointercapture',event=>{if(drag&&event.pointerId===drag.pointer)finish(false);});
  root.addEventListener('click',event=>{if(event.target.closest?.('.person-drag-handle')){event.preventDefault();event.stopPropagation();}});
  root.addEventListener('keydown',event=>{
   if(event.key==='Escape'&&drag){event.preventDefault();finish(false);return;}
   const handle=event.target.closest?.('.person-drag-handle');
   if(!handle||handle.disabled||drag||!['ArrowUp','ArrowDown','Home','End'].includes(event.key))return;
   event.preventDefault();
   const row=handle.closest('.person-list-row'),list=row.closest('.people-list'),items=rows(list),index=items.indexOf(row);
   const target=event.key==='Home'?0:event.key==='End'?items.length-1:Math.max(0,Math.min(items.length-1,index+(event.key==='ArrowUp'?-1:1)));
   if(index===target)return;
   rearrange(list,()=>list.insertBefore(row,items[target+(target>index?1:0)]??null));
   handle.focus({preventScroll:true});commit(list.dataset.kind,row.dataset.id,target);
  });
  window.addEventListener('blur',()=>finish(false));
 }
 window.peopleReorder={mount};
})();
