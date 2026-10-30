import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const ui=readFileSync(new URL('../school-timeline.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const context={window:{}};
vm.runInNewContext(ui,context);
const {collect,range,render}=context.window.schoolCalendarUI;
const children=[{id:'elna',name:'Elna'},{id:'blai',name:'Blai'}];
const group={childIds:['elna','blai']};
const school={id:'escola',name:'Escola',color:'#74c6a3',years:[{startDate:'2026-09-01',endDate:'2027-06-30',holidays:['2026-11-03'],groups:[group]}]};
const getSessions=(_s,_y,_g,id,_d)=>id==='elna'
 ? [{id:'s1',startTime:'08:30',endTime:'09:30',kind:'classe',label:'Matemàtiques'},
    {id:'s2',startTime:'10:30',endTime:'12:00',kind:'pati',label:''}]
 : [{id:'s3',startTime:'09:00',endTime:'10:00',kind:'menjador',label:''}];
test('només activitats reals dels centres activats i per fill',()=>{
 const activities=collect('2026-11-02',children,[school],['escola'],getSessions);
 assert.equal(activities.length,3);
 assert.equal(collect('2026-11-02',children,[school],[],getSessions).length,0);
 assert.equal(collect('2026-11-03',children,[school],['escola'],getSessions).length,0);
 assert.equal(collect('2027-07-01',children,[school],['escola'],getSessions).length,0);
});
test('la cronologia manté els minuts i el mateix origen setmanal',()=>{
 const activities=collect('2026-11-02',children,[school],['escola'],getSessions);
 assert.deepEqual(Array.from(range(activities)),[480,720]);
 const output=render('2026-11-02','2 de novembre',children,activities);
 assert.match(output,/top:27px;height:54px/); // 08:30, 60 minuts
 assert.match(output,/top:135px;height:81px/); // 10:30, 90 minuts
 assert.match(output,/08:30–09:30/);
 assert.match(output,/Matemàtiques/);
 assert.match(output,/school-timeline-details/);
 const shared=render('2026-11-02','2 de novembre',children,activities,[420,780]);
 assert.match(shared,/top:81px;height:54px/); // 08:30 respecte 07:00
});
test('evita HTML maliciós procedent de descripcions',()=>{
 const a=collect('2026-11-02',children,[school],['escola'],getSessions);
 a[0].description='<script>alert(1)</script>';
 const out=render('2026-11-02','2 de novembre',children,a);
 assert.doesNotMatch(out,/<script>/);
 assert.match(out,/&lt;script&gt;/);
});
test('els recursos s’inclouen a la PWA i el JS d’inici',()=>{
 assert.match(html,/school-timeline\.js\?v=0\.5\.10/);
 assert.match(sw,/school-timeline\.js\?v=0\.5\.10/);
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/schoolCalendarUI\?\.render/);
 assert.match(app,/dayTimelineUI\.renderWeek/);
 assert.match(app,/snapshot\.activities\.length/);
});
