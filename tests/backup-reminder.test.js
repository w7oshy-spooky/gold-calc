'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { getReminderState, markBackedUp, getLastBackup } = require('../js/ui/backup-reminder.js');

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 10, 7);

test('no reminder for an empty vault', () => {
  assert.equal(getReminderState({ pieceCount: 0, lastBackupAt: 0, now: NOW }), null);
});

test('reminds when pieces exist and no backup was ever made', () => {
  assert.equal(getReminderState({ pieceCount: 2, lastBackupAt: 0, now: NOW }), 'never');
});

test('reminds only after the interval has passed', () => {
  assert.equal(getReminderState({ pieceCount: 2, lastBackupAt: NOW - 10 * DAY, now: NOW }), null);
  assert.equal(getReminderState({ pieceCount: 2, lastBackupAt: NOW - 31 * DAY, now: NOW }), 'stale');
});

test('markBackedUp stores the time and survives broken storage', () => {
  const data = {};
  const storage = { getItem: (k) => data[k] ?? null, setItem: (k, v) => { data[k] = v; } };
  assert.equal(getLastBackup(storage), 0);
  markBackedUp(storage, NOW);
  assert.equal(getLastBackup(storage), NOW);
  const broken = { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } };
  assert.doesNotThrow(() => markBackedUp(broken, NOW));
  assert.equal(getLastBackup(broken), 0);
});
