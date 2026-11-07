import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const between=(a,b)=>{const start=app.indexOf(a),end=app.indexOf(b,start);assert.ok(start>=0&&end>start);return app.slice(start,end);};
function setup(){
 let paints=0,saves=0,serial=0;
 const timers=new Map(),listeners=new Map(),body={style:{overflow:''}};
 const doc={activeElement:body,body,addEventListener:(name,fn)=>listeners.set(name,fn)};
 class Input{
  constructor(type,action,value=''){this.type=type;this.dataset={action};this.value=value;this.isConnected=true;}
  blur(){doc.activeElement=body;listeners.get('focusout')?.({target:this});}
 }
 class Select{};class Textarea{};
 const win={setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id)};
 const child={id:'c',birthDate:''};
 const ctx=vm.createContext({weekFocusTarget:false,mountWeekNavigation:()=>{},document:doc,window:win,HTMLInputElement:Input,HTMLSelectElement:Select,HTMLTextAreaElement:Textarea,
  $app:{querySelector:()=>null,set innerHTML(_html){paints++;}},
  monthPosition:()=>null,stopCalendarScroll:null,mountCalendarScroll:()=>{},tab:'people',calendarView:'day',selectedDate:'2026-10-31',
  schoolNav:{},sheet:null,weekStart:d=>d,layout:()=>'',peoplePage:()=>'',calendarPage:()=>'',schoolsPage:()=>'',settingsPage:()=>'',rotationPage:()=>'',
  state:{children:[child],nightDateTimes:{},preferences:{},extraRotations:[{id:'r',kind:'night',startDate:'2026-10-01',startTime:'19:00'}]},childById:id=>id==='c'?child:null,
  isValidDate:value=>/^\d{4}-\d{2}-\d{2}$/.test(value),validChangeTime:value=>value,
  notify:()=>{},saveState:()=>saves++,update:()=>{saves++;ctx.render();},
  rotationDraft:{startDate:'2026-10-01',changeTime:'19:00'},extraRotationDrafts:{},extraRotationUnits:{},
  rotationEditor:{draftState:state=>state,change:(state,data,value)=>{state.extraRotations[0][data.extraChange]=value;return {save:true};}}});
 vm.runInContext(between('let nativePickerRenderPending', 'function notify('),ctx);
 vm.runInContext(between("document.addEventListener('change'", "document.addEventListener('keydown'"),ctx);
 vm.runInContext(between("document.addEventListener('pointerdown'", 'async function init()'),ctx);
 const fire=(name,event={})=>listeners.get(name)?.(event);
 const change=input=>fire('change',{target:input});
 const tick=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(fn=>fn());};
 return {ctx,doc,Input,child,fire,change,tick,get paints(){return paints;},get saves(){return saves;}};
}
test('el selector de naixement conserva el mateix camp mentre es canvien any, mes i dia',()=>{
 const s=setup(),input=new s.Input('date','child-birth');input.dataset.child='c';s.doc.activeElement=input;
 for(const date of ['2014-01-01','2014-07-01','2014-07-16']){input.value=date;s.change(input);assert.equal(s.paints,0);assert.equal(s.doc.activeElement,input);}
 assert.equal(s.child.birthDate,'2014-07-16');assert.equal(s.saves,3);
 input.blur();s.tick();assert.equal(s.paints,1);
});
test('les hores de pernocta no tanquen el selector ni el panell durant la selecció',()=>{
 const s=setup(),input=new s.Input('time','night-date-time');input.dataset.date='2026-10-31';input.dataset.child='c';s.doc.activeElement=input;
 s.ctx.sheet={type:'bandEdit',date:'2026-10-31',band:'nit',childId:'c'};
 for(const value of ['18:00','18:30','18:45']){input.value=value;s.change(input);assert.equal(s.paints,0);assert.equal(s.ctx.sheet.type,'bandEdit');}
 assert.equal(s.ctx.state.nightDateTimes['2026-10-31|c'],'18:45');input.blur();s.tick();assert.equal(s.paints,1);
});
test('les dates i hores dels patrons també mantenen viu el control nadiu',()=>{
 const s=setup();
 for(const [type,action,values,key] of [['date','',['2026-11-01','2026-11-12'],'startDate'],['time','',['18:00','18:45'],'startTime']]){
  const input=new s.Input(type,action);input.dataset.extraChange=key;input.dataset.rotation='r';s.doc.activeElement=input;
  const before=s.paints;for(const value of values){input.value=value;s.change(input);s.ctx.render();assert.equal(s.paints,before);}
  assert.equal(s.ctx.state.extraRotations[0][key],values.at(-1));input.blur();s.tick();
 }
 const extra=new s.Input('date','');extra.dataset.extraChange='startDate';extra.dataset.rotation='r';s.doc.activeElement=extra;
 s.change(extra);s.ctx.render();assert.equal(s.paints,2);extra.blur();s.tick();assert.equal(s.paints,3);
});
test('tots els tipus de selector nadiu ajornen redibuixos fins que s’acaba la interacció',()=>{
 for(const type of ['date','time','datetime-local','month','week','color']){
  const s=setup(),input=new s.Input(type,'');s.doc.activeElement=input;
  s.ctx.render();s.ctx.render();s.tick();assert.equal(s.paints,0,type);
  s.ctx.finishNativePickerEdit();s.tick();assert.equal(s.paints,1,type);
 }
});
test('el clic de Desa no perd el botó si change es produeix després de desenfocar',()=>{
 const s=setup(),input=new s.Input('date','child-birth','2014-07-16');input.dataset.child='c';
 s.doc.activeElement=input;s.fire('pointerdown');input.blur();s.change(input);s.tick();
 assert.equal(s.paints,0,'No es pot substituir la pantalla entre pointerdown i click');
 s.fire('pointerup');
 let actionHandled=false;
 s.fire('click');actionHandled=true;
 assert.equal(s.paints,0);assert.equal(actionHandled,true);s.tick();assert.equal(s.paints,1);
});
test('passar a un altre camp no el destrueix ni fa perdre els valors del formulari',()=>{
 const s=setup(),date=new s.Input('date','','2026-11-01');s.doc.activeElement=date;s.ctx.render();
 date.blur();const text=new s.Input('text','','Activitat personal');s.doc.activeElement=text;s.tick();assert.equal(s.paints,0);
 assert.equal(text.value,'Activitat personal');text.blur();s.tick();assert.equal(s.paints,1);
});
test('la confirmació explícita pot tancar el selector i redibuixar immediatament',()=>{
 const s=setup(),input=new s.Input('time','','17:45');s.doc.activeElement=input;s.ctx.render();
 s.ctx.finishNativePickerEdit();s.ctx.render();s.tick();assert.equal(s.paints,1);
});
