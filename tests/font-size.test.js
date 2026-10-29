import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const js=readFileSync(new URL('../app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../styles.css',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

test('tres nivells i valors no fiables normalitzats',()=>{
  const start=js.indexOf('function validFontSize('),end=js.indexOf('function isValidDate(',start);
  assert.ok(start>=0&&end>start);
  const normalize=new Function(js.slice(start,end)+'return validFontSize;')();
  assert.equal(normalize('normal'),'normal');
  assert.equal(normalize('large'),'large');
  assert.equal(normalize('xlarge'),'xlarge');
  assert.equal(normalize(undefined),'normal');
  assert.equal(normalize('huge'),'normal');
  assert.match(js,/const FONT_SIZE_OPTIONS = \['normal', 'large', 'xlarge'\]/);
});

test('control de rang accessible a Configuració i previsualització immediata',()=>{
  assert.match(js,/id="font-size-slider" type="range"/);
  assert.match(js,/min="0" max="2" step="1"/);
  assert.match(js,/aria-valuetext=/);
  assert.match(js,/document\.addEventListener\('input'/);
  assert.match(js,/target\.dataset\.action !== 'font-size'/);
  assert.match(js,/current\.textContent = FONT_SIZE_LABELS\[chosen\]/);
  assert.match(js,/state\.preferences\.fontSize = chosen/);
  assert.match(js,/applyFontSize\(\)/);
  assert.match(js,/saveState\(\)/);
});

test('la lletra fixa es transforma a mida adaptable sense canviar la mida normal',()=>{
  assert.match(css,/:root\[data-font-size="large"\] \{ --font-scale:1\.25; \}/);
  assert.match(css,/:root\[data-font-size="xlarge"\] \{ --font-scale:1\.5; \}/);
  assert.ok((css.match(/font-size:\s*calc\([\d.]+px \* var\(--font-scale, 1\)\)/g)||[]).length>=90);
  assert.equal((css.match(/font-size:\s*[\d.]+px\b/g)||[]).length,0);
});

test('importació antiga, exportació i reinicialització conserven la mida',()=>{
  assert.match(js,/fontSize: validFontSize\(obj\.preferences\.fontSize\)/);
  assert.match(js,/fontSize: 'normal'/);
  assert.match(js,/state\.preferences\.fontSize = fontSize/);
  assert.match(js,/document\.documentElement\.dataset\.fontSize = validFontSize/);
  assert.match(html,/styles\.css\?v=0\.5\.4/);
  assert.match(html,/app\.js\?v=0\.5\.4/);
});
