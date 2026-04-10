import { supabase } from './supabase';
import type { AppAuxiliaryState, PersistedPayload } from './persistence';
import { normalizePersistenceError } from './persistenceError';
import { canonicalizeEntityRecordForVerification, normalizeRecordForVerification, stableHashRecord, type CanonicalizationMetadata } from './persistenceCanonicalization';
import type { SaveBatchEntity } from './persistenceTypes';

export type VerificationMode = 'manual' | 'post-save' | 'startup-review';

export interface VerificationTargetState {
  payload: PersistedPayload;
  schemaVersionClient?: number;
  lastLocalWriteAt?: string;
  localPayloadSource?: 'cached-persisted-payload' | 'runtime-rebuild';
}

export interface VerificationSourceSnapshot {
  fetchedAt: string;
  schemaVersionCloud?: number;
  entities: VerificationComparableEntityCollections;
  auxiliary: AppAuxiliaryState | null;
  readSucceeded: boolean;
  readFailureMessage?: string;
  readFailureKind?: 'no-session' | 'auth-session' | 'auth-refresh' | 'table-read' | 'backend-contract' | 'network';
  readFailureStage?: 'auth' | SaveBatchEntity | 'user_preferences' | 'unknown';
  attempts?: number;
}

export interface VerificationRunContext {
  mode: VerificationMode;
  basedOnBatchId?: string;
  basedOnCommittedAt?: string;
  includePreviews?: boolean;
  maxMismatchPreviewCount?: number;
}

export type VerificationMismatchCategory =
  | 'missing_in_cloud'
  | 'missing_locally'
  | 'newer_locally'
  | 'newer_in_cloud'
  | 'content_mismatch'
  | 'deleted_locally_but_active_in_cloud'
  | 'tombstoned_in_cloud_but_active_locally'
  | 'auxiliary_mismatch'
  | 'schema_version_mismatch'
  | 'verification_read_failed';

export interface VerificationMismatch {
  id: string;
  entity: SaveBatchEntity | 'auxiliary' | 'verification';
  recordId?: string;
  category: VerificationMismatchCategory;
  localUpdatedAt?: string;
  cloudUpdatedAt?: string;
  localDigest?: string;
  cloudDigest?: string;
  summary: string;
  technicalDetail: string;
  localRecordPreview?: object;
  cloudRecordPreview?: object;
}

export interface VerificationEntitySummary {
  entity: SaveBatchEntity | 'auxiliary';
  mismatchCount: number;
  comparedRecords: number;
}

export interface VerificationSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  basedOnBatchId?: string;
  basedOnCommittedAt?: string;
  schemaVersionClient?: number;
  schemaVersionCloud?: number;
  verified: boolean;
  mismatchCount: number;
  mismatchCountsByCategory: Record<VerificationMismatchCategory, number>;
  mismatchCountsByEntity: Record<string, number>;
  comparedRecordCountsByEntity: Record<string, number>;
  cloudReadSucceeded: boolean;
  verificationReadFailed: boolean;
  verificationReadFailureMessage?: string;
  verificationReadFailureKind?: VerificationSourceSnapshot['readFailureKind'];
  verificationReadFailureStage?: VerificationSourceSnapshot['readFailureStage'];
  verificationReadAttempts: number;
  auxiliaryCompared: boolean;
  verificationMode: VerificationMode;
  exportableReportId?: string;
}

export interface VerificationResult {
  summary: VerificationSummary;
  mismatches: VerificationMismatch[];
  entitySummaries: VerificationEntitySummary[];
  localSnapshotSummary: RecoverySnapshotSummary;
  cloudSnapshotSummary: RecoverySnapshotSummary;
}

export interface RecoverySnapshotSummary {
  source: 'local' | 'cloud';
  capturedAt: string;
  countsByEntity: Record<SaveBatchEntity, number>;
  schemaVersion?: number;
  basedOnBatchId?: string;
  basedOnCommittedAt?: string;
  freshCloudRead: boolean;
}

export interface VerificationReportExport {
  reportId: string;
  generatedAt: string;
  verificationResult: VerificationResult;
}

export interface VerificationIncidentExport {
  generatedAt: string;
  appVersion?: string;
  userId?: string;
  lastConfirmedBatchId?: string;
  lastConfirmedCommittedAt?: string;
  lastLocalWriteAt?: string;
  verificationSummary: VerificationSummary;
  mismatchList: VerificationMismatch[];
  mismatchCounts: {
    byCategory: Record<VerificationMismatchCategory, number>;
    byEntity: Record<string, number>;
  };
  schemaVersionInfo: {
    client?: number;
    cloud?: number;
  };
  cloudConfirmationStatus?: string;
  sessionTrustState?: string;
  degradedReason?: string;
  receiptMetadata?: {
    status?: string;
    hashMatch?: boolean;
    touchedTables?: string[];
    operationCount?: number;
  };
  sanitizedTechnicalDetails: {
    cloudReadSucceeded: boolean;
    verificationReadFailed?: boolean;
    verificationReadFailureMessage?: string;
    verificationReadFailureKind?: VerificationSourceSnapshot['readFailureKind'];
    verificationReadFailureStage?: VerificationSourceSnapshot['readFailureStage'];
    verificationReadAttempts?: number;
    basedOnBatchId?: string;
    basedOnCommittedAt?: string;
    verificationMode: VerificationMode;
  };
}

interface VerificationComparableRecord {
  id: string;
  updatedAt?: string;
  deletedAt?: string | null;
  digest: string;
  normalizedRecord: Record<string, unknown>;
  canonicalStrippedPaths: string[];
  canonicalDefaultedPaths: string[];
}

type VerificationComparableEntityCollections = Record<SaveBatchEntity, Map<string, VerificationComparableRecord>>;
interface VerificationAuthClient {
  getSession: typeof supabase.auth.getSession;
  getUser: typeof supabase.auth.getUser;
}

const ENTITY_TABLES: Record<SaveBatchEntity, string> = {
  items: 'follow_up_items',
  tasks: 'tasks',
  projects: 'projects',
  contacts: 'contacts',
  companies: 'companies',
};


const AUXILIARY_DEFAULTS: Partial<AppAuxiliaryState> = {
  followUpTableDensity: 'compact',
  followUpDuplicateModule: 'auto',
};

export { stableHashRecord };

const AUXILIARY_ARRAY_DEFAULT_KEYS: Array<keyof AppAuxiliaryState> = [
  'savedFollowUpViews',
  'reminderLedger',
  'intakeSignals',
  'intakeDocuments',
  'dismissedDuplicatePairs',
  'droppedEmailImports',
  'outlookMessages',
  'forwardedEmails',
  'forwardedRules',
  'forwardedCandidates',
  'forwardedLedger',
  'forwardedRoutingAudit',
  'intakeCandidates',
  'intakeAssets',
  'intakeBatches',
  'intakeWorkCandidates',
  'intakeReviewerFeedback',
  'savedExecutionViews',
  'followUpColumns',
];

function createRunId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `verify-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, v]) => `${JSON.stringify(key)}:${stableSerialize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}



function canonicalizeAuxiliaryForVerification(auxiliary: AppAuxiliaryState | null | undefined): AppAuxiliaryState {
  const normalizedRaw = normalizeRecordForVerification(auxiliary ?? {}) as unknown as AppAuxiliaryState;
  const normalized = Object.fromEntries(
    Object.entries(normalizedRaw as unknown as Record<string, unknown>).filter(([, value]) => value !== undefined),
  ) as unknown as AppAuxiliaryState;
  const merged = {
    ...AUXILIARY_DEFAULTS,
    ...normalized,
  } as AppAuxiliaryState;
  AUXILIARY_ARRAY_DEFAULT_KEYS.forEach((key) => {
    if (!Array.isArray(merged[key])) {
      (merged as unknown as Record<string, unknown>)[key] = [];
    }
  });
  return merged;
}

function diffObjectPaths(local: unknown, cloud: unknown, basePath = ''): string[] {
  const localObj = local && typeof local === 'object' ? local as Record<string, unknown> : {};
  const cloudObj = cloud && typeof cloud === 'object' ? cloud as Record<string, unknown> : {};
  const keys = Array.from(new Set([...Object.keys(localObj), ...Object.keys(cloudObj)])).sort();
  const diffs: string[] = [];

  keys.forEach((key) => {
    const path = basePath ? `${basePath}.${key}` : key;
    const left = localObj[key];
    const right = cloudObj[key];
    if (Array.isArray(left) || Array.isArray(right)) {
      if (stableSerialize(left ?? []) !== stableSerialize(right ?? [])) diffs.push(path);
      return;
    }
    const bothObjects = left && right && typeof left === 'object' && typeof right === 'object';
    if (bothObjects) {
      diffs.push(...diffObjectPaths(left, right, path));
      return;
    }
    if (stableSerialize(left) !== stableSerialize(right)) diffs.push(path);
  });

  return diffs;
}

export function buildVerificationComparableState(payload: PersistedPayload): VerificationComparableEntityCollections {
  const collections = {} as VerificationComparableEntityCollections;
  (Object.keys(ENTITY_TABLES) as SaveBatchEntity[]).forEach((entity) => {
    const map = new Map<string, VerificationComparableRecord>();
    (payload[entity] ?? []).forEach((record: any) => {
      const id = String(record.id ?? '');
      if (!id) return;
      const metadata: CanonicalizationMetadata = { strippedPaths: [], defaultedPaths: [] };
      const normalizedRecord = canonicalizeEntityRecordForVerification(entity, record as Record<string, unknown>, metadata);
      map.set(id, {
        id,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
        digest: stableHashRecord(normalizedRecord),
        normalizedRecord,
        canonicalStrippedPaths: metadata.strippedPaths,
        canonicalDefaultedPaths: metadata.defaultedPaths,
      });
    });
    collections[entity] = map;
  });
  return collections;
}

async function readCloudSnapshot(): Promise<VerificationSourceSnapshot> {
  const fetchedAt = new Date().toISOString();
  const sessionResolution = await resolveVerificationSessionUserIdWithRetry();
  if (!sessionResolution.userId) {
    return {
      fetchedAt,
      schemaVersionCloud: undefined,
      entities: createEmptyComparableCollections(),
      auxiliary: null,
      readSucceeded: false,
      readFailureMessage: sessionResolution.message,
      readFailureKind: sessionResolution.kind,
      readFailureStage: 'auth',
      attempts: sessionResolution.attempts,
    };
  }

  const userId = sessionResolution.userId;
  try {
    const entities = createEmptyComparableCollections();
    for (const entity of Object.keys(ENTITY_TABLES) as SaveBatchEntity[]) {
      const table = ENTITY_TABLES[entity];
      const { rows, error: tableError } = await readVerificationTableWithRetry(table, userId);
      if (tableError) throw new Error(`${table}: ${tableError.message}`);
      rows.forEach((row: any) => {
        const record = normalizeRecordForVerification(row.record);
        const metadata: CanonicalizationMetadata = { strippedPaths: [], defaultedPaths: [] };
        const canonicalRecord = canonicalizeEntityRecordForVerification(entity, record, metadata);
        const recordId = String(row.record_id ?? row.record?.id ?? '');
        if (!recordId) return;
        entities[entity].set(recordId, {
          id: recordId,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
          deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
          digest: stableHashRecord(canonicalRecord),
          normalizedRecord: canonicalRecord,
          canonicalStrippedPaths: metadata.strippedPaths,
          canonicalDefaultedPaths: metadata.defaultedPaths,
        });
      });
    }

    const { data: pref, error: prefError } = await supabase
      .from('user_preferences')
      .select('auxiliary, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (prefError) {
      return {
        fetchedAt,
        schemaVersionCloud: undefined,
        entities: createEmptyComparableCollections(),
        auxiliary: null,
        readSucceeded: false,
        readFailureMessage: `user_preferences: ${prefError.message}`,
        readFailureKind: classifyReadFailureKind(prefError),
        readFailureStage: 'user_preferences',
        attempts: sessionResolution.attempts,
      };
    }

    return {
      fetchedAt,
      schemaVersionCloud: undefined,
      entities,
      auxiliary: (pref?.auxiliary as AppAuxiliaryState | null) ?? null,
      readSucceeded: true,
      attempts: sessionResolution.attempts,
    };
  } catch (readError) {
    return {
      fetchedAt,
      schemaVersionCloud: undefined,
      entities: createEmptyComparableCollections(),
      auxiliary: null,
      readSucceeded: false,
      readFailureMessage: readError instanceof Error ? readError.message : 'Cloud read failed during verification.',
      readFailureKind: classifyReadFailureKind(readError),
      readFailureStage: 'unknown',
      attempts: sessionResolution.attempts,
    };
  }
}

export async function resolveVerificationSessionUserIdWithRetry(authClient: VerificationAuthClient = supabase.auth): Promise<{ userId?: string; attempts: number; kind: VerificationSourceSnapshot['readFailureKind']; message: string }> {
  let attempts = 0;
  for (let index = 0; index < 2; index += 1) {
    attempts += 1;
    const { data, error } = await authClient.getSession();
    if (data.session?.user?.id) {
      return { userId: data.session.user.id, attempts, kind: 'auth-session', message: '' };
    }

    if (index === 0 && !error) {
      const { data: userData, error: userError } = await authClient.getUser();
      if (userData.user?.id) return { userId: userData.user.id, attempts, kind: 'auth-session', message: '' };
      if (userError) {
        return {
          attempts,
          kind: 'auth-refresh',
          message: `Auth refresh failed while preparing verification read: ${userError.message}`,
        };
      }
      continue;
    }

    if (error) {
      return {
        attempts,
        kind: classifyReadFailureKind(error) ?? 'auth-session',
        message: `Auth session lookup failed during verification read: ${error.message}`,
      };
    }
  }

  return {
    attempts,
    kind: 'no-session',
    message: 'Verification cloud read could not start because no signed-in session was available.',
  };
}

async function readVerificationTableWithRetry(table: string, userId: string): Promise<{ rows: any[]; error: any | null }> {
  let lastError: any | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { data: rows, error } = await supabase
      .from(table)
      .select('record_id, record, updated_at, deleted_at')
      .eq('user_id', userId);
    if (!error) return { rows: rows ?? [], error: null };
    lastError = error;
    const transient = classifyReadFailureKind(error) === 'network';
    if (!transient) break;
  }
  return { rows: [], error: lastError };
}

export function classifyReadFailureKind(error: unknown): VerificationSourceSnapshot['readFailureKind'] {
  const normalized = normalizePersistenceError(error, { operation: 'verification-read' });
  const lowered = [normalized.message, normalized.details, normalized.hint, normalized.rawSummary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const code = normalized.code?.toUpperCase();

  if (code === '42703' || (lowered.includes('column') && lowered.includes('does not exist'))) return 'backend-contract';
  if (code === 'PGRST205' || (lowered.includes('relation') && lowered.includes('does not exist'))) return 'backend-contract';
  if (code === 'PGRST202' || lowered.includes('could not find the function')) return 'backend-contract';
  if (lowered.includes('network') || lowered.includes('fetch') || lowered.includes('timeout')) return 'network';
  if (lowered.includes('jwt') || lowered.includes('token') || lowered.includes('refresh')) return 'auth-refresh';
  if (lowered.includes('auth') || lowered.includes('session')) return 'auth-session';
  if (lowered.includes('follow_up_items') || lowered.includes('tasks') || lowered.includes('projects') || lowered.includes('contacts') || lowered.includes('companies') || lowered.includes('user_preferences')) return 'table-read';
  return 'table-read';
}

function createEmptyComparableCollections(): VerificationComparableEntityCollections {
  return {
    items: new Map(),
    tasks: new Map(),
    projects: new Map(),
    contacts: new Map(),
    companies: new Map(),
  };
}

function buildMismatchId(entity: string, category: VerificationMismatchCategory, recordId?: string): string {
  return `${entity}:${category}:${recordId ?? 'n-a'}`;
}

export function compareEntityCollections(params: {
  entity: SaveBatchEntity;
  local: Map<string, VerificationComparableRecord>;
  cloud: Map<string, VerificationComparableRecord>;
  includePreviews: boolean;
  maxMismatchPreviewCount: number;
}): VerificationMismatch[] {
  const mismatches: VerificationMismatch[] = [];
  const ids = new Set([...params.local.keys(), ...params.cloud.keys()]);

  ids.forEach((recordId) => {
    const local = params.local.get(recordId);
    const cloud = params.cloud.get(recordId);

    if (local && !cloud) {
      mismatches.push({
        id: buildMismatchId(params.entity, 'missing_in_cloud', recordId),
        entity: params.entity,
        recordId,
        category: 'missing_in_cloud',
        localUpdatedAt: local.updatedAt,
        localDigest: local.digest,
        summary: `${params.entity} ${recordId} exists locally but was not found in cloud.`,
        technicalDetail: `Record exists in local intended state, but no cloud row exists for this record id. Stripped fields(local): ${(local.canonicalStrippedPaths ?? []).join('|') || 'none'}. Defaulted fields(local): ${(local.canonicalDefaultedPaths ?? []).join('|') || 'none'}.`,
        localRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? local.normalizedRecord : undefined,
      });
      return;
    }

    if (!local && cloud) {
      const isCloudTombstone = Boolean(cloud.deletedAt);
      if (isCloudTombstone) return;
      mismatches.push({
        id: buildMismatchId(params.entity, 'deleted_locally_but_active_in_cloud', recordId),
        entity: params.entity,
        recordId,
        category: 'deleted_locally_but_active_in_cloud',
        cloudUpdatedAt: cloud.updatedAt,
        cloudDigest: cloud.digest,
        summary: `${params.entity} ${recordId} exists in cloud but not in local intended state.`,
        technicalDetail: `Cloud contains an active row while local intended state does not. Stripped fields(cloud): ${(cloud.canonicalStrippedPaths ?? []).join('|') || 'none'}. Defaulted fields(cloud): ${(cloud.canonicalDefaultedPaths ?? []).join('|') || 'none'}.`,
        cloudRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? cloud.normalizedRecord : undefined,
      });
      return;
    }

    if (!local || !cloud) return;

    if (cloud.deletedAt) {
      mismatches.push({
        id: buildMismatchId(params.entity, 'tombstoned_in_cloud_but_active_locally', recordId),
        entity: params.entity,
        recordId,
        category: 'tombstoned_in_cloud_but_active_locally',
        localUpdatedAt: local.updatedAt,
        cloudUpdatedAt: cloud.updatedAt,
        localDigest: local.digest,
        cloudDigest: cloud.digest,
        summary: `${params.entity} ${recordId} is tombstoned in cloud but active locally.`,
        technicalDetail: 'Cloud row is tombstoned (deleted_at set) while local intended state retains an active record.',
        localRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? local.normalizedRecord : undefined,
        cloudRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? cloud.normalizedRecord : undefined,
      });
      return;
    }

    if (local.digest !== cloud.digest) {
      const diffPaths = diffObjectPaths(local.normalizedRecord, cloud.normalizedRecord).slice(0, 8);
      mismatches.push({
        id: buildMismatchId(params.entity, 'content_mismatch', recordId),
        entity: params.entity,
        recordId,
        category: 'content_mismatch',
        localUpdatedAt: local.updatedAt,
        cloudUpdatedAt: cloud.updatedAt,
        localDigest: local.digest,
        cloudDigest: cloud.digest,
        summary: `${params.entity} ${recordId} has different content locally vs cloud.`,
        technicalDetail: `Canonical persisted fields differ after deterministic comparison.${diffPaths.length ? ` Changed paths: ${diffPaths.join(', ')}` : ''}${local.canonicalStrippedPaths.length || cloud.canonicalStrippedPaths.length ? ` Stripped fields(local/cloud): ${(local.canonicalStrippedPaths ?? []).join('|') || 'none'} / ${(cloud.canonicalStrippedPaths ?? []).join('|') || 'none'}.` : ''}${local.canonicalDefaultedPaths.length || cloud.canonicalDefaultedPaths.length ? ` Defaulted fields(local/cloud): ${(local.canonicalDefaultedPaths ?? []).join('|') || 'none'} / ${(cloud.canonicalDefaultedPaths ?? []).join('|') || 'none'}.` : ''}`,
        localRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? local.normalizedRecord : undefined,
        cloudRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? cloud.normalizedRecord : undefined,
      });
      return;
    }

    if (local.updatedAt && cloud.updatedAt) {
      const localTime = new Date(local.updatedAt).getTime();
      const cloudTime = new Date(cloud.updatedAt).getTime();
      if (Number.isFinite(localTime) && Number.isFinite(cloudTime) && localTime !== cloudTime) {
        const category: VerificationMismatchCategory = localTime > cloudTime ? 'newer_locally' : 'newer_in_cloud';
        mismatches.push({
          id: buildMismatchId(params.entity, category, recordId),
          entity: params.entity,
          recordId,
          category,
          localUpdatedAt: local.updatedAt,
          cloudUpdatedAt: cloud.updatedAt,
          localDigest: local.digest,
          cloudDigest: cloud.digest,
          summary: `${params.entity} ${recordId} timestamps differ between local and cloud.`,
          technicalDetail: 'Record content matches but updated timestamp drift indicates timeline mismatch.',
        });
      }
    }
  });

  return mismatches;
}

export function compareAuxiliaryState(params: {
  localAuxiliary: AppAuxiliaryState;
  cloudAuxiliary: AppAuxiliaryState | null;
  includePreviews: boolean;
}): VerificationMismatch[] {
  const localNormalized = canonicalizeAuxiliaryForVerification(params.localAuxiliary);
  const cloudNormalized = canonicalizeAuxiliaryForVerification(params.cloudAuxiliary);
  const localDigest = stableHashRecord(localNormalized);
  const cloudDigest = stableHashRecord(cloudNormalized);
  if (localDigest === cloudDigest) return [];
  const diffPaths = diffObjectPaths(localNormalized, cloudNormalized).slice(0, 12);
  return [{
    id: buildMismatchId('auxiliary', 'auxiliary_mismatch'),
    entity: 'auxiliary',
    category: 'auxiliary_mismatch',
    localDigest,
    cloudDigest,
    summary: 'Auxiliary preferences/state differ between local intended state and cloud.',
    technicalDetail: `Canonical auxiliary persisted state differs.${diffPaths.length ? ` Changed paths: ${diffPaths.join(', ')}` : ''}`,
    localRecordPreview: params.includePreviews ? localNormalized : undefined,
    cloudRecordPreview: params.includePreviews ? cloudNormalized : undefined,
  }];
}

export function buildVerificationSummary(params: {
  runId: string;
  startedAt: string;
  completedAt: string;
  context: VerificationRunContext;
  mismatches: VerificationMismatch[];
  comparedRecordCountsByEntity: Record<string, number>;
  cloudReadSucceeded: boolean;
  cloudReadFailureMessage?: string;
  cloudReadFailureKind?: VerificationSourceSnapshot['readFailureKind'];
  cloudReadFailureStage?: VerificationSourceSnapshot['readFailureStage'];
  cloudReadAttempts?: number;
  schemaVersionClient?: number;
  schemaVersionCloud?: number;
}): VerificationSummary {
  const mismatchCountsByCategory = {
    missing_in_cloud: 0,
    missing_locally: 0,
    newer_locally: 0,
    newer_in_cloud: 0,
    content_mismatch: 0,
    deleted_locally_but_active_in_cloud: 0,
    tombstoned_in_cloud_but_active_locally: 0,
    auxiliary_mismatch: 0,
    schema_version_mismatch: 0,
    verification_read_failed: 0,
  } satisfies Record<VerificationMismatchCategory, number>;
  const mismatchCountsByEntity: Record<string, number> = {};

  params.mismatches.forEach((mismatch) => {
    mismatchCountsByCategory[mismatch.category] += 1;
    mismatchCountsByEntity[mismatch.entity] = (mismatchCountsByEntity[mismatch.entity] ?? 0) + 1;
  });

  const trueMismatchCount = params.mismatches.filter((mismatch) => mismatch.category !== 'verification_read_failed').length;

  return {
    runId: params.runId,
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    basedOnBatchId: params.context.basedOnBatchId,
    basedOnCommittedAt: params.context.basedOnCommittedAt,
    schemaVersionClient: params.schemaVersionClient,
    schemaVersionCloud: params.schemaVersionCloud,
    verified: params.cloudReadSucceeded && trueMismatchCount === 0,
    mismatchCount: trueMismatchCount,
    mismatchCountsByCategory,
    mismatchCountsByEntity,
    comparedRecordCountsByEntity: params.comparedRecordCountsByEntity,
    cloudReadSucceeded: params.cloudReadSucceeded,
    verificationReadFailed: !params.cloudReadSucceeded,
    verificationReadFailureMessage: params.cloudReadFailureMessage,
    verificationReadFailureKind: params.cloudReadFailureKind,
    verificationReadFailureStage: params.cloudReadFailureStage,
    verificationReadAttempts: params.cloudReadAttempts ?? 1,
    auxiliaryCompared: true,
    verificationMode: params.context.mode,
    exportableReportId: `verification-${params.runId}`,
  };
}

export async function verifyPersistedState(options: {
  target: VerificationTargetState;
  context: VerificationRunContext;
  cloudSnapshotReader?: () => Promise<VerificationSourceSnapshot>;
}): Promise<VerificationResult> {
  const runId = createRunId();
  const startedAt = new Date().toISOString();
  const cloudSnapshot = await (options.cloudSnapshotReader?.() ?? readCloudSnapshot());
  const includePreviews = options.context.includePreviews ?? true;
  const maxMismatchPreviewCount = options.context.maxMismatchPreviewCount ?? 30;

  const localComparable = buildVerificationComparableState(options.target.payload);
  const comparedRecordCountsByEntity: Record<string, number> = {};
  const mismatches: VerificationMismatch[] = [];

  if (!cloudSnapshot.readSucceeded) {
    mismatches.push({
      id: buildMismatchId('verification', 'verification_read_failed'),
      entity: 'verification',
      category: 'verification_read_failed',
      summary: 'Could not verify current cloud match.',
      technicalDetail: `${cloudSnapshot.readFailureMessage ?? 'Cloud read failed for verification run.'} Local source: ${options.target.localPayloadSource ?? 'runtime-rebuild'}.`,
    });
  } else {
    (Object.keys(ENTITY_TABLES) as SaveBatchEntity[]).forEach((entity) => {
      comparedRecordCountsByEntity[entity] = Math.max(localComparable[entity].size, cloudSnapshot.entities[entity].size);
      mismatches.push(...compareEntityCollections({
        entity,
        local: localComparable[entity],
        cloud: cloudSnapshot.entities[entity],
        includePreviews,
        maxMismatchPreviewCount,
      }));
    });

    mismatches.push(...compareAuxiliaryState({
      localAuxiliary: options.target.payload.auxiliary,
      cloudAuxiliary: cloudSnapshot.auxiliary,
      includePreviews,
    }));

    if (
      options.target.schemaVersionClient != null
      && cloudSnapshot.schemaVersionCloud != null
      && options.target.schemaVersionClient !== cloudSnapshot.schemaVersionCloud
    ) {
      mismatches.push({
        id: buildMismatchId('verification', 'schema_version_mismatch'),
        entity: 'verification',
        category: 'schema_version_mismatch',
        summary: 'Schema version mismatch between local client and cloud snapshot.',
        technicalDetail: `Client schema version ${options.target.schemaVersionClient}, cloud schema version ${cloudSnapshot.schemaVersionCloud}.`,
      });
    }
  }

  const completedAt = new Date().toISOString();
  const summary = buildVerificationSummary({
    runId,
    startedAt,
    completedAt,
    context: options.context,
    mismatches,
    comparedRecordCountsByEntity,
    cloudReadSucceeded: cloudSnapshot.readSucceeded,
    cloudReadFailureMessage: cloudSnapshot.readFailureMessage,
    cloudReadFailureKind: cloudSnapshot.readFailureKind,
    cloudReadFailureStage: cloudSnapshot.readFailureStage,
    cloudReadAttempts: cloudSnapshot.attempts,
    schemaVersionClient: options.target.schemaVersionClient,
    schemaVersionCloud: cloudSnapshot.schemaVersionCloud,
  });

  const entitySummaries: VerificationEntitySummary[] = ([...Object.keys(ENTITY_TABLES), 'auxiliary'] as Array<SaveBatchEntity | 'auxiliary'>).map((entity) => ({
    entity,
    mismatchCount: mismatches.filter((mismatch) => mismatch.entity === entity).length,
    comparedRecords: comparedRecordCountsByEntity[entity] ?? (entity === 'auxiliary' ? 1 : 0),
  }));

  return {
    summary,
    mismatches,
    entitySummaries,
    localSnapshotSummary: {
      source: 'local',
      capturedAt: startedAt,
      countsByEntity: {
        items: options.target.payload.items.length,
        tasks: options.target.payload.tasks.length,
        projects: options.target.payload.projects.length,
        contacts: options.target.payload.contacts.length,
        companies: options.target.payload.companies.length,
      },
      schemaVersion: options.target.schemaVersionClient,
      basedOnBatchId: options.context.basedOnBatchId,
      basedOnCommittedAt: options.context.basedOnCommittedAt,
      freshCloudRead: false,
    },
    cloudSnapshotSummary: {
      source: 'cloud',
      capturedAt: cloudSnapshot.fetchedAt,
      countsByEntity: {
        items: Array.from(cloudSnapshot.entities.items.values()).filter((r) => !r.deletedAt).length,
        tasks: Array.from(cloudSnapshot.entities.tasks.values()).filter((r) => !r.deletedAt).length,
        projects: Array.from(cloudSnapshot.entities.projects.values()).filter((r) => !r.deletedAt).length,
        contacts: Array.from(cloudSnapshot.entities.contacts.values()).filter((r) => !r.deletedAt).length,
        companies: Array.from(cloudSnapshot.entities.companies.values()).filter((r) => !r.deletedAt).length,
      },
      schemaVersion: cloudSnapshot.schemaVersionCloud,
      basedOnBatchId: options.context.basedOnBatchId,
      basedOnCommittedAt: options.context.basedOnCommittedAt,
      freshCloudRead: true,
    },
  };
}

export function exportVerificationIncident(input: {
  verificationResult: VerificationResult;
  appVersion?: string;
  userId?: string;
  lastConfirmedBatchId?: string;
  lastConfirmedCommittedAt?: string;
  lastLocalWriteAt?: string;
  cloudConfirmationStatus?: string;
  sessionTrustState?: string;
  degradedReason?: string;
  receiptMetadata?: VerificationIncidentExport['receiptMetadata'];
}): VerificationIncidentExport {
  return {
    generatedAt: new Date().toISOString(),
    appVersion: input.appVersion,
    userId: input.userId,
    lastConfirmedBatchId: input.lastConfirmedBatchId,
    lastConfirmedCommittedAt: input.lastConfirmedCommittedAt,
    lastLocalWriteAt: input.lastLocalWriteAt,
    verificationSummary: input.verificationResult.summary,
    mismatchList: input.verificationResult.mismatches,
    mismatchCounts: {
      byCategory: input.verificationResult.summary.mismatchCountsByCategory,
      byEntity: input.verificationResult.summary.mismatchCountsByEntity,
    },
    schemaVersionInfo: {
      client: input.verificationResult.summary.schemaVersionClient,
      cloud: input.verificationResult.summary.schemaVersionCloud,
    },
    cloudConfirmationStatus: input.cloudConfirmationStatus,
    sessionTrustState: input.sessionTrustState,
    degradedReason: input.degradedReason,
    receiptMetadata: input.receiptMetadata,
    sanitizedTechnicalDetails: {
      cloudReadSucceeded: input.verificationResult.summary.cloudReadSucceeded,
      verificationReadFailed: input.verificationResult.summary.verificationReadFailed,
      verificationReadFailureMessage: input.verificationResult.summary.verificationReadFailureMessage,
      verificationReadFailureKind: input.verificationResult.summary.verificationReadFailureKind,
      verificationReadFailureStage: input.verificationResult.summary.verificationReadFailureStage,
      verificationReadAttempts: input.verificationResult.summary.verificationReadAttempts,
      basedOnBatchId: input.verificationResult.summary.basedOnBatchId,
      basedOnCommittedAt: input.verificationResult.summary.basedOnCommittedAt,
      verificationMode: input.verificationResult.summary.verificationMode,
    },
  };
}

export function downloadVerificationIncidentReport(report: VerificationIncidentExport): string {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `setpoint-verification-incident-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return anchor.download;
}
