import { buildLocalCacheKey, buildLegacyLocalCacheKey, loadPersistedPayload, savePersistedPayload, type PersistedPayload } from '../persistence';
import { buildOutboxKey } from '../persistenceOutbox';
import { setPersistenceScopeUserId } from '../persistenceIdentity';
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

const payloadFixture: PersistedPayload = {
  items: [{ id: 'item-a' } as any],
  tasks: [],
  projects: [],
  contacts: [],
  companies: [],
  auxiliary: {
    intakeSignals: [], intakeDocuments: [], dismissedDuplicatePairs: [], droppedEmailImports: [],
    outlookConnection: { settings: {} as any, mailboxLinked: false, syncStatus: 'idle', syncCursorByFolder: { inbox: {}, sentitems: {} } },
    outlookMessages: [], forwardedEmails: [], forwardedRules: [], forwardedCandidates: [], forwardedLedger: [], forwardedRoutingAudit: [],
    intakeCandidates: [], intakeAssets: [], intakeBatches: [], intakeWorkCandidates: [], intakeReviewerFeedback: [], savedExecutionViews: [],
    followUpFilters: undefined, followUpColumns: undefined, savedFollowUpViews: [],
  },
};

const mock = {
  sessionUserId: null as string | null,
};

(supabase.auth as any).getSession = async () => ({
  data: { session: mock.sessionUserId ? { user: { id: mock.sessionUserId } } : null },
  error: null,
});

(supabase as any).from = (_table: string) => ({
  select: (_columns: string) => ({
    eq: () => {
      const result = { data: [], error: null };
      return {
        maybeSingle: async () => ({ data: null, error: null }),
        limit: async () => result,
        then: (resolve: any) => Promise.resolve(resolve(result)),
      };
    },
  }),
});

function reset() {
  localStorage.clear();
  sessionStorage.clear();
  setPersistenceScopeUserId(null);
  mock.sessionUserId = null;
}

async function testKeyScopingAndSignedOutIsolation() {
  reset();
  assert(buildLocalCacheKey('user-a') !== buildLocalCacheKey('user-b'), 'local cache keys must be scoped per user');
  assert(buildOutboxKey('user-a') !== buildOutboxKey('user-b'), 'outbox keys must be scoped per user');

  localStorage.setItem(buildLocalCacheKey('user-a'), JSON.stringify({
    entities: payloadFixture,
    updatedAt: '2026-04-06T10:00:00.000Z',
    cloudStatus: 'confirmed',
    userId: 'user-a',
  }));

  const signedOutLoad = await loadPersistedPayload();
  assert(signedOutLoad.payload.items.length === 0, 'signed-out load must not hydrate authenticated user cache');
}

async function testLegacyMigratesOnceWithoutOverwritingScoped() {
  reset();
  mock.sessionUserId = 'user-a';
  setPersistenceScopeUserId('user-a');

  localStorage.setItem(buildLegacyLocalCacheKey(), JSON.stringify({
    entities: payloadFixture,
    updatedAt: '2026-04-06T09:00:00.000Z',
    cloudStatus: 'pending',
  }));

  await savePersistedPayload(payloadFixture);
  const migrated = JSON.parse(localStorage.getItem(buildLocalCacheKey('user-a')) ?? '{}');
  assert(migrated.entities?.items?.[0]?.id === 'item-a', 'legacy local cache should migrate into scoped key once');
  assert(localStorage.getItem(buildLegacyLocalCacheKey()) === null, 'legacy key should be removed after successful migration');

  const scopedNewer = {
    entities: { ...payloadFixture, items: [{ id: 'scoped-newer' } as any] },
    updatedAt: '2026-04-06T12:00:00.000Z',
    cloudStatus: 'confirmed',
    userId: 'user-a',
  };
  localStorage.setItem(buildLocalCacheKey('user-a'), JSON.stringify(scopedNewer));
  localStorage.setItem(buildLegacyLocalCacheKey(), JSON.stringify({
    entities: payloadFixture,
    updatedAt: '2026-04-05T01:00:00.000Z',
    cloudStatus: 'pending',
  }));

  await savePersistedPayload(scopedNewer.entities);
  const after = JSON.parse(localStorage.getItem(buildLocalCacheKey('user-a')) ?? '{}');
  assert(after.entities?.items?.[0]?.id === 'scoped-newer', 'existing scoped cache must not be overwritten by legacy data');
}

async function testCrossUserSafety() {
  reset();
  localStorage.setItem(buildLocalCacheKey('user-a'), JSON.stringify({
    entities: payloadFixture,
    updatedAt: '2026-04-06T10:00:00.000Z',
    cloudStatus: 'confirmed',
    userId: 'user-a',
  }));

  mock.sessionUserId = 'user-b';
  setPersistenceScopeUserId('user-b');
  const loadedForUserB = await loadPersistedPayload();
  assert(loadedForUserB.payload.items.length === 0, 'user B must never hydrate user A scoped recovery data');
}

(async function run() {
  await testKeyScopingAndSignedOutIsolation();
  await testLegacyMigratesOnceWithoutOverwritingScoped();
  await testCrossUserSafety();
})();
