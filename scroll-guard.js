/** Evita el rebot d'iOS quan una vista no té prou contingut per desplaçar-se. */
export function shouldPreventBoundaryScroll(scrollTop, scrollHeight, clientHeight, deltaY) {
  if (deltaY === 0) return false;
  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  if (maxScroll <= 1) return true;
  if (deltaY > 0) return scrollTop <= 0;
  return scrollTop >= maxScroll - 1;
}

export function installScrollGuard(doc, win) {
  let lastTouch = null;
  const mobile = () => win.matchMedia('(max-width: 900px)').matches;
  doc.addEventListener('touchstart', event => {
    const touch = event.touches.length === 1 && mobile() ? event.touches[0] : null;
    lastTouch = touch ? {x: touch.clientX, y: touch.clientY} : null;
  }, {passive: true});
  doc.addEventListener('touchmove', event => {
    if (!lastTouch || event.touches.length !== 1 || !mobile()) return;
    const touch = event.touches[0];
    const dy = touch.clientY - lastTouch.y;
    const dx = touch.clientX - lastTouch.x;
    lastTouch = {x: touch.clientX, y: touch.clientY};
    if (Math.abs(dy) < 1 || Math.abs(dy) <= Math.abs(dx)) return;
    const target = event.target;
    if (!target || typeof target.closest !== 'function') return;
    const scroller = target.closest('.day-timeline-viewport, .sheet, .main-area');
    const block = scroller
      ? shouldPreventBoundaryScroll(scroller.scrollTop, scroller.scrollHeight, scroller.clientHeight, dy)
      : Boolean(target.closest('.mobile-tabs, .overlay'));
    if (block && event.cancelable) event.preventDefault();
  }, {passive: false});
  const reset = () => { lastTouch = null; };
  doc.addEventListener('touchend', reset, {passive: true});
  doc.addEventListener('touchcancel', reset, {passive: true});
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  installScrollGuard(document, window);
}
