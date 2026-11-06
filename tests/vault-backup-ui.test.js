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
