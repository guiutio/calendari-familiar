import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=app.indexOf('function calendarNavigation('),end=app.indexOf('function layout(',start);
const dateHelpers=app.slice(app.indexOf('function localDate('),app.indexOf('function initial('))+
 app.slice(app.indexOf('function weekStart('),app.indexOf('function fullAgenda('));
const labels={year:'2026',month:'novembre 2026',week:'2 de Novembre – 8 de Novembre',day:'4 de Novembre'};
for(const view of Object.keys(labels))test(`${view}: títol a dalt, eines a l’esquerra i anterior/Avui/següent a la dreta`,()=>{
 const ctx=vm.createContext({calendarView:view,viewYear:2026,viewMonth:10,selectedDate:view==='week'?'2026-11-02':'2026-11-04',sheet:null,activeChildren:()=>[],
  Date:class extends Date {constructor(...args){super(...(args.length?args:[2026,10,4,12]));}},
  state:{children:[],guardians:[],schools:[],preferences:{visibleGuardians:[],visibleSchools:[]}},
  icon:()=>'',escapeHtml:String,periodTitle:()=>labels[view],timelineZoomForView:()=>50,
  weekdays:['Dl','Dt','Dc','Dj','Dv','Ds','Dg']});
 vm.runInContext(dateHelpers+app.slice(start,end),ctx);
 const title=ctx.calendarNavigation(),controls=ctx.calendarControls();
 assert.ok(title.includes(`<div class="calendar-title" data-current-period>${labels[view]}</div>`));
 if(view==='year')ctx.viewYear=2027;
 if(view==='month')ctx.viewMonth=11;
 if(view==='week')ctx.selectedDate='2026-11-09';
 if(view==='day')ctx.selectedDate='2026-11-03';
 assert.doesNotMatch(ctx.calendarNavigation(),/data-current-period/);
 assert.doesNotMatch(title,/<button|data-action=/);
 assert.equal(title.includes('class="weekdays"'),view==='month');
 const tools=controls.match(/class="calendar-tools">([\s\S]*?)<\/div>/)[1];
 const period=controls.match(/class="calendar-nav calendar-period-nav">([\s\S]*?)<\/div>/)[1];
 assert.deepEqual([...tools.matchAll(/data-action="([^"]+)"/g)].map(match=>match[1]),
  ['open-filters','open-legend',...(view==='day'?['open-day-edit']:[]),...(['day','week'].includes(view)?['open-zoom']:[])]);
 assert.deepEqual([...period.matchAll(/data-action="([^"]+)"(?: data-step="([^"]+)")?/g)].map(match=>[match[1],match[2]]),
  [['calendar-navigate','-1'],['today',undefined],['calendar-navigate','1']]);
 assert.doesNotMatch(tools,/data-action="today"|data-action="calendar-navigate"/);
});
