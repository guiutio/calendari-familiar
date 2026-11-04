import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
function setup(){
 const ctx=vm.createContext({calendarView:'day',selectedDate:'2026-04-02',viewYear:2026,viewMonth:3,
  months:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],
  weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge']});
 vm.runInContext(section('function localDate(', 'function initial(')+section('function weekStart(', 'function fullAgenda(')+section('function periodTitle()', 'function navigateCalendar('),ctx);
 return ctx;
}
test('els dotze mesos tenen la preposició i l’apostrofació correctes als títols de dia',()=>{
 const ctx=setup();
 const expected=['2 de gener','2 de febrer','2 de març','2 d’abril','2 de maig','2 de juny','2 de juliol','2 d’agost','2 de setembre','2 d’octubre','2 de novembre','2 de desembre'];
 for(let month=0;month<12;month++){
  const date=`2026-${String(month+1).padStart(2,'0')}-02`;ctx.selectedDate=date;
  const title=expected[month].replace(ctx.months[month],ctx.months[month][0].toUpperCase()+ctx.months[month].slice(1));
  assert.equal(ctx.dayMonth(date),expected[month]);assert.equal(ctx.periodTitle(),title);
 }
 assert.equal(ctx.fullDate('2026-04-02'),'Dijous, 2 d’abril de 2026');
 assert.equal(ctx.fullDate('2026-11-04'),'Dimecres, 4 de novembre de 2026');
});
test('les setmanes utilitzen mesos sencers, també en canviar de mes i d’any',()=>{
 const ctx=setup();ctx.calendarView='week';
 for(const [date,title] of [
  ['2026-11-04','2 de Novembre – 8 de Novembre'],
  ['2026-04-01','30 de Març – 5 d’Abril'],
  ['2026-08-31','31 d’Agost – 6 de Setembre'],
  ['2026-12-31','28 de Desembre – 3 de Gener'],
  ['2028-02-29','28 de Febrer – 5 de Març']
 ]){ctx.selectedDate=date;assert.equal(ctx.periodTitle(),title);}
});
