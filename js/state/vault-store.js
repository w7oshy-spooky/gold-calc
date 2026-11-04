(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.GoldVaultStore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DB_NAME = 'gold_vault_db';
  const DB_VERSION = 1;
  const STORE_NAME = 'vault_pieces';

  function generateId() {
    return 'piece_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 9);
  }

  function createInMemoryAdapter() {
    const memory = new Map();

    return {
      async getAll() {
        return Array.from(memory.values());
      },
      async get(id) {
        return memory.get(id) || null;
      },
      async put(piece) {
        memory.set(piece.id, piece);
        return piece;
      },
      async delete(id) {
        return memory.delete(id);
      },
      async clear() {
        memory.clear();
      },
    };
  }

  function createIndexedDbAdapter(dbFactory) {
    let dbPromise = null;

    function getDb() {
      if (dbPromise) return dbPromise;
      dbPromise = new Promise((resolve, reject) => {
        const request = dbFactory.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            store.createIndex('by_category', 'category', { unique: false });
          }
        };

        request.onsuccess = (event) => resolve(event.target.result);
        request.onerror = (event) => reject(event.target.error);
      });
      return dbPromise;
    }

    return {
      async getAll() {
        const db = await getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => reject(req.error);
        });
      },
      async get(id) {
        const db = await getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readonly');
          const store = tx.objectStore(STORE_NAME);
          const req = store.get(id);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => reject(req.error);
        });
      },
      async put(piece) {
        const db = await getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.put(piece);
          req.onsuccess = () => resolve(piece);
          req.onerror = () => reject(req.error);
        });
      },
      async delete(id) {
        const db = await getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.delete(id);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      },
      async clear() {
        const db = await getDb();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite');
          const store = tx.objectStore(STORE_NAME);
          const req = store.clear();
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        });
      },
    };
  }

  function createVaultStore({
    storageAdapter = null,
    dbFactory = (typeof indexedDB !== 'undefined' ? indexedDB : null),
  } = {}) {
    const adapter = storageAdapter
      || (dbFactory ? createIndexedDbAdapter(dbFactory) : createInMemoryAdapter());

    function sanitizePiece(piece, existing = {}) {
      const nowIso = new Date().toISOString().slice(0, 10);
      const karatNum = Number(piece.karat) || 21;
      const validKarat = [18, 21, 22, 24].includes(karatNum) ? karatNum : 21;

      return {
        id: piece.id || existing.id || generateId(),
        name: typeof piece.name === 'string' && piece.name.trim() ? piece.name.trim() : (existing.name || 'قطعة ذهب'),
        karat: validKarat,
        weight: Math.max(0, Number(piece.weight) || (existing.weight || 0)),
        purchasePrice: Math.max(0, Number(piece.purchasePrice) || (existing.purchasePrice || 0)),
        purchaseDate: piece.purchaseDate || existing.purchaseDate || nowIso,
        category: piece.category === 'investment_gold' ? 'investment_gold' : 'personal_jewelry',
        hasStones: Boolean(piece.hasStones !== undefined ? piece.hasStones : existing.hasStones),
        stoneWeight: Math.max(0, Number(piece.stoneWeight) || (existing.stoneWeight || 0)),
        imageDataUrl: piece.imageDataUrl !== undefined ? piece.imageDataUrl : (existing.imageDataUrl || null),
        invoiceDataUrl: piece.invoiceDataUrl !== undefined ? piece.invoiceDataUrl : (existing.invoiceDataUrl || null),
        updatedAt: Date.now(),
      };
    }

    async function addPiece(inputPiece) {
      const sanitized = sanitizePiece(inputPiece);
      await adapter.put(sanitized);
      return sanitized;
    }

    async function updatePiece(id, patch) {
      const existing = await adapter.get(id);
      if (!existing) throw new Error(`Vault piece with id ${id} not found.`);
      const updated = sanitizePiece({ ...existing, ...patch, id });
      await adapter.put(updated);
      return updated;
    }

    async function deletePiece(id) {
      return adapter.delete(id);
    }

    async function getPiece(id) {
      return adapter.get(id);
    }

    async function getAllPieces() {
      const list = await adapter.getAll();
      return list.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    async function exportBackup() {
      const pieces = await getAllPieces();
      return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        pieces,
      }, null, 2);
    }

    async function importBackup(jsonString, { merge = true } = {}) {
      const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      const pieces = Array.isArray(parsed?.pieces) ? parsed.pieces : (Array.isArray(parsed) ? parsed : []);

      if (!merge) {
        await adapter.clear();
      }

      const imported = [];
      for (const piece of pieces) {
        const item = await addPiece(piece);
        imported.push(item);
      }
      return imported;
    }

    async function clearAll() {
      return adapter.clear();
    }

    return {
      addPiece,
      updatePiece,
      deletePiece,
      getPiece,
      getAllPieces,
      exportBackup,
      importBackup,
      clearAll,
    };
  }

  return {
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    generateId,
    createInMemoryAdapter,
    createIndexedDbAdapter,
    createVaultStore,
  };
});
