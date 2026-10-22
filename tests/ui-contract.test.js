const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('js/app.js', 'utf8');
const marketUi = fs.readFileSync('js/ui/market-ui.js', 'utf8');
const transactionUi = fs.readFileSync('js/ui/transaction-ui.js', 'utf8');
const summaryUi = fs.readFileSync('js/ui/summary-ui.js', 'utf8');
const priceCache = fs.readFileSync('js/market/price-cache.js', 'utf8');
const livePriceClient = fs.readFileSync('js/market/live-price-client.js', 'utf8');
const styles = fs.readFileSync('styles.css', 'utf8');

const requiredIds = [
  'transactionMode', 'weight', 'karat', 'workmanship', 'profit', 'taxRange', 'taxValueLabel',
  'sellDeduction', 'sellDeductionLabel', 'sellDeductionPanel', 'buyCostsPanel', 'vatPanel',
  'finalAmountLabel', 'finalTotalOutput', 'summaryRows', 'summaryWeight', 'summaryKarat',
  'addToInvoice', 'shareSummary', 'resetInputs', 'actionStatus',
  'chartPrice', 'chartChange', 'chartSvg', 'chartArea', 'chartLine', 'chartCursor', 'chartDot',
  'invoicePanel', 'invoiceCount', 'invoiceList', 'invoiceNetLabel', 'invoiceNet', 'clearInvoice',
];

for (const id of requiredIds) {
  test(`Arabic page exposes #${id}`, () => {
    assert.match(arabic, new RegExp(`id=["']${id}["']`));
  });

  test(`English page exposes #${id}`, () => {
    assert.match(english, new RegExp(`id=["']${id}["']`));
  });
}

test('the removed features are gone from both pages and the scripts', () => {
  for (const html of [arabic, english]) {
    assert.doesNotMatch(html, /quotedTotal|comparisonPanel|bottom-receipt|market-card|ouncePriceUSD|gramPriceSAR/);
    assert.doesNotMatch(html, /quote-comparison-ui/);
  }
  assert.doesNotMatch(app, /compareQuote|quoteComparison/);
  assert.equal(fs.existsSync('js/ui/quote-comparison-ui.js'), false);
});

test('both pages follow the design layout: inputs card, result card, chart card and optional invoice', () => {
  for (const html of [arabic, english]) {
    const order = ['inputs-card', 'result-card', 'chart-card', 'invoice-card'].map((name) => html.indexOf(`class="card ${name}`));
    assert.ok(order.every((index) => index > 0));
    assert.ok(order[1] < order[2] && order[2] < order[3]);
    assert.match(html, /id="invoicePanel" hidden/);
    assert.match(html, /class="layout"/);
  }
  assert.match(styles, /\.result-card\{background:linear-gradient\(160deg,#f1cf6e,#d4a62f\)/);
  assert.match(styles, /\.col-main\{flex:1\.5 1 440px/);
});

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

test('summary UI renders supplied transaction results without calculating them', () => {
  assert.match(summaryUi, /createSummaryUI/);
  assert.match(summaryUi, /render\s*\(/);
  assert.doesNotMatch(summaryUi, /calculateTransaction\s*\(/);
});

test('application delegates transaction calculation and presentation', () => {
  assert.match(app, /calculateTransaction\s*\(/);
  assert.doesNotMatch(app, /\$\(['"]buyCostsPanel['"]\)/);
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
      'js/ui/summary-ui.js',
      'js/state/preferences-store.js',
      'js/ui/share-ui.js',
      'js/ui/invoice-ui.js',
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
  assert.doesNotMatch(app, /let\s+liveQuote\b/);
});

test('UI includes a live price mode backed by the extracted Vercel client', () => {
  assert.match(app, /fetchLiveGoldPrice/);
  assert.match(livePriceClient, /\/api\/gold-price/);
  assert.match(app, /setPriceSource\(['"]live['"]\)/);
  for (const html of [arabic, english]) {
    assert.match(html, /data-source=["']live["']/);
  }
});

test('live UI delegates short-lived caching and keeps manual fallback orchestration', () => {
  assert.match(priceCache, /LIVE_CACHE_MAX_AGE_MS/);
  assert.match(priceCache, /readCachedQuote/);
  assert.match(priceCache, /writeCachedQuote/);
  assert.match(app, /priceCache\.readCachedQuote\(\)/);
  assert.match(app, /fallbackToManualPrice/);
});

test('LIVE failure checks recent cache before falling back to manual USD ounce', () => {
  assert.match(
    app,
    /catch\s*\{[\s\S]*?const cachedQuote = priceCache\.readCachedQuote\(\);[\s\S]*?if \(cachedQuote\) applyLiveQuote\(cachedQuote, 'cached'\);[\s\S]*?else fallbackToManualPrice\(\);/
  );
  assert.match(
    app,
    /function fallbackToManualPrice\([\s\S]*?setPriceSource\('ounce-usd', \{ fetchLive: false \}\);/
  );
  assert.match(app, /invoice: invoiceItems,/);
});


test('transaction step buttons use module-bound events instead of inline global handlers', () => {
  for (const html of [arabic, english]) {
    assert.doesNotMatch(html, /\sonclick=/);
    for (const target of ['weight', 'workmanship', 'profit']) {
      assert.match(html, new RegExp(`data-adjust-target=["']${target}["']`));
    }
  }
  assert.match(transactionUi, /data-adjust-target/);
  assert.doesNotMatch(app, /globalThis\.\w+\s*=/);
});

test('pages use the prebuilt stylesheet instead of runtime CDN styling', () => {
  assert.ok(fs.existsSync('tailwind.css'), 'tailwind.css must be committed');
  for (const html of [arabic, english]) {
    assert.doesNotMatch(html, /cdn\.tailwindcss\.com/);
    assert.doesNotMatch(html, /font-awesome/);
    assert.ok(html.indexOf('href="tailwind.css"') < html.indexOf('href="styles.css"'));
    assert.match(html, /rel="manifest" href="manifest\.webmanifest"/);
    assert.match(html, /rel="icon" href="icon\.svg"/);
  }
  const manifest = JSON.parse(fs.readFileSync('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.start_url, 'index.html');
  assert.ok(fs.existsSync(manifest.icons[0].src));
});

test('a live quote that arrives after switching to manual entry is not applied', () => {
  assert.match(
    app,
    /const quote = await livePriceClient\.fetchQuote\(\{ force \}\);[\s\S]*?if \(isLiveSource\(\)\) applyLiveQuote\(quote, 'live'\);/
  );
  assert.match(app, /catch \{\s*if \(!isLiveSource\(\)\) return;/);
});

test('live price refreshes in the background only while visible in LIVE mode', () => {
  assert.match(app, /LIVE_AUTO_REFRESH_MS = 60 \* 1000/);
  assert.match(app, /function refreshLiveInBackground\(\) \{\s*if \(!isLiveSource\(\) \|\| document\.visibilityState !== 'visible'\) return;/);
  assert.match(app, /addEventListener\('visibilitychange', refreshLiveInBackground\)/);
});

test('an automatic LIVE fallback is not saved as the preferred source', () => {
  assert.match(app, /liveFallbackActive = true;[\s\S]*?setPriceSource\('ounce-usd', \{ fetchLive: false \}\);/);
  assert.match(app, /const source = liveFallbackActive \? 'live' : market\.source;/);
});

test('offline fallback pre-fills the last known quote with a dated notice', () => {
  assert.match(app, /const lastKnownQuote = priceCache\.readLastKnownQuote\(\);/);
  assert.match(app, /copy\.liveOfflinePrefill\.replace\('\{time\}'/);
});

test('service worker precaches every script and stylesheet the pages load', () => {
  const sw = fs.readFileSync('sw.js', 'utf8');
  for (const html of [arabic, english]) {
    const assets = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css|svg|webmanifest))"/g)].map((m) => m[1]);
    assert.ok(assets.length > 10);
    for (const asset of assets) {
      assert.ok(sw.includes(`'${asset}'`), `sw.js must precache ${asset}`);
    }
  }
  assert.match(sw, /url\.pathname\.startsWith\('\/api\/'\)/);
  assert.match(app, /navigator\.serviceWorker\.register\('sw\.js'\)/);
});
