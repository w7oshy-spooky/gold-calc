'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createAppLock } = require('../js/ui/app-lock.js');

function setup({ native = true, available = true, authOk = true, enabled = false } = {}) {
  const els = {};
  ['appLockScreen', 'appLockUnlockBtn', 'appLockTitle', 'appLockToggleRow', 'appLockToggle', 'appLockToggleLabel', 'appLockStatus']
    .forEach((id) => { els[id] = { hidden: true, textContent: '', addEventListener() {} }; });
  const document = { getElementById: (id) => els[id] || null };
  const data = enabled ? { gold_app_lock: '1' } : {};
  const storage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
  const calls = { authenticate: 0 };
  const listeners = {};
  const capacitor = {
    isNativePlatform: () => native,
    Plugins: {
      BiometricAuth: {
        checkBiometry: async () => ({ isAvailable: available, deviceIsSecure: available }),
        authenticate: async () => { calls.authenticate += 1; if (!authOk) throw new Error('cancel'); },
      },
      App: { addListener: (name, fn) => { listeners[name] = fn; } },
    },
  };
  let time = 1000;
  const lock = createAppLock({ document, capacitor, storage, now: () => time });
  return { lock, els, data, calls, listeners, tick: (ms) => { time += ms; } };
}

test('the website never locks', async () => {
  const { lock, els } = setup({ native: false, enabled: true });
  assert.equal(await lock.init(), 'web');
  assert.equal(els.appLockScreen.hidden, true);
});

test('lock is off by default in the app', async () => {
  const { lock, calls } = setup();
  assert.equal(await lock.lock(), 'off');
  assert.equal(calls.authenticate, 0);
});

test('enabled lock asks for authentication and unlocks on success', async () => {
  const { lock, els } = setup({ enabled: true });
  assert.equal(await lock.lock(), 'unlocked');
  assert.equal(els.appLockScreen.hidden, true);
});

test('failed authentication keeps the app locked', async () => {
  const { lock, els } = setup({ enabled: true, authOk: false });
  assert.equal(await lock.lock(), 'locked');
  assert.equal(els.appLockScreen.hidden, false);
});

test('if the phone has no screen lock any more the setting is switched off', async () => {
  const { lock, els, data } = setup({ enabled: true, available: false });
  assert.equal(await lock.lock(), 'unavailable');
  assert.equal(els.appLockScreen.hidden, true);
  assert.equal(data.gold_app_lock, undefined);
});

test('turning the lock on requires a successful authentication', async () => {
  const ok = setup();
  assert.equal(await ok.lock.setEnabled(true), true);
  assert.equal(ok.data.gold_app_lock, '1');
  const bad = setup({ authOk: false });
  assert.equal(await bad.lock.setEnabled(true), false);
  assert.equal(bad.data.gold_app_lock, undefined);
});

test('turning the lock off requires authentication too', async () => {
  const bad = setup({ enabled: true, authOk: false });
  assert.equal(await bad.lock.setEnabled(false), true);
  assert.equal(bad.data.gold_app_lock, '1');
  const ok = setup({ enabled: true });
  assert.equal(await ok.lock.setEnabled(false), false);
});

test('re-locks only after the app was in the background for 30 seconds', async () => {
  const { lock, calls, tick } = setup({ enabled: true });
  lock.onAppState(false);
  tick(5000);
  lock.onAppState(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.authenticate, 0);
  lock.onAppState(false);
  tick(31000);
  lock.onAppState(true);
  await new Promise((r) => setImmediate(r));
  assert.equal(calls.authenticate, 1);
});
