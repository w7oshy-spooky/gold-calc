const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const priceCache = fs.readFileSync('js/market/price-cache.js', 'utf8');
const livePriceClient = fs.readFileSync('js/market/live-price-client.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

const requiredIds = [
  'transactionMode',
  'sellDeduction',
  'sellDeductionPanel',
  'buyCostsPanel',
  'vatPanel',
  'quotedTotal',
  'comparisonPanel',
  'comparisonStatus',
  'comparisonDifference',
  'comparisonPercent',
  'summaryPrimaryLabel',
  'summarySecondaryLabel',
  'ouncePriceSAR',
  'gramPriceSAR',
  'gramInputKarat',
  'marketEquivalentPanel',
  'equivalentOunceUSD',
  'equivalentOunceSAR',
  'equivalentGram24',
  'equivalentGram22',
  'equivalentGram21',
  'equivalentGram18',
];

for (const id of requiredIds) {
  test(`Arabic page exposes #${id}`, () => {
    assert.match(arabic, new RegExp(`id=["']${id}["']`));
  });

  test(`English page exposes #${id}`, () => {
    assert.match(english, new RegExp(`id=["']${id}["']`));
  });
}

test('both pages expose buy and sell mode buttons', () => {
  for (const html of [arabic, english]) {
    assert.match(html, /data-mode=["']buy["']/);
    assert.match(html, /data-mode=["']sell["']/);
  }
});

test('both pages expose all four market price source modes', () => {
  for (const html of [arabic, english]) {
    assert.match(html, /data-source=["']live["']/);
    assert.match(html, /data-source=["']ounce-usd["']/);
    assert.match(html, /data-source=["']ounce-sar["']/);
    assert.match(html, /data-source=["']gram-sar["']/);
  }
});

test('UI adapter supports SAR ounce and SAR gram market inputs', () => {
  assert.match(app, /ounce-sar/);
  assert.match(app, /gram-sar/);
  assert.match(app, /deriveMarketPrices\s*\(/);
  assert.match(app, /gramInputKarat/);
});

test('UI adapter uses transaction and quote comparison core functions', () => {
  assert.match(app, /calculateTransaction\s*\(/);
  assert.match(app, /compareQuote\s*\(/);
  assert.match(app, /setTransactionMode/);
  assert.match(app, /renderComparison/);
});

test('Arabic and English pages keep shared calculation and UI scripts', () => {
  for (const html of [arabic, english]) {
    assert.match(html, /src=["']gold-calculator\.js["']/);
    assert.match(html, /src=["']app\.js["']/);
  }
});

test('UI includes a live price mode backed by the extracted Vercel client', () => {
  assert.match(app, /fetchLiveGoldPrice/);
  assert.match(livePriceClient, /\/api\/gold-price/);
  assert.match(app, /setPriceSource\(['"]live['"]\)/);
  assert.match(app, /data-source=["']live["']/);
});

test('live UI exposes refresh, status, update time and all supported karat prices', () => {
  for (const id of ['liveRefresh', 'livePriceStatus', 'liveUpdatedAt', 'liveKarat24', 'liveKarat22', 'liveKarat21', 'liveKarat18']) {
    assert.match(app, new RegExp(id));
  }
});

test('live UI delegates short-lived caching and keeps manual fallback orchestration', () => {
  assert.match(priceCache, /LIVE_CACHE_MAX_AGE_MS/);
  assert.match(priceCache, /readCachedQuote/);
  assert.match(priceCache, /writeCachedQuote/);
  assert.match(app, /priceCache\.readCachedQuote\(\)/);
  assert.match(app, /fallbackToManualPrice/);
});

test('VAT slider fill follows page direction', () => {
  assert.match(
    styles,
    /html\[dir=ltr\]\s+input\[type=range\]::\-webkit-slider-runnable-track\{[^}]*linear-gradient\(to right,/,
  );
  assert.match(
    styles,
    /html\[dir=rtl\]\s+input\[type=range\]::\-webkit-slider-runnable-track\{[^}]*linear-gradient\(to left,/,
  );
});
