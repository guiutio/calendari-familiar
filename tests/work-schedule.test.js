import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const plain=v=>JSON.parse(JSON.stringify(v));
const app=read('app.js');
const section=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i);assert.ok(i>=0&&j>i,a);return app.slice(i,j);};
function setup(){
 let saves=0,paints=0,serial=0;const messages=[];
 const state={children:[{id:'g',name:'Fill'}],guardians:[{id:'g',name:'Guiu',color:'#123abc'},{id:'r',name:'Rebeca',color:'#abcdef'}],personTimeOff:{},preferences:{visibleTimeOffPeople:[],showWorkSchedules:true,showPersonalHolidays:true,showPersonalVacations:true,mePerson:'guardian:g'}};
 const ctx=vm.createContext({window:{},state,sheet:null,Date,render:()=>paints++,update:()=>saves++,notify:m=>messages.push(m),confirm:()=>true,newId:()=> 'work-'+(++serial),localDate:()=> '2026-11-02',FormData:class {constructor(form){return new Map(Object.entries(form.fields));}}});
 for(const file of ['work-schedule.js','personal-time-off.js'])vm.runInContext(read(file),ctx);
 const api=ctx.window.workSchedule,personal=ctx.window.personalTimeOff;
 Object.assign(ctx,{workSchedule:api,personalTimeOff:personal});
 vm.runInContext(section('function clickAction(button)',"document.addEventListener('click'"),ctx);
 vm.runInContext('function submitWork(form,event){'+section('if (form.dataset.workRotationForm)', 'if (form.dataset.personVacationForm)')+'}',ctx);
 vm.runInContext('function changeWork(target){'+section("if (target.dataset.workField && sheet?.type === 'personWork')", "if (action === 'timeline-zoom')")+'}',ctx);
 const key='guardian:g',draft=()=>api.draft(state,key,undefined,'2026-11-02');
 const click=(action,data={})=>ctx.clickAction({dataset:{action,person:key,...data}});
 const shift=(startTime,endTime)=>({startTime,endTime});
 const save=(d,k=key)=>api.save(state,k,d,ctx.newId);
 return {ctx,api,personal,state,key,draft,click,shift,save,messages,get saves(){return saves;},get paints(){return paints;}};
}

test('només els adults poden tenir rotacions de feina i els esborranys comencen buits',()=>{
 const s=setup();assert.equal(s.api.draft(s.state,'child:g',undefined,'2026-11-02'),null);
 const d=s.draft();assert.equal(d.days.length,7);assert.ok(d.days.every(x=>!x.length));
 assert.deepEqual(s.state.personTimeOff,{});assert.equal(s.api.draft(s.state,s.key,'missing','2026-11-02'),null);
 d.days[0]=[s.shift('09:00','13:00')];assert.equal(s.save(d,'child:g'),'Persona no disponible');
 s.click('work-add',{person:'child:g'});assert.equal(s.ctx.sheet,null);
});

test('la jornada partida conserva les dues franges i es repeteix segons el dia de la setmana',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('15:00','18:00'),s.shift('09:00','13:00')];assert.equal(s.save(d),'');
 assert.deepEqual(plain(s.api.slots(s.state,s.key,'2026-11-02').map(x=>[x.startTime,x.endTime])),[['09:00','13:00'],['15:00','18:00']]);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-03').length,0);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-09').length,2);
 assert.ok(s.state.preferences.visibleTimeOffPeople.includes(s.key));
});

test('cicle de dues setmanes amb inici a mitja setmana i límits de dates inclusius',()=>{
 const s=setup(),d=s.draft();s.api.change(d,'weeks','2');d.startDate='2026-11-04';d.endDate='2026-11-18';
 d.days[2]=[s.shift('08:00','12:00')];d.days[9]=[s.shift('14:00','19:00')];assert.equal(s.save(d),'');
 assert.equal(s.api.slots(s.state,s.key,'2026-10-28').length,0);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-04')[0].startTime,'08:00');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-11')[0].startTime,'14:00');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-18')[0].startTime,'08:00');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-25').length,0);
});

test('les franges que travessen la mitjanit es reparteixen entre els dos dies i respecten la data final',()=>{
 const s=setup(),d=s.draft();d.days[6]=[s.shift('22:00','06:00')];d.endDate='2026-11-09';assert.equal(s.save(d),'');
 assert.deepEqual(plain(s.api.slots(s.state,s.key,'2026-11-08').map(x=>[x.startTime,x.endTime])),[['22:00','24:00']]);
 assert.deepEqual(plain(s.api.slots(s.state,s.key,'2026-11-09').map(x=>[x.startTime,x.endTime])),[['00:00','06:00']]);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-16').length,0);
});

test('els festius i vacances personals anul·len la feina independentment dels filtres visuals',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('09:00','13:00'),s.shift('15:00','18:00')];d.days[1]=[s.shift('09:00','13:00')];assert.equal(s.save(d),'');
 s.personal.setHolidays(s.state,s.key,['2026-11-02']);
 s.personal.saveVacation(s.state,s.key,'',new Map([['name','Nadal'],['startDate','2026-11-03'],['endDate','2026-11-04']]),()=> 'leave');
 s.state.preferences.showPersonalHolidays=false;s.state.preferences.showPersonalVacations=false;
 assert.equal(s.api.slots(s.state,s.key,'2026-11-02').length,0);assert.equal(s.api.slots(s.state,s.key,'2026-11-03').length,0);
 assert.equal(s.api.absence(s.state,s.key,'2026-11-03'),'Nadal');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-09').length,2);
});

test('una absència també anul·la les hores nocturnes que entren o surten d’aquell dia',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('22:00','06:00')];d.days[1]=[s.shift('22:00','06:00')];assert.equal(s.save(d),'');
 s.personal.setHolidays(s.state,s.key,['2026-11-03']);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-03').length,0);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-04').length,0);
 assert.equal(s.api.slots(s.state,s.key,'2026-11-02')[0].endTime,'24:00');
});

test('dates, hores i solapaments es validen abans de desar, també al canvi de setmana',()=>{
 const s=setup();const before=JSON.stringify(s.state);
 const cases=[d=>{},d=>{d.days[0]=[s.shift('10:00','10:00')];},d=>{d.days[0]=[s.shift('25:00','13:00')];},d=>{d.days[0]=[s.shift('09:00','13:00'),s.shift('12:00','15:00')];},d=>{d.days[6]=[s.shift('22:00','06:00')];d.days[0]=[s.shift('05:00','08:00')];},d=>{d.days[0]=[s.shift('09:00','13:00')];d.endDate='2026-11-01';},d=>{d.days[0]=[s.shift('09:00','13:00')];d.startDate='2026-02-30';}];
 for(const mutate of cases){const d=s.draft();mutate(d);assert.notEqual(s.save(d),'');assert.equal(JSON.stringify(s.state),before);}
 const d=s.draft();d.days[0]=[s.shift('09:00','13:00'),s.shift('13:00','15:00')];assert.equal(s.save(d),'');
});

test('afegir, editar i eliminar diverses rotacions manté l’ordre per inici i els altres calendaris',()=>{
 const s=setup();const late=s.draft();late.startDate='2026-12-01';late.days[0]=[s.shift('09:00','13:00')];assert.equal(s.save(late),'');
 const early=s.draft();early.days[0]=[s.shift('08:00','12:00')];assert.equal(s.save(early),'');
 const list=s.api.rotations(s.state,s.key);assert.deepEqual(plain(list.map(x=>x.startDate)),['2026-11-02','2026-12-01']);
 const edit=s.api.draft(s.state,s.key,list[0].id,'2026-11-02');edit.name='Horari nou';edit.days[0][0].endTime='14:00';
 assert.equal(list[0].name,'Feina');assert.equal(s.save(edit),'');assert.equal(s.api.rotations(s.state,s.key)[0].name,'Horari nou');
 s.personal.setHolidays(s.state,'guardian:r',['2026-11-02']);s.click('work-delete',{rotation:list[0].id});
 assert.equal(s.api.rotations(s.state,s.key).length,1);assert.equal(s.api.absence(s.state,'guardian:r','2026-11-02'),'Festiu');
 assert.equal(s.api.remove(s.state,s.key,'missing'),false);
});

test('els controls de patrons permeten copiar una jornada partida a laborables i editar setmanes independents',()=>{
 const s=setup(),d=s.draft();s.api.change(d,'weeks','2');s.api.edit(d,'add',7);s.api.change(d,'time','15:00',7,0,'startTime');s.api.change(d,'time','18:00',7,0,'endTime');s.api.edit(d,'add',7);s.api.edit(d,'copy',7);
 assert.equal(d.week,1);for(let i=7;i<12;i++)assert.equal(d.days[i].length,2);
 assert.equal(d.days[12].length,0);assert.equal(d.days[13].length,0);assert.equal(d.days[0].length,0);
 d.days[8][0].startTime='16:00';assert.equal(d.days[7][0].startTime,'15:00');
 assert.equal(s.api.edit(d,'remove',7,0),true);assert.equal(d.days[7].length,1);
 assert.equal(s.api.change(d,'weeks','13'),false);assert.equal(s.api.edit(d,'week',2),false);
});

test('cancel·lar descarta l’esborrany; Desa els canvis llegeix els camps i confirma tota la rotació',()=>{
 const s=setup();s.click('work-add');assert.equal(s.ctx.sheet.type,'personWork');
 s.click('work-shift-add',{day:'0'});assert.deepEqual(s.state.personTimeOff,{});
 s.click('work-cancel');assert.equal(s.ctx.sheet.type,'personTimeOff');assert.equal(s.saves,0);
 s.click('work-add');s.click('work-shift-add',{day:'0'});
 s.ctx.submitWork({dataset:{workRotationForm:'true'},fields:{name:'Jornada partida',startDate:'2026-11-02',endDate:'',weeks:'1','work-0-0-startTime':'09:30','work-0-0-endTime':'13:30'}},{preventDefault(){}});
 assert.equal(s.saves,1);assert.equal(s.ctx.sheet.type,'personTimeOff');assert.equal(s.api.slots(s.state,s.key,'2026-11-02')[0].startTime,'09:30');
 s.click('work-edit',{rotation:s.api.rotations(s.state,s.key)[0].id});s.click('work-shift-remove',{day:'0',slot:'0'});
 s.ctx.submitWork({dataset:{workRotationForm:'true'},fields:{}},{preventDefault(){}});assert.equal(s.ctx.sheet.type,'personWork');assert.equal(s.saves,1);
});

test('la interacció amb dates i hores només modifica l’esborrany i no substitueix el selector natiu',()=>{
 const s=setup();s.click('work-add');s.click('work-shift-add',{day:'0'});const before=s.paints;
 s.ctx.changeWork({dataset:{workField:'time',day:'0',slot:'0',edge:'endTime'},value:'14:30'});
 s.ctx.changeWork({dataset:{workField:'startDate'},value:'2026-11-04'});
 assert.equal(s.paints,before);assert.equal(s.ctx.sheet.draft.days[0][0].endTime,'14:30');assert.equal(s.saves,0);
 s.ctx.changeWork({dataset:{workField:'weeks'},value:'2'});assert.equal(s.paints,before+1);assert.equal(s.ctx.sheet.draft.days.length,14);
});

test('les còpies de seguretat conserven patrons i colors i rebutgen patrons incomplets o corruptes',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('09:00','13:00'),s.shift('15:00','18:00')];assert.equal(s.save(d),'');s.personal.setColor(s.state,s.key,'holiday','#aa0011');
 const raw=plain(s.state.personTimeOff),restored=s.personal.clean(raw,s.state.children,s.state.guardians);assert.deepEqual(plain(restored),raw);
 for(const transform of [r=>{r.weeks=0;},r=>{r.days.pop();},r=>{r.days[0][0].endTime='invalid';},r=>{r.days[0]=Array.from({length:9},()=>s.shift('09:00','13:00'));}]){
  const bad=plain(raw);transform(bad[s.key].workRotations[0]);assert.throws(()=>s.personal.clean(bad,s.state.children,s.state.guardians));
 }
 const duplicate=plain(raw);duplicate[s.key].workRotations.push(plain(duplicate[s.key].workRotations[0]));assert.throws(()=>s.personal.clean(duplicate,s.state.children,s.state.guardians),/repetit/);
 const old=s.personal.clean({[s.key]:{holidays:[],vacations:[]}},s.state.children,s.state.guardians);assert.equal(old[s.key].workRotations,undefined);
});

test('Dia mostra el resultat laboral amb filtres i Setmana es limita a la graella',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('09:00','13:00'),s.shift('15:00','18:00')];assert.equal(s.save(d),'');
 let html=s.api.agenda(s.state,['2026-11-02']);assert.ok(html.includes('Horari laboral'));assert.ok(html.includes('09:00–13:00'));assert.ok(html.includes('15:00–18:00'));assert.ok(html.includes('Guiu · Jo'));
 s.personal.setHolidays(s.state,s.key,['2026-11-09']);html=s.api.agenda(s.state,['2026-11-09']);assert.ok(html.includes('Festiu'));assert.ok(!html.includes('09:00–13:00'));
 s.click('person-off-type',{kind:'work'});assert.equal(s.api.agenda(s.state,['2026-11-02']),'');assert.equal(s.api.slots(s.state,s.key,'2026-11-02').length,2);
 s.personal.showAll(s.state);s.click('person-off-filter');assert.equal(s.api.agenda(s.state,['2026-11-02']),'');
 s.personal.showAll(s.state);assert.ok(s.personal.filterMarkup(s.state).includes('Franges de feina'));
 assert.doesNotMatch(app,/content = weekTimeline[^;]+workSchedule.agenda/);
 assert.match(app,/dayTimeline\(selectedDate, children\)[^;]+workSchedule.agenda/);
});

test('Horari laboral substitueix el títol antic i cada color és dins de la seva secció amb l’estil compartit',()=>{
 const s=setup(),html=s.personal.panel(s.state,s.key),css=read('styles.css');
 assert.ok(html.includes('Horari laboral'));assert.ok(html.includes('Rotacions de feina'));
 assert.doesNotMatch(html,/personal-color-settings|<h2[^>]*>Festius i vacances/);
 const holiday=html.indexOf('data-kind="holiday"'),vacation=html.indexOf('data-kind="vacation"');
 assert.ok(holiday<html.indexOf('<strong>Festius'));assert.ok(vacation>html.indexOf('Encara no hi ha festius.'));assert.ok(vacation<html.indexOf('<strong>Vacances'));
 assert.match(css,/\.color-input \{ border:none;border-radius:11px;width:32px;height:40px/);
 assert.doesNotMatch(css,/personal-color-settings/);
 const d=s.draft();d.name='<feina>';d.days[0]=[s.shift('09:00','13:00'),s.shift('15:00','18:00')];
 const form=s.api.form(s.state,s.key,d);assert.ok(form.includes('&lt;feina&gt;'));assert.equal((form.match(/class="work-shift-row"/g)||[]).length,2);
 assert.ok(form.includes('Data final (opcional)'));assert.ok(form.includes('Desa els canvis'));
});

test('el nou mòdul es carrega abans dels calendaris personals i queda disponible fora de línia',()=>{
 const version=JSON.parse(read('package.json')).version,script='work-schedule.js?v='+version,html=read('index.html');
 assert.ok(html.includes(script));assert.ok(read('sw.js').includes(script));assert.ok(html.indexOf(script)<html.indexOf('personal-time-off.js'));
});


test('el patró laboral original permet valorar vacances sense tornar a aplicar les absències',()=>{
 const s=setup(),d=s.draft();d.days[0]=[s.shift('22:00','06:00')];assert.equal(s.save(d),'');
 s.personal.setHolidays(s.state,s.key,['2026-11-02']);s.personal.saveVacation(s.state,s.key,'',new Map([['name','Descans'],['startDate','2026-11-02'],['endDate','2026-11-03']]),()=> 'leave');
 assert.equal(s.api.absence(s.state,s.key,'2026-11-02'),'Festiu');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-02').length,0);assert.equal(s.api.scheduledSlots(s.state,s.key,'2026-11-02')[0].startTime,'22:00');
 assert.equal(s.api.slots(s.state,s.key,'2026-11-03').length,0);assert.equal(s.api.scheduledSlots(s.state,s.key,'2026-11-03')[0].endTime,'06:00');
 assert.equal(s.api.scheduledSlots(s.state,s.key,'2026-11-04').length,0);
});
