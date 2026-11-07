import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function setup(initialLeft=0){
 let now=1000,serial=0;const timers=new Map(),navigations=[],focused=[];
 const target=()=>{
  const handlers=new Map();
  return {handlers,addEventListener(type,fn){handlers.set(type,fn);},removeEventListener(type){handlers.delete(type);},
   emit(type,values={}){const event={prevented:false,stopped:false,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},...values};handlers.get(type)?.(event);return event;}};
 };
 const viewport={...target(),scrollLeft:initialLeft,scrollWidth:1424,clientWidth:444,getBoundingClientRect:()=>({left:0}),
  querySelectorAll:()=>Array.from({length:7},(_,i)=>({dataset:{date:`2026-11-0${i+2}`},getBoundingClientRect:()=>({left:52+i*196-viewport.scrollLeft})}))};
 const strip=target();
 const ctx=vm.createContext({window:{},Date:{now:()=>now},setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)});
 vm.runInContext(read('week-navigation.js'),ctx);
 const mount=()=>ctx.window.weekNavigation.mount(viewport,strip,{navigate:step=>navigations.push(step),focus:date=>focused.push(date)});
 const cleanup=mount();
 const touch=(type,x,y=100,where=viewport)=>where.emit(type,{touches:type==='touchend'?[]:[{clientX:x,clientY:y}]});
 const wheel=(dx,dy=0,where=viewport)=>where.emit('wheel',{deltaX:dx,deltaY:dy,deltaMode:0,shiftKey:false});
 return {viewport,strip,mount,cleanup,touch,wheel,navigations,focused,timers,advance:ms=>now+=ms,flush:()=>{for(const fn of timers.values())fn();timers.clear();}};
}
test('el gest lateral recorre els dies sense barrejar setmanes i actualitza el dia seleccionat',()=>{
 const s=setup();s.touch('touchstart',300);const move=s.touch('touchmove',104);s.touch('touchend',104);
 assert.equal(move.prevented,true);assert.equal(s.viewport.scrollLeft,196);
 assert.deepEqual(s.navigations,[]);assert.deepEqual(s.focused,['2026-11-03']);
});
test('en superar els extrems, un gest passa exactament una setmana endavant o enrere',()=>{
 for(const [left,start,end,step] of [[980,250,120,1],[0,120,250,-1]]){
  const s=setup(left);s.touch('touchstart',start);s.touch('touchmove',end);s.touch('touchend',end);
  assert.deepEqual(s.navigations,[step]);assert.deepEqual(s.focused,[]);
 }
});
test('un moviment curt al límit, un gest vertical o cancel·lat no canvien de setmana',()=>{
 const s=setup();s.touch('touchstart',100);s.touch('touchmove',130);s.touch('touchend',130);
 assert.deepEqual(s.navigations,[]);
 s.touch('touchstart',100);assert.equal(s.touch('touchmove',110,250).prevented,false);s.touch('touchend',110,250);
 s.touch('touchstart',100);s.touch('touchmove',240);s.viewport.emit('touchcancel');s.touch('touchend',240);
 assert.deepEqual(s.navigations,[]);
});
test('la capçalera també permet canviar de setmana, encara que no hi hagi fills visibles',()=>{
 const s=setup();s.touch('touchstart',250,100,s.strip);s.touch('touchmove',120,100,s.strip);s.touch('touchend',120,100,s.strip);
 assert.deepEqual(s.navigations,[1]);assert.equal(s.viewport.scrollLeft,0);
});
test('la roda horitzontal només canvia de setmana als extrems i no intercepta el scroll vertical',()=>{
 const s=setup(196);assert.equal(s.wheel(100).prevented,false);assert.equal(s.wheel(0,100).prevented,false);
 s.viewport.scrollLeft=980;s.wheel(30);assert.deepEqual(s.navigations,[]);s.wheel(40);assert.deepEqual(s.navigations,[1]);
});
test('la inèrcia de la roda no encadena setmanes, també després de reconstruir la vista',()=>{
 const s=setup(980);s.wheel(80);s.cleanup();const cleanup=s.mount();
 s.wheel(100);s.advance(100);s.wheel(100);assert.deepEqual(s.navigations,[1]);
 s.advance(250);s.wheel(80);assert.deepEqual(s.navigations,[1,1]);cleanup();
});
test('un gest no activa accidentalment una activitat ni un altre dia',()=>{
 const s=setup();s.touch('touchstart',300);s.touch('touchmove',150);s.touch('touchend',150);
 const click=s.viewport.emit('click');assert.equal(click.prevented,true);assert.equal(click.stopped,true);
 s.advance(400);assert.equal(s.viewport.emit('click').prevented,false);
});
test('el teclat i la neteja dels observadors conserven la navegació accessible',()=>{
 const s=setup();s.viewport.emit('keydown',{altKey:true,key:'ArrowRight'});s.viewport.emit('keydown',{altKey:true,key:'ArrowLeft'});
 assert.deepEqual(s.navigations,[1,-1]);
 s.viewport.emit('keydown',{altKey:false,key:'ArrowRight'});s.viewport.scrollLeft=392;s.viewport.emit('scroll');s.flush();
 assert.deepEqual(s.focused,['2026-11-04']);
 s.viewport.emit('scroll');s.cleanup();assert.equal(s.timers.size,0);assert.equal(s.viewport.handlers.size,0);assert.equal(s.strip.handlers.size,0);
});
test('el nou controlador es carrega abans de l’app i està disponible sense connexió',()=>{
 const version=JSON.parse(read('package.json')).version,file=`week-navigation.js?v=${version}`,html=read('index.html');
 assert.ok(html.includes(file));assert.ok(read('sw.js').includes(file));assert.ok(html.indexOf(file)<html.indexOf(`app.js?v=${version}`));
});
test('els gestos canvien de setmana sencera en creuar l’any i el focus actualitza el dia d’edició',()=>{
 const app=read('app.js'),start=app.indexOf('function mountWeekNavigation('),end=app.indexOf('function render()',start);
 let callbacks,paints=0,oldCleanups=0,newCleanups=0;
 const parseDate=value=>new Date(value+'T12:00:00Z'),localDate=date=>date.toISOString().slice(0,10);
 const addDays=(value,n)=>{const date=parseDate(value);date.setUTCDate(date.getUTCDate()+n);return localDate(date);};
 const weekStart=value=>addDays(value,-((parseDate(value).getUTCDay()+6)%7));
 const buttons=Array.from({length:7},(_,i)=>({dataset:{date:addDays('2026-12-28',i)},classList:{toggle(_name,value){this.selected=value;}},setAttribute(name,value){this[name]=value;}}));
 const strip={querySelectorAll:()=>buttons},viewport={};
 const ctx=vm.createContext({weekNavigation:{mount(v,s,options){assert.equal(v,viewport);assert.equal(s,strip);callbacks=options;return ()=>newCleanups++;}},
  $app:{querySelector:selector=>selector==='.week-day-strip'?strip:viewport},stopCalendarScroll:()=>oldCleanups++,selectedDate:'2026-12-31',
  parseDate,addDays,weekStart,isValidDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),render:()=>paints++});
 vm.runInContext(app.slice(start,end),ctx);ctx.mountWeekNavigation();
 callbacks.navigate(1);assert.equal(ctx.selectedDate,'2027-01-04');assert.equal(ctx.viewYear,2027);assert.equal(ctx.viewMonth,0);assert.equal(ctx.weekFocusTarget,true);
 callbacks.navigate(-1);assert.equal(ctx.selectedDate,'2027-01-03');assert.equal(ctx.viewYear,2027);assert.equal(ctx.viewMonth,0);assert.equal(paints,2);
 callbacks.navigate(-1);assert.equal(ctx.selectedDate,'2026-12-27');
 callbacks.navigate(1);assert.equal(ctx.selectedDate,'2026-12-28');assert.equal(paints,4);
 callbacks.focus('2026-12-30');assert.equal(ctx.selectedDate,'2026-12-30');assert.equal(buttons[2]['aria-pressed'],'true');assert.equal(buttons[2].classList.selected,true);
 callbacks.focus('2027-01-05');assert.equal(ctx.selectedDate,'2026-12-30');
 ctx.stopCalendarScroll();assert.equal(oldCleanups,1);assert.equal(newCleanups,1);
});
