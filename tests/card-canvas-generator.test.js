const test = require('node:test');
const assert = require('node:assert/strict');
const generator = require('../js/ui/card-canvas-generator.js');

function createMockDocument() {
  const drawnOperations = [];
  const mockContext = {
    direction: 'ltr',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textAlign: 'left',
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    closePath: () => {},
    fill: () => {},
    stroke: () => {},
    fillRect: (x, y, w, h) => drawnOperations.push({ op: 'fillRect', x, y, w, h }),
    fillText: (text, x, y) => drawnOperations.push({ op: 'fillText', text, x, y }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };

  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: () => mockContext,
    toBlob: (cb) => cb(new Blob(['mock-png'], { type: 'image/png' })),
  };

  return {
    drawnOperations,
    mockCanvas,
    createElement: (tag) => {
      if (tag === 'canvas') return mockCanvas;
      return {};
    },
    fonts: { ready: Promise.resolve() },
  };
}

test('generateCardBlob generates a blob for an audit quote inspection', async () => {
  const doc = createMockDocument();
  const blob = await generator.generateCardBlob({
    audit: {
      available: true,
      weight: 10,
      karat: 21,
      quotedTotal: 3500,
      rawMetalCost: 2800,
      vat: 420,
      laborCost: 280,
      laborPerGram: 28,
      benchmarkCategory: 'fair',
    },
    advice: {
      available: true,
      minFairPrice: 3200,
      maxFairPrice: 3400,
      potentialSavings: 100,
    },
    documentRef: doc,
    locale: 'ar',
  });

  assert.ok(blob instanceof Blob);
  const texts = doc.drawnOperations.filter((d) => d.op === 'fillText').map((d) => d.text);
  assert.ok(texts.some((t) => t.includes('حاسبة الذهب الذكية')));
  assert.ok(texts.some((t) => t.includes('10 جم')));
  assert.ok(texts.some((t) => t.includes('21K')));
});

test('generateCardBlob generates a blob for a sell calculation result', async () => {
  const doc = createMockDocument();
  const blob = await generator.generateCardBlob({
    result: {
      mode: 'sell',
      weight: 15,
      karat: 18,
      gramPrice: 320,
      rawMetalValue: 4800,
      deductionRate: 2,
      deductionValue: 96,
      total: 4704,
    },
    documentRef: doc,
    locale: 'ar',
  });

  assert.ok(blob instanceof Blob);
  const texts = doc.drawnOperations.filter((d) => d.op === 'fillText').map((d) => d.text);
  assert.ok(texts.some((t) => t.includes('حسبة بيع الذهب')));
  assert.ok(texts.some((t) => t.includes('15 جم')));
  assert.ok(texts.some((t) => t.includes('18K')));
});

test('generateCardBlob generates a blob for a buy calculation result', async () => {
  const doc = createMockDocument();
  const blob = await generator.generateCardBlob({
    result: {
      mode: 'buy',
      weight: 20,
      karat: 21,
      gramPrice: 380,
      goldCost: 7600,
      laborCost: 600,
      vat: 1230,
      taxRate: 15,
      total: 9430,
    },
    documentRef: doc,
    locale: 'en',
  });

  assert.ok(blob instanceof Blob);
  const texts = doc.drawnOperations.filter((d) => d.op === 'fillText').map((d) => d.text);
  assert.ok(texts.some((t) => t.includes('Smart Gold Assistant')));
  assert.ok(texts.some((t) => t.includes('20 g')));
});

test('shareOrDownloadCard uses navigator.share with files ONLY (no text param)', async () => {
  const sharedCalls = [];
  const mockNavigator = {
    canShare: (data) => Boolean(data && data.files),
    share: async (data) => sharedCalls.push(data),
  };

  const blob = new Blob(['png-data'], { type: 'image/png' });
  const res = await generator.shareOrDownloadCard({
    blob,
    filename: 'test.png',
    title: 'Gold Report',
    navigatorRef: mockNavigator,
  });

  assert.equal(res.shared, true);
  assert.equal(res.method, 'web_share');
  assert.equal(sharedCalls.length, 1);
  assert.equal(sharedCalls[0].title, 'Gold Report');
  assert.ok(Array.isArray(sharedCalls[0].files));
  assert.equal(sharedCalls[0].text, undefined, 'text must NOT be passed to prevent WhatsApp file dropping');
});

test('shareOrDownloadCard falls back to download when canShare is false', async () => {
  const downloads = [];
  const mockWindow = {
    document: {
      createElement: (tag) => ({
        set href(val) { this._href = val; },
        get href() { return this._href; },
        set download(val) { this._download = val; },
        get download() { return this._download; },
        click: () => downloads.push({ href: this._href, download: this._download }),
      }),
      body: {
        appendChild: () => {},
        removeChild: () => {},
      },
    },
  };
  global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {},
  };

  const blob = new Blob(['png-data'], { type: 'image/png' });
  const res = await generator.shareOrDownloadCard({
    blob,
    filename: 'download-test.png',
    navigatorRef: null,
    windowRef: mockWindow,
  });

  assert.equal(res.shared, true);
  assert.equal(res.method, 'download');
});

test('shareOrDownloadCard uses the native share sheet inside the app', async () => {
  const nativeFile = require('../js/ui/native-file.js');
  const written = [];
  const capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Filesystem: { writeFile: async (options) => { written.push(options.path); return { uri: 'file:///x' }; } },
      Share: { share: async () => {} },
    },
  };
  class FakeReader { readAsDataURL() { this.result = 'data:image/png;base64,QUJD'; this.onload(); } }
  const previous = global.FileReader;
  global.FileReader = FakeReader;
  try {
    const res = await generator.shareOrDownloadCard({
      blob: {},
      filename: 'card.png',
      nativeFile,
      capacitor,
      navigatorRef: null,
      windowRef: null,
    });
    assert.deepEqual(res, { shared: true, method: 'native_share' });
    assert.deepEqual(written, ['card.png']);
  } finally {
    if (previous) global.FileReader = previous; else delete global.FileReader;
  }
});
