import { loadPersistedPayload, PersistenceLoadError, savePersistedPayload, type PersistedPayload } from '../persistence';
import { supabase } from '../supabase';

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

const storage = createMemoryStorage();
(globalThis as any).window = { localStorage: storage };

const payloadFixture: PersistedPayload = {
  items: [{ id: 'item-1' } as any],
  tasks: [{ id: 'task-1' } as any],
  projects: [{ id: 'project-1' } as any],
  contacts: [{ id: 'contact-1' } as any],
  companies: [{ id: 'company-1' } as any],
  auxiliary: {
    intakeSignals: [], intakeDocuments: [], dismissedDuplicatePairs: [], droppedEmailImports: [],
    outlookConnection: { settings: {} as any, mailboxLinked: false, syncStatus: 'idle', syncCursorByFolder: { inbox: {}, sentitems: {} } },
    outlookMessages: [], forwardedEmails: [], forwardedRules: [], forwardedCandidates: [], forwardedLedger: [], forwardedRoutingAudit: [],
    intakeCandidates: [], intakeAssets: [], intakeBatches: [], intakeWorkCandidates: [], intakeReviewerFeedback: [], savedExecutionViews: [],
    followUpFilters: undefined, followUpColumns: undefined, savedFollowUpViews: [],
  },
};

const mock = {
  sessionUserId: 'user-1' as string | null,
  failSessionLookup: false,
  sessionFailure: new Error('session failed') as unknown,
  failReadTable: '' as string,
  readFailure: new Error('read failed') as unknown,
  failSaveTable: '' as string,
  saveFailure: new Error('save failed') as unknown,
  auxiliaryUpdatedAt: undefined as string | undefined,
  rows: { follow_up_items: [] as any[], tasks: [] as any[], projects: [] as any[], contacts: [] as any[], companies: [] as any[] },
  auxiliary: null as PersistedPayload['auxiliary'] | null,
};

(supabase.auth as any).getSession = async () => {
  if (mock.failSessionLookup) throw mock.sessionFailure;
  return { data: { session: mock.sessionUserId ? { user: { id: mock.sessionUserId } } : null }, error: null };
};
(supabase as any).from = (table: string) => ({
  select: (columns: string) => ({
    eq: () => ({
      maybeSingle: async () => {
        if (mock.failReadTable === table) {
          return { data: null, error: mock.readFailure };
        }
        if (table === 'user_preferences' && columns === 'auxiliary, updated_at') {
          return { data: mock.auxiliary ? { auxiliary: mock.auxiliary, updated_at: mock.auxiliaryUpdatedAt } : null, error: null };
        }
        if (table === 'user_preferences' && columns === 'migration_complete, auxiliary') {
          return { data: { migration_complete: true, auxiliary: mock.auxiliary }, error: null };
        }
        return { data: null, error: null };
      },
      then: (resolve: any) => {
        if (mock.failReadTable === table && columns === 'record') return Promise.resolve(resolve({ data: null, error: mock.readFailure }));
        if (columns === 'record') return Promise.resolve(resolve({ data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((record: any) => ({ record })), error: null }));
        if (columns === 'record_id') return Promise.resolve(resolve({ data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((record: any) => ({ record_id: record.id })), error: null }));
        return Promise.resolve(resolve({ data: null, error: null }));
      },
    }),
  }),
  upsert: async (value: any) => {
    if (mock.failSaveTable === table) return { error: mock.saveFailure };
    if (table === 'user_preferences') {
      mock.auxiliary = value.auxiliary;
      mock.auxiliaryUpdatedAt = value.updated_at;
      return { error: null };
    }
    mock.rows[table as keyof typeof mock.rows] = value.map((entry: any) => entry.record);
    return { error: null };
  },
  delete: () => ({ eq: () => ({ in: async (_: string, ids: string[]) => {
    mock.rows[table as keyof typeof mock.rows] = (mock.rows[table as keyof typeof mock.rows] ?? []).filter((entry: any) => !ids.includes(entry.id));
    return { error: null };
  } }) }),
});

function reset() {
  storage.clear();
  mock.sessionUserId = 'user-1';
  mock.failSessionLookup = false;
  mock.sessionFailure = new Error('session failed');
  mock.failReadTable = '';
  mock.readFailure = new Error('read failed');
  mock.failSaveTable = '';
  mock.saveFailure = new Error('save failed');
  mock.auxiliaryUpdatedAt = undefined;
  mock.auxiliary = null;
  mock.rows = { follow_up_items: [], tasks: [], projects: [], contacts: [], companies: [] };
}

async function run() {
  reset();
  mock.failSaveTable = 'tasks';
  let rejected = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch {
    rejected = true;
  }
  assert(rejected, 'expected save to reject');
  let cache = JSON.parse(storage.getItem('followup_hq_entities_cache_v2') ?? '{}');
  assert(cache.cloudStatus === 'pending', 'cache should stay pending after failed cloud save');

  reset();
  const successful = await savePersistedPayload(payloadFixture);
  assert(successful.diagnostics?.completedTables.includes('user_preferences') === true, 'successful save should report completed tables');
  cache = JSON.parse(storage.getItem('followup_hq_entities_cache_v2') ?? '{}');
  assert(cache.cloudStatus === 'confirmed', 'cache should be confirmed after successful cloud save');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T10:00:00.000Z', cloudStatus: 'pending' }));
  mock.failSessionLookup = true;
  mock.sessionFailure = new Error('JWT expired');
  let loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'should load from local cache fallback');
  assert(loaded.loadFailureStage === 'auth_session', 'auth session failure should report auth_session stage');
  assert(loaded.loadFailureMessage === 'JWT expired', 'auth session failure should include source message');
  assert(loaded.loadFailureRecoveredWithLocalCache === true, 'auth session failure should report cache recovery');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T10:01:00.000Z', cloudStatus: 'pending' }));
  mock.failSessionLookup = true;
  mock.sessionFailure = {
    message: 'Auth session missing',
    code: '401',
    details: 'No active session token found',
    status: 401,
  };
  loaded = await loadPersistedPayload();
  assert(loaded.loadFailureStage === 'auth_session', 'auth object failure should report auth stage');
  assert((loaded.loadFailureMessage ?? '').includes('Auth session missing'), 'auth object failure should include readable message');
  assert((loaded.loadFailureMessage ?? '').includes('status: 401'), 'auth object failure should include status');
  assert(!(loaded.loadFailureMessage ?? '').includes('[object Object]'), 'auth object failure should never stringify as object object');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T11:00:00.000Z', cloudStatus: 'pending' }));
  mock.rows.follow_up_items = [{ id: 'item-cloud' } as any];
  mock.auxiliary = payloadFixture.auxiliary;
  mock.auxiliaryUpdatedAt = '2026-04-05T09:00:00.000Z';
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'should load from local cache fallback');
  assert(loaded.localNewerThanCloud === true, 'newer local cache should win over older cloud payload');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T12:00:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'user_preferences';
  mock.readFailure = new Error('relation \"user_preferences\" does not exist');
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'user preferences read failure should restore local cache');
  assert(loaded.loadFailureStage === 'user_preferences', 'user preferences read failure should report stage');
  assert(loaded.loadFailureMessage === 'relation \"user_preferences\" does not exist', 'user preferences read failure should include DB error');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T12:30:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = {
    message: 'permission denied for table follow_up_items',
    code: '42501',
    details: 'new row violates row-level security policy',
    hint: 'check RLS policy',
    status: 403,
  };
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'cloud read object failure should restore local cache');
  assert(loaded.loadFailureStage === 'follow_up_items', 'cloud read object failure should preserve table stage');
  assert(loaded.loadFailureRecoveredWithLocalCache === true, 'cloud read object failure should mark local recovery');
  assert((loaded.loadFailureMessage ?? '').includes('permission denied for table follow_up_items'), 'cloud read object failure should include message');
  assert((loaded.loadFailureMessage ?? '').includes('code: 42501'), 'cloud read object failure should include error code');
  assert((loaded.loadFailureMessage ?? '').includes('status: 403'), 'cloud read object failure should include status');
  assert(!(loaded.loadFailureMessage ?? '').includes('[object Object]'), 'cloud read object failure should avoid object-object text');

  reset();
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = {
    message: 'permission denied for table follow_up_items',
    code: '42501',
    details: 'RLS denied',
    status: 403,
  };
  let threwNoCacheLoadFailure = false;
  try {
    await loadPersistedPayload();
  } catch (error) {
    threwNoCacheLoadFailure = true;
    assert(error instanceof PersistenceLoadError, 'hard cloud read failure should throw PersistenceLoadError');
    assert(error.stage === 'follow_up_items', 'hard cloud read failure should preserve stage');
    assert(error.message.includes('permission denied for table follow_up_items'), 'hard cloud read failure should expose readable details');
    assert(!error.message.includes('[object Object]'), 'hard cloud read failure should never include object-object');
  }
  assert(threwNoCacheLoadFailure, 'hard cloud read failure without local cache should throw');

  reset();
  mock.failSaveTable = 'tasks';
  mock.saveFailure = {
    message: 'permission denied',
    code: '42501',
    status: 403,
  };
  let rejectedAgain = false;
  let rejectedMessage = '';
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error) {
    rejectedAgain = true;
    rejectedMessage = error instanceof Error ? error.message : String(error);
  }
  assert(rejectedAgain, 'expected save to reject');
  assert(rejectedMessage.includes('permission denied'), 'save object failure should include readable message');
  assert(rejectedMessage.includes('code: 42501'), 'save object failure should include error code');
  assert(!rejectedMessage.includes('[object Object]'), 'save object failure should avoid object-object message');
  mock.failSaveTable = '';
  mock.failReadTable = 'follow_up_items';
  loaded = await loadPersistedPayload();
  assert(loaded.payload.items[0].id === 'item-1', 'local payload should survive failed cloud save and refresh');

  reset();
  mock.rows.tasks = Array.from({ length: 250 }, (_, index) => ({ id: `task-${index}` } as any));
  let staleGuardThrown = false;
  try {
    await savePersistedPayload({ ...payloadFixture, tasks: [] });
  } catch (error) {
    staleGuardThrown = error instanceof Error && error.message.includes('Delete safety guard triggered');
  }
  assert(staleGuardThrown, 'stale delete safety guard should reject large delete waves');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T13:00:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = { foo: 'bar', nested: { a: 1 } };
  loaded = await loadPersistedPayload();
  assert((loaded.loadFailureMessage ?? '').length > 0, 'weird object should still produce message');
  assert(!(loaded.loadFailureMessage ?? '').includes('[object Object]'), 'weird object should not produce object-object');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T13:30:00.000Z', cloudStatus: 'pending' }));
  const circular: Record<string, unknown> = { kind: 'circular' };
  circular.self = circular;
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = circular;
  loaded = await loadPersistedPayload();
  assert((loaded.loadFailureMessage ?? '').includes('Circular') || (loaded.loadFailureMessage ?? '').length > 0, 'circular object fallback should serialize safely');
  assert(!(loaded.loadFailureMessage ?? '').includes('[object Object]'), 'circular object should avoid object-object');

}

void run();
