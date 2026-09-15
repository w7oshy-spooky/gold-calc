'use strict';

function positiveNumber(value, field) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid ${field}`);
  return n;
}

function isoTimestamp(value, field) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) throw new Error(`Invalid ${field}`);
  return date.toISOString();
}

function normalizeGoldApiPayload(payload = {}) {
  if (payload.symbol !== 'XAU') throw new Error('Unexpected Gold API symbol');
  if (payload.currency !== 'USD') throw new Error('Unexpected Gold API currency');

  return {
    priceUsdOunce: positiveNumber(payload.price, 'Gold API price'),
    updatedAt: isoTimestamp(payload.updatedAt, 'Gold API timestamp'),
    source: 'gold-api',
    stale: false,
  };
}

function normalizeXausPayload(payload = {}) {
  return {
    priceUsdOunce: positiveNumber(payload.spot_usd_oz, 'XAUS price'),
    updatedAt: isoTimestamp(payload.updated_at, 'XAUS timestamp'),
    source: 'xaus',
    stale: payload.data_state?.status !== 'fresh',
  };
}

module.exports = {
  normalizeGoldApiPayload,
  normalizeXausPayload,
};
