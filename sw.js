const CACHE = 'calendari-familiar-v0.7.4';
const ASSETS = ['./','./index.html','./actualitza.html','./scroll-guard.js?v=0.7.4','./school-schedule-core.js?v=0.7.4','./school-timeline.js?v=0.7.4','./day-timeline.js?v=0.7.4','./month-day-ui.js?v=0.7.4','./rotation-patterns.js?v=0.7.4','./rotation-editor.js?v=0.7.4','./app.js?v=0.7.4','./styles.css?v=0.7.4','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./assets/favicon.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request,copy)));
    }
    return response;
  }).catch(() => caches.match(event.request).then(res => res || caches.match('./index.html'))));
});
