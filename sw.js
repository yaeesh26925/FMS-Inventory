const CACHE_NAME = 'fuel-inv-v6';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/config.js',
    './js/app.js',
    './js/state.js',
    './js/auth.js',
    './js/views/inventory.js',
    './js/views/requests.js',
    './js/views/procurement.js',
    './js/views/financials.js',
    './js/views/management.js',
    './js/views/correction.js',
    './js/views/dashboard.js',
    './js/views/reports.js',
    './js/views/tasks.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Network First, fallback to cache
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});
