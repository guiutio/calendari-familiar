import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function part(start, end) {
  const first = js.indexOf(start);
  const last = js.indexOf(end, first + start.length);
  assert.ok(first >= 0 && last > first, `No s'ha trobat el bloc ${start}`);
  return js.slice(first, last);
}
// El MVP és un script global. Aïllem el validador sense executar el navegador.
const cleanSchools = new Function(
  part('const SESSION_KINDS', 'const BANDS') +
  part('function localDate(', 'const DEMO_START_DATE') +
  part('const SCHOOL_PALETTE', 'function cleanState(') +
  '\nreturn cleanSchools;'
)();

const children = [{id:'elna', name:'Elna', birthDate:''}];
function example() {
  return {id:'escola',name:'Escola',address:'',phone:'',years:[{
    id:'curs',startDate:'2026-09-01',endDate:'2027-06-30',
    holidays:[],reducedDays:[],groups:[{
      id:'primer',name:'Primer',tutorName:'',childIds:['elna'],
      weeklySchedule:[{id:'matí',weekday:0,startTime:'09:00',endTime:'10:00',label:'Matemàtiques'}]
    }]
  }]};
}

test('migració dels horaris de la 0.1.8', () => {
  const migrated = cleanSchools([example()],children);
  const group = migrated[0].years[0].groups[0];
  assert.equal(group.weeklySchedule[0].kind,'classe');
  assert.deepEqual(group.childSchedules,{});
});

test('els horaris particulars es conserven independentment del grup', () => {
  const school = example();
  school.years[0].groups[0].childSchedules = {elna:[
    {id:'dinar',weekday:0,startTime:'12:00',endTime:'13:00',label:'',kind:'menjador'}
  ]};
  const group = cleanSchools([school],children)[0].years[0].groups[0];
  assert.equal(group.childSchedules.elna[0].kind,'menjador');
  assert.equal(group.weeklySchedule[0].startTime,'09:00');
});

test('es rebutgen franges solapades dins del mateix horari', () => {
  const school = example();
  school.years[0].groups[0].weeklySchedule.push({
    id:'segona',weekday:0,startTime:'09:30',endTime:'10:30',label:''
  });
  assert.throws(()=>cleanSchools([school],children),/solapades/);
});

test('no s’accepten horaris de fills no matriculats', () => {
  const school = example();
  school.years[0].groups[0].childSchedules = {blai:[]};
  assert.throws(()=>cleanSchools([school],children),/no pertany/);
});

test('no s’accepten categories d’activitat desconegudes', () => {
  const school = example();
  school.years[0].groups[0].weeklySchedule[0].kind = 'inexistent';
  assert.throws(()=>cleanSchools([school],children),/incorrecte/);
});
