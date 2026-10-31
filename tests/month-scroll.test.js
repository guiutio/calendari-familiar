import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const dates=extract('function periodTitle()', 'function navButton(');
const dateHelpers=extract('function localDate(', 'function monthTitle(');

function controller(mobile=true){
 let frame,listen,timer;
 const base=2026*12+9;
 const main={scrollTop:0,addEventListener:(name,f)=>{if(name==='scroll')listen=f;},removeEventListener:()=>{},getBoundingClientRect:()=>({top:mobile?100:0,bottom:800})};
 const win={setTimeout:f=>(timer=f,2),clearTimeout:()=>{timer=undefined;},get scrollY(){return main.scrollTop;},innerHeight:800,matchMedia:()=>({matches:mobile}),scrollBy:(_,delta)=>main.scrollTop+=delta,scrollTo:(_,y)=>main.scrollTop=y,requestAnimationFrame:f=>(frame=f,1),cancelAnimationFrame:()=>{},addEventListener:()=>{},removeEventListener:()=>{}};
 let panels=[];
 const panel=index=>({querySelectorAll:()=>[],dataset:{monthIndex:String(index)},getBoundingClientRect:()=>({top:200+(index-base+1)*700-main.scrollTop,bottom:900+(index-base+1)*700-main.scrollTop}),remove(){panels=panels.filter(p=>p!==this);}});
 panels=Array.from({length:7},(_,i)=>base-3+i).map(panel);
 const title={textContent:''};
 const bar={getBoundingClientRect:()=>({bottom:100,height:100}),querySelector:()=>title};
 const sequence={isConnected:true,querySelectorAll:()=>panels,querySelector:s=>panels.find(p=>s.includes('"'+p.dataset.monthIndex+'"')),get firstElementChild(){return panels[0];},get lastElementChild(){return panels.at(-1);},insertAdjacentHTML(where,html){const next=html.split(',').map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];}};
 const $app={querySelector:s=>s==='.main-area'?main:s==='.month-sequence'?sequence:bar};
 const ctx=vm.createContext({$app,window:win,tab:'calendar',calendarView:'month',viewYear:2026,viewMonth:9,selectedDate:'2026-10-31',monthScrollTarget:true,stopCalendarScroll:null,monthRange:null,activeChildren:()=>[],localDate:d=>d.toISOString().slice(0,10),parseDate:d=>new Date(d+'T12:00:00Z'),monthPanel:i=>String(i)+',',periodTitle:()=>`${ctx.viewYear}-${ctx.viewMonth+1}`});
 // Use a delimiter only between generated panels, including appends/prepends.
 sequence.insertAdjacentHTML=(where,html)=>{const next=html.split(',').filter(Boolean).map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];};
 vm.runInContext(extract('function monthPosition()', 'function calendarPage()'),ctx);
 ctx.mountCalendarScroll(null);frame();if(timer)timer();
 return {ctx,main,title,panels:()=>panels,scroll(delta){main.scrollTop+=delta;listen();frame();if(timer)timer();},refresh(){frame();if(timer)timer();},base};
}

test('mesos: la càrrega inicial enfoca el mes actual en mòbil i escriptori',()=>{
 for(const mobile of [true,false]){
  const c=controller(mobile);
  assert.equal(c.ctx.monthPosition().index,c.base);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.equal(c.ctx.selectedDate,'2026-10-31');
 }
});
test('mesos: recorre anys en ambdues direccions, carrega sense saltar i limita el DOM',()=>{
 const c=controller();
 for(let i=0;i<26;i++){
  c.scroll(700);
  assert.equal(c.ctx.monthPosition().index,c.base+i+1);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.ok(c.panels().length<=9);
 }
 assert.equal(c.ctx.viewYear,2028);assert.equal(c.ctx.viewMonth,11);
 for(let i=0;i<40;i++){
  c.scroll(-700);
  assert.equal(c.ctx.monthPosition().index,c.base+25-i);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.ok(c.panels().length<=9);
 }
 assert.equal(c.ctx.viewYear,2025);assert.equal(c.ctx.viewMonth,7);
 assert.equal(c.ctx.selectedDate,'2025-08-01');
});
test('mesos: conserva el desplaçament parcial en repintar filtres o diàlegs',()=>{
 const c=controller();c.scroll(923);
 const anchor=c.ctx.monthPosition();
 c.ctx.stopCalendarScroll();c.main.scrollTop=0;
 c.ctx.mountCalendarScroll(anchor);c.refresh();
 assert.equal(c.ctx.monthPosition().index,anchor.index);
 assert.equal(c.ctx.monthPosition().top,anchor.top);
});
test('mesos: les fletxes i Avui poden enfocar un mes ja carregat',()=>{
 const c=controller();c.scroll(1400);
 c.ctx.viewYear=2026;c.ctx.viewMonth=9;c.ctx.monthScrollTarget=true;
 c.ctx.mountCalendarScroll(c.ctx.monthPosition());c.refresh();
 assert.equal(c.ctx.monthPosition().index,c.base);
 assert.equal(c.ctx.monthPosition().top,100);
});
test('fletxes: mes, setmana i dia creuen correctament any, febrer i dia de traspàs',()=>{
 const context=vm.createContext({calendarView:'month',viewYear:2026,viewMonth:11,selectedDate:'2026-12-31',monthScrollTarget:false,render:()=>{}});
 vm.runInContext(dateHelpers+dates,context);
 context.navigateCalendar(1);assert.equal(context.selectedDate,'2027-01-01');
 context.calendarView='week';context.selectedDate='2026-12-28';context.navigateCalendar(1);
 assert.equal(context.selectedDate,'2027-01-04');
 context.calendarView='day';context.selectedDate='2028-02-28';context.navigateCalendar(1);
 assert.equal(context.selectedDate,'2028-02-29');context.navigateCalendar(1);
 assert.equal(context.selectedDate,'2028-03-01');context.navigateCalendar(-1);
 assert.equal(context.selectedDate,'2028-02-29');
});


test('la barra superior és fora del contenidor desplaçable en les tres vistes',()=>{
 const source=extract('function layout(content)', 'function monthPanel(');
 for(const calendarView of ['month','week','day']){
  const ctx=vm.createContext({tab:'calendar',calendarView,sheet:null,APP_VERSION:'test',icon:()=>'',navButton:()=>'',calendarNavigation:()=>'<header class="calendar-sticky-bar">Controls</header>'});
  vm.runInContext(source,ctx);
  const html=ctx.layout('<section>Calendari</section>');
  assert.match(html,/<\/aside><header class="calendar-sticky-bar">Controls<\/header><main class="main-area">/);
  const main=html.slice(html.indexOf('<main'),html.indexOf('</main>'));
  assert.doesNotMatch(main,/calendar-sticky-bar/);
 }
});

function continuousRenderer(){
 const uiContext={window:{}};
 vm.runInNewContext(readFileSync(new URL('../month-day-ui.js',import.meta.url),'utf8'),uiContext);
 const context=vm.createContext({
  state:{},birthdays:()=>[],monthData:()=>({activities:[],nights:{},slots:{},extra:[]}),
  escapeHtml:String,fullDate:String,monthTitle:(y,m)=>`${y}-${m+1}`,
  monthDayUI:{...uiContext.window.monthDayUI,hasChanges:()=>false,mini:()=>''}
 });
 vm.runInContext(dateHelpers+extract('function weekStart(', 'function fullAgenda(')+extract('function monthWeekStart(', '// Keep a small sliding window'),context);
 return context;
}
test('graella contínua: totes les dates i setmanes són úniques i consecutives entre mesos i anys',()=>{
 const ctx=continuousRenderer();
 let html='';
 for(let index=2025*12;index<2029*12;index++)html+=ctx.monthPanel(index,[],'2026-10-31');
 const dates=Array.from(html.matchAll(/data-action="show-calendar-day" data-date="([^"]+)"/g),m=>m[1]);
 const weeks=Array.from(html.matchAll(/data-action="show-calendar-week" data-date="([^"]+)"/g),m=>m[1]);
 assert.equal(new Set(dates).size,dates.length);
 assert.equal(new Set(weeks).size,weeks.length);
 assert.equal(dates.length,weeks.length*7);
 for(let i=1;i<dates.length;i++)assert.equal(dates[i],ctx.addDays(dates[i-1],1));
 for(let i=1;i<weeks.length;i++)assert.equal(weeks[i],ctx.addDays(weeks[i-1],7));
 assert.ok(dates.includes('2028-02-29'));
 assert.equal(dates.filter(d=>d==='2026-10-31').length,1);
 assert.doesNotMatch(html,/other-month|month-section-title|class="weekdays"/);
});
test('la setmana compartida octubre–novembre conserva els contorns reals dels dos mesos',()=>{
 const ctx=continuousRenderer();
 const html=ctx.monthPanel(2026*12+9,[],'2026-10-31')+ctx.monthPanel(2026*12+10,[],'2026-10-31');
 const cell=date=>html.match(new RegExp('class="day-cell ([^"]+)" data-action="show-calendar-day" data-date="'+date+'"'))[1];
 assert.match(cell('2026-10-31'),/today/);
 assert.match(cell('2026-10-31'),/month-edge-bottom/);
 assert.match(cell('2026-10-31'),/month-edge-right/);
 assert.match(cell('2026-11-01'),/month-edge-top/);
 assert.match(cell('2026-11-01'),/month-edge-left/);
 assert.match(cell('2026-11-01'),/month-edge-right/);
 assert.equal((html.match(/data-action="show-calendar-week" data-date="2026-10-26"/g)||[]).length,1);
});

// Layout realista: inserir/retirar panells mou físicament els altres i pot
// limitar scrollTop; les escriptures programàtiques generen esdeveniments scroll.
function inertialController(){
 const base=2026*12+9;
 let panels=[],rawTop=0,clock=0,serial=0,mutations=0,writes=0;
 const events=[],frames=new Map(),timers=new Map(),listeners=new Map();
 const height=index=>420+((index%3+3)%3)*105;
 const max=()=>Math.max(0,200+panels.reduce((n,p)=>n+height(Number(p.dataset.monthIndex)),0)+100-700);
 const dispatch=name=>listeners.get(name)?.();
 const nativeTop=value=>{const next=Math.max(0,Math.min(max(),value));if(next!==rawTop){rawTop=next;events.push(()=>dispatch('scroll'));}};
 const main={get scrollTop(){return rawTop;},set scrollTop(value){writes++;nativeTop(value);},
  getBoundingClientRect:()=>({top:100,bottom:800}),
  addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const panel=index=>({dataset:{monthIndex:String(index)},querySelectorAll:()=>[],
  getBoundingClientRect(){const y=300+panels.slice(0,panels.indexOf(this)).reduce((n,p)=>n+height(Number(p.dataset.monthIndex)),0)-rawTop;return {top:y,bottom:y+height(index)};},
  remove(){mutations++;panels=panels.filter(p=>p!==this);nativeTop(rawTop);}
 });
 panels=Array.from({length:7},(_,i)=>base-3+i).map(panel);
 const bar={getBoundingClientRect:()=>({bottom:100,height:100}),querySelector:()=>({textContent:''})};
 const sequence={isConnected:true,querySelectorAll:()=>panels,
  querySelector:s=>panels.find(p=>s.includes('"'+p.dataset.monthIndex+'"')),
  get firstElementChild(){return panels[0];},get lastElementChild(){return panels.at(-1);},
  insertAdjacentHTML(where,html){mutations++;const next=html.split(',').filter(Boolean).map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];nativeTop(rawTop);}
 };
 const win={matchMedia:()=>({matches:true}),requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:(fn,delay)=>{timers.set(++serial,{fn,due:clock+delay});return serial;},clearTimeout:id=>timers.delete(id),
  addEventListener:()=>{},removeEventListener:()=>{}};
 const ctx=vm.createContext({$app:{querySelector:s=>s==='.main-area'?main:s==='.month-sequence'?sequence:bar},window:win,
  tab:'calendar',calendarView:'month',viewYear:2026,viewMonth:9,selectedDate:'2026-10-31',monthScrollTarget:true,stopCalendarScroll:null,monthRange:null,
  activeChildren:()=>[],localDate:d=>d.toISOString().slice(0,10),parseDate:d=>new Date(d+'T12:00:00Z'),monthPanel:i=>i+',',periodTitle:()=>''});
 vm.runInContext(extract('function monthPosition()', 'function calendarPage()'),ctx);
 const flush=()=>{
  for(let safety=0;events.length||frames.size;safety++){
   assert.ok(safety<30,'No hi pot haver realimentació de scroll');
   events.splice(0).forEach(fn=>fn());
   const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn());
  }
 };
 const advance=ms=>{
  clock+=ms;
  for(let safety=0;;safety++){
   const ready=[...timers].filter(([,t])=>t.due<=clock);
   if(!ready.length)break;
   assert.ok(safety<30,'Les correccions no poden encadenar càrregues');
   for(const [id,t] of ready){timers.delete(id);t.fn();}flush();
  }
 };
 ctx.mountCalendarScroll(null);flush();advance(200);
 return {ctx,advance,flush,touch:()=>dispatch('touchstart'),release:()=>dispatch('touchend'),
  scroll(delta){nativeTop(rawTop+delta);flush();},metrics:()=>({mutations,writes,count:panels.length}),
  anchor:()=>({...ctx.monthPosition()}),stop:()=>ctx.stopCalendarScroll()};
}
test('inèrcia: no carrega mesos ni escriu scrollTop durant el gest o la desacceleració',()=>{
 const c=inertialController();const before=c.metrics();
 c.touch();
 for(let i=0;i<12;i++){c.scroll(35);c.advance(16);}
 c.advance(1000); // Mantenir el dit quiet tampoc no permet mutacions.
 assert.deepEqual(c.metrics(),before);
 c.release();
 for(let i=0;i<12;i++){c.scroll(20);c.advance(16);}
 assert.deepEqual(c.metrics(),before);
 const anchor=c.anchor();c.advance(200);
 assert.deepEqual(c.anchor(),anchor,'La càrrega en repòs conserva exactament el mes i la posició');
});
test('scroll real: carregar i retirar panells no inicia salts ni nous cicles automàtics',()=>{
 const c=inertialController();
 for(const direction of [1,-1])for(let step=0;step<40;step++){
  c.touch();c.scroll(direction*600);c.release();
  const anchor=c.anchor();c.advance(200);
  assert.deepEqual(c.anchor(),anchor,'El contingut visible no es mou quan es carrega o retira un mes');
  assert.ok(c.metrics().count<=9);
  const stable={anchor:c.anchor(),metrics:c.metrics()};
  c.advance(10000);
  assert.deepEqual({anchor:c.anchor(),metrics:c.metrics()},stable,'Sense gest nou no hi ha cap salt ni càrrega addicional');
 }
});
test('sortir del calendari cancel·la la càrrega pendent',()=>{
 const c=inertialController();c.scroll(600);const before=c.metrics();c.stop();c.advance(1000);
 assert.deepEqual(c.metrics(),before);
});
