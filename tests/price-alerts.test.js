'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { priceForKarat, sanitizeAlert, loadAlerts, findTriggered, createPriceAlerts, MAX_ALERTS } = require('../js/ui/price-alerts.js');

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
}
function fakeDocument() {
  return { getElementById: () => null, createElement: () => ({}) };
}

test('karat price scales from the 24K price', () => {
  assert.equal(priceForKarat(480, 24), 480);
  assert.equal(priceForKarat(480, 21), 420);
});

test('invalid alerts are rejected', () => {
  assert.equal(sanitizeAlert({ karat: 20, direction: 'above', target: 400 }), null);
  assert.equal(sanitizeAlert({ karat: 21, direction: 'sideways', target: 400 }), null);
  assert.equal(sanitizeAlert({ karat: 21, direction: 'above', target: -1 }), null);
  assert.ok(sanitizeAlert({ karat: '21', direction: 'above', target: '400' }));
});

test('above and below alerts fire at the right price, once', () => {
  const alerts = [
    sanitizeAlert({ id: 'up', karat: 21, direction: 'above', target: 420 }),
    sanitizeAlert({ id: 'down', karat: 21, direction: 'below', target: 400 }),
  ];
  assert.deepEqual(findTriggered(alerts, 480).map((a) => a.id), ['up']);
  assert.deepEqual(findTriggered(alerts, 470).map((a) => a.id), []);
  assert.deepEqual(findTriggered(alerts, 410).map((a) => a.id), ['down']);
  assert.deepEqual(findTriggered(alerts, 0), []);
  alerts[0].triggeredAt = 1;
  assert.deepEqual(findTriggered(alerts, 480), []);
});

test('alerts persist, fire once, and notify through the app and the native plugin', async () => {
  const storage = memoryStorage();
  const scheduled = [];
  const capacitor = {
    isNativePlatform: () => true,
    Plugins: { LocalNotifications: {
      checkPermissions: async () => ({ display: 'granted' }),
      schedule: async (payload) => scheduled.push(payload),
    } },
  };
  const alerts = createPriceAlerts({ document: fakeDocument(), storage, capacitor, now: () => 5000 });
  const added = await alerts.add({ karat: 21, direction: 'above', target: 420 });
  assert.equal(added.ok, true);
  assert.equal(loadAlerts(storage).length, 1);
  assert.equal(alerts.check(400).length, 0);
  assert.equal(alerts.check(480).length, 1);
  assert.equal(alerts.check(480).length, 0);
  await new Promise((r) => setImmediate(r));
  assert.equal(scheduled.length, 1);
  assert.ok(loadAlerts(storage)[0].triggeredAt > 0);
});

test('limit and invalid input are reported', async () => {
  const alerts = createPriceAlerts({ document: fakeDocument(), storage: memoryStorage(), capacitor: null });
  assert.equal((await alerts.add({ karat: 99, direction: 'above', target: 1 })).reason, 'invalid');
  for (let i = 0; i < MAX_ALERTS; i += 1) await alerts.add({ karat: 24, direction: 'above', target: 500 + i });
  assert.equal((await alerts.add({ karat: 24, direction: 'above', target: 900 })).reason, 'limit');
});

test('corrupt storage does not break loading', () => {
  assert.deepEqual(loadAlerts(memoryStorage({ gold_price_alerts: '{oops' })), []);
});
