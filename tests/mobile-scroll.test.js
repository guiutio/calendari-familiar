import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const start=js.indexOf('function render()');
const end=js.indexOf('function notify(',start);
assert.ok(start>=0&&end>start);
const renderSource=js.slice(start,end);

test('barra inferior dins la graella, amb zona principal desplaçable',()=>{
  const rules=css.slice(css.indexOf('/* v0.1.11 · Scroll estable'));
  assert.match(rules,/grid-template-rows:minmax\(0,1fr\) auto/);
  assert.match(rules,/\.main-area \{[^}]*overflow-y:auto/);
  assert.match(rules,/\.mobile-tabs \{position:static/);
  assert.match(rules,/#app \{height:100vh;height:100dvh/);
  assert.match(rules,/\.sheet \{[^}]*87dvh/);
});

test('render preserva el desplaçament de la vista i el diàleg, i el reinicia en navegar',()=>{
  let main={dataset:{scrollKey:'calendar|month|||'},scrollTop:320};
  let dialog={dataset:{sheetKey:'{"type":"filters"}'},scrollTop:146};
  const app={
    querySelector(sel){return sel==='.main-area'?main:sel==='.sheet'?dialog:null;},
    set innerHTML(_value){main={dataset:{},scrollTop:0};dialog={dataset:{sheetKey:'{"type":"filters"}'},scrollTop:0};}
  };
  const doc={body:{style:{overflow:''}}};
  const factory=new Function('$app','document','layout','calendarPage','rotationPage','schoolsPage','settingsPage','schoolNav','sheet','calendarView',
    'let tab="calendar";'+renderSource+';return {render,setTab:(value)=>{tab=value;}};');
  const control=factory(app,doc,()=>'',()=>'',()=>'',()=>'',()=>'',{}, {type:'filters'},'month');
  control.render();
  assert.equal(main.scrollTop,320);
  assert.equal(dialog.scrollTop,146);
  assert.equal(doc.body.style.overflow,'hidden');
  main.scrollTop=410;
  control.setTab('schools');
  control.render();
  assert.equal(main.scrollTop,0);
});
