import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}],guardians=[{id:'pare',name:'Pare',color:'#88bbee'},{id:'mare',name:'Mare',color:'#eeaacc'}];
 const state={children,guardians,extraRotations:[],extraExceptions:{},nightDateTimes:{},overrides:{}};
 const ctx=vm.createContext({window:{},state});
 for(const file of ['rotation-patterns.js','rotation-editor.js','day-timeline.js','month-day-ui.js'])vm.runInContext(read(file),ctx);
 const core=ctx.window.rotationPatterns,editor=ctx.window.rotationEditor;
 const night=(id,startDate='2026-11-01',endDate,childIds=['elna'])=>({id,kind:'night',name:id,startDate,...(endDate?{endDate}:{}),length:7,startTime:'19:00',endTime:'00:00',childIds,assignments:Object.fromEntries(childIds.map(child=>[child,Array(7).fill('pare')])),activeDays:Array(7).fill(true),nightTimes:{}});
 return {ctx,state,children,guardians,core,editor,night};
}

test('les pernoctes són opcionals, es creen amb fills propis i es poden plegar com la resta',()=>{
 const s=setup();assert.equal(s.core.nightAssignment([], '2026-11-01','elna'),'');
 assert.match(s.editor.render(s.state,null),/Les pernoctes també són opcionals/);
 const r=s.editor.create(s.state,'n','2026-11-01','night');
 assert.equal(r.kind,'night');assert.equal(r.startTime,'19:00');assert.deepEqual(plain(r.childIds),['elna']);
 assert.match(s.editor.render(s.state,'n'),/>Tanca<\/button>/);
 assert.match(s.editor.render(s.state,'n'),/Finalitza \(opcional\)/);
 assert.match(s.editor.render(s.state,'n'),/Hora de canvi de pernocta/);
 assert.doesNotMatch(s.editor.render(s.state,'n'),/data-extra-change="schoolDaysOnly"/);
 assert.doesNotMatch(s.editor.render(s.state,null),/class="extra-editor"/);
 const snapshot=JSON.stringify(s.state);s.editor.click(s.state,'extra-toggle',{rotation:'n'},()=>'', '2026-11-01',()=>true);
 assert.equal(JSON.stringify(s.state),snapshot);
});

test('diverses pernoctes poden coincidir si s’apliquen a fills diferents',()=>{
 const s=setup(),a=s.night('a'),b=s.night('b','2026-11-01',undefined,['blai']);b.assignments.blai.fill('mare');
 const saved=s.core.cleanExtras([a,b],s.children,s.guardians);
 assert.equal(s.core.nightAssignment(saved,'2026-11-03','elna'),'pare');
 assert.equal(s.core.nightAssignment(saved,'2026-11-03','blai'),'mare');
 assert.equal(s.core.slots({...s.state,extraRotations:saved},'2026-11-03',s.children,s.guardians,['pare','mare']).length,0,'Les pernoctes no són franges addicionals de 24 hores');
});

test('rebutja tota intersecció inclusiva per fill, també amb intervals sense final i tutors buits',()=>{
 const s=setup();
 for(const [a,b] of [
  [s.night('a'),s.night('b','2027-01-01')],
  [s.night('a','2026-11-01','2026-11-30'),s.night('b','2026-11-30','2026-12-31')],
  [s.night('a','2026-11-01','2026-11-30',['elna','blai']),s.night('b','2026-11-02','2026-11-03',['blai'])]
 ])assert.throws(()=>s.core.cleanExtras([a,b],s.children,s.guardians),/se solapen/);
 const a=s.night('a'),b=s.night('b');a.assignments.elna.fill('');b.activeDays.fill(false);
 assert.throws(()=>s.core.cleanExtras([a,b],s.children,s.guardians),/se solapen/);
});

test('permet intervals consecutius sense dia compartit, i les dates limiten l’aplicació',()=>{
 const s=setup(),a=s.night('a','2026-11-01','2026-11-30'),b=s.night('b','2026-12-01','2026-12-31');b.assignments.elna.fill('mare');
 const list=s.core.cleanExtras([b,a],s.children,s.guardians);
 for(const [date,who] of [['2026-10-31',''],['2026-11-01','pare'],['2026-11-30','pare'],['2026-12-01','mare'],['2026-12-31','mare'],['2027-01-01','']])assert.equal(s.core.nightAssignment(list,date,'elna'),who,date);
});

test('la validació del desament és atòmica i compara amb les altres pernoctes confirmades',()=>{
 const s=setup();s.state.extraRotations=[s.night('a')];
 const drafts={b:s.night('b','2026-12-01')},before=JSON.stringify(s.state);
 assert.match(s.editor.saveDraft(s.state,drafts,'b'),/se solapen/);
 assert.equal(JSON.stringify(s.state),before);assert.ok(drafts.b);
 const work=s.editor.draftState(s.state,drafts,'a');s.editor.change(work,{rotation:'a',extraChange:'endDate'},'2026-11-30',{});
 assert.equal(s.editor.saveDraft(s.state,drafts,'a'),'');
 assert.equal(s.editor.saveDraft(s.state,drafts,'b'),'');assert.equal(s.state.extraRotations.length,2);
});

test('canviar els fills o el començament d’una pernocta també comprova les interseccions',()=>{
 const s=setup();s.state.extraRotations=[s.night('a'),s.night('b','2026-11-01',undefined,['blai'])];
 const drafts={},work=s.editor.draftState(s.state,drafts,'b');
 s.editor.click(work,'extra-child',{rotation:'b',child:'elna'},()=>'', '2026-11-01',()=>true);
 assert.match(s.editor.saveDraft(s.state,drafts,'b'),/se solapen/);assert.deepEqual(s.state.extraRotations[1].childIds,['blai']);
});

test('els altres tipus també tenen inici i final inclusius, però es poden solapar entre ells i amb pernoctes',()=>{
 const s=setup(),a=s.editor.create(s.state,'activity','2028-02-28');
 a.endDate='2028-02-29';a.assignments.elna.fill('mare');
 s.state.extraRotations.push(s.night('night','2028-02-01'));
 const b={...plain(a),id:'activity2'};s.state.extraRotations.push(b);
 s.core.cleanExtras(s.state.extraRotations,s.children,s.guardians);
 for(const [date,count] of [['2028-02-27',0],['2028-02-28',2],['2028-02-29',2],['2028-03-01',0]])assert.equal(s.core.slots(s.state,date,s.children,s.guardians,['pare','mare']).length,count,date);
 const params=new Map([['startTime','16:30'],['endTime','17:30'],['guardianId','mare']]);
 assert.match(s.editor.saveDate(s.state,'2028-03-01','activity','elna',params),/no s’aplica/);
});

test('es validen les dates finals i es pot tornar a un interval sense final',()=>{
 const s=setup(),r=s.night('n');s.state.extraRotations=[r];
 for(const endDate of ['2026-10-31','2026-02-30',false])assert.throws(()=>s.core.cleanExtras([{...r,endDate}],s.children,s.guardians),/data final/);
 assert.ok(s.editor.change(s.state,{rotation:'n',extraChange:'endDate'},'2026-12-31',{}));
 assert.ok(s.editor.change(s.state,{rotation:'n',extraChange:'startDate'},'2027-01-01',{}).error);
 s.editor.change(s.state,{rotation:'n',extraChange:'endDate'},'',{});assert.equal(r.endDate,undefined);
});

test('s’ordenen per data d’inici tant plegades com obertes',()=>{
 const s=setup();s.state.extraRotations=[s.night('late','2027-01-01'),s.night('early','2026-01-01','2026-10-31'),{...s.night('middle','2026-12-01','2026-12-31'),kind:'activity',startTime:'16:00',endTime:'17:00'}];
 for(const open of [null,'late']){
  const html=s.editor.render(s.state,open);
  const ids=[...html.matchAll(/class="card extra-rotation-card" data-extra-rotation="([^"]+)"/g)].map(m=>m[1]);
  assert.deepEqual(ids,['early','middle','late']);
 }
});

test('tutor i hora del dia s’editen conjuntament en l’esborrany de la pernocta triada',()=>{
 const s=setup();s.state.extraRotations=[s.night('n')];
 const drafts={},work=s.editor.draftState(s.state,drafts,'n'),savedBefore=JSON.stringify(s.state.extraRotations);
 const html=s.editor.patternDayForm(work,'n','elna',2);
 assert.match(html,/Tutor i hora de canvi/);assert.match(html,/name="changeTime" type="time"/);
 assert.equal(s.editor.savePatternDay(work,'n','elna',2,new Map([['applies','yes'],['guardianId','mare'],['changeTime','20:30']])),'');
 assert.equal(JSON.stringify(s.state.extraRotations),savedBefore);
 assert.equal(drafts.n.assignments.elna[2],'mare');assert.equal(drafts.n.nightTimes[2],'20:30');
 assert.equal(s.editor.saveDraft(s.state,drafts,'n'),'');
 assert.equal(s.core.nightAssignment(s.state.extraRotations,'2026-11-03','elna'),'mare');
 assert.equal(s.core.nightTimeFor(s.state.extraRotations,'2026-11-03','elna'),'20:30');
});

test('una hora invàlida no canvia parcialment el tutor; l’hora general elimina la personalització',()=>{
 const s=setup(),r=s.night('n');s.state.extraRotations=[r];r.nightTimes={2:'18:00'};
 const before=JSON.stringify(r);
 assert.notEqual(s.editor.savePatternDay(s.state,'n','elna',2,new Map([['applies','yes'],['guardianId','mare'],['changeTime','25:00']])),'');
 assert.equal(JSON.stringify(r),before);
 assert.equal(s.editor.savePatternDay(s.state,'n','elna',2,new Map([['applies','yes'],['guardianId',''],['changeTime','19:00']])),'');
 assert.equal(r.assignments.elna[2],'');assert.equal(r.nightTimes[2],undefined);
});

test('cada fill pot tenir una hora de canvi distinta i el final inclou l’última nit fins l’endemà',()=>{
 const s=setup(),a=s.night('a','2026-11-01','2026-11-03'),b=s.night('b','2026-11-01',undefined,['blai']);
 a.startTime='21:00';b.startTime='18:00';s.state.extraRotations=[a,b];
 const lookup=id=>s.guardians.find(g=>g.id===id),get=(date,id)=>s.core.nightAssignment(s.state.extraRotations,date,id),previous=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-1);return d.toISOString().slice(0,10);};
 for(const [child,minute] of [['elna',1260],['blai',1080]]){
  const parts=s.ctx.window.dayTimelineUI.overnightSegments('2026-11-03',child,s.core.nightTimeFor(s.state.extraRotations,'2026-11-03',child),get,previous,lookup,['pare','mare']);
  assert.equal(parts[0].to,minute);assert.equal(parts[1].from,minute);
 }
 assert.equal(s.core.nightTimeFor(s.state.extraRotations,'2026-11-04','elna'),'21:00');
 const parts=s.ctx.window.dayTimelineUI.overnightSegments('2026-11-04','elna','21:00',get,previous,lookup,['pare','mare']);
 assert.equal(parts[0].visible,true);assert.equal(parts[1].visible,false);
 assert.equal(s.core.nightTimeFor(s.state.extraRotations,'2026-11-05','elna'),'19:00');
});

test('les hores puntuals són per fill i la restauració d’un dia neteja totes les seves hores',()=>{
 const s=setup();s.state.extraRotations=[s.night('a','2026-11-01',undefined,['elna','blai'])];
 s.state.nightDateTimes=s.core.cleanNightDateTimes({'2026-11-02':'18:00','2026-11-02|blai':'20:00'},s.children);
 assert.equal(s.core.nightTimeFor(s.state.extraRotations,'2026-11-02','elna',s.state.nightDateTimes),'18:00');
 assert.equal(s.core.nightTimeFor(s.state.extraRotations,'2026-11-02','blai',s.state.nightDateTimes),'20:00');
 assert.equal(s.ctx.window.monthDayUI.hasChanges(s.state,'2026-11-02'),true);
 s.core.clearDate(s.state,'2026-11-02');assert.deepEqual(plain(s.state.nightDateTimes),{});
});

test('el canvi entre patrons consecutius utilitza l’hora del nou patró sense perdre l’última nit anterior',()=>{
 const s=setup(),a=s.night('a','2026-11-01','2026-11-30'),b=s.night('b','2026-12-01');
 a.startTime='21:00';b.startTime='18:00';b.assignments.elna.fill('mare');
 const list=s.core.cleanExtras([a,b],s.children,s.guardians);
 assert.equal(s.core.nightTimeFor(list,'2026-12-01','elna'),'18:00');
 const parts=s.ctx.window.dayTimelineUI.overnightSegments('2026-12-01','elna','18:00',(d,id)=>s.core.nightAssignment(list,d,id),()=> '2026-11-30',id=>s.guardians.find(g=>g.id===id),['pare','mare']);
 assert.deepEqual(plain(parts.map(p=>[p.from,p.to,p.guardianId])),[[0,1080,'pare'],[1080,1440,'mare']]);
});

test('el calendari real de Mes, Setmana i Dia resol cada pernocta i hora per fill',()=>{
 const s=setup(),a=s.night('a'),b=s.night('b','2026-11-01',undefined,['blai']);
 a.startTime='21:00';b.startTime='18:00';b.assignments.blai.fill('mare');s.state.extraRotations=[a,b];
 s.state.preferences={visibleGuardians:['pare','mare']};
 Object.assign(s.ctx,{rotationPatterns:s.core,dayTimelineUI:s.ctx.window.dayTimelineUI,monthDayUI:s.ctx.window.monthDayUI,
  schoolActivities:()=>[],extraSlots:()=>[],guardian:id=>s.guardians.find(g=>g.id===id),timelineZoomForView:()=>50,
  fullDate:String,weekLong:['Dl','Dt','Dc','Dj','Dv','Ds','Dg'],selectedDate:'2026-11-02'});
 const source=read('app.js'),section=(a,b)=>source.slice(source.indexOf(a),source.indexOf(b,source.indexOf(a)));
 vm.runInContext(section('function localDate(', 'function monthTitle(')+section('function nightChangeTime(', 'function overridden(')+section('function monthData(', 'function miniBands('),s.ctx);
 const month=s.ctx.monthData('2026-11-02',s.children);
 assert.equal(month.nights.elna[0].to,1260);assert.equal(month.nights.blai[0].to,1080);
 const day=s.ctx.dayTimeline('2026-11-02',s.children);
 assert.match(day,/21:00/);assert.match(day,/18:00/);
 const week=s.ctx.weekTimeline('2026-11-02',s.children);
 assert.match(week,/21:00/);assert.match(week,/18:00/);
});

test('eliminar persones neteja totes les pernoctes sense assignar-ne automàticament a altres fills',()=>{
 const s=setup();s.state.extraRotations=[s.night('a','2026-11-01',undefined,['elna','blai'])];
 s.core.removeGuardian(s.state,'pare','mare');
 assert.deepEqual(plain(s.state.extraRotations[0].assignments.elna),Array(7).fill('mare'));
 s.core.removeChild(s.state,'elna');
 assert.deepEqual(plain(s.state.extraRotations[0].childIds),['blai']);
 assert.equal(s.state.extraRotations[0].assignments.elna,undefined);
 assert.equal(s.core.nightAssignment(s.state.extraRotations,'2026-11-02','elna'),'');
 assert.equal(s.core.nightAssignment(s.state.extraRotations,'2026-11-02','blai'),'mare');
});
