import { loadPersistenceBlob, savePersistenceBlob } from '../persistenceStorage';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

interface MemoryStorage {
  data: Map<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function createMemoryStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
}

async function run() {
  const localStorage = createMemoryStorage();
  (globalThis as any).window = { localStorage };

  localStorage.setItem('legacy-key', JSON.stringify({ ok: true }));
  const migrated = await loadPersistenceBlob('scoped-key', 'legacy-key');
  assert(Boolean(migrated), 'legacy blob should migrate into scoped key');
  assert(localStorage.getItem('scoped-key') === migrated, 'migrated value should be available on scoped key');
  assert(localStorage.getItem('legacy-key') == null, 'legacy key should be removed after migration');

  await savePersistenceBlob('scoped-key', JSON.stringify({ updated: true }), 'legacy-key');
  assert(localStorage.getItem('scoped-key')?.includes('updated') === true, 'save should write scoped value');
}

void run();
