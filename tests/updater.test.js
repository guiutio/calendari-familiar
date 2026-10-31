import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../actualitza.html',import.meta.url),'utf8');
const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
function setup({version='0.7.1',scriptVersion=version,indexOK=true,scriptOK=true,online=true,indexHTML}={}){
 let click,redirect;
 const actions=[],requests=[];
 const button={disabled:false,addEventListener:(_,fn)=>click=fn},result={textContent:''};
 const caches={keys:async()=>['calendari-familiar-v0.6.6','other-cache'],delete:async key=>actions.push('delete:'+key)};
 const navigator={onLine:online,serviceWorker:{getRegistrations:async()=>[
  {scope:'https://guiutio.github.io/calendari-familiar/',unregister:async()=>actions.push('unregister')},
  {scope:'https://guiutio.github.io/other-app/',unregister:async()=>actions.push('wrong-app')}
 ]}};
 const context={URL,Date,Error,document:{getElementById:id=>id==='update'?button:result},navigator,caches,window:{caches},
 location:{href:'https://guiutio.github.io/calendari-familiar/actualitza.html?comprovacio=1',replace:url=>redirect=url},
 fetch:async(url,options)=>{
  requests.push({url,options});
  return url.startsWith('./index.html')
   ?{ok:indexOK,text:async()=>indexHTML??`<script type="module" src="./app.js?v=${version}"></script>`}
   :{ok:scriptOK,text:async()=>`const APP_VERSION = '${scriptVersion}';`};
 }};
 vm.runInNewContext(script,context);
 return {run:()=>click(),button,result,actions,requests,redirect:()=>redirect};
}
test('actualització detecta la versió publicada, incloses versions futures',async()=>{
 for(const version of ['0.7.0','0.7.1','1.23.4']){
  const c=setup({version});await c.run();
  assert.match(c.redirect(),new RegExp('actualitzat='+version.replaceAll('.','\\.')+'-'));
  assert.deepEqual(c.actions,['unregister','delete:calendari-familiar-v0.6.6']);
  assert.ok(c.requests.every(r=>r.options.cache==='no-store'));
  assert.equal(c.requests[1].url,'./app.js?v='+version);
 }
});
test('publicació incompleta o resposta invàlida no esborra la memòria cau',async()=>{
 for(const options of [{indexOK:false},{scriptOK:false},{scriptVersion:'0.6.6'},{indexHTML:'<html>Error</html>'},{online:false}]){
  const c=setup(options);await c.run();
  assert.deepEqual(c.actions,[]);assert.equal(c.redirect(),undefined);
  assert.equal(c.button.disabled,false);assert.ok(c.result.textContent);
 }
});
test('el botó de configuració demana una pantalla d’actualització nova',()=>{
 const app=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 assert.match(app,/window.location.assign\('\.\/actualitza.html\?comprovacio=' \+ Date.now\(\)\)/);
 assert.doesNotMatch(script,/indexedDB|localStorage|0\.6\.6/);
});

test('l’entrada de recuperació utilitza el mateix actualitzador verificat',()=>{
 const recovery=readFileSync(new URL('../actualitza-nova.html',import.meta.url),'utf8');
 assert.equal(recovery,html);
});
