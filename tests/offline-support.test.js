'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { registerOfflineSupport } = require('../js/ui/offline-support.js');

function createServiceWorker({ registrations = [], registerFails = false } = {}) {
  const log = [];
  return {
    log,
    serviceWorker: {
      register: async (url) => { log.push(`register:${url}`); if (registerFails) throw new Error('no'); },
      getRegistrations: async () => registrations.map((name) => ({ unregister: async () => { log.push(`unregister:${name}`); } })),
    },
  };
}

test('the website registers the service worker', async () => {
  const { serviceWorker, log } = createServiceWorker();
  const result = await registerOfflineSupport({ navigatorRef: { serviceWorker }, capacitor: null });
  assert.equal(result, 'registered');
  assert.deepEqual(log, ['register:sw.js']);
});

test('the native app removes old service workers and does not register a new one', async () => {
  const { serviceWorker, log } = createServiceWorker({ registrations: ['a', 'b'] });
  const capacitor = { isNativePlatform: () => true };
  const result = await registerOfflineSupport({ navigatorRef: { serviceWorker }, capacitor });
  assert.equal(result, 'native');
  assert.deepEqual(log, ['unregister:a', 'unregister:b']);
});

test('a Capacitor object that is not native still registers (web build)', async () => {
  const { serviceWorker, log } = createServiceWorker();
  const result = await registerOfflineSupport({ navigatorRef: { serviceWorker }, capacitor: { isNativePlatform: () => false } });
  assert.equal(result, 'registered');
  assert.deepEqual(log, ['register:sw.js']);
});

test('missing support and failures never throw', async () => {
  assert.equal(await registerOfflineSupport({ navigatorRef: {}, capacitor: null }), 'unsupported');
  const { serviceWorker } = createServiceWorker({ registerFails: true });
  assert.equal(await registerOfflineSupport({ navigatorRef: { serviceWorker }, capacitor: null }), 'failed');
});
