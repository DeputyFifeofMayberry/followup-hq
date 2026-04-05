import { runPersistenceSchemaHealthCheck, resetPersistenceSchemaHealthCache } from '../persistenceSchemaHealth';
import { supabase } from '../supabase';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

const mock = {
  failTable: '' as string,
  failure: null as unknown,
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

function reset() {
  resetPersistenceSchemaHealthCache();
  mock.failTable = '';
  mock.failure = null;
}

async function run() {
  reset();
  const healthy = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(healthy.status === 'healthy', 'healthy schema should report healthy');

  reset();
  mock.failTable = 'follow_up_items';
  mock.failure = { code: 'PGRST205', message: "Could not find the table 'public.follow_up_items'" };
  const missing = await runPersistenceSchemaHealthCheck('user-1', { force: true });
  assert(missing.status === 'missing_table', 'missing table should classify correctly');
  assert(missing.failingTable === 'follow_up_items', 'missing table should preserve failing table');

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
