import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const css=readFileSync(new URL('../theme.css',import.meta.url),'utf8');
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const colors=block=>Object.fromEntries([...block.matchAll(/--([\w-]+):(#\w{6});/g)].map(([,key,value])=>[key,value]));
const light=colors(css.match(/:root \{([^}]+)\}/)[1]);
const dark=colors(css.match(/:root\[data-theme="dark"\] \{([^}]+)\}/)[1]);
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
const luminance=hex=>rgb(hex).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);

test('els textos i les accions conserven contrast en les dues aparences',()=>{
  for(const palette of [light,dark]){
    for(const bg of ['app-background','surface','surface-elevated','control-background']){
      for(const fg of ['text-primary','text-secondary','accent']){
        assert.ok(contrast(palette[fg],palette[bg])>=4.5,`${fg} sobre ${bg}: ${contrast(palette[fg],palette[bg])}`);
      }
    }
    assert.ok(contrast(palette['on-accent'],palette.accent)>=4.5);
    assert.ok(contrast('#ffffff',palette['calendar-current'])>=4.5);
    assert.ok(contrast(palette['calendar-current'],palette['app-background'])>=4.5);
    assert.ok(contrast(palette['calendar-current'],palette.surface)>=3);
    assert.ok(contrast(palette['text-day-off'],palette['control-background'])>=4.5);
  }
  assert.ok(luminance(light['text-day-off'])>luminance(light['text-primary']));
  assert.ok(luminance(dark['text-day-off'])<luminance(dark['text-primary']));
});

test('les superfícies de nit són negres i grises neutres, amb nivells diferenciats',()=>{
  for(const role of ['app-background','surface','surface-elevated','control-background','selection-background']){
    const channels=rgb(dark[role]);
    assert.ok(Math.max(...channels)-Math.min(...channels)<.015,role);
  }
  assert.ok(luminance(dark['app-background'])<luminance(dark.surface));
  assert.ok(luminance(dark.surface)<luminance(dark['surface-elevated']));
});

test('auto, clar i fosc sincronitzen aparença, controls natius i color del navegador',()=>{
  const apply=js.slice(js.indexOf('function applyTheme('),js.indexOf('function applyFontSize('));
  for(const [mode,matches,expected] of [['auto',true,'dark'],['auto',false,'light'],['light',true,'light'],['dark',false,'dark']]){
    const root={dataset:{},style:{}};
    let themeColor,stored;
    vm.runInNewContext(apply+'applyTheme();',{
      state:{preferences:{theme:mode}},validTheme:value=>value,themeMedia:{matches},
      document:{documentElement:root,querySelector:()=>({setAttribute:(_,value)=>{themeColor=value;}})},
      localStorage:{setItem:(_,value)=>{stored=value;}}
    });
    assert.equal(root.dataset.theme,expected);
    assert.equal(root.style.colorScheme,expected);
    assert.equal(themeColor,expected==='dark'?dark.surface:light.surface);
    assert.equal(stored,mode);
  }
});

test('la paleta i Roboto Condensed es carreguen i es conserven fora de línia',()=>{
  assert.ok(html.indexOf('href="./theme.css?')>html.indexOf('href="./styles.css?'));
  assert.match(sw,/\.\/theme\.css\?v=/);
  assert.match(sw,/assets\/fonts\/RobotoCondensed-ExtraBold\.woff/);
  assert.equal(readFileSync(new URL('../assets/fonts/RobotoCondensed-ExtraBold.woff',import.meta.url)).subarray(0,4).toString(),'wOFF');
  assert.match(readFileSync(new URL('../assets/fonts/OFL-RobotoCondensed.txt',import.meta.url),'utf8'),/SIL OPEN FONT LICENSE/);
});
