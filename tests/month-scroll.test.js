import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const extract=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const dates=extract('function periodTitle()', 'function navButton(');
const dateHelpers=extract('function localDate(', 'function monthTitle(');

function controller(mobile=true){
 let frame,listen;
 const base=2026*12+9;
 const main={scrollTop:0,addEventListener:(_,f)=>listen=f,removeEventListener:()=>{},getBoundingClientRect:()=>({top:mobile?100:0,bottom:800})};
 const win={innerHeight:800,matchMedia:()=>({matches:mobile}),scrollBy:(_,delta)=>main.scrollTop+=delta,scrollTo:(_,y)=>main.scrollTop=y,requestAnimationFrame:f=>(frame=f,1),cancelAnimationFrame:()=>{},addEventListener:()=>{},removeEventListener:()=>{}};
 let panels=[];
 const panel=index=>({querySelectorAll:()=>[],dataset:{monthIndex:String(index)},getBoundingClientRect:()=>({top:200+(index-base+1)*700-main.scrollTop,bottom:900+(index-base+1)*700-main.scrollTop}),remove(){panels=panels.filter(p=>p!==this);}});
 panels=[base-1,base,base+1,base+2].map(panel);
 const title={textContent:''};
 const bar={getBoundingClientRect:()=>({bottom:100,height:100}),querySelector:()=>title};
 const sequence={isConnected:true,querySelectorAll:()=>panels,querySelector:s=>panels.find(p=>s.includes('"'+p.dataset.monthIndex+'"')),get firstElementChild(){return panels[0];},get lastElementChild(){return panels.at(-1);},insertAdjacentHTML(where,html){const next=html.split(',').map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];}};
 const $app={querySelector:s=>s==='.main-area'?main:s==='.month-sequence'?sequence:bar};
 const ctx=vm.createContext({$app,window:win,tab:'calendar',calendarView:'month',viewYear:2026,viewMonth:9,selectedDate:'2026-10-31',monthScrollTarget:true,stopCalendarScroll:null,monthRange:null,activeChildren:()=>[],localDate:d=>d.toISOString().slice(0,10),parseDate:d=>new Date(d+'T12:00:00Z'),monthPanel:i=>String(i)+',',periodTitle:()=>`${ctx.viewYear}-${ctx.viewMonth+1}`});
 // Use a delimiter only between generated panels, including appends/prepends.
 sequence.insertAdjacentHTML=(where,html)=>{const next=html.split(',').filter(Boolean).map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];};
 vm.runInContext(extract('function monthPosition()', 'function calendarPage()'),ctx);
 ctx.mountCalendarScroll(null);frame();
 return {ctx,main,title,panels:()=>panels,scroll(delta){main.scrollTop+=delta;listen();frame();},refresh(){frame();},base};
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
