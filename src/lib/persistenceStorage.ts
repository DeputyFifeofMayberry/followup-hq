import { getIndexedDbValue, indexedDbAvailable, removeIndexedDbValue, setIndexedDbValue } from './persistenceIndexedDb';

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

async function readLegacyAndMigrate(scopedKey: string, legacyKey: string): Promise<string | null> {
  if (!canUseLocalStorage()) return null;
  const scopedRaw = window.localStorage.getItem(scopedKey);
  if (scopedRaw) return scopedRaw;
  const legacyRaw = window.localStorage.getItem(legacyKey);
  if (!legacyRaw) return null;
  window.localStorage.setItem(scopedKey, legacyRaw);
  window.localStorage.removeItem(legacyKey);
  return legacyRaw;
}

export async function loadPersistenceBlob(scopedKey: string, legacyKey: string): Promise<string | null> {
  if (indexedDbAvailable()) {
    const indexed = await getIndexedDbValue(scopedKey);
    if (indexed) return indexed;
    const migrated = await readLegacyAndMigrate(scopedKey, legacyKey);
    if (migrated) {
      await setIndexedDbValue(scopedKey, migrated);
      return migrated;
    }
    return null;
  }
  if (!canUseLocalStorage()) return null;
  return readLegacyAndMigrate(scopedKey, legacyKey);
}

export async function savePersistenceBlob(scopedKey: string, value: string, legacyKey?: string): Promise<void> {
  if (indexedDbAvailable()) {
    await setIndexedDbValue(scopedKey, value);
  }
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(scopedKey, value);
  if (legacyKey) window.localStorage.removeItem(legacyKey);
}

export async function clearPersistenceBlob(scopedKey: string): Promise<void> {
  if (indexedDbAvailable()) {
    await removeIndexedDbValue(scopedKey);
  }
  if (canUseLocalStorage()) {
    window.localStorage.removeItem(scopedKey);
  }
}
