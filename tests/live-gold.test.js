const test = require('node:test');
const assert = require('node:assert/strict');

let live;
let api;
try { live = require('../live-gold.js'); } catch {}
try { api = require('../api/gold-price.js'); } catch {}

function jsonResponse(payload, ok = true, status = 200) {
  return {
    ok,
    status,
    async json() { return payload; },
  };
}

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

test('normalizes Gold API XAU/USD payload', () => {
  assert.equal(typeof live?.normalizeGoldApiPayload, 'function');
  const result = live.normalizeGoldApiPayload({
    symbol: 'XAU',
    currency: 'USD',
    price: 4350.25,
    updatedAt: '2026-09-15T20:00:00Z',
  });
  assert.deepEqual(result, {
    priceUsdOunce: 4350.25,
    updatedAt: '2026-09-15T20:00:00.000Z',
    source: 'gold-api',
    stale: false,
  });
});

test('normalizes XAUS fallback payload and preserves staleness', () => {
  assert.equal(typeof live?.normalizeXausPayload, 'function');
  const result = live.normalizeXausPayload({
    spot_usd_oz: 4348.9,
    updated_at: '2026-09-15T20:01:00Z',
    data_state: { status: 'stale' },
  });
  assert.deepEqual(result, {
    priceUsdOunce: 4348.9,
    updatedAt: '2026-09-15T20:01:00.000Z',
    source: 'xaus',
    stale: true,
  });
});

test('rejects invalid live quote payloads instead of returning zero', () => {
  assert.equal(typeof live?.normalizeGoldApiPayload, 'function');
  assert.throws(() => live.normalizeGoldApiPayload({ price: 0, currency: 'USD', symbol: 'XAU' }));
  assert.throws(() => live.normalizeGoldApiPayload({ price: 4350, currency: 'EUR', symbol: 'XAU' }));
});

test('API uses Gold API as the primary source', async () => {
  assert.equal(typeof api?.createGoldPriceHandler, 'function');
  const calls = [];
  const handler = api.createGoldPriceHandler({
    fetchImpl: async (url) => {
      calls.push(url);
      return jsonResponse({
        symbol: 'XAU', currency: 'USD', price: 4350.25, updatedAt: '2026-09-15T20:00:00Z',
      });
    },
  });
  const res = createMockRes();
  await handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'gold-api');
  assert.equal(res.body.priceUsdOunce, 4350.25);
  assert.equal(calls.length, 1);
  assert.match(calls[0], /api\.gold-api\.com\/price\/XAU/);
});

test('API falls back to XAUS when the primary source fails', async () => {
  assert.equal(typeof api?.createGoldPriceHandler, 'function');
  let call = 0;
  const handler = api.createGoldPriceHandler({
    fetchImpl: async () => {
      call += 1;
      if (call === 1) return jsonResponse({}, false, 503);
      return jsonResponse({
        spot_usd_oz: 4348.9,
        updated_at: '2026-09-15T20:01:00Z',
        data_state: { status: 'fresh' },
      });
    },
  });
  const res = createMockRes();
  await handler({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.source, 'xaus');
  assert.equal(res.body.priceUsdOunce, 4348.9);
  assert.equal(call, 2);
});

test('API returns 502 when both live sources fail', async () => {
  assert.equal(typeof api?.createGoldPriceHandler, 'function');
  const handler = api.createGoldPriceHandler({
    fetchImpl: async () => jsonResponse({}, false, 503),
  });
  const res = createMockRes();
  await handler({}, res);
  assert.equal(res.statusCode, 502);
  assert.deepEqual(res.body, { error: 'live_price_unavailable' });
});
