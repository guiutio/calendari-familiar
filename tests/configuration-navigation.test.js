import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const section=(a,b)=>{
 const start=source.indexOf(a),end=source.indexOf(b,start);
 assert.ok(start>=0&&end>start,a);
 return source.slice(start,end);
};
function setup(){
 let html='',paints=0;const scrolls=[];
 const main={dataset:{},scrollTop:0};
 const state={preferences:{theme:'auto',fontSize:'normal'}};
 const ctx=vm.createContext({tab:'calendar',calendarView:'month',selectedDate:'2026-11-03',schoolNav:{},sheet:null,state,
  icon:()=>'<svg></svg>',escapeHtml:String,storageMode:'indexeddb',APP_VERSION:'test',
  validTheme:value=>value,validFontSize:value=>value,FONT_SIZE_LABELS:{normal:'Normal'},FONT_SIZE_OPTIONS:['normal','large','xlarge'],
  calendarNavigation:()=>'<header class="calendar-sticky-bar">Calendari</header>',
  calendarPage:()=>'<h1>Calendari</h1>',peoplePage:()=>'<h1>Persones</h1>',rotationPage:()=>'<h1>Rotacions</h1>',schoolsPage:()=>'<h1>Escoles</h1>',
  deferRenderForNativePicker:()=>false,monthPosition:()=>null,stopCalendarScroll:null,mountCalendarScroll:()=>{},
  parseDate:value=>new Date(value+'T12:00:00'),weekStart:value=>value,fitCalendarTimeline:()=>{},
  window:{scrollTo:options=>scrolls.push(options)},document:{body:{style:{overflow:''}}},
  $app:{querySelector:selector=>selector==='.main-area'?main:null,set innerHTML(value){html=value;paints++;}}
 });
 vm.runInContext(section('function navButton(', 'function calendarNavigation(')+section('function layout(', 'function monthPanel(')+
  section('function settingsPage()', 'function returnFromDetail(')+section('function render()', 'function notify(')+
  section('function changeTab(', 'function chooseGuardian(')+section('function clickAction(button)',"document.addEventListener('click'"),ctx);
 return {ctx,state,scrolls,get html(){return html;},get paints(){return paints;}};
}
const navTargets=(html,kind)=>{
 const nav=html.match(new RegExp('<nav class="'+kind+'"[^>]*>([\\s\\S]*?)</nav>'))[1];
 return [...nav.matchAll(/data-(?:tab|view)="([^"]+)"/g)].map(match=>match[1]);
};

test('Configuració conserva les quatre àrees i la navegació inclou les quatre vistes del calendari',()=>{
 const s=setup();s.ctx.changeTab('settings');
 assert.deepEqual(navTargets(s.html,'side-nav'),['year','month','week','day','settings']);
 assert.deepEqual(navTargets(s.html,'mobile-tabs'),['year','month','week','day','settings']);
 assert.deepEqual([...s.html.matchAll(/settings-area-link[^>]+data-tab="([^"]+)"/g)].map(match=>match[1]),['general','people','rotation','schools']);
 assert.deepEqual([...s.html.matchAll(/settings-area-copy"><strong>([^<]+)/g)].map(match=>match[1]),['General','Persones','Rotacions','Escoles']);
 assert.doesNotMatch(s.html,/>Ajustos<|settings-back/);
});

test('cada àrea té retorn a Configuració i General conserva els ajustos sense canviar dades ni el calendari',()=>{
 const s=setup();
 for(const [area,title] of [['general','General'],['people','Persones'],['rotation','Rotacions'],['schools','Escoles']]){
  s.ctx.changeTab(area);
  assert.match(s.html,new RegExp('<h1[^>]*>'+title+'</h1>'));
  assert.match(s.html,/settings-back" data-action="tab" data-tab="settings"/);
  assert.match(s.html,/class="mobile-tab active" data-action="tab" data-tab="settings" aria-current="page"/);
  if(area==='general'){
   for(const action of ['set-theme','font-size','check-update','export','import','clear-all'])assert.ok(s.html.includes('data-action="'+action+'"'),action);
   assert.match(s.html,/IndexedDB · desat automàtic/);
  }
  s.ctx.changeTab('settings');assert.match(s.html,/Àrees de configuració/);
 }
 s.ctx.changeTab('calendar');
 assert.match(s.html,/class="mobile-tab active" data-action="calendar-view" data-view="month" aria-current="page"/);
 assert.doesNotMatch(s.html,/settings-back/);
 assert.equal(s.ctx.calendarView,'month');assert.equal(s.ctx.selectedDate,'2026-11-03');
 assert.equal(s.ctx.state,s.state);assert.equal(s.ctx.sheet,null);
 assert.ok(s.scrolls.every(options=>options.top===0));
});

test('els botons de vista tornen al calendari des de Configuració, també quan la vista no canvia',()=>{
 const s=setup();
 for(const area of ['settings','general','people','rotation','schools'])for(const view of ['year','month','week','day']){
  s.ctx.changeTab(area);s.ctx.calendarView=view;s.ctx.sheet={type:'filters'};
  s.ctx.clickAction({dataset:{action:'calendar-view',view}});
  assert.equal(s.ctx.tab,'calendar');assert.equal(s.ctx.calendarView,view);assert.equal(s.ctx.sheet,null);
  assert.equal(s.ctx.selectedDate,'2026-11-03');assert.equal(s.ctx.viewYear,2026);assert.equal(s.ctx.viewMonth,10);
  assert.match(s.html,new RegExp('class="mobile-tab active" data-action="calendar-view" data-view="'+view+'" aria-current="page"'));
  assert.equal((s.html.match(/class="mobile-tab active"/g)||[]).length,1);
  const paints=s.paints;s.ctx.clickAction({dataset:{action:'calendar-view',view}});assert.equal(s.paints,paints);
 }
 s.ctx.clickAction({dataset:{action:'calendar-view',view:'year'}});
 assert.equal(s.ctx.calendarView,'year');assert.equal(s.ctx.selectedDate,'2026-11-03');
 s.ctx.clickAction({dataset:{action:'calendar-view',view:'invalid'}});assert.equal(s.ctx.calendarView,'year');
});
