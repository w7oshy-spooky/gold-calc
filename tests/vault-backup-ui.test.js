'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createVaultBackupUI } = require('../js/ui/vault-backup-ui.js');

function setup({ pieces = [], importResult = [], importFails = false } = {}) {
  const handlers = {};
  const node = (name) => ({ addEventListener: (type, fn) => { handlers[`${name}:${type}`] = fn; } });
  const elements = {
    exportBackupBtn: node('export'),
    importBackupInput: { ...node('import'), files: [{ name: 'backup.json' }], value: 'x' },
    backupStatus: { textContent: '', className: '' },
  };
  const calls = [];
  const vaultStore = {
    getAllPieces: async () => pieces,
    exportBackup: async () => '[]',
    importBackup: async () => {
      if (importFails) throw new Error('bad file');
      return importResult;
    },
  };
  const copy = { vaultLabels: { backupEmpty: 'EMPTY', backupInvalid: 'INVALID', backupRestored: 'RESTORED {count}' } };
  const label = (key, fallback) => fallback;
  createVaultBackupUI({
    document: {},
    elements,
    vaultStore,
    copy,
    label,
    render: async () => calls.push('render'),
    onChange: (event) => calls.push(event),
  });
  return { handlers, elements, calls };
}

test('exporting an empty vault shows the empty message', async () => {
  const { handlers, elements } = setup();
  await handlers['export:click']();
  assert.equal(elements.backupStatus.textContent, 'EMPTY');
});

test('restoring a backup re-renders and reports the count', async () => {
  global.FileReader = class {
    readAsText() { this.onload({ target: { result: '[]' } }); }
  };
  try {
    const { handlers, elements, calls } = setup({ importResult: [{}, {}] });
    await handlers['import:change']();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(elements.backupStatus.textContent, 'RESTORED 2');
    assert.deepEqual(calls, ['render', { type: 'vault-imported', count: 2 }]);
    assert.equal(elements.importBackupInput.value, '');
  } finally {
    delete global.FileReader;
  }
});

test('an invalid backup file shows the invalid message', async () => {
  global.FileReader = class {
    readAsText() { this.onload({ target: { result: 'oops' } }); }
  };
  try {
    const { handlers, elements } = setup({ importFails: true });
    await handlers['import:change']();
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(elements.backupStatus.textContent, 'INVALID');
  } finally {
    delete global.FileReader;
  }
});

test('export saves the backup through saveFile and reports success', async () => {
  const saved = [];
  const handlers = {};
  const elements = {
    exportBackupBtn: { addEventListener: (type, fn) => { handlers[type] = fn; } },
    backupStatus: { textContent: '', className: '' },
  };
  const vaultStore = { getAllPieces: async () => [{}], exportBackup: async () => '{"pieces":1}' };
  createVaultBackupUI({
    document: {},
    elements,
    vaultStore,
    copy: { vaultLabels: { backupExported: 'EXPORTED' } },
    label: (key, fallback) => fallback,
    render: async () => {},
    onChange: () => {},
    saveFile: async (options) => { saved.push(options); return { method: 'native_share', cancelled: false }; },
  });
  await handlers.click();
  assert.equal(saved.length, 1);
  assert.match(saved[0].filename, /^gold-vault-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(saved[0].text, '{"pieces":1}');
  assert.equal(elements.backupStatus.textContent, 'EXPORTED');
});

test('closing the share sheet does not show a success message', async () => {
  const handlers = {};
  const elements = {
    exportBackupBtn: { addEventListener: (type, fn) => { handlers[type] = fn; } },
    backupStatus: { textContent: '', className: '' },
  };
  createVaultBackupUI({
    document: {},
    elements,
    vaultStore: { getAllPieces: async () => [{}], exportBackup: async () => '{}' },
    copy: { vaultLabels: { backupExported: 'EXPORTED' } },
    label: (key, fallback) => fallback,
    render: async () => {},
    onChange: () => {},
    saveFile: async () => ({ method: 'native_share', cancelled: true }),
  });
  await handlers.click();
  assert.equal(elements.backupStatus.textContent, '');
});
