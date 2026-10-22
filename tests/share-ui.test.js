const test = require('node:test');
const assert = require('node:assert/strict');

const { buildSummaryText, createShareUI } = require('../js/ui/share-ui.js');
const { createFormatting } = require('../js/ui/formatting.js');
const { getCopy } = require('../js/i18n/translations.js');
const { calculateTransaction, compareQuote } = require('../gold-calculator.js');

const price24k = 518.4307884191262;

test('builds a buy summary with VAT and quote comparison', () => {
  const result = calculateTransaction({
    mode: 'buy', price24k, weight: 15, karat: 21, workmanshipPerGram: 35, profitPerGram: 0, taxRate: 15,
  });
  const comparison = compareQuote({ mode: 'buy', referenceTotal: result.total, quotedTotal: 9000 });
  const text = buildSummaryText({
    result, comparison, quotedTotal: '9000', price24k, copy: getCopy('en'), formatting: createFormatting('en'),
  });

  assert.equal(text, [
    'Gold Calculator — Buy jewellery',
    'Weight (g): 15 · Karat: 21',
    'Gram price for selected karat: 453.63 SAR',
    'Gold cost: 6,804.40 SAR',
    'Workmanship + margin: 525.00 SAR',
    'VAT (15%): 1,099.41 SAR',
    'Final amount: 8,428.81 SAR',
    'Shop quote: 9,000.00 SAR (+571.19 SAR · +6.78%)',
    'Reference 24K gram price: 518.43 SAR',
    'Indicative estimate — the actual shop price may differ.',
  ].join('\n'));
});

test('builds a sell summary with the buyer deduction and no VAT line', () => {
  const result = calculateTransaction({ mode: 'sell', price24k, weight: 15, karat: 21, deductionRate: 3 });
  const text = buildSummaryText({
    result,
    comparison: { available: false },
    quotedTotal: '',
    price24k,
    copy: getCopy('ar'),
    formatting: createFormatting('ar'),
  });

  assert.match(text, /^حاسبة الذهب — بيع ذهب مستعمل/);
  assert.match(text, /خصم المشتري \(3%\): −204\.13 ر\.س/);
  assert.match(text, /المبلغ المرجعي المتوقع: 6,600\.27 ر\.س/);
  assert.doesNotMatch(text, /ض\.ق\.م/);
  assert.doesNotMatch(text, /عرض المحل/);
});

function fakeDocument() {
  const elements = {};
  for (const id of ['shareSummary', 'resetInputs', 'actionStatus']) {
    const listeners = {};
    elements[id] = {
      textContent: '',
      dataset: {},
      addEventListener: (type, fn) => { listeners[type] = fn; },
      click: () => listeners.click(),
    };
  }
  return { getElementById: (id) => elements[id], elements };
}

function setup({ navigator, summary = 'summary text', onReset } = {}) {
  const document = fakeDocument();
  const ui = createShareUI({
    document,
    copy: getCopy('en'),
    navigator,
    getSummary: () => summary,
    onReset,
    setTimeoutImpl: () => 1,
    clearTimeoutImpl: () => {},
  });
  return { ui, status: document.elements.actionStatus, document };
}

test('uses the native share sheet when available', async () => {
  const shared = [];
  const { ui, status } = setup({ navigator: { share: async (data) => shared.push(data) } });
  await ui.share();
  assert.deepEqual(shared, [{ title: 'Gold Calculator', text: 'summary text' }]);
  assert.equal(status.textContent, '');
});

test('a cancelled share sheet is silent and does not fall back to copying', async () => {
  let copied = false;
  const { ui, status } = setup({
    navigator: {
      share: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; },
      clipboard: { writeText: async () => { copied = true; } },
    },
  });
  await ui.share();
  assert.equal(copied, false);
  assert.equal(status.textContent, '');
});

test('falls back to the clipboard and reports the result', async () => {
  let copied = '';
  const { ui, status } = setup({ navigator: { clipboard: { writeText: async (t) => { copied = t; } } } });
  await ui.share();
  assert.equal(copied, 'summary text');
  assert.equal(status.textContent, getCopy('en').shareCopied);

  const failing = setup({ navigator: {} });
  await failing.ui.share();
  assert.equal(failing.status.textContent, getCopy('en').shareFailed);
  assert.equal(failing.status.dataset.state, 'error');
});

test('asks for a price before sharing an empty summary', async () => {
  const { ui, status } = setup({ navigator: {}, summary: '' });
  await ui.share();
  assert.equal(status.textContent, getCopy('en').shareNeedsPrice);
});

test('reset button calls the reset handler and confirms it', () => {
  let resets = 0;
  const { status, document } = setup({ navigator: {}, onReset: () => { resets += 1; } });
  document.elements.resetInputs.click();
  assert.equal(resets, 1);
  assert.equal(status.textContent, getCopy('en').resetDone);
});

test('shares the whole invoice instead of the draft piece when it has items', () => {
  const { calculateInvoice } = require('../gold-calculator.js');
  const result = calculateTransaction({ mode: 'buy', price24k, weight: 15, karat: 21, workmanshipPerGram: 35, taxRate: 15 });
  const invoice = calculateInvoice({
    price24k,
    items: [
      { mode: 'buy', weight: 15, karat: 21, workmanshipPerGram: 35, profitPerGram: 0, taxRate: 15 },
      { mode: 'sell', weight: 10, karat: 21, deductionRate: 0 },
    ],
  });
  const text = buildSummaryText({
    result, comparison: { available: false }, quotedTotal: '', price24k, invoice,
    copy: getCopy('en'), formatting: createFormatting('en'),
  });
  assert.equal(text, [
    'Gold Calculator — Invoice (2)',
    '1. Buy · 15 g · Karat 21: 8,428.81 SAR',
    '2. Sell/trade-in · 10 g · Karat 21: −4,536.27 SAR',
    'Net amount to pay: 3,892.55 SAR',
    'Reference 24K gram price: 518.43 SAR',
    'Indicative estimate — the actual shop price may differ.',
  ].join('\n'));
});

test('a 0% sell deduction is shared without a minus sign', () => {
  const result = calculateTransaction({ mode: 'sell', price24k, weight: 10, karat: 21, deductionRate: 0 });
  const text = buildSummaryText({ result, price24k, copy: getCopy('en'), formatting: createFormatting('en') });
  assert.match(text, /Buyer deduction \(0%\): 0\.00 SAR/);
});
