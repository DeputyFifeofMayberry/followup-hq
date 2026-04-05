import { supabase } from './supabase';
import { getDefaultOutlookSettings } from './outlookGraph';
import {
  formatPersistenceErrorMessage,
  normalizePersistenceError,
  type NormalizedPersistenceError,
} from './persistenceError';
import {
  runPersistenceSchemaHealthCheck,
  type PersistenceSchemaHealthResult,
} from './persistenceSchemaHealth';
import { getSupabaseHost } from './supabase';
import type {
  AppSnapshot,
  CompanyRecord,
  ContactRecord,
  FollowUpItem,
  PersistenceMode,
  ProjectRecord,
  TaskItem,
} from '../types';
import { getDefaultForwardedRules } from './intakeRules';

const LEGACY_BROWSER_SNAPSHOT_KEY = 'followup_hq_snapshot_v1';
const LOCAL_CACHE_KEY = 'followup_hq_entities_cache_v2';
const STALE_DELETE_ABORT_THRESHOLD = 200;

export interface CoreEntities {
  items: FollowUpItem[];
  tasks: TaskItem[];
  projects: ProjectRecord[];
  contacts: ContactRecord[];
  companies: CompanyRecord[];
}

export interface AppAuxiliaryState {
  intakeSignals: AppSnapshot['intakeSignals'];
  intakeDocuments: AppSnapshot['intakeDocuments'];
  dismissedDuplicatePairs: AppSnapshot['dismissedDuplicatePairs'];
  droppedEmailImports: AppSnapshot['droppedEmailImports'];
  outlookConnection: AppSnapshot['outlookConnection'];
  outlookMessages: AppSnapshot['outlookMessages'];
  forwardedEmails: AppSnapshot['forwardedEmails'];
  forwardedRules: AppSnapshot['forwardedRules'];
  forwardedCandidates: AppSnapshot['forwardedCandidates'];
  forwardedLedger: AppSnapshot['forwardedLedger'];
  forwardedRoutingAudit: AppSnapshot['forwardedRoutingAudit'];
  intakeCandidates: AppSnapshot['intakeCandidates'];
  intakeAssets: AppSnapshot['intakeAssets'];
  intakeBatches: AppSnapshot['intakeBatches'];
  intakeWorkCandidates: AppSnapshot['intakeWorkCandidates'];
  intakeReviewerFeedback: AppSnapshot['intakeReviewerFeedback'];
  savedExecutionViews: AppSnapshot['savedExecutionViews'];
  followUpFilters?: AppSnapshot['followUpFilters'];
  followUpColumns?: AppSnapshot['followUpColumns'];
  savedFollowUpViews?: AppSnapshot['savedFollowUpViews'];
}

export interface PersistedPayload extends CoreEntities {
  auxiliary: AppAuxiliaryState;
}

export interface LocalCachePayload {
  entities: PersistedPayload;
  updatedAt: string;
  cloudStatus: 'pending' | 'confirmed';
  lastCloudConfirmedAt?: string;
}

export interface LoadResult {
  payload: PersistedPayload;
  mode: PersistenceMode;
  source: 'supabase' | 'local-cache';
  cacheStatus?: 'pending' | 'confirmed';
  loadedFromFallback?: boolean;
  cloudReadFailed?: boolean;
  localNewerThanCloud?: boolean;
  localCacheUpdatedAt?: string;
  localCacheLastCloudConfirmedAt?: string;
  cloudUpdatedAt?: string;
  loadFailureStage?: LoadFailureStage;
  loadFailureMessage?: string;
  loadFailureRecoveredWithLocalCache?: boolean;
}

export type LoadFailureStage =
  | 'auth_session'
  | 'follow_up_items'
  | 'tasks'
  | 'projects'
  | 'contacts'
  | 'companies'
  | 'user_preferences'
  | 'schema_preflight'
  | 'unknown';

export interface SaveDiagnostics {
  attemptedAt: string;
  completedTables: string[];
  failedTable?: string;
  staleDeleteGuardTriggered?: boolean;
  staleDeleteWarnings: string[];
}

export interface SaveResult {
  mode: PersistenceMode;
  diagnostics?: SaveDiagnostics;
}

export class PersistenceLoadError extends Error {
  stage?: LoadFailureStage;
  normalized: NormalizedPersistenceError;
  recoveredWithLocalCache: boolean;

  constructor(params: {
    stage?: LoadFailureStage;
    normalized: NormalizedPersistenceError;
    recoveredWithLocalCache: boolean;
  }) {
    super(formatPersistenceErrorMessage(params.normalized));
    this.name = 'PersistenceLoadError';
    this.stage = params.stage;
    this.normalized = params.normalized;
    this.recoveredWithLocalCache = params.recoveredWithLocalCache;
  }
}

function buildFallbackSnapshot(): AppSnapshot {
  return {
    items: [],
    contacts: [],
    companies: [],
    projects: [],
    intakeSignals: [],
    intakeDocuments: [],
    dismissedDuplicatePairs: [],
    droppedEmailImports: [],
    outlookConnection: {
      settings: getDefaultOutlookSettings(),
      mailboxLinked: false,
      syncStatus: 'idle',
      syncCursorByFolder: { inbox: {}, sentitems: {} },
    },
    outlookMessages: [],
    tasks: [],
    forwardedEmails: [],
    forwardedRules: getDefaultForwardedRules(),
    forwardedCandidates: [],
    forwardedLedger: [],
    forwardedRoutingAudit: [],
    intakeCandidates: [],
    intakeAssets: [],
    intakeBatches: [],
    intakeWorkCandidates: [],
    intakeReviewerFeedback: [],
    savedExecutionViews: [],
    followUpFilters: undefined,
    followUpColumns: undefined,
    savedFollowUpViews: [],
  };
}

function fromSnapshot(snapshot: AppSnapshot): PersistedPayload {
  return {
    items: snapshot.items ?? [],
    tasks: snapshot.tasks ?? [],
    projects: snapshot.projects ?? [],
    contacts: snapshot.contacts ?? [],
    companies: snapshot.companies ?? [],
    auxiliary: {
      intakeSignals: snapshot.intakeSignals ?? [],
      intakeDocuments: snapshot.intakeDocuments ?? [],
      dismissedDuplicatePairs: snapshot.dismissedDuplicatePairs ?? [],
      droppedEmailImports: snapshot.droppedEmailImports ?? [],
      outlookConnection: snapshot.outlookConnection ?? buildFallbackSnapshot().outlookConnection,
      outlookMessages: snapshot.outlookMessages ?? [],
      forwardedEmails: snapshot.forwardedEmails ?? [],
      forwardedRules: snapshot.forwardedRules?.length ? snapshot.forwardedRules : getDefaultForwardedRules(),
      forwardedCandidates: snapshot.forwardedCandidates ?? [],
      forwardedLedger: snapshot.forwardedLedger ?? [],
      forwardedRoutingAudit: snapshot.forwardedRoutingAudit ?? [],
      intakeCandidates: snapshot.intakeCandidates ?? [],
      intakeAssets: snapshot.intakeAssets ?? [],
      intakeBatches: snapshot.intakeBatches ?? [],
      intakeWorkCandidates: snapshot.intakeWorkCandidates ?? [],
      intakeReviewerFeedback: snapshot.intakeReviewerFeedback ?? [],
      savedExecutionViews: snapshot.savedExecutionViews ?? [],
      followUpFilters: snapshot.followUpFilters,
      followUpColumns: snapshot.followUpColumns,
      savedFollowUpViews: snapshot.savedFollowUpViews ?? [],
    },
  };
}

function buildEmptyPayload(): PersistedPayload {
  return fromSnapshot(buildFallbackSnapshot());
}

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function canUseBrowserStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function normalizeLocalCache(parsed: unknown): LocalCachePayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const asRecord = parsed as Record<string, unknown>;
  const entities = asRecord.entities;

  if (!entities || typeof entities !== 'object') return null;

  const cloudStatus = asRecord.cloudStatus === 'confirmed' ? 'confirmed' : 'pending';
  const updatedAt = typeof asRecord.updatedAt === 'string' ? asRecord.updatedAt : new Date().toISOString();
  const lastCloudConfirmedAt = typeof asRecord.lastCloudConfirmedAt === 'string' ? asRecord.lastCloudConfirmedAt : undefined;

  return {
    entities: entities as PersistedPayload,
    updatedAt,
    cloudStatus,
    lastCloudConfirmedAt,
  };
}

function readLocalCache(): LocalCachePayload | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeLocalCache(parsed);
    if (normalized) return normalized;

    // Backward compatibility with older cache format.
    if (parsed && typeof parsed === 'object' && 'items' in (parsed as Record<string, unknown>)) {
      return {
        entities: parsed as PersistedPayload,
        updatedAt: new Date().toISOString(),
        cloudStatus: 'pending',
      };
    }

    return null;
  } catch {
    return null;
  }
}

function writeLocalCache(cache: LocalCachePayload): void {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cache));
    window.localStorage.removeItem(LEGACY_BROWSER_SNAPSHOT_KEY);
  } catch {
    // ignore local cache errors
  }
}

function readLegacySnapshotFromBrowser(): AppSnapshot | null {
  if (!canUseBrowserStorage()) return null;
  try {
    const raw = window.localStorage.getItem(LEGACY_BROWSER_SNAPSHOT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AppSnapshot;
  } catch {
    return null;
  }
}

async function getSessionUserId(): Promise<string | null> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) throw error;
  return session?.user?.id ?? null;
}

async function readEntityRows<T>(table: string, userId: string): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('record').eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []).map((row) => row.record) as T[]);
}

interface AuxiliaryReadResult {
  auxiliary: AppAuxiliaryState | null;
  updatedAt?: string;
}

async function readAuxiliaryState(userId: string): Promise<AuxiliaryReadResult> {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('auxiliary, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return { auxiliary: null };
  return {
    auxiliary: (data.auxiliary as AppAuxiliaryState | null) ?? null,
    updatedAt: typeof data.updated_at === 'string' ? data.updated_at : undefined,
  };
}

async function readLegacySnapshotFromSupabase(userId: string): Promise<AppSnapshot | null> {
  const { data, error } = await supabase.from('app_snapshots').select('snapshot').eq('user_id', userId).maybeSingle();
  if (error) return null;
  return (data?.snapshot as AppSnapshot | null) ?? null;
}

/**
 * NOTE: This table-level replacement flow can still be vulnerable to stale-client deletes.
 * We preserve the current architecture here, and now add a safety guard against very large
 * delete sets that often indicate stale-client drift.
 */
async function saveEntityTable(table: string, userId: string, records: Array<{ id: string }>): Promise<{ staleDeleteWarning?: string }> {
  const ids = new Set(records.map((record) => record.id));
  const payload = records.map((record) => ({ user_id: userId, record_id: record.id, record }));

  if (payload.length > 0) {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'user_id,record_id' });
    if (error) throw error;
  }

  const { data: existingRows, error: existingError } = await supabase.from(table).select('record_id').eq('user_id', userId);
  if (existingError) throw existingError;

  const staleIds = (existingRows ?? [])
    .map((row) => row.record_id as string)
    .filter((id) => !ids.has(id));

  if (staleIds.length > STALE_DELETE_ABORT_THRESHOLD) {
    throw new Error(`Delete safety guard triggered for ${table}: refusing to delete ${staleIds.length} records in one pass.`);
  }

  if (staleIds.length > 0) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId).in('record_id', staleIds);
    if (error) throw error;
    return { staleDeleteWarning: `${table}: replaced ${records.length} records and deleted ${staleIds.length} stale records.` };
  }

  return {};
}

async function saveAuxiliaryState(userId: string, auxiliary: AppAuxiliaryState, migrationComplete = true) {
  const { error } = await supabase.from('user_preferences').upsert({
    user_id: userId,
    auxiliary,
    migration_complete: migrationComplete,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  if (error) throw error;
}

function isCoreDataEmpty(payload: PersistedPayload): boolean {
  return payload.items.length === 0
    && payload.tasks.length === 0
    && payload.projects.length === 0
    && payload.contacts.length === 0
    && payload.companies.length === 0;
}

async function migrateLegacySnapshotIfNeeded(userId: string, currentPayload: PersistedPayload): Promise<PersistedPayload> {
  const { data: pref, error: prefError } = await supabase
    .from('user_preferences')
    .select('migration_complete, auxiliary')
    .eq('user_id', userId)
    .maybeSingle();

  if (prefError) throw prefError;

  if (pref?.migration_complete || !isCoreDataEmpty(currentPayload)) {
    if (pref?.auxiliary) {
      return { ...currentPayload, auxiliary: pref.auxiliary as AppAuxiliaryState };
    }
    return currentPayload;
  }

  const legacySnapshot = readLegacySnapshotFromBrowser() ?? await readLegacySnapshotFromSupabase(userId);
  if (!legacySnapshot) {
    await saveAuxiliaryState(userId, currentPayload.auxiliary, true);
    return currentPayload;
  }

  const migrated = fromSnapshot(legacySnapshot);
  await saveEntityTable('follow_up_items', userId, migrated.items);
  await saveEntityTable('tasks', userId, migrated.tasks);
  await saveEntityTable('projects', userId, migrated.projects);
  await saveEntityTable('contacts', userId, migrated.contacts);
  await saveEntityTable('companies', userId, migrated.companies);
  await saveAuxiliaryState(userId, migrated.auxiliary, true);
  writeLocalCache({
    entities: migrated,
    updatedAt: new Date().toISOString(),
    cloudStatus: 'confirmed',
    lastCloudConfirmedAt: new Date().toISOString(),
  });
  return migrated;
}

function isLocalNewer(localUpdatedAt: string | undefined, cloudUpdatedAt: string | undefined): boolean {
  if (!localUpdatedAt) return false;
  if (!cloudUpdatedAt) return true;
  return new Date(localUpdatedAt).getTime() > new Date(cloudUpdatedAt).getTime();
}

function toStageFromTable(table?: string): LoadFailureStage {
  if (!table) return 'schema_preflight';
  if (table === 'follow_up_items'
    || table === 'tasks'
    || table === 'projects'
    || table === 'contacts'
    || table === 'companies'
    || table === 'user_preferences') {
    return table;
  }
  return 'schema_preflight';
}

function formatSchemaHealthMessage(result: PersistenceSchemaHealthResult): string {
  if (result.status === 'healthy') return 'Persistence schema health check passed.';
  const table = result.schemaQualifiedTable ?? result.failingTable;
  const code = result.errorCode ? ` (${result.errorCode})` : '';
  const host = result.supabaseHost ? ` Connected Supabase host: ${result.supabaseHost}.` : '';
  if (result.status === 'missing_table' && table) {
    return `Cloud persistence is not configured correctly. Missing table: ${table}${code}.${host}`;
  }
  if (result.status === 'permissions_error' && table) {
    return `Cloud persistence permissions issue while checking ${table}${code}.${host}`;
  }
  if (result.status === 'auth_unavailable') {
    return `Cloud persistence preflight could not verify your authenticated session${code}.${host}`;
  }
  return `Cloud persistence preflight failed${code}.${host}`;
}

export async function loadPersistedPayload(): Promise<LoadResult> {
  const cache = readLocalCache();

  let userId: string | null;
  try {
    userId = await getSessionUserId();
  } catch (error) {
    const normalized = normalizePersistenceError(error, { stage: 'auth_session', operation: 'load', table: 'auth_session' });
    const loadFailureMessage = formatPersistenceErrorMessage(normalized);
    if (cache) {
      return {
        payload: cache.entities,
        mode: 'browser',
        source: 'local-cache',
        cacheStatus: cache.cloudStatus,
        loadedFromFallback: true,
        cloudReadFailed: true,
        localCacheUpdatedAt: cache.updatedAt,
        localCacheLastCloudConfirmedAt: cache.lastCloudConfirmedAt,
        loadFailureStage: 'auth_session',
        loadFailureMessage,
        loadFailureRecoveredWithLocalCache: true,
      };
    }
    throw new PersistenceLoadError({
      stage: 'auth_session',
      normalized,
      recoveredWithLocalCache: false,
    });
  }

  if (!userId) {
    if (cache) {
      return {
        payload: cache.entities,
        mode: 'browser',
        source: 'local-cache',
        cacheStatus: cache.cloudStatus,
        localCacheUpdatedAt: cache.updatedAt,
        localCacheLastCloudConfirmedAt: cache.lastCloudConfirmedAt,
      };
    }
    const legacy = readLegacySnapshotFromBrowser();
    const payload = legacy ? fromSnapshot(legacy) : buildEmptyPayload();
    writeLocalCache({ entities: payload, updatedAt: new Date().toISOString(), cloudStatus: 'confirmed' });
    return {
      payload,
      mode: 'browser',
      source: 'local-cache',
      cacheStatus: 'confirmed',
      localCacheUpdatedAt: new Date().toISOString(),
    };
  }

  let cloudPayload: PersistedPayload;
  let cloudUpdatedAt: string | undefined;
  let loadFailureStage: LoadFailureStage | undefined;
  let loadFailureNormalized: NormalizedPersistenceError | undefined;
  const supabaseHost = getSupabaseHost();

  try {
    const health = await runPersistenceSchemaHealthCheck(userId);
    if (health.status !== 'healthy') {
      const stage = toStageFromTable(health.failingTable);
      const topLine = formatSchemaHealthMessage(health);
      const normalized = health.normalized
        ?? normalizePersistenceError(new Error(topLine), {
          stage,
          operation: 'schema-preflight',
          table: health.failingTable,
        });
      const detail = `${topLine}${health.message ? ` Detail: ${health.message}` : ''}`;
      throw new PersistenceLoadError({
        stage,
        normalized: {
          ...normalized,
          message: detail,
          code: normalized.code ?? health.errorCode,
          stage,
          table: health.failingTable,
        },
        recoveredWithLocalCache: false,
      });
    }
  } catch (error) {
    const fromLoadError = error instanceof PersistenceLoadError ? error : undefined;
    const normalized = fromLoadError?.normalized
      ?? normalizePersistenceError(error, { stage: 'schema_preflight', operation: 'schema-preflight' });
    const loadFailureMessage = formatPersistenceErrorMessage(normalized);
    if (cache) {
      const preflightStage: LoadFailureStage = fromLoadError?.stage
        ?? (normalized.stage ? toStageFromTable(normalized.stage) : 'schema_preflight');
      return {
        payload: cache.entities,
        mode: 'supabase',
        source: 'local-cache',
        cacheStatus: cache.cloudStatus,
        loadedFromFallback: true,
        cloudReadFailed: true,
        localCacheUpdatedAt: cache.updatedAt,
        localCacheLastCloudConfirmedAt: cache.lastCloudConfirmedAt,
        loadFailureStage: preflightStage,
        loadFailureMessage,
        loadFailureRecoveredWithLocalCache: true,
      };
    }
    throw new PersistenceLoadError({
      stage: fromLoadError?.stage ?? 'schema_preflight',
      normalized: {
        ...normalized,
        message: `${loadFailureMessage} Connected Supabase host: ${supabaseHost}.`,
      },
      recoveredWithLocalCache: false,
    });
  }

  try {
    const readAtStage = async <T>(stage: LoadFailureStage, fn: () => Promise<T>): Promise<T> => {
      try {
        return await fn();
      } catch (error) {
        loadFailureStage = stage;
        loadFailureNormalized = normalizePersistenceError(error, { stage, operation: 'load', table: stage });
        throw new PersistenceLoadError({
          stage,
          normalized: loadFailureNormalized,
          recoveredWithLocalCache: false,
        });
      }
    };

    const items = await readAtStage('follow_up_items', () => readEntityRows<FollowUpItem>('follow_up_items', userId));
    const tasks = await readAtStage('tasks', () => readEntityRows<TaskItem>('tasks', userId));
    const projects = await readAtStage('projects', () => readEntityRows<ProjectRecord>('projects', userId));
    const contacts = await readAtStage('contacts', () => readEntityRows<ContactRecord>('contacts', userId));
    const companies = await readAtStage('companies', () => readEntityRows<CompanyRecord>('companies', userId));
    const auxiliaryResult = await readAtStage('user_preferences', () => readAuxiliaryState(userId));

    cloudUpdatedAt = auxiliaryResult.updatedAt;
    cloudPayload = {
      items,
      tasks,
      projects,
      contacts,
      companies,
      auxiliary: auxiliaryResult.auxiliary ?? buildEmptyPayload().auxiliary,
    };
  } catch (error) {
    const fromLoadError = error instanceof PersistenceLoadError ? error : undefined;
    const normalized = fromLoadError?.normalized
      ?? loadFailureNormalized
      ?? normalizePersistenceError(error, { stage: loadFailureStage ?? 'unknown', operation: 'load', table: loadFailureStage ?? 'unknown' });
    const stage = fromLoadError?.stage ?? loadFailureStage ?? 'unknown';
    const loadFailureMessage = formatPersistenceErrorMessage(normalized);
    if (cache) {
      return {
        payload: cache.entities,
        mode: 'supabase',
        source: 'local-cache',
        cacheStatus: cache.cloudStatus,
        loadedFromFallback: true,
        cloudReadFailed: true,
        localCacheUpdatedAt: cache.updatedAt,
        localCacheLastCloudConfirmedAt: cache.lastCloudConfirmedAt,
        loadFailureStage: stage,
        loadFailureMessage,
        loadFailureRecoveredWithLocalCache: true,
      };
    }
    throw new PersistenceLoadError({
      stage,
      normalized,
      recoveredWithLocalCache: false,
    });
  }

  const hydrated = await migrateLegacySnapshotIfNeeded(userId, cloudPayload);
  const localNewerThanCloud = cache ? isLocalNewer(cache.updatedAt, cloudUpdatedAt) : false;

  if (cache && localNewerThanCloud) {
    return {
      payload: cache.entities,
      mode: 'supabase',
      source: 'local-cache',
      cacheStatus: cache.cloudStatus,
      localNewerThanCloud: true,
      loadedFromFallback: true,
      localCacheUpdatedAt: cache.updatedAt,
      localCacheLastCloudConfirmedAt: cache.lastCloudConfirmedAt,
      cloudUpdatedAt,
    };
  }

  const confirmedAt = cloudUpdatedAt ?? new Date().toISOString();
  writeLocalCache({
    entities: hydrated,
    updatedAt: confirmedAt,
    cloudStatus: 'confirmed',
    lastCloudConfirmedAt: confirmedAt,
  });

  return {
    payload: hydrated,
    mode: 'supabase',
    source: 'supabase',
    cacheStatus: 'confirmed',
    cloudUpdatedAt: confirmedAt,
    localCacheUpdatedAt: confirmedAt,
    localCacheLastCloudConfirmedAt: confirmedAt,
  };
}

export class PersistenceSaveError extends Error {
  diagnostics: SaveDiagnostics;

  constructor(message: string, diagnostics: SaveDiagnostics) {
    super(message);
    this.name = 'PersistenceSaveError';
    this.diagnostics = diagnostics;
  }
}

export async function savePersistedPayload(payload: PersistedPayload): Promise<SaveResult> {
  const saveAttemptAt = new Date().toISOString();
  const existingCache = readLocalCache();
  const diagnostics: SaveDiagnostics = {
    attemptedAt: saveAttemptAt,
    completedTables: [],
    staleDeleteWarnings: [],
  };

  writeLocalCache({
    entities: payload,
    updatedAt: saveAttemptAt,
    cloudStatus: 'pending',
    lastCloudConfirmedAt: existingCache?.lastCloudConfirmedAt,
  });

  const userId = await getSessionUserId();
  if (!userId) {
    writeLocalCache({
      entities: payload,
      updatedAt: saveAttemptAt,
      cloudStatus: 'confirmed',
      lastCloudConfirmedAt: undefined,
    });
    return { mode: 'browser', diagnostics };
  }

  const saveTable = async (table: string, records: Array<{ id: string }>) => {
    let tableResult: { staleDeleteWarning?: string };
    try {
      tableResult = await saveEntityTable(table, userId, records);
    } catch (error) {
      throw normalizePersistenceError(error, { operation: 'save', table });
    }
    diagnostics.completedTables.push(table);
    if (tableResult.staleDeleteWarning) diagnostics.staleDeleteWarnings.push(tableResult.staleDeleteWarning);
  };

  try {
    await saveTable('follow_up_items', payload.items);
    await saveTable('tasks', payload.tasks);
    await saveTable('projects', payload.projects);
    await saveTable('contacts', payload.contacts);
    await saveTable('companies', payload.companies);
    try {
      await saveAuxiliaryState(userId, payload.auxiliary, true);
    } catch (error) {
      throw normalizePersistenceError(error, { operation: 'save', table: 'user_preferences' });
    }
    diagnostics.completedTables.push('user_preferences');
  } catch (error) {
    const normalized = normalizePersistenceError(error, { operation: 'save' });
    const rawMessage = formatPersistenceErrorMessage(normalized);
    const failedMatch = rawMessage.match(/for table ([a-z_]+)/) || rawMessage.match(/for ([a-z_]+):/) || rawMessage.match(/save failed:([a-z_]+)/);
    diagnostics.failedTable = failedMatch?.[1] ?? normalized.table;
    diagnostics.staleDeleteGuardTriggered = rawMessage.includes('Delete safety guard triggered');
    throw new PersistenceSaveError(`Cloud save did not fully complete. ${rawMessage}`, diagnostics);
  }

  const cloudConfirmedAt = new Date().toISOString();
  writeLocalCache({
    entities: payload,
    updatedAt: saveAttemptAt,
    cloudStatus: 'confirmed',
    lastCloudConfirmedAt: cloudConfirmedAt,
  });

  return { mode: 'supabase', diagnostics };
}
