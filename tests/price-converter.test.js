const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OUNCE_GRAMS,
  USD_SAR_RATE,
  SUPPORTED_KARATS,
  sanitizeNonNegative,
  normalizeKarat,
  ounceUsdTo24kSar,
  ounceSarToUsd,
  ounceSarTo24kSar,
  gramSarTo24kSar,
  gramSarToOunceSar,
  gramSarToOunceUsd,
  resolvePrice24k,
  deriveMarketPrices,
} = require('../js/core/price-converter.js');

test('uses one exact troy-ounce and SAR conversion definition', () => {
  assert.equal(OUNCE_GRAMS, 31.1034768);
  assert.equal(USD_SAR_RATE, 3.75);
  assert.deepEqual(SUPPORTED_KARATS, [18, 21, 22, 24]);
});

test('converts USD and SAR ounce prices without early rounding', () => {
  const price24k = ounceUsdTo24kSar(4300);
  assert.ok(Math.abs(price24k - 518.4307884191262) < 1e-9);
  assert.ok(Math.abs(ounceSarToUsd(16125) - 4300) < 1e-12);
  assert.ok(Math.abs(ounceSarTo24kSar(16125) - price24k) < 1e-9);
});

test('converts a known karat gram price back to 24K and ounce prices', () => {
  const gram21 = 453.6269398667354;
  assert.ok(Math.abs(gramSarTo24kSar(gram21, 21) - 518.4307884191262) < 1e-9);
  assert.ok(Math.abs(gramSarToOunceSar(gram21, 21) - 16125) < 1e-8);
  assert.ok(Math.abs(gramSarToOunceUsd(gram21, 21) - 4300) < 1e-8);
});

test('derives one canonical market model from every manual source', () => {
  const fromUsdOunce = deriveMarketPrices({ source: 'ounce-usd', ouncePriceUsd: 4300 });
  const fromSarOunce = deriveMarketPrices({ source: 'ounce-sar', ouncePriceSar: 16125 });
  const fromGram = deriveMarketPrices({
    source: 'gram-sar',
    gramPriceSar: 453.6269398667354,
    gramKarat: 21,
  });

  for (const prices of [fromUsdOunce, fromSarOunce, fromGram]) {
    assert.ok(Math.abs(prices.ounceUsd - 4300) < 1e-8);
    assert.ok(Math.abs(prices.ounceSar - 16125) < 1e-8);
    assert.ok(Math.abs(prices.gram24kSar - 518.4307884191262) < 1e-8);
    assert.ok(Math.abs(prices.gram22kSar - 475.22822271753236) < 1e-8);
    assert.ok(Math.abs(prices.gram21kSar - 453.6269398667354) < 1e-8);
    assert.ok(Math.abs(prices.gram18kSar - 388.82309131434465) < 1e-8);
  }
});

test('round-trips all supported gram karats without using display-rounded values', () => {
  const originalOunceUsd = 4300;
  const canonical = deriveMarketPrices({ source: 'ounce-usd', ouncePriceUsd: originalOunceUsd });
  const byKarat = new Map([
    [18, canonical.gram18kSar],
    [21, canonical.gram21kSar],
    [22, canonical.gram22kSar],
    [24, canonical.gram24kSar],
  ]);

  for (const [karat, gramPrice] of byKarat) {
    const reconstructed = deriveMarketPrices({
      source: 'gram-sar',
      gramPriceSar: gramPrice,
      gramKarat: karat,
    });
    assert.ok(Math.abs(reconstructed.ounceUsd - originalOunceUsd) < 1e-9);
  }
});

test('sanitizes invalid market input and unsupported karat consistently', () => {
  assert.equal(sanitizeNonNegative(''), 0);
  assert.equal(sanitizeNonNegative('abc'), 0);
  assert.equal(sanitizeNonNegative(-1), 0);
  assert.equal(sanitizeNonNegative('12.5'), 12.5);
  assert.equal(normalizeKarat(19), 21);
  assert.equal(normalizeKarat('22'), 22);

  for (const value of ['', 0, -10, 'abc']) {
    assert.equal(ounceUsdTo24kSar(value), 0);
  }

  assert.deepEqual(deriveMarketPrices({ source: 'ounce-sar', ouncePriceSar: -1 }), {
    ounceUsd: 0,
    ounceSar: 0,
    gram24kSar: 0,
    gram22kSar: 0,
    gram21kSar: 0,
    gram18kSar: 0,
  });
});

test('accepts only the four current market sources and rejects legacy aliases', () => {
  assert.ok(Math.abs(resolvePrice24k({
    source: 'live',
    ouncePriceUsd: 4300,
  }) - ounceUsdTo24kSar(4300)) < 1e-12);

  assert.ok(Math.abs(resolvePrice24k({
    source: 'ounce-usd',
    ouncePriceUsd: 4300,
  }) - ounceUsdTo24kSar(4300)) < 1e-12);

  assert.equal(resolvePrice24k({ source: 'ounce', ouncePriceUsd: 4300 }), 0);
  assert.equal(resolvePrice24k({ source: 'manual', manualPrice24k: 520.25 }), 0);
  assert.equal(resolvePrice24k({ source: 'other', ouncePriceUsd: 4300 }), 0);
});
