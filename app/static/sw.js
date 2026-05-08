// Atlas DataXPOS — Service Worker
// Estrategia: Network-first para API, Cache-first para assets estáticos
const CACHE_NAME = 'dataxpos-v1';
const STATIC_ASSETS = [
  '/static/css/base.css',
  '/static/theme.css',
  '/static/img/icon-192.png',
  '/static/img/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // API calls: siempre network, sin cache
  if (url.pathname.startsWith('/api/')) return;

  // Requests a otros orígenes (print agent, CDNs, etc.): no interceptar
  if (url.origin !== self.location.origin) return;

  // Assets estáticos: cache-first
  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML pages: network-first (siempre fresh)
  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request)
      return cached || new Response('', { status: 503, statusText: 'Offline' })
    })
  );
});
