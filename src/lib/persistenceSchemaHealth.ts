import { supabase, getSupabaseHost } from './supabase';
import { normalizePersistenceError, type NormalizedPersistenceError } from './persistenceError';

const REQUIRED_ENTITY_TABLES = ['follow_up_items', 'tasks', 'projects', 'contacts', 'companies'] as const;
const REQUIRED_TABLES = [...REQUIRED_ENTITY_TABLES, 'user_preferences'] as const;

type RequiredEntityTable = typeof REQUIRED_ENTITY_TABLES[number];
type RequiredTable = typeof REQUIRED_TABLES[number];

export type PersistenceSchemaHealthStatus =
  | 'healthy'
  | 'missing_table'
  | 'missing_column'
  | 'missing_rpc'
  | 'auth_unavailable'
  | 'permissions_error'
  | 'unknown_backend_error';

export interface PersistenceSchemaHealthResult {
  status: PersistenceSchemaHealthStatus;
  checkedAt: string;
  supabaseHost: string;
  isBackendContractIssue: boolean;
  failingTable?: RequiredTable;
  schemaQualifiedTable?: string;
  failingRpc?: 'apply_save_batch';
  failingColumn?: string;
  backendContractVersion?: string;
  migrationSignaturePresent?: boolean;
  wrongProjectLikely?: boolean;
  errorCode?: string;
  message?: string;
  normalized?: NormalizedPersistenceError;
  details?: string;
}

const resultCache = new Map<string, PersistenceSchemaHealthResult>();

function schemaQualified(table: RequiredTable): string {
  return `public.${table}`;
}

function normalizeFailure(table: RequiredTable | 'rpc', error: unknown): NormalizedPersistenceError {
  return normalizePersistenceError(error, {
    stage: table,
    operation: 'schema-preflight',
    table: table === 'rpc' ? 'apply_save_batch' : table,
  });
}

function classifyFailure(normalized: NormalizedPersistenceError): PersistenceSchemaHealthStatus {
  const lower = [normalized.message, normalized.details, normalized.hint, normalized.rawSummary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const code = normalized.code?.toUpperCase();
  const status = Number(normalized.status);

  if (
    code === 'PGRST202'
    || lower.includes('could not find the function public.apply_save_batch')
    || lower.includes('function public.apply_save_batch')
  ) {
    return 'missing_rpc';
  }

  if (code === 'PGRST205' || lower.includes('could not find the table') || lower.includes('relation') && lower.includes('does not exist')) {
    return 'missing_table';
  }

  if (code === '42703' || lower.includes('column') && lower.includes('does not exist')) {
    return 'missing_column';
  }

  if (code === '42501' || status === 403 || lower.includes('permission denied') || lower.includes('row-level security')) {
    return 'permissions_error';
  }

  if (status === 401 || code === 'PGRST301' || lower.includes('jwt') || lower.includes('not authenticated')) {
    return 'auth_unavailable';
  }

  return 'unknown_backend_error';
}

function extractMissingColumn(normalized: NormalizedPersistenceError): string | undefined {
  const raw = [normalized.message, normalized.details, normalized.rawSummary].filter(Boolean).join(' ');
  const match = raw.match(/column\s+([a-z0-9_\.]+)\s+does not exist/i);
  if (!match) return undefined;
  const value = match[1] ?? '';
  const parts = value.split('.');
  return parts[parts.length - 1] || undefined;
}

function toFailureResult(input: {
  status: PersistenceSchemaHealthStatus;
  table?: RequiredTable;
  normalized: NormalizedPersistenceError;
  failingRpc?: 'apply_save_batch';
  failingColumn?: string;
  details?: string;
  backendContractVersion?: string;
  migrationSignaturePresent?: boolean;
  wrongProjectLikely?: boolean;
}): PersistenceSchemaHealthResult {
  const isBackendContractIssue = input.status === 'missing_table' || input.status === 'missing_column' || input.status === 'missing_rpc';
  return {
    status: input.status,
    checkedAt: new Date().toISOString(),
    supabaseHost: getSupabaseHost(),
    isBackendContractIssue,
    failingTable: input.table,
    schemaQualifiedTable: input.table ? schemaQualified(input.table) : undefined,
    failingColumn: input.status === 'missing_column' ? (input.failingColumn ?? extractMissingColumn(input.normalized)) : undefined,
    failingRpc: input.failingRpc,
    backendContractVersion: input.backendContractVersion,
    migrationSignaturePresent: input.migrationSignaturePresent,
    wrongProjectLikely: input.wrongProjectLikely,
    errorCode: input.normalized.code,
    message: input.normalized.message,
    normalized: input.normalized,
    details: input.details ?? input.normalized.details,
  };
}

type ContractRpcReport = {
  status?: 'healthy' | 'missing_table' | 'missing_column' | 'missing_rpc';
  failingTable?: RequiredTable;
  failingColumn?: string;
  failingRpc?: 'apply_save_batch';
  backendContractVersion?: string;
  migrationSignaturePresent?: boolean;
  details?: string;
};

async function checkStructuredContractReport(): Promise<{ ok: true } | { ok: false; result: PersistenceSchemaHealthResult }> {
  const { data, error } = await supabase.rpc('get_persistence_contract_report');
  if (error) {
    const normalized = normalizeFailure('rpc', error);
    const code = normalized.code?.toUpperCase();
    if (code === 'PGRST202') {
      // Legacy deployments may not have the helper yet. Continue with per-table probes.
      return { ok: true };
    }
    const status = classifyFailure(normalized);
    return {
      ok: false,
      result: toFailureResult({ status, normalized }),
    };
  }

  const report = (data ?? {}) as ContractRpcReport;
  const status = report.status ?? 'healthy';
  if (status === 'healthy') return { ok: true };

  const wrongProjectLikely = report.migrationSignaturePresent === false;
  const normalized = normalizeFailure('rpc', new Error(report.details ?? `Backend contract status ${status}`));
  return {
    ok: false,
    result: toFailureResult({
      status,
      table: report.failingTable,
      normalized,
      failingRpc: report.failingRpc,
      failingColumn: report.failingColumn,
      details: report.details,
      backendContractVersion: report.backendContractVersion,
      migrationSignaturePresent: report.migrationSignaturePresent,
      wrongProjectLikely,
    }),
  };
}

async function checkEntityTableReachability(userId: string, table: RequiredEntityTable): Promise<{ ok: true } | { ok: false; result: PersistenceSchemaHealthResult }> {
  const { error } = await supabase
    .from(table)
    .select('record_id,deleted_at,record_version,updated_by_device,last_batch_id,last_operation_at,conflict_marker')
    .eq('user_id', userId)
    .limit(1);

  if (!error) return { ok: true };

  const normalized = normalizeFailure(table, error);
  const status = classifyFailure(normalized);

  return {
    ok: false,
    result: toFailureResult({ status, table, normalized }),
  };
}

async function checkUserPreferencesReachability(userId: string): Promise<{ ok: true } | { ok: false; result: PersistenceSchemaHealthResult }> {
  const table: RequiredTable = 'user_preferences';
  const { error } = await supabase
    .from(table)
    .select('user_id,migration_complete,auxiliary,updated_at')
    .eq('user_id', userId)
    .limit(1);

  if (!error) return { ok: true };
  const normalized = normalizeFailure(table, error);
  const status = classifyFailure(normalized);
  return { ok: false, result: toFailureResult({ status, table, normalized }) };
}

async function checkApplySaveBatchRpcHealth(): Promise<{ ok: true } | { ok: false; result: PersistenceSchemaHealthResult }> {
  const payload = {
    batchId: '__schema_health_check__',
    schemaVersion: 1,
    operations: [],
  };
  const { data, error } = await supabase.rpc('apply_save_batch', { batch: payload });
  if (error) {
    const normalized = normalizeFailure('rpc', error);
    const status = classifyFailure(normalized);
    return {
      ok: false,
      result: toFailureResult({ status, normalized, failingRpc: 'apply_save_batch' }),
    };
  }

  const status = String((data as Record<string, unknown> | null)?.status ?? '');
  if (!['committed', 'rejected', 'conflict'].includes(status)) {
    const normalized = normalizeFailure('rpc', new Error(`Unexpected apply_save_batch response status: ${status || 'empty'}`));
    return {
      ok: false,
      result: toFailureResult({ status: 'unknown_backend_error', normalized, failingRpc: 'apply_save_batch' }),
    };
  }

  return { ok: true };
}

export async function runPersistenceSchemaHealthCheck(userId: string, options?: { force?: boolean }): Promise<PersistenceSchemaHealthResult> {
  const key = `${getSupabaseHost()}::${userId}`;
  if (!options?.force) {
    const cached = resultCache.get(key);
    if (cached) return cached;
  }

  const structuredOutcome = await checkStructuredContractReport();
  if (structuredOutcome.ok === false) {
    resultCache.set(key, structuredOutcome.result);
    return structuredOutcome.result;
  }

  for (const table of REQUIRED_ENTITY_TABLES) {
    const outcome = await checkEntityTableReachability(userId, table);
    if (outcome.ok === false) {
      resultCache.set(key, outcome.result);
      return outcome.result;
    }
  }

  const prefOutcome = await checkUserPreferencesReachability(userId);
  if (prefOutcome.ok === false) {
    resultCache.set(key, prefOutcome.result);
    return prefOutcome.result;
  }

  const rpcOutcome = await checkApplySaveBatchRpcHealth();
  if (rpcOutcome.ok === false) {
    resultCache.set(key, rpcOutcome.result);
    return rpcOutcome.result;
  }

  const healthy: PersistenceSchemaHealthResult = {
    status: 'healthy',
    checkedAt: new Date().toISOString(),
    supabaseHost: getSupabaseHost(),
    isBackendContractIssue: false,
  };
  resultCache.set(key, healthy);
  return healthy;
}

export function resetPersistenceSchemaHealthCache(): void {
  resultCache.clear();
}
