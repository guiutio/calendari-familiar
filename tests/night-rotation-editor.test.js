import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const ts=readFileSync(new URL('../src/app.ts',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const start=app.indexOf('    if (form.dataset.rotationCellForm) {');
const end=app.indexOf('    if (form.dataset.extraDateForm) {',start);
assert.ok(start>=0&&end>start,'S’ha trobat el tractament del formulari únic');
const handler='function submitRotationCell(form,event){\n'+app.slice(start,end)+'}\n';
const make=()=>{
 let renders=0;
 const messages=[];
 const state={children:[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}],
  guardians:[{id:'pare',name:'Pare'},{id:'mare',name:'Mare'}],
  rotation:{startDate:'2026-10-19',length:7,changeTime:'19:00',
    assignments:{elna:['pare','pare','mare','mare','pare','pare','pare'],blai:['pare','mare','mare','pare','pare','mare','mare']}}};
 const context=vm.createContext({
   state,rotationDraft:JSON.parse(JSON.stringify(state.rotation)),nightPatternDraft:{2:'18:15'},
   sheet:{type:'rotationCell',childId:'elna',index:2},
   rotationPatterns:{validClock:t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)},
   childById:id=>state.children.find(c=>c.id===id),
   guardian:id=>state.guardians.find(g=>g.id===id),
   FormData:class {constructor(form){this.fields=new Map(Object.entries(form.fields));}get(name){return this.fields.get(name)??null;}},
   render:()=>{renders++;},
   notify:message=>messages.push(message)
 });
 vm.runInContext(handler,context);
 const submit=(fields,child='elna',index='2')=>{
   let prevented=false;
   context.form={dataset:{rotationCellForm:'true',child,index},fields};
   context.event={preventDefault:()=>{prevented=true;}};
   vm.runInContext('submitRotationCell(form,event)',context);
   assert.equal(prevented,true);
 };
 return {context,state,submit,messages,get renders(){return renders;}};
};

test('el tutor i l’hora comparteixen un sol formulari sense graella separada',()=>{
 assert.match(ts,/data-rotation-cell-form="true"/);
 assert.match(ts,/name="guardianId"/);
 assert.match(ts,/name="changeTime" type="time"/);
 assert.match(ts,/Tutor i hora de canvi/);
 assert.match(ts,/Hora general:/);
 assert.match(ts,/Aplica al patró/);
 assert.doesNotMatch(ts,/class="rotation-pattern-times"/);
 assert.doesNotMatch(ts,/data-action="rotation-pattern-time"/);
 assert.doesNotMatch(app,/case 'rotation-set-cell'/);
 assert.match(app,/rotation-cell-time/);
 assert.match(css,/\.rotation-tutor-choice:has\(\.rotation-guardian-radio:checked\)/);
 assert.match(css,/\.rotation-guardian-radio \{position:absolute/);
 assert.match(css,/\.rotation-day-time input\[type="time"\]/);
 assert.match(html,/app\.js\?v=0\.6\.5/);
 assert.match(sw,/calendari-familiar-v0\.6\.5/);
});

test('tutor i hora diferents queden actualitzats conjuntament a l’esborrany del patró',()=>{
 const u=make();
 const savedBefore=JSON.stringify(u.state.rotation);
 u.submit({guardianId:'pare',changeTime:'20:30'});
 assert.equal(u.context.rotationDraft.assignments.elna[2],'pare');
 assert.equal(u.context.nightPatternDraft[2],'20:30');
 assert.equal(u.state.rotation.assignments.elna[2],'mare');
 assert.equal(JSON.stringify(u.state.rotation),savedBefore,'no es desa el patró fins a Desa el patró');
 assert.equal(u.context.sheet,null);
 assert.equal(u.renders,1);
 assert.match(u.messages[0],/Desa el patró/);
});

test('si l’hora escollida és la general, s’elimina la sobreescriptura per dia',()=>{
 const u=make();
 u.submit({guardianId:'mare',changeTime:'19:00'});
 assert.equal(u.context.rotationDraft.assignments.elna[2],'mare');
 assert.equal(Object.hasOwn(u.context.nightPatternDraft,'2'),false);
 assert.equal(u.renders,1);
});

test('canviar només l’hora conserva el tutor i permet deixar la nit sense assignar',()=>{
 const u=make();
 u.submit({guardianId:'mare',changeTime:'17:45'});
 assert.equal(u.context.rotationDraft.assignments.elna[2],'mare');
 assert.equal(u.context.nightPatternDraft[2],'17:45');
 u.context.sheet={type:'rotationCell',childId:'elna',index:2};
 u.submit({guardianId:'',changeTime:'18:00'});
 assert.equal(u.context.rotationDraft.assignments.elna[2],'');
 assert.equal(u.context.nightPatternDraft[2],'18:00');
 assert.equal(u.renders,2);
});

test('horaris, responsables i índexs invàlids no modifiquen cap assignació ni hora',()=>{
 const u=make();
 const snapshot=()=>JSON.stringify([u.context.rotationDraft,u.context.nightPatternDraft]);
 const original=snapshot();
 u.submit({guardianId:'mare',changeTime:'25:00'});
 assert.equal(snapshot(),original);
 u.submit({guardianId:'inexistent',changeTime:'18:00'});
 assert.equal(snapshot(),original);
 u.submit({guardianId:'pare',changeTime:'18:00'},'elna','8');
 assert.equal(snapshot(),original);
 u.submit({guardianId:'pare',changeTime:'18:00'},'no-existeix','2');
 assert.equal(snapshot(),original);
 assert.equal(u.renders,0);
 assert.equal(u.messages.length,4);
});
