'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { summarizePnl, getHawlState, loadHawlStart, saveHawlStart } = require('../js/ui/vault-insights.js');

test('pnl only counts pieces with a purchase price', () => {
  const pieces = [
    { weight: 10, karat: 24, purchasePrice: 1000 },
    { weight: 5, karat: 21, purchasePrice: 0 },
  ];
  const result = summarizePnl(pieces, 120);
  assert.equal(result.count, 1);
  assert.equal(result.invested, 1000);
  assert.equal(result.value, 1200);
  assert.equal(result.diff, 200);
  assert.equal(Math.round(result.pct), 20);
});

test('pnl is empty without a live price or priced pieces', () => {
  assert.equal(summarizePnl([{ weight: 1, karat: 24, purchasePrice: 100 }], 0).count, 0);
  assert.equal(summarizePnl([], 100).count, 0);
});

test('hawl counts down 354 days then becomes due', () => {
  const now = Date.UTC(2026, 10, 7);
  assert.deepEqual(getHawlState('', now), { state: 'none', daysLeft: 0 });
  assert.deepEqual(getHawlState('2027-01-01', now), { state: 'none', daysLeft: 0 });
  assert.deepEqual(getHawlState('2026-11-07', now), { state: 'counting', daysLeft: 354 });
  assert.deepEqual(getHawlState('2026-10-08', now), { state: 'counting', daysLeft: 324 });
  assert.equal(getHawlState('2025-11-07', now).state, 'due');
});

test('hawl start is stored and cleared, and broken storage is tolerated', () => {
  const data = {};
  const storage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; }, removeItem: (k) => { delete data[k]; } };
  saveHawlStart(storage, '2026-01-01');
  assert.equal(loadHawlStart(storage), '2026-01-01');
  saveHawlStart(storage, '');
  assert.equal(loadHawlStart(storage), '');
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.equal(loadHawlStart(broken), '');
  assert.doesNotThrow(() => saveHawlStart(broken, '2026-01-01'));
});
