// Offline cache for the web-app version
const CACHE = 'setidevi-dairy-v7';
const FILES = ['./', './index.html', './style.css', './manifest.webmanifest', './js/bs.js', './js/i18n.js', './js/core.js', './js/screens.js', './js/reports.js', './js/config.js', './js/cloud.js', './js/app.js', './icons/icon-192.png', './icons/icon-512.png', './icons/logo.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
self.addEventListener('notificationclick', e => { e.notification.close(); e.waitUntil(self.clients.openWindow('./index.html#/ins')); });
