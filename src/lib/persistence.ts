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
import { computeDeterministicHash } from './persistenceHash';
import { getSessionScopedId, getStableDeviceId } from './persistenceIdentity';
import type {
  SaveBatchEntityCounts,
  SaveBatchEnvelope,
  SaveBatchOperation,
  SaveBatchReceipt,
} from './persistenceTypes';
import type {
  AppSnapshot,
  CompanyRecord,
  ContactRecord,
  FollowUpItem,
  PersistenceMode,
  ProjectRecord,
  TaskItem,
} from '../types';
import type { DirtyRecordRef } from '../store/persistenceQueue';
import { getDefaultForwardedRules } from './intakeRules';

const LEGACY_BROWSER_SNAPSHOT_KEY = 'followup_hq_snapshot_v1';
const LOCAL_CACHE_KEY = 'followup_hq_entities_cache_v2';
const STALE_DELETE_ABORT_THRESHOLD = 200;
const SAVE_BATCH_SCHEMA_VERSION = 1;

type EntityKey = 'items' | 'tasks' | 'projects' | 'contacts' | 'companies';
type DirtyRecordType = DirtyRecordRef['type'];
type EntityRecord = FollowUpItem | TaskItem | ProjectRecord | ContactRecord | CompanyRecord;
type EntityRecordMap = Record<EntityKey, Array<{ id: string }>>;

interface EntityConfig {
  key: EntityKey;
  table: string;
  dirtyType: DirtyRecordType;
}

const ENTITY_CONFIGS: readonly EntityConfig[] = [
  { key: 'items', table: 'follow_up_items', dirtyType: 'followup' },
  { key: 'tasks', table: 'tasks', dirtyType: 'task' },
  { key: 'projects', table: 'projects', dirtyType: 'project' },
  { key: 'contacts', table: 'contacts', dirtyType: 'contact' },
  { key: 'companies', table: 'companies', dirtyType: 'company' },
] as const;

interface PendingEntityOperation extends SaveBatchOperation {
  entity: EntityKey;
  recordSnapshot?: unknown;
}

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
  followUpTableDensity?: AppSnapshot['followUpTableDensity'];
  followUpDuplicateModule?: AppSnapshot['followUpDuplicateModule'];
}

export interface PersistedPayload extends CoreEntities {
  auxiliary: AppAuxiliaryState;
}

export interface LocalCachePayload {
  entities: PersistedPayload;
  updatedAt: string;
  cloudStatus: 'pending' | 'confirmed';
  lastCloudConfirmedAt?: string;
  pendingOperations?: PendingEntityOperation[];
  lastSaveReceipt?: SaveBatchReceipt;
  lastFailedBatchId?: string;
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
  operationCounts?: SaveBatchEntityCounts;
  batchId?: string;
  failedBatchId?: string;
  committedAt?: string;
  receiptStatus?: SaveBatchReceipt['status'];
  hashMatch?: boolean;
  schemaVersion?: number;
  touchedTables?: string[];
  operationCount?: number;
  operationCountsByEntity?: SaveBatchEntityCounts;
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
    followUpTableDensity: 'compact',
    followUpDuplicateModule: 'auto',
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
      followUpTableDensity: snapshot.followUpTableDensity,
      followUpDuplicateModule: snapshot.followUpDuplicateModule,
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

function normalizePendingOperation(parsed: unknown): PendingEntityOperation | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const asRecord = parsed as Record<string, unknown>;
  const entity = asRecord.entity;
  const recordId = asRecord.recordId;
  const operation = asRecord.operation;
  if (!['items', 'tasks', 'projects', 'contacts', 'companies'].includes(String(entity))) return null;
  if (typeof recordId !== 'string' || !recordId) return null;
  if (operation !== 'upsert' && operation !== 'delete') return null;
  return {
    entity: entity as EntityKey,
    recordId,
    operation,
    deletedAt: typeof asRecord.deletedAt === 'string' ? asRecord.deletedAt : undefined,
    recordSnapshot: asRecord.recordSnapshot && typeof asRecord.recordSnapshot === 'object'
      ? (asRecord.recordSnapshot as { id: string })
      : undefined,
  };
}

function normalizeLocalCache(parsed: unknown): LocalCachePayload | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const asRecord = parsed as Record<string, unknown>;
  const entities = asRecord.entities;

  if (!entities || typeof entities !== 'object') return null;

  const cloudStatus = asRecord.cloudStatus === 'confirmed' ? 'confirmed' : 'pending';
  const updatedAt = typeof asRecord.updatedAt === 'string' ? asRecord.updatedAt : new Date().toISOString();
  const lastCloudConfirmedAt = typeof asRecord.lastCloudConfirmedAt === 'string' ? asRecord.lastCloudConfirmedAt : undefined;
  const pendingOperations = Array.isArray(asRecord.pendingOperations)
    ? asRecord.pendingOperations.map(normalizePendingOperation).filter((op): op is PendingEntityOperation => Boolean(op))
    : [];
  const lastSaveReceipt = asRecord.lastSaveReceipt && typeof asRecord.lastSaveReceipt === 'object'
    ? asRecord.lastSaveReceipt as SaveBatchReceipt
    : undefined;
  const lastFailedBatchId = typeof asRecord.lastFailedBatchId === 'string' ? asRecord.lastFailedBatchId : undefined;

  return {
    entities: entities as PersistedPayload,
    updatedAt,
    cloudStatus,
    lastCloudConfirmedAt,
    pendingOperations,
    lastSaveReceipt,
    lastFailedBatchId,
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
  const { data, error } = await supabase.from(table).select('record, deleted_at').eq('user_id', userId);
  if (error) throw error;
  return ((data ?? [])
    .filter((row) => !row.deleted_at)
    .map((row) => row.record) as T[]);
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

function entityRecords(payload: PersistedPayload): EntityRecordMap {
  return {
    items: payload.items,
    tasks: payload.tasks,
    projects: payload.projects,
    contacts: payload.contacts,
    companies: payload.companies,
  };
}

function toIndex(records: Array<{ id: string }>): Map<string, { id: string }> {
  return new Map(records.map((record) => [record.id, record]));
}

function recordChanged(nextRecord: { id: string } | undefined, previousRecord: { id: string } | undefined): boolean {
  if (!nextRecord && !previousRecord) return false;
  if (!nextRecord || !previousRecord) return true;
  return JSON.stringify(nextRecord) !== JSON.stringify(previousRecord);
}

function buildEntityDiff(
  entity: EntityKey,
  nextRecords: Array<{ id: string }>,
  previousRecords: Array<{ id: string }>,
): PendingEntityOperation[] {
  const nextById = toIndex(nextRecords);
  const previousById = toIndex(previousRecords);
  const operations: PendingEntityOperation[] = [];

  for (const [recordId, nextRecord] of nextById.entries()) {
    const previousRecord = previousById.get(recordId);
    if (recordChanged(nextRecord, previousRecord)) {
      operations.push({ entity, recordId, operation: 'upsert', recordSnapshot: nextRecord });
    }
  }

  for (const [recordId, previousRecord] of previousById.entries()) {
    if (!nextById.has(recordId)) {
      operations.push({
        entity,
        recordId,
        operation: 'delete',
        deletedAt: new Date().toISOString(),
        recordSnapshot: previousRecord,
      });
    }
  }

  return operations;
}

function buildScopedEntityOps(
  payload: PersistedPayload,
  previousPayload: PersistedPayload,
  dirtyRecords?: DirtyRecordRef[],
): PendingEntityOperation[] {
  if (!dirtyRecords?.length) {
    return ENTITY_CONFIGS.flatMap((config) =>
      buildEntityDiff(config.key, entityRecords(payload)[config.key], entityRecords(previousPayload)[config.key]));
  }

  const requestedByEntity = new Map<EntityKey, Set<string>>();
  ENTITY_CONFIGS.forEach((config) => requestedByEntity.set(config.key, new Set<string>()));
  dirtyRecords.forEach((ref) => {
    const config = ENTITY_CONFIGS.find((candidate) => candidate.dirtyType === ref.type);
    if (!config) return;
    requestedByEntity.get(config.key)?.add(ref.id);
  });

  const operations: PendingEntityOperation[] = [];
  ENTITY_CONFIGS.forEach((config) => {
    const requestedIds = requestedByEntity.get(config.key);
    if (!requestedIds || requestedIds.size === 0) return;
    const nextById = toIndex(entityRecords(payload)[config.key]);
    const previousById = toIndex(entityRecords(previousPayload)[config.key]);
    requestedIds.forEach((recordId) => {
      const nextRecord = nextById.get(recordId);
      const previousRecord = previousById.get(recordId);
      if (nextRecord) {
        if (recordChanged(nextRecord, previousRecord)) {
          operations.push({ entity: config.key, recordId, operation: 'upsert', recordSnapshot: nextRecord });
        }
        return;
      }
      if (previousRecord) {
        operations.push({
          entity: config.key,
          recordId,
          operation: 'delete',
          deletedAt: new Date().toISOString(),
          recordSnapshot: previousRecord,
        });
      }
    });
  });
  return operations;
}

function mergePendingOperations(existing: PendingEntityOperation[], incoming: PendingEntityOperation[]): PendingEntityOperation[] {
  const merged = new Map<string, PendingEntityOperation>();
  [...existing, ...incoming].forEach((operation) => {
    merged.set(`${operation.entity}:${operation.recordId}`, operation);
  });
  return Array.from(merged.values());
}

export function summarizeOperations(operations: PendingEntityOperation[]): SaveBatchEntityCounts {
  const counts: SaveBatchEntityCounts = {
    items: { upserts: 0, deletes: 0 },
    tasks: { upserts: 0, deletes: 0 },
    projects: { upserts: 0, deletes: 0 },
    contacts: { upserts: 0, deletes: 0 },
    companies: { upserts: 0, deletes: 0 },
  };
  operations.forEach((operation) => {
    if (operation.operation === 'upsert') counts[operation.entity].upserts += 1;
    else counts[operation.entity].deletes += 1;
  });
  return counts;
}

function buildHashInput(batch: Pick<SaveBatchEnvelope, 'schemaVersion' | 'operations' | 'auxiliary' | 'operationCount' | 'operationCountsByEntity'>): Record<string, unknown> {
  return {
    schemaVersion: batch.schemaVersion,
    operations: batch.operations,
    auxiliary: batch.auxiliary ?? null,
    operationCount: batch.operationCount,
    operationCountsByEntity: batch.operationCountsByEntity,
  };
}

function createBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `batch-${Math.random().toString(36).slice(2, 11)}-${Date.now().toString(36)}`;
}

export async function buildSaveBatchEnvelope(input: {
  payload: PersistedPayload;
  operations: PendingEntityOperation[];
  clientGeneratedAt?: string;
}): Promise<SaveBatchEnvelope> {
  const clientGeneratedAt = input.clientGeneratedAt ?? new Date().toISOString();
  const operationCountsByEntity = summarizeOperations(input.operations);
  const operationCount = input.operations.length;
  const envelopeBase: Omit<SaveBatchEnvelope, 'clientPayloadHash'> = {
    batchId: createBatchId(),
    schemaVersion: SAVE_BATCH_SCHEMA_VERSION,
    deviceId: getStableDeviceId(),
    sessionId: getSessionScopedId(),
    clientGeneratedAt,
    operations: input.operations,
    operationCount,
    operationCountsByEntity,
    auxiliary: input.payload.auxiliary as unknown as Record<string, unknown>,
  };
  const clientPayloadHash = await computeDeterministicHash(buildHashInput(envelopeBase));
  return { ...envelopeBase, clientPayloadHash };
}

function normalizeSaveBatchReceipt(payload: unknown): SaveBatchReceipt {
  const receipt = (payload ?? {}) as Record<string, unknown>;
  const operationCountsByEntity = (receipt.operationCountsByEntity ?? receipt.operation_counts_by_entity ?? {
    items: { upserts: 0, deletes: 0 },
    tasks: { upserts: 0, deletes: 0 },
    projects: { upserts: 0, deletes: 0 },
    contacts: { upserts: 0, deletes: 0 },
    companies: { upserts: 0, deletes: 0 },
  }) as SaveBatchEntityCounts;
  const status = receipt.status === 'rejected' || receipt.status === 'received' ? receipt.status : 'committed';
  return {
    batchId: String(receipt.batchId ?? receipt.batch_id ?? ''),
    userId: String(receipt.userId ?? receipt.user_id ?? ''),
    status,
    committedAt: typeof receipt.committedAt === 'string' ? receipt.committedAt : typeof receipt.committed_at === 'string' ? receipt.committed_at : undefined,
    schemaVersion: Number(receipt.schemaVersion ?? receipt.schema_version ?? SAVE_BATCH_SCHEMA_VERSION),
    operationCount: Number(receipt.operationCount ?? receipt.operation_count ?? 0),
    operationCountsByEntity,
    touchedTables: Array.isArray(receipt.touchedTables) ? receipt.touchedTables.map(String) : [],
    clientPayloadHash: typeof receipt.clientPayloadHash === 'string' ? receipt.clientPayloadHash : undefined,
    serverPayloadHash: String(receipt.serverPayloadHash ?? receipt.server_payload_hash ?? ''),
    hashMatch: Boolean(receipt.hashMatch),
  };
}

async function commitSaveBatch(batch: SaveBatchEnvelope): Promise<SaveBatchReceipt> {
  const { data, error } = await supabase.rpc('apply_save_batch', { batch });
  if (error) throw error;
  return normalizeSaveBatchReceipt(data);
}

async function applyEntityUpserts(table: string, userId: string, operations: PendingEntityOperation[]): Promise<void> {
  const upserts = operations
    .filter((operation) => operation.operation === 'upsert')
    .map((operation) => ({
      user_id: userId,
      record_id: operation.recordId,
      record: operation.recordSnapshot ?? { id: operation.recordId },
      deleted_at: null,
      updated_at: new Date().toISOString(),
    }));
  if (!upserts.length) return;
  const { error } = await supabase.from(table).upsert(upserts, { onConflict: 'user_id,record_id' });
  if (error) throw error;
}

async function applyEntityDeletes(table: string, userId: string, operations: PendingEntityOperation[]): Promise<{ staleDeleteWarning?: string }> {
  const deletes = operations.filter((operation) => operation.operation === 'delete');
  if (!deletes.length) return {};
  if (deletes.length > STALE_DELETE_ABORT_THRESHOLD) {
    throw new Error(`Delete safety guard triggered for ${table}: refusing to tombstone ${deletes.length} records in one pass.`);
  }
  const rows = deletes.map((operation) => ({
    user_id: userId,
    record_id: operation.recordId,
    record: operation.recordSnapshot ?? { id: operation.recordId },
    deleted_at: operation.deletedAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'user_id,record_id' });
  if (error) throw error;
  return { staleDeleteWarning: `${table}: applied ${deletes.length} explicit tombstone operation${deletes.length === 1 ? '' : 's'}.` };
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
  await applyEntityUpserts('follow_up_items', userId, migrated.items.map((record) => ({ entity: 'items', recordId: record.id, operation: 'upsert', recordSnapshot: record })));
  await applyEntityUpserts('tasks', userId, migrated.tasks.map((record) => ({ entity: 'tasks', recordId: record.id, operation: 'upsert', recordSnapshot: record })));
  await applyEntityUpserts('projects', userId, migrated.projects.map((record) => ({ entity: 'projects', recordId: record.id, operation: 'upsert', recordSnapshot: record })));
  await applyEntityUpserts('contacts', userId, migrated.contacts.map((record) => ({ entity: 'contacts', recordId: record.id, operation: 'upsert', recordSnapshot: record })));
  await applyEntityUpserts('companies', userId, migrated.companies.map((record) => ({ entity: 'companies', recordId: record.id, operation: 'upsert', recordSnapshot: record })));
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
  batchId?: string;

  constructor(message: string, diagnostics: SaveDiagnostics) {
    super(message);
    this.name = 'PersistenceSaveError';
    this.diagnostics = diagnostics;
    this.batchId = diagnostics.batchId ?? diagnostics.failedBatchId;
  }
}

export async function savePersistedPayload(payload: PersistedPayload, options?: { dirtyRecords?: DirtyRecordRef[] }): Promise<SaveResult> {
  const saveAttemptAt = new Date().toISOString();
  const existingCache = readLocalCache();
  const previousPayload = existingCache?.entities ?? buildEmptyPayload();
  const auxiliaryChanged = JSON.stringify(payload.auxiliary) !== JSON.stringify(previousPayload.auxiliary);
  const scopedOps = buildScopedEntityOps(payload, previousPayload, options?.dirtyRecords);
  const pendingOperations = mergePendingOperations(existingCache?.pendingOperations ?? [], scopedOps);
  const diagnostics: SaveDiagnostics = {
    attemptedAt: saveAttemptAt,
    completedTables: [],
    staleDeleteWarnings: [],
    operationCounts: summarizeOperations(pendingOperations),
  };

  writeLocalCache({
    entities: payload,
    updatedAt: saveAttemptAt,
    cloudStatus: 'pending',
    lastCloudConfirmedAt: existingCache?.lastCloudConfirmedAt,
    pendingOperations,
    lastSaveReceipt: existingCache?.lastSaveReceipt,
    lastFailedBatchId: existingCache?.lastFailedBatchId,
  });

  const userId = await getSessionUserId();
  if (!userId) {
    writeLocalCache({
      entities: payload,
      updatedAt: saveAttemptAt,
      cloudStatus: 'confirmed',
      lastCloudConfirmedAt: undefined,
      pendingOperations: [],
      lastSaveReceipt: existingCache?.lastSaveReceipt,
      lastFailedBatchId: undefined,
    });
    return { mode: 'browser', diagnostics };
  }

  if (!auxiliaryChanged && pendingOperations.length === 0) {
    return { mode: 'supabase', diagnostics };
  }
  const excessiveDeletes = pendingOperations.filter((operation) => operation.operation === 'delete').length;
  if (excessiveDeletes > STALE_DELETE_ABORT_THRESHOLD) {
    diagnostics.staleDeleteGuardTriggered = true;
    throw new PersistenceSaveError(
      `Cloud save did not fully complete. Delete safety guard triggered: refusing to process ${excessiveDeletes} tombstones in one batch.`,
      diagnostics,
    );
  }

  const envelope = await buildSaveBatchEnvelope({ payload, operations: pendingOperations, clientGeneratedAt: saveAttemptAt });
  diagnostics.batchId = envelope.batchId;
  try {
    const receipt = await commitSaveBatch(envelope);
    diagnostics.receiptStatus = receipt.status;
    diagnostics.committedAt = receipt.committedAt;
    diagnostics.hashMatch = receipt.hashMatch;
    diagnostics.schemaVersion = receipt.schemaVersion;
    diagnostics.touchedTables = receipt.touchedTables;
    diagnostics.operationCount = receipt.operationCount;
    diagnostics.operationCountsByEntity = receipt.operationCountsByEntity;
    diagnostics.completedTables = receipt.touchedTables;
    if (receipt.status !== 'committed') {
      throw new PersistenceSaveError('Cloud save did not fully complete. Server did not commit the save batch.', {
        ...diagnostics,
        failedBatchId: envelope.batchId,
      });
    }

    writeLocalCache({
      entities: payload,
      updatedAt: saveAttemptAt,
      cloudStatus: 'confirmed',
      lastCloudConfirmedAt: receipt.committedAt ?? saveAttemptAt,
      pendingOperations: [],
      lastSaveReceipt: receipt,
      lastFailedBatchId: undefined,
    });
    return { mode: 'supabase', diagnostics };
  } catch (error) {
    const normalized = normalizePersistenceError(error, { operation: 'save' });
    const rawMessage = formatPersistenceErrorMessage(normalized);
    const failedMatch = rawMessage.match(/for table ([a-z_]+)/) || rawMessage.match(/for ([a-z_]+):/) || rawMessage.match(/save failed:([a-z_]+)/);
    diagnostics.failedTable = failedMatch?.[1] ?? normalized.table;
    diagnostics.staleDeleteGuardTriggered = rawMessage.includes('Delete safety guard triggered');
    diagnostics.failedBatchId = envelope.batchId;
    writeLocalCache({
      entities: payload,
      updatedAt: saveAttemptAt,
      cloudStatus: 'pending',
      lastCloudConfirmedAt: existingCache?.lastCloudConfirmedAt,
      pendingOperations,
      lastSaveReceipt: existingCache?.lastSaveReceipt,
      lastFailedBatchId: envelope.batchId,
    });
    throw new PersistenceSaveError(`Cloud save did not fully complete. ${rawMessage}`, diagnostics);
  }
}
