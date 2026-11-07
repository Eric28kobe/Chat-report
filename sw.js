/* app/sw.js —— Service Worker：缓存全部应用资源，安装后完全离线可用 */
const CACHE = 'chat-app-1794041432663';
const ASSETS = [
  './', './index.html', './app.css', './app.js', './manifest.webmanifest',
  './vendor/report.umd.js', './vendor/import.umd.js',
  './vendor/ocr/tesseract.min.js', './vendor/ocr/worker.min.js',
  './shared/records-logic.js', './data.js',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        const copy = res.clone();
        if (res.ok && e.request.url.startsWith(self.location.origin)) {
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match('./index.html'));
    })
  );
});
