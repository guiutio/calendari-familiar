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
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
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
test('la miniatura comprimeix les hores nocturnes sense franges especials, mantenint editors de 24 h',()=>{
 const night=timeline.overnightSegments(date,'elna','19:00',d=>d===date?'mare':'pare',()=>yesterday,id=>guardians.find(g=>g.id===id),['pare','mare']);
 const s=state();ui.save(s,date,'elna','',params('09:00','12:00'),newId);
 const schools=[{childId:'elna',schoolId:'escola',id:'sessio',start:9*60,end:10*60,color:'#66cc99',schoolName:'Escola',kind:'classe',startTime:'09:00',endTime:'10:00'}];
 const output=ui.mini(children,{elna:night,blai:[]},schools,ui.slots(s,date,children,guardians,['pare','mare']));
 assert.match(output,/month-mini-night/);
 assert.match(output,/month-mini-custom/);
 assert.match(output,/month-mini-school/);
 assert.match(output,/class="month-mini night-compressed"/);
 const at19=ui.miniGeometry(19*60,20*60),at9=ui.miniGeometry(9*60,10*60);
 assert.match(output,new RegExp('top:'+at19.top+'%'));
 assert.match(output,new RegExp('top:'+at9.top+'%'));
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
 assert.match(html,/month-day-ui\.js\?v=0\.6\.6/);
 assert.match(sw,/month-day-ui\.js\?v=0\.6\.6/);
 assert.match(ts,/monthDayUI\.mini\(children,snapshot\.nights,snapshot\.activities,snapshot\.slots,snapshot\.extra\)/);
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

test('les setmanes ISO es numeren correctament al límit de l’any',()=>{
 for(const [day,week,year] of [
  ['2020-12-28',53,2020],['2021-01-01',53,2020],
  ['2021-01-04',1,2021],['2026-10-26',44,2026],
  ['2026-12-28',53,2026],['2027-01-01',53,2026],
  ['2027-01-04',1,2027],['2028-01-01',52,2027]
 ]){
  assert.deepEqual({...ui.isoWeek(day)},{week,year},day);
 }
});
test('el mes inclou el número de setmana a la primera columna i obre les vistes reals',()=>{
 assert.match(ts,/const iso=i%7===0\?monthDayUI\.isoWeek\(date\):null/);
 assert.match(ts,/class="month-week-number" data-action="show-calendar-week" data-date="\$\{date\}"/);
 assert.match(ts,/class="day-cell[^\n]+data-action="show-calendar-day" data-date="\$\{date\}"/);
 assert.match(ts,/class="month-week-heading"/);
  assert.match(ts,/case 'show-calendar-week':\{[\s\S]*?const start=weekStart\(date\),today=localDate\(new Date\(\)\);[\s\S]*?selectedDate=today>=start&&today<=addDays\(start,6\)\?today:start;calendarView='week';sheet=null;render\(\);break;/);
 assert.match(ts,/case 'show-calendar-day':\s*case 'open-day':\{/);
 assert.match(ts,/selectedDate=date;calendarView='day';sheet=null/);
 assert.match(app,/case 'show-calendar-week':/);
  assert.match(app,/selectedDate = today >= start && today <= addDays\(start, 6\) \? today : start;/);
 assert.match(css,/\.weekdays,\.month-grid \{grid-template-columns:38px repeat\(7,minmax\(0,1fr\)\);\}/);
 assert.match(css,/\.month-week-number:focus-visible/);
 assert.doesNotMatch(ts,/case 'open-day':\{[^\n]*sheet=\{type:'day'/);
});
test('en obrir Dia es mantenen les opcions d’editar i restaurar franges',()=>{
 assert.match(ts,/class="day-edit-actions"/);
 assert.match(ts,/data-action="day-slot-add" data-date="\$\{selectedDate\}"/);
 assert.match(ts,/monthDayUI\.hasChanges\(state,selectedDate\)/);
 assert.match(ts,/data-action="day-restore" data-date="\$\{selectedDate\}"/);
 assert.match(ts,/monthDayUI\.restore\(state,date\);rotationPatterns\.clearDate\(state,date\);sheet=null;update\(\)/);
 assert.match(app,/monthDayUI\.restore\(state, date\);\s*rotationPatterns\.clearDate\(state, date\);\s*sheet = null;/);
 assert.match(html,/app\.js\?v=0\.6\.6/);
 assert.match(sw,/calendari-familiar-v0\.6\.6/);
});

test('al mes no hi ha pictograma escolar i el número del dia es veu més gran',()=>{
 assert.doesNotMatch(css,/\.school-month-count::before/);
 assert.doesNotMatch(css,/🏫/);
 assert.match(css,/\.month-grid \.day-number\s*\{\s*width:30px;\s*height:30px;\s*font-size:calc\(18px/);
 assert.match(css,/@media\(max-width:560px\)\s*\{[\s\S]*?\.month-grid \.day-number\s*\{\s*width:26px;\s*height:26px;\s*font-size:calc\(16px/);
 assert.match(css,/@media\(max-width:360px\)\s*\{[\s\S]*?\.month-grid \.day-number\s*\{\s*width:24px;\s*height:24px;\s*font-size:calc\(15px/);
 assert.doesNotMatch(ts,/school-month-count/);
 assert.doesNotMatch(app,/school-month-count/);
 assert.match(html,/styles\.css\?v=0\.6\.6/);
 assert.match(sw,/calendari-familiar-v0\.6\.6/);
});

test('el perímetre mensual segueix els dies reals i exclou altres mesos',()=>{
 const classes=(date,year,month,index,total,days)=>ui.outline(date,year,month,index,total,days).split(' ').filter(Boolean);
 // Octubre 2026: comença dijous i acaba dissabte, cinc files en total.
 assert.deepEqual(classes('2026-09-30',2026,9,2,35,31),[]);
 assert.deepEqual(classes('2026-10-01',2026,9,3,35,31),['month-current','month-edge-top','month-edge-left']);
 assert.deepEqual(classes('2026-10-04',2026,9,6,35,31),['month-current','month-edge-top','month-edge-right']);
 assert.deepEqual(classes('2026-10-05',2026,9,7,35,31),['month-current','month-edge-top','month-edge-left']);
 assert.deepEqual(classes('2026-10-26',2026,9,28,35,31),['month-current','month-edge-bottom','month-edge-left']);
 assert.deepEqual(classes('2026-10-31',2026,9,33,35,31),['month-current','month-edge-bottom','month-edge-right']);
 assert.deepEqual(classes('2026-11-01',2026,9,34,35,31),[]);
 // Febrer 2021: el mes ocupa quatre setmanes completes.
 assert.deepEqual(classes('2021-02-01',2021,1,0,28,28),['month-current','month-edge-top','month-edge-left']);
 assert.deepEqual(classes('2021-02-28',2021,1,27,28,28),['month-current','month-edge-bottom','month-edge-right']);
 // Febrer 2026: el primer dia és diumenge, amb tres vores.
 assert.deepEqual(classes('2026-02-01',2026,1,6,35,28),['month-current','month-edge-top','month-edge-left','month-edge-right']);
});
test('el mes no mostra cap comptador escolar i destaca el límit amb una línia gruixuda',()=>{
 assert.doesNotMatch(ts,/class="school-month-count"/);
 assert.doesNotMatch(app,/class="school-month-count"/);
 assert.match(ts,/monthDayUI\.outline\(date,viewYear,viewMonth,i/);
 assert.match(app,/monthDayUI\.outline\(date, viewYear, viewMonth, i/);
 assert.match(ts,/\$\{monthEdges\}" data-action="show-calendar-day"/);
  assert.match(css,/\.month-grid\s*\{--month-outline:#205b99;--month-outline-width:4px;\}/);
  assert.match(css,/\.month-grid \.day-cell\.month-current::after\s*\{[\s\S]*?content:"";[\s\S]*?position:absolute;[\s\S]*?inset:-1px;[\s\S]*?z-index:8;[\s\S]*?pointer-events:none;[\s\S]*?border-style:solid;[\s\S]*?border-color:var\(--month-outline\)/);
  for(const edge of ['top','bottom','left','right'])assert.ok(css.includes('.month-grid .day-cell.month-edge-'+edge+' {--month-'+edge+'-w:var(--month-outline-width);}'));
 assert.match(css,/:root\[data-theme="dark"\] \.month-grid\s*\{--month-outline:#88baff;\}/);
 assert.match(html,/styles\.css\?v=0\.6\.6/);
 assert.match(sw,/calendari-familiar-v0\.6\.6/);
});

test('mes: comprimeix 22:00–06:00 però manté les hores diürnes proporcionals',()=>{
  const total=ui.miniGeometry(0,1440),morning=ui.miniGeometry(0,360),
    evening=ui.miniGeometry(1320,1440),day=ui.miniGeometry(360,1320);
  const near=(a,b)=>assert.ok(Math.abs(a-b)<0.000001,`Esperat ${b}, rebut ${a}`);
  near(total.top,0);near(total.height,100);
  near(morning.height+evening.height+day.height,100);
  assert.ok(morning.height+evening.height<10,'Les 8 hores de nit ocupen menys del 10% de la miniatura');
  assert.ok(day.height>90,'Les hores entre 06:00 i 22:00 reben gairebé tota l’alçada');
  near(ui.miniGeometry(360,420).height,ui.miniGeometry(720,780).height);
  near(ui.miniGeometry(360,420).height,ui.miniGeometry(1260,1320).height);
  assert.ok(ui.miniGeometry(0,60).height<ui.miniGeometry(360,420).height);
  assert.ok(ui.miniGeometry(1380,1440).height<ui.miniGeometry(360,420).height);
  assert.equal(ui.miniGeometry(360,420,true).top,25);
  assert.equal(ui.miniGeometry(540,600,true).top,37.5);
});

test('mes: pernocta habitual NO fa expandir la nit; una franja especial sí',()=>{
  const base={elna:[{from:0,to:360,guardianColor:'#ffadcc',guardianName:'Mare',visible:true},
                    {from:1320,to:1440,guardianColor:'#88bbee',guardianName:'Pare',visible:true}],blai:[]};
  const plain=()=>ui.mini(children,base,[],{},[]);
  assert.match(plain(),/class="month-mini night-compressed"/);
  assert.doesNotMatch(plain(),/night-expanded/);

  const morningSlot={elna:[{from:120,to:240,color:'#4488ff',name:'Excepció',startTime:'02:00',endTime:'04:00'}]};
  const nightCustom=ui.mini(children,base,[],morningSlot,[]);
  assert.match(nightCustom,/class="month-mini night-expanded"/);
  assert.match(nightCustom,/top:8.333333333333334%/);
  assert.match(nightCustom,/height:8.333333333333334%/);

  const nightSchool=ui.mini(children,base,[{childId:'elna',start:330,end:420,color:'#11aa77',schoolName:'Escola'}],{elna:[]},[]);
  assert.match(nightSchool,/class="month-mini night-expanded"/);
  const lateSchool=ui.mini(children,base,[{childId:'elna',start:1260,end:1380,color:'#11aa77',schoolName:'Escola'}],{},[]);
  assert.match(lateSchool,/class="month-mini night-expanded"/);

  const extra=[{childId:'blai',from:1320,to:1440,visible:true,guardianId:'',color:'#77bb33',rotationName:'Recollida',guardianName:'Sense tutor'}];
  assert.match(ui.mini(children,base,[],{},extra),/class="month-mini night-expanded"/);
  assert.match(ui.mini(children,base,[],{},[{...extra[0],visible:false}]),/class="month-mini night-compressed"/);
});

test('mes: franges especials només diürnes mantenen les nits comprimides, inclosos els límits',()=>{
  const slots={elna:[{from:360,to:420,color:'#aaa',name:'Matí',startTime:'06:00',endTime:'07:00'},
                     {from:1260,to:1320,color:'#bbb',name:'Tarda',startTime:'21:00',endTime:'22:00'}]};
  const activities=[{childId:'blai',start:540,end:900,color:'#aabbcc',schoolName:'Escola'}];
  const extra=[{childId:'blai',from:900,to:1020,color:'#5588ee',guardianId:'pare',guardianName:'Pare',rotationName:'Activitat',visible:true}];
  const result=ui.mini(children,{elna:[],blai:[]},activities,slots,extra);
  assert.match(result,/class="month-mini night-compressed"/);
  assert.match(result,/month-mini-extra with-guardian/);
  assert.match(result,/month-mini-custom/);
  assert.match(result,/month-mini-school/);
});

test('mes: les files es redueixen realment i només s’expandeixen les de nits especials, també en mòbil',()=>{
  assert.match(css,/\.month-mini \{height:74px;\}/);
  assert.match(css,/\.month-mini\.night-expanded \{height:110px;\}/);
  assert.match(css,/\.day-cell:has\(\.month-mini\) \{min-height:121px;\}/);
  assert.match(css,/\.day-cell:has\(\.month-mini\.night-expanded\) \{min-height:155px;\}/);
  assert.match(css,/@media\(max-width:560px\)[\s\S]*?\.month-mini \{height:60px;\}/);
  assert.match(css,/@media\(max-width:560px\)[\s\S]*?\.month-mini\.night-expanded \{height:96px;\}/);
  assert.match(ts,/monthDayUI\.mini\(children,snapshot\.nights,snapshot\.activities,snapshot\.slots,snapshot\.extra\)/);
  assert.match(timelineSource,/function renderWeek\(/);
});

test('el perímetre no deixa buits quan els mesos comencen o acaben a mitja setmana',()=>{
  // El costat d'una cel·la és perímetre només si el veí de la graella
  // (amunt, avall, esquerra o dreta) no forma part del mes actual.
  for(let year=2024;year<=2030;year++)for(let month=0;month<12;month++){
    const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
    const leading=(new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    const total=Math.ceil((leading+days)/7)*7;
    for(let d=1;d<=days;d++){
      const index=leading+d-1;
      const date=[year,String(month+1).padStart(2,'0'),String(d).padStart(2,'0')].join('-');
      const got=new Set(ui.outline(date,year,month,index,total,days).split(' ').filter(Boolean));
      const expected=new Set([
        'month-current',
        d<=7?'month-edge-top':'',
        d+7>days?'month-edge-bottom':'',
        index%7===0||d===1?'month-edge-left':'',
        index%7===6||d===days?'month-edge-right':''
      ].filter(Boolean));
      assert.deepEqual([...got].sort(),[...expected].sort(),date);
    }
  }
  // Novembre 2026, com a la captura: Dg 1 a la primera fila i Dl 30 a l'última.
  const november=(d,i)=>ui.outline('2026-11-'+String(d).padStart(2,'0'),2026,10,i,42,30);
  for(const d of [1,2,7])assert.match(november(d,6+d-1),/month-edge-top/);
  assert.doesNotMatch(november(8,13),/month-edge-top/);
  for(const d of [24,29,30])assert.match(november(d,6+d-1),/month-edge-bottom/);
  assert.match(november(30,35),/month-edge-right/);
});
test('el marc de 4 px es dibuixa per sobre de la graella a tots els costats, sense interceptar tocs',()=>{
  const overlay=css.match(/\.month-grid \.day-cell\.month-current::after\s*\{([^}]*)\}/)?.[1];
  assert.ok(overlay);
  assert.match(overlay,/pointer-events:none/);
  assert.match(overlay,/z-index:8/);
  assert.match(overlay,/inset:-1px/);
  assert.ok(overlay.includes('border-width:'));
  for(const edge of ['top','right','bottom','left'])assert.ok(overlay.includes('var(--month-'+edge+'-w,0px)'));
  assert.ok(css.includes('--month-outline-width:4px;'));
  assert.match(css,/\.month-grid \.day-cell\.month-current\.month-edge-top,[\s\S]*?month-edge-right \{z-index:2;\}/);
  assert.doesNotMatch(css,/inset 0 4px 0 var\(--month-top/);
  assert.match(ts,/data-action="show-calendar-day"/);
});
