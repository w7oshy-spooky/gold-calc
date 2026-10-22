const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PREFERENCES_KEY,
  sanitizePreferences,
  createPreferencesStore,
} = require('../js/state/preferences-store.js');

function memoryStorage() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    data,
  };
}

test('round-trips saved calculator inputs', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  store.write({
    mode: 'sell',
    source: 'gram-sar',
    karat: '22',
    gramKarat: 18,
    weight: '12.5',
    workmanshipPerGram: '40',
    profitPerGram: '0',
    taxRate: '15',
    deductionRate: '3',
    ouncePriceUsd: '',
    gramPriceSar: '400',
  });

  assert.deepEqual(store.read(), {
    mode: 'sell',
    source: 'gram-sar',
    karat: 22,
    gramKarat: 18,
    weight: 12.5,
    workmanshipPerGram: 40,
    profitPerGram: 0,
    taxRate: 15,
    deductionRate: 3,
    gramPriceSar: 400,
  });
});

test('drops unknown, invalid and negative values and clamps percentages', () => {
  assert.deepEqual(
    sanitizePreferences({
      mode: 'trade',
      source: 'crypto',
      karat: 14,
      weight: -1,
      workmanshipPerGram: 'abc',
      taxRate: 99,
      deductionRate: 150,
      quotedTotal: 9000,
      extra: true,
    }),
    { taxRate: 25, deductionRate: 100 },
  );
  assert.deepEqual(sanitizePreferences(null), {});
  assert.deepEqual(sanitizePreferences('text'), {});
});

test('corrupted storage and storage errors never throw', () => {
  const storage = memoryStorage();
  storage.setItem(PREFERENCES_KEY, '{not json');
  assert.deepEqual(createPreferencesStore({ storage }).read(), {});

  const throwing = {
    getItem() { throw new Error('denied'); },
    setItem() { throw new Error('denied'); },
    removeItem() { throw new Error('denied'); },
  };
  const store = createPreferencesStore({ storage: throwing });
  assert.deepEqual(store.read(), {});
  assert.doesNotThrow(() => store.write({ mode: 'buy' }));
  assert.doesNotThrow(() => store.clear());

  const noStorage = createPreferencesStore({ storage: null });
  assert.deepEqual(noStorage.read(), {});
});

test('clear removes saved inputs', () => {
  const storage = memoryStorage();
  const store = createPreferencesStore({ storage });
  store.write({ mode: 'sell' });
  store.clear();
  assert.equal(storage.data.has(PREFERENCES_KEY), false);
  assert.deepEqual(store.read(), {});
});

test('keeps valid invoice pieces and drops broken ones', () => {
  const { sanitizeInvoiceItem, MAX_INVOICE_ITEMS } = require('../js/state/preferences-store.js');
  assert.deepEqual(
    sanitizeInvoiceItem({ mode: 'sell', weight: '10', karat: '21', deductionRate: 150, extra: 1 }),
    { mode: 'sell', karat: 21, weight: 10, workmanshipPerGram: 0, profitPerGram: 0, taxRate: 0, deductionRate: 100 },
  );
  assert.equal(sanitizeInvoiceItem({ weight: 0, karat: 21 }), null);
  assert.equal(sanitizeInvoiceItem({ weight: 5, karat: 14 }), null);
  assert.equal(sanitizeInvoiceItem(null), null);

  const items = Array.from({ length: MAX_INVOICE_ITEMS + 5 }, () => ({ weight: 1, karat: 21 }));
  const prefs = sanitizePreferences({ invoice: [...items, { weight: -1, karat: 21 }] });
  assert.equal(prefs.invoice.length, MAX_INVOICE_ITEMS);
  assert.equal(prefs.invoice[0].mode, 'buy');
  assert.equal('invoice' in sanitizePreferences({ invoice: [] }), false);
});
