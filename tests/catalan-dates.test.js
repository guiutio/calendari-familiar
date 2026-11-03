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
  assert.equal(ctx.dayMonth(date),expected[month]);assert.equal(ctx.periodTitle(),expected[month]);
 }
 assert.equal(ctx.fullDate('2026-04-02'),'Dijous, 2 d’abril de 2026');
 assert.equal(ctx.fullDate('2026-11-04'),'Dimecres, 4 de novembre de 2026');
});
test('les setmanes utilitzen mesos sencers, també en canviar de mes i d’any',()=>{
 const ctx=setup();ctx.calendarView='week';
 for(const [date,title] of [
  ['2026-11-04','2 de novembre – 8 de novembre'],
  ['2026-04-01','30 de març – 5 d’abril'],
  ['2026-08-31','31 d’agost – 6 de setembre'],
  ['2026-12-31','28 de desembre – 3 de gener'],
  ['2028-02-29','28 de febrer – 5 de març']
 ]){ctx.selectedDate=date;assert.equal(ctx.periodTitle(),title);}
});
