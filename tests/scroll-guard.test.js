import test from 'node:test';
import assert from 'node:assert/strict';
import {shouldPreventBoundaryScroll, installScrollGuard} from '../scroll-guard.js';

function harness({short = false, mobile = true} = {}) {
  const listeners = new Map();
  const doc = {addEventListener(name, callback, options) { listeners.set(name, {callback, options}); }};
  const win = {matchMedia: () => ({matches: mobile})};
  installScrollGuard(doc, win);
  const scroller = {scrollTop: 0, clientHeight: 600, scrollHeight: short ? 400 : 1700};
  const target = {closest(selector) { return selector === '.sheet, .main-area' ? scroller : null; }};
  function touch(name, y, {x = 50, node = target} = {}) {
    let canceled = 0;
    const event = {
      touches: [{clientX: x, clientY: y}], target: node, cancelable: true,
      preventDefault() { canceled++; }
    };
    listeners.get(name).callback(event);
    return canceled;
  }
  return {listeners, scroller, touch};
}

test('bloqueja els dos sentits si la vista d’Escoles no fa scroll', () => {
  assert.equal(shouldPreventBoundaryScroll(0, 400, 600, -25), true);
  assert.equal(shouldPreventBoundaryScroll(0, 400, 600, 25), true);
  const h = harness({short: true});
  h.touch('touchstart', 400);
  assert.equal(h.touch('touchmove', 375), 1);
  assert.equal(h.touch('touchmove', 425), 1);
});

test('permet scroll natural al mig de la pàgina, bloqueja només el rebot', () => {
  const h = harness();
  h.touch('touchstart', 400);
  assert.equal(h.touch('touchmove', 380), 0);
  h.scroller.scrollTop = 200;
  assert.equal(h.touch('touchmove', 360), 0);
  h.scroller.scrollTop = 1100;
  assert.equal(h.touch('touchmove', 340), 1);
  h.scroller.scrollTop = 0;
  assert.equal(h.touch('touchmove', 370), 1);
});

test('no intercepta gestos horitzontals ni pantalles d’escriptori', () => {
  const h = harness({short: true});
  h.touch('touchstart', 400);
  assert.equal(h.touch('touchmove', 399, {x: 90}), 0);
  const desktop = harness({short: true, mobile: false});
  desktop.touch('touchstart', 400);
  assert.equal(desktop.touch('touchmove', 380), 0);
  assert.equal(h.listeners.get('touchmove').options.passive, false);
});

test('el gest que comença a la barra inferior no fa scroll', () => {
  const h = harness();
  const tab = {closest(selector) {return selector === '.sheet, .main-area' ? null : {};}};
  h.touch('touchstart', 400, {node: tab});
  assert.equal(h.touch('touchmove', 375, {node: tab}), 1);
});

test('els recursos de la protecció tàctil estan inclosos a la PWA', async () => {
  const {readFileSync} = await import('node:fs');
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const sw = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(html, /scroll-guard\.js\?v=0\.1\.13/);
  assert.match(sw, /scroll-guard\.js\?v=0\.1\.13/);
  assert.match(css, /\.main-area,\.sheet \{overscroll-behavior-y:none;/);
});
