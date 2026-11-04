import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
function controller({mobile=true,native=true,year=2026,headings=false}={}){
 let panels=[],top=0,writes=0,changes=0,serial=0,clock=0;
 const events=[],frames=new Map(),timers=new Map(),mainEvents=new Map(),windowEvents=new Map();
 const height=y=>1080+(y%3)*90;
 const max=()=>Math.max(0,32+panels.reduce((n,p)=>n+height(p.year),0)-700);
 const main={dataset:{},get scrollTop(){return top;},set scrollTop(v){writes++;setTop(v);},
  getBoundingClientRect:()=>({top:100,bottom:800}),
  addEventListener:(n,f)=>mainEvents.set(n,f),removeEventListener:n=>mainEvents.delete(n)};
 const queueScroll=()=>events.push(()=> (mobile?mainEvents:windowEvents).get('scroll')?.());
 const setTop=v=>{const next=Math.max(0,Math.min(max(),v));if(next!==top){top=next;queueScroll();}};
 if(native)main.onscrollend=null;
 const panel=y=>({year:y,dataset:{yearIndex:String(y)},
  getBoundingClientRect(){const start=132+panels.slice(0,panels.indexOf(this)).reduce((n,p)=>n+height(p.year),0)-top;return {top:start,bottom:start+height(y)};},
  querySelectorAll(){return Array.from({length:12},(_,month)=>({dataset:{focusDate:`${String(y).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-01`},
   getBoundingClientRect:()=>({top:this.getBoundingClientRect().top+40+Math.floor(month/2)*170,bottom:this.getBoundingClientRect().top+40+(Math.floor(month/2)+1)*170})}));},
  querySelector(selector){
   if(y===2026&&selector==='.year-month.current-month')return this.querySelectorAll()[10];
   if(headings&&selector==='.year-section-title')return {getBoundingClientRect:()=>({top:this.getBoundingClientRect().top,bottom:this.getBoundingClientRect().top+28})};
   if(headings&&selector==='.year-overview')return {getBoundingClientRect:()=>({top:this.getBoundingClientRect().top+40,bottom:this.getBoundingClientRect().bottom})};
   return null;
  }
 });
 const first=Math.max(100,year-1),last=Math.min(9999,year+1);
 panels=Array.from({length:last-first+1},(_,i)=>panel(first+i));
 const title={textContent:''},bar={getBoundingClientRect:()=>({bottom:100}),querySelector:()=>title};
 const sequence={isConnected:true,querySelectorAll:()=>panels,
  querySelector:selector=>panels.find(p=>selector.includes('"'+p.year+'"')),
  get firstElementChild(){return panels[0];},get lastElementChild(){return panels.at(-1);},
  insertAdjacentHTML(where,html){changes++;const next=html.split(',').filter(Boolean).map(Number).map(panel);panels=where==='afterbegin'?[...next,...panels]:[...panels,...next];}
 };
 const win={innerHeight:800,get scrollY(){return top;},matchMedia:()=>({matches:mobile}),
  scrollTo:(_,v)=>{writes++;setTop(v);},scrollBy:(_,v)=>{writes++;setTop(top+v);},
  addEventListener:(n,f)=>windowEvents.set(n,f),removeEventListener:n=>windowEvents.delete(n),
  requestAnimationFrame:f=>{frames.set(++serial,f);return serial;},cancelAnimationFrame:id=>frames.delete(id),
  setTimeout:(f,delay)=>{timers.set(++serial,{f,due:clock+delay});return serial;},clearTimeout:id=>timers.delete(id)};
 if(native&&!mobile)win.onscrollend=null;
 const ctx=vm.createContext({$app:{querySelector:s=>s==='.main-area'?main:s==='.year-sequence'?sequence:s==='.calendar-sticky-bar'?bar:null},
  window:win,tab:'calendar',calendarView:'year',viewYear:year,viewMonth:10,selectedDate:`${String(year).padStart(4,'0')}-11-02`,monthScrollTarget:true,
  yearRange:{first,last},stopCalendarScroll:null,activeChildren:()=>[],localDate:d=>d.toISOString().slice(0,10),parseDate:d=>new Date(d+'T12:00:00Z'),
  yearPanel:y=>y+',',periodTitle:()=>String(ctx.viewYear)});
 vm.runInContext(section('function monthPosition()', 'function zoomControls('),ctx);
 function flush(){for(let i=0;i<30&&(events.length||frames.size);i++){
  const queue=events.splice(0);for(const f of queue)f();const current=[...frames.values()];frames.clear();for(const f of current)f();
 }}
 const fire=n=>(mobile?mainEvents:windowEvents).get(n)?.();
 const end=()=>{fire('scrollend');flush();};
 const advance=ms=>{clock+=ms;for(const [id,t] of [...timers])if(t.due<=clock){timers.delete(id);t.f();}flush();};
 ctx.mountCalendarScroll(null,true);flush();
 return {ctx,main,title,panels:()=>panels,metrics:()=>({top,writes,changes}),flush,end,advance,
  fire:n=>mainEvents.get(n)?.(),scroll:v=>{setTop(v);flush();},
  go(y,offset=0){const p=panels.find(p=>p.year===y);assert.ok(p,'Any carregat: '+y);setTop(top+p.getBoundingClientRect().top-100+offset);flush();},
  remount(){const anchor=ctx.monthPosition();ctx.stopCalendarScroll();top=0;ctx.mountCalendarScroll(anchor,false);flush();},
  focus(){ctx.stopCalendarScroll();ctx.viewYear=2026;ctx.viewMonth=10;ctx.selectedDate='2026-11-02';ctx.monthScrollTarget=true;ctx.mountCalendarScroll(ctx.monthPosition());flush();}
 };
}

test('Any enfoca el mes actual en mòbil i escriptori i Avui el recupera després del scroll',()=>{
 for(const mobile of [true,false]){
  const c=controller({mobile});
  const current=()=>c.panels().find(p=>p.year===2026).querySelector('.year-month.current-month');
  assert.equal(current().getBoundingClientRect().top,100);
  c.go(2027);c.end();assert.equal(c.ctx.viewYear,2027);assert.equal(c.title.textContent,'2027');
  c.focus();assert.equal(current().getBoundingClientRect().top,100);
  assert.equal(c.ctx.monthScrollTarget,false);
 }
});

test('Any recorre dues dècades en ambdues direccions, conserva els anys i sincronitza la barra',()=>{
 const c=controller(),original=c.panels().find(p=>p.year===2026);
 for(let year=2027;year<=2046;year++){
  c.go(year);c.end();assert.equal(c.ctx.viewYear,year);assert.equal(c.title.textContent,String(year));
  assert.equal(c.ctx.selectedDate.slice(0,4),String(year));
 }
 for(let year=2045;year>=2006;year--){c.go(year);c.end();assert.equal(c.ctx.viewYear,year);}
 assert.equal(c.panels().find(p=>p.year===2026),original);
 const years=c.panels().map(p=>p.year);assert.equal(new Set(years).size,years.length);
 assert.ok(years.every((y,i)=>i===0||y===years[i-1]+1));
});

test('Any no afegeix anys ni compensa el scroll durant el gest o la inèrcia',()=>{
 const c=controller();c.fire('touchstart');c.go(2027,400);
 const before=c.metrics();c.advance(3000);assert.deepEqual(c.metrics(),before);
 c.fire('touchend');c.advance(3000);assert.deepEqual(c.metrics(),before,'Espera el scrollend nadiu');
 c.end();assert.ok(c.metrics().changes>before.changes);assert.equal(c.metrics().top,before.top);
 assert.equal(c.metrics().writes,before.writes,'Afegir anys al final no reajusta la posició');
});

test('afegir un any anterior conserva el mateix mes i posició, també després de repintar filtres',()=>{
 const c=controller();c.go(2025,200);const anchor=c.ctx.monthPosition();c.end();
 const after=c.ctx.monthPosition();assert.equal(after.index,anchor.index);assert.equal(after.top,anchor.top);assert.equal(after.date,anchor.date);
 assert.ok(c.panels().some(p=>p.year===2024));
 const position=c.ctx.monthPosition();c.remount();assert.deepEqual(JSON.parse(JSON.stringify(c.ctx.monthPosition())),JSON.parse(JSON.stringify(position)));
});

test('Any també carrega anys sense scrollend i cancel·la feina pendent en sortir',()=>{
 const c=controller({native:false});c.go(2027,400);const before=c.metrics();
 c.advance(399);assert.equal(c.metrics().changes,before.changes);
 c.advance(1);assert.ok(c.metrics().changes>before.changes);
 c.go(2028,400);c.ctx.stopCalendarScroll();const stopped=c.metrics();c.advance(1000);c.end();
 assert.deepEqual(c.metrics(),stopped);
});

test('Any respecta els límits de dates en carregar anys anteriors i posteriors',()=>{
 for(const year of [100,9999]){
  const c=controller({year});c.go(year,year===100?0:700);c.end();
  assert.ok(c.panels().every(p=>p.year>=100&&p.year<=9999));
 }
});


test('Any amaga el títol en entrar en un any diferent i quan la inèrcia deixa el títol repetit',()=>{
 for(const mobile of [true,false]){
  const c=controller({mobile,year:2027,headings:true});
  const body=y=>c.panels().find(p=>p.year===y).querySelector('.year-overview');
  assert.equal(body(2027).getBoundingClientRect().top,100);
  for(const year of [2028,2026]){
  c.fire('touchstart');c.go(year,10);c.fire('touchend');
  const before=c.metrics();assert.equal(body(year).getBoundingClientRect().top,130);
  c.advance(2000);assert.deepEqual(c.metrics(),before);
  c.end();assert.equal(body(year).getBoundingClientRect().top,100);
  assert.equal(c.metrics().writes,before.writes+(year===2026?2:1));
  const stable=c.metrics();c.end();c.advance(10000);assert.deepEqual(c.metrics(),stable);
  }
 }
});
