import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const dates=extract('function periodTitle()', 'function navButton(');
const dateHelpers=extract('function localDate(', 'function monthTitle(');
const currentMonth=extract('function isCurrentPeriod()', 'function calendarControls(');
class OctoberClock extends Date {
 constructor(...args){super(...(args.length?args:[2026,9,31,12]));}
}

function controller(mobile=true,headerHeight=0){
 let frame,listen,timer;
 const base=2026*12+9;
 const main={scrollTop:0,addEventListener:(name,f)=>{if(name==='scroll')listen=f;},removeEventListener:()=>{},getBoundingClientRect:()=>({top:mobile?100:0,bottom:800})};
 const win={setTimeout:f=>(timer=f,2),clearTimeout:()=>{timer=undefined;},get scrollY(){return main.scrollTop;},innerHeight:800,matchMedia:()=>({matches:mobile}),scrollBy:(_,delta)=>main.scrollTop+=delta,scrollTo:(_,y)=>main.scrollTop=y,requestAnimationFrame:f=>(frame=f,1),cancelAnimationFrame:()=>{},addEventListener:()=>{},removeEventListener:()=>{}};
 let panels=[];
 const panel=index=>({querySelector(){return {getBoundingClientRect:()=>({top:this.getBoundingClientRect().top+headerHeight})};},querySelectorAll:()=>[],dataset:{monthIndex:String(index)},getBoundingClientRect:()=>({top:200+(index-base+1)*700-main.scrollTop,bottom:900+(index-base+1)*700-main.scrollTop}),remove(){panels=panels.filter(p=>p!==this);}});
 panels=Array.from({length:7},(_,i)=>base-3+i).map(panel);
 const title={textContent:'',attributes:new Set(),toggleAttribute(name,enabled){if(enabled)this.attributes.add(name);else this.attributes.delete(name);}};
 const bar={getBoundingClientRect:()=>({bottom:100,height:100}),querySelector:()=>title};
 const sequence={isConnected:true,querySelectorAll:()=>panels,querySelector:s=>panels.find(p=>s.includes('"'+p.dataset.monthIndex+'"')),get firstElementChild(){return panels[0];},get lastElementChild(){return panels.at(-1);},insertAdjacentHTML(where,html){const next=html.split(',').map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];}};
 const $app={querySelector:s=>s==='.main-area'?main:s==='.month-sequence'?sequence:bar};
 const ctx=vm.createContext({$app,window:win,Date:OctoberClock,tab:'calendar',calendarView:'month',viewYear:2026,viewMonth:9,selectedDate:'2026-10-31',monthScrollTarget:true,stopCalendarScroll:null,monthRange:null,activeChildren:()=>[],localDate:d=>d.toISOString().slice(0,10),parseDate:d=>new Date(d+'T12:00:00Z'),monthPanel:i=>String(i)+',',periodTitle:()=>`${ctx.viewYear}-${ctx.viewMonth+1}`});
 // Use a delimiter only between generated panels, including appends/prepends.
 sequence.insertAdjacentHTML=(where,html)=>{const next=html.split(',').filter(Boolean).map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];};
 vm.runInContext(currentMonth+extract('function monthPosition()', 'function calendarPage()'),ctx);
 const flush=()=>{for(let i=0;frame&&i<10;i++){const next=frame;frame=undefined;next();}};
 const idle=()=>{const next=timer;timer=undefined;next?.();flush();};
 ctx.mountCalendarScroll(null);flush();idle();
 return {ctx,main,title,panels:()=>panels,scroll(delta){main.scrollTop+=delta;listen();flush();idle();},refresh(){flush();idle();},base};
}

test('mesos: la càrrega inicial enfoca el mes actual en mòbil i escriptori',()=>{
 for(const mobile of [true,false]){
  const c=controller(mobile);
  assert.equal(c.ctx.monthPosition().index,c.base);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.equal(c.ctx.selectedDate,'2026-10-31');
 }
});
test('mesos: recorre anys en ambdues direccions sense retirar els mesos visitats',()=>{
 const c=controller();
 for(let i=0;i<26;i++){
  c.scroll(700);
  assert.equal(c.ctx.monthPosition().index,c.base+i+1);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.ok(c.panels().some(p=>Number(p.dataset.monthIndex)===c.base),'Els mesos ja visitats no es retiren');
 }
 assert.equal(c.ctx.viewYear,2028);assert.equal(c.ctx.viewMonth,11);
 for(let i=0;i<40;i++){
  c.scroll(-700);
  assert.equal(c.ctx.monthPosition().index,c.base+25-i);
  assert.equal(c.ctx.monthPosition().top,100);
  assert.ok(c.panels().some(p=>Number(p.dataset.monthIndex)===c.base),'Els mesos ja visitats no es retiren');
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
 const c=controller();
 assert.ok(c.title.attributes.has('data-current-period'));
 c.scroll(1400);
 assert.ok(!c.title.attributes.has('data-current-period'));
 c.ctx.viewYear=2026;c.ctx.viewMonth=9;c.ctx.monthScrollTarget=true;
 c.ctx.mountCalendarScroll(c.ctx.monthPosition());c.refresh();
 assert.equal(c.ctx.monthPosition().index,c.base);
 assert.equal(c.ctx.monthPosition().top,100);
 assert.ok(c.title.attributes.has('data-current-period'));
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


test('els controls queden sobre el títol i els modes sota el contingut, fora del scroll',()=>{
 const source=extract('function layout(content)', 'function monthPanel(');
 for(const calendarView of ['month','week','day']){
  const ctx=vm.createContext({tab:'calendar',calendarView,sheet:null,APP_VERSION:'test',icon:()=>'',navButton:()=>'',calendarViewButtons:()=>'',calendarControls:()=>'<nav class="calendar-controls">Eines</nav>',calendarNavigation:()=>'<header class="calendar-sticky-bar">Controls</header>'});
  vm.runInContext(source,ctx);
  const html=ctx.layout('<section>Calendari</section>');
  assert.match(html,/<\/aside><nav class="calendar-controls">Eines<\/nav><header class="calendar-sticky-bar">Controls<\/header><main class="main-area">/);
  const main=html.slice(html.indexOf('<main'),html.indexOf('</main>'));
  assert.doesNotMatch(main,/calendar-sticky-bar|calendar-controls|mobile-tabs/);
  assert.match(html,/<\/main>\s*<nav class="mobile-tabs"/);
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
 vm.runInContext(dateHelpers+extract('function weekStart(', 'function fullAgenda(')+extract('function monthPanel(', '// Keep loaded months'),context);
 return context;
}
test('mesos consecutius: cada data apareix una vegada i les capçaleres separen els mesos',()=>{
 const ctx=continuousRenderer();
 let html='';
 for(let index=2025*12;index<2029*12;index++)html+=ctx.monthPanel(index,[],'2026-10-31');
 const dates=Array.from(html.matchAll(/data-action="show-calendar-day" data-date="([^"]+)"/g),m=>m[1]);
 const weeks=Array.from(html.matchAll(/data-action="show-calendar-week" data-date="([^"]+)"/g),m=>m[1]);
 assert.equal(new Set(dates).size,dates.length);
 for(let i=1;i<dates.length;i++)assert.equal(dates[i],ctx.addDays(dates[i-1],1));
 assert.ok(dates.includes('2028-02-29'));
 assert.equal(dates.filter(d=>d==='2026-10-31').length,1);
 assert.doesNotMatch(html,/other-month|class="weekdays"/);
 assert.equal((html.match(/class="month-section-title"/g)||[]).length,48);
 for(let index=2025*12;index<2029*12;index++){
  const year=Math.floor(index/12),month=index-year*12;
  const panel=ctx.monthPanel(index,[],'2026-10-31');
  const actual=Array.from(panel.matchAll(/data-action="show-calendar-day" data-date="([^"]+)"/g),m=>m[1]);
  const count=new Date(year,month+1,0).getDate();
  assert.equal(actual.length,count);
  assert.equal(actual[0],ctx.localDate(new Date(year,month,1,12)));
  assert.equal(actual.at(-1),ctx.localDate(new Date(year,month,count,12)));
  assert.ok(panel.indexOf('month-section-title')<panel.indexOf('show-calendar-day'));
  const offset=(new Date(year,month,1,12).getDay()+6)%7;
  assert.equal((panel.match(/class="month-empty-cell"/g)||[]).length,Math.ceil((offset+count)/7)*7-count);
 }
});
test('octubre acaba al 31 i novembre comença a l’1 amb una capçalera al mig',()=>{
 const ctx=continuousRenderer();
 const html=ctx.monthPanel(2026*12+9,[],'2026-10-31')+ctx.monthPanel(2026*12+10,[],'2026-10-31');
 const cell=date=>html.match(new RegExp('class="day-cell ([^"]+)" data-action="show-calendar-day" data-date="'+date+'"'))[1];
 assert.match(cell('2026-10-31'),/today/);
 assert.match(cell('2026-10-31'),/month-edge-bottom/);
 assert.match(cell('2026-10-31'),/month-edge-right/);
 assert.match(cell('2026-11-01'),/month-edge-top/);
 assert.match(cell('2026-11-01'),/month-edge-left/);
 assert.match(cell('2026-11-01'),/month-edge-right/);
 assert.equal((html.match(/data-action="show-calendar-day" data-date="2026-10-31"/g)||[]).length,1);
 assert.equal((html.match(/data-action="show-calendar-day" data-date="2026-11-01"/g)||[]).length,1);
 const split=html.indexOf('<h2 class="month-section-title">2026-11</h2>');
 assert.ok(html.indexOf('data-action="show-calendar-day" data-date="2026-10-31"')<split);
 assert.ok(html.indexOf('data-action="show-calendar-day" data-date="2026-11-01"')>split);
});

// Layout realista: inserir/retirar panells mou físicament els altres i pot
// limitar scrollTop; les escriptures programàtiques generen esdeveniments scroll.
function inertialController(nativeScrollEnd=false,headings=false){
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
 if(nativeScrollEnd)main.onscrollend=null;
 const panel=index=>({dataset:{monthIndex:String(index)},querySelector(selector){
  if(!headings)return null;
  if(selector==='.month-section-title')return {getBoundingClientRect:()=>({top:this.getBoundingClientRect().top,bottom:this.getBoundingClientRect().top+58})};
  if(selector==='.month-grid')return {getBoundingClientRect:()=>({top:this.getBoundingClientRect().top+58,bottom:this.getBoundingClientRect().bottom})};
  return null;
 },querySelectorAll:()=>[],
  getBoundingClientRect(){const y=300+panels.slice(0,panels.indexOf(this)).reduce((n,p)=>n+height(Number(p.dataset.monthIndex)),0)-rawTop;return {top:y,bottom:y+height(index)};},
  remove(){mutations++;panels=panels.filter(p=>p!==this);nativeTop(rawTop);}
 });
 panels=Array.from({length:7},(_,i)=>base-3+i).map(panel);
 const bar={getBoundingClientRect:()=>({bottom:100,height:100}),querySelector:()=>({textContent:'',toggleAttribute:()=>{}})};
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
 vm.runInContext(currentMonth+extract('function monthPosition()', 'function calendarPage()'),ctx);
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
 ctx.mountCalendarScroll(null);flush();advance(500);
 return {ctx,advance,flush,touch:()=>dispatch('touchstart'),release:()=>dispatch('touchend'),end:()=>{dispatch('scrollend');flush();},signalEnd:()=>dispatch('scrollend'),
  scroll(delta){nativeTop(rawTop+delta);flush();},metrics:()=>({mutations,writes,count:panels.length}),
  base,goToHeading(index,visible=30){const p=panels.find(p=>Number(p.dataset.monthIndex)===index);nativeTop(rawTop+p.getBoundingClientRect().top-(100+visible-58));flush();},
  bodyTop:index=>panels.find(p=>Number(p.dataset.monthIndex)===index).querySelector('.month-grid').getBoundingClientRect().top,
  indices:()=>panels.map(p=>Number(p.dataset.monthIndex)),anchor:()=>({...ctx.monthPosition()}),stop:()=>ctx.stopCalendarScroll()};
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
 const anchor=c.anchor();c.advance(500);
 assert.deepEqual(c.anchor(),anchor,'La càrrega en repòs conserva exactament el mes i la posició');
});
test('scroll real: carregar panells conserva la posició i no inicia nous cicles automàtics',()=>{
 const c=inertialController();
 for(const direction of [1,-1])for(let step=0;step<40;step++){
  c.touch();c.scroll(direction*600);c.release();
  const anchor=c.anchor();c.advance(500);
  assert.deepEqual(c.anchor(),anchor,'El contingut visible no es mou quan es carrega un mes');
  assert.ok(c.metrics().count>=7,'La càrrega conserva els mesos ja visitats');
  const stable={anchor:c.anchor(),metrics:c.metrics()};
  c.advance(10000);
  assert.deepEqual({anchor:c.anchor(),metrics:c.metrics()},stable,'Sense gest nou no hi ha cap salt ni càrrega addicional');
 }
});
test('sortir del calendari cancel·la la càrrega pendent',()=>{
 const c=inertialController();c.scroll(600);const before=c.metrics();c.stop();c.advance(1000);
 assert.deepEqual(c.metrics(),before);
});

test('scrollend: un silenci llarg entre esdeveniments no es confon amb el final de la inèrcia',()=>{
 const c=inertialController(true),before=c.metrics();
 c.touch();c.scroll(2300);c.release();
 c.advance(2000);
 assert.deepEqual(c.metrics(),before,'No es muta el calendari abans del final nadiu del desplaçament');
 const anchor=c.anchor();c.end();
 assert.deepEqual(c.anchor(),anchor);assert.ok(c.metrics().count>before.count);
 assert.equal(c.metrics().writes,before.writes,'Afegir mesos al final no escriu scrollTop');
});

test('scrollend: tornar enrere conserva els mateixos panells i no reajusta el rang de scroll',()=>{
 const c=inertialController(true),original=c.indices(),before=c.metrics();
 for(let i=0;i<30;i++){c.touch();c.scroll(600);c.release();c.end();}
 assert.ok(c.metrics().count>9);
 for(const index of original)assert.ok(c.indices().includes(index));
 assert.equal(c.metrics().writes,before.writes,'No hi ha compensacions en carregar mesos posteriors');
 const loaded=c.indices();
 for(let i=0;i<25;i++){c.touch();c.scroll(-600);c.release();c.end();}
 assert.deepEqual(c.indices(),loaded,'Tornar pels mesos ja carregats no retira ni reinsereix panells');
 assert.equal(c.metrics().writes,before.writes);
});

test('un nou gest o sortir de la vista cancel·la una estabilització ja programada',()=>{
 for(const stop of [false,true]){
  const c=inertialController(true);c.scroll(2300);const before=c.metrics();
  c.signalEnd();if(stop)c.stop();else c.touch();
  c.flush();c.advance(2000);assert.deepEqual(c.metrics(),before);
 }
});


test('seleccionar un mes amaga la capçalera repetida i alinea la primera setmana sota la barra',()=>{
 for(const mobile of [true,false]){
  const c=controller(mobile,58);
  const current=()=>c.panels().find(p=>Number(p.dataset.monthIndex)===c.base);
  assert.equal(current().querySelector('.month-grid').getBoundingClientRect().top,100);
  assert.equal(current().getBoundingClientRect().top,42);
  c.scroll(1400);c.ctx.viewYear=2026;c.ctx.viewMonth=9;c.ctx.monthScrollTarget=true;
  c.ctx.mountCalendarScroll(c.ctx.monthPosition());c.refresh();
  assert.equal(current().querySelector('.month-grid').getBoundingClientRect().top,100);
 }
});

test('sis setmanes caben a l’espai visible i només es recalcula la mida quan canvia',()=>{
 const context=vm.createContext({window:{innerHeight:900}});
 vm.runInContext(extract('function fitMonthRows(', 'function mountCalendarScroll('),context);
 for(const mobile of [true,false]){
  let bottom=800,top=180,value='',writes=0;
  const main={getBoundingClientRect:()=>({bottom})},bar={getBoundingClientRect:()=>({bottom:top})};
  const sequence={style:{getPropertyValue:()=>value,setProperty:(name,next)=>{assert.equal(name,'--month-week-height');value=next;writes++;}}};
  for(const available of [620,380,235,720]){
   bottom=top+available;context.window.innerHeight=bottom;
   assert.equal(context.fitMonthRows(main,sequence,bar,mobile),true);
   const usable=available;
   assert.ok(6*parseFloat(value)+7<=usable,'El mes més llarg no queda tallat');
   assert.ok(usable-(6*parseFloat(value)+7)<6,'S’aprofita l’alçada disponible');
   const count=writes;
   assert.equal(context.fitMonthRows(main,sequence,bar,mobile),false);
   assert.equal(writes,count,'El scroll no provoca reajustaments d’alçada');
  }
 }
});


test('Mes amaga el títol repetit només quan acaba la inèrcia i no inicia un bucle de scroll',()=>{
 for(const native of [true,false])for(const prepend of [false,true]){
  const c=inertialController(native,true),index=c.base+(prepend?-3:1);assert.equal(c.bodyTop(c.base),100);
  c.touch();c.goToHeading(index);c.release();
  const before=c.metrics();assert.equal(c.bodyTop(index),130);
  c.advance(native?2000:399);assert.deepEqual(c.metrics(),before);
  if(native)c.end();else c.advance(1);
  assert.equal(c.bodyTop(index),100);assert.equal(c.metrics().writes,before.writes+(prepend?2:1));
  const stable={anchor:c.anchor(),metrics:c.metrics()};c.end();c.advance(10000);
  assert.deepEqual({anchor:c.anchor(),metrics:c.metrics()},stable);
 }
});

test('un nou gest cancel·la l’ajust pendent del títol mensual',()=>{
 const c=inertialController(true,true);c.touch();c.goToHeading(c.base+1);c.release();
 const before=c.metrics();c.signalEnd();c.touch();c.flush();c.advance(2000);
 assert.equal(c.bodyTop(c.base+1),130);assert.deepEqual(c.metrics(),before);
});
