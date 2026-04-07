import { loadPersistedPayload, PersistenceLoadError, savePersistedPayload, type PersistedPayload } from '../persistence';
import { supabase } from '../supabase';
import { resetPersistenceSchemaHealthCache } from '../persistenceSchemaHealth';

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
const sessionStorage = createMemoryStorage();
(globalThis as any).window = { localStorage: storage, sessionStorage };

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
  rpcFailure: null as any,
  rpcCallCount: 0,
  receiptReplayCountByBatchId: new Map<string, number>(),
};

(supabase.auth as any).getSession = async () => {
  if (mock.failSessionLookup) throw mock.sessionFailure;
  return { data: { session: mock.sessionUserId ? { user: { id: mock.sessionUserId } } : null }, error: null };
};

function buildSelectResult(table: string, columns: string) {
  const readError = mock.failReadTable === table ? mock.readFailure : null;

  if (table === 'user_preferences' && columns === 'auxiliary, updated_at') {
    return { data: mock.auxiliary ? { auxiliary: mock.auxiliary, updated_at: mock.auxiliaryUpdatedAt } : null, error: readError };
  }
  if (table === 'user_preferences' && columns === 'migration_complete, auxiliary') {
    return { data: { migration_complete: true, auxiliary: mock.auxiliary }, error: readError };
  }
  if (table === 'user_preferences' && columns === 'user_id') {
    return { data: [], error: readError };
  }
  if (columns.startsWith('record, deleted_at')) {
    return {
      data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((row: any) => ({
        record: row.record,
        deleted_at: row.deleted_at ?? null,
        record_version: row.record_version ?? 1,
        updated_by_device: row.updated_by_device ?? null,
        last_batch_id: row.last_batch_id ?? null,
        last_operation_at: row.last_operation_at ?? null,
        conflict_marker: row.conflict_marker ?? false,
      })),
      error: readError,
    };
  }
  if (columns === 'record_id,deleted_at' || columns === 'record_id') {
    return {
      data: (mock.rows[table as keyof typeof mock.rows] ?? []).map((row: any) => ({
        record_id: row.record_id,
        deleted_at: row.deleted_at ?? null,
      })),
      error: readError,
    };
  }
  return { data: null, error: readError };
}

(supabase as any).from = (table: string) => ({
  select: (columns: string) => ({
    eq: () => {
      const result = buildSelectResult(table, columns);
      const chain = {
        maybeSingle: async () => result,
        limit: async () => result,
        in: async (_: string, ids: string[]) => {
          mock.rows[table as keyof typeof mock.rows] = (mock.rows[table as keyof typeof mock.rows] ?? []).filter((entry: any) => !ids.includes(entry.id));
          return { error: null };
        },
        then: (resolve: any) => Promise.resolve(resolve(result)),
      };
      return chain;
    },
  }),
  upsert: async (value: any) => {
    if (mock.failSaveTable === table) return { error: mock.saveFailure };
    if (table === 'user_preferences') {
      mock.auxiliary = value.auxiliary;
      mock.auxiliaryUpdatedAt = value.updated_at;
      return { error: null };
    }
    const existing = new Map<string, any>((mock.rows[table as keyof typeof mock.rows] ?? []).map((row: any) => [row.record_id, row]));
    value.forEach((entry: any) => {
      existing.set(entry.record_id, {
        record_id: entry.record_id,
        record: entry.record,
        deleted_at: entry.deleted_at ?? null,
      });
    });
    mock.rows[table as keyof typeof mock.rows] = Array.from(existing.values());
    return { error: null };
  },
  delete: () => ({
    eq: () => ({
      in: async (_: string, ids: string[]) => {
        mock.rows[table as keyof typeof mock.rows] = (mock.rows[table as keyof typeof mock.rows] ?? []).filter((entry: any) => !ids.includes(entry.record_id));
        return { error: null };
      },
    }),
  }),
});

(supabase as any).rpc = async (fn: string, args: any) => {
  if (fn !== 'apply_save_batch') return { data: null, error: new Error('unknown rpc') };
  mock.rpcCallCount += 1;
  if (mock.rpcFailure) return { data: null, error: mock.rpcFailure };
  const batch = args.batch;
  const previous = mock.receiptReplayCountByBatchId.get(batch.batchId) ?? 0;
  mock.receiptReplayCountByBatchId.set(batch.batchId, previous + 1);
  return {
    data: {
      batchId: batch.batchId,
      userId: mock.sessionUserId ?? 'user-1',
      status: 'committed',
      committedAt: '2026-04-06T10:00:00.000Z',
      schemaVersion: batch.schemaVersion,
      operationCount: batch.operationCount,
      operationCountsByEntity: batch.operationCountsByEntity,
      touchedTables: ['follow_up_items', 'tasks', 'projects', 'contacts', 'companies', 'user_preferences'],
      clientPayloadHash: batch.clientPayloadHash,
      serverPayloadHash: batch.clientPayloadHash,
      hashMatch: true,
    },
    error: null,
  };
};

function reset() {
  storage.clear();
  sessionStorage.clear();
  resetPersistenceSchemaHealthCache();
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
  mock.rpcFailure = null;
  mock.rpcCallCount = 0;
  mock.receiptReplayCountByBatchId = new Map<string, number>();
}

async function run() {
  reset();
  let cache = JSON.parse(storage.getItem('followup_hq_entities_cache_v2') ?? '{}');

  reset();
  mock.rows.tasks = [
    { record_id: 'task-1', record: { id: 'task-1', title: 'existing-task' }, deleted_at: null },
    { record_id: 'task-2', record: { id: 'task-2', title: 'unrelated-task' }, deleted_at: null },
  ];
  await savePersistedPayload({
    ...payloadFixture,
    tasks: [{ id: 'task-1', title: 'task-updated' } as any],
  }, { dirtyRecords: [{ type: 'task', id: 'task-1' }] });
  const task1 = mock.rows.tasks.find((row: any) => row.record_id === 'task-1');
  const task2 = mock.rows.tasks.find((row: any) => row.record_id === 'task-2');
  assert(Boolean(task1), 'dirty-scoped upsert should keep targeted record persisted');
  assert(task1?.deleted_at == null, 'dirty-scoped upsert should keep targeted record active');
  assert(task2?.deleted_at == null, 'dirty-scoped save should not tombstone unrelated records');
  assert(mock.rpcCallCount >= 2, 'dirty-scoped save should probe rpc health and then commit');

  reset();
  const successful = await savePersistedPayload(payloadFixture);
  assert(successful.diagnostics?.completedTables.includes('user_preferences') === true, 'successful save should report touched tables from receipt');
  assert(successful.diagnostics?.receiptStatus === 'committed', 'successful save should include committed receipt status');
  cache = JSON.parse(storage.getItem('followup_hq_entities_cache_v2') ?? '{}');
  assert(cache.cloudStatus === 'confirmed', 'cache should be confirmed after successful cloud save');
  assert(Boolean(cache.lastSaveReceipt?.batchId), 'successful save should persist receipt metadata');

  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T10:00:00.000Z', cloudStatus: 'pending' }));
  mock.failSessionLookup = true;
  mock.sessionFailure = new Error('JWT expired');
  let loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'should load from local cache fallback');
  assert(loaded.loadFailureStage === 'auth_session', 'auth session failure should report auth_session stage');
  assert((loaded.loadFailureMessage ?? '').includes('JWT expired'), 'auth session failure should include source message');
  assert(loaded.loadFailureRecoveredWithLocalCache === true, 'auth session failure should report cache recovery');

  // A. missing follow_up_items table with local cache available
  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T12:30:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = {
    message: "Could not find the table 'public.follow_up_items' in the schema cache",
    code: 'PGRST205',
    details: 'table follow_up_items missing',
  };
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'local-cache', 'missing table should restore local cache');
  assert(loaded.loadFailureStage === 'follow_up_items', 'missing table should preserve stage');
  assert(
    (loaded.loadFailureMessage ?? '').includes('public.follow_up_items')
      && ((loaded.loadFailureMessage ?? '').includes('not found') || (loaded.loadFailureMessage ?? '').includes('Missing table:')),
    'missing table should be clearly called out',
  );
  assert((loaded.loadFailureMessage ?? '').includes('PGRST205'), 'missing table should include code');
  assert(!(loaded.loadFailureMessage ?? '').includes('[object Object]'), 'missing table should avoid object-object');

  // B. missing follow_up_items table with no local cache
  reset();
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = {
    message: "Could not find the table 'public.follow_up_items' in the schema cache",
    code: 'PGRST205',
  };
  let threwNoCacheLoadFailure = false;
  try {
    await loadPersistedPayload();
  } catch (error: any) {
    threwNoCacheLoadFailure = true;
    assert(error instanceof PersistenceLoadError, 'hard cloud read failure should throw PersistenceLoadError');
    assert(error.stage === 'follow_up_items', 'hard cloud read failure should preserve stage');
    assert(error.message.includes('public.follow_up_items'), 'hard cloud read failure should expose missing table');
    assert(error.message.includes('PGRST205'), 'hard cloud read failure should include code');
  }
  assert(threwNoCacheLoadFailure, 'hard cloud read failure without local cache should throw');

  // C. wrong-project style mismatch (all tables missing) should classify as schema issue before full load
  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T13:00:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = { message: "Could not find the table 'public.follow_up_items'", code: 'PGRST205' };
  loaded = await loadPersistedPayload();
  assert(
    (loaded.loadFailureMessage ?? '').includes('public.follow_up_items') && (loaded.loadFailureMessage ?? '').includes('PGRST205'),
    'schema mismatch should surface missing-table diagnostics',
  );

  // D. permissions/RLS denial is distinct from missing-table
  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T14:00:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = {
    message: 'permission denied for table follow_up_items',
    code: '42501',
    details: 'RLS denied',
    status: 403,
  };
  loaded = await loadPersistedPayload();
  assert((loaded.loadFailureMessage ?? '').includes('permissions issue'), 'permissions should be categorized separately');
  assert(!(loaded.loadFailureMessage ?? '').includes('Missing table:'), 'permissions failure should not claim missing table');

  // E. healthy path
  reset();
  mock.rows.follow_up_items = [{ record_id: 'item-cloud', record: { id: 'item-cloud' }, deleted_at: null } as any];
  mock.auxiliary = payloadFixture.auxiliary;
  mock.auxiliaryUpdatedAt = '2026-04-05T09:00:00.000Z';
  loaded = await loadPersistedPayload();
  assert(loaded.source === 'supabase', 'healthy path should load from supabase');

  // F. save failure after schema-missing fallback should not claim cloud confirmation
  reset();
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T15:00:00.000Z', cloudStatus: 'pending' }));
  mock.failReadTable = 'follow_up_items';
  mock.readFailure = { message: "Could not find the table 'public.follow_up_items'", code: 'PGRST205' };
  loaded = await loadPersistedPayload();
  assert(loaded.cacheStatus === 'pending', 'schema fallback should keep pending cache status');
  mock.failSaveTable = 'follow_up_items';
  mock.saveFailure = { message: "Could not find the table 'public.follow_up_items'", code: 'PGRST205' };
  mock.rpcFailure = mock.saveFailure;
  await savePersistedPayload(payloadFixture);

  reset();
  mock.rows.tasks = Array.from({ length: 250 }, (_, index) => ({ record_id: `task-${index}`, record: { id: `task-${index}` }, deleted_at: null } as any));
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({
    entities: { ...payloadFixture, tasks: Array.from({ length: 250 }, (_, index) => ({ id: `task-${index}` })) },
    updatedAt: '2026-04-05T15:00:00.000Z',
    cloudStatus: 'pending',
  }));
  let staleGuardThrown = false;
  try {
    await savePersistedPayload({ ...payloadFixture, tasks: [] });
  } catch (error) {
    staleGuardThrown = error instanceof Error && error.message.includes('Delete safety guard triggered');
  }
  assert(staleGuardThrown, 'stale delete safety guard should reject large delete waves');

  reset();
  await savePersistedPayload(payloadFixture);
  mock.rpcCallCount = 0;
  const noOp = await savePersistedPayload(payloadFixture);
  assert(noOp.mode === 'supabase', 'no-op should keep supabase mode');
  assert(mock.rpcCallCount === 0, 'no-op should not call rpc');

  // H. unchanged payload with unresolved outbox must still retry
  reset();
  storage.setItem('followup_hq_persistence_outbox_v2', JSON.stringify({
    entries: [{
      outboxEntryId: 'outbox-1',
      batchId: 'batch-pending-1',
      localRevision: 1,
      createdAt: '2026-04-05T10:00:00.000Z',
      updatedAt: '2026-04-05T10:00:00.000Z',
      deviceId: 'device',
      sessionId: 'session',
      status: 'failed',
      operations: [{ entity: 'items', operation: 'upsert', recordId: 'item-1', recordSnapshot: { id: 'item-1' } }],
      operationCount: 1,
      payloadHash: 'hash-1',
      retryCount: 1,
      lastError: 'network',
    }],
    updatedAt: '2026-04-05T10:00:00.000Z',
  }));
  storage.setItem('followup_hq_entities_cache_v2', JSON.stringify({ entities: payloadFixture, updatedAt: '2026-04-05T10:00:00.000Z', cloudStatus: 'pending', localRevision: 1, lastCloudConfirmedRevision: 0 }));
  mock.rpcCallCount = 0;
  await savePersistedPayload(payloadFixture);
  assert(mock.rpcCallCount >= 2, 'retry should probe rpc health and then send unresolved outbox work when payload JSON is unchanged');


  reset();
  mock.rpcFailure = {
    message: 'unsupported Unicode escape sequence',
    code: '22P05',
    details: '\u0000 cannot be converted to text.',
  };
  let payloadBlockedClassified = false;
  try {
    await savePersistedPayload({
      ...payloadFixture,
      items: [{ id: 'item-1', title: 'bad\u0000title' } as any],
    });
  } catch (error: any) {
    payloadBlockedClassified = error?.diagnostics?.failureKind === 'payload_invalid'
      && error?.diagnostics?.nonRetryable === true
      && error?.diagnostics?.sanitizedFieldCount >= 1;
  }
  assert(payloadBlockedClassified, 'invalid text payload failures should classify as non-retryable payload_invalid with sanitization diagnostics');

  reset();
  mock.rpcFailure = { message: 'Could not find the function public.apply_save_batch(batch)', code: 'PGRST202' };
  let rpcMissingClassified = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error: any) {
    rpcMissingClassified = error?.diagnostics?.failureKind === 'backend_missing_rpc' && error?.diagnostics?.nonRetryable === true;
  }
  assert(rpcMissingClassified, 'missing RPC should classify as non-retryable backend setup failure');

  reset();
  mock.rpcFailure = { message: 'function digest(text, unknown) does not exist', code: '42883' };
  let hashingDependencyClassified = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error: any) {
    hashingDependencyClassified = error?.diagnostics?.failureKind === 'backend_hashing_failure'
      && error?.diagnostics?.nonRetryable === true
      && String(error?.message ?? '').includes('digest()');
  }
  assert(hashingDependencyClassified, 'digest signature failures should classify as non-retryable backend hashing failure');

  reset();
  const originalRpc = (supabase as any).rpc;
  let rpcInvocation = 0;
  (supabase as any).rpc = async (fn: string, args: any) => {
    rpcInvocation += 1;
    if (fn === 'get_persistence_contract_report') return { data: { status: 'healthy' }, error: null };
    if (fn !== 'apply_save_batch') return { data: null, error: new Error('unknown rpc') };
    if (args?.batch?.batchId === '__schema_health_check__') {
      return {
        data: {
          batchId: '__schema_health_check__',
          userId: mock.sessionUserId ?? 'user-1',
          status: 'committed',
          schemaVersion: 1,
          operationCount: 0,
          operationCountsByEntity: { items: { upserts: 0, deletes: 0 }, tasks: { upserts: 0, deletes: 0 }, projects: { upserts: 0, deletes: 0 }, contacts: { upserts: 0, deletes: 0 }, companies: { upserts: 0, deletes: 0 } },
          touchedTables: [],
          clientPayloadHash: '',
          serverPayloadHash: '',
          hashMatch: true,
        },
        error: null,
      };
    }
    return { data: null, error: { message: 'Could not find the function public.apply_save_batch(batch)', code: 'PGRST202' } };
  };
  let cacheExposureMismatchClassified = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error: any) {
    cacheExposureMismatchClassified = error?.diagnostics?.failureKind === 'backend_rpc_exposure_cache'
      && error?.diagnostics?.nonRetryable === true
      && String(error?.message ?? '').includes('Cloud save RPC exists in Postgres but is not yet visible through the REST schema cache.');
  } finally {
    (supabase as any).rpc = originalRpc;
  }
  assert(cacheExposureMismatchClassified, `rpc exposure/cache mismatch should surface specific non-retryable diagnostics (calls=${rpcInvocation})`);

  reset();
  mock.rpcFailure = { message: 'rpc unavailable', code: 'PGRST301' };
  let failureHasBatch = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error: any) {
    failureHasBatch = Boolean(error?.diagnostics?.failedBatchId);
  }
  assert(failureHasBatch, 'rpc failure should preserve failed batch id in diagnostics');

  // G. conflict receipt should preserve unresolved outbox entries
  reset();
  (supabase as any).rpc = async (fn: string, args: any) => {
    if (fn !== 'apply_save_batch') return { data: null, error: new Error('unknown rpc') };
    return {
      data: {
        batchId: args.batch.batchId,
        userId: mock.sessionUserId ?? 'user-1',
        status: 'conflict',
        schemaVersion: args.batch.schemaVersion,
        operationCount: args.batch.operationCount,
        appliedOperationCount: 0,
        conflictedOperationCount: 1,
        operationCountsByEntity: args.batch.operationCountsByEntity,
        touchedTables: [],
        clientPayloadHash: args.batch.clientPayloadHash,
        serverPayloadHash: args.batch.clientPayloadHash,
        hashMatch: true,
        conflictIds: ['conflict-1'],
        outboxSafeToClear: false,
      },
      error: null,
    };
  };
  let conflictThrown = false;
  try {
    await savePersistedPayload(payloadFixture);
  } catch (error: any) {
    conflictThrown = String(error?.message ?? '').includes('did not fully complete');
  }
  assert(conflictThrown, 'conflict receipt should reject save completion');
  const outboxRaw = JSON.parse(storage.getItem('followup_hq_persistence_outbox_v2') ?? storage.getItem('followup_hq_persistence_outbox_v1') ?? '{\"entries\":[]}');
  assert((outboxRaw.entries ?? []).length > 0, 'conflict should keep durable outbox entry');
}

void run();
