import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../month-day-ui.js',import.meta.url),'utf8');
const timelineSource=readFileSync(new URL('../day-timeline.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(source,context);
vm.runInNewContext(timelineSource,context);
const ui=context.window.monthDayUI;
const timeline=context.window.dayTimelineUI;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
const guardians=[{id:'pare',name:'Pare',color:'#88bbee'},{id:'mare',name:'Mare',color:'#efabcd'}];
const state=()=>({children,guardians,overrides:{},bandOverrides:{},daySlots:{}});
const date='2026-10-29', yesterday='2026-10-28';
const params=(startTime,endTime,guardianId='mare')=>new Map([['startTime',startTime],['endTime',endTime],['guardianId',guardianId]]);
let sequence=0;
const newId=()=>`slot-${++sequence}`;

test('JSON v1 antics sense daySlots i JSON nous amb franges es poden carregar',()=>{
 assert.deepEqual(Object.keys(ui.clean(undefined,children.map(c=>c.id),guardians.map(g=>g.id))),[]);
 const saved={'2026-10-29|elna':[{id:'a',startTime:'08:15',endTime:'10:45',guardianId:'mare'}]};
 assert.deepEqual(Object.keys(ui.clean(JSON.parse(JSON.stringify(saved)),['elna'],['mare'])),['2026-10-29|elna']);
 assert.match(ts,/daySlots:Record<string,DaySlot\[\]>/);
 assert.match(ts,/monthDayUI\.clean\(obj\.daySlots/);
 assert.match(app,/monthDayUI\.clean\(obj\.daySlots/);
});
test('no accepta dates inexistents, hores invàlides, solapaments ni responsables desconeguts',()=>{
 const bad=items=>({'2026-10-29|elna':items});
 assert.throws(()=>ui.clean({'2026-02-30|elna':[{id:'x',startTime:'10:00',endTime:'11:00',guardianId:'pare'}]},['elna'],['pare']));
 assert.throws(()=>ui.clean(bad([{id:'a',startTime:'11:00',endTime:'10:00',guardianId:'pare'}]),['elna'],['pare']));
 assert.throws(()=>ui.clean(bad([{id:'a',startTime:'09:00',endTime:'10:00',guardianId:'wrong'}]),['elna'],['pare']));
 assert.throws(()=>ui.clean(bad([{id:'a',startTime:'09:00',endTime:'10:00',guardianId:'pare'},{id:'b',startTime:'09:30',endTime:'11:00',guardianId:'mare'}]),['elna'],['pare','mare']));
});
test('accepta franges que arriben exactament a les 24:00, però no que hi comencen',()=>{
 const s=state();
 assert.equal(ui.save(s,date,'elna','',params('19:00','24:00'),newId),'');
 assert.equal(s.daySlots[date+'|elna'][0].endTime,'24:00');
 assert.match(ui.save(s,date,'blai','',params('24:00','24:00'),newId),/posterior/);
 assert.deepEqual(Object.keys(ui.clean(JSON.parse(JSON.stringify(s.daySlots)),['elna','blai'],['pare','mare'])),[date+'|elna']);
 const form=ui.form(date,'elna',s.daySlots[date+'|elna'][0].id,children,guardians,s);
 assert.match(form,/name="endAtMidnight" value="yes" checked/);
 assert.match(ts,/values\.has\('endAtMidnight'\)/);
});
test('edita només la data indicada, detecta solapaments i permet eliminar/restaurar',()=>{
 const s=state();
 assert.equal(ui.save(s,date,'elna','',params('09:15','11:30'),newId),'');
 const id=s.daySlots[date+'|elna'][0].id;
 assert.ok(ui.hasChanges(s,date));
 assert.equal(ui.hasChanges(s,yesterday),false);
 assert.equal(ui.save(s,date,'elna','',params('11:00','12:00'),newId).includes('solapa'),true);
 assert.equal(ui.save(s,date,'elna',id,params('08:20','10:00','pare'),newId),'');
 assert.equal(s.daySlots[date+'|elna'][0].guardianId,'pare');
 assert.equal(s.daySlots[yesterday+'|elna'],undefined);
 ui.remove(s,date,'elna',id);
 assert.equal(ui.hasChanges(s,date),false);
 s.overrides[date+'|elna']='mare';
 s.bandOverrides[date+'|blai|mati']='pare';
 assert.ok(ui.hasChanges(s,date));
 ui.restore(s,date);
 assert.equal(ui.hasChanges(s,date),false);
 assert.equal(Object.keys(s.overrides).length,0);
});
test('respecta franges antigues i impedeix solapar-les amb excepcions noves',()=>{
 const s=state();s.bandOverrides[date+'|elna|dinar']='pare';
 assert.match(ui.save(s,date,'elna','',params('12:30','13:00'),newId),/solapa/);
 assert.equal(ui.save(s,date,'elna','legacy:dinar',params('13:00','14:30'),newId),'');
 assert.equal(s.bandOverrides[date+'|elna|dinar'],undefined);
 assert.equal(s.daySlots[date+'|elna'][0].startTime,'13:00');
});
test('la miniatura representa proporcionalment 24 h i escola per sobre de pernocta i excepció',()=>{
 const night=timeline.overnightSegments(date,'elna','19:00',d=>d===date?'mare':'pare',()=>yesterday,id=>guardians.find(g=>g.id===id),['pare','mare']);
 const s=state();ui.save(s,date,'elna','',params('09:00','12:00'),newId);
 const schools=[{childId:'elna',schoolId:'escola',id:'sessio',start:9*60,end:10*60,color:'#66cc99',schoolName:'Escola',kind:'classe',startTime:'09:00',endTime:'10:00'}];
 const output=ui.mini(children,{elna:night,blai:[]},schools,ui.slots(s,date,children,guardians,['pare','mare']));
 assert.match(output,/month-mini-night/);
 assert.match(output,/month-mini-custom/);
 assert.match(output,/month-mini-school/);
 assert.match(output,/top:79\.16666666666667%/); // canvi a les 19:00
 assert.match(output,/top:37\.5%/); // 09:00
 assert.ok(output.indexOf('month-mini-school')>output.indexOf('month-mini-custom'));
 const expanded=ui.detail(date,'Dijous',children,{elna:night},schools,ui.slots(s,date,children,guardians,['pare','mare']),s);
 assert.match(expanded,/00:00/);
 assert.match(expanded,/24:00/);
 assert.match(expanded,/day-slot-edit/);
 assert.match(expanded,/data-action="edit-band" data-date="2026-10-28" data-view-date="2026-10-29" data-band="nit" data-child="elna"/);
 assert.match(expanded,/data-action="open-school-activity" data-date="2026-10-29" data-school="escola" data-child="elna" data-session="sessio"/);
 assert.match(expanded,/Toca una pernocta/);
 assert.match(ui.form(date,'elna',undefined,children,guardians,s),/data-action="return-detail"/);
 assert.match(expanded,/day-restore/);
});
test('les franges noves són visibles també a dia/setmana sense canviar la lògica base',()=>{
 const s=state();ui.save(s,date,'elna','',params('08:00','09:30'),newId);
 const slots=ui.slots(s,date,children,guardians,['pare','mare']);
 const args=[date,'Dijous',children,[],{elna:[],blai:[]},'19:00',50,slots];
 const day=timeline.render(...args);
 assert.match(day,/day-slot-block/);
 assert.match(day,/data-action="day-slot-edit"/);
 const week=timeline.renderWeek('2026-10-26',[{date,label:'Dijous',activities:[],nightSegments:{elna:[],blai:[]},customSlots:slots}],children,50);
 assert.match(week,/day-slot-block/);
 const plain=timeline.render(date,'Dijous',children,[],{elna:[],blai:[]},'19:00');
 assert.doesNotMatch(plain,/day-slot-block/);
});
test('la PWA registra el nou mòdul i la vista de mes no depèn de les cinc franges',()=>{
 assert.match(html,/month-day-ui\.js\?v=0\.5\.5/);
 assert.match(sw,/month-day-ui\.js\?v=0\.5\.5/);
 assert.match(ts,/monthDayUI\.mini\(children,snapshot\.nights,snapshot\.activities,snapshot\.slots\)/);
 assert.match(ts,/monthDayUI\.detail\(/);
 assert.match(app,/case 'day-restore'/);
});

test('Dia i Setmana obren exactament els mateixos editors i mantenen el dia visible',()=>{
 const night=timeline.overnightSegments(date,'elna','19:00',d=>d===date?'mare':'pare',()=>yesterday,id=>guardians.find(g=>g.id===id),['pare','mare']);
 const activities=[{childId:'elna',schoolId:'escola',id:'sessio',start:540,end:720,schoolName:'Escola',color:'#aabbcc',kind:'Classe',description:'Matemàtiques',startTime:'09:00',endTime:'12:00'}];
 const daily=timeline.render(date,'Dijous',children,activities,{elna:night,blai:[]},'19:00');
 const weekly=timeline.renderWeek('2026-10-26',[{date,label:'Dijous',activities,nightSegments:{elna:night,blai:[]}}],children,50);
 for(const markup of [daily,weekly]){
  assert.match(markup,/data-action="edit-band" data-date="2026-10-28" data-view-date="2026-10-29" data-band="nit"/);
  assert.match(markup,/data-action="edit-band" data-date="2026-10-29" data-view-date="2026-10-29" data-band="nit"/);
  assert.match(markup,/data-action="open-school-activity" data-date="2026-10-29" data-school="escola" data-child="elna" data-session="sessio"/);
 }
 assert.match(ts,/detailOrigin=button\.closest\('\.month-day-sheet'\)\?'day':'calendar'/);
 assert.match(ts,/detailReturnDate=button\.dataset\.viewDate\?\?date/);
 assert.match(ts,/sheet=returnFromDetail\(date\);chooseGuardian/);
 assert.match(app,/sheet = returnFromDetail\(date\);\s*chooseGuardian/);
 assert.match(ts,/case 'return-detail'/);
});
