import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),plain=x=>JSON.parse(JSON.stringify(x));
const app=read('app.js'),section=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
function setup(){
 const ctx=vm.createContext({window:{},console,Promise});vm.runInContext(read('view-filters.js'),ctx);
 const state={version:2,children:[{id:'a',name:'Alba',birthDate:''},{id:'b',name:'Bruc',birthDate:''}],guardians:[{id:'g',name:'Guiu',color:'#123456'}],schools:[{id:'s',name:'Escola'}],personTimeOff:{'guardian:g':{holidays:['2026-11-01'],vacations:[]}},overrides:{},
 preferences:{visibleChildren:['a','b'],visibleGuardians:['g'],visibleSchools:['s'],visibleBands:['mati','nit'],visibleTimeOffPeople:['guardian:g'],showExtracurriculars:true,showHolyWeek:false,showWorkSchedules:true,showPersonalHolidays:true,showPersonalVacations:true,theme:'dark',fontSize:'large',mePerson:'guardian:g',timelineZooms:{day:50,week:100}}};
 return {ctx,state,api:ctx.window.viewFilters};
}
test('migra els filtres existents a tres còpies independents, sense tocar identitat, aparença o zoom',()=>{
 const s=setup(),before=plain(s.state.preferences);assert.equal(s.api.sync(s.state,'month'),true);
 const views=s.state.preferences.filterViews;assert.deepEqual(plain(views.year),plain(views.month));assert.deepEqual(plain(views.week),plain(views.month));
 assert.notEqual(views.month.visibleChildren,views.year.visibleChildren);assert.notEqual(views.month.visibleChildren,s.state.preferences.visibleChildren);
 for(const key of ['theme','fontSize','mePerson','timelineZooms'])assert.deepEqual(plain(s.state.preferences[key]),before[key]);
 assert.ok(!('theme' in views.month));assert.equal(s.api.sync(s.state,'month'),false,'una lectura estable no provoca escriptures successives');
});
test('cada vista conserva tots els filtres, inclosa la selecció buida i els calendaris personals',()=>{
 const s=setup();s.api.sync(s.state,'month');
 Object.assign(s.state.preferences,{visibleChildren:['a'],visibleGuardians:[],visibleSchools:[],visibleTimeOffPeople:[],visibleBands:[],showHolyWeek:true,showExtracurriculars:false,showWorkSchedules:false,showPersonalHolidays:false,showPersonalVacations:false});
 s.api.sync(s.state,'year');assert.deepEqual(plain(s.state.preferences.visibleChildren),['a','b']);assert.equal(s.state.preferences.showHolyWeek,false);
 s.state.preferences.visibleChildren=['b'];s.api.sync(s.state,'week');assert.deepEqual(plain(s.state.preferences.visibleChildren),['a','b']);
 s.state.preferences.visibleSchools=[];s.api.sync(s.state,'month');
 assert.deepEqual(plain(s.state.preferences.filterViews.month),{visibleChildren:['a'],visibleGuardians:[],visibleSchools:[],visibleBands:[],visibleTimeOffPeople:[],showExtracurriculars:false,showHolyWeek:true,showWorkSchedules:false,showPersonalHolidays:false,showPersonalVacations:false});
 assert.deepEqual(plain(s.state.preferences.visibleChildren),['a']);s.api.sync(s.state,'year');assert.deepEqual(plain(s.state.preferences.visibleChildren),['b']);s.api.sync(s.state,'week');assert.deepEqual(plain(s.state.preferences.visibleSchools),[]);
});
test('desar i reobrir conserva els tres perfils amb IndexedDB i localStorage',async()=>{
 for(const mode of ['indexeddb','localStorage']){
  const s=setup(),writes=[];Object.assign(s.ctx,{state:s.state,calendarView:'month',writeQueue:Promise.resolve(),storageMode:mode,db:{},idbPut:async data=>writes.push(plain(data)),localStorage:{setItem:(key,value)=>writes.push(JSON.parse(value))},notify:assert.fail});
  vm.runInContext(section('function saveState()', 'function update()'),s.ctx);
  s.ctx.saveState();s.state.preferences.visibleChildren=['a'];s.ctx.saveState();await s.ctx.writeQueue;
  s.api.sync(s.state,'year');s.state.preferences.visibleChildren=['b'];s.ctx.calendarView='year';s.ctx.saveState();await s.ctx.writeQueue;
  s.api.sync(s.state,'week');s.state.preferences.showHolyWeek=true;s.ctx.calendarView='week';s.ctx.saveState();await s.ctx.writeQueue;
  const reopened=setup(),stored=plain(writes.at(-1));reopened.api.sync(stored,'month');assert.deepEqual(plain(stored.preferences.visibleChildren),['a']);assert.equal(stored.preferences.showHolyWeek,false);
  reopened.api.sync(stored,'year');assert.deepEqual(plain(stored.preferences.visibleChildren),['b']);reopened.api.sync(stored,'week');assert.equal(stored.preferences.showHolyWeek,true);
  assert.deepEqual(writes[0].preferences.visibleChildren,['a','b'],'les escriptures en cua conserven la seva instantània');
 }
});
test('els perfils s’exporten i s’importen amb el validador real; les còpies antigues continuen vàlides',()=>{
 const s=setup();for(const file of ['month-day-ui.js','rotation-patterns.js','work-schedule.js','personal-time-off.js'])vm.runInContext(read(file),s.ctx);
 Object.assign(s.ctx,{monthDayUI:s.ctx.window.monthDayUI,rotationPatterns:s.ctx.window.rotationPatterns,personalTimeOff:s.ctx.window.personalTimeOff,workSchedule:s.ctx.window.workSchedule,BANDS:['mati','dinar','tarda','sopar','nit'],MAX_ROTATION_DAYS:3640,
  isValidDate:d=>/^\d{4}-\d{2}-\d{2}$/.test(d),isTimeBand:x=>['mati','dinar','tarda','sopar','nit'].includes(x),cleanSchools:()=>s.state.schools,validTheme:x=>x,validFontSize:x=>x,validTimelineZoom:x=>x??50});
 vm.runInContext(section('function cleanState(raw)', 'let db ='),s.ctx);
 const old=plain(s.state);assert.ok(!s.ctx.cleanState(old).preferences.filterViews);
 s.api.sync(s.state,'month');s.state.preferences.visibleChildren=[];s.api.sync(s.state,'year');
 const imported=s.ctx.cleanState(plain(s.state));assert.deepEqual(plain(imported.preferences.filterViews),plain(s.state.preferences.filterViews));
 const fresh=setup();fresh.api.sync(imported,'month');assert.deepEqual(plain(imported.preferences.visibleChildren),[]);
 const malformed=plain(s.state);malformed.preferences.filterViews.week.showHolyWeek='yes';assert.throws(()=>s.ctx.cleanState(malformed),/filtres/);
});
test('mostra-ho tot i els canvis personals només afecten el perfil actiu',()=>{
 const s=setup();s.api.sync(s.state,'month');s.state.preferences.visibleChildren=[];s.state.preferences.visibleTimeOffPeople=[];s.api.sync(s.state,'year');s.state.preferences.visibleChildren=[];s.state.preferences.showPersonalVacations=false;s.api.sync(s.state,'year');
 Object.assign(s.state.preferences,{visibleChildren:['a','b'],visibleTimeOffPeople:['guardian:g'],showPersonalVacations:true});s.api.sync(s.state,'year');s.api.sync(s.state,'month');assert.deepEqual(plain(s.state.preferences.visibleChildren),[]);assert.deepEqual(plain(s.state.preferences.visibleTimeOffPeople),[]);s.api.sync(s.state,'year');assert.equal(s.state.preferences.showPersonalVacations,true);
});
test('nous fills i tutors s’incorporen, els eliminats no reapareixen i les escoles noves queden ocultes',()=>{
 const s=setup();s.api.sync(s.state,'month');s.state.preferences.visibleChildren=[];s.api.sync(s.state,'week');
 s.state.children.push({id:'c'});s.state.guardians.push({id:'g2'});s.state.schools.push({id:'s2'});s.api.sync(s.state,'week');
 s.api.sync(s.state,'month');assert.deepEqual(plain(s.state.preferences.visibleChildren),['c']);assert.deepEqual(plain(s.state.preferences.visibleGuardians),['g','g2']);assert.deepEqual(plain(s.state.preferences.visibleSchools),['s']);
 s.state.children=s.state.children.filter(c=>c.id!=='a');s.state.guardians=[];s.state.schools=[];s.api.sync(s.state,'year');
 for(const view of ['year','month','week']){s.api.sync(s.state,view);assert.ok(!s.state.preferences.visibleChildren.includes('a'));assert.deepEqual(plain(s.state.preferences.visibleGuardians),[]);assert.deepEqual(plain(s.state.preferences.visibleSchools),[]);assert.deepEqual(plain(s.state.preferences.visibleTimeOffPeople),[]);}
});
test('importar o reiniciar estat no reutilitza el perfil de l’estat anterior',()=>{
 const s=setup();s.api.sync(s.state,'month');s.state.preferences.visibleChildren=[];s.api.sync(s.state,'month');
 const replacement=setup().state;s.api.sync(replacement,'month');assert.deepEqual(plain(replacement.preferences.visibleChildren),['a','b']);assert.deepEqual(plain(s.state.preferences.visibleChildren),[]);
});
test('valida els perfils nous, elimina ids desconeguts i omple únicament els camps absents',()=>{
 const s=setup();const profiles=s.api.clean({month:{visibleChildren:['b','unknown','b'],visibleSchools:[],showHolyWeek:true}},s.state);assert.deepEqual(plain(profiles.month.visibleChildren),['b']);assert.deepEqual(plain(profiles.month.visibleSchools),[]);assert.equal(profiles.month.showHolyWeek,true);assert.deepEqual(plain(profiles.year.visibleChildren),['a','b']);
 for(const invalid of [null,[],{month:null},{week:[]},{year:{visibleChildren:null}},{week:{showWorkSchedules:1}}])assert.throws(()=>s.api.clean(invalid,s.state),/filtres/);
});
test('l’app sincronitza els filtres abans de dibuixar i la PWA inclou el suport nou',()=>{
 const render=section('function render()', 'function notify(');assert.ok(render.indexOf('viewFilters?.sync')<render.indexOf('$app.innerHTML'));
 const version=JSON.parse(read('package.json')).version;for(const file of ['index.html','sw.js'])assert.ok(read(file).includes('view-filters.js?v='+version));
 assert.match(app,/Es desen només per a aquesta vista/);
});
