const test = require('node:test');
const assert = require('node:assert/strict');
const vaultStoreApi = require('../js/state/vault-store.js');

test('vault store initializes with in-memory adapter and performs CRUD', async () => {
  const store = vaultStoreApi.createVaultStore();

  const piece1 = await store.addPiece({
    name: 'سوارة لازوردي',
    karat: 21,
    weight: 15.5,
    purchasePrice: 6200,
    category: 'personal_jewelry',
    hasStones: true,
    stoneWeight: 0.5,
    imageDataUrl: 'data:image/png;base64,mock',
    invoiceDataUrl: 'data:image/png;base64,mockinvoice',
    purchaseDate: '2024-05-15',
  });

  assert.ok(piece1.id);
  assert.equal(piece1.name, 'سوارة لازوردي');
  assert.equal(piece1.weight, 15.5);
  assert.equal(piece1.karat, 21);
  assert.equal(piece1.hasStones, true);
  assert.equal(piece1.imageDataUrl, 'data:image/png;base64,mock');
  assert.equal(piece1.invoiceDataUrl, 'data:image/png;base64,mockinvoice');
  assert.equal(piece1.purchaseDate, '2024-05-15');

  // Get
  const fetched = await store.getPiece(piece1.id);
  assert.deepEqual(fetched, piece1);

  // Update
  const updated = await store.updatePiece(piece1.id, { weight: 16.0, name: 'سوارة معدلة' });
  assert.equal(updated.weight, 16.0);
  assert.equal(updated.name, 'سوارة معدلة');

  // List
  const all = await store.getAllPieces();
  assert.equal(all.length, 1);
  assert.equal(all[0].name, 'سوارة معدلة');

  // Delete
  const deleted = await store.deletePiece(piece1.id);
  assert.equal(deleted, true);

  const afterDelete = await store.getAllPieces();
  assert.equal(afterDelete.length, 0);
});

test('vault store exports and imports backup cleanly', async () => {
  const store = vaultStoreApi.createVaultStore();

  await store.addPiece({ name: 'سبيكة 10 جرام', karat: 24, weight: 10, category: 'investment_gold' });
  await store.addPiece({ name: 'خاتم عيار 18', karat: 18, weight: 4.2, category: 'personal_jewelry' });

  const backupJson = await store.exportBackup();
  assert.ok(backupJson.includes('سبيكة 10 جرام'));

  const newStore = vaultStoreApi.createVaultStore();
  const imported = await newStore.importBackup(backupJson);
  assert.equal(imported.length, 2);

  const newPieces = await newStore.getAllPieces();
  assert.equal(newPieces.length, 2);
});

test('both index.html and en.html expose vault backup and restore controls symmetrically', () => {
  const fs = require('node:fs');
  const arabic = fs.readFileSync('index.html', 'utf8');
  const english = fs.readFileSync('en.html', 'utf8');

  for (const html of [arabic, english]) {
    assert.match(html, /id=["']exportVaultBackupBtn["']/);
    assert.match(html, /id=["']importVaultBackupInput["']/);
    assert.match(html, /id=["']vaultBackupStatus["']/);
  }
});
