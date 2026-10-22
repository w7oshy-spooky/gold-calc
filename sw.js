'use strict';

// Bump the version when files are added to or removed from APP_SHELL.
const CACHE_NAME = 'gold-calc-shell-v1';
const NETWORK_TIMEOUT_MS = 3000;

const APP_SHELL = [
  './',
  'index.html',
  'en.html',
  'tailwind.css',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'js/core/price-converter.js',
  'gold-calculator.js',
  'js/i18n/translations.js',
  'js/ui/formatting.js',
  'js/market/price-cache.js',
  'js/market/live-price-client.js',
  'js/ui/market-ui.js',
  'js/ui/transaction-ui.js',
  'js/ui/quote-comparison-ui.js',
  'js/ui/summary-ui.js',
  'js/state/preferences-store.js',
  'js/ui/share-ui.js',
  'js/ui/invoice-ui.js',
  'js/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// Network first so deploys show up immediately; the cached copy is used when the
// network fails or is too slow (weak signal inside a shop).
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const network = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  });

  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT_MS));
  const fastest = await Promise.race([network.catch(() => null), timeout]);
  if (fastest) return fastest;

  const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
  if (cached) return cached;
  return network;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only same-origin app files: live prices stay with the page's own short-lived cache.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(networkFirst(request));
});
