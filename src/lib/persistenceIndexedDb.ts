const DB_NAME = 'setpoint-offline-v1';
const DB_VERSION = 1;
const STORE_NAME = 'persistence_kv';

interface PersistRow {
  key: string;
  value: string;
  updatedAt: string;
}

function canUseIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
  });
  return dbPromise;
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const request = fn(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

export async function getIndexedDbValue(key: string): Promise<string | null> {
  if (!canUseIndexedDb()) return null;
  try {
    const row = await withStore<PersistRow | undefined>('readonly', (store) => store.get(key));
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setIndexedDbValue(key: string, value: string): Promise<void> {
  if (!canUseIndexedDb()) return;
  try {
    await withStore('readwrite', (store) => store.put({ key, value, updatedAt: new Date().toISOString() } satisfies PersistRow));
  } catch {
    // ignore
  }
}

export async function removeIndexedDbValue(key: string): Promise<void> {
  if (!canUseIndexedDb()) return;
  try {
    await withStore('readwrite', (store) => store.delete(key));
  } catch {
    // ignore
  }
}

export function indexedDbAvailable(): boolean {
  return canUseIndexedDb();
}
