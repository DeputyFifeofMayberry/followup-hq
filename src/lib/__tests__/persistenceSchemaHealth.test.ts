import { runPersistenceSchemaHealthCheck, resetPersistenceSchemaHealthCache } from '../persistenceSchemaHealth';
import { supabase } from '../supabase';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const mock = {
  failTable: '' as string,
  failure: null as unknown,
  contractReport: null as unknown,
  rpcFailure: null as unknown,
  rpcResult: { status: 'committed' as string },
};

(supabase as any).from = (table: string) => ({
  select: (_columns: string) => ({
    eq: () => ({
      limit: async () => {
        if (mock.failTable === table) {
          return { data: null, error: mock.failure };
        }
        return { data: [], error: null };
      },
    }),
  }),
});

(supabase as any).rpc = async (fn: string) => {
  if (fn === 'get_persistence_contract_report') {
    if (mock.contractReport) return { data: mock.contractReport, error: null };
    return { data: { status: 'healthy', backendContractVersion: '2026-04-07.2', migrationSignaturePresent: true }, error: null };
  }
  if (fn !== 'apply_save_batch') return { data: null, error: new Error('unknown rpc') };
  if (mock.rpcFailure) return { data: null, error: mock.rpcFailure };
  return { data: mock.rpcResult, error: null };
};

function reset() {
  resetPersistenceSchemaHealthCache();
  mock.failTable = '';
  mock.failure = null;
  mock.contractReport = null;
  mock.rpcFailure = null;
  mock.rpcResult = { status: 'committed' };
}

async function run() {
  reset();
  const healthy = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(healthy.status === 'healthy', 'healthy schema should report healthy');

  reset();
  mock.contractReport = {
    status: 'missing_column',
    failingTable: 'follow_up_items',
    failingColumn: 'deleted_at',
    details: 'Required column public.follow_up_items.deleted_at is missing.',
    migrationSignaturePresent: false,
  };
  const reportMismatch = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(reportMismatch.status === 'missing_column', 'structured report mismatch should classify correctly');
  assert(reportMismatch.failingTable === 'follow_up_items', 'structured report mismatch should preserve failing table');
  assert(reportMismatch.isBackendContractIssue === true, 'structured report mismatch should flag backend contract issue');
  assert(reportMismatch.wrongProjectLikely === true, 'missing signature should mark wrong project likely');

  reset();
  mock.failTable = 'follow_up_items';
  mock.failure = { code: 'PGRST205', message: "Could not find the table 'public.follow_up_items'" };
  const missing = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(missing.status === 'missing_table', 'missing table should classify correctly');
  assert(missing.failingTable === 'follow_up_items', 'missing table should preserve failing table');

  reset();
  mock.failTable = 'tasks';
  mock.failure = { code: '42703', message: 'column tasks.deleted_at does not exist' };
  const missingColumn = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(missingColumn.status === 'missing_column', 'missing column should classify correctly');
  assert(missingColumn.failingColumn === 'deleted_at', 'missing column should preserve failing column');

  reset();
  mock.contractReport = {
    status: 'backend_hashing_failure',
    details: 'Cloud persistence backend hashing failed. A stale SQL function or invalid digest() signature is still deployed.',
  };
  const missingHashing = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(missingHashing.status === 'backend_hashing_failure', 'backend hashing failure should classify separately');

  reset();
  mock.rpcFailure = { code: 'PGRST202', message: 'Could not find the function public.apply_save_batch(batch)' };
  const missingRpc = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(missingRpc.status === 'missing_rpc', 'missing rpc should classify separately');
  assert(missingRpc.failingRpc === 'apply_save_batch', 'missing rpc should include rpc name');

  reset();
  mock.failTable = 'tasks';
  mock.failure = { code: '42501', message: 'permission denied for table tasks', status: 403 };
  const denied = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(denied.status === 'permissions_error', 'permissions failure should classify separately');

  reset();
  mock.failTable = 'tasks';
  mock.failure = { code: 'PGRST301', message: 'JWT expired', status: 401 };
  const auth = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(auth.status === 'auth_unavailable', 'auth failures should classify separately');
}

void run();
