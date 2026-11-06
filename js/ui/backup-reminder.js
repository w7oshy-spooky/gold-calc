(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldBackupReminder = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORAGE_KEY = 'gold_last_backup_at';
  const DEFAULT_INTERVAL_DAYS = 30;
  const DAY_MS = 24 * 60 * 60 * 1000;

  function getLastBackup(storage) {
    try {
      const value = Number(storage && storage.getItem(STORAGE_KEY));
      return Number.isFinite(value) && value > 0 ? value : 0;
    } catch (_error) {
      return 0;
    }
  }

  function markBackedUp(storage, now = Date.now()) {
    try {
      if (storage) storage.setItem(STORAGE_KEY, String(now));
    } catch (_error) {
      // Storage can be unavailable; the reminder just stays on.
    }
  }

  // Returns 'never' (pieces saved, no backup yet), 'stale' (last backup is old) or null.
  function getReminderState({ pieceCount, lastBackupAt, now = Date.now(), intervalDays = DEFAULT_INTERVAL_DAYS }) {
    if (!pieceCount || pieceCount <= 0) return null;
    if (!lastBackupAt) return 'never';
    return now - lastBackupAt > intervalDays * DAY_MS ? 'stale' : null;
  }

  return { STORAGE_KEY, DEFAULT_INTERVAL_DAYS, getLastBackup, markBackedUp, getReminderState };
});
