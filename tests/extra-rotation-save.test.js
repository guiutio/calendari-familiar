import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const between=(a,b)=>app.slice(app.indexOf(a),app.indexOf(b,app.indexOf(a)));
const plain=value=>JSON.parse(JSON.stringify(value));
function setup(){
 let saves=0,renders=0,sequence=0;
 const messages=[];
 const rotation=id=>({id,name:id,startDate:'2026-10-26',length:7,startTime:'16:30',endTime:'17:30',
  childIds:['elna','blai'],assignments:{elna:Array(7).fill('pare'),blai:Array(7).fill('mare')},activeDays:Array(7).fill(true),
  childActiveDays:{elna:Array(7).fill(true),blai:Array(7).fill(true)}});
 const state={children:[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}],guardians:[{id:'pare',name:'Pare'},{id:'mare',name:'Mare'}],
  extraRotations:[rotation('a'),rotation('b')],extraExceptions:{
   'a|2026-10-29|elna':{startTime:'16:00',endTime:'18:00',guardianId:'mare',disabled:false},
   'b|2026-10-29|elna':{startTime:'16:00',endTime:'18:00',guardianId:'pare',disabled:false}},
  rotation:{length:7,changeTime:'19:00',assignments:{elna:Array(7).fill('pare'),blai:Array(7).fill('mare')}}};
 const ctx=vm.createContext({window:{},state,extraRotationDrafts:{},extraRotationOpen:null,extraRotationUnits:{},sheet:null,
  newId:()=>`new-${++sequence}`,localDate:()=> '2026-10-31',confirm:()=>true,
  render:()=>renders++,update:()=>saves++,notify:message=>messages.push(message),FormData:class{constructor(form){return new Map(Object.entries(form.fields));}}});
 for(const file of ['rotation-patterns.js','rotation-editor.js'])vm.runInContext(readFileSync(new URL('../'+file,import.meta.url),'utf8'),ctx);
 ctx.rotationEditor=ctx.window.rotationEditor;
 vm.runInContext(between('function clickAction(button)',"document.addEventListener('click'"),ctx);
 vm.runInContext('function submitPattern(form,event){'+between('if (form.dataset.extraPatternDayForm)', 'if (form.dataset.extraDateForm)')+'}',ctx);
 const click=(action,rotation='a',data={})=>ctx.clickAction({dataset:{action,rotation,...data}});
 const change=(field,value,id='a')=>ctx.rotationEditor.change(ctx.rotationEditor.draftState(state,ctx.extraRotationDrafts,id),{rotation:id,extraChange:field},value,ctx.extraRotationUnits);
 const submit=(fields,id='a',child='elna',index=0)=>ctx.submitPattern({dataset:{extraPatternDayForm:'true',rotation:id,child,index},fields},{preventDefault(){}});
 return {ctx,state,click,change,submit,messages,get saves(){return saves;},get renders(){return renders;}};
}

test('els botons comuns creen, pleguen i desen diverses pernoctes, amb error visible si se solapen',()=>{
 const s=setup();s.click('extra-add','',{kind:'night'});
 assert.equal(s.ctx.extraRotationDrafts['new-1'].kind,'night');assert.equal(s.state.extraRotations.length,2);
 s.change('endDate','2026-11-30','new-1');s.click('extra-save','new-1');
 assert.equal(s.state.extraRotations.length,3);assert.equal(s.saves,1);
 s.click('extra-toggle','new-1');assert.equal(s.ctx.extraRotationOpen,null);
 s.click('extra-add','',{kind:'night'});s.click('extra-save','new-2');
 assert.equal(s.state.extraRotations.length,3);assert.equal(s.saves,1);
 assert.match(s.messages.at(-1),/se solapen/);assert.ok(s.ctx.extraRotationDrafts['new-2']);
 s.change('startDate','2026-12-01','new-2');s.click('extra-save','new-2');
 assert.equal(s.state.extraRotations.length,4);assert.equal(s.saves,2);
});
test('editar camps, dies, participants i còpies no modifica dades confirmades ni desa automàticament',()=>{
 const s=setup(),before=JSON.stringify(s.state);
 s.click('extra-toggle');s.change('name','Recollida');s.change('startTime','15:30');s.change('startDate','2026-11-02');
 s.submit({applies:'yes',guardianId:'mare'});s.click('extra-copy','a',{child:'blai',from:'elna'});
 s.click('extra-child','a',{child:'blai'});
 assert.equal(JSON.stringify(s.state),before);
 assert.equal(s.saves,0);
 assert.equal(s.ctx.extraRotationDrafts.a.name,'Recollida');
 assert.equal(s.ctx.extraRotationDrafts.a.assignments.elna[0],'mare');
 assert.deepEqual(plain(s.ctx.extraRotationDrafts.a.childIds),['elna']);
});
test('Desa els canvis confirma només la rotació triada i conserva els altres esborranys',()=>{
 const s=setup(),other=plain(s.state.extraRotations[1]),night=plain(s.state.rotation);
 s.click('extra-toggle');s.change('name','Recollida');s.submit({applies:'no',guardianId:'pare'});
 s.click('extra-toggle','b');s.change('name','Pendent B','b');
 s.click('extra-save');
 assert.equal(s.state.extraRotations[0].name,'Recollida');
 assert.equal(s.state.extraRotations[0].childActiveDays.elna[0],false);
 assert.deepEqual(plain(s.state.extraRotations[1]),other);
 assert.deepEqual(plain(s.state.rotation),night);
 assert.equal(s.ctx.extraRotationDrafts.a,undefined);
 assert.equal(s.ctx.extraRotationDrafts.b.name,'Pendent B');
 assert.equal(s.saves,1);
});
test('descartar restaura el patró desat i tancar/reobrir no confirma canvis',()=>{
 const s=setup(),before=JSON.stringify(s.state);
 s.click('extra-toggle');s.change('name','Pendent');s.click('extra-toggle');s.click('extra-toggle');
 assert.equal(s.ctx.extraRotationDrafts.a.name,'Pendent');assert.equal(s.saves,0);
 s.click('extra-cancel');
 assert.equal(s.ctx.extraRotationDrafts.a,undefined);
 assert.equal(JSON.stringify(s.state),before);assert.equal(s.saves,0);
});
test('les rotacions noves només existeixen a l’esborrany fins a desar, i es poden descartar',()=>{
 const s=setup();s.click('extra-add');
 assert.equal(s.state.extraRotations.length,2);assert.equal(s.ctx.extraRotationOpen,'new-1');
 assert.equal(s.saves,0);s.click('extra-cancel','new-1');
 assert.equal(s.ctx.extraRotationDrafts['new-1'],undefined);assert.equal(s.ctx.extraRotationOpen,null);
 s.click('extra-add');s.change('name','Nova activitat','new-2');s.click('extra-save','new-2');
 assert.equal(s.state.extraRotations.length,3);assert.equal(s.state.extraRotations[2].name,'Nova activitat');assert.equal(s.saves,1);
});
test('treure un participant només neteja les seves excepcions en confirmar el patró',()=>{
 const s=setup();s.click('extra-child','a',{child:'elna'});
 assert.ok(s.state.extraExceptions['a|2026-10-29|elna']);
 s.click('extra-save');
 assert.equal(s.state.extraExceptions['a|2026-10-29|elna'],undefined);
 assert.ok(s.state.extraExceptions['b|2026-10-29|elna']);
});
test('canviar la durada conserva patrons de dies actius amb longitud vàlida abans de desar',()=>{
 const s=setup();s.click('extra-toggle');s.change('unit','days');s.change('length','10');
 assert.equal(s.state.extraRotations[0].length,7);
 assert.equal(s.ctx.extraRotationDrafts.a.childActiveDays.elna.length,10);
 s.click('extra-save');assert.equal(s.state.extraRotations[0].length,10);
 assert.equal(s.saves,1);
});
test('un esborrany invàlid no es desa ni modifica parcialment el calendari',()=>{
 const s=setup(),before=JSON.stringify(s.state);s.click('extra-toggle');
 s.ctx.extraRotationDrafts.a.startTime='25:00';s.click('extra-save');
 assert.equal(JSON.stringify(s.state),before);assert.equal(s.saves,0);assert.ok(s.ctx.extraRotationDrafts.a);
 assert.ok(s.messages.length);
});
test('les excepcions del calendari editades mentre hi ha esborranys es conserven en desar',()=>{
 const s=setup();s.click('extra-toggle');s.change('name','Canvi patró');
 s.state.extraExceptions['a|2026-10-29|elna'].endTime='18:45';
 s.click('extra-save');assert.equal(s.state.extraExceptions['a|2026-10-29|elna'].endTime,'18:45');
});

test('cada editor mostra les accions de desar i descartar, amb el patró encara sense confirmar',()=>{
 const s=setup();s.click('extra-toggle');s.change('name','Esborrany A');
 const view=s.ctx.rotationEditor.draftState(s.state,s.ctx.extraRotationDrafts);
 const html=s.ctx.rotationEditor.render(view,'a',{});
 assert.match(html,/data-action="extra-save" data-rotation="a">Desa els canvis/);
 assert.match(html,/data-action="extra-cancel" data-rotation="a">Descarta canvis/);
 assert.match(html,/Esborrany A/);
 assert.equal(s.state.extraRotations[0].name,'a');
});
