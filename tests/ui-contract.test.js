const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const marketUi = fs.readFileSync('js/ui/market-ui.js', 'utf8');
const transactionUi = fs.readFileSync('js/ui/transaction-ui.js', 'utf8');
const quoteComparisonUi = fs.readFileSync('js/ui/quote-comparison-ui.js', 'utf8');
const summaryUi = fs.readFileSync('js/ui/summary-ui.js', 'utf8');
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

test('market UI adapter supports SAR ounce and SAR gram market inputs', () => {
  assert.match(marketUi, /ounce-sar/);
  assert.match(marketUi, /gram-sar/);
  assert.match(app, /deriveMarketPrices\s*\(/);
  assert.match(marketUi, /gramInputKarat/);
});

test('transaction UI owns transaction input and mode presentation', () => {
  assert.match(transactionUi, /createTransactionUI/);
  assert.match(transactionUi, /getTransactionInput/);
  assert.match(transactionUi, /setTransactionMode/);
  assert.match(transactionUi, /setKarat/);
  assert.match(transactionUi, /renderInputLabels/);
  assert.match(transactionUi, /buyCostsPanel/);
  assert.match(transactionUi, /sellDeductionPanel/);
});

test('quote comparison UI renders a supplied comparison without owning thresholds', () => {
  assert.match(quoteComparisonUi, /createQuoteComparisonUI/);
  assert.match(quoteComparisonUi, /render\s*\(/);
  assert.doesNotMatch(quoteComparisonUi, /differencePct\s*[<>]=?\s*[25]/);
  assert.doesNotMatch(quoteComparisonUi, /compareQuote\s*\(/);
});

test('summary UI renders supplied transaction results without calculating them', () => {
  assert.match(summaryUi, /createSummaryUI/);
  assert.match(summaryUi, /render\s*\(/);
  assert.doesNotMatch(summaryUi, /calculateTransaction\s*\(/);
});

test('application delegates transaction calculation and presentation', () => {
  assert.match(app, /calculateTransaction\s*\(/);
  assert.match(app, /compareQuote\s*\(/);
  assert.doesNotMatch(app, /\$\(['"]buyCostsPanel['"]\)/);
  assert.doesNotMatch(app, /\$\(['"]comparisonStatus['"]\)/);
  assert.doesNotMatch(app, /\$\(['"]finalTotalOutput['"]\)/);
});

test('Arabic and English pages load the modular scripts in dependency order', () => {
  for (const html of [arabic, english]) {
    const order = [
      'js/core/price-converter.js',
      'gold-calculator.js',
      'js/i18n/translations.js',
      'js/ui/formatting.js',
      'js/market/price-cache.js',
      'js/market/live-price-client.js',
      'js/ui/market-ui.js',
      'js/ui/transaction-ui.js',
      'js/ui/quote-comparison-ui.js',
      'js/ui/summary-ui.js',
      'js/app.js',
    ];
    let previous = -1;
    for (const src of order) {
      const index = html.indexOf(`src="${src}"`);
      assert.ok(index > previous, `${src} must load after its dependencies`);
      previous = index;
    }
  }
});

test('root app.js is removed after the modular bootstrap migration', () => {
  assert.equal(fs.existsSync('app.js'), false);
});

test('bootstrap is orchestration-only', () => {
  assert.doesNotMatch(app, /localStorage/);
  assert.doesNotMatch(app, /\bfetch\s*\(/);
  assert.doesNotMatch(app, /insertAdjacentHTML/);
  assert.doesNotMatch(app, /function\s+formatMoney/);
  assert.doesNotMatch(app, /const\s+copy\s*=\s*\{/);
});

test('UI includes a live price mode backed by the extracted Vercel client', () => {
  assert.match(app, /fetchLiveGoldPrice/);
  assert.match(livePriceClient, /\/api\/gold-price/);
  assert.match(app, /setPriceSource\(['"]live['"]\)/);
  for (const html of [arabic, english]) {
    assert.match(html, /data-source=["']live["']/);
  }
});

test('live UI exposes refresh, status, update time and all supported karat prices in static pages', () => {
  for (const html of [arabic, english]) {
    for (const id of ['liveRefresh', 'livePriceStatus', 'liveUpdatedAt', 'liveKarat24', 'liveKarat22', 'liveKarat21', 'liveKarat18']) {
      assert.match(html, new RegExp(`id=["']${id}["']`));
    }
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

test('LIVE failure checks recent cache before falling back to manual USD ounce', () => {
  const cacheIndex = app.indexOf('priceCache.readCachedQuote()');
  const manualIndex = app.indexOf("setPriceSource('ounce-usd'");
  assert.ok(cacheIndex >= 0);
  assert.ok(manualIndex > cacheIndex);
});
