/** Calendari Familiar · MVP web v0.1 — cap dada familiar no surt del navegador. */
type Child = { id: string; name: string; birthDate: string };
type Guardian = { id: string; name: string; color: string };
type Rotation = { startDate: string; length: number; assignments: Record<string, string[]>; changeTime: string };
// Les inscripcions són per grup i curs: l'historial es conserva en canviar de curs.
type SessionKind = 'classe' | 'pati' | 'menjador' | 'extraescolar' | 'altres';
const SESSION_KINDS:readonly SessionKind[]=['classe','pati','menjador','extraescolar','altres'];
const SESSION_KIND_NAMES:Record<SessionKind,string>={classe:'Classe',pati:'Pati',menjador:'Menjador',extraescolar:'Extraescolar',altres:'Altres'};
function sessionKind(value:unknown):SessionKind{return SESSION_KINDS.includes(value as SessionKind)?value as SessionKind:'classe';}
type WeeklySession = { id:string; weekday:number; startTime:string; endTime:string; label:string; kind?:SessionKind };
type ClassGroup = { id:string; name:string; tutorName:string; weeklySchedule:WeeklySession[]; childIds:string[]; childSchedules?:Record<string,WeeklySession[]>; reducedWeeklySchedule?:WeeklySession[]; reducedChildSchedules?:Record<string,WeeklySession[]> };
type ReducedWindow = {startTime:string;endTime:string};
type ScheduleMode = 'ordinary' | 'reduced';
type SchoolYear = { id:string; startDate:string; endDate:string; holidays:string[]; reducedDays:string[]; groups:ClassGroup[]; ordinaryWindow?:ReducedWindow; reducedWindow?:ReducedWindow };
type School = { id:string; name:string; address:string; phone:string; color:string; years:SchoolYear[]; weeklySchedule:WeeklySession[]; childIds:string[] };

type ThemeMode = 'auto' | 'light' | 'dark';
type FontSize = 'normal' | 'large' | 'xlarge';
type TimeBand = 'mati' | 'dinar' | 'tarda' | 'sopar' | 'nit';
type CalendarView = 'month' | 'week' | 'day';
const BANDS:readonly TimeBand[]=['mati','dinar','tarda','sopar','nit'];
const BAND_NAMES:Record<TimeBand,string>={mati:'Matí',dinar:'Dinar',tarda:'Tarda',sopar:'Sopar',nit:'Nit'};
// Hores orientatives. No equivalen a un horari escolar real i no es mostren com a hores exactes.
const BAND_RANGES:Partial<Record<TimeBand,[number,number]>>={mati:[8*60,12*60],dinar:[12*60,15*60],tarda:[15*60,18*60]};
function isTimeBand(value:string):value is TimeBand{return BANDS.some(b=>b===value);}
const DEFAULT_CHANGE_TIME='19:00';
function validChangeTime(value:unknown):string{return typeof value==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(value)?value:DEFAULT_CHANGE_TIME;}
function timeMinutes(value:string):number {const [h,m]=value.split(':').map(Number);return (h??0)*60+(m??0);}


/** Retalla les franges a l'interval reduït conegut, sense modificar el patró original. */
function clippedWeeklySchedule(sessions:WeeklySession[],window:ReducedWindow):WeeklySession[]{
 return sessions.map(a=>({...a,startTime:a.startTime<window.startTime?window.startTime:a.startTime,endTime:a.endTime>window.endTime?window.endTime:a.endTime}))
   .filter(a=>a.startTime<a.endTime);
}
function ordinaryScheduleForChild(group:ClassGroup,childId:string):WeeklySession[]{
 return childId&&Object.hasOwn(group.childSchedules??{},childId)?group.childSchedules![childId]!:group.weeklySchedule;
}
function reducedScheduleForChild(group:ClassGroup,year:SchoolYear,childId:string):WeeklySession[]{
 if(!year.reducedWindow)return [];
 const specific=childId&&Object.hasOwn(group.reducedChildSchedules??{},childId)
   ?group.reducedChildSchedules![childId]
   :group.reducedWeeklySchedule;
 return clippedWeeklySchedule(specific??ordinaryScheduleForChild(group,childId),year.reducedWindow);
}
function scheduleForSchoolDay(group:ClassGroup,year:SchoolYear,childId:string,date:string):WeeklySession[]{
 if(date<year.startDate||date>year.endDate||year.holidays.includes(date))return [];
 const weekday=(parseDate(date).getDay()+6)%7;
 const weekly=year.reducedDays.includes(date)?reducedScheduleForChild(group,year,childId):ordinaryScheduleForChild(group,childId);
 return weekly.filter(a=>a.weekday===weekday);
}
/** Les hores comunes delimiten l'estada, sense atribuir activitats al centre. */
function ordinaryBaseForSchool(school:School,year:SchoolYear|undefined):WeeklySession[]{
  if(year?.ordinaryWindow)return Array.from({length:5},(_,weekday)=>({
    id:`__school_window__${weekday}`,weekday,startTime:year.ordinaryWindow!.startTime,
    endTime:year.ordinaryWindow!.endTime,kind:'altres' as SessionKind,label:''
  }));
  // Compatibilitat no destructiva amb horaris generals definits a la v0.3.1.
  return school.weeklySchedule??[];
}
/** Mescla l'horari de centre amb activitats de grup; preserva els registres antics per fill en mode lectura. */
function schoolScheduleForCalendarDay(school:School,year:SchoolYear|undefined,group:ClassGroup|undefined,childId:string,date:string):WeeklySession[]{
  if(year&&(date<year.startDate||date>year.endDate||year.holidays.includes(date)))return [];
  const weekday=(parseDate(date).getDay()+6)%7;
  const base=ordinaryBaseForSchool(school,year).filter(s=>s.weekday===weekday);
  const oldChild=group?.childSchedules&&Object.hasOwn(group.childSchedules,childId)?group.childSchedules[childId]:undefined;
  const extra=(oldChild??group?.weeklySchedule??[]).filter(s=>s.weekday===weekday);
  const core=(window as Window & {schoolScheduleCore?:{combine:(a:WeeklySession[],b:WeeklySession[])=>WeeklySession[]}}).schoolScheduleCore;
  const ordinary=core?core.combine(base,extra):[...base,...extra];
  if(!year?.reducedDays.includes(date))return ordinary;
  if(!year.reducedWindow||weekday>4)return [];
  // Els dies reduïts tenen activitats pròpies per grup; els buits mantenen
  // el context de presència a l'escola, mai activitats ordinàries inventades.
  const baseReduced:WeeklySession={id:`__reduced_window__${weekday}`,weekday,
    startTime:year.reducedWindow.startTime,endTime:year.reducedWindow.endTime,kind:'altres',label:''};
  const oldReduced=group?.reducedChildSchedules&&Object.hasOwn(group.reducedChildSchedules,childId)?group.reducedChildSchedules[childId]:undefined;
  const special=(oldReduced??group?.reducedWeeklySchedule??[]).filter(s=>s.weekday===weekday);
  return core?core.combine([baseReduced],special):[baseReduced,...special];
}
function inReducedWindow(sessions:WeeklySession[],window:ReducedWindow):boolean{
 return sessions.every(a=>a.startTime>=window.startTime&&a.endTime<=window.endTime);
}

type Preferences = { visibleChildren: string[]; visibleGuardians: string[]; visibleSchools: string[]; visibleBands:TimeBand[]; theme: ThemeMode; fontSize: FontSize; timelineZoom:number };
type DaySlot = {id:string;startTime:string;endTime:string;guardianId:string};
type ExtraRotation = {id:string;name:string;startDate:string;length:number;startTime:string;endTime:string;childIds:string[];assignments:Record<string,string[]>};
type ExtraException = {startTime:string;endTime:string;guardianId:string;disabled:boolean};
type ExtraSlot = ExtraException & {rotationId:string;rotationName:string;childId:string;date:string;key:string;overridden:boolean;id:string;from:number;to:number;name:string;color:string;guardianName:string;visible:boolean};
type AppState = { version: number; children: Child[]; guardians: Guardian[]; rotation: Rotation; overrides: Record<string,string>; bandOverrides:Record<string,string>; daySlots:Record<string,DaySlot[]>; preferences: Preferences; schools:School[];nightPatternTimes:Record<string,string>;nightDateTimes:Record<string,string>;extraRotations:ExtraRotation[];extraExceptions:Record<string,ExtraException> };
type Tab = 'calendar' | 'rotation' | 'schools' | 'settings';
type Sheet = { type:'filters' } | { type:'day'; date:string } | {type:'daySlotForm';date:string;childId:string;slotId?:string} | {type:'bandEdit';date:string;childId:string;band:TimeBand} | {type:'extraCell';rotationId:string;childId:string;index:number} | {type:'extraWeek';rotationId:string;childId:string;week:number} | {type:'extraDate';rotationId:string;childId:string;date:string} | { type:'rotationCell'; childId:string; index:number } | { type:'rotationWeek'; childId:string; week:number } | {type:'schoolForm';schoolId?:string} | {type:'yearForm';schoolId:string;yearId?:string} | {type:'groupForm';schoolId:string;yearId:string;groupId?:string} | {type:'schoolDayForm';schoolId:string;yearId:string;kind:'holiday'|'reduced'} | {type:'reducedWindowForm';schoolId:string;yearId:string} | {type:'ordinaryWindowForm';schoolId:string;yearId:string} | {type:'scheduleForm';schoolId:string;yearId:string;groupId:string;childId?:string;sessionId?:string;mode?:ScheduleMode} | {type:'schoolActivity';date:string;childId:string;schoolId:string;sessionId:string} | null;

const $app = document.getElementById('app')!;
const APP_VERSION = '0.6.0';
const TIMELINE_ZOOM_LEVELS:readonly number[]=[25,50,75,100,125,150];
const FONT_SIZE_OPTIONS:readonly FontSize[]=['normal','large','xlarge'];
const FONT_SIZE_LABELS:Record<FontSize,string>={normal:'Normal',large:'Gran',xlarge:'Molt gran'};
const DB_NAME = 'calendari-familiar-db';
const DB_STORE = 'data';
const DB_KEY = 'app-v1';
const MAX_ROTATION_DAYS = 3640; // 520 setmanes, per limitar el cost de visualitzar el patró
const weekdays = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'];
const weekLong = ['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
const months = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];
const icons: Record<string,string> = {
  school:'<path d="M3 22V8l9-5 9 5v14M2 22h20M7 12h2m6 0h2M7 16h2m6 0h2M10 22v-4h4v4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  repeat:'<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>',
  settings:'<path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06-2 2-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21h-2.85v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06-2-2 .06-.06A1.65 1.65 0 0 0 7.6 15a1.65 1.65 0 0 0-1.51-1H6v-2.85h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06 2-2 .06.06A1.65 1.65 0 0 0 11.09 6a1.65 1.65 0 0 0 1-1.51V4h2.85v.49a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06 2 2-.06.06A1.65 1.65 0 0 0 19.4 10a1.65 1.65 0 0 0 1.51 1H21v3h-.09a1.65 1.65 0 0 0-1.51 1Z" transform="translate(-.5 -.5) scale(.94)"/>',
  chevronLeft:'<path d="m15 18-6-6 6-6"/>', chevronRight:'<path d="m9 18 6-6-6-6"/>',
  filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
  close:'<path d="M18 6 6 18M6 6l12 12"/>',
  check:'<path d="m20 6-11 11-5-5"/>',
  download:'<path d="M12 3v12m-4-4 4 4 4-4M5 17v4h14v-4"/>',
  upload:'<path d="M12 16V4m-4 4 4-4 4 4M4 17v4h16v-4"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 11v5M12 7h.01"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6M10 10v6m4-6v6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
  pencil:'<path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z"/>',
  person:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  home:'<path d="M3 10 12 3l9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z"/><path d="M9 21v-8h6v8"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  moon:'<path d="M20.9 13a9 9 0 0 1-9.9-9.9A9 9 0 1 0 20.9 13Z"/>',
  monitor:'<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 22h8M12 18v4"/>'
};
function icon(name:string,size=19) {return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||''}</svg>`;}
function escapeHtml(value:unknown):string {return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]??c));}
function localDate(date:Date) {return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');}
function parseDate(value:string) {const [y,m,d]=value.split('-').map(Number);return new Date(y??2026,(m??1)-1,d??1,12);}
function addDays(date:string,days:number) {const d=parseDate(date); d.setDate(d.getDate()+days);return localDate(d);}
function utcDay(date:string) {const [y,m,d]=date.split('-').map(Number);return Date.UTC(y??2026,(m??1)-1,d??1)/86400000;}
function diffDays(a:string,b:string) {return utcDay(a)-utcDay(b);}
function monthTitle(year:number,month:number) {return `${months[month]} ${year}`;}
function fullDate(date:string) {const d=parseDate(date); const dayIndex=(d.getDay()+6)%7;return `${weekLong[dayIndex]}, ${d.getDate()} d’${months[d.getMonth()]} de ${d.getFullYear()}`;}
function initial(name:string) {return [...name.trim()][0]?.toUpperCase() || '?';}
function newId() {return (typeof crypto !== 'undefined' && 'randomUUID' in crypto) ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;}
const DEMO_START_DATE = '2026-10-12'; // Dilluns de la primera setmana
const LEGACY_DEMO_SEQUENCE = ['pare','pare','mare','mare','pare','pare','pare','mare','mare','pare','pare','mare','mare','mare'];
/** Cicle de 10 setmanes, amb excepcions incorporades dins del patró (no com a dates soltes). */
function demoSequence():string[] {
  const weeklyGuardians=['pare','mare','pare','mare','pare','pare','mare','pare','mare','pare'];
  return Array.from({length:70},(_,day)=>{
    const week=Math.floor(day/7); // 0 = setmana 1
    const weekday=day%7; // 0 = dilluns, 6 = diumenge
    if((week===1 || week===6) && weekday===6)return 'pare'; // Diumenge setmanes 2 i 7
    if(week===9 && weekday>=5)return 'mare'; // Dissabte i diumenge setmana 10
    return weeklyGuardians[week]!;
  });
}
function seedState():AppState {
  const sequence=demoSequence();
  return {
    version:1,
    children:[{id:'elna',name:'Elna',birthDate:''},{id:'blai',name:'Blai',birthDate:''}],
    guardians:[{id:'pare',name:'Pare',color:'#8bb8e8'},{id:'mare',name:'Mare',color:'#efafc3'}],
    rotation:{startDate:DEMO_START_DATE,length:sequence.length,assignments:{elna:[...sequence],blai:[...sequence]},changeTime:DEFAULT_CHANGE_TIME},
    overrides:{},bandOverrides:{},daySlots:{},nightPatternTimes:{},nightDateTimes:{},extraRotations:[],extraExceptions:{}, preferences:{visibleChildren:['elna','blai'],visibleGuardians:['pare','mare'],visibleSchools:[],visibleBands:[...BANDS],theme:'auto',fontSize:'normal',timelineZoom:50},schools:[]
  };
}
/** Estat inicial completament buit, independent de les dades d'exemple. */
function emptyState():AppState {
  return {
    version:1,children:[],guardians:[],
    rotation:{startDate:localDate(new Date()),length:7,assignments:{},changeTime:DEFAULT_CHANGE_TIME},
    overrides:{},bandOverrides:{},daySlots:{},schools:[],nightPatternTimes:{},nightDateTimes:{},extraRotations:[],extraExceptions:{},
    preferences:{visibleChildren:[],visibleGuardians:[],visibleSchools:[],visibleBands:[...BANDS],theme:'auto',fontSize:'normal',timelineZoom:50}
  };
}
const SCHOOL_PALETTE = ['#74c6a3','#f0be75','#afa4e6','#7bbcc9','#d3a1cd','#bbc773','#d4a68f','#87b8e1'];
function suggestedSchoolColor(schools:School[]):string{
  const used=new Set(schools.map(s=>s.color.toLowerCase()));
  for(const color of SCHOOL_PALETTE)if(!used.has(color))return color;
  for(let i=0;i<360;i++){
    const hue=(i*137+57)%360, rgb=(h:number)=>{
      const k=(h+hue/30)%12, a=.62*.35;
      return Math.round(255*(.62-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');
    };
    const color='#'+rgb(0)+rgb(8)+rgb(4);
    if(!used.has(color))return color;
  }
  return '#74c6a3';
}
function validTheme(value:unknown):ThemeMode {return value==='light'||value==='dark'?value:'auto';}
function validFontSize(value:unknown):FontSize{return value==='large'||value==='xlarge'?value:'normal';}
function validTimelineZoom(value:unknown):number{return typeof value==='number'&&TIMELINE_ZOOM_LEVELS.includes(value)?value:50;}
function isValidDate(s:string) {return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseDate(s).getTime()) && localDate(parseDate(s))===s;}
/** Validació i migració no destructiva: còpies anteriors a Escoles són vàlides. */
/** Horari ordinari general de l'escola, independent dels grups. */
function cleanSchoolWeeklySchedule(raw:unknown):WeeklySession[]{
  if(!Array.isArray(raw)||raw.length>200)throw Error('L’horari ordinari de l’escola no és vàlid');
  const ids=new Set<string>();
  const result:WeeklySession[]=raw.map((x:WeeklySession)=>{
    if(!x||typeof x.id!=='string'||ids.has(x.id)||!Number.isInteger(x.weekday)||x.weekday<0||x.weekday>6||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(x.endTime)||
      x.startTime>=x.endTime||(x.kind!==undefined&&!SESSION_KINDS.includes(x.kind)))throw Error('Hi ha una franja ordinària d’escola incorrecta');
    ids.add(x.id);return {id:x.id,weekday:x.weekday,startTime:x.startTime,endTime:x.endTime,label:typeof x.label==='string'?x.label.trim().slice(0,80):'',kind:sessionKind(x.kind)};
  });
  const ordered=[...result].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime));
  if(ordered.some((a,i)=>i>0&&ordered[i-1]!.weekday===a.weekday&&ordered[i-1]!.endTime>a.startTime))throw Error('Hi ha franges escolars solapades');
  return result;
}
function cleanSchools(raw:unknown,children:Child[]):School[]{
  if(raw===undefined)return [];
  if(!Array.isArray(raw)||raw.length>50)throw Error('La còpia conté escoles incorrectes');
  const childSet=new Set(children.map(c=>c.id)),schoolIds=new Set<string>();
  const isText=(x:unknown)=>typeof x==='string';
  const name=(x:unknown,max=120)=>typeof x==='string'?x.trim().slice(0,max):'';
  const validTime=(t:unknown)=>typeof t==='string'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(t);
  const acceptedColors=new Set<string>();
  return raw.map((entry:unknown,index:number)=>{
    const school=entry as Partial<School>;
    if(!school||!isText(school.id)||schoolIds.has(school.id!)||!name(school.name)||!Array.isArray(school.years)||school.years.length>60)throw Error('Hi ha una escola invàlida a la còpia');
    schoolIds.add(school.id!);
    const preferredColor=typeof school.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(school.color)?school.color.toLowerCase():'';
    const previouslyColored=[...acceptedColors].map((color,i)=>({id:String(i),name:'',address:'',phone:'',color,years:[],weeklySchedule:[],childIds:[]} as School));
    const color=preferredColor&&!acceptedColors.has(preferredColor)?preferredColor:suggestedSchoolColor(previouslyColored);
    acceptedColors.add(color);
    const yearIds=new Set<string>();
    const years=school.years.map(entryYear=>{
      const year=entryYear as SchoolYear;
      if(!year||!isText(year.id)||yearIds.has(year.id)||!isValidDate(year.startDate)||!isValidDate(year.endDate)||year.startDate>=year.endDate||!Array.isArray(year.groups)||year.groups.length>80)throw Error('Un curs escolar no és vàlid');
      yearIds.add(year.id);
      const validateDays=(days:unknown)=>{
        if(!Array.isArray(days)||days.length>1000||days.some(d=>typeof d!=='string'||!isValidDate(d)||d<year.startDate||d>year.endDate))throw Error('Hi ha dies fora del curs escolar');
        return [...new Set(days as string[])].sort();
      };
      const holidays=validateDays(year.holidays??[]),reducedDays=validateDays(year.reducedDays??[]);
      const windowRaw=year.reducedWindow;
      if(windowRaw!==undefined&&(!windowRaw||!validTime(windowRaw.startTime)||!validTime(windowRaw.endTime)||windowRaw.startTime>=windowRaw.endTime))throw Error('L’interval de jornada reduïda no és vàlid');
      const reducedWindow=windowRaw?{startTime:windowRaw.startTime,endTime:windowRaw.endTime}:undefined;
       const ordinaryRaw=year.ordinaryWindow;
       if(ordinaryRaw!==undefined&&(!ordinaryRaw||!validTime(ordinaryRaw.startTime)||!validTime(ordinaryRaw.endTime)||ordinaryRaw.startTime>=ordinaryRaw.endTime))throw Error('L’interval de jornada ordinària no és vàlid');
       const ordinaryWindow=ordinaryRaw?{startTime:ordinaryRaw.startTime,endTime:ordinaryRaw.endTime}:undefined;
      if(reducedDays.some(d=>holidays.includes(d)))throw Error('Un dia no pot ser festiu i d’horari reduït alhora');
      const groupIds=new Set<string>(),enrolled=new Set<string>();
      const groups=year.groups.map(g=>{
        if(!g||!isText(g.id)||groupIds.has(g.id)||!name(g.name)||!Array.isArray(g.childIds)||!Array.isArray(g.weeklySchedule)||g.childIds.length>30||g.weeklySchedule.length>200)throw Error('Un grup classe no és vàlid');
        groupIds.add(g.id);
        const childIds=g.childIds.filter(id=>childSet.has(id));
        if(new Set(childIds).size!==childIds.length||childIds.some(id=>enrolled.has(id)))throw Error('Un fill no pot pertànyer a dos grups del mateix curs');
        childIds.forEach(id=>enrolled.add(id));
        // Les còpies 0.1.8 no tenen categoria ni horaris particulars.
        const parseSchedule=(entries:unknown):WeeklySession[]=>{
          if(!Array.isArray(entries)||entries.length>200)throw Error('Un horari escolar no és vàlid');
          const ids=new Set<string>();
          const sessions:WeeklySession[]=entries.map((a:WeeklySession)=>{
            if(!a||!isText(a.id)||ids.has(a.id)||!Number.isInteger(a.weekday)||a.weekday<0||a.weekday>6||!validTime(a.startTime)||!validTime(a.endTime)||a.startTime>=a.endTime||(a.kind!==undefined&&!SESSION_KINDS.includes(a.kind)))throw Error('Hi ha un horari setmanal incorrecte');
            ids.add(a.id);
            return {id:a.id,weekday:a.weekday,startTime:a.startTime,endTime:a.endTime,label:name(a.label,80),kind:sessionKind(a.kind)};
          });
          const ordered=[...sessions].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime));
          for(let i=1;i<ordered.length;i++){
            const prev=ordered[i-1]!,next=ordered[i]!;
            if(prev.weekday===next.weekday&&prev.endTime>next.startTime)throw Error('Hi ha franges escolars solapades');
          }
          return sessions;
        };
        const weeklySchedule=parseSchedule(g.weeklySchedule);
        const childSchedules:Record<string,WeeklySession[]>={};
        if(g.childSchedules!==undefined){
          if(!g.childSchedules||typeof g.childSchedules!=='object'||Array.isArray(g.childSchedules)||Object.keys(g.childSchedules).length>30)throw Error('Els horaris individuals no són vàlids');
          for(const [id,sessions] of Object.entries(g.childSchedules)){
            if(!childIds.includes(id))throw Error('Hi ha un horari per a un fill que no pertany al grup');
            childSchedules[id]=parseSchedule(sessions);
          }
        }
        const reducedWeeklySchedule=g.reducedWeeklySchedule===undefined?undefined:parseSchedule(g.reducedWeeklySchedule);
        const reducedChildSchedules:Record<string,WeeklySession[]>={};
        if(g.reducedChildSchedules!==undefined){
          if(!g.reducedChildSchedules||typeof g.reducedChildSchedules!=='object'||Array.isArray(g.reducedChildSchedules)||Object.keys(g.reducedChildSchedules).length>30)throw Error('Els horaris de jornada reduïda no són vàlids');
          for(const [id,sessions] of Object.entries(g.reducedChildSchedules)){
            if(!childIds.includes(id))throw Error('Hi ha un horari reduït per a un fill no matriculat');
            reducedChildSchedules[id]=parseSchedule(sessions);
          }
        }
        if((reducedWeeklySchedule!==undefined||Object.keys(reducedChildSchedules).length>0)&&!reducedWindow)throw Error('Cal definir les hores de jornada reduïda abans dels horaris especials');
        if(reducedWindow&&(reducedWeeklySchedule!==undefined&&!inReducedWindow(reducedWeeklySchedule,reducedWindow)||Object.values(reducedChildSchedules).some(a=>!inReducedWindow(a,reducedWindow))))throw Error('Hi ha activitats fora de les hores de jornada reduïda');
        return {id:g.id,name:name(g.name,80),tutorName:name(g.tutorName,100),weeklySchedule,childIds,childSchedules,reducedWeeklySchedule,reducedChildSchedules};
      });
      return {id:year.id,startDate:year.startDate,endDate:year.endDate,holidays,reducedDays,groups,reducedWindow,ordinaryWindow};
    });
    const schoolChildIds=school.childIds===undefined?[]:school.childIds;
     if(!Array.isArray(schoolChildIds)||schoolChildIds.length>30||schoolChildIds.some(id=>typeof id!=='string'||!childSet.has(id))||new Set(schoolChildIds).size!==schoolChildIds.length)throw Error('Els fills associats a l’escola no són vàlids');
     return {id:school.id!,name:name(school.name,100),address:name(school.address,200),phone:name(school.phone,50),color,years,weeklySchedule:cleanSchoolWeeklySchedule(school.weeklySchedule??[]),childIds:[...schoolChildIds]};
  });
}
function cleanState(raw:unknown):AppState {
  if(!raw || typeof raw!=='object')throw Error('Fitxer sense dades vàlides');
  const obj=raw as Partial<AppState>;
  if(obj.version!==1 || !Array.isArray(obj.children)||!Array.isArray(obj.guardians)||!obj.rotation||!obj.preferences||!obj.overrides) throw Error('Format de còpia no compatible');
  const children=obj.children.filter(c=>c&&typeof c.id==='string'&&typeof c.name==='string'&&typeof c.birthDate==='string').map(c=>({...c,name:c.name.slice(0,70),birthDate:isValidDate(c.birthDate)?c.birthDate:''}));
  const guardians=obj.guardians.filter(g=>g&&typeof g.id==='string'&&typeof g.name==='string'&&typeof g.color==='string'&&/^#[0-9a-fA-F]{6}$/.test(g.color)).map(g=>({...g,name:g.name.slice(0,70)}));
  if(children.length>30 || guardians.length>30 || new Set(children.map(x=>x.id)).size!==children.length || new Set(guardians.map(x=>x.id)).size!==guardians.length) throw Error('La còpia conté fills o tutors incorrectes');
  const validGuardians=new Set(guardians.map(x=>x.id));
  const length=obj.rotation.length;
  if(!Number.isInteger(length) || length<1 || length>MAX_ROTATION_DAYS || !isValidDate(obj.rotation.startDate))throw Error('El patró no és vàlid');
  const assignments:Record<string,string[]>={};
  for(const child of children){const seq=obj.rotation.assignments?.[child.id];if(!Array.isArray(seq)||seq.length!==length||seq.some(x=>x!==''&&!validGuardians.has(x)))throw Error('El patró de nits està incomplet');assignments[child.id]=[...seq];}
  const overrides:Record<string,string>={};
  for(const [key,value] of Object.entries(obj.overrides)) {const [date,childId]=key.split('|');if(date && childId && isValidDate(date)&&children.some(c=>c.id===childId)&&validGuardians.has(value))overrides[key]=value;}
  const schools=cleanSchools(obj.schools,children);
   const daySlots:Record<string,DaySlot[]>=monthDayUI.clean(obj.daySlots,children.map(c=>c.id),guardians.map(g=>g.id));
  const visibleBands=Array.isArray(obj.preferences.visibleBands)
    ? BANDS.filter(b=>obj.preferences!.visibleBands.includes(b)):[...BANDS];
  const bandOverrides:Record<string,string>={};
  const rawBands=obj.bandOverrides;
  if(rawBands!==undefined){
    if(!rawBands||typeof rawBands!=='object'||Array.isArray(rawBands)||Object.keys(rawBands).length>50000)throw Error('Les assignacions de franges no són vàlides');
    for(const [key,who] of Object.entries(rawBands)){
      const parts=key.split('|');
      if(parts.length!==3||!isValidDate(parts[0]??'')||!children.some(c=>c.id===parts[1])||!isTimeBand(parts[2]??'')||parts[2]==='nit'||(who!==''&&!validGuardians.has(who)))continue;
      bandOverrides[key]=who;
    }
  }
  const rotation={startDate:obj.rotation.startDate,length,assignments,changeTime:validChangeTime(obj.rotation.changeTime)};
  const extraRotations=rotationPatterns.cleanExtras(obj.extraRotations,children,guardians,MAX_ROTATION_DAYS) as ExtraRotation[];
  const nightPatternTimes=rotationPatterns.cleanNightTimes(obj.nightPatternTimes,rotation) as Record<string,string>;
  const nightDateTimes=rotationPatterns.cleanDateTimes(obj.nightDateTimes) as Record<string,string>;
  const extraExceptions=rotationPatterns.cleanExtraExceptions(obj.extraExceptions,extraRotations,children,guardians) as Record<string,ExtraException>;
  return {version:1,children,guardians,rotation,nightPatternTimes,nightDateTimes,extraRotations,extraExceptions,overrides,bandOverrides,daySlots,preferences:{visibleChildren:children.filter(c=>obj.preferences!.visibleChildren?.includes(c.id)).map(c=>c.id),visibleGuardians:guardians.filter(g=>obj.preferences!.visibleGuardians?.includes(g.id)).map(g=>g.id),visibleSchools:schools.filter(s=>obj.preferences!.visibleSchools?.includes(s.id)).map(s=>s.id),visibleBands,theme:validTheme(obj.preferences.theme),fontSize:validFontSize(obj.preferences.fontSize),timelineZoom:validTimelineZoom(obj.preferences.timelineZoom)},schools};
}
/** Actualitza només el patró de mostra v0.1 íntegre i sense editar; mai modifica dades personalitzades. */
function upgradeOriginalDemo(data:AppState):{data:AppState;changed:boolean}{
  const untouched=data.schools.length===0
    && data.children.length===2
    && data.children[0]?.id==='elna' && data.children[0]?.name==='Elna' && data.children[0]?.birthDate==='2015-10-08'
    && data.children[1]?.id==='blai' && data.children[1]?.name==='Blai' && data.children[1]?.birthDate==='2019-04-16'
    && data.guardians.length===3
    && data.guardians[0]?.id==='pare' && data.guardians[0]?.name==='Pare' && data.guardians[0]?.color==='#8bb8e8'
    && data.guardians[1]?.id==='mare' && data.guardians[1]?.name==='Mare' && data.guardians[1]?.color==='#efafc3'
    && data.guardians[2]?.id==='avia' && data.guardians[2]?.name==='Àvia' && data.guardians[2]?.color==='#c9b4ef'
    && data.rotation.length===14
    && ['elna','blai'].every(id=>JSON.stringify(data.rotation.assignments[id])===JSON.stringify(LEGACY_DEMO_SEQUENCE))
    && Object.keys(data.overrides).length===0
    && JSON.stringify(data.preferences.visibleChildren)===JSON.stringify(['elna','blai'])
    && JSON.stringify(data.preferences.visibleGuardians)===JSON.stringify(['pare','mare','avia']);
  if(!untouched)return {data,changed:false};
  data.children.forEach(c=>c.birthDate='');
  data.guardians=data.guardians.filter(g=>g.id!=='avia');
  data.preferences.visibleGuardians=data.preferences.visibleGuardians.filter(id=>id!=='avia');
  return {data,changed:true};
}
/** Només substitueix les dades de demostració 14 dies sense modificar. 
 * Si hi ha canvis d'usuari en noms, tutors, rotació, filtres o excepcions, es conserva tot. */
function upgradeUntouchedDemo(data:AppState):{data:AppState;changed:boolean}{
  const demoLike=data.schools.length===0
    && data.children.length===2
    && data.children[0]?.id==='elna' && data.children[0]?.name==='Elna' && data.children[0]?.birthDate===''
    && data.children[1]?.id==='blai' && data.children[1]?.name==='Blai' && data.children[1]?.birthDate===''
    && data.guardians.length===2
    && data.guardians[0]?.id==='pare' && data.guardians[0]?.name==='Pare' && data.guardians[0]?.color==='#8bb8e8'
    && data.guardians[1]?.id==='mare' && data.guardians[1]?.name==='Mare' && data.guardians[1]?.color==='#efafc3'
    && data.rotation.length===LEGACY_DEMO_SEQUENCE.length
    && parseDate(data.rotation.startDate).getDay()===1
    && ['elna','blai'].every(id=>JSON.stringify(data.rotation.assignments[id])===JSON.stringify(LEGACY_DEMO_SEQUENCE))
    && Object.keys(data.overrides).length===0
    && JSON.stringify(data.preferences.visibleChildren)===JSON.stringify(['elna','blai'])
    && JSON.stringify(data.preferences.visibleGuardians)===JSON.stringify(['pare','mare']);
  if(!demoLike)return {data,changed:false};
  data.rotation=seedState().rotation; // Preferències de tema desades intactes
  return {data,changed:true};
}
function upgradeDemo(data:AppState):{data:AppState;changed:boolean}{
  const legacy=upgradeOriginalDemo(data);
  const current=upgradeUntouchedDemo(legacy.data);
  return {data:current.data,changed:legacy.changed||current.changed};
}
function resizedRotation(rotation:Rotation,length:number):Rotation{
  const fallback=defaultGuardian();
  const assignments:Record<string,string[]>={};
  for(const child of state.children){
    const old=rotation.assignments[child.id]??[];
    assignments[child.id]=Array.from({length},(_,i)=>old.length?old[i%old.length]??fallback:fallback);
  }
  return {...rotation,length,assignments};
}
let db:IDBDatabase|null=null;
let storageMode:'indexeddb'|'localStorage'|'session'='session';
let state=seedState();
let viewYear=new Date().getFullYear(),viewMonth=new Date().getMonth();
let calendarView:CalendarView='month';
let selectedDate=localDate(new Date());
let tab:Tab='calendar';
let schoolNav:{schoolId?:string;yearId?:string;groupId?:string;scheduleChildId?:string;scheduleMode?:ScheduleMode}={};
let sheet:Sheet=null;
let detailOrigin:'day'|'calendar'='calendar';
let detailReturnDate='';
let rotationDraft:Rotation|null=null;
let extraRotationOpen:string|null=null;
let extraRotationUnit:'days'|'weeks'='weeks';
let rotationShowAll=false;
let nightPatternDraft:Record<string,string>={};
let extraRotationUnits:Record<string,'days'|'weeks'>={};
let rotationUnit:'days'|'weeks'='weeks';
let toastTimer:number|null=null;
let writeQueue:Promise<void>=Promise.resolve();
const themeMedia=window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme(){
  const mode=validTheme(state.preferences.theme);
  const effective=mode==='auto'?(themeMedia.matches?'dark':'light'):mode;
  document.documentElement.dataset.theme=effective;
  document.documentElement.style.colorScheme=effective;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',effective==='dark'?'#101722':'#f6f7f8');
  try{localStorage.setItem('calendari-familiar-theme',mode);}catch{/* Emmagatzematge opcional */}
}
function applyFontSize(){document.documentElement.dataset.fontSize=validFontSize(state.preferences.fontSize);}
themeMedia.addEventListener?.('change',()=>{if(state.preferences.theme==='auto')applyTheme();});
async function openDB():Promise<IDBDatabase> {return new Promise((resolve,reject)=>{
  const request=indexedDB.open(DB_NAME,1);
  request.onupgradeneeded=()=>{const database=request.result;if(!database.objectStoreNames.contains(DB_STORE)) database.createObjectStore(DB_STORE);};
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
});}
function idbGet():Promise<unknown> {return new Promise((resolve,reject)=>{
  const req=db!.transaction(DB_STORE,'readonly').objectStore(DB_STORE).get(DB_KEY);
  req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
});}
function idbPut(data:AppState):Promise<void> {return new Promise((resolve,reject)=>{
  const tx=db!.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(data,DB_KEY);
  tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
});}
async function loadState(){
  try {db=await openDB();storageMode='indexeddb';const raw=await idbGet();if(raw){const result=upgradeDemo(cleanState(raw));state=result.data;if(result.changed)await idbPut(state);}else await idbPut(state);return;}
  catch(e) {console.warn('IndexedDB no disponible; s’intenta emmagatzematge alternatiu.',e);}
  try{storageMode='localStorage';const raw=localStorage.getItem('calendari-familiar-v1');if(raw){const result=upgradeDemo(cleanState(JSON.parse(raw)));state=result.data;if(result.changed)localStorage.setItem('calendari-familiar-v1',JSON.stringify(state));}else localStorage.setItem('calendari-familiar-v1',JSON.stringify(state));}
  catch(e){console.error('No hi ha emmagatzematge persistent disponible',e);storageMode='session';}
}
function saveState(){
  const snapshot=JSON.parse(JSON.stringify(state)) as AppState;
  writeQueue=writeQueue.catch(()=>{}).then(async()=>{
    if(storageMode==='indexeddb'&&db)await idbPut(snapshot);
    else if(storageMode==='localStorage')localStorage.setItem('calendari-familiar-v1',JSON.stringify(snapshot));
  }).catch(e=>{console.error('No s’han desat els canvis',e);notify('No s’ha pogut desar. Exporta una còpia.');});
}
function update(){applyTheme();applyFontSize();saveState();render();}
function guardian(id:string):Guardian|undefined {return state.guardians.find(g=>g.id===id);}
function childById(id:string):Child|undefined{return state.children.find(c=>c.id===id);}
function defaultGuardian(){return state.guardians[0]?.id??'';}
function nightChangeTime(date:string):string {
  return rotationPatterns.nightTime(date,state.rotation,state.nightPatternTimes,state.nightDateTimes);
}
function rotationAssignment(date:string,childId:string,rotation=state.rotation):string {
  const arr=rotation.assignments[childId];if(!arr?.length)return defaultGuardian();
  const index=((diffDays(date,rotation.startDate)%rotation.length)+rotation.length)%rotation.length;
  return arr[index]??defaultGuardian();
}
function assigned(date:string,childId:string){return state.overrides[`${date}|${childId}`] ?? rotationAssignment(date,childId);}
function overridden(date:string,childId:string){return Object.hasOwn(state.overrides,`${date}|${childId}`);}
function birthdays(date:string){return state.children.filter(c=>c.birthDate&&c.birthDate.slice(5)===date.slice(5));}
function birthdayAge(date:string,child:Child){return parseInt(date.slice(0,4),10)-parseInt(child.birthDate.slice(0,4),10);}
function groupAssignments(date:string){
  const visible=state.children.filter(c=>state.preferences.visibleChildren.includes(c.id));
  return state.guardians.filter(g=>state.preferences.visibleGuardians.includes(g.id)).map(g=>({guardian:g,children:visible.filter(c=>assigned(date,c.id)===g.id)})).filter(g=>g.children.length);
}
/** Resol el color de cada fill en una franja, sense inferir àpats o tardes a partir de la nit. */
type Responsibility={type:'guardian'|'school'|'none';name:string;color:string;source:string;changed:boolean};
function schoolForBand(date:string,childId:string,band:TimeBand):School|undefined {
  if(band==='nit'||band==='sopar')return undefined;
  const weekday=(parseDate(date).getDay()+6)%7;
  const range=BAND_RANGES[band];if(!range)return undefined;
  return state.schools.find(s=>{
    if(!state.preferences.visibleSchools.includes(s.id))return false;
    const year=s.years.find(y=>date>=y.startDate&&date<=y.endDate);
    if(s.years.length&&!year)return false;
    if(year?.holidays.includes(date))return false;
    const group=year?.groups.find(g=>g.childIds.includes(childId));
    if(!s.childIds.includes(childId)&&!group)return false;
    const sessions=schoolScheduleForCalendarDay(s,year,group,childId,date);
    if(!sessions.length&&!year?.ordinaryWindow&&!s.weeklySchedule.length&&!group?.weeklySchedule.length&&!year?.reducedDays.includes(date))
      return !!group&&weekday<5&&(band==='mati'||band==='tarda');
    const covered=sessions.reduce((sum,a)=>sum+Math.max(0,Math.min(timeMinutes(a.endTime),range[1])-Math.max(timeMinutes(a.startTime),range[0])),0);
    return covered>=(range[1]-range[0])/2;
  });
}
function responsibility(date:string,childId:string,band:TimeBand):Responsibility {
  const none:Responsibility={type:'none',name:'Sense assignar',color:'',source:'Sense assignació',changed:false};
  if(band==='nit'){
    const g=guardian(assigned(date,childId));
    return g&&state.preferences.visibleGuardians.includes(g.id)?{type:'guardian',name:g.name,color:g.color,source:overridden(date,childId)?'Canvi puntual':'Rotació nocturna',changed:overridden(date,childId)}:{...none,changed:overridden(date,childId)};
  }
  const key=`${date}|${childId}|${band}`;
  if(Object.hasOwn(state.bandOverrides,key)){
    const id=state.bandOverrides[key]??'',g=guardian(id);
    return g&&state.preferences.visibleGuardians.includes(g.id)?{type:'guardian',name:g.name,color:g.color,source:'Assignació puntual',changed:true}:{...none,source:'Assignació puntual',changed:true};
  }
  const school=schoolForBand(date,childId,band);
  return school?{type:'school',name:school.name,color:school.color,source:'Horari escolar',changed:false}:none;
}
function activeChildren(){return state.children.filter(c=>state.preferences.visibleChildren.includes(c.id));}
function activeBands(){return BANDS.filter(b=>state.preferences.visibleBands.includes(b));}
function bandKey(date:string,childId:string,band:TimeBand){return `${date}|${childId}|${band}`;}
function shortChildLabel(c:Child){return initial(c.name);}
type SchoolCalendarItem={id:string;schoolId:string;schoolName:string;color:string;childId:string;startTime:string;endTime:string;start:number;end:number;kind:string;description:string};
type SchoolCalendarUI={
  collect:(date:string,children:Child[],schools:School[],visibleIds:string[],getSessions:typeof schoolScheduleForCalendarDay)=>SchoolCalendarItem[];
  range:(items:SchoolCalendarItem[])=>[number,number]|null;
  render:(date:string,dateLabel:string,children:Child[],activities:SchoolCalendarItem[],commonRange?:[number,number]|null,empty?:boolean,reduced?:boolean)=>string;
};
const schoolCalendarUI=(window as Window & {schoolCalendarUI?:SchoolCalendarUI}).schoolCalendarUI;
function schoolActivities(date:string,children:Child[]):SchoolCalendarItem[]{
  return schoolCalendarUI?.collect(date,children,state.schools,state.preferences.visibleSchools,schoolScheduleForCalendarDay)??[];
}
function schoolReducedDay(date:string,children:Child[]):boolean{
  return state.schools.some(s=>state.preferences.visibleSchools.includes(s.id)&&s.years.some(y=>date>=y.startDate&&date<=y.endDate&&y.reducedDays.includes(date)&&y.groups.some(g=>g.childIds.some(id=>children.some(c=>c.id===id)))));
}
function schoolTimeline(date:string,children:Child[],range?:[number,number]|null,empty=false):string{
  if(!state.preferences.visibleSchools.length||!children.length)return '';
  return schoolCalendarUI?.render(date,fullDate(date),children,schoolActivities(date,children),range,empty,schoolReducedDay(date,children))??'';
}
type DayTimelineUI = {
 overnightSegments:(date:string,childId:string,changeTime:string,getNight:(d:string,id:string)=>string,previousDate:(d:string)=>string,lookupGuardian:(id:string)=>Guardian|undefined,visibleIds:string[])=>Array<{from:number;to:number;date:string;guardianId:string;guardianName:string;guardianColor:string;visible:boolean}>;
 render:(date:string,label:string,children:Child[],activities:SchoolCalendarItem[],nights:Record<string,ReturnType<DayTimelineUI['overnightSegments']>>,changeTime:string,zoom?:number,customSlots?:Record<string,any[]>)=>string;
 renderWeek:(startDate:string,days:Array<{date:string;label:string;activities:SchoolCalendarItem[];nightSegments:Record<string,ReturnType<DayTimelineUI['overnightSegments']>>;customSlots?:Record<string,any[]>}>,children:Child[],zoom?:number,focusDate?:string,todayDate?:string)=>string;
};
const dayTimelineUI=(window as Window & {dayTimelineUI?:DayTimelineUI}).dayTimelineUI;
const monthDayUI=(window as Window & {monthDayUI?:any}).monthDayUI;
const rotationPatterns=(window as Window & {rotationPatterns?:any}).rotationPatterns;
const rotationEditor=(window as Window & {rotationEditor?:any}).rotationEditor;
function extraSlots(date:string,children:Child[]):ExtraSlot[] {
  return rotationPatterns.slots(state,date,children,state.guardians,state.preferences.visibleGuardians) as ExtraSlot[];
}
function monthData(date:string,children:Child[]){
  const nights:Record<string,any[]>={};
  const changeTime=nightChangeTime(date);
  for(const c of children)nights[c.id]=dayTimelineUI?.overnightSegments(date,c.id,changeTime,assigned,(d:string)=>addDays(d,-1),guardian,state.preferences.visibleGuardians)??[];
  return {nights,activities:schoolActivities(date,children),slots:monthDayUI.slots(state,date,children,state.guardians,state.preferences.visibleGuardians),extra:extraSlots(date,children)};
}
function dayTimeline(date:string,children:Child[]):string{
 if(!dayTimelineUI)return '<p class="settings-note">No es pot carregar la línia temporal diària.</p>';
 const changeTime=nightChangeTime(date);
 const nights:Record<string,ReturnType<DayTimelineUI['overnightSegments']>>={};
 for(const c of children)nights[c.id]=dayTimelineUI.overnightSegments(date,c.id,changeTime,assigned,(d:string)=>addDays(d,-1),guardian,state.preferences.visibleGuardians);
 if(!children.length)return `<div class="calendar-empty-state"><p>${state.children.length?'No hi ha fills visibles. Revisa els filtres.':'Encara no hi ha fills al calendari.'}</p><button class="secondary-btn" data-action="${state.children.length?'open-filters':'tab'}" ${state.children.length?'':'data-tab="settings"'}>${state.children.length?'Configura els filtres':'Afegeix un fill'}</button></div>`;
 return dayTimelineUI.render(date,fullDate(date),children,schoolActivities(date,children),nights,changeTime,validTimelineZoom(state.preferences.timelineZoom),monthDayUI.slots(state,date,children,state.guardians,state.preferences.visibleGuardians),extraSlots(date,children));
}
function weekTimeline(start:string,children:Child[]):string{
 if(!dayTimelineUI)return '<p class="settings-note">No es pot carregar la línia temporal setmanal.</p>';
 const changeTime=validChangeTime(state.rotation.changeTime);
 const days=Array.from({length:7},(_,i)=>{
   const date=addDays(start,i);
   const nightSegments:Record<string,ReturnType<DayTimelineUI['overnightSegments']>>={};
   for(const c of children)nightSegments[c.id]=dayTimelineUI.overnightSegments(date,c.id,nightChangeTime(date),assigned,(d:string)=>addDays(d,-1),guardian,state.preferences.visibleGuardians);
   return {date,label:`${weekLong[i]} ${parseDate(date).getDate()}`,activities:schoolActivities(date,children),nightSegments,customSlots:monthDayUI.slots(state,date,children,state.guardians,state.preferences.visibleGuardians),rotatingSlots:extraSlots(date,children)};
 });
 if(!children.length)return `<div class="calendar-empty-state"><p>${state.children.length?'No hi ha fills visibles. Revisa els filtres.':'Encara no hi ha fills al calendari.'}</p><button class="secondary-btn" data-action="${state.children.length?'open-filters':'tab'}" ${state.children.length?'':'data-tab="settings"'}>${state.children.length?'Configura els filtres':'Afegeix un fill'}</button></div>`;
 return dayTimelineUI.renderWeek(start,days,children,validTimelineZoom(state.preferences.timelineZoom),selectedDate,localDate(new Date()));
}
function miniBands(date:string,children:Child[],bands:TimeBand[]):string {
  if(!children.length||!bands.length)return '<span class="mini-empty">—</span>';
  return `<span class="mini-children" style="--child-count:${children.length}">${children.map(c=>`<span title="${escapeHtml(c.name)}">${escapeHtml(shortChildLabel(c))}</span>`).join('')}</span>
    <span class="mini-grid">${bands.map(b=>`<span class="mini-band" style="--child-count:${children.length}" title="${BAND_NAMES[b]}">${children.map(c=>{
      const value=responsibility(date,c.id,b);
      return `<span class="mini-band-color ${value.type==='none'?'mini-band-empty':''}" ${value.type==='none'?'':`style="background:${value.color}"`} title="${escapeHtml(BAND_NAMES[b]+' · '+c.name+': '+value.name)}"></span>`;
    }).join('')}</span>`).join('')}</span>`;
}
function weekStart(date:string){return addDays(date,-((parseDate(date).getDay()+6)%7));}
function fullAgenda(date:string):string {
  const children=activeChildren(),bands=activeBands();
  if(!children.length)return '<p class="settings-note">Selecciona algun fill als filtres.</p>';
  if(!bands.length)return '<p class="settings-note">Activa alguna franja del dia als filtres.</p>';
  return `<div class="agenda" style="--child-count:${children.length}"><div class="agenda-corner" aria-hidden="true">Franja</div>${children.map(c=>`<div class="agenda-child" title="${escapeHtml(c.name)}">${escapeHtml(c.name)}</div>`).join('')}
  ${bands.map(b=>`<div class="agenda-band-name">${BAND_NAMES[b]}</div>${children.map(c=>{
    const value=responsibility(date,c.id,b);
    return `<button class="agenda-cell ${value.type==='none'?'is-empty':''}" type="button" data-action="edit-band" data-date="${date}" data-band="${b}" data-child="${escapeHtml(c.id)}" style="${value.color?`--band-color:${value.color}`:''}" aria-label="${escapeHtml(BAND_NAMES[b]+', '+c.name+': '+value.name+'. Toca per editar.')}"><span>${value.type==='none'?'—':escapeHtml(value.name)}</span>${value.changed?'<span class="agenda-modified">●</span>':''}</button>`;
  }).join('')}`).join('')}</div>`;
}
function periodTitle(){
  if(calendarView==='month')return monthTitle(viewYear,viewMonth);
  if(calendarView==='week'){const first=weekStart(selectedDate),last=addDays(first,6);return `${parseDate(first).getDate()} ${(months[parseDate(first).getMonth()]??'').slice(0,3)} – ${parseDate(last).getDate()} ${(months[parseDate(last).getMonth()]??'').slice(0,3)}`;}
  return `${parseDate(selectedDate).getDate()} de ${months[parseDate(selectedDate).getMonth()]}`;
}
function navigateCalendar(delta:number){
  if(calendarView==='month'){const d=new Date(viewYear,viewMonth+delta,1,12);viewYear=d.getFullYear();viewMonth=d.getMonth();selectedDate=localDate(new Date(viewYear,viewMonth,1,12));}
  else selectedDate=addDays(selectedDate,delta*(calendarView==='week'?7:1));
  viewYear=parseDate(selectedDate).getFullYear();viewMonth=parseDate(selectedDate).getMonth();render();
}
function navButton(target:Tab,label:string,name:string,kind:'side'|'mobile'){
  return `<button type="button" class="${kind==='side'?'nav-button':'mobile-tab'} ${tab===target?'active':''}" data-action="tab" data-tab="${target}" aria-current="${tab===target?'page':'false'}">${icon(name,20)}<span>${label}</span></button>`;
}
function layout(content:string){return `<div class="app-layout"><aside class="sidebar">
  <div class="brand"><span class="brand-mark">${icon('home',22)}</span><span><div class="brand-name">Calendari<br>Familiar</div><div class="brand-caption">El teu espai familiar</div></span></div>
  <nav class="side-nav" aria-label="Navegació">${navButton('calendar','Calendari','calendar','side')}${navButton('rotation','Rotacions','repeat','side')}${navButton('schools','Escoles','school','side')}${navButton('settings','Configuració','settings','side')}</nav>
  <p class="side-foot">${icon('shield',17)}<br><strong>Les dades són teves.</strong><br>Tot queda al teu dispositiu.</p>
  </aside><main class="main-area"><div class="content">${content}<div class="footer">Calendari Familiar · MVP web v${APP_VERSION} · Privat per disseny</div></div></main>
  <nav class="mobile-tabs" aria-label="Navegació principal">${navButton('calendar','Calendari','calendar','mobile')}${navButton('rotation','Rotacions','repeat','mobile')}${navButton('schools','Escoles','school','mobile')}${navButton('settings','Ajustos','settings','mobile')}</nav></div>${sheet?sheetMarkup():''}<div id="toast-region" aria-live="polite"></div>`;}
function calendarPage(){
  const today=localDate(new Date()),children=activeChildren(),bands=activeBands();
  const zoom=validTimelineZoom(state.preferences.timelineZoom),zoomIndex=TIMELINE_ZOOM_LEVELS.indexOf(zoom);
  const filtered=children.length!==state.children.length||state.preferences.visibleGuardians.length!==state.guardians.length||state.preferences.visibleSchools.length>0||bands.length!==BANDS.length;
  let content='';
  if(calendarView==='month'){
    const monthStart=new Date(viewYear,viewMonth,1,12),firstDay=(monthStart.getDay()+6)%7;
    const daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    const starting=localDate(new Date(viewYear,viewMonth,1-firstDay,12));
    const cells=Array.from({length:Math.ceil((firstDay+daysInMonth)/7)*7},(_,i)=>{
      const date=addDays(starting,i),d=parseDate(date),other=d.getMonth()!==viewMonth;
      const monthEdges=monthDayUI.outline(date,viewYear,viewMonth,i,Math.ceil((firstDay+daysInMonth)/7)*7,daysInMonth);
      const iso=i%7===0?monthDayUI.isoWeek(date):null;
      const changed=monthDayUI.hasChanges(state,date);
      const bdays=birthdays(date).filter(c=>children.some(child=>child.id===c.id));
      const snapshot=monthData(date,children),schoolCount=snapshot.activities.length;
      return `${iso?`<button type="button" class="month-week-number" data-action="show-calendar-week" data-date="${date}" title="Setmana ${iso.week} de ${iso.year}" aria-label="Mostra la setmana ${iso.week} de ${iso.year}, del ${date} al ${addDays(date,6)}">${iso.week}</button>`:''}<button type="button" class="day-cell ${other?'other-month':''} ${date===today?'today':''} ${monthEdges}" data-action="show-calendar-day" data-date="${date}" ${date===today?'aria-current="date"':''} aria-label="${escapeHtml(fullDate(date))}. ${schoolCount?schoolCount+' activitats escolars. ':''}Obre la vista Dia.">
        <span class="day-top"><span class="day-number">${d.getDate()}</span>${changed?'<span class="change-dot" title="Canvi puntual"></span>':''}</span>
        ${monthDayUI.mini(children,snapshot.nights,snapshot.activities,snapshot.slots,snapshot.extra)}
        ${bdays.length?'<span class="mini-birthday" title="Aniversari">Aniv.</span>':''}
      </button>`;
    });
    content=`${!state.children.length?`<div class="calendar-empty-state"><p>El calendari encara no té fills.</p><button class="secondary-btn" data-action="tab" data-tab="settings">Afegeix un fill</button></div>`:''}<div class="weekdays"><span class="month-week-heading" title="Número de setmana ISO">Setm.</span>${weekdays.map(d=>`<span>${d}</span>`).join('')}</div><div class="month-grid">${cells.join('')}</div>`;
  } else if(calendarView==='week'){
    content=weekTimeline(weekStart(selectedDate),children);
  } else {
    content=`<section class="daily-agenda"><div class="agenda-day-heading"><strong>${escapeHtml(fullDate(selectedDate))}</strong></div><div class="day-edit-actions">${state.children.length?`<button type="button" class="soft-btn" data-action="day-slot-add" data-date="${selectedDate}">+ Afegeix una franja</button>`:''}${monthDayUI.hasChanges(state,selectedDate)?`<button type="button" class="soft-btn" data-action="day-restore" data-date="${selectedDate}">Restaurar segons la rotació</button>`:''}</div>${schoolInfoForDay(selectedDate)}${dayTimeline(selectedDate,children)}</section>`;
  }
  const visibleNames=bands.map(b=>BAND_NAMES[b]).join(' · ');
  return `<header class="page-heading"><div><div class="eyebrow">EL TEU CALENDARI</div><h1 class="page-title">Calendari Familiar</h1><p class="page-subtitle">${calendarView==='day'||calendarView==='week'?'Pernoctes i activitats per fill durant les 24 hores.':'Miniatures proporcionals a les 24 hores de cada dia.'}</p></div>
    <div class="heading-actions"><button class="filter-button" data-action="open-filters" aria-label="Filtrar fills, tutors, escoles i franges">${icon('filter',18)}<span class="filter-copy">Filtres</span>${filtered?'<span class="filter-dot"></span>':''}</button></div></header>
    <section class="calendar-card" aria-label="Calendari familiar"><div class="calendar-toolbar"><div class="calendar-title">${escapeHtml(periodTitle())}</div><div class="calendar-nav"><button class="soft-btn" data-action="today">Avui</button><button class="btn-icon" data-action="calendar-navigate" data-step="-1" aria-label="Anterior">${icon('chevronLeft',18)}</button><button class="btn-icon" data-action="calendar-navigate" data-step="1" aria-label="Següent">${icon('chevronRight',18)}</button></div></div>
    <div class="calendar-view-switch" role="group" aria-label="Vista de calendari">${([['month','Mes'],['week','Setmana'],['day','Dia']] as const).map(([value,label])=>`<button data-action="calendar-view" data-view="${value}" class="${calendarView===value?'active':''}" aria-pressed="${calendarView===value}">${label}</button>`).join('')}</div>
    ${calendarView==='day'||calendarView==='week'?`<div class="timeline-zoom-toolbar" role="group" aria-label="Zoom vertical de les hores">
      <label for="timeline-zoom">Zoom</label>
      <button type="button" class="timeline-zoom-button" data-action="timeline-zoom-step" data-step="-1" aria-label="Allunya el zoom per veure més hores" ${zoomIndex===0?'disabled':''}>−</button>
      <input id="timeline-zoom" data-action="timeline-zoom" type="range" min="0" max="5" step="1" value="${zoomIndex}" aria-label="Zoom de la línia temporal" aria-valuetext="${zoom} per cent" />
      <button type="button" class="timeline-zoom-button" data-action="timeline-zoom-step" data-step="1" aria-label="Apropa el zoom per veure més detall" ${zoomIndex===TIMELINE_ZOOM_LEVELS.length-1?'disabled':''}>+</button>
      <output id="timeline-zoom-value" for="timeline-zoom" aria-live="polite">${zoom}%</output>
    </div>`:''}
    ${content}
    <footer class="calendar-bottom"><div class="legend">${state.schools.filter(s=>state.preferences.visibleSchools.includes(s.id)).map(s=>`<span class="legend-entry"><span class="legend-color" style="background:${s.color}"></span>${escapeHtml(s.name)}</span>`).join('')}${state.guardians.filter(g=>state.preferences.visibleGuardians.includes(g.id)).map(g=>`<span class="legend-entry"><span class="legend-color" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>`).join('')}<span class="legend-entry"><span class="legend-color legend-empty"></span>Sense assignar</span></div>
    <span class="legend-note">● canvi puntual</span></footer></section>
    ${calendarView==='day'||calendarView==='week'?`<div class="time-row-help">Vista de 24 hores per fill, amb pernocta i activitats escolars. Desplaça la cronologia verticalment per consultar totes les hores i horitzontalment a la setmana per veure tots els dies.</div><div class="tip-card">${icon('info',18)}<span>El color de fons indica la pernocta. Les activitats escolars se superposen. Toca un bloc per consultar l’activitat o editar l’assignació de la nit.</span></div>`:`<div class="time-row-help">Les miniatures mostren 00:00–24:00. Toca un dia per obrir Dia, o el número de setmana a l’esquerra per obrir Setmana.</div>
    <div class="tip-card">${icon('info',18)}<span>Els colors mostren les pernoctes i les escoles superposades. A Dia i Setmana pots tocar les franges per editar-les o consultar-les.</span></div>`}`;
}
function rotationPage(){
  if(!state.children.length)return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1></div></header>
    <section class="card"><h2 class="section-title">Encara no hi ha fills</h2><p class="section-description">Pots crear el calendari des de zero. Afegeix un fill a Configuració per definir-ne les pernoctes.</p><button class="primary-btn" data-action="tab" data-tab="settings">Ves a Configuració</button></section>`;
  if(!state.guardians.length)return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1></div></header>
    <section class="card"><h2 class="section-title">Encara no hi ha tutors</h2><p class="section-description">Afegeix almenys un tutor a Configuració per poder assignar les pernoctes.</p><button class="primary-btn" data-action="tab" data-tab="settings">Ves a Configuració</button></section>`;
  const r=rotationDraft??state.rotation;
  return `<header class="page-heading"><div><div class="eyebrow">ORGANITZACIÓ</div><h1 class="page-title">Rotacions</h1><p class="page-subtitle">Defineix la pernocta i altres franges amb patrons independents.</p></div></header>
    <section class="card"><div class="panel-header"><h2 class="section-title">Configuració del patró</h2><span class="sample-tag">Repetició automàtica</span></div><p class="section-description">Tria el primer dia, la durada i l’hora de canvi de pernocta. El patró es repeteix indefinidament.</p>
    <div class="form-row"><div class="field"><label for="rotation-start">Data d’inici</label><input id="rotation-start" type="date" value="${r.startDate}" data-action="rotation-start" /></div>
    <div class="field"><label for="rotation-length">Durada de la rotació</label><div class="duration-row"><input id="rotation-length" type="number" min="1" max="${rotationUnit==='weeks'?MAX_ROTATION_DAYS/7:MAX_ROTATION_DAYS}" step="1" inputmode="numeric" value="${rotationUnit==='weeks'?Math.ceil(r.length/7):r.length}" data-action="rotation-length" aria-label="Nombre de dies o setmanes" /><select id="rotation-unit" data-action="rotation-unit" aria-label="Unitat de la rotació"><option value="days" ${rotationUnit==='days'?'selected':''}>dies</option><option value="weeks" ${rotationUnit==='weeks'?'selected':''}>setmanes</option></select></div></div></div>
    <div class="field rotation-change-field"><label for="rotation-change-time">Hora de canvi de pernocta</label><input id="rotation-change-time" type="time" data-action="rotation-change-time" value="${validChangeTime(r.changeTime)}" /><p class="settings-note">Per defecte, 19:00. La nit assignada a una data va des d’aquesta hora fins a la mateixa hora de l’endemà.</p></div>
    <p class="duration-help">${r.length} ${r.length===1?'dia':'dies'} de rotació · ${Math.ceil(r.length/7)} ${Math.ceil(r.length/7)===1?'setmana':'setmanes'} ${r.length%7===0?'':'(l’última incompleta)'}. Les nits afegides hereten el patró actual fins que les canviïs.</p>
    <div class="rotation-pattern-times"><h3 class="section-title">Hora de canvi per dia del patró</h3><p class="settings-note">Per defecte s'usa l'hora general; aquí pots canviar-la per a cada dia de la rotació.</p>
    <div class="pattern-time-grid">${Array.from({length:r.length},(_,i)=>`<label class="field pattern-time-field">Dia ${i+1} · ${weekdays[(parseDate(addDays(r.startDate,i)).getDay()+6)%7]}<input type="time" data-action="rotation-pattern-time" data-index="${i}" value="${escapeHtml(nightPatternDraft[i]??r.changeTime)}"></label>`).join('')}</div></div>
    <hr><div class="panel-header"><h2 class="section-title">Assignació per fill</h2><div class="action-row"><button class="secondary-btn" data-action="rotation-same">${icon('copy',14)} Tots igual</button><button class="secondary-btn" data-action="rotation-show-all">${rotationShowAll?'Vista compacta':'Mostra tots'}</button></div></div><p class="section-description">Toca cada casella per triar el tutor d’aquella nit. La lletra i el color corresponen al tutor.</p>
    ${state.children.filter((c,i)=>rotationShowAll||i===0||state.children.some(first=>JSON.stringify(r.assignments[first.id])!==JSON.stringify(r.assignments[state.children[0]!.id]))).map((c,cIndex)=>`<div class="rotation-child"><div class="rotation-child-header"><strong>${escapeHtml(c.name)}</strong>${cIndex>0?`<button class="soft-btn" data-action="rotation-copy" data-child="${escapeHtml(c.id)}" data-from="${escapeHtml(state.children[0]!.id)}">Copiar de ${escapeHtml(state.children[0]!.name)}</button>`:''}</div>
    ${Array.from({length:Math.ceil(r.length/7)},(_,week)=>`<div class="rotation-week"><div class="rotation-week-header"><div class="rotation-week-title">Setmana ${week+1}</div><button class="week-fill-btn" data-action="rotation-week-fill" data-child="${escapeHtml(c.id)}" data-week="${week}" aria-label="Assigna tota la setmana ${week+1} de ${escapeHtml(c.name)}">Assigna setmana</button></div><div class="rotation-days">${Array.from({length:Math.min(7,r.length-week*7)},(_,day)=>{
      const i=week*7+day,g=guardian(r.assignments[c.id]?.[i]??'');
      return `<button class="rotation-cell" data-action="rotation-cell" data-child="${escapeHtml(c.id)}" data-index="${i}" aria-label="${escapeHtml(c.name)}, dia ${i+1}, ${escapeHtml(g?.name??'sense tutor')}"><span class="small-day">${weekdays[(parseDate(addDays(r.startDate,i)).getDay()+6)%7]}</span><span class="guardian-initial" style="background:${g?.color??'#edf0f4'}">${escapeHtml(initial(g?.name??'?'))}</span></button>`;
    }).join('')}</div></div>`).join('')}</div>`).join('')}
    <div class="action-row"><button class="primary-btn" data-action="rotation-save">Desa el patró</button>${rotationDraft?'<button class="soft-btn" data-action="rotation-cancel">Descarta canvis</button>':''}</div>
    <p class="settings-note">Les excepcions de dates concretes tenen prioritat sobre el patró. Si canvies el patró, les excepcions es mantenen.</p></section>
    ${rotationEditor.render(state,extraRotationOpen,extraRotationUnits)}`;
}
function schoolById(id:string|undefined){return state.schools.find(s=>s.id===id);}
function yearById(school:School|undefined,id:string|undefined){return school?.years.find(y=>y.id===id);}
function groupById(year:SchoolYear|undefined,id:string|undefined){return year?.groups.find(g=>g.id===id);}
function schoolYearName(y:SchoolYear){return `Curs ${y.startDate.slice(0,4)}-${y.endDate.slice(0,4)}`;}
function shortDate(date:string){const d=parseDate(date);return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`;}
function schoolNavButton(label:string,nav:{schoolId?:string;yearId?:string;groupId?:string},style='school-link'){
  return `<button type="button" class="${style}" data-action="school-nav" ${nav.schoolId?`data-school="${escapeHtml(nav.schoolId)}"`:''} ${nav.yearId?`data-year="${escapeHtml(nav.yearId)}"`:''} ${nav.groupId?`data-group="${escapeHtml(nav.groupId)}"`:''}>${escapeHtml(label)} ${icon('chevronRight',15)}</button>`;
}
function schoolCrumb(text:string,nav:{schoolId?:string;yearId?:string;groupId?:string}={}){
 return `<button class="school-breadcrumb" type="button" data-action="school-nav" ${nav.schoolId?`data-school="${escapeHtml(nav.schoolId)}"`:''} ${nav.yearId?`data-year="${escapeHtml(nav.yearId)}"`:''}>${icon('chevronLeft',15)} ${escapeHtml(text)}</button>`;
}
function schoolMembershipPanel(school:School):string {
  const base=`data-school="${escapeHtml(school.id)}"`;
  return `<section class="card"><h2 class="section-title">Fills associats a l’escola</h2>
    <p class="section-description">Associa els fills a l’escola sense necessitat de crear grups. Les hores de jornada s’estableixen a cada curs.</p>
    ${state.children.map(c=>{const chosen=school.childIds.includes(c.id);return `<button type="button" class="school-child-choice ${chosen?'selected':''}" data-action="school-membership-toggle" ${base} data-child="${escapeHtml(c.id)}" aria-pressed="${chosen}"><span>${escapeHtml(c.name)}</span>${chosen?icon('check',18):icon('plus',17)}</button>`;}).join('')}
  </section>`;
}
function schoolSchedulePanel(school:School,year:SchoolYear,group:ClassGroup):string {
  const entries=[...group.weeklySchedule].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime));
  const base=`data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}"`;
  return `<section class="card">
    <div class="panel-header"><h2 class="section-title">Activitats del grup</h2><button class="secondary-btn" data-action="schedule-add" ${base}>${icon('plus',14)} Activitat</button></div>
    <p class="section-description">Les hores d’inici i final de la jornada ordinària es defineixen al curs. Cada grup pot tenir activitats diferents i a hores diferents, dins d’aquest interval. No hi ha horaris ordinaris diferents per fill.</p>
    ${!year.ordinaryWindow?'<p class="school-schedule-notice">Configura les hores de jornada ordinària al curs abans d’afegir activitats noves.</p>':''}
    ${entries.length?entries.map(a=>`<div class="school-schedule-row"><div><strong>${weekLong[a.weekday]}</strong> · ${a.startTime}–${a.endTime}<span class="school-meta">${SESSION_KIND_NAMES[sessionKind(a.kind)]}${a.label?` · ${escapeHtml(a.label)}`:''}</span></div><div class="school-schedule-actions"><button class="school-schedule-edit" data-action="schedule-edit" ${base} data-session="${escapeHtml(a.id)}" aria-label="Edita l’activitat">${icon('pencil',15)}</button><button class="delete-icon" data-action="schedule-delete" ${base} data-session="${escapeHtml(a.id)}" aria-label="Suprimeix l’activitat">${icon('trash',15)}</button></div></div>`).join(''):'<p class="settings-note">Aquest grup encara no té activitats afegides. S’aplica l’horari general de l’escola.</p>'}
  </section>`;
}
function scheduleEntriesForEdit(group:ClassGroup,childId:string,mode:ScheduleMode):WeeklySession[]|undefined{
  if(childId)return undefined; // Els horaris individuals antics són de lectura, però no es poden continuar editant.
  return mode==='reduced'?(group.reducedWeeklySchedule??[]):group.weeklySchedule;
}
function schoolReducedPanel(school:School,year:SchoolYear,group:ClassGroup):string {
  const sessions=[...(group.reducedWeeklySchedule??[])].sort((a,b)=>a.weekday-b.weekday||a.startTime.localeCompare(b.startTime));
  const base=`data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-mode="reduced"`;
  return `<section class="card">
    <div class="panel-header"><h2 class="section-title">Activitats en jornada reduïda</h2>${year.reducedWindow?`<button class="secondary-btn" data-action="schedule-add" ${base}>${icon('plus',14)} Activitat</button>`:''}</div>
    <p class="section-description">Defineix les activitats d’aquest grup i les hores de cadascuna per als dies marcats com a jornada reduïda al curs. Poden ser diferents de les activitats dels dies ordinaris.</p>
    ${year.reducedWindow?`<p class="settings-note">Límit horari del curs: <strong>${year.reducedWindow.startTime}–${year.reducedWindow.endTime}</strong>. Les activitats s’apliquen només als dies de jornada reduïda i segons el dia de la setmana.</p>
    ${sessions.length?sessions.map(a=>`<div class="school-schedule-row"><div><strong>${weekLong[a.weekday]}</strong> · ${a.startTime}–${a.endTime}<span class="school-meta">${SESSION_KIND_NAMES[sessionKind(a.kind)]}${a.label?` · ${escapeHtml(a.label)}`:''}</span></div><div class="school-schedule-actions"><button class="school-schedule-edit" data-action="schedule-edit" ${base} data-session="${escapeHtml(a.id)}" aria-label="Edita l’activitat de jornada reduïda">${icon('pencil',15)}</button><button class="delete-icon" data-action="schedule-delete" ${base} data-session="${escapeHtml(a.id)}" aria-label="Suprimeix l’activitat de jornada reduïda">${icon('trash',15)}</button></div></div>`).join('')+`<div class="action-row"><button class="soft-btn" data-action="schedule-inherit" ${base}>Esborra totes les activitats reduïdes</button></div>`:'<p class="settings-note">Encara no hi ha activitats específiques de jornada reduïda. Pots afegir-ne amb el botó «Activitat». Al calendari es continua indicant la jornada escolar dins de les hores reduïdes.</p>'}`:
    `<div class="school-schedule-notice">Configura primer les hores de jornada reduïda al curs. <button class="secondary-btn" data-action="reduced-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">Configura les hores</button></div>`}
  </section>`;
}
function schoolsPage():string {
 const school=schoolById(schoolNav.schoolId),year=yearById(school,schoolNav.yearId),group=groupById(year,schoolNav.groupId);
 if(!school) return `<header class="page-heading"><div><div class="eyebrow">VIDA ESCOLAR</div><h1 class="page-title">Escoles</h1><p class="page-subtitle">Escoles, cursos i grups dels fills.</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Les escoles</h2><button class="secondary-btn" data-action="school-add">${icon('plus',15)} Afegir escola</button></div>
 <p class="section-description">Cada escola pot tenir diferents cursos, grups classe, festius i dies d’horari reduït. Les dades són privades i es desen al teu dispositiu.</p>
 ${state.schools.length?state.schools.map(s=>`<div class="school-row"><span class="school-color-dot" style="background:${s.color}" aria-hidden="true"></span>${schoolNavButton(s.name,{schoolId:s.id})}<span class="school-meta">${s.years.length} ${s.years.length===1?'curs':'cursos'}</span></div>`).join(''):'<div class="empty-state">Encara no has afegit cap escola. Afegeix-ne una per començar.</div>'}</section>`;
 if(!year) return `<header class="page-heading"><div>${schoolCrumb('Escoles')}<div class="eyebrow">ESCOLA</div><h1 class="page-title">${escapeHtml(school.name)}</h1><p class="page-subtitle">${escapeHtml(school.address||'Adreça no indicada')}${school.phone?` · ${escapeHtml(school.phone)}`:''}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Dades de l’escola</h2><button class="secondary-btn" data-action="school-edit" data-school="${escapeHtml(school.id)}">${icon('pencil',15)} Edita</button></div>
 <div class="school-details"><p><span class="school-color-dot" style="background:${school.color}"></span><strong>Color de l’escola</strong></p>${school.address?`<p><strong>Adreça:</strong> ${escapeHtml(school.address)}</p>`:''}${school.phone?`<p><strong>Telèfon:</strong> <a href="tel:${escapeHtml(school.phone.replace(/[^+\d]/g,''))}">${escapeHtml(school.phone)}</a></p>`:''}${!school.address&&!school.phone?'<p class="settings-note">Sense adreça ni telèfon.</p>':''}</div>
 <div class="action-row"><button class="danger-btn" data-action="school-delete" data-school="${escapeHtml(school.id)}">Suprimeix l’escola</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Cursos escolars</h2><button class="secondary-btn" data-action="year-add" data-school="${escapeHtml(school.id)}">${icon('plus',15)} Afegir curs</button></div>
 ${school.years.length?[...school.years].sort((a,b)=>b.startDate.localeCompare(a.startDate)).map(y=>`<div class="school-row">${schoolNavButton(schoolYearName(y),{schoolId:school.id,yearId:y.id})}<span class="school-meta">${shortDate(y.startDate)} – ${shortDate(y.endDate)}</span></div>`).join(''):'<div class="empty-state">Afegeix un curs escolar indicant les dates d’inici i final.</div>'}</section>${schoolMembershipPanel(school)}`;
 if(!group) return `<header class="page-heading"><div>${schoolCrumb(school.name,{schoolId:school.id})}<div class="eyebrow">${escapeHtml(school.name)}</div><h1 class="page-title">${schoolYearName(year)}</h1><p class="page-subtitle">Del ${shortDate(year.startDate)} al ${shortDate(year.endDate)}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Calendari escolar</h2><button class="soft-btn" data-action="year-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil',14)} Dates</button></div>
 <p class="section-description">Els festius i els dies d’horari reduït han d’estar compresos dins del curs. Són dies concrets, no es repeteixen automàticament.</p>
 <div class="school-period"><div class="panel-header"><strong>Dies festius (${year.holidays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus',14)} Dia</button></div>
 ${year.holidays.length?`<div class="school-day-list">${year.holidays.map(d=>`<span class="school-day-pill">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="holiday" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix el festiu ${d}">${icon('close',13)}</button></span>`).join('')}</div>`:'<p class="settings-note">No hi ha dies festius.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Horari reduït (${year.reducedDays.length})</strong><button class="secondary-btn" data-action="school-day-add" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus',14)} Dia</button></div>
 ${year.reducedDays.length?`<div class="school-day-list">${year.reducedDays.map(d=>`<span class="school-day-pill reduced">${shortDate(d)} <button type="button" data-action="school-day-delete" data-kind="reduced" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-date="${d}" aria-label="Suprimeix l’horari reduït ${d}">${icon('close',13)}</button></span>`).join('')}</div>`:'<p class="settings-note">No hi ha dies d’horari reduït.</p>'}</div>
 <div class="school-period"><div class="panel-header"><strong>Hores de jornada ordinària</strong><button class="secondary-btn" data-action="ordinary-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil',14)} ${year.ordinaryWindow?'Edita':'Configura'}</button></div>
  <p class="settings-note">${year.ordinaryWindow?`De ${year.ordinaryWindow.startTime} a ${year.ordinaryWindow.endTime}. Aquestes hores delimiten la jornada normal dels dies lectius del curs. Les activitats són pròpies de cada grup.`:"Encara no s’han especificat les hores de jornada ordinària d’aquest curs."}</p></div>
  <div class="school-period"><div class="panel-header"><strong>Hores de jornada reduïda</strong><button class="secondary-btn" data-action="reduced-window-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('pencil',14)} ${year.reducedWindow?'Edita':'Configura'}</button></div>
 <p class="settings-note">${year.reducedWindow?`De ${year.reducedWindow.startTime} a ${year.reducedWindow.endTime}. Aquestes hores s'apliquen a tots els dies reduïts del curs.`:"Encara no s'han especificat les hores de jornada reduïda; no se'n calcula un horari fins que les configuris."}</p></div>
 <div class="action-row"><button class="danger-btn" data-action="year-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">Suprimeix el curs</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grups classe</h2><button class="secondary-btn" data-action="group-add" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}">${icon('plus',14)} Afegir grup</button></div>
 ${year.groups.length?year.groups.map(g=>`<div class="school-row">${schoolNavButton(g.name,{schoolId:school.id,yearId:year.id,groupId:g.id})}<span class="school-meta">${g.childIds.length} ${g.childIds.length===1?'fill':'fills'}${g.tutorName?` · ${escapeHtml(g.tutorName)}`:''}</span></div>`).join(''):'<div class="empty-state">Encara no hi ha cap grup. Pots afegir-hi «Segon», «Sisè A» o qualsevol altre.</div>'}</section>`;
 const schedulePanel=schoolSchedulePanel(school,year,group);
 return `<header class="page-heading"><div>${schoolCrumb(schoolYearName(year),{schoolId:school.id,yearId:year.id})}<div class="eyebrow">${escapeHtml(school.name)} · ${schoolYearName(year)}</div><h1 class="page-title">${escapeHtml(group.name)}</h1><p class="page-subtitle">${group.tutorName?`Tutor/a: ${escapeHtml(group.tutorName)}`:'Tutor/a no especificat'}</p></div></header>
 <section class="card"><div class="panel-header"><h2 class="section-title">Grup classe</h2><button class="secondary-btn" data-action="group-edit" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">${icon('pencil',15)} Edita</button></div>
 <div class="action-row"><button class="danger-btn" data-action="group-delete" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}">Suprimeix el grup</button></div></section>
 <section class="card"><div class="panel-header"><h2 class="section-title">Fills del grup</h2></div><p class="section-description">Selecciona els fills que pertanyen a aquest grup aquest curs. Un fill només pot estar en un grup del mateix curs i escola.</p>
 ${state.children.map(c=>{const selected=group.childIds.includes(c.id),other=year.groups.find(g=>g.id!==group.id&&g.childIds.includes(c.id));return `<button class="school-child-choice ${selected?'selected':''}" data-action="school-child-toggle" data-school="${escapeHtml(school.id)}" data-year="${escapeHtml(year.id)}" data-group="${escapeHtml(group.id)}" data-child="${escapeHtml(c.id)}" aria-pressed="${selected}"><span>${escapeHtml(c.name)}${other?`<small>Actualment a ${escapeHtml(other.name)}</small>`:''}</span>${selected?icon('check',18):icon('plus',17)}</button>`;}).join('')}
 </section>${schedulePanel}${schoolReducedPanel(school,year,group)}`;
}
function schoolFormMarkup():string {
 if(!sheet)return '';
 const heading=(title:string,subtitle:string)=>`<div class="sheet-heading"><div><h2 class="sheet-title">${escapeHtml(title)}</h2><p class="sheet-subtitle">${escapeHtml(subtitle)}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>`;
 const field=(label:string,name:string,type:string,value:string,required=false,maxLength=0)=>`<div class="field"><label for="school-field-${name}">${escapeHtml(label)}</label><input id="school-field-${name}" name="${name}" type="${type}" value="${escapeHtml(value)}" ${required?'required':''} ${maxLength?`maxlength="${maxLength}"`:''} /></div>`;
 const actions='<div class="action-row"><button class="primary-btn" type="submit">Desa</button><button type="button" class="soft-btn" data-action="close-sheet">Cancel·la</button></div>';
 if(sheet.type==='schoolForm'){
  const school=schoolById(sheet.schoolId);
  return heading(school?'Edita escola':'Afegeix escola','Nom obligatori; adreça i telèfon opcionals')+`<form data-school-form="school" data-school="${escapeHtml(school?.id??'')}"><div class="school-form-fields">${field('Nom de l’escola','name','text',school?.name??'',true,100)}${field('Adreça (opcional)','address','text',school?.address??'',false,200)}${field('Telèfon (opcional)','phone','tel',school?.phone??'',false,50)}${field('Color de l’escola','color','color',school?.color??suggestedSchoolColor(state.schools),true)}</div>${actions}</form>`;
 }
 if(sheet.type==='yearForm'){
  const school=schoolById(sheet.schoolId),year=yearById(school,sheet.yearId);
  const now=new Date(),startYear=now.getMonth()>=6?now.getFullYear():now.getFullYear()-1;
  return heading(year?'Edita curs escolar':'Afegeix curs escolar','El nom es genera automàticament a partir dels anys de les dates')+`<form data-school-form="year" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(year?.id??'')}"><div class="school-form-fields">${field('Data d’inici','startDate','date',year?.startDate??`${startYear}-09-01`,true)}${field('Data de finalització','endDate','date',year?.endDate??`${startYear+1}-06-30`,true)}</div><p class="settings-note">Format del nom: «Curs any inici-any final». Els dies festius i d’horari reduït han de quedar dins d’aquest interval.</p>${actions}</form>`;
 }
 if(sheet.type==='groupForm'){
  const school=schoolById(sheet.schoolId),year=yearById(school,sheet.yearId),group=groupById(year,sheet.groupId);
  return heading(group?'Edita grup classe':'Afegeix grup classe','Exemples: Segon, Sisè A')+`<form data-school-form="group" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-group="${escapeHtml(group?.id??'')}"><div class="school-form-fields">${field('Nom del grup','name','text',group?.name??'',true,80)}${field('Nom del tutor/a (opcional)','tutorName','text',group?.tutorName??'',false,100)}</div>${actions}</form>`;
 }
 if(sheet.type==='schoolDayForm'){
  const school=schoolById(sheet.schoolId),year=yearById(school,sheet.yearId);if(!year)return '';
  return heading(sheet.kind==='holiday'?'Afegeix dia festiu':'Afegeix dia d’horari reduït',`${schoolYearName(year)} · ${shortDate(year.startDate)} – ${shortDate(year.endDate)}`)+`<form data-school-form="day" data-kind="${sheet.kind}" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields"><div class="field"><label for="school-date">Data</label><input id="school-date" name="date" type="date" min="${year.startDate}" max="${year.endDate}" value="${year.startDate}" required /></div></div>${actions}</form>`;
 }
 if(sheet.type==='reducedWindowForm'){
   const year=yearById(schoolById(sheet.schoolId),sheet.yearId);
   if(!year)return '';
   return heading('Hores de jornada reduïda',schoolYearName(year))+`<form data-school-form="reducedWindow" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields">
   <p class="settings-note">Introdueix les hores conegudes: l'aplicació no les assumeix. Els horaris ordinaris es retallaran a aquest interval sense modificar-ne els originals.</p>
   <div class="form-row">${field('Inici','startTime','time',year.reducedWindow?.startTime??'',true)}${field('Final','endTime','time',year.reducedWindow?.endTime??'',true)}</div>
   </div>${actions}</form>`;
 }
 if(sheet.type==='ordinaryWindowForm'){
    const year=yearById(schoolById(sheet.schoolId),sheet.yearId);
    if(!year)return '';
    return heading('Hores de jornada ordinària',schoolYearName(year))+`<form data-school-form="ordinaryWindow" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}"><div class="school-form-fields">
      <p class="settings-note">Indica l’hora d’entrada i la de sortida de l’escola els dies lectius normals. Les activitats concretes es defineixen a cada grup.</p>
      <div class="form-row">${field('Inici','startTime','time',year.ordinaryWindow?.startTime??'',true)}${field('Final','endTime','time',year.ordinaryWindow?.endTime??'',true)}</div>
    </div>${actions}</form>`;
  }
  if(sheet.type==='scheduleForm'){
  const school=schoolById(sheet.schoolId),year=yearById(school,sheet.yearId),group=groupById(year,sheet.groupId);
  if(!group)return '';
  const childId=group.childIds.includes(sheet.childId??'')?sheet.childId??'':'';
  const mode:ScheduleMode=sheet.mode==='reduced'?'reduced':'ordinary';
  const entries=scheduleEntriesForEdit(group,childId,mode);
  if(!entries)return '';
  const sessionId=sheet.sessionId;
  const reducedWindow=mode==='reduced'?year?.reducedWindow:undefined;
   const ordinaryWindow=mode==='ordinary'?year?.ordinaryWindow:undefined;
  if(mode==='reduced'&&!reducedWindow)return '';
  const session=entries.find(a=>a.id===sessionId);
  const weekdaysInput=session
    ?`<div class="field"><label for="session-weekday">Dia de la setmana</label><select name="weekday" id="session-weekday">${weekLong.map((label,i)=>`<option value="${i}" ${session.weekday===i?'selected':''}>${label}</option>`).join('')}</select></div>`
    :`<fieldset class="school-schedule-weekdays"><legend>Dies de la setmana</legend><div>${weekLong.map((label,i)=>`<label><input type="checkbox" name="weekdays" value="${i}" ${i<5?'checked':''}/> ${label}</label>`).join('')}</div></fieldset>`;
  return heading(session?'Edita activitat':'Afegeix activitat',mode==='reduced'?'Jornada reduïda · '+group.name:group.name)+`<form data-school-form="schedule" data-school="${escapeHtml(sheet.schoolId)}" data-year="${escapeHtml(sheet.yearId)}" data-group="${escapeHtml(sheet.groupId)}" data-child="${escapeHtml(childId)}" data-session="${escapeHtml(session?.id??'')}" data-mode="${mode}"><div class="school-form-fields">
  ${weekdaysInput}
  <div class="form-row">${field('Inici','startTime','time',session?.startTime??reducedWindow?.startTime??ordinaryWindow?.startTime??'09:00',true)}${field('Final','endTime','time',session?.endTime??reducedWindow?.endTime??ordinaryWindow?.endTime??'13:00',true)}</div>
  <div class="field"><label for="session-kind">Tipus d'activitat</label><select name="kind" id="session-kind">${SESSION_KINDS.map(k=>`<option value="${k}" ${sessionKind(session?.kind)===k?'selected':''}>${SESSION_KIND_NAMES[k]}</option>`).join('')}</select></div>
  ${field('Descripció (opcional)','label','text',session?.label??'',false,80)}</div>
  <p class="settings-note">Les activitats del mateix grup i dia no es poden solapar. ${reducedWindow?`Aquesta activitat només s’aplica als dies de jornada reduïda marcats al curs que coincideixin amb el dia de la setmana seleccionat. Ha de quedar entre les ${reducedWindow.startTime} i les ${reducedWindow.endTime}.`:'L’activitat s’aplica als dies ordinaris del grup, dins de la jornada del curs.'}</p>${actions}</form>`;
 }
 return '';
}
/** Festius/reducció de tots els centres en què un fill està matriculat aquell dia. */
function schoolInfoForDay(date:string):string {
 const lines:string[]=[];
 for(const school of state.schools)for(const year of school.years){
  if(date<year.startDate||date>year.endDate)continue;
  const dayKind=year.holidays.includes(date)?'Festiu escolar':year.reducedDays.includes(date)?'Horari reduït':'';
  if(!dayKind)continue;
  const ids=[...new Set([...school.childIds,...year.groups.flatMap(g=>g.childIds)])];
  const enrolled=ids.map(id=>childById(id)?.name).filter((name):name is string=>Boolean(name));
  if(enrolled.length)lines.push(`<div class="school-day-notice"><strong>${escapeHtml(dayKind)}</strong> · ${escapeHtml(school.name)} (${escapeHtml(enrolled.join(', '))})</div>`);
 }
 return lines.length?`<div class="sheet-section-label">Informació escolar</div>${lines.join('')}`:'';
}
function settingsPage(){
  const storageDescription=storageMode==='indexeddb'?'IndexedDB · desat automàtic':storageMode==='localStorage'?'LocalStorage · mode alternatiu':'Sense persistència garantida';
  return `<header class="page-heading"><div><div class="eyebrow">PREFERÈNCIES</div><h1 class="page-title">Configuració</h1><p class="page-subtitle">Personalitza el teu calendari familiar.</p></div></header>
  <section class="card appearance-card"><h2 class="section-title">Aparença</h2><p class="section-description">Tria el tema de l'aplicació. Automàtic segueix l'aparença de l'iPhone.</p>
  <div class="theme-options" role="group" aria-label="Mode d’aparença">${([['auto','Automàtic','monitor'],['light','Clar','sun'],['dark','Fosc','moon']] as const).map(([mode,label,glyph])=>`<button type="button" class="theme-choice ${validTheme(state.preferences.theme)===mode?'is-selected':''}" data-action="set-theme" data-theme-mode="${mode}" aria-pressed="${validTheme(state.preferences.theme)===mode}">${icon(glyph,19)}<span>${label}</span></button>`).join('')}</div></section>
  <section class="card font-size-card"><div class="panel-header"><h2 class="section-title">Mida de lletra</h2><output id="font-size-current" for="font-size-slider" class="sample-tag">${FONT_SIZE_LABELS[validFontSize(state.preferences.fontSize)]}</output></div>
  <p class="section-description">Augmenta la lletra de totes les vistes per llegir més còmodament.</p>
  <input id="font-size-slider" type="range" class="font-size-range" min="0" max="2" step="1" value="${FONT_SIZE_OPTIONS.indexOf(validFontSize(state.preferences.fontSize))}" data-action="font-size" aria-label="Mida de lletra" aria-valuetext="${FONT_SIZE_LABELS[validFontSize(state.preferences.fontSize)]}" />
  <div class="font-size-labels"><span>Normal</span><span>Gran</span><span>Molt gran</span></div></section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Fills</h2><button class="secondary-btn" data-action="add-child">${icon('plus',14)} Afegir</button></div><p class="section-description">La data de naixement és opcional. Si l’afegeixes, els aniversaris apareixeran al calendari. Pots començar sense cap fill.</p>
  ${!state.children.length?'<p class="settings-note">Encara no hi ha fills. Prem «Afegir» per començar.</p>':''}
  ${state.children.map(c=>`<div class="settings-item"><div class="field"><label for="child-name-${escapeHtml(c.id)}">Nom</label><input id="child-name-${escapeHtml(c.id)}" type="text" maxlength="70" value="${escapeHtml(c.name)}" data-action="child-name" data-child="${escapeHtml(c.id)}" /></div><div class="field"><label for="child-birth-${escapeHtml(c.id)}">Naixement</label><input id="child-birth-${escapeHtml(c.id)}" type="date" value="${escapeHtml(c.birthDate)}" data-action="child-birth" data-child="${escapeHtml(c.id)}" /></div><button class="delete-icon" data-action="delete-child" data-child="${escapeHtml(c.id)}" aria-label="Suprimeix ${escapeHtml(c.name)}" >${icon('trash',16)}</button></div>`).join('')}</section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Tutors i responsables</h2><button class="secondary-btn" data-action="add-guardian">${icon('plus',14)} Afegir</button></div><p class="section-description">Tria un color diferent per identificar cada tutor d’un cop d’ull.</p>
  ${!state.guardians.length?'<p class="settings-note">Encara no hi ha tutors. Prem «Afegir» per crear-ne un.</p>':''}
  ${state.guardians.map(g=>`<div class="settings-item guardian"><input class="color-input" type="color" value="${g.color}" data-action="guardian-color" data-guardian="${escapeHtml(g.id)}" aria-label="Color de ${escapeHtml(g.name)}" /><div class="field"><label for="guardian-name-${escapeHtml(g.id)}">Nom</label><input id="guardian-name-${escapeHtml(g.id)}" type="text" maxlength="70" value="${escapeHtml(g.name)}" data-action="guardian-name" data-guardian="${escapeHtml(g.id)}" /></div><button class="delete-icon" data-action="delete-guardian" data-guardian="${escapeHtml(g.id)}" aria-label="Suprimeix ${escapeHtml(g.name)}" >${icon('trash',16)}</button></div>`).join('')}</section>
  <section class="card"><div class="panel-header"><h2 class="section-title">Actualitzacions</h2><span class="sample-tag">v${APP_VERSION}</span></div><p class="section-description">Si l’iPhone mostra una versió anterior, pots actualitzar els fitxers de l’app sense esborrar les dades del calendari.</p><div class="action-row"><button type="button" class="secondary-btn" data-action="check-update">Comprova actualitzacions</button></div></section>
  <section class="card"><h2 class="section-title">Les teves dades</h2><p class="section-description">Les dades es queden en aquest navegador. Exporta una còpia si canvies de dispositiu o abans de netejar-ne les dades.</p>
  <div class="status-good">${icon('shield',17)} ${escapeHtml(storageDescription)}</div><div class="action-row"><button class="primary-btn" data-action="export">${icon('download',15)} Exporta JSON</button><button class="secondary-btn" data-action="import">${icon('upload',15)} Importa JSON</button><input class="sr-only" id="import-file" type="file" accept=".json,application/json" /></div><hr>
  <div class="panel-header"><h2 class="section-title">Dades d’exemple</h2><span class="sample-tag">Elna i Blai</span></div><p class="settings-note">Restableix les dades fictícies de demostració. Es perdran els canvis actuals, així que exporta una còpia abans si et cal.</p>
  <div class="action-row"><button class="secondary-btn" data-action="reset">Carrega les dades d’exemple</button></div><hr>
  <div class="panel-header"><h2 class="section-title">Comença de zero</h2></div>
  <p class="settings-note">Esborra tots els fills, tutors, escoles, horaris, rotacions i canvis puntuals desats. Aquesta acció no es pot desfer. Exporta abans una còpia JSON si vols conservar les dades.</p>
  <div class="action-row"><button type="button" class="danger-btn" data-action="clear-all">${icon('trash',15)} Esborra totes les dades</button></div></section>`;
}
function returnFromDetail(date:string):Sheet{return detailOrigin==='day'?{type:'day',date:detailReturnDate||date}:null;}
function sheetMarkup(){
  let contents='';
  if(sheet?.type==='filters'){
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Filtres</h2><p class="sheet-subtitle">Decideix qui vols veure al calendari</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    <div class="sheet-section-label">Fills</div>${state.children.map(c=>filterOption(c.id,c.name,state.preferences.visibleChildren.includes(c.id),'child')).join('')}
    <div class="sheet-section-label">Tutors</div>${state.guardians.map(g=>filterOption(g.id,g.name,state.preferences.visibleGuardians.includes(g.id),'guardian',g.color)).join('')}
    <div class="sheet-section-label">Escoles <span class="filter-section-hint">(ocultes per defecte)</span></div>${state.schools.length?state.schools.map(s=>filterOption(s.id,s.name,state.preferences.visibleSchools.includes(s.id),'school',s.color)).join(''):'<p class="settings-note">Afegeix escoles a la pestanya Escoles.</p>'}
    <div class="sheet-section-label">Franges del dia</div>${BANDS.map(b=>`<button class="option ${state.preferences.visibleBands.includes(b)?'selected':''}" type="button" data-action="toggle-band" data-band="${b}" aria-pressed="${state.preferences.visibleBands.includes(b)}"><span class="option-left">${BAND_NAMES[b]}</span>${state.preferences.visibleBands.includes(b)?icon('check',17):''}</button>`).join('')}
    <div class="action-row"><button class="secondary-btn" data-action="filter-all">Mostra-ho tot</button><button class="primary-btn" data-action="close-sheet">Fet</button></div>`;
  } else if(sheet?.type==='day'){
    const date=sheet.date,bdays=birthdays(date).filter(c=>state.preferences.visibleChildren.includes(c.id));
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">${parseDate(date).getDate()} de ${months[parseDate(date).getMonth()]}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    ${bdays.length?`<div class="tip-card" style="margin:0 0 14px;padding:12px">Aniversari: ${escapeHtml(bdays.map(c=>`${c.name} fa ${birthdayAge(date,c)} anys`).join(' · '))}</div>`:''}
    ${schoolInfoForDay(date)}${monthDayUI.detail(date,fullDate(date),activeChildren(),monthData(date,activeChildren()).nights,monthData(date,activeChildren()).activities,monthData(date,activeChildren()).slots,state)}`;
  } else if(sheet?.type==='daySlotForm'){
    contents=monthDayUI.form(sheet.date,sheet.childId,sheet.slotId,state.children,state.guardians,state);
  } else if(sheet?.type==='schoolActivity'){
    const {date,childId,schoolId,sessionId}=sheet;
    const activity=schoolActivities(date,activeChildren()).find(a=>a.id===sessionId&&a.schoolId===schoolId&&a.childId===childId);
    const c=childById(sheet.childId);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Activitat escolar</h2><p class="sheet-subtitle">${escapeHtml(fullDate(sheet.date))}</p></div><button class="sheet-close" data-action="return-detail" data-date="${escapeHtml(date)}" aria-label="Torna a la vista anterior">${icon('close',17)}</button></div>
    ${activity?`<div class="school-activity-info"><strong>${escapeHtml(activity.kind)}</strong><p>${escapeHtml(c?.name??'Fill')} · ${escapeHtml(activity.schoolName)}</p><p>${activity.startTime}–${activity.endTime}</p>${activity.description?`<p>${escapeHtml(activity.description)}</p>`:''}</div>`:'<p class="settings-note">Aquesta activitat ja no està disponible.</p>'}`;
  } else if(sheet?.type==='bandEdit'){
    const {date,childId,band}=sheet,c=childById(childId),value=responsibility(date,childId,band);
    const isNight=band==='nit';
    const manual=!isNight&&Object.hasOwn(state.bandOverrides,bandKey(date,childId,band));
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">${BAND_NAMES[band]} · ${escapeHtml(c?.name??'Fill')}</h2><p class="sheet-subtitle">${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="return-detail" data-date="${escapeHtml(date)}" aria-label="Torna a la vista anterior">${icon('close',17)}</button></div>
    <p class="settings-note">${isNight?'Aquesta nit segueix la rotació, excepte si la canvies.':'Assignació independent de la nit. Les escoles es calculen a partir de l’horari escolar.'} Actualment: ${escapeHtml(value.name)}.</p>
    ${state.guardians.map(g=>`<button class="option ${value.type==='guardian'&&value.name===g.name?'selected':''}" data-action="${isNight?'assign-night':'assign-band'}" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span></button>`).join('')}
    ${!isNight?`<button class="option" data-action="assign-band" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}" data-guardian=""><span class="option-left">Sense assignar</span></button>`:''}
    ${isNight&&overridden(date,childId)?`<button class="soft-btn" data-action="clear-night" data-date="${date}" data-child="${escapeHtml(childId)}">Torna a la rotació</button>`:''}
    ${!isNight&&manual?`<button class="soft-btn" data-action="clear-band" data-date="${date}" data-child="${escapeHtml(childId)}" data-band="${band}">Restaura l’assignació automàtica</button>`:''}
    <button class="soft-btn" data-action="return-detail" data-date="${date}">${detailOrigin==='day'?'Torna al dia':'Torna al calendari'}</button>`;
  } else if(sheet && ['schoolForm','yearForm','groupForm','schoolDayForm','reducedWindowForm','ordinaryWindowForm','scheduleForm'].includes(sheet.type)){
    contents=schoolFormMarkup();
  } else if(sheet?.type==='rotationWeek'){
    const {childId,week}=sheet,c=childById(childId),r=rotationDraft??state.rotation;
    const begin=week*7,end=Math.min(r.length,begin+7);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Assigna una setmana</h2><p class="sheet-subtitle">${escapeHtml(c?.name??'Fill')} · Setmana ${week+1} · Dies ${begin+1}–${end}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    <p class="settings-note">Assigna totes les nits d’aquesta setmana a un mateix tutor. Després podràs ajustar nits concretes.</p>
    ${state.guardians.map(g=>`<button class="option" data-action="rotation-set-week" data-child="${escapeHtml(childId)}" data-week="${week}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span></button>`).join('')}`;
  } else if(sheet?.type==='rotationCell'){
    const {childId,index}=sheet,c=childById(childId),r=rotationDraft??state.rotation;
    const current=r.assignments[childId]?.[index],date=addDays(r.startDate,index);
    contents=`<div class="sheet-heading"><div><h2 class="sheet-title">Tria un tutor</h2><p class="sheet-subtitle">${escapeHtml(c?.name??'Fill')} · Dia ${index+1} · ${escapeHtml(fullDate(date))}</p></div><button class="sheet-close" data-action="close-sheet" aria-label="Tanca">${icon('close',17)}</button></div>
    ${state.guardians.map(g=>`<button class="option ${g.id===current?'selected':''}" data-action="rotation-set-cell" data-child="${escapeHtml(childId)}" data-index="${index}" data-guardian="${escapeHtml(g.id)}"><span class="option-left"><span class="color-dot" style="background:${g.color}"></span>${escapeHtml(g.name)}</span>${g.id===current?icon('check',17):''}</button>`).join('')}`;
  }
  return `<div class="overlay" data-action="close-backdrop"><section class="sheet ${sheet?.type==='day'?'month-day-sheet':''}" data-sheet-key="${escapeHtml(JSON.stringify(sheet))}" role="dialog" aria-modal="true" aria-label="${sheet?.type==='filters'?'Filtres':'Detall del calendari'}"><div class="sheet-handle"></div>${contents}</section></div>`;
}
function filterOption(id:string,name:string,selected:boolean,kind:'child'|'guardian'|'school',color?:string){
  const symbol=kind==='child'?'person':kind==='school'?'school':'home';
  return `<button class="option ${selected?'selected':''}" aria-pressed="${selected}" data-action="toggle-filter" data-filter-kind="${kind}" data-id="${escapeHtml(id)}"><span class="option-left"><span class="filter-entity-icon">${icon(symbol,18)}</span>${color?`<span class="color-dot" style="background:${color}"></span>`:''}${escapeHtml(name)}</span>${selected?icon('check',17):'<span class="badge-soft">Ocult</span>'}</button>`;
}
function render(){
  const previousTimeline=$app.querySelector<HTMLElement>('.day-timeline-viewport');
  const timelineKey=tab==='calendar'?(calendarView==='day'?`day:${selectedDate}`:calendarView==='week'?`week:${weekStart(selectedDate)}`:''):'';
  const keepTimeline=Boolean(timelineKey&&previousTimeline?.dataset.timelineKey===timelineKey);
  const focusDate=calendarView==='week'?selectedDate:'';
  const keepHorizontalScroll=keepTimeline&&(calendarView!=='week'||previousTimeline?.dataset.focusDate===focusDate);
  const timelineLeft=keepHorizontalScroll?previousTimeline!.scrollLeft:0;
  const oldScale=Number(previousTimeline?.dataset.pxPerMinute??0);
  const previousMain=$app.querySelector<HTMLElement>('.main-area');
  const scrollKey=[tab,tab==='calendar'?calendarView:'',schoolNav.schoolId??'',schoolNav.yearId??'',schoolNav.groupId??''].join('|');
  const mainScroll=previousMain?.dataset.scrollKey===scrollKey?previousMain.scrollTop:0;
  const oldTimelineOffset=previousMain&&previousTimeline
    ? previousMain.scrollTop+previousTimeline.getBoundingClientRect().top-previousMain.getBoundingClientRect().top:NaN;
  const minuteAtCenter=keepTimeline&&previousMain&&oldScale>0
    ? Math.max(0,Math.min(1440,(previousMain.scrollTop+previousMain.clientHeight/2-oldTimelineOffset)/oldScale)):NaN;
  const previousSheet=$app.querySelector<HTMLElement>('.sheet');
  const sheetScroll=previousSheet?.dataset.sheetKey===JSON.stringify(sheet)?previousSheet.scrollTop:0;
  $app.innerHTML=layout(tab==='calendar'?calendarPage():tab==='rotation'?rotationPage():tab==='schools'?schoolsPage():settingsPage());
  const main=$app.querySelector<HTMLElement>('.main-area');
  if(main){main.dataset.scrollKey=scrollKey;main.scrollTop=mainScroll;}
  const currentSheet=$app.querySelector<HTMLElement>('.sheet');
  if(currentSheet)currentSheet.scrollTop=sheetScroll;
  const timeline=$app.querySelector<HTMLElement>('.day-timeline-viewport');
  if(timeline){
    const newScale=Number(timeline.dataset.pxPerMinute??0);
    // Dia i Setmana: l'alçada completa és part del scroll principal, no d'un scroll intern.
    timeline.scrollTop=0;
    timeline.scrollLeft=timelineLeft;
    if(calendarView==='week'&&!keepHorizontalScroll){
      // Quan s'entra a Setmana o canvia el dia de referència, situa'l al costat de l'eix d'hores.
      // No forcem el scroll en tornar a pintar la mateixa setmana (zoom, filtres, edició):
      // així es preserva el desplaçament horitzontal que l'usuari ja ha fet manualment.
      const header=Array.from(timeline.querySelectorAll<HTMLElement>('.week-day-header')).find(el=>el.dataset.date===focusDate);
      if(header){
        const offset=header.getBoundingClientRect().left-timeline.getBoundingClientRect().left+timeline.scrollLeft-52;
        timeline.scrollLeft=Math.max(0,Math.min(timeline.scrollWidth-timeline.clientWidth,offset));
      }
    }
    if(main&&Number.isFinite(minuteAtCenter)&&newScale>0&&newScale!==oldScale){
      const newOffset=main.scrollTop+timeline.getBoundingClientRect().top-main.getBoundingClientRect().top;
      main.scrollTop=Math.max(0,newOffset+minuteAtCenter*newScale-main.clientHeight/2);
    }
  }
  document.body.style.overflow=sheet?'hidden':'';
}
function notify(message:string){
  const host=document.getElementById('toast-region')??$app;
  host.innerHTML=`<div class="toast" role="status">${escapeHtml(message)}</div>`;
  if(toastTimer!==null)window.clearTimeout(toastTimer);
  toastTimer=window.setTimeout(()=>{const target=document.getElementById('toast-region');if(target)target.innerHTML='';},2900);
}
function goToMonth(delta:number){const d=new Date(viewYear,viewMonth+delta,1,12);viewYear=d.getFullYear();viewMonth=d.getMonth();render();}
function changeTab(value:Tab){tab=value;sheet=null;if(tab==='rotation'){rotationDraft=JSON.parse(JSON.stringify(state.rotation));nightPatternDraft={...state.nightPatternTimes};rotationUnit=state.rotation.length%7===0?'weeks':'days';}render();window.scrollTo({top:0,behavior:'instant'});}
function chooseGuardian(date:string,childId:string,guardianId:string){
  if(guardianId===rotationAssignment(date,childId))delete state.overrides[`${date}|${childId}`];else state.overrides[`${date}|${childId}`]=guardianId;
  update();notify('Nit actualitzada');
}
function removeGuardian(id:string){
  const g=guardian(id);if(!g||!confirm(state.guardians.length===1
    ?`Vols suprimir «${g.name}»? Et quedaràs sense tutors, i les nits passaran a «Sense assignar».`
    :`Vols suprimir «${g.name}»? Les seves nits passaran al primer tutor disponible.`))return;
  state.guardians=state.guardians.filter(x=>x.id!==id);const alternate=defaultGuardian();
  Object.values(state.rotation.assignments).forEach(arr=>arr.forEach((v,i)=>{if(v===id)arr[i]=alternate;}));
  Object.keys(state.overrides).forEach(key=>{if(state.overrides[key]===id)state.overrides[key]=alternate;});
  Object.keys(state.bandOverrides).forEach(key=>{if(state.bandOverrides[key]===id)state.bandOverrides[key]=alternate;});
  monthDayUI.removeGuardian(state.daySlots,id,alternate);rotationPatterns.removeGuardian(state,id);
   state.preferences.visibleGuardians=state.preferences.visibleGuardians.filter(x=>x!==id);rotationDraft=null;update();
}
function removeChild(id:string){
  const c=childById(id);if(!c||!confirm(`Vols suprimir «${c.name}» i totes les seves assignacions?`))return;
  state.children=state.children.filter(x=>x.id!==id);delete state.rotation.assignments[id];
  state.schools.forEach(s=>{s.childIds=s.childIds.filter(x=>x!==id);s.years.forEach(y=>y.groups.forEach(g=>{g.childIds=g.childIds.filter(x=>x!==id);if(g.childSchedules)delete g.childSchedules[id];if(g.reducedChildSchedules)delete g.reducedChildSchedules[id];}));});
  Object.keys(state.overrides).forEach(key=>{if(key.endsWith(`|${id}`))delete state.overrides[key];});
  Object.keys(state.bandOverrides).forEach(key=>{if(key.split('|')[1]===id)delete state.bandOverrides[key];});
  monthDayUI.removeChild(state.daySlots,id);rotationPatterns.removeChild(state,id);
   state.preferences.visibleChildren=state.preferences.visibleChildren.filter(x=>x!==id);rotationDraft=null;update();
}
async function exportData(){
  await writeQueue;
  const text=JSON.stringify(state,null,2);
  const blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`calendari-familiar-${localDate(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Còpia JSON preparada');
}
async function importData(file:File){
  if(file.size>5_000_000) {notify('El fitxer és massa gran');return;}
  try {const text=await file.text();const imported=cleanState(JSON.parse(text));
    if(!confirm('Vols substituir totes les dades actuals per les del fitxer?'))return;
    state=imported;rotationDraft=null;sheet=null;schoolNav={};update();notify('Dades importades correctament');
  }catch(err){notify(err instanceof Error?err.message:'No es pot importar aquest fitxer');}
}
async function resetData(){if(!confirm('Vols carregar les dades d’exemple? Se substituiran totes les dades actuals.'))return;const theme=state.preferences.theme,fontSize=state.preferences.fontSize,timelineZoom=state.preferences.timelineZoom;state=seedState();state.preferences.theme=theme;state.preferences.fontSize=fontSize;state.preferences.timelineZoom=timelineZoom;rotationDraft=null;sheet=null;schoolNav={};update();notify('Dades d’exemple carregades');}
function clearAllData(){
  if(!confirm('ATENCIÓ: vols esborrar tots els fills, tutors, escoles, horaris, rotacions i assignacions? No es pot desfer. Exporta una còpia JSON abans si vols conservar-los.'))return;
  state=emptyState();rotationDraft=null;sheet=null;schoolNav={};tab='settings';
  calendarView='month';selectedDate=localDate(new Date());viewYear=parseDate(selectedDate).getFullYear();viewMonth=parseDate(selectedDate).getMonth();
  update();notify('Totes les dades esborrades. Ja pots començar de zero.');
}
function clickAction(button:HTMLElement){
  const action=button.dataset.action;
  switch(action){
    case 'school-nav': schoolNav={schoolId:button.dataset.school||undefined,yearId:button.dataset.year||undefined,groupId:button.dataset.group||undefined};render();window.scrollTo({top:0,behavior:'instant'});break;
    case 'school-add':sheet={type:'schoolForm'};render();break;
    case 'school-edit':sheet={type:'schoolForm',schoolId:button.dataset.school!};render();break;
    case 'year-add':sheet={type:'yearForm',schoolId:button.dataset.school!};render();break;
    case 'year-edit':sheet={type:'yearForm',schoolId:button.dataset.school!,yearId:button.dataset.year!};render();break;
    case 'group-add':sheet={type:'groupForm',schoolId:button.dataset.school!,yearId:button.dataset.year!};render();break;
    case 'group-edit':sheet={type:'groupForm',schoolId:button.dataset.school!,yearId:button.dataset.year!,groupId:button.dataset.group!};render();break;
    case 'school-day-add':sheet={type:'schoolDayForm',schoolId:button.dataset.school!,yearId:button.dataset.year!,kind:button.dataset.kind==='holiday'?'holiday':'reduced'};render();break;
    case 'ordinary-window-edit':{
       const year=yearById(schoolById(button.dataset.school),button.dataset.year);
       if(!year)break;
       sheet={type:'ordinaryWindowForm',schoolId:button.dataset.school!,yearId:button.dataset.year!};render();break;
     }
     case 'reduced-window-edit':{
      const year=yearById(schoolById(button.dataset.school),button.dataset.year);
      if(!year)break;
      sheet={type:'reducedWindowForm',schoolId:button.dataset.school!,yearId:button.dataset.year!};render();break;
    }
    case 'school-membership-toggle':{
      const school=schoolById(button.dataset.school),id=button.dataset.child??'';
      if(!school||!childById(id))break;
      school.childIds=school.childIds.includes(id)?school.childIds.filter(x=>x!==id):[...school.childIds,id];
      update();notify('Fills associats a l’escola actualitzats');break;
    }
    case 'schedule-inherit':{
      const group=groupById(yearById(schoolById(button.dataset.school),button.dataset.year),button.dataset.group);
      if(!group||button.dataset.mode!=='reduced'||group.reducedWeeklySchedule===undefined||!confirm('Vols esborrar totes les activitats específiques de jornada reduïda d’aquest grup?'))break;
      delete group.reducedWeeklySchedule;update();notify('Activitats de jornada reduïda esborrades');break;
    }
    case 'schedule-add':{
      const school=schoolById(button.dataset.school),group=groupById(yearById(school,button.dataset.year),button.dataset.group);
      const mode:ScheduleMode=button.dataset.mode==='reduced'?'reduced':'ordinary';
      if(!school||!group||!scheduleEntriesForEdit(group,'',mode))break;
      if(mode==='ordinary'&&!yearById(school,button.dataset.year)?.ordinaryWindow){notify('Configura primer les hores de jornada ordinària del curs');break;}
      sheet={type:'scheduleForm',schoolId:school.id,yearId:button.dataset.year!,groupId:group.id,mode};render();break;
    }
    case 'schedule-edit':{
      const school=schoolById(button.dataset.school),group=groupById(yearById(school,button.dataset.year),button.dataset.group),sessionId=button.dataset.session??'';
      const mode:ScheduleMode=button.dataset.mode==='reduced'?'reduced':'ordinary';
      if(!school||!group||!scheduleEntriesForEdit(group,'',mode)?.some(a=>a.id===sessionId))break;
      sheet={type:'scheduleForm',schoolId:school.id,yearId:button.dataset.year!,groupId:group.id,sessionId,mode};render();break;
    }
    case 'school-child-toggle':{
      const year=yearById(schoolById(button.dataset.school),button.dataset.year),group=groupById(year,button.dataset.group),id=button.dataset.child!;
      if(!year||!group||!childById(id))break;
      if(group.childIds.includes(id)){group.childIds=group.childIds.filter(x=>x!==id);if(group.childSchedules)delete group.childSchedules[id];}
      else {year.groups.forEach(g=>{g.childIds=g.childIds.filter(x=>x!==id);if(g.childSchedules)delete g.childSchedules[id];if(g.reducedChildSchedules)delete g.reducedChildSchedules[id];});group.childIds.push(id);}
      update();notify('Assignació al grup actualitzada');break;
    }
    case 'school-delete':{
      const school=schoolById(button.dataset.school);if(!school||!confirm(`Vols suprimir «${school.name}» amb tots els cursos i grups?`))break;
      state.schools=state.schools.filter(s=>s.id!==school.id);state.preferences.visibleSchools=state.preferences.visibleSchools.filter(id=>id!==school.id);schoolNav={};update();notify('Escola suprimida');break;
    }
    case 'year-delete':{
      const school=schoolById(button.dataset.school),year=yearById(school,button.dataset.year);
      if(!school||!year||!confirm(`Vols suprimir «${schoolYearName(year)}» amb tots els seus grups i dies especials?`))break;
      school.years=school.years.filter(y=>y.id!==year.id);schoolNav={schoolId:school.id};update();notify('Curs suprimit');break;
    }
    case 'group-delete':{
      const school=schoolById(button.dataset.school),year=yearById(school,button.dataset.year),group=groupById(year,button.dataset.group);
      if(!school||!year||!group||!confirm(`Vols suprimir el grup «${group.name}»?`))break;
      year.groups=year.groups.filter(g=>g.id!==group.id);schoolNav={schoolId:school.id,yearId:year.id};update();notify('Grup suprimit');break;
    }
    case 'school-day-delete':{
      const year=yearById(schoolById(button.dataset.school),button.dataset.year),date=button.dataset.date!;
      if(!year)break;
      if(button.dataset.kind==='holiday')year.holidays=year.holidays.filter(d=>d!==date);
      else year.reducedDays=year.reducedDays.filter(d=>d!==date);
      update();notify('Dia eliminat');break;
    }
    case 'schedule-delete':{
      const group=groupById(yearById(schoolById(button.dataset.school),button.dataset.year),button.dataset.group);
      const mode:ScheduleMode=button.dataset.mode==='reduced'?'reduced':'ordinary';
      if(!group)break;
      const entries=scheduleEntriesForEdit(group,'',mode);
      if(!entries)break;
      const filtered=entries.filter(a=>a.id!==button.dataset.session);
      if(filtered.length===entries.length)break;
      if(mode==='reduced'){if(filtered.length)group.reducedWeeklySchedule=filtered;else delete group.reducedWeeklySchedule;}else group.weeklySchedule=filtered;
      update();notify('Activitat suprimida');break;
    }
    case 'tab':changeTab(button.dataset.tab as Tab);break;
    case 'set-theme':state.preferences.theme=validTheme(button.dataset.themeMode);update();break;
    case 'check-update':window.location.assign('./actualitza.html');break;
    case 'open-filters':sheet={type:'filters'};render();break;
    case 'close-sheet':sheet=null;render();break;
    case 'return-detail':sheet=returnFromDetail(button.dataset.date??detailReturnDate);render();break;
    case 'today':{selectedDate=localDate(new Date());const now=parseDate(selectedDate);viewMonth=now.getMonth();viewYear=now.getFullYear();render();break;}
    case 'timeline-zoom-step':{
      if(calendarView==='month')break;
      const index=TIMELINE_ZOOM_LEVELS.indexOf(validTimelineZoom(state.preferences.timelineZoom));
      const next=TIMELINE_ZOOM_LEVELS[Math.max(0,Math.min(TIMELINE_ZOOM_LEVELS.length-1,index+(button.dataset.step==='-1'?-1:1)))];
      if(next!==undefined&&next!==state.preferences.timelineZoom){state.preferences.timelineZoom=next;update();}
      break;
    }
    case 'calendar-view':{const v=button.dataset.view;if(v==='month'||v==='week'||v==='day'){calendarView=v;render();}break;}
    case 'calendar-navigate':navigateCalendar(Number(button.dataset.step)===-1?-1:1);break;
    case 'prev-month':goToMonth(-1);break;
    case 'next-month':goToMonth(1);break;
    case 'open-school-activity':{
      const date=button.dataset.date??'',childId=button.dataset.child??'',schoolId=button.dataset.school??'',sessionId=button.dataset.session??'';
      if(schoolActivities(date,activeChildren()).some(a=>a.id===sessionId&&a.schoolId===schoolId&&a.childId===childId)){detailOrigin=button.closest('.month-day-sheet')?'day':'calendar';detailReturnDate=date;sheet={type:'schoolActivity',date,childId,schoolId,sessionId};render();}
      break;
    }
    case 'show-calendar-day':
    case 'open-day':{
      const date=button.dataset.date??'';
      if(!isValidDate(date))break;
      selectedDate=date;calendarView='day';sheet=null;
      const day=parseDate(date);viewYear=day.getFullYear();viewMonth=day.getMonth();
      render();break;
    }
    case 'show-calendar-week':{
      const date=button.dataset.date??'';
      if(!isValidDate(date))break;
      const start=weekStart(date),today=localDate(new Date());
      selectedDate=today>=start&&today<=addDays(start,6)?today:start;calendarView='week';sheet=null;render();break;
    }
     case 'day-slot-add':{const date=button.dataset.date??'';if(!isValidDate(date)||!state.children.length)break;detailOrigin=button.closest('.month-day-sheet')?'day':'calendar';detailReturnDate=date;sheet={type:'daySlotForm',date,childId:activeChildren()[0]?.id??state.children[0]?.id??''};render();break;}
     case 'day-slot-edit':{const date=button.dataset.date??'',childId=button.dataset.child??'',slotId=button.dataset.slot??'';if(!isValidDate(date)||!childById(childId)||!monthDayUI.find(state,date,childId,slotId))break;detailOrigin=button.closest('.month-day-sheet')?'day':'calendar';detailReturnDate=date;sheet={type:'daySlotForm',date,childId,slotId};render();break;}
     case 'day-slot-delete':{const date=button.dataset.date??'',childId=button.dataset.child??'',slotId=button.dataset.slot??'';if(!isValidDate(date)||!childById(childId)||!monthDayUI.find(state,date,childId,slotId))break;if(!confirm('Vols eliminar aquesta franja puntual?'))break;monthDayUI.remove(state,date,childId,slotId);sheet=returnFromDetail(date);update();notify('Franja eliminada');break;}
     case 'day-restore':{const date=button.dataset.date??'';if(!isValidDate(date)||!monthDayUI.hasChanges(state,date))break;if(!confirm('Vols eliminar tots els canvis puntuals d’aquest dia i recuperar la planificació habitual?'))break;monthDayUI.restore(state,date);rotationPatterns.clearDate(state,date);sheet=null;update();notify('Dia restaurat segons la rotació');break;}
    case 'edit-band':{const band=button.dataset.band??'',date=button.dataset.date??'',childId=button.dataset.child??'';if(isTimeBand(band)&&isValidDate(date)&&childById(childId)){detailOrigin=button.closest('.month-day-sheet')?'day':'calendar';detailReturnDate=button.dataset.viewDate??date;sheet={type:'bandEdit',date,childId,band};render();}break;}
    case 'toggle-band':{const b=button.dataset.band??'';if(!isTimeBand(b))break;const selected=state.preferences.visibleBands;state.preferences.visibleBands=selected.includes(b)?selected.filter(x=>x!==b):BANDS.filter(x=>selected.includes(x)||x===b);update();break;}
    case 'assign-band':{const date=button.dataset.date??'',childId=button.dataset.child??'',band=button.dataset.band??'',gId=button.dataset.guardian??'';if(!isValidDate(date)||!childById(childId)||!isTimeBand(band)||band==='nit'||(gId&&!guardian(gId)))break;state.bandOverrides[bandKey(date,childId,band)]=gId;sheet=returnFromDetail(date);update();notify('Franja actualitzada');break;}
    case 'clear-band':{const date=button.dataset.date??'',childId=button.dataset.child??'',band=button.dataset.band??'';if(!isTimeBand(band))break;delete state.bandOverrides[bandKey(date,childId,band)];sheet=returnFromDetail(date);update();notify('Assignació automàtica restaurada');break;}
    case 'toggle-filter':{
      const kind=button.dataset.filterKind==='child'?'visibleChildren':button.dataset.filterKind==='school'?'visibleSchools':'visibleGuardians',id=button.dataset.id!;
      const selected=state.preferences[kind];state.preferences[kind]=selected.includes(id)?selected.filter(x=>x!==id):[...selected,id];update();break;
    }
    case 'filter-all':state.preferences.visibleChildren=state.children.map(c=>c.id);state.preferences.visibleGuardians=state.guardians.map(g=>g.id);state.preferences.visibleSchools=state.schools.map(s=>s.id);state.preferences.visibleBands=[...BANDS];update();break;
    case 'assign-night':{const date=button.dataset.date!,childId=button.dataset.child!,gId=button.dataset.guardian!;if(!childById(childId)||!guardian(gId))break;sheet=returnFromDetail(date);chooseGuardian(date,childId,gId);break;}
    case 'clear-night':delete state.overrides[`${button.dataset.date}|${button.dataset.child}`];sheet=returnFromDetail(button.dataset.date!);update();notify('Patró habitual restaurat');break;
    case 'rotation-cell':sheet={type:'rotationCell',childId:button.dataset.child!,index:Number(button.dataset.index)};render();break;
    case 'rotation-week-fill':sheet={type:'rotationWeek',childId:button.dataset.child!,week:Number(button.dataset.week)};render();break;
    case 'rotation-set-week':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      const week=Number(button.dataset.week),childId=button.dataset.child!,gId=button.dataset.guardian!;
      const end=Math.min(rotationDraft!.length,(week+1)*7);
      for(let i=week*7;i<end;i++)rotationDraft!.assignments[childId]![i]=gId;
      sheet=null;render();notify('Setmana assignada al tutor');break;
    }
    case 'rotation-set-cell':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      rotationDraft!.assignments[button.dataset.child!]![Number(button.dataset.index)]=button.dataset.guardian!;
      sheet=null;render();break;
    }
    case 'rotation-show-all':rotationShowAll=!rotationShowAll;render();break;
    case 'rotation-same':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      const first=state.children[0]?.id;if(first){for(const child of state.children)rotationDraft!.assignments[child.id]=[...(rotationDraft!.assignments[first]??[])];}
      render();notify('Patró copiat a tots els fills');break;
    }
    case 'rotation-copy':{
      if(!rotationDraft)rotationDraft=JSON.parse(JSON.stringify(state.rotation)) as Rotation;
      rotationDraft!.assignments[button.dataset.child!]=[...(rotationDraft!.assignments[button.dataset.from!]??[])];
      render();notify('Patró copiat');break;
    }
    case 'rotation-save':{
      if(!rotationDraft)return;
      rotationDraft.changeTime=validChangeTime(rotationDraft.changeTime);
      state.rotation=JSON.parse(JSON.stringify(rotationDraft)) as Rotation;rotationDraft=JSON.parse(JSON.stringify(state.rotation));update();notify('Patró de rotació desat');break;
    }
    case 'rotation-cancel':rotationDraft=JSON.parse(JSON.stringify(state.rotation));nightPatternDraft={...state.nightPatternTimes};render();notify('Canvis descartats');break;
    case 'add-child':{
      const id=newId();const prev=state.children[0];const name=`Fill ${state.children.length+1}`;
      state.children.push({id,name,birthDate:''});state.rotation.assignments[id]=[...(state.rotation.assignments[prev?.id??'']??Array.from({length:state.rotation.length},()=>defaultGuardian()))];state.preferences.visibleChildren.push(id);for(const extra of state.extraRotations){if(extra.childIds.length===state.children.length-1){extra.childIds.push(id);extra.assignments[id]=[...(extra.assignments[prev?.id??'']??Array.from({length:extra.length},()=>''))];}}rotationDraft=null;update();notify('Fill afegit · pots editar-ne el nom');break;
    }
    case 'add-guardian':{
      const palette=['#b2a0e9','#97cbb7','#f0c17c','#8eb9d9','#d6a8bb'];const color=palette[state.guardians.length%palette.length]??'#aabbcc',id=newId();
      state.guardians.push({id,name:`Tutor ${state.guardians.length+1}`,color});state.preferences.visibleGuardians.push(id);update();notify('Tutor afegit · pots editar-ne el nom');break;
    }
    case 'delete-child':removeChild(button.dataset.child!);break;
    case 'delete-guardian':removeGuardian(button.dataset.guardian!);break;
    case 'export':void exportData();break;
    case 'import':document.getElementById('import-file')?.click();break;
    case 'reset':void resetData();break;
    case 'clear-all':clearAllData();break;
  }
}
document.addEventListener('click',event=>{
  const target=event.target;
  if(!(target instanceof Element))return;
  const actionButton=target.closest<HTMLElement>('[data-action]');
  if(!actionButton)return;
  if(actionButton.dataset.action==='close-backdrop') {if(target===actionButton){sheet=null;render();}return;}
  if(actionButton.matches('button') && !(actionButton as HTMLButtonElement).disabled)clickAction(actionButton);
});
document.addEventListener('submit',event=>{
 const form=event.target;
 if(!(form instanceof HTMLFormElement))return;
  if(form.dataset.daySlotForm){
    event.preventDefault();
    const date=form.dataset.date??'',slotId=form.dataset.slot??'';
    const values=new FormData(form),childId=slotId?form.dataset.child??'':String(values.get('childId')??'');
    if(values.has('endAtMidnight'))values.set('endTime','24:00');
    const error=monthDayUI.save(state,date,childId,slotId,values,newId);
    if(error){notify(error);return;}
    sheet=returnFromDetail(date);update();notify('Franja puntual desada');return;
  }
  if(!form.dataset.schoolForm)return;
 event.preventDefault();
 const values=new FormData(form),get=(key:string)=>String(values.get(key)??'').trim();
 const formKind=form.dataset.schoolForm;
 const school=schoolById(form.dataset.school),year=yearById(school,form.dataset.year),group=groupById(year,form.dataset.group);
 const finish=(message:string)=>{sheet=null;update();notify(message);};
 if(formKind==='school'){
  const name=get('name').slice(0,100);if(!name){notify('Indica el nom de l’escola');return;}
  const color=get('color').toLowerCase();
  if(!/^#[0-9a-f]{6}$/.test(color)){notify('Tria un color vàlid');return;}
  if(state.schools.some(s=>s.id!==school?.id&&s.color.toLowerCase()===color)){notify('Aquest color ja correspon a una altra escola');return;}
  if(school){school.name=name;school.address=get('address').slice(0,200);school.phone=get('phone').slice(0,50);school.color=color;finish('Escola actualitzada');}
  else{const id=newId();state.schools.push({id,name,address:get('address').slice(0,200),phone:get('phone').slice(0,50),color,years:[],weeklySchedule:[],childIds:[]});schoolNav={schoolId:id};finish('Escola afegida');}
  return;
 }
 if(formKind==='year'){
  if(!school)return;
  const startDate=get('startDate'),endDate=get('endDate');
  if(!isValidDate(startDate)||!isValidDate(endDate)||startDate>=endDate){notify('La data final ha de ser posterior a la inicial');return;}
  if(school.years.some(y=>y.id!==year?.id&&y.startDate===startDate&&y.endDate===endDate)){notify('Aquest curs ja existeix');return;}
  if(year){
    if([...year.holidays,...year.reducedDays].some(d=>d<startDate||d>endDate)){notify('Hi ha dies especials fora de les noves dates. Revisa’ls abans.');return;}
    year.startDate=startDate;year.endDate=endDate;finish('Dates del curs actualitzades');
  }else{const id=newId();school.years.push({id,startDate,endDate,holidays:[],reducedDays:[],groups:[]});schoolNav={schoolId:school.id,yearId:id};finish('Curs escolar afegit');}
  return;
 }
 if(formKind==='group'){
  if(!school||!year)return;
  const name=get('name').slice(0,80),tutorName=get('tutorName').slice(0,100);
  if(!name){notify('Indica el nom del grup classe');return;}
  if(group){group.name=name;group.tutorName=tutorName;finish('Grup classe actualitzat');}
  else{const id=newId();year.groups.push({id,name,tutorName,weeklySchedule:[],childIds:[],childSchedules:{}});schoolNav={schoolId:school.id,yearId:year.id,groupId:id};finish('Grup classe afegit');}
  return;
 }
 if(formKind==='day'){
  if(!year)return;const date=get('date'),kind=form.dataset.kind;
  if(!isValidDate(date)||date<year.startDate||date>year.endDate){notify('La data ha d’estar compresa dins del curs');return;}
  if(year.holidays.includes(date)||year.reducedDays.includes(date)){notify('Aquest dia ja està marcat al curs');return;}
  const days=kind==='holiday'?year.holidays:year.reducedDays;
  days.push(date);days.sort();finish(kind==='holiday'?'Festiu afegit':'Dia d’horari reduït afegit');return;
 }
 if(formKind==='reducedWindow'){
  if(!year)return;
  const startTime=get('startTime'),endTime=get('endTime');
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||startTime>=endTime){
    notify('Indica unes hores vàlides, amb el final posterior a l’inici');return;
  }
  const window:ReducedWindow={startTime,endTime};
  if(year.groups.some(g=>(g.reducedWeeklySchedule!==undefined&&!inReducedWindow(g.reducedWeeklySchedule,window))||Object.values(g.reducedChildSchedules??{}).some(a=>!inReducedWindow(a,window)))){
    notify('Hi ha franges especials fora d’aquest interval. Modifica-les abans de canviar les hores.');return;
  }
  year.reducedWindow=window;finish('Hores de jornada reduïda desades');return;
 }
 if(formKind==='ordinaryWindow'){
    if(!year)return;
    const startTime=get('startTime'),endTime=get('endTime');
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||startTime>=endTime){
      notify('Indica unes hores vàlides, amb el final posterior a l’inici');return;
    }
    year.ordinaryWindow={startTime,endTime};
    finish('Hores de jornada ordinària desades');return;
   }
   if(formKind==='schedule'){
  if(!group)return;
  const childId='',mode:ScheduleMode=form.dataset.mode==='reduced'?'reduced':'ordinary';
  const entries=scheduleEntriesForEdit(group,childId,mode);
  if(mode==='reduced'&&!year?.reducedWindow){notify('Primer cal configurar les hores de jornada reduïda');return;}
  if(!entries)return;
  const existing=entries.find(a=>a.id===form.dataset.session);
  if(form.dataset.session&&!existing){notify('Aquesta franja ja no existeix');return;}
  const days=existing?[Number(get('weekday'))]:values.getAll('weekdays').map(Number);
  const startTime=get('startTime'),endTime=get('endTime'),kind=get('kind');
  if(!days.length||days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(days).size!==days.length){notify('Selecciona com a mínim un dia vàlid');return;}
  if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||startTime>=endTime){notify('L’hora final ha de ser posterior a la inicial');return;}
  if(mode==='reduced'&&year?.reducedWindow&&(startTime<year.reducedWindow.startTime||endTime>year.reducedWindow.endTime)){
    notify('Aquesta franja queda fora de les hores de jornada reduïda');return;
  }
  if(!SESSION_KINDS.includes(kind as SessionKind)){notify('Tria un tipus d’activitat vàlid');return;}
  if(mode==='ordinary'&&(!year?.ordinaryWindow||startTime<year.ordinaryWindow.startTime||endTime>year.ordinaryWindow.endTime)){
    notify('L’activitat ha d’estar dins de les hores de jornada ordinària del curs');return;
   }
  if(days.some(day=>entries.some(a=>a.id!==existing?.id&&a.weekday===day&&a.startTime<endTime&&a.endTime>startTime))){notify('Hi ha una franja que se solapa amb aquest horari');return;}
  const label=get('label').slice(0,80);
  if(mode==='reduced'&&group.reducedWeeklySchedule===undefined)group.reducedWeeklySchedule=entries;
  if(existing){existing.weekday=days[0]!;existing.startTime=startTime;existing.endTime=endTime;existing.kind=kind as SessionKind;existing.label=label;finish('Franja horària actualitzada');}
  else{for(const weekday of days)entries.push({id:newId(),weekday,startTime,endTime,kind:kind as SessionKind,label});finish('Franges horàries afegides');}
  return;
 }
});

document.addEventListener('input',event=>{
  const target=event.target;
  if(!(target instanceof HTMLInputElement))return;
  if(target.dataset.action==='timeline-zoom'){
    const next=TIMELINE_ZOOM_LEVELS[Number(target.value)];
    if(next!==undefined){const output=document.getElementById('timeline-zoom-value');if(output)output.textContent=next+'%';target.setAttribute('aria-valuetext',next+' per cent');}
    return;
  }
  if(target.dataset.action!=='font-size')return;
  const chosen=FONT_SIZE_OPTIONS[Number(target.value)];
  if(!chosen)return;
  state.preferences.fontSize=chosen;
  applyFontSize();
  const current=document.getElementById('font-size-current');
  if(current)current.textContent=FONT_SIZE_LABELS[chosen];
  target.setAttribute('aria-valuetext',FONT_SIZE_LABELS[chosen]);
});
document.addEventListener('change',event=>{
  const target=event.target;if(!(target instanceof HTMLInputElement||target instanceof HTMLSelectElement))return;
  const action=target.dataset.action;
  if(action==='timeline-zoom'){
    if(calendarView!=='month'){
      const next=TIMELINE_ZOOM_LEVELS[Number(target.value)];
      if(next!==undefined&&next!==state.preferences.timelineZoom){state.preferences.timelineZoom=next;update();}
    }
    return;
  }
  if(action==='font-size'){const chosen=FONT_SIZE_OPTIONS[Number(target.value)];if(chosen){state.preferences.fontSize=chosen;applyFontSize();saveState();}return;}
  if(action==='rotation-change-time'&&rotationDraft){rotationDraft.changeTime=validChangeTime(target.value);render();}
  else if(action==='rotation-start'&&rotationDraft&&isValidDate(target.value)){rotationDraft.startDate=target.value;render();}
  else if(action==='rotation-length'&&rotationDraft){
    const count=Number(target.value),factor=rotationUnit==='weeks'?7:1,length=count*factor;
    if(!Number.isSafeInteger(count)||count<1||length>MAX_ROTATION_DAYS){notify('Indica una durada vàlida entre 1 i '+(MAX_ROTATION_DAYS/factor));render();return;}
    rotationDraft=resizedRotation(rotationDraft,length);render();
  } else if(action==='rotation-unit'&&rotationDraft){
    rotationUnit=target.value==='weeks'?'weeks':'days';
    if(rotationUnit==='weeks'&&rotationDraft.length%7!==0){
      rotationDraft=resizedRotation(rotationDraft,Math.ceil(rotationDraft.length/7)*7);
      notify('Durada arrodonida a setmanes completes');
    }
    render();
  } else if(action==='child-name') {const child=childById(target.dataset.child!);if(child){child.name=target.value.trim().slice(0,70)||child.name;update();}}
  else if(action==='child-birth') {const child=childById(target.dataset.child!);if(child){child.birthDate=target.value;update();}}
  else if(action==='guardian-name') {const g=guardian(target.dataset.guardian!);if(g){g.name=target.value.trim().slice(0,70)||g.name;update();}}
  else if(action==='guardian-color') {const g=guardian(target.dataset.guardian!);if(g&&/^#[0-9a-fA-F]{6}$/.test(target.value)){g.color=target.value;update();}}
  else if(target instanceof HTMLInputElement&&target.id==='import-file'&&target.files?.[0]){void importData(target.files[0]);target.value='';}
});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet){sheet=null;render();}});
async function init(){await loadState();applyTheme();applyFontSize();render();if('serviceWorker'in navigator && location.protocol!=='file:'){
  navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'}).then(reg=>reg.update().catch(()=>{})).catch(err=>console.warn('Service worker no registrat:',err));
}}
void init();
