const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');

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

test('UI includes a live price mode backed by the Vercel endpoint', () => {
  assert.match(app, /fetchLiveGoldPrice/);
  assert.match(app, /\/api\/gold-price/);
  assert.match(app, /setPriceSource\(['"]live['"]\)/);
  assert.match(app, /data-source=["']live["']/);
});

test('live UI exposes refresh, status, update time and all supported karat prices', () => {
  for (const id of ['liveRefresh', 'livePriceStatus', 'liveUpdatedAt', 'liveKarat24', 'liveKarat22', 'liveKarat21', 'liveKarat18']) {
    assert.match(app, new RegExp(id));
  }
});

test('live UI stores a short-lived cached quote and can fall back to manual pricing', () => {
  assert.match(app, /localStorage/);
  assert.match(app, /LIVE_CACHE_MAX_AGE_MS/);
  assert.match(app, /useCachedLiveQuote/);
  assert.match(app, /fallbackToManualPrice/);
});
