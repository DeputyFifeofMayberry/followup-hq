import { loadPersistedPayload, savePersistedPayload, type PersistedPayload } from '../persistence';
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
  sessionFailureMessage: 'session failed',
  failReadTable: '' as string,
  readFailureMessage: 'read failed',
  failSaveTable: '' as string,
  auxiliaryUpdatedAt: undefined as string | undefined,
  rows: { follow_up_items: [] as any[], tasks: [] as any[], projects: [] as any[], contacts: [] as any[], companies: [] as any[] },
  auxiliary: null as PersistedPayload['auxiliary'] | null,
};

(supabase.auth as any).getSession = async () => {
  if (mock.failSessionLookup) throw new Error(mock.sessionFailureMessage);
  return { data: { session: mock.sessionUserId ? { user: { id: mock.sessionUserId } } : null }, error: null };
};
(supabase as any).from = (table: string) => ({
  select: (columns: string) => ({
    eq: () => ({
      maybeSingle: async () => {
        if (mock.failReadTable === table) {
          return { data: null, error: new Error(mock.readFailureMessage) };
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
        if (mock.failReadTable === table && columns === 'record') return Promise.resolve(resolve({ data: null, error: new Error(mock.readFailureMessage) }));
        if (columns === 'record') return Promise.resolve(resolve({ data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((record: any) => ({ record })), error: null }));
        if (columns === 'record_id') return Promise.resolve(resolve({ data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((record: any) => ({ record_id: record.id })), error: null }));
        return Promise.resolve(resolve({ data: null, error: null }));
      },
    }),
  }),
  upsert: async (value: any) => {
    if (mock.failSaveTable === table) return { error: new Error(`save failed:${table}`) };
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
  mock.sessionFailureMessage = 'session failed';
  mock.failReadTable = '';
  mock.readFailureMessage = 'read failed';
  mock.failSaveTable = '';
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
  mock.sessionFailureMessage = 'JWT expired';
  let loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'should load from local cache fallback');
  assert(loaded.loadFailureStage === 'auth_session', 'auth session failure should report auth_session stage');
  assert(loaded.loadFailureMessage === 'JWT expired', 'auth session failure should include source message');
  assert(loaded.loadFailureRecoveredWithLocalCache === true, 'auth session failure should report cache recovery');

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
  mock.readFailureMessage = 'relation \"user_preferences\" does not exist';
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'user preferences read failure should restore local cache');
  assert(loaded.loadFailureStage === 'user_preferences', 'user preferences read failure should report stage');
  assert(loaded.loadFailureMessage === 'relation \"user_preferences\" does not exist', 'user preferences read failure should include DB error');

  reset();
  mock.failReadTable = 'follow_up_items';
  let threwNoCacheLoadFailure = false;
  try {
    await loadPersistedPayload();
  } catch {
    threwNoCacheLoadFailure = true;
  }
  assert(threwNoCacheLoadFailure, 'hard cloud read failure without local cache should throw');

  reset();
  mock.failSaveTable = 'tasks';
  let rejectedAgain = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch {
    rejectedAgain = true;
  }
  assert(rejectedAgain, 'expected save to reject');
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

}

void run();
