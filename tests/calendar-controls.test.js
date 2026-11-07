import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function calendarNavigation('),end=app.indexOf('function layout(',start);
const dateHelpers=app.slice(app.indexOf('function localDate('),app.indexOf('function initial('))+
 app.slice(app.indexOf('function weekStart('),app.indexOf('function fullAgenda('));
const labels={year:'',month:'',week:'2 de Novembre – 8 de Novembre'};
for(const view of Object.keys(labels))test(`${view}: capçalera corresponent i controls de navegació`,()=>{
 const ctx=vm.createContext({calendarView:view,viewYear:2026,selectedDate:view==='week'?'2026-11-02':'2026-11-04',sheet:null,activeChildren:()=>[],
  Date:class extends Date {constructor(...args){super(...(args.length?args:[2026,10,4,12]));}},
  state:{children:[],guardians:[],schools:[],preferences:{visibleGuardians:[],visibleSchools:[]}},
  icon:()=>'',escapeHtml:String,periodTitle:()=>labels[view],timelineZoomForView:()=>50,
  months:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'],weekdays:['Dl','Dt','Dc','Dj','Dv','Ds','Dg']});
 vm.runInContext(dateHelpers+app.slice(start,end),ctx);
 const title=ctx.calendarNavigation(),controls=ctx.calendarControls();
  if(view==='month')assert.match(controls,/class="calendar-controls-year" data-calendar-year="2026" data-current-period>2026<\/span><div class="calendar-tools">/);
  else assert.doesNotMatch(controls,/calendar-controls-year/);
 if(view==='year')assert.equal(title,'');
 else if(view==='month'){
  assert.match(title,/<div class="weekdays"><span class="week-strip-label">dl\.<\/span>.*<span class="week-strip-label">dg\.<\/span>/);
  assert.doesNotMatch(title,/calendar-title|calendar-toolbar/);
 }
 else {
  assert.match(title,/week-day-strip/);
  assert.equal((title.match(/data-action="focus-week-day"/g)||[]).length,7);
  assert.match(title,/week-strip-day today[^>]+data-date="2026-11-04"/);
  assert.match(title,/week-strip-label">dl\.</);
 }
 if(view==='week')ctx.selectedDate='2026-11-09';
 if(view==='day')ctx.selectedDate='2026-11-03';
 assert.doesNotMatch(ctx.calendarNavigation(),/data-current-period/);
 if(view!=='week')assert.doesNotMatch(title,/<button|data-action=/);
 assert.equal(title.includes('class="weekdays"'),view==='month');
 const tools=controls.match(/class="calendar-tools">([\s\S]*?)<\/div>/)[1];
 assert.deepEqual([...tools.matchAll(/data-action="([^"]+)"/g)].map(match=>match[1]),
  ['open-filters','open-legend',...(view==='week'?['open-day-edit']:[]),...(['day','week'].includes(view)?['open-zoom']:[])]);
 assert.doesNotMatch(controls,/data-action="today"|data-action="calendar-navigate"|calendar-period-nav/);
});

// La posició dels dies ha de coincidir exactament entre les capçaleres Mes i Setmana.
test('Mes i Setmana comparteixen les coordenades de les abreviatures dels dies',()=>{
  const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
  const rule=(selector)=>{
    const start=css.lastIndexOf(selector);
    assert.ok(start>=0,'Regla CSS no trobada: '+selector);
    return css.slice(start,css.indexOf('}',start)+1);
  };
  const month=rule('.calendar-layout:has(.month-sequence) .calendar-sticky-bar .weekdays {');
  const week=rule('.calendar-sticky-bar.week-day-strip {');
  const day=rule('.week-strip-day {');
  assert.ok(css.includes('.weekdays,.month-grid {grid-template-columns:repeat(7,minmax(0,1fr));}'));
  assert.ok(month.includes('width:100%;max-width:none;padding:10px 0 10px;'));
  assert.ok(week.includes('grid-template-columns:repeat(7,minmax(0,1fr));gap:0;padding:10px 0 10px;'));
  assert.ok(day.includes('padding:0;'));
});

// La capçalera del calendari té un únic grup de botons, alineat al marge dret a totes les vistes.
test('els botons de la barra superior són a la dreta en totes les vistes',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.calendar-controls \{display:flex;align-items:center;justify-content:flex-end;/);
 assert.match(css,/\.calendar-tools \{display:flex;align-items:center;gap:4px;/);
});

test('el títol de cada any s’alinea amb els títols dels mesos',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 assert.match(css,/\.year-month \{[^}]*padding:3px;/);
 assert.match(css,/\.year-section-title \{padding-inline:3px;\}/);
});

test('el títol de l’any mensual és a l’esquerra i segueix el color de l’any actual',()=>{
 const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const theme=readFileSync(new URL('../theme.css',import.meta.url),'utf8');
 assert.match(css,/\.calendar-controls:has\(\.calendar-controls-year\) \{padding-left:3px;\}/);
 assert.match(css,/\.calendar-controls-year \{margin-right:auto;/);
 assert.match(theme,/\.year-section-title,\.calendar-controls-year\)\[data-current-period\]/);
});
