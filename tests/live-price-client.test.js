const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIVE_REQUEST_TIMEOUT_MS,
  createLivePriceClient,
} = require('../js/market/live-price-client.js');

function response({ ok = true, status = 200, body }) {
  return {
    ok,
    status,
    async json() { return body; },
  };
}

test('fetches the normal live endpoint and validates the quote', async () => {
  const calls = [];
  const client = createLivePriceClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response({
        body: {
          priceUsdOunce: 4300,
          updatedAt: '2026-10-03T00:00:00Z',
          source: 'gold-api',
          stale: false,
        },
      });
    },
    AbortControllerImpl: null,
  });

  const quote = await client.fetchQuote();
  assert.equal(quote.priceUsdOunce, 4300);
  assert.equal(calls[0].url, '/api/gold-price');
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.headers.accept, 'application/json');
});

test('forced refresh appends the injected current timestamp', async () => {
  let requestedUrl = '';
  const client = createLivePriceClient({
    fetchImpl: async (url) => {
      requestedUrl = url;
      return response({ body: { priceUsdOunce: 4300, updatedAt: '2026-10-03T00:00:00Z' } });
    },
    AbortControllerImpl: null,
    now: () => 123456,
  });

  await client.fetchQuote({ force: true });
  assert.equal(requestedUrl, '/api/gold-price?refresh=123456');
});

test('rejects non-OK responses, invalid prices, and invalid timestamps', async () => {
  const nonOk = createLivePriceClient({
    fetchImpl: async () => response({ ok: false, status: 503, body: {} }),
    AbortControllerImpl: null,
  });
  await assert.rejects(nonOk.fetchQuote(), /HTTP 503/);

  const invalidPrice = createLivePriceClient({
    fetchImpl: async () => response({ body: { priceUsdOunce: 0, updatedAt: '2026-10-03T00:00:00Z' } }),
    AbortControllerImpl: null,
  });
  await assert.rejects(invalidPrice.fetchQuote(), /Invalid live quote/);

  const invalidTime = createLivePriceClient({
    fetchImpl: async () => response({ body: { priceUsdOunce: 4300, updatedAt: 'not-a-date' } }),
    AbortControllerImpl: null,
  });
  await assert.rejects(invalidTime.fetchQuote(), /Invalid live timestamp/);
});

test('uses an 8-second abort timeout when AbortController is available', async () => {
  let timeoutMs = null;
  let timeoutCallback = null;
  let aborted = false;
  let cleared = null;

  class FakeAbortController {
    constructor() {
      this.signal = { kind: 'fake-signal' };
    }
    abort() {
      aborted = true;
    }
  }

  const client = createLivePriceClient({
    AbortControllerImpl: FakeAbortController,
    setTimeoutImpl(callback, ms) {
      timeoutCallback = callback;
      timeoutMs = ms;
      return 77;
    },
    clearTimeoutImpl(id) {
      cleared = id;
    },
    fetchImpl: async (url, options) => {
      assert.deepEqual(options.signal, { kind: 'fake-signal' });
      timeoutCallback();
      return response({ body: { priceUsdOunce: 4300, updatedAt: '2026-10-03T00:00:00Z' } });
    },
  });

  await client.fetchQuote();

  assert.equal(LIVE_REQUEST_TIMEOUT_MS, 8000);
  assert.equal(timeoutMs, 8000);
  assert.equal(aborted, true);
  assert.equal(cleared, 77);
});
