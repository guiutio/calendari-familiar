import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js');
const section=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
function setup(){
 let paints=0;
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-02T12:00:00Z']));}}
 const children=[{id:'a',name:'A'},{id:'b',name:'B'}],guardians=[{id:'g1',name:'Tutor 1',color:'#112233'},{id:'g2',name:'Tutor 2',color:'#445566'}];
 const state={children,guardians,schools:[],daySlots:{},bandOverrides:{},overrides:{},nightDateTimes:{},extraExceptions:{},
  extraRotations:children.map((c,i)=>({id:'n'+i,kind:'night',name:'Nit '+i,startDate:'2026-01-01',length:1,startTime:'19:00',childIds:[c.id],assignments:{[c.id]:['g'+(i+1)]},activeDays:[true]})),
  preferences:{visibleChildren:['a','b'],visibleGuardians:['g1','g2'],visibleSchools:[]}};
 const ctx=vm.createContext({Date:Clock,window:{},state,calendarView:'year',viewYear:2026,viewMonth:10,selectedDate:'2026-11-02',
  monthRange:null,yearRange:null,monthScrollTarget:true,tab:'calendar',sheet:null,
  months:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],
  weekdays:['Dl','Dt','Dc','Dj','Dv','Ds','Dg'],weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'],
  guardian:id=>guardians.find(g=>g.id===id),schoolActivities:()=>[],extraSlots:()=>[],icon:()=>'',
  activeChildren:()=>children.filter(c=>state.preferences.visibleChildren.includes(c.id)),
  render:()=>paints++,
  weekStart:date=>date,schoolInfoForDay:()=>'',dayTimeline:()=>'',weekTimeline:()=>'',
  timelineZoomForView:()=>50,setTimelineZoomForView:assert.fail});
 for(const file of ['rotation-patterns.js','month-day-ui.js','day-timeline.js'])vm.runInContext(read(file),ctx);
 Object.assign(ctx,{rotationPatterns:ctx.window.rotationPatterns,monthDayUI:ctx.window.monthDayUI,dayTimelineUI:ctx.window.dayTimelineUI});
 vm.runInContext(section('function escapeHtml(', 'function emptyState(')+
  section('function nightChangeTime(', 'function overridden(')+section('function monthData(', 'function dayTimeline(')+
  section('function periodTitle()', 'function navButton(')+section('function calendarNavigation()', 'function layout(')+
  section('function yearOverview(', 'function rotationPage(')+section('function clickAction(button)',"document.addEventListener('click'"),ctx);
 const click=(action,data={})=>ctx.clickAction({dataset:{action,...data}});
 return {ctx,state,children,click,get paints(){return paints;}};
}

test('Mes no inclou cap capçalera de Calendari Familiar que pugui aparèixer durant el scroll',()=>{
 const s=setup();s.ctx.calendarView='month';
 s.ctx.monthPanel=index=>`<section class="month-panel" data-month-index="${index}"></section>`;
 const html=s.ctx.calendarPage();
 assert.match(html,/class="month-sequence"/);
 assert.equal((html.match(/class="month-panel"/g)||[]).length,7);
 assert.doesNotMatch(html,/Calendari Familiar|page-heading|page-title|EL TEU CALENDARI|Miniatures proporcionals/);
});

test('l’any mostra dotze mesos, totes les dates una sola vegada i sis files per mes',()=>{
 const s=setup(),html=s.ctx.yearOverview(2026,s.children,'2026-11-02');
 assert.equal((html.match(/data-action="show-calendar-month"/g)||[]).length,12);
 const dates=[...html.matchAll(/data-year-date="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(dates.length,365);assert.equal(new Set(dates).size,365);
 assert.equal(dates[0],'2026-01-01');assert.equal(dates.at(-1),'2026-12-31');
 assert.equal((html.match(/class="year-empty-day"/g)||[]).length,12*42-365);
 assert.equal((html.match(/class="year-day today"/g)||[]).length,1);
 assert.equal((html.match(/class="year-month current-month"/g)||[]).length,1);
 assert.match(html,/class="year-month current-month"[^>]+data-year="2026" data-month="10"/);
 assert.match(html,/class="year-day today" data-year-date="2026-11-02" aria-current="date"/);
 assert.match(html,/aria-label="Obre novembre de 2026"/);
 assert.doesNotMatch(html,/year-weekdays/);
 assert.match(html,/class="year-days" aria-hidden="true"><span class="year-empty-day"><\/span><span class="year-empty-day"><\/span><span class="year-empty-day"><\/span><span class="year-day [^"]*" data-year-date="2026-01-01"/);
});

test('febrer de traspàs apareix correctament i la vista funciona sense fills',()=>{
 const s=setup(),html=s.ctx.yearOverview(2028,[],'2026-11-02');
 assert.equal((html.match(/data-year-date=/g)||[]).length,366);
 assert.match(html,/data-year-date="2028-02-29"/);
 assert.doesNotMatch(html,/current-month|aria-current="date"/);
 assert.equal((html.match(/data-action="show-calendar-month"/g)||[]).length,12);
 assert.doesNotMatch(html,/class="month-mini/);
});

test('la vista anual comparteix les miniatures i respecta fills i tutors ocults',()=>{
 const s=setup();
 let html=s.ctx.yearOverview(2026,s.ctx.activeChildren(),'2026-11-02');
 assert.match(html,/#112233/);assert.match(html,/#445566/);assert.match(html,/--month-children:2/);
 s.state.preferences.visibleGuardians=['g1'];
 html=s.ctx.yearOverview(2026,s.ctx.activeChildren(),'2026-11-02');assert.match(html,/#112233/);assert.doesNotMatch(html,/#445566/);
 s.state.preferences.visibleChildren=['b'];
 html=s.ctx.yearOverview(2026,s.ctx.activeChildren(),'2026-11-02');
 assert.match(html,/--month-children:1/);assert.doesNotMatch(html,/#112233|#445566/);
});

test('l’escola ocupa menys espai a Any i les hores nocturnes guanyen visibilitat sense alterar Mes',()=>{
 const s=setup();s.ctx.schoolActivities=()=>[{childId:'a',start:540,end:1020,color:'#998877',schoolName:'Escola'}];
 const snapshot=s.ctx.monthData('2026-11-02',s.children);
 const monthly=s.ctx.monthDayUI.mini(s.children,snapshot.nights,snapshot.activities,snapshot.slots,snapshot.extra);
 const annual=s.ctx.yearOverview(2026,s.children,'2026-11-02');
 const schoolHeight=html=>Number(html.match(/class="month-mini-school" style="top:[^;]+;height:([\d.]+)%/)[1]);
 assert.ok(schoolHeight(monthly)>40,'Mes conserva la seva escala diürna');
 assert.ok(Math.abs(schoolHeight(annual)-100/6)<0.001,'Una escola de 09 a 17 ocupa només una sisena part de la barra anual');
 assert.ok(schoolHeight(annual)<schoolHeight(monthly)/2);
 assert.ok(annual.includes('month-mini year-scale'));
 assert.equal(s.ctx.monthDayUI.miniGeometry(0,360,false,4).height,50,'Les primeres sis hores nocturnes ocupen mitja barra anual');
 assert.ok(s.ctx.monthDayUI.miniGeometry(0,360).height<10,'L’escala mensual de nit continua comprimida');
});

test('les franges nocturnes especials no tornen a ampliar l’escola a Any i mantenen la regla de Mes',()=>{
 const s=setup();s.ctx.schoolActivities=()=>[{childId:'a',start:540,end:1020,color:'#998877',schoolName:'Escola'}];
 s.state.daySlots['2026-11-02|a']=[{id:'late',startTime:'00:00',endTime:'02:00',guardianId:'g1'}];
 const snapshot=s.ctx.monthData('2026-11-02',s.children);
 const monthly=s.ctx.monthDayUI.mini(s.children,snapshot.nights,snapshot.activities,snapshot.slots,snapshot.extra);
 const annual=s.ctx.monthDayUI.mini(s.children,snapshot.nights,snapshot.activities,snapshot.slots,snapshot.extra,'year');
 assert.ok(monthly.includes('month-mini night-expanded'));
 assert.ok(annual.includes('month-mini year-scale'));
 const height=Number(annual.match(/class="month-mini-school" style="top:[^;]+;height:([\d.]+)%/)[1]);
 assert.ok(Math.abs(height-100/6)<0.001);
 assert.ok(annual.includes('month-mini-custom'),'La franja especial es conserva a la miniatura');
});

test('Any conserva els controls de navegació i mostra els títols dins del calendari',()=>{
 const s=setup(),html=s.ctx.calendarNavigation(),controls=s.ctx.calendarControls();
 assert.equal(s.ctx.periodTitle(),'2026');
 assert.equal(html,'');
 assert.match(s.ctx.yearPanel(2026,[],'2026-11-02'),/<h2 class="year-section-title" data-current-period>2026<\/h2>/);
 assert.match(controls,/aria-label="Any anterior"/);assert.match(controls,/aria-label="Any següent"/);
 assert.doesNotMatch(controls,/data-action="open-zoom"/);
 s.ctx.navigateCalendar(1);assert.equal(s.ctx.viewYear,2027);assert.equal(s.ctx.selectedDate,'2027-11-02');
 s.ctx.navigateCalendar(-1);assert.equal(s.ctx.viewYear,2026);
 s.click('open-zoom');assert.equal(s.ctx.sheet,null);
 s.click('timeline-zoom-step',{step:'1'});assert.equal(s.ctx.sheet,null);
});

test('avançar d’any tracta el 29 de febrer i respecta els límits dels anys admesos',()=>{
 const s=setup();s.ctx.viewYear=2028;s.ctx.selectedDate='2028-02-29';
 s.ctx.navigateCalendar(1);assert.equal(s.ctx.selectedDate,'2029-02-28');assert.equal(s.ctx.viewMonth,1);
 s.ctx.viewYear=9999;s.ctx.selectedDate='9999-02-28';s.ctx.navigateCalendar(1);assert.equal(s.ctx.viewYear,9999);
});

test('tocar un mes obre Mes en l’any i mes correctes i Avui torna a l’any actual',()=>{
 const s=setup();s.click('show-calendar-month',{year:'2028',month:'1'});
 assert.equal(s.ctx.calendarView,'month');assert.equal(s.ctx.viewYear,2028);assert.equal(s.ctx.viewMonth,1);
 assert.equal(s.ctx.selectedDate,'2028-02-01');assert.equal(s.ctx.monthScrollTarget,true);
 s.click('calendar-view',{view:'year'});assert.equal(s.ctx.calendarView,'year');assert.equal(s.ctx.viewYear,2028);
 s.ctx.monthScrollTarget=false;
 s.click('today');assert.equal(s.ctx.monthScrollTarget,true);assert.equal(s.ctx.calendarView,'year');assert.equal(s.ctx.viewYear,2026);assert.equal(s.ctx.selectedDate,'2026-11-02');
 const before=s.paints;
 for(const data of [{year:'bad',month:'2'},{year:'2026',month:'12'},{year:'2026',month:'-1'}])s.click('show-calendar-month',data);
 assert.equal(s.paints,before);
});

test('la pàgina anual presenta el calendari sense el títol introductori de l’app',()=>{
 const s=setup(),html=s.ctx.calendarPage();
 assert.match(html,/class="year-overview"/);assert.doesNotMatch(html,/Toca un mes per obrir-lo|class="calendar-card"|class="legend"/);
 assert.doesNotMatch(html,/EL TEU CALENDARI|class="page-title"|Vista de 24 hores/);
});

test('els filtres conserven el desplaçament encara que el scroll hagi canviat l’any visible',()=>{
 const s=setup();let main={dataset:{},scrollTop:0};
 Object.assign(s.ctx,{$app:{querySelector:selector=>selector==='.main-area'?main:null,set innerHTML(_html){main={dataset:{},scrollTop:0};}},
  document:{body:{style:{}}},schoolNav:{},layout:()=>'',monthPosition:()=>null,stopCalendarScroll:null,
  deferRenderForNativePicker:()=>false,mountCalendarScroll:()=>{}});
 vm.runInContext(section('function render()', 'function notify('),s.ctx);
 s.ctx.render();main.scrollTop=300;s.ctx.render();assert.equal(main.scrollTop,300);
 s.ctx.viewYear=2027;s.ctx.render();assert.equal(main.scrollTop,300);
});


test('Any mostra tres anys consecutius, conserva els visitats als filtres i Avui recentra l’interval',()=>{
 const s=setup();let html=s.ctx.calendarPage();
 assert.deepEqual([...html.matchAll(/data-year-index="(\d+)"/g)].map(m=>Number(m[1])),[2025,2026,2027]);
 const dates=[...html.matchAll(/data-year-date="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(dates.length,1095);assert.equal(new Set(dates).size,dates.length);
 s.ctx.yearRange={first:2020,last:2032};s.ctx.viewYear=2032;s.ctx.monthScrollTarget=false;
 html=s.ctx.calendarPage();assert.match(html,/data-year-index="2020"/);assert.match(html,/data-year-index="2032"/);
 s.click('today');html=s.ctx.calendarPage();
 assert.deepEqual([...html.matchAll(/data-year-index="(\d+)"/g)].map(m=>Number(m[1])),[2025,2026,2027]);
 for(const year of [100,9999]){
  s.ctx.viewYear=year;s.ctx.monthScrollTarget=true;html=s.ctx.calendarPage();
  const years=[...html.matchAll(/data-year-index="(\d+)"/g)].map(m=>Number(m[1]));
  assert.ok(years.every(y=>y>=100&&y<=9999));
 }
});


test('tornar a tocar el mode actiu situa Any, Mes, Setmana i Dia en el període actual',()=>{
 for(const view of ['year','month','week','day']){
  const s=setup();Object.assign(s.ctx,{calendarView:view,viewYear:2028,viewMonth:1,selectedDate:'2028-02-29',monthScrollTarget:false,sheet:{type:'filters'}});
  s.click('calendar-view',{view});
  assert.equal(s.ctx.calendarView,view);
  assert.equal(s.ctx.selectedDate,'2026-11-02');
  assert.equal(s.ctx.viewYear,2026);assert.equal(s.ctx.viewMonth,10);
  assert.equal(s.ctx.monthScrollTarget,true);assert.equal(s.ctx.sheet,null);assert.equal(s.paints,1);
  s.ctx.monthScrollTarget=false;
  s.click('calendar-view',{view});
  assert.equal(s.ctx.monthScrollTarget,true);assert.equal(s.paints,2);
 }
});

test('canviar de mode o tornar des de Configuració conserva la data seleccionada',()=>{
 for(const view of ['year','month','week','day']){
  for(const fromSettings of [false,true]){
   const s=setup();Object.assign(s.ctx,{calendarView:fromSettings?view:view==='day'?'month':'day',tab:fromSettings?'settings':'calendar',selectedDate:'2028-02-29'});
   s.click('calendar-view',{view});
   assert.equal(s.ctx.tab,'calendar');assert.equal(s.ctx.calendarView,view);
   assert.equal(s.ctx.selectedDate,'2028-02-29');assert.equal(s.ctx.viewYear,2028);assert.equal(s.ctx.viewMonth,1);
  }
 }
});
