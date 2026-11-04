'use strict';

// Bump the version when files are added to or removed from APP_SHELL.
const CACHE_NAME = 'gold-calc-shell-v10';
const NETWORK_TIMEOUT_MS = 3000;

const APP_SHELL = [
  './',
  'index.html',
  'en.html',
  'tailwind.css',
  'styles.css',
  'manifest.webmanifest',
  'icon.svg',
  'fonts/bricolage-grotesque-latin.woff2',
  'fonts/manrope-latin.woff2',
  'fonts/ibm-plex-sans-arabic-400.woff2',
  'fonts/ibm-plex-sans-arabic-500.woff2',
  'fonts/ibm-plex-sans-arabic-700.woff2',
  'js/core/price-converter.js',
  'js/core/quick-input-parser.js',
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
  'js/state/vault-store.js',
  'js/ui/share-ui.js',
  'js/ui/card-canvas-generator.js',
  'js/ui/invoice-ui.js',
  'js/ui/price-chart-ui.js',
  'js/ui/auditor-ui.js',
  'js/ui/vault-ui.js',
  'js/ui/navigation-ui.js',
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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Live quotes and external APIs should always go to the network directly.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Network-first with a 3-second timeout for app-shell assets.
  event.respondWith(
    new Promise((resolve) => {
      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          caches.match(event.request).then((cached) => {
            if (cached && !resolved) {
              resolved = true;
              resolve(cached);
            }
          });
        }
      }, NETWORK_TIMEOUT_MS);

      fetch(event.request)
        .then((response) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            if (response.ok) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            resolve(response);
          }
        })
        .catch(() => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timer);
            caches.match(event.request).then((cached) => {
              if (cached) resolve(cached);
              else if (event.request.mode === 'navigate') resolve(caches.match('index.html'));
            });
          }
        });
    }),
  );
});
