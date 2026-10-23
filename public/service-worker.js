const CACHE_NAME = 'citizenwater-shell-v15';
const CACHE_PREFIX = 'citizenwater-shell-';
const SHELL_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.webmanifest',
  '/icons/citizenwater-192.png',
  '/icons/citizenwater-512.png',
  '/icons/citizenwater.svg',
  '/js/app.js',
  '/js/location.js',
  '/js/storage.js',
  '/js/utility-matcher.js'
];
const SHELL_PATHS = new Set(SHELL_URLS);

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !SHELL_PATHS.has(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    try {
      const fresh = await fetch(request);
      if (fresh.ok) await cache.put(request, fresh.clone());
      return fresh;
    } catch {
      const cached = await cache.match(request);
      if (cached) return cached;
      throw new Error('This app resource is unavailable offline.');
    }
  })());
});
