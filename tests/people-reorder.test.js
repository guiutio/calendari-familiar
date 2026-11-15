import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../people-reorder.js',import.meta.url),'utf8');
function setup(kind='child'){
 const events={},windowEvents={},commits=[],frames=new Map();let serial=0,animations=0;
 class Element {
  constructor(className=''){this.className=className;this.children=[];this.dataset={};this.style={};this.attributes={};this.isConnected=true;
   this.classList={add:name=>this.className+=' '+name,remove:name=>this.className=this.className.split(' ').filter(n=>n!==name).join(' ')};}
  matches(name){return this.className.split(' ').includes(name.slice(1));}
  closest(name){return this.matches(name)?this:this.parentElement?.closest(name);}
  insertBefore(child,next){child.remove();const index=next?this.children.indexOf(next):this.children.length;assert.ok(index>=0);this.children.splice(index,0,child);child.parentElement=this;}
  remove(){if(this.parentElement){const items=this.parentElement.children;items.splice(items.indexOf(this),1);this.parentElement=null;}}
  querySelectorAll(name){return this.children.flatMap(child=>[...(child.matches(name)?[child]:[]),...child.querySelectorAll(name)]);}
  setAttribute(key,value){this.attributes[key]=value;}
  removeAttribute(key){if(key==='style')this.style={};else delete this.attributes[key];}
  getBoundingClientRect(){
   if(this.matches('.main-area'))return {top:0,bottom:400};
   if(this.matches('.person-dragging'))return {top:Number.parseFloat(this.style.top),height:60,left:0,width:300};
   const siblings=this.parentElement?.children??[];const index=siblings.indexOf(this);
   return {top:100+siblings.slice(0,index).filter(n=>!n.matches('.person-dragging')).length*60-(scroller.scrollTop??0),height:60,left:0,width:300};
  }
  animate(){animations++;return {cancel(){}};}
  focus(){this.focused=true;}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
 }
 const root=new Element(),scroller=new Element('main-area'),list=new Element('people-list');scroller.scrollTop=0;scroller.scrollHeight=1000;scroller.clientHeight=400;
 root.addEventListener=(type,fn)=>events[type]=fn;root.insertBefore(scroller,null);scroller.insertBefore(list,null);list.dataset.kind=kind;
 const handles={};
 for(const id of ['a','b','c','d']){
  const row=new Element('person-list-row');row.dataset.id=id;list.insertBefore(row,null);
  const handle=new Element('person-drag-handle');row.insertBefore(handle,null);handles[id]=handle;
 }
 const context={window:{matchMedia:()=>({matches:false}),addEventListener:(type,fn)=>windowEvents[type]=fn,innerHeight:400},document:{scrollingElement:scroller,createElement:()=>new Element()},
  getComputedStyle:element=>({overflowY:element===scroller?'auto':'visible'}),requestAnimationFrame:fn=>{frames.set(++serial,fn);return serial;},cancelAnimationFrame:id=>frames.delete(id)};
 vm.runInNewContext(source,context);context.window.peopleReorder.mount(root,(...args)=>commits.push(args));
 const fire=(type,id='a',extra={})=>{const event={target:handles[id],button:0,isPrimary:true,pointerId:1,clientY:130,preventDefault(){this.prevented=true;},stopPropagation(){},...extra};events[type]?.(event);return event;};
 return {fire,commits,handles,list,scroller,frames,windowEvents,order:()=>list.querySelectorAll('.person-list-row').map(row=>row.dataset.id),get animations(){return animations;}};
}
for(const pointerType of ['mouse','touch','pen'])test(`${pointerType}: la posició es previsualitza i només es desa en deixar anar`,()=>{
 const s=setup();s.fire('pointerdown','a',{pointerType});
 assert.equal(s.handles.a.attributes['aria-pressed'],'true');
 s.fire('pointermove','a',{clientY:340,pointerType});
 assert.equal(s.commits.length,0);assert.ok(s.animations>0);
 s.fire('pointerup','a',{clientY:340,pointerType});
 assert.deepEqual(s.order(),['b','c','d','a']);assert.deepEqual(s.commits,[['child','a',3]]);
 assert.equal(s.handles.a.attributes['aria-pressed'],'false');assert.equal(s.frames.size,0);
 assert.equal(s.list.children.length,4);
});
test('arrossegar un tutor cap amunt conserva el grup',()=>{
 const s=setup('guardian');s.fire('pointerdown','d',{clientY:310});s.fire('pointermove','d',{clientY:110});s.fire('pointerup','d');
 assert.deepEqual(s.order(),['d','a','b','c']);assert.deepEqual(s.commits,[['guardian','d',0]]);
});
for(const cancel of ['pointercancel','lostpointercapture','Escape','blur'])test(`${cancel}: restaura l’ordre original sense desar`,()=>{
 const s=setup();s.fire('pointerdown','b',{clientY:190});s.fire('pointermove','b',{clientY:340});
 if(cancel==='Escape')s.fire('keydown','b',{key:'Escape'});else if(cancel==='blur')s.windowEvents.blur();else s.fire(cancel,'b');
 assert.deepEqual(s.order(),['a','b','c','d']);assert.equal(s.commits.length,0);assert.equal(s.list.children.length,4);assert.equal(s.frames.size,0);
});
test('un altre dit, botó secundari o gest sense canvi no reordena',()=>{
 const s=setup();s.fire('pointerdown','a',{button:2});assert.equal(s.frames.size,0);
 s.fire('pointerdown','a');s.fire('pointermove','a',{pointerId:2,clientY:340});s.fire('pointerup','a',{pointerId:2});
 assert.equal(s.commits.length,0);s.fire('pointerup','a');assert.deepEqual(s.order(),['a','b','c','d']);assert.equal(s.commits.length,0);
});
test('el teclat mou l’element, manté el focus i respecta els extrems',()=>{
 const s=setup();s.fire('keydown','a',{key:'ArrowUp'});assert.equal(s.commits.length,0);
 s.fire('keydown','a',{key:'End'});assert.deepEqual(s.order(),['b','c','d','a']);
 s.fire('keydown','a',{key:'ArrowUp'});assert.deepEqual(s.order(),['b','c','a','d']);
 s.fire('keydown','a',{key:'Home'});assert.deepEqual(s.order(),['a','b','c','d']);
 assert.equal(s.handles.a.focused,true);assert.deepEqual(s.commits.map(c=>c[2]),[3,2,0]);
});
test('a prop de la vora fa scroll automàtic i el cancel·la en acabar',()=>{
 const s=setup();s.fire('pointerdown','a');s.fire('pointermove','a',{clientY:390});
 const [id,tick]=[...s.frames.entries()][0];s.frames.delete(id);tick();assert.ok(s.scroller.scrollTop>0);
 s.fire('pointercancel','a');assert.equal(s.frames.size,0);
});

test('les escoles reutilitzen el gest i comuniquen la posició dins de la seva llista',()=>{
 const s=setup('school');s.fire('pointerdown','a');s.fire('pointermove','a',{clientY:340});s.fire('pointerup','a');
 assert.deepEqual(s.order(),['b','c','d','a']);assert.deepEqual(s.commits,[['school','a',3]]);
});

test('els grups classe reutilitzen la nansa per arrossegar i el teclat',()=>{
 const s=setup('group');s.fire('pointerdown','d',{clientY:310});s.fire('pointermove','d',{clientY:110});s.fire('pointerup','d');
 assert.deepEqual(s.order(),['d','a','b','c']);assert.deepEqual(s.commits,[['group','d',0]]);
 s.fire('keydown','d',{key:'End'});assert.deepEqual(s.order(),['a','b','c','d']);assert.deepEqual(s.commits[1],['group','d',3]);
});

for(const kind of ['ec-activity','ec-group'])test(`${kind}: nansa d’extraescolars amb desament en deixar anar`,()=>{
 const s=setup(kind);s.fire('pointerdown','a');s.fire('pointermove','a',{clientY:340});assert.equal(s.commits.length,0);s.fire('pointerup','a');
 assert.deepEqual(s.order(),['b','c','d','a']);assert.deepEqual(s.commits,[[kind,'a',3]]);
});
