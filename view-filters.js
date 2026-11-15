/* Filtres persistents d’Any, Mes i Setmana. La resta de preferències són comunes. */
(()=>{
 const views=['year','month','week'];
 const flags={showExtracurriculars:true,showHolyWeek:false,showWorkSchedules:true,showPersonalHolidays:true,showPersonalVacations:true};
 const fields=['visibleChildren','visibleGuardians','visibleSchools','visibleBands','visibleTimeOffPeople',...Object.keys(flags)];
 const active=new WeakMap();
 const copy=value=>JSON.parse(JSON.stringify(value));
 function known(state){
  const children=(state.children??[]).map(c=>c.id),guardians=(state.guardians??[]).map(g=>g.id);
  return {visibleChildren:children,visibleGuardians:guardians,visibleSchools:(state.schools??[]).map(s=>s.id),visibleBands:['mati','dinar','tarda','sopar','nit'],visibleTimeOffPeople:[...children.map(id=>'child:'+id),...guardians.map(id=>'guardian:'+id)]};
 }
 function snapshot(state,raw=state.preferences,fallback={},strict=false){
  const allowed=known(state),out={};
  for(const [field,ids] of Object.entries(allowed)){
   if(strict&&raw[field]!==undefined&&!Array.isArray(raw[field]))throw Error('Els filtres de la vista no són vàlids');
   const value=raw[field]??fallback[field]??[];
   if(!Array.isArray(value)){if(strict)throw Error('Els filtres de la vista no són vàlids');out[field]=[];continue;}
   out[field]=[...new Set(value.filter(id=>typeof id==='string'&&ids.includes(id)))];
  }
  for(const [field,initial] of Object.entries(flags)){
   if(strict&&raw[field]!==undefined&&typeof raw[field]!=='boolean')throw Error('Els filtres de la vista no són vàlids');
   out[field]=typeof raw[field]==='boolean'?raw[field]:fallback[field]??initial;
  }
  return out;
 }
 function clean(raw,state){
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('Els filtres per vista no són vàlids');
  const fallback=snapshot(state),out={};
  for(const view of views){
   const item=raw[view];
   if(item!==undefined&&(!item||typeof item!=='object'||Array.isArray(item)))throw Error('Els filtres de la vista no són vàlids');
   out[view]=snapshot(state,item??{},fallback,true);
  }
  return out;
 }
 function sync(state,view){
  if(!views.includes(view))return false;
  const prefs=state.preferences,previous=active.get(state),current=snapshot(state);
  if(!previous||previous.preferences!==prefs){
   prefs.filterViews=prefs.filterViews?clean(prefs.filterViews,state):Object.fromEntries(views.map(key=>[key,copy(current)]));
   Object.assign(prefs,copy(prefs.filterViews[view]));
   active.set(state,{view,preferences:prefs,known:known(state),personal:Object.keys(state.personTimeOff??{})});return true;
  }
  const before=JSON.stringify(prefs.filterViews);
  prefs.filterViews[previous.view]=current;
  const allowed=known(state),personal=Object.keys(state.personTimeOff??{});
  for(const key of views){
   const profile=snapshot(state,prefs.filterViews[key]??{},current);
   // Els nous fills i tutors apareixen a totes les vistes; les escoles continuen ocultes per defecte.
   for(const field of ['visibleChildren','visibleGuardians'])for(const id of allowed[field])if(!previous.known[field].includes(id)&&!profile[field].includes(id))profile[field].push(id);
   for(const id of personal)if(!previous.personal.includes(id)&&allowed.visibleTimeOffPeople.includes(id)&&!profile.visibleTimeOffPeople.includes(id))profile.visibleTimeOffPeople.push(id);
   prefs.filterViews[key]=profile;
  }
  const switched=previous.view!==view;
  Object.assign(prefs,copy(prefs.filterViews[view]));
  active.set(state,{view,preferences:prefs,known:allowed,personal});
  return switched||before!==JSON.stringify(prefs.filterViews);
 }
 window.viewFilters={fields,clean,sync};
})();
