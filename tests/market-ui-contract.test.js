const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const arabic = fs.readFileSync('index.html', 'utf8');
const english = fs.readFileSync('en.html', 'utf8');
const app = fs.readFileSync('app.js', 'utf8');
const marketUi = fs.readFileSync('js/ui/market-ui.js', 'utf8');

const liveIds = [
  'livePricePanel',
  'liveRefresh',
  'livePriceStatus',
  'liveUpdatedAt',
  'liveKarat24',
  'liveKarat22',
  'liveKarat21',
  'liveKarat18',
];

test('both pages contain the complete LIVE panel as static HTML', () => {
  for (const html of [arabic, english]) {
    for (const id of liveIds) {
      assert.match(html, new RegExp(`id=["']${id}["']`));
    }
  }
});

test('Arabic and English expose the same market source DOM contract', () => {
  const ids = [
    'priceSource',
    'ounceUsdInputPanel',
    'ouncePriceUSD',
    'ounceSarInputPanel',
    'ouncePriceSAR',
    'gramSarInputPanel',
    'gramPriceSAR',
    'gramInputKarat',
    'marketPrice',
    'marketEquivalentPanel',
    'priceModeHelp',
    'priceWarning',
  ];

  for (const id of ids) {
    assert.match(arabic, new RegExp(`id=["']${id}["']`));
    assert.match(english, new RegExp(`id=["']${id}["']`));
  }

  for (const source of ['live', 'ounce-usd', 'ounce-sar', 'gram-sar']) {
    assert.match(arabic, new RegExp(`data-source=["']${source}["']`));
    assert.match(english, new RegExp(`data-source=["']${source}["']`));
  }
});

test('market UI module owns source and gram-karat presentation behavior', () => {
  assert.match(marketUi, /createMarketUI/);
  assert.match(marketUi, /setPriceSource/);
  assert.match(marketUi, /setGramInputKarat/);
  assert.match(marketUi, /renderMarketEquivalents/);
  assert.match(marketUi, /renderLiveStatus/);
  assert.match(marketUi, /renderLiveKaratPrices/);
  assert.match(marketUi, /getMarketInput/);
});

test('application no longer injects the LIVE structure at runtime', () => {
  assert.doesNotMatch(app, /installLiveUi/);
  assert.doesNotMatch(app, /insertAdjacentHTML/);
});
