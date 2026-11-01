import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const between=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 let saves=0;const messages=[];
 const year={id:'y',startDate:'2026-09-01',endDate:'2027-06-30',holidays:['2026-09-11','2026-12-25'],reducedDays:['2027-06-21'],vacations:[{id:'v',name:'Nadal',startDate:'2026-12-22',endDate:'2027-01-07'}]};
 const school={id:'s',years:[year]};
 const ctx=vm.createContext({sheet:null,window:{},state:{schools:[school]},
  weekdays:['Dl','Dt','Dc','Dj','Dv','Ds','Dg'],weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'],
  months:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],
  schoolById:id=>id===school.id?school:undefined,yearById:(s,id)=>s?.years.find(y=>y.id===id),groupById:()=>undefined,
  shortDate:String,schoolYearName:()=> 'Curs 2026-2027',icon:()=>'',render:()=>{},update:()=>saves++,notify:m=>messages.push(m),
  FormData:class{constructor(){return new Map();}}});
 vm.runInContext(between('function escapeHtml(', 'function emptyState(')+
  between('function isValidDate(', 'function cleanSchoolWeeklySchedule(')+
  between('function schoolDayIsWeekend(', '/** Festius/reducció de tots els centres')+
  between('function clickAction(button)',"document.addEventListener('click'"),ctx);
 const body=between('if (!form.dataset.schoolForm)',"document.addEventListener('input'").trim();
 assert.ok(body.endsWith('});'));
 vm.runInContext('function submitSchool(form,event){'+body.slice(0,-3)+'}',ctx);
 const click=(action,data={})=>ctx.clickAction({dataset:{action,school:'s',year:'y',...data}});
 const open=kind=>click('school-day-add',{kind});
 const toggle=date=>click('school-day-toggle',{date});
 const submit=(data={})=>ctx.submitSchool({dataset:{schoolForm:'day',school:'s',year:'y',kind:ctx.sheet?.kind,...data}},{preventDefault(){}});
 return {ctx,year,school,click,open,toggle,submit,messages,get saves(){return saves;}};
}

test('selecció de molts dies de mesos i anys diferents, amb un únic desament',()=>{
 const s=setup();s.open('holiday');
 assert.deepEqual(plain(s.ctx.sheet.dates),s.year.holidays);
 assert.notEqual(s.ctx.sheet.dates,s.year.holidays);
 s.ctx.sheet.month='2026-12';s.toggle('2026-12-07');s.toggle('2026-12-08');
 s.click('school-day-month',{step:'1'});assert.equal(s.ctx.sheet.month,'2027-01');
 s.toggle('2027-01-18');s.toggle('2026-09-11');
 s.click('school-day-month',{step:'-1'});assert.equal(s.ctx.sheet.month,'2026-12');
 assert.ok(s.ctx.sheet.dates.includes('2027-01-18'));
 assert.deepEqual(s.year.holidays,['2026-09-11','2026-12-25']);assert.equal(s.saves,0);
 s.submit();assert.equal(s.saves,1);assert.equal(s.ctx.sheet,null);
 assert.deepEqual(plain(s.year.holidays),['2026-12-07','2026-12-08','2026-12-25','2027-01-18']);
 assert.deepEqual(s.year.reducedDays,['2027-06-21']);
 assert.equal(s.year.vacations[0].name,'Nadal');
});

test('cancel·lar descarta les marques i reobrir recupera els dies desats',()=>{
 const s=setup();s.open('reduced');s.toggle('2027-06-22');s.toggle('2027-06-21');
 s.click('close-sheet');assert.equal(s.ctx.sheet,null);assert.equal(s.saves,0);
 s.open('reduced');assert.deepEqual(plain(s.ctx.sheet.dates),['2027-06-21']);
 s.toggle('2027-06-22');s.toggle('2027-06-23');s.submit();
 assert.deepEqual(plain(s.year.reducedDays),['2027-06-21','2027-06-22','2027-06-23']);
 assert.equal(s.saves,1);
});

test('permet desmarcar tots els dies sense afectar vacances ni l’altre tipus',()=>{
 const s=setup();s.open('holiday');s.toggle('2026-09-11');s.toggle('2026-12-25');s.submit();
 assert.deepEqual(plain(s.year.holidays),[]);assert.equal(s.year.vacations.length,1);
 assert.deepEqual(s.year.reducedDays,['2027-06-21']);
});

test('bloqueja dates fora del curs, inexistents, vacances i tipus incompatibles',()=>{
 const s=setup();s.open('reduced');
 for(const date of ['2026-08-31','2027-07-01','2027-02-30','2026-09-11','2026-12-22','2027-01-07'])s.toggle(date);
 assert.deepEqual(plain(s.ctx.sheet.dates),['2027-06-21']);
 s.toggle('2027-01-08');assert.ok(s.ctx.sheet.dates.includes('2027-01-08'));
 s.open('holiday');s.toggle('2027-06-21');assert.deepEqual(plain(s.ctx.sheet.dates),s.year.holidays);
 // Valida tot el lot abans de mutar les dades, també si el curs canvia durant l’edició.
 s.toggle('2027-06-22');s.year.endDate='2027-06-20';s.submit();
 assert.equal(s.saves,0);assert.deepEqual(s.year.holidays,['2026-09-11','2026-12-25']);assert.ok(s.messages.length);
});

test('la navegació es limita al curs i passa correctament d’any',()=>{
 const s=setup();s.open('holiday');s.ctx.sheet.month='2026-09';
 s.click('school-day-month',{step:'-1'});assert.equal(s.ctx.sheet.month,'2026-09');
 s.ctx.sheet.month='2027-06';s.click('school-day-month',{step:'1'});assert.equal(s.ctx.sheet.month,'2027-06');
 s.ctx.sheet.month='2026-12';s.click('school-day-month',{step:'1'});assert.equal(s.ctx.sheet.month,'2027-01');
 s.click('school-day-month',{step:'100'});assert.equal(s.ctx.sheet.month,'2027-01');
});

test('el calendari alinea els dies amb dilluns i inclou el 29 de febrer',()=>{
 const s=setup();s.year.startDate='2028-02-05';s.year.endDate='2028-03-31';s.open('holiday');s.ctx.sheet.month='2028-02';
 const html=s.ctx.schoolFormMarkup();
 assert.equal((html.match(/data-action="school-day-toggle"/g)||[]).length,29);
 assert.match(html,/class="school-date-grid"[^>]*><span aria-hidden="true"><\/span><button[^>]*data-date="2028-02-01"/);
 assert.match(html,/data-date="2028-02-04"[^>]*disabled/);
 assert.doesNotMatch(html,/data-date="2028-02-07"[^>]*disabled/);
 assert.match(html,/data-date="2028-02-29"/);
 assert.doesNotMatch(html,/type="date"/);
});

test('les marques existents i les incompatibilitats són accessibles al selector',()=>{
 const s=setup();s.open('reduced');s.ctx.sheet.month='2026-12';
 let html=s.ctx.schoolFormMarkup();
 assert.match(html,/data-date="2026-12-25"[^>]*aria-label="[^"]+Festiu" disabled/);
 assert.match(html,/data-date="2026-12-22"[^>]*aria-label="[^"]+Nadal" disabled/);
 s.ctx.sheet.month='2027-06';html=s.ctx.schoolFormMarkup();
 assert.match(html,/class="school-date-cell selected"[^>]*data-date="2027-06-21" aria-pressed="true"/);
 assert.match(html,/1 dia seleccionat/);
 s.toggle('2027-06-22');assert.match(s.ctx.schoolFormMarkup(),/2 dies seleccionats/);
});

test('un formulari d’un altre centre o tipus no pot desar l’esborrany',()=>{
 const s=setup();s.open('holiday');s.toggle('2026-12-08');
 s.submit({kind:'reduced'});s.submit({school:'other'});
 assert.equal(s.saves,0);assert.deepEqual(s.year.holidays,['2026-09-11','2026-12-25']);
 s.submit();assert.equal(s.saves,1);
});

test('dissabtes i diumenges es veuen però no es poden seleccionar en cap dels dos tipus',()=>{
 for(const kind of ['holiday','reduced']){
  const s=setup();s.open(kind);s.ctx.sheet.month='2026-11';
  const before=plain(s.ctx.sheet.dates);
  s.toggle('2026-11-07');s.toggle('2026-11-08');
  assert.deepEqual(plain(s.ctx.sheet.dates),before);
  s.toggle('2026-11-06');s.toggle('2026-11-09');
  assert.ok(s.ctx.sheet.dates.includes('2026-11-06'));
  assert.ok(s.ctx.sheet.dates.includes('2026-11-09'));
  const html=s.ctx.schoolFormMarkup();
  assert.equal((html.match(/data-action="school-day-toggle"/g)||[]).length,30);
  for(const date of ['2026-11-07','2026-11-08'])assert.match(html,new RegExp('data-date="'+date+'"[^>]*aria-pressed="false"[^>]*Cap de setmana" disabled'));
  s.ctx.sheet.dates.push('2026-11-07');s.submit();
  assert.equal(s.saves,0);assert.ok(s.messages.length);
 }
});

test('els caps de setmana desats abans s’exclouen de l’esborrany sense desar en cancel·lar',()=>{
 for(const kind of ['holiday','reduced']){
  const s=setup(),field=kind==='holiday'?'holidays':'reducedDays';
  s.year[field].push('2026-11-07','2026-11-08');const original=[...s.year[field]];
  s.open(kind);assert.ok(!s.ctx.sheet.dates.includes('2026-11-07'));
  assert.ok(!s.ctx.sheet.dates.includes('2026-11-08'));
  s.click('close-sheet');assert.deepEqual(s.year[field],original);assert.equal(s.saves,0);
  s.open(kind);s.submit();assert.equal(s.saves,1);
  assert.deepEqual(plain(s.year[field]),original.filter(d=>!['2026-11-07','2026-11-08'].includes(d)));
 }
});

test('marcar dies i canviar de mes conserva el desplaçament i el focus del selector',()=>{
 const s=setup();s.open('holiday');
 let focusRestored=false;
 const focusButton={dataset:{date:'2026-12-08'}};
 let dialog={dataset:{sheetKey:'["schoolDayForm","s","y","holiday"]'},scrollTop:120,
  querySelector:()=>({focus:options=>{focusRestored=options.preventScroll;}})};
 const document={body:{style:{}},activeElement:{closest:()=>focusButton}};
 const $app={querySelector:selector=>selector==='.sheet'?dialog:null,
  set innerHTML(_value){dialog={...dialog,scrollTop:0};}};
 Object.assign(s.ctx,{$app,document,tab:'schools',schoolNav:{},calendarView:'month',
  deferRenderForNativePicker:()=>false,monthPosition:()=>null,mountCalendarScroll:()=>{},stopCalendarScroll:null,
  layout:()=>'',schoolsPage:()=>''});
 vm.runInContext(between('function render()', 'function notify('),s.ctx);
 s.toggle('2026-12-08');assert.equal(dialog.scrollTop,120);assert.equal(focusRestored,true);
 s.ctx.sheet.month='2026-12';s.click('school-day-month',{step:'1'});
 assert.equal(s.ctx.sheet.month,'2027-01');assert.equal(dialog.scrollTop,120);
});
