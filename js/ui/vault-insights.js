(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldVaultInsights = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HAWL_STORAGE_KEY = 'gold_hawl_start';
  const HAWL_DAYS = 354; // one lunar (hijri) year
  const DAY_MS = 24 * 60 * 60 * 1000;

  // Profit / loss over the pieces that have a recorded purchase price.
  function summarizePnl(pieces, price24k) {
    let invested = 0;
    let value = 0;
    let count = 0;
    if (!(price24k > 0)) return { count: 0, invested: 0, value: 0, diff: 0, pct: 0 };
    (pieces || []).forEach((piece) => {
      const price = Number(piece.purchasePrice) || 0;
      if (price <= 0) return;
      invested += price;
      value += (Number(piece.weight) || 0) * ((Number(piece.karat) || 21) / 24) * price24k;
      count += 1;
    });
    const diff = value - invested;
    const pct = invested > 0 ? (diff / invested) * 100 : 0;
    return { count, invested, value, diff, pct };
  }

  function parseDate(text) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(text || ''))) return null;
    const time = Date.parse(`${text}T00:00:00Z`);
    return Number.isFinite(time) ? time : null;
  }

  // state: 'none' (no start date), 'counting' (daysLeft until due), 'due'.
  function getHawlState(startDate, now = Date.now()) {
    const start = parseDate(startDate);
    if (start === null || start > now) return { state: 'none', daysLeft: 0 };
    const elapsed = Math.floor((now - start) / DAY_MS);
    if (elapsed >= HAWL_DAYS) return { state: 'due', daysLeft: 0 };
    return { state: 'counting', daysLeft: HAWL_DAYS - elapsed };
  }

  function loadHawlStart(storage) {
    try { return (storage && storage.getItem(HAWL_STORAGE_KEY)) || ''; } catch (_error) { return ''; }
  }

  function saveHawlStart(storage, value) {
    try {
      if (!storage) return;
      if (value) storage.setItem(HAWL_STORAGE_KEY, value);
      else storage.removeItem(HAWL_STORAGE_KEY);
    } catch (_error) {
      // Storage can be unavailable.
    }
  }

  return { HAWL_STORAGE_KEY, HAWL_DAYS, summarizePnl, getHawlState, loadHawlStart, saveHawlStart };
});
