'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { fitWithin, resizeImageFile } = require('../js/ui/image-resize.js');

function createFakes({ bitmap = { width: 4000, height: 3000 }, decodeFails = false } = {}) {
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillRect() {}, drawImage() {} }),
    toDataURL: (type, quality) => `data:${type};q=${quality};base64,RESIZED`,
  };
  class FakeReader {
    readAsDataURL(file) {
      this.result = `data:${file.type};base64,ORIGINAL`;
      this.onload();
    }
  }
  return {
    canvas,
    options: {
      document: { createElement: () => canvas },
      createImageBitmapImpl: async () => {
        if (decodeFails) throw new Error('decode failed');
        return { ...bitmap, close() {} };
      },
      ImageImpl: null,
      urlApi: null,
      FileReaderImpl: FakeReader,
    },
  };
}

test('fitWithin keeps aspect ratio and never enlarges', () => {
  assert.deepEqual(fitWithin(4000, 3000, 1280), { width: 1280, height: 960 });
  assert.deepEqual(fitWithin(3000, 4000, 1280), { width: 960, height: 1280 });
  assert.deepEqual(fitWithin(800, 600, 1280), { width: 800, height: 600 });
  assert.deepEqual(fitWithin(0, 600, 1280), { width: 0, height: 0 });
});

test('large photos are downscaled to JPEG', async () => {
  const { canvas, options } = createFakes();
  const result = await resizeImageFile({ type: 'image/png', size: 6_000_000 }, options);
  assert.equal(canvas.width, 1280);
  assert.equal(canvas.height, 960);
  assert.match(result, /^data:image\/jpeg;q=0\.82;base64,RESIZED$/);
});

test('invoices can use a larger limit', async () => {
  const { canvas, options } = createFakes();
  await resizeImageFile({ type: 'image/jpeg', size: 5_000_000 }, { ...options, maxSize: 1600 });
  assert.equal(canvas.width, 1600);
  assert.equal(canvas.height, 1200);
});

test('small JPEGs are kept as they are', async () => {
  const { options } = createFakes({ bitmap: { width: 800, height: 600 } });
  const result = await resizeImageFile({ type: 'image/jpeg', size: 100_000 }, options);
  assert.equal(result, 'data:image/jpeg;base64,ORIGINAL');
});

test('falls back to the original file when decoding fails', async () => {
  const { options } = createFakes({ decodeFails: true });
  const result = await resizeImageFile({ type: 'image/heic', size: 2_000_000 }, options);
  assert.equal(result, 'data:image/heic;base64,ORIGINAL');
});
