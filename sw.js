const CACHE = 'calendari-familiar-v0.16.16';
const ASSETS = ['./theme.css?v=0.16.16','./assets/fonts/RobotoCondensed-ExtraBold.woff','./','./index.html','./actualitza.html','./scroll-guard.js?v=0.16.16','./school-schedule-core.js?v=0.16.16','./school-timeline.js?v=0.16.16','./day-timeline.js?v=0.16.16','./month-day-ui.js?v=0.16.16','./rotation-patterns.js?v=0.16.16','./rotation-editor.js?v=0.16.16','./work-schedule.js?v=0.16.16','./personal-time-off.js?v=0.16.16','./app.js?v=0.16.16','./styles.css?v=0.16.16','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png','./assets/apple-touch-icon.png','./assets/favicon.png'];
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
