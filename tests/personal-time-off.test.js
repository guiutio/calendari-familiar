import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const app=read('app.js');
const section=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 let saves=0,paints=0,serial=0;const messages=[];
 class Clock extends Date {constructor(...args){super(...(args.length?args:['2026-11-02T12:00:00Z']));}}
 const state={version:2,children:[{id:'same',name:'Fill',birthDate:''}],guardians:[{id:'same',name:'Guiu',color:'#112233'},{id:'other',name:'Rebeca',color:'#445566'}],schools:[],personTimeOff:{},
  extraRotations:[],extraExceptions:{},overrides:{},bandOverrides:{},daySlots:{},nightDateTimes:{},
  preferences:{mePerson:'',visibleTimeOffPeople:[],showPersonalHolidays:true,showPersonalVacations:true,showWorkSchedules:true,visibleChildren:['same'],visibleGuardians:['same','other'],visibleSchools:[]}};
 const ctx=vm.createContext({window:{},Date:Clock,state,sheet:null,schoolNav:{},tab:'people',calendarView:'month',viewYear:2026,viewMonth:10,selectedDate:'2026-11-02',monthRange:null,yearRange:null,monthScrollTarget:true,
  months:['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'],weekdays:['Dl','Dt','Dc','Dj','Dv','Ds','Dg'],weekLong:['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'],
  icon:()=>'',activeChildren:()=>state.children.filter(c=>state.preferences.visibleChildren.includes(c.id)),
  childById:id=>state.children.find(c=>c.id===id),guardian:id=>state.guardians.find(g=>g.id===id),defaultGuardian:()=>state.guardians[0]?.id??'',
  monthData:()=>({nights:{},activities:[],slots:{},extra:[]}),birthdays:()=>[],weekStart:d=>d,
  render:()=>paints++,update:()=>saves++,notify:m=>messages.push(m),confirm:()=>true,
  FormData:class {constructor(form){return new Map(Object.entries(form.fields));}}});
 for(const file of ['work-schedule.js','personal-time-off.js','rotation-patterns.js','month-day-ui.js'])vm.runInContext(read(file),ctx);
 Object.assign(ctx,{workSchedule:ctx.window.workSchedule,personalTimeOff:ctx.window.personalTimeOff,rotationPatterns:ctx.window.rotationPatterns,monthDayUI:ctx.window.monthDayUI,isValidDate:ctx.window.personalTimeOff.valid});
 vm.runInContext(section('function escapeHtml(', 'function emptyState(')+section('function periodTitle()', 'function navButton(')+section('function calendarNavigation()', 'function layout(')+
  section('function monthPanel(', '// Keep loaded months')+section('function yearOverview(', 'function rotationPage(')+section('function personActions(', 'function settingsPage(')+
  section('function sheetMarkup()', 'let nativePickerRenderPending')+section('function removeGuardian(id)', 'async function exportData()')+
  section('function clickAction(button)',"document.addEventListener('click'"),ctx);
 vm.runInContext('function submitVacation(form,event){'+section('if (form.dataset.personVacationForm)', 'if (form.dataset.extraPatternDayForm)')+'}',ctx);
 ctx.newId=()=> 'v'+(++serial);
 const click=(action,data={})=>ctx.clickAction({dataset:{action,person:'guardian:same',...data}});
 const vacation=(fields,key='guardian:same',id='')=>ctx.submitVacation({dataset:{personVacationForm:'true',person:key,period:id},fields},{preventDefault(){}});
 const api=ctx.personalTimeOff;
 const holidays=(dates,key='guardian:same')=>{assert.equal(api.setHolidays(state,key,dates),'');};
 const marks=(date,from='2026-11-01',to='2026-11-30')=>api.marks(api.visibleEntries(state),date,from,to);
 return {ctx,state,api,click,vacation,holidays,marks,messages,get saves(){return saves;},get paints(){return paints;}};
}
const leave={name:'Vacances de Nadal',startDate:'2026-12-22',endDate:'2027-01-07'};

test('Setmana Santa es calcula de Rams a Pasqua, inclosos els extrems de març i abril',()=>{
 const s=setup();s.state.preferences.showHolyWeek=true;
 for(const [year,startDate,endDate] of [
  [1818,'1818-03-15','1818-03-22'],[1943,'1943-04-18','1943-04-25'],
  [2010,'2010-03-28','2010-04-04'],[2026,'2026-03-29','2026-04-05'],
  [2027,'2027-03-21','2027-03-28']
 ]){
  const [entry]=s.api.calendarEntries(s.state,year,`${year}-01-01`,`${year}-12-31`);
  assert.equal(entry.kind,'holy-week');
  assert.deepEqual(plain(entry.ranges),[{startDate,endDate}]);
 }
});

test('el filtre mostra els contorns a Any i Mes encara que no hi hagi fills visibles',()=>{
 const s=setup();s.ctx.sheet={type:'filters'};
 const march=()=>s.ctx.monthPanel(2026*12+2,[],'2026-11-02');
 const april=()=>s.ctx.monthPanel(2026*12+3,[],'2026-11-02');
 const year=()=>s.ctx.yearOverview(2026,[],'2026-11-02');
 const marker=/data-calendar-mark="holy-week"/g;
 assert.match(s.ctx.sheetMarkup(),/data-action="toggle-holy-week" aria-pressed="false"/);
 assert.doesNotMatch(march(),marker);
 s.click('toggle-holy-week');
 assert.match(s.ctx.sheetMarkup(),/data-action="toggle-holy-week" aria-pressed="true"/);
 assert.equal((march().match(marker)||[]).length,3);
 assert.equal((april().match(marker)||[]).length,5);
 assert.equal((year().match(marker)||[]).length,8);
 s.holidays(['2026-04-03']);
 const entries=s.api.calendarEntries(s.state,2026,'2026-04-01','2026-04-30');
 const overlap=s.api.marks(entries,'2026-04-03','2026-04-01','2026-04-30');
 assert.deepEqual(plain(overlap.items.map(({kind,layer})=>[kind,layer])),[['holiday',0],['holy-week',1]]);
 assert.match(overlap.label,/Festiu de Guiu.*Setmana Santa/);
 assert.match(overlap.html,/<span class="personal-fill [^"]*" style="--pto-color:#d32f2f;/);
 assert.equal((overlap.html.match(/class="personal-fill /g)||[]).length,1);
 const easterOnly=s.api.marks(entries,'2026-04-04','2026-04-01','2026-04-30');
 assert.match(easterOnly.html,/<span class="personal-fill [^"]*" style="--pto-color:var\(--holy-week-color\);/);
 assert.match(s.ctx.calendarLegend(),/Setmana Santa/);
 s.ctx.calendarView='week';assert.doesNotMatch(s.ctx.calendarLegend(),/Setmana Santa/);
 s.click('toggle-holy-week');assert.doesNotMatch(year(),marker);
 s.click('filter-all');assert.equal((year().match(marker)||[]).length,8);
});

function working(s,key='guardian:same',days=[0,1,2,3,4,5,6]){
 const draft=s.ctx.workSchedule.draft(s.state,key,undefined,'2026-01-01');
 for(const index of days)draft.days[index]=[{startTime:'09:00',endTime:'17:00'}];
 assert.equal(s.ctx.workSchedule.save(s.state,key,draft,()=> 'work-for-contours'),'');
}

test('Mes, Setmana i Dia atenuen les dates lliures de la persona identificada',()=>{
 const s=setup();working(s,'guardian:same',[0,1,2,3,4]);
 s.api.setMe(s.state,'guardian:same');s.holidays(['2026-11-03']);
 const html=s.ctx.monthPanel(2026*12+10,s.state.children,'2026-11-02');
 const cell=date=>html.match(new RegExp('data-action="show-calendar-day" data-date="'+date+'"[\\s\\S]*?</button>'))[0];
 assert.match(cell('2026-11-03'),/class="day-number is-day-off"/);
 assert.match(cell('2026-11-07'),/class="day-number is-day-off"/);
 assert.doesNotMatch(cell('2026-11-06'),/is-day-off/);
 s.ctx.calendarView='day';s.ctx.selectedDate='2026-11-07';
 assert.match(s.ctx.calendarNavigation(),/class="calendar-title" data-day-off/);
 s.ctx.selectedDate='2026-11-06';assert.doesNotMatch(s.ctx.calendarNavigation(),/data-day-off/);
 vm.runInContext(read('day-timeline.js')+section('function weekTimeline(', 'function miniBands('),s.ctx);
 Object.assign(s.ctx,{dayTimelineUI:s.ctx.window.dayTimelineUI,nightChangeTime:()=> '19:00',assigned:()=>'',schoolActivities:()=>[],extraSlots:()=>[],timelineZoomForView:()=>50});
 const week=s.ctx.weekTimeline('2026-11-02',s.state.children);
 assert.match(week,/class="week-date-button is-day-off" data-action="show-calendar-day" data-date="2026-11-07"/);
 assert.match(week,/class="week-date-button" data-action="show-calendar-day" data-date="2026-11-06"/);
 s.api.setMe(s.state,'guardian:same');
 assert.doesNotMatch(s.ctx.monthPanel(2026*12+10,s.state.children,'2026-11-02'),/is-day-off/);
});


test('només els tutors i responsables tenen calendari personal i l’opció Soc jo',()=>{
 const s=setup();s.holidays(['2026-11-03']);
 const html=s.ctx.peoplePage();
 assert.equal((html.match(/data-action="person-time-off"/g)||[]).length,2);
 assert.equal((html.match(/data-action="person-me"/g)||[]).length,2);
 assert.doesNotMatch(html,/data-person="child:same"/);
 assert.equal(s.ctx.personActions('child:same'),'');
 assert.equal(s.api.person(s.state,'child:same'),undefined);
 const before=JSON.stringify(s.state);
 assert.equal(s.api.setHolidays(s.state,'child:same',['2026-11-02']),'Persona no disponible');
 s.vacation(leave,'child:same');s.click('person-me',{person:'child:same'});
 for(const action of ['person-time-off','person-holidays','person-vacation-add'])s.click(action,{person:'child:same'});
 assert.equal(JSON.stringify(s.state),before);assert.equal(s.ctx.sheet,null);
 assert.equal(s.api.panel(s.state,'child:same'),'');
 assert.equal(s.api.vacationForm(s.state,'child:same',undefined,'2026-11-02'),'');
});

test('multiselecció de festius entre mesos i anys, inclosos caps de setmana, sense desar fins a confirmar',()=>{
 const s=setup();s.click('person-holidays');
 s.click('person-holiday-toggle',{date:'2026-11-07'});s.click('person-holiday-toggle',{date:'2026-11-08'});
 s.ctx.sheet.month='2026-12';s.click('person-holiday-month',{step:'1'});assert.equal(s.ctx.sheet.month,'2027-01');
 s.click('person-holiday-toggle',{date:'2027-01-01'});
 assert.equal(s.saves,0);assert.deepEqual(s.state.personTimeOff,{});
 s.click('person-time-off');assert.equal(s.saves,0);s.click('person-holidays');assert.deepEqual(plain(s.ctx.sheet.dates),[]);
 for(const date of ['2026-11-07','2026-11-08','2027-01-01'])s.click('person-holiday-toggle',{date});
 s.click('person-holidays-save');assert.equal(s.saves,1);assert.equal(s.ctx.sheet.type,'personTimeOff');
 assert.deepEqual(plain(s.api.get(s.state,'guardian:same').holidays),['2026-11-07','2026-11-08','2027-01-01']);
 assert.ok(s.state.preferences.visibleTimeOffPeople.includes('guardian:same'));
});

test('afegir, editar i eliminar vacances valida tot el període i conserva els altres calendaris',()=>{
 const s=setup();s.vacation(leave);assert.equal(s.saves,1);
 const period=s.api.get(s.state,'guardian:same').vacations[0];assert.equal(period.name,leave.name);
 s.holidays(['2026-11-02'],'guardian:other');const before=JSON.stringify(s.state);
 s.vacation({...leave,endDate:'2026-12-01'},'guardian:same',period.id);assert.equal(JSON.stringify(s.state),before);assert.equal(s.saves,1);
 s.vacation({...leave,name:'Nadal actualitzat',endDate:'2027-01-08'},'guardian:same',period.id);
 assert.equal(s.api.get(s.state,'guardian:same').vacations.length,1);assert.equal(s.api.get(s.state,'guardian:same').vacations[0].name,'Nadal actualitzat');
 s.click('person-vacation-delete',{period:period.id});assert.equal(s.api.get(s.state,'guardian:same').vacations.length,0);
 assert.deepEqual(plain(s.api.get(s.state,'guardian:other').holidays),['2026-11-02']);
});

test('Soc jo identifica una única persona, es pot retirar i es reflecteix als filtres',()=>{
 const s=setup();s.click('person-me',{person:'child:same'});assert.equal(s.state.preferences.mePerson,'');
 s.click('person-me');assert.equal(s.state.preferences.mePerson,'guardian:same');
 s.holidays(['2026-11-02']);assert.ok(s.api.filterMarkup(s.state).includes('Guiu · Jo'));
 assert.match(s.ctx.peoplePage(),/data-action="person-me" data-person="guardian:same" aria-pressed="true"/);
 s.click('person-me',{person:'unknown'});assert.equal(s.state.preferences.mePerson,'guardian:same');
 s.click('person-me');assert.equal(s.state.preferences.mePerson,'');
});

test('els filtres de persones i tipus són independents dels colors de tutors i fills de les franges',()=>{
 const s=setup();working(s);s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-03',endDate:'2026-11-04'});
 s.state.preferences.visibleChildren=[];s.state.preferences.visibleGuardians=[];
 assert.equal(s.marks('2026-11-02').items[0].kind,'holiday');
 s.click('person-off-type',{kind:'holiday'});assert.deepEqual(plain(s.marks('2026-11-03').items.map(p=>p.kind)),['vacation']);
 s.click('person-off-filter');assert.equal(s.marks('2026-11-03').items.length,0);
 s.click('filter-all');assert.equal(s.marks('2026-11-02').items.length,1);assert.equal(s.marks('2026-11-03').items.length,1);
 assert.equal(s.state.preferences.showPersonalHolidays,true);assert.equal(s.state.preferences.showPersonalVacations,true);
});

test('editar un calendari ocult no torna a activar-lo automàticament',()=>{
 const s=setup();s.holidays(['2026-11-02']);s.click('person-off-filter');
 s.holidays(['2026-11-02','2026-11-03']);assert.equal(s.marks('2026-11-02').items.length,0);
 s.holidays([]);s.holidays(['2026-11-04']);assert.equal(s.marks('2026-11-04').items.length,0);
});

test('els dies consecutius es fusionen i dues setmanes formen només el perímetre exterior',()=>{
 const s=setup();working(s);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-15'});
 let p=s.marks('2026-11-02').items[0];assert.equal(p.top,true);assert.equal(p.left,true);assert.equal(p.bottom,false);assert.equal(p.right,false);
 p=s.marks('2026-11-03').items[0];assert.equal(p.left,false);assert.equal(p.right,false);assert.equal(p.bottom,false);
 p=s.marks('2026-11-09').items[0];assert.equal(p.top,false);assert.equal(p.bottom,true);assert.equal(p.left,true);
 p=s.marks('2026-11-15').items[0];assert.equal(p.right,true);assert.equal(p.bottom,true);
 assert.equal(s.marks('2026-11-16').items.length,0);
});

test('dos dilluns separats no s’uneixen i els festius de persones diferents tampoc es fusionen',()=>{
 const s=setup();s.holidays(['2026-11-02','2026-11-09']);
 assert.equal(s.marks('2026-11-02').items[0].bottom,true);assert.equal(s.marks('2026-11-09').items[0].top,true);
 s.holidays(['2026-11-03'],'guardian:other');
 assert.equal(s.marks('2026-11-02').items[0].right,true);assert.equal(s.marks('2026-11-03').items[0].left,true);
});

test('el perímetre d’una sèrie que travessa una setmana tanca els dos esglaons',()=>{
 const s=setup();working(s);s.vacation({name:'Descans',startDate:'2026-11-04',endDate:'2026-11-11'});
 const first=s.marks('2026-11-04'),last=s.marks('2026-11-11');
 assert.equal(first.items[0].left,true);assert.equal(first.items[0].bottom,false);
 assert.equal(last.items[0].top,false);assert.equal(last.items[0].right,true);
 assert.ok(first.html.includes('--pto-color:#168948;--pto-layer:0'));assert.ok(first.html.includes('pto-left'));
 assert.ok(last.html.includes('--pto-color:#168948;--pto-layer:0'));assert.ok(last.html.includes('pto-right'));
 assert.match(first.html,/pto-concave-br/);assert.match(last.html,/pto-concave-tl/);
});

test('les vacances superposades o adjacents es mostren com una sola sèrie per persona',()=>{
 const s=setup();working(s);s.vacation({name:'A',startDate:'2026-11-02',endDate:'2026-11-04'});
 s.vacation({name:'B',startDate:'2026-11-04',endDate:'2026-11-05'});s.vacation({name:'C',startDate:'2026-11-06',endDate:'2026-11-08'});
 assert.equal(s.marks('2026-11-04').items.length,1);assert.equal(s.marks('2026-11-05').items[0].right,false);
 assert.equal(s.marks('2026-11-08').items[0].right,true);assert.equal(s.api.get(s.state,'guardian:same').vacations.length,3);
});

test('un festiu guanya a les vacances de la mateixa persona, encara que el filtre de festius estigui desactivat',()=>{
 const s=setup();working(s);s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-04'});
 const mark=s.marks('2026-11-02');assert.equal(mark.items.length,1);assert.equal(mark.items[0].kind,'holiday');
 assert.match(mark.html,/personal-outline holiday/);assert.doesNotMatch(mark.html,/personal-outline vacation/);
 assert.match(mark.label,/Festiu de Guiu/);assert.doesNotMatch(mark.label,/Vacances de Guiu/);
 s.click('person-off-type',{kind:'holiday'});assert.equal(s.marks('2026-11-02').items.length,0);
 assert.equal(s.marks('2026-11-03').items[0].kind,'vacation');
});

test('els contorns es tanquen al canvi de mes i d’any, amb extrems inclusius',()=>{
 const s=setup();working(s);s.vacation({name:'Nadal',startDate:'2026-12-29',endDate:'2027-01-04'});
 const dec=s.marks('2026-12-31','2026-12-01','2026-12-31').items[0];assert.equal(dec.right,true);assert.equal(dec.bottom,true);
 const jan=s.marks('2027-01-01','2027-01-01','2027-01-31').items[0];assert.equal(jan.left,true);assert.equal(jan.top,true);
 assert.equal(s.marks('2027-01-04','2027-01-01','2027-01-31').items.length,1);
 assert.equal(s.marks('2027-01-05','2027-01-01','2027-01-31').items.length,0);
});

test('Mes i Any generen els contorns només als dies afectats i responen als filtres',()=>{
 const s=setup();working(s);s.holidays(['2026-11-02','2026-11-03','2026-11-04']);
 s.vacation({name:'Descans',startDate:'2026-11-03',endDate:'2026-11-05'});
 const render=()=>[s.ctx.monthPanel(2026*12+10,s.state.children,'2026-11-02'),s.ctx.yearOverview(2026,s.state.children,'2026-11-02')];
 for(const html of render()){
  assert.equal((html.match(/data-personal-kind="holiday"/g)||[]).length,3);
  assert.equal((html.match(/data-personal-kind="vacation"/g)||[]).length,1);
 }
 s.click('person-off-type',{kind:'vacation'});
 for(const html of render())assert.doesNotMatch(html,/data-personal-kind="vacation"/);
 s.click('person-off-filter');for(const html of render())assert.doesNotMatch(html,/personal-outline/);
});

test('el panell de filtres identifica qui soc jo i el botó de filtres indica seleccions ocultes',()=>{
 const s=setup();s.holidays(['2026-11-02']);s.click('person-me');
 assert.equal(s.api.filtered(s.state),false);s.click('person-off-type',{kind:'holiday'});assert.equal(s.api.filtered(s.state),true);
 assert.ok(s.ctx.calendarControls().includes('filter-dot'));
 s.ctx.sheet={type:'filters'};const html=s.ctx.sheetMarkup();
 assert.match(html,/Horari laboral/);assert.match(html,/Guiu · Jo/);
 assert.match(html,/data-action="person-off-type" data-kind="holiday" aria-pressed="false"/);
});

test('eliminar una persona neteja el seu calendari i la identitat, sense tocar persones amb el mateix id',()=>{
 const s=setup();s.holidays(['2026-11-03'],'guardian:same');
 s.click('person-me',{person:'child:same'});s.ctx.removeChild('same');
 assert.equal(s.state.preferences.mePerson,'');assert.equal(s.state.personTimeOff['child:same'],undefined);
 assert.ok(s.state.personTimeOff['guardian:same']);assert.equal(s.state.guardians.length,2);
 s.click('person-me');s.ctx.removeGuardian('same');
 assert.equal(s.state.preferences.mePerson,'');assert.equal(s.state.personTimeOff['guardian:same'],undefined);
 assert.ok(!s.state.preferences.visibleTimeOffPeople.includes('guardian:same'));
});

test('les dades antigues dels fills no es mostren ni es recuperen com a calendaris personals',()=>{
 const s=setup();const legacy={'child:same':{holidays:['2026-11-02'],vacations:[{id:'old',...leave}]},'guardian:same':{holidays:['2026-11-03'],vacations:[]}};
 const data=s.api.clean(legacy,s.state.children,s.state.guardians);
 assert.deepEqual(plain(data),{'guardian:same':{holidays:['2026-11-03'],vacations:[]}});
 const prefs=s.api.cleanPreferences({mePerson:'child:same',visibleTimeOffPeople:['child:same','guardian:same']},s.state.children,s.state.guardians,data);
 assert.equal(prefs.mePerson,'');assert.deepEqual(plain(prefs.visibleTimeOffPeople),['guardian:same']);
 s.state.personTimeOff=legacy;s.state.preferences.visibleTimeOffPeople=['child:same','guardian:same'];
 assert.equal(s.marks('2026-11-02').items.length,0);
 assert.doesNotMatch(s.api.filterMarkup(s.state),/data-person="child:same"/);
 assert.deepEqual(plain(legacy['child:same'].holidays),['2026-11-02']);
});

test('les còpies personals es netegen sense mutacions i validen dates, noms, ids i filtres',()=>{
 const s=setup();s.holidays(['2028-02-29','2028-02-29']);s.vacation(leave);
 const raw=plain(s.state.personTimeOff),restored=s.api.clean(JSON.parse(JSON.stringify(raw)),s.state.children,s.state.guardians);
 assert.deepEqual(plain(restored),raw);
 assert.deepEqual(plain(s.api.clean(undefined,s.state.children,s.state.guardians)),{});
 for(const holidays of [['2026-02-30'],{},['bad']])assert.throws(()=>s.api.clean({'guardian:same':{holidays}},s.state.children,s.state.guardians),/festius/);
 for(const period of [{id:'x',name:' ',startDate:'2026-11-02',endDate:'2026-11-03'},{id:'x',name:'A',startDate:'2026-11-03',endDate:'2026-11-02'}])assert.throws(()=>s.api.clean({'guardian:same':{vacations:[period]}},s.state.children,s.state.guardians),/vacances/);
 const p={id:'x',name:'A',startDate:'2026-11-02',endDate:'2026-11-03'};
 assert.throws(()=>s.api.clean({'guardian:same':{vacations:[p,p]}},s.state.children,s.state.guardians),/vacances/);
 const defaults=s.api.cleanPreferences({},s.state.children,s.state.guardians,raw);
 assert.equal(defaults.mePerson,'');assert.equal(defaults.showPersonalHolidays,true);assert.equal(defaults.showPersonalVacations,true);
 assert.throws(()=>s.api.cleanPreferences({showPersonalHolidays:'no'},s.state.children,s.state.guardians,raw),/Filtres/);
});

test('els formularis escapen els noms, conserven dates natives i mantenen llegibles els extrems',()=>{
 const s=setup();s.vacation({...leave,name:'Nadal <especial>'});
 const p=s.api.get(s.state,'guardian:same').vacations[0];
 assert.match(s.api.panel(s.state,'guardian:same'),/Nadal &lt;especial&gt;/);
 const form=s.api.vacationForm(s.state,'guardian:same',p.id,'2026-11-02');
 assert.match(form,/name="startDate" value="2026-12-22"/);assert.match(form,/name="endDate" value="2027-01-07"/);
 assert.ok(form.includes('L’inici i el final estan inclosos'));
});

test('un calendari de tutor també és visible a Any sense tenir fills',()=>{
 const s=setup();s.holidays(['2026-11-02']);s.state.children=[];
 const html=s.ctx.yearOverview(2026,[],'2026-11-02');
 assert.equal((html.match(/data-personal-kind="holiday"/g)||[]).length,1);
 assert.doesNotMatch(html,/class="month-mini/);
});

test('marcar festius conserva el desplaçament i el focus del selector personal',()=>{
 const s=setup();s.click('person-holidays');
 let focusRestored=false,dialog={dataset:{sheetKey:'["personHolidays","guardian:same"]'},scrollTop:120,
  querySelector:selector=>{assert.ok(selector.includes('person-holiday-toggle'));return {focus:options=>{focusRestored=options.preventScroll;}};}};
 const button={dataset:{action:'person-holiday-toggle',date:'2026-11-02'}};
 Object.assign(s.ctx,{$app:{querySelector:selector=>selector==='.sheet'?dialog:null,set innerHTML(_value){dialog={...dialog,scrollTop:0};}},
  document:{body:{style:{}},activeElement:{closest:()=>button}},layout:()=>'',peoplePage:()=>'',monthPosition:()=>null,stopCalendarScroll:null,
  deferRenderForNativePicker:()=>false,mountCalendarScroll:()=>{}});
 vm.runInContext(section('function render()', 'function notify('),s.ctx);
 s.click('person-holiday-toggle',{date:'2026-11-02'});
 assert.equal(dialog.scrollTop,120);assert.equal(focusRestored,true);
 s.ctx.sheet.month='2026-12';s.click('person-holiday-month',{step:'1'});assert.equal(dialog.scrollTop,120);assert.equal(s.ctx.sheet.month,'2027-01');
});

test('els contorns i la seva llegenda es limiten a Any i Mes',()=>{
 const s=setup();working(s);s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-03'});
 Object.assign(s.ctx,{weekTimeline:()=>'<div>Setmana</div>',dayTimeline:()=>'<div>Dia</div>',schoolInfoForDay:()=>'',timelineZoomForView:()=>50});
 for(const view of ['week','day']){
  s.ctx.calendarView=view;assert.doesNotMatch(s.ctx.calendarPage(),/personal-outline|Festius personals|Vacances personals/);
 }
 for(const view of ['year','month','week','day']){
  s.ctx.calendarView=view;
  assert.doesNotMatch(s.ctx.calendarPage(),/class="legend"|calendar-bottom|time-row-help|class="tip-card"/);
  if(view==='week')assert.doesNotMatch(s.ctx.calendarPage(),/class="calendar-card"|Horari laboral/);
  assert.match(s.ctx.calendarControls(),/data-action="open-legend"/);
  s.click('open-legend');
  const dialog=s.ctx.sheetMarkup();
  assert.match(dialog,/role="dialog" aria-modal="true" aria-label="Llegenda"/);
  assert.match(dialog,/Sense assignar/);assert.match(dialog,/Canvi puntual/);
  if(view==='year'||view==='month'){
   assert.match(dialog,/Festius personals/);assert.match(dialog,/Vacances personals/);
  } else assert.doesNotMatch(dialog,/Festius personals|Vacances personals/);
  s.click('close-sheet');assert.equal(s.ctx.sheet,null);
 }
});

test('el mòdul personal es carrega abans de l’app i queda inclòs a la memòria cau de la mateixa versió',()=>{
 const version=JSON.parse(read('package.json')).version,script='personal-time-off.js?v='+version,html=read('index.html');
 assert.ok(html.includes(script));assert.ok(read('sw.js').includes(script));
 assert.ok(html.indexOf(script)<html.indexOf('src="./app.js'));
});

test('colors independents per persona i tipus, desats sense alterar dates ni el color del tutor',()=>{
 const s=setup();s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-03'});
 s.click('person-off-filter');
 assert.equal(s.api.setColor(s.state,'guardian:same','holiday','#123abc'),true);
 assert.equal(s.api.setColor(s.state,'guardian:same','vacation','#FEDCBA'),true);
 assert.equal(s.api.setColor(s.state,'guardian:other','holiday','#AA0000'),true);
 assert.equal(s.api.color(s.state,'guardian:same','holiday'),'#123abc');
 assert.equal(s.api.color(s.state,'guardian:same','vacation'),'#FEDCBA');
 assert.equal(s.api.color(s.state,'guardian:other','vacation'),'#168948');
 assert.equal(s.state.guardians[0].color,'#112233');
 assert.equal(s.marks('2026-11-02').items.length,0);
 const restored=s.api.clean(plain(s.state.personTimeOff),s.state.children,s.state.guardians);
 assert.deepEqual(plain(restored),plain(s.state.personTimeOff));
 assert.deepEqual(plain(restored['guardian:same'].holidays),['2026-11-02']);
 const html=s.api.panel(s.state,'guardian:same');
 assert.ok(html.includes('value="#123abc" data-action="person-off-color"'));
 assert.ok(html.includes('value="#FEDCBA" data-action="person-off-color"'));
 assert.doesNotMatch(html,/Contorn vermell/);
 const before=JSON.stringify(s.state);
 for(const [key,kind,color] of [['child:same','holiday','#112233'],['guardian:same','wrong','#112233'],['guardian:same','holiday','red'],['guardian:same','vacation','#fff;display:none']])assert.equal(s.api.setColor(s.state,key,kind,color),false);
 assert.equal(JSON.stringify(s.state),before);
 assert.throws(()=>s.api.clean({'guardian:same':{holidayColor:'bad'}},s.state.children,s.state.guardians),/Color/);
});

test('Any i Mes conserven els contorns niats i omplen la cel·la amb el color prioritari',()=>{
 const s=setup();s.state.guardians.push({id:'third',name:'Àvia',color:'#555555'});working(s,'guardian:third');
 s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-03'},'guardian:third');
 s.holidays(['2026-11-02'],'guardian:other');
 for(const [key,kind,color] of [['guardian:same','holiday','#123abc'],['guardian:third','vacation','#abcdef'],['guardian:other','holiday','#aa0011']])s.api.setColor(s.state,key,kind,color);
 const mark=s.marks('2026-11-02');assert.equal(mark.items.length,3);
 assert.deepEqual(plain(mark.items.map(p=>p.layer)),[0,1,2]);
 assert.ok(mark.html.includes('--pto-color:#123abc;--pto-layer:0'));assert.ok(mark.html.includes('--pto-color:#aa0011;--pto-layer:1'));assert.ok(mark.html.includes('--pto-color:#abcdef;--pto-layer:2'));
 assert.doesNotMatch(mark.html,/gradient/);
 assert.equal((mark.html.match(/data-personal-kind=/g)||[]).length,3);
 assert.equal((mark.html.match(/class="personal-fill /g)||[]).length,1);
 assert.match(mark.html,/<span class="personal-fill [^"]*" style="--pto-color:#123abc;/);
 for(const html of [s.ctx.monthPanel(2026*12+10,s.state.children,'2026-11-02'),s.ctx.yearOverview(2026,s.state.children,'2026-11-02')]){
  assert.ok(html.includes('#123abc'));assert.ok(html.includes('#abcdef'));assert.ok(html.includes('#aa0011'));
 }
 for(const html of [s.api.filterMarkup(s.state),s.api.legendMarkup(s.state)]){
  assert.ok(html.includes('border-color:#123abc'));assert.ok(html.includes('border-color:#abcdef'));
 }
 s.click('person-off-type',{kind:'vacation'});assert.doesNotMatch(s.marks('2026-11-02').html,/#abcdef/);
 const css=read('styles.css');
 assert.match(css,/--pto-stroke:var\(--month-outline-width,4px\)/);
 assert.match(css,/--pto-inset:calc\(var\(--pto-layer,0\) \* var\(--pto-stroke\) - 1px\)/);
 assert.match(css,/\.personal-outline \{inset:-1px;/);assert.doesNotMatch(css,/--pto-top-paint/);
 assert.match(css,/\.year-day \{position:relative;--month-outline-width:1px;/);
});

test('l’agenda laboral es conserva al diàleg de Dia i respecta els filtres',()=>{
 const s=setup();s.click('work-add');s.click('work-shift-add',{day:'0'});
 let html=s.ctx.sheetMarkup();assert.match(html,/data-work-rotation-form="true"/);assert.match(html,/Horari laboral/);assert.match(html,/name="work-0-0-startTime"/);
 const draft=s.ctx.sheet.draft;draft.days[0]=[{startTime:'09:00',endTime:'13:00'},{startTime:'15:00',endTime:'18:00'}];
 assert.equal(s.ctx.workSchedule.save(s.state,'guardian:same',draft,()=> 'job'),'');s.ctx.sheet=null;
 Object.assign(s.ctx,{weekTimeline:()=>'<div>Setmana</div>',dayTimeline:()=>'<div>Dia</div>',schoolInfoForDay:()=>'',timelineZoomForView:()=>50});
 for(const view of ['week','day']){
  s.ctx.calendarView=view;html=s.ctx.calendarPage();
  assert.doesNotMatch(html,/Horari laboral|09:00–13:00|15:00–18:00/);
 }
 s.click('open-day-edit');html=s.ctx.sheetMarkup();
 assert.match(html,/Horari laboral/);assert.match(html,/09:00–13:00/);assert.match(html,/15:00–18:00/);
 s.click('person-off-type',{kind:'work'});assert.doesNotMatch(s.ctx.sheetMarkup(),/09:00–13:00/);
 s.click('filter-all');assert.match(s.ctx.sheetMarkup(),/09:00–13:00/);
});

test('el llapis obre les accions del dia i conserva els editors, la data i la restauració',()=>{
 const s=setup(),date=s.ctx.selectedDate;
 Object.assign(s.ctx,{tab:'calendar',calendarView:'day',dayTimeline:()=>'<div class="day-timeline">Dia</div>',schoolInfoForDay:()=>'',timelineZoomForView:()=>50,detailOrigin:'calendar',detailReturnDate:date});
 assert.doesNotMatch(s.ctx.calendarPage(),/calendar-card|daily-agenda|day-edit-actions|day-slot-add/);
 assert.match(s.ctx.calendarControls(),/data-action="open-day-edit"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"/);
 s.click('open-day-edit');let html=s.ctx.sheetMarkup();
 assert.match(html,/role="dialog" aria-modal="true" aria-label="Edita el dia"/);
 assert.match(html,new RegExp('data-action="day-slot-add" data-date="'+date+'"'));
 assert.doesNotMatch(html,/data-action="day-restore"|data-action="extra-date-choose"/);
 assert.match(s.ctx.calendarControls(),/data-action="open-day-edit"[^>]*aria-expanded="true"/);
 s.ctx.clickAction({dataset:{action:'day-slot-add',date},closest:()=>null});
 assert.equal(s.ctx.sheet.type,'daySlotForm');assert.equal(s.ctx.sheet.childId,'same');
 assert.equal(s.ctx.calendarView,'day');assert.equal(s.ctx.selectedDate,date);
 assert.equal(s.ctx.monthDayUI.save(s.state,date,'same','',new Map([['startTime','16:30'],['endTime','18:00'],['guardianId','same']]),()=> 'slot'),'');
 s.state.extraRotations.push({id:'pickup',name:'Recollida',startDate:date,length:1,startTime:'16:30',endTime:'19:00',childIds:['same'],assignments:{same:['same']},activeDays:[true]});
 s.click('open-day-edit');html=s.ctx.sheetMarkup();
 assert.match(html,/data-action="day-restore"/);assert.match(html,/data-action="extra-date-choose"/);
 s.click('extra-date-choose',{date});assert.equal(s.ctx.sheet.type,'extraDate');assert.equal(s.ctx.sheet.date,date);
 s.click('open-day-edit');s.click('day-restore',{date});
 assert.equal(s.ctx.monthDayUI.hasChanges(s.state,date),false);assert.equal(s.ctx.sheet,null);
 assert.equal(s.ctx.calendarView,'day');assert.equal(s.ctx.selectedDate,date);
 s.ctx.calendarView='month';s.click('open-day-edit');assert.equal(s.ctx.sheet,null);
});

test('les vacances només es marquen els dies previstos de feina i separen els dies de descans',()=>{
 const s=setup();working(s,'guardian:same',[0,1,2,3,4]);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-15'});
 for(const date of ['2026-11-02','2026-11-06','2026-11-09','2026-11-13'])assert.equal(s.marks(date).items[0].kind,'vacation');
 for(const date of ['2026-11-07','2026-11-08','2026-11-14','2026-11-15'])assert.equal(s.marks(date).items.length,0);
 assert.equal(s.marks('2026-11-06').items[0].right,true);assert.equal(s.marks('2026-11-06').items[0].bottom,true);
 assert.equal(s.marks('2026-11-09').items[0].left,true);assert.equal(s.marks('2026-11-09').items[0].top,true);
 assert.equal(s.ctx.workSchedule.slots(s.state,'guardian:same','2026-11-02').length,0);
 assert.equal(s.ctx.workSchedule.scheduledSlots(s.state,'guardian:same','2026-11-02').length,1);
 s.click('person-off-type',{kind:'work'});assert.equal(s.marks('2026-11-02').items.length,1);
});

test('sense rotació laboral no es marquen vacances, però els festius es marquen també en dies de descans',()=>{
 const s=setup();s.vacation({name:'Descans',startDate:'2026-11-01',endDate:'2026-11-30'});s.holidays(['2026-11-07']);
 assert.equal(s.marks('2026-11-02').items.length,0);assert.equal(s.marks('2026-11-07').items[0].kind,'holiday');
 working(s,'guardian:same',[0,1,2,3,4]);const rotation=s.api.get(s.state,'guardian:same').workRotations[0];rotation.startDate='2026-11-09';rotation.endDate='2026-11-16';
 assert.equal(s.marks('2026-11-02').items.length,0);assert.equal(s.marks('2026-11-09').items[0].kind,'vacation');
 assert.equal(s.marks('2026-11-16').items.length,1);assert.equal(s.marks('2026-11-17').items.length,0);
});

test('la prioritat és per persona: el festiu d’un tutor pot coincidir amb les vacances d’un altre',()=>{
 const s=setup();working(s,'guardian:other');s.holidays(['2026-11-02']);s.vacation({name:'Descans',startDate:'2026-11-02',endDate:'2026-11-03'},'guardian:other');
 const marks=s.marks('2026-11-02').items;assert.deepEqual(plain(marks.map(p=>[p.key,p.kind,p.layer])),[['guardian:same','holiday',0],['guardian:other','vacation',1]]);
 s.click('person-off-filter');const single=s.marks('2026-11-02').items;assert.equal(single.length,1);assert.equal(single[0].layer,0);
});

test('cada tram conserva la capa i les cantonades quan coincideixen vacances de diverses persones',()=>{
 const s=setup();working(s);working(s,'guardian:other');
 s.vacation({name:'Descans',startDate:'2026-11-04',endDate:'2026-11-11'});s.vacation({name:'Descans',startDate:'2026-11-04',endDate:'2026-11-11'},'guardian:other');
 const entries=s.api.visibleEntries(s.state);
 for(const date of ['2026-11-04','2026-11-05','2026-11-08','2026-11-09','2026-11-11']){
  const mark=s.api.marks(entries,date,'2026-11-01','2026-11-30');assert.deepEqual(plain(mark.items.map(p=>p.layer)),[0,1]);
 }
 const first=s.api.marks(entries,'2026-11-04','2026-11-01','2026-11-30'),last=s.api.marks(entries,'2026-11-11','2026-11-01','2026-11-30');
 assert.ok(first.items.every(p=>p.concaveBR));assert.ok(last.items.every(p=>p.concaveTL));assert.match(first.html,/personal-corner pto-concave-br/);
 assert.equal(s.api.marks(entries,'2026-11-12','2026-11-01','2026-11-30').items.length,0);
});
