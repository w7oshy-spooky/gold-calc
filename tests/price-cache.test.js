const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LIVE_CACHE_KEY,
  LIVE_CACHE_MAX_AGE_MS,
  createPriceCache,
} = require('../js/market/price-cache.js');

function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) {
      assert.equal(key, LIVE_CACHE_KEY);
      return value;
    },
    setItem(key, next) {
      assert.equal(key, LIVE_CACHE_KEY);
      value = next;
    },
    removeItem(key) {
      assert.equal(key, LIVE_CACHE_KEY);
      value = null;
    },
    readRaw() {
      return value;
    },
  };
}

test('uses the existing cache key and 15-minute maximum age', () => {
  assert.equal(LIVE_CACHE_KEY, 'gold-calc-live-quote-v1');
  assert.equal(LIVE_CACHE_MAX_AGE_MS, 15 * 60 * 1000);
});

test('returns a valid recent cached quote', () => {
  const now = 2_000_000;
  const quote = { priceUsdOunce: 4300, updatedAt: '2026-10-03T00:00:00Z', source: 'gold-api' };
  const storage = memoryStorage(JSON.stringify({ quote, storedAt: now - 1000 }));
  const cache = createPriceCache({ storage, now: () => now });

  assert.deepEqual(cache.readCachedQuote(), quote);
});

test('rejects expired, malformed, and non-positive cached quotes', () => {
  const now = 2_000_000;

  const expired = createPriceCache({
    storage: memoryStorage(JSON.stringify({
      quote: { priceUsdOunce: 4300, updatedAt: '2026-10-03T00:00:00Z' },
      storedAt: now - LIVE_CACHE_MAX_AGE_MS - 1,
    })),
    now: () => now,
  });
  assert.equal(expired.readCachedQuote(), null);

  const malformed = createPriceCache({ storage: memoryStorage('{bad-json'), now: () => now });
  assert.equal(malformed.readCachedQuote(), null);

  const invalid = createPriceCache({
    storage: memoryStorage(JSON.stringify({
      quote: { priceUsdOunce: 0, updatedAt: '2026-10-03T00:00:00Z' },
      storedAt: now,
    })),
    now: () => now,
  });
  assert.equal(invalid.readCachedQuote(), null);
});

test('writes and clears quotes using injected storage', () => {
  const now = 2_000_000;
  const storage = memoryStorage();
  const cache = createPriceCache({ storage, now: () => now });
  const quote = { priceUsdOunce: 4300, updatedAt: '2026-10-03T00:00:00Z', source: 'gold-api' };

  cache.writeCachedQuote(quote);
  assert.deepEqual(JSON.parse(storage.readRaw()), { quote, storedAt: now });

  cache.clearCachedQuote();
  assert.equal(storage.readRaw(), null);
});

test('storage failures are non-fatal', () => {
  const storage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const cache = createPriceCache({ storage, now: () => 1 });

  assert.equal(cache.readCachedQuote(), null);
  assert.doesNotThrow(() => cache.writeCachedQuote({ priceUsdOunce: 4300 }));
  assert.doesNotThrow(() => cache.clearCachedQuote());
});
