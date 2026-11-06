'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { saveFile, getNativePlugins, isCancel } = require('../js/ui/native-file.js');

function createCapacitor({ native = true, shareError = null } = {}) {
  const calls = { write: [], share: [] };
  return {
    calls,
    capacitor: {
      isNativePlatform: () => native,
      Plugins: {
        Filesystem: { writeFile: async (options) => { calls.write.push(options); return { uri: 'file:///cache/' + options.path }; } },
        Share: { share: async (options) => { calls.share.push(options); if (shareError) throw shareError; } },
      },
    },
  };
}

class FakeReader {
  readAsDataURL() { this.result = 'data:image/png;base64,QUJD'; this.onload(); }
}

test('inside the app a text file is written to the cache and shared', async () => {
  const { capacitor, calls } = createCapacitor();
  const result = await saveFile({ filename: 'backup.json', text: '{"a":1}', title: 'Backup', capacitor });
  assert.deepEqual(result, { method: 'native_share', cancelled: false });
  assert.deepEqual(calls.write[0], { path: 'backup.json', data: '{"a":1}', directory: 'CACHE', encoding: 'utf8' });
  assert.deepEqual(calls.share[0], { title: 'Backup', dialogTitle: 'Backup', url: 'file:///cache/backup.json' });
});

test('inside the app a blob is written as base64 without an encoding', async () => {
  const { capacitor, calls } = createCapacitor();
  await saveFile({ filename: 'card.png', blob: {}, capacitor, FileReaderImpl: FakeReader });
  assert.deepEqual(calls.write[0], { path: 'card.png', data: 'QUJD', directory: 'CACHE' });
});

test('closing the share sheet is reported as cancelled, other errors are thrown', async () => {
  const cancelled = createCapacitor({ shareError: new Error('Share canceled') });
  assert.deepEqual(
    await saveFile({ filename: 'a.json', text: '{}', capacitor: cancelled.capacitor }),
    { method: 'native_share', cancelled: true },
  );
  const broken = createCapacitor({ shareError: new Error('disk full') });
  await assert.rejects(saveFile({ filename: 'a.json', text: '{}', capacitor: broken.capacitor }), /disk full/);
});

test('in a browser the file is downloaded through a link', async () => {
  const clicks = [];
  const anchor = { click: () => clicks.push(anchor.download) };
  const doc = {
    body: { appendChild() {}, removeChild() {} },
    createElement: () => anchor,
  };
  const urlApi = { createObjectURL: () => 'blob:x', revokeObjectURL() {} };
  const { capacitor } = createCapacitor({ native: false });
  const result = await saveFile({ filename: 'backup.json', text: '{}', document: doc, urlApi, capacitor });
  assert.deepEqual(result, { method: 'download', cancelled: false });
  assert.deepEqual(clicks, ['backup.json']);
  assert.equal(anchor.href, 'blob:x');
});

test('helpers detect the native platform and cancellations', () => {
  assert.equal(getNativePlugins(null), null);
  assert.equal(getNativePlugins(createCapacitor({ native: false }).capacitor), null);
  assert.ok(getNativePlugins(createCapacitor().capacitor));
  assert.ok(isCancel({ name: 'AbortError' }));
  assert.ok(isCancel(new Error('User cancelled')));
  assert.ok(!isCancel(new Error('boom')));
});

test('saveFile needs a filename and content', async () => {
  await assert.rejects(saveFile({ text: 'x' }), /required/);
  await assert.rejects(saveFile({ filename: 'a.json' }), /required/);
});
