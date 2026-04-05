import { supabase, getSupabaseHost } from './supabase';
import { normalizePersistenceError, type NormalizedPersistenceError } from './persistenceError';

const REQUIRED_ENTITY_TABLES = ['follow_up_items', 'tasks', 'projects', 'contacts', 'companies'] as const;
const REQUIRED_TABLES = [...REQUIRED_ENTITY_TABLES, 'user_preferences'] as const;

type RequiredTable = typeof REQUIRED_TABLES[number];

export type PersistenceSchemaHealthStatus =
  | 'healthy'
  | 'missing_table'
  | 'auth_unavailable'
  | 'permissions_error'
  | 'unknown_backend_error';

export interface PersistenceSchemaHealthResult {
  status: PersistenceSchemaHealthStatus;
  checkedAt: string;
  supabaseHost: string;
  failingTable?: RequiredTable;
  schemaQualifiedTable?: string;
  errorCode?: string;
  message?: string;
  normalized?: NormalizedPersistenceError;
}

const resultCache = new Map<string, PersistenceSchemaHealthResult>();

function schemaQualified(table: RequiredTable): string {
  return `public.${table}`;
}

function normalizeFailure(table: RequiredTable, error: unknown): NormalizedPersistenceError {
  return normalizePersistenceError(error, {
    stage: table,
    operation: 'schema-preflight',
    table,
  });
}

function classifyFailure(normalized: NormalizedPersistenceError): PersistenceSchemaHealthStatus {
  const lower = [normalized.message, normalized.details, normalized.hint, normalized.rawSummary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const code = normalized.code?.toUpperCase();
  const status = Number(normalized.status);

  if (code === 'PGRST205' || lower.includes('could not find the table') || lower.includes('does not exist')) {
    return 'missing_table';
  }

  if (code === '42501' || status === 403 || lower.includes('permission denied') || lower.includes('row-level security')) {
    return 'permissions_error';
  }

  if (status === 401 || code === 'PGRST301' || lower.includes('jwt') || lower.includes('not authenticated') || lower.includes('auth')) {
    return 'auth_unavailable';
  }

  return 'unknown_backend_error';
}

async function checkTableReachability(userId: string, table: RequiredTable): Promise<{ ok: true } | { ok: false; result: PersistenceSchemaHealthResult }> {
  const query = table === 'user_preferences'
    ? supabase.from('user_preferences').select('user_id').eq('user_id', userId).limit(1)
    : supabase.from(table).select('record_id').eq('user_id', userId).limit(1);

  const { error } = await query;
  if (!error) return { ok: true };

  const normalized = normalizeFailure(table, error);
  const status = classifyFailure(normalized);

  return {
    ok: false,
    result: {
      status,
      checkedAt: new Date().toISOString(),
      supabaseHost: getSupabaseHost(),
      failingTable: table,
      schemaQualifiedTable: schemaQualified(table),
      errorCode: normalized.code,
      message: normalized.message,
      normalized,
    },
  };
}

export async function runPersistenceSchemaHealthCheck(userId: string, options?: { force?: boolean }): Promise<PersistenceSchemaHealthResult> {
  const key = `${getSupabaseHost()}::${userId}`;
  if (!options?.force) {
    const cached = resultCache.get(key);
    if (cached) return cached;
  }

  for (const table of REQUIRED_TABLES) {
    const outcome = await checkTableReachability(userId, table);
    if (outcome.ok === false) {
      resultCache.set(key, outcome.result);
      return outcome.result;
    }
  }

  const healthy: PersistenceSchemaHealthResult = {
    status: 'healthy',
    checkedAt: new Date().toISOString(),
    supabaseHost: getSupabaseHost(),
  };
  resultCache.set(key, healthy);
  return healthy;
}

export function resetPersistenceSchemaHealthCache(): void {
  resultCache.clear();
}
