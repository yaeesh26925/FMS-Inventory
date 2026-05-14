const CACHE_NAME = 'fuel-inv-v11';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './css/mobile.css',
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
    './js/views/tasks.js',
    './js/views/inventory-flow.js',
    './js/views/user-management.js'
];

self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Add all assets, ignore individual failures
            return Promise.allSettled(ASSETS.map(url => cache.add(url)));
        })
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames
                    .filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Network first, fallback to cache — with safe Response fallback
self.addEventListener('fetch', event => {
    // Only handle GET requests
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Cache successful responses (not opaque/error ones)
                if (response && response.status === 200 && response.type !== 'opaque') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request).then(cached => {
                    // If nothing in cache, return a safe offline response
                    return cached || new Response('Offline - resource not cached', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain' }
                    });
                });
            })
    );
});
