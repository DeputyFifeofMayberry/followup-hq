import type { Session } from '@supabase/supabase-js';

import { performSignOut } from '../auth/signOut';
import { buildLocalCacheKey } from '../persistence';
import { buildOutboxKey } from '../persistenceOutbox';
import { getSessionScopedId, setPersistenceScopeUserId } from '../persistenceIdentity';
import { useAppStore } from '../../store/useAppStore';
import { supabase } from '../supabase';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

interface MemoryStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
}

function createMemoryStorage(): MemoryStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
    clear: () => data.clear(),
  };
}

const localStorage = createMemoryStorage();
const sessionStorage = createMemoryStorage();
(globalThis as any).window = { localStorage, sessionStorage };

const session = { user: { id: 'user-a', email: 'user-a@example.com' } } as Session;
const mock = { failSignOut: false };

(supabase.auth as any).signOut = async () => {
  if (mock.failSignOut) return { error: { message: 'network issue' } };
  return { error: null };
};

function reset() {
  localStorage.clear();
  sessionStorage.clear();
  mock.failSignOut = false;
  useAppStore.setState({ ...useAppStore.getState(), hydrated: true, selectedId: 'item-1', itemModal: { open: true, mode: 'edit', itemId: 'item-1' } });
}

async function testCleanLogoutClearsScopedPersistence() {
  reset();
  setPersistenceScopeUserId('user-a');
  localStorage.setItem(buildLocalCacheKey('user-a'), JSON.stringify({ entities: { items: [{ id: 'item-1' }], tasks: [], projects: [], contacts: [], companies: [], auxiliary: {} }, updatedAt: 'x', cloudStatus: 'pending' }));
  localStorage.setItem(buildOutboxKey('user-a'), JSON.stringify({ entries: [{ outboxEntryId: '1', status: 'queued' }], updatedAt: 'x' }));

  const beforeSessionId = getSessionScopedId();
  await performSignOut({ session, localPolicy: 'clear-scoped-persistence' });

  assert(localStorage.getItem(buildLocalCacheKey('user-a')) === null, 'clean logout should clear scoped local cache for that user');
  assert(localStorage.getItem(buildOutboxKey('user-a')) === null, 'clean logout should clear scoped outbox for that user');
  assert(getSessionScopedId() !== beforeSessionId, 'logout should rotate session-scoped identity id');
  assert(useAppStore.getState().itemModal.open === false, 'logout should reset store state');
}

async function testLogoutKeepsProtectedRecoveryWhenRequested() {
  reset();
  setPersistenceScopeUserId('user-a');
  localStorage.setItem(buildLocalCacheKey('user-a'), JSON.stringify({ entities: { items: [{ id: 'item-1' }], tasks: [], projects: [], contacts: [], companies: [], auxiliary: {} }, updatedAt: 'x', cloudStatus: 'pending' }));

  await performSignOut({ session, localPolicy: 'keep-protected-recovery' });

  assert(localStorage.getItem(buildLocalCacheKey('user-a')) !== null, 'keep-recovery logout should preserve scoped local cache');
}

async function testSignOutFailurePreservesState() {
  reset();
  mock.failSignOut = true;

  let failed = false;
  try {
    await performSignOut({ session, localPolicy: 'clear-scoped-persistence' });
  } catch {
    failed = true;
  }

  assert(failed, 'performSignOut should throw when Supabase signOut fails');
  assert(useAppStore.getState().itemModal.open === true, 'failed sign out should preserve in-memory state');
}

(async function run() {
  await testCleanLogoutClearsScopedPersistence();
  await testLogoutKeepsProtectedRecoveryWhenRequested();
  await testSignOutFailurePreservesState();
})();
