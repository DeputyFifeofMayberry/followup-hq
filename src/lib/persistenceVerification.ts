import { supabase } from './supabase';
import type { AppAuxiliaryState, PersistedPayload } from './persistence';
import type { SaveBatchEntity } from './persistenceTypes';

export type VerificationMode = 'manual' | 'post-save' | 'startup-review';

export interface VerificationTargetState {
  payload: PersistedPayload;
  schemaVersionClient?: number;
  lastLocalWriteAt?: string;
}

export interface VerificationSourceSnapshot {
  fetchedAt: string;
  schemaVersionCloud?: number;
  entities: VerificationComparableEntityCollections;
  auxiliary: AppAuxiliaryState | null;
  readSucceeded: boolean;
  readFailureMessage?: string;
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
}

type VerificationComparableEntityCollections = Record<SaveBatchEntity, Map<string, VerificationComparableRecord>>;

const ENTITY_TABLES: Record<SaveBatchEntity, string> = {
  items: 'follow_up_items',
  tasks: 'tasks',
  projects: 'projects',
  contacts: 'contacts',
  companies: 'companies',
};

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

export function normalizeRecordForVerification(record: unknown): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {};
  const clone = structuredClone(record as Record<string, unknown>);
  const transientKeys = ['_runtime', '_ui', 'isSelected', 'isExpanded', '__optimistic'];
  transientKeys.forEach((key) => {
    delete (clone as Record<string, unknown>)[key];
  });
  return clone;
}

export function stableHashRecord(record: unknown): string {
  return stableSerialize(normalizeRecordForVerification(record));
}

export function buildVerificationComparableState(payload: PersistedPayload): VerificationComparableEntityCollections {
  const collections = {} as VerificationComparableEntityCollections;
  (Object.keys(ENTITY_TABLES) as SaveBatchEntity[]).forEach((entity) => {
    const map = new Map<string, VerificationComparableRecord>();
    (payload[entity] ?? []).forEach((record: any) => {
      const id = String(record.id ?? '');
      if (!id) return;
      const normalizedRecord = normalizeRecordForVerification(record);
      map.set(id, {
        id,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
        digest: stableHashRecord(normalizedRecord),
        normalizedRecord,
      });
    });
    collections[entity] = map;
  });
  return collections;
}

async function readCloudSnapshot(): Promise<VerificationSourceSnapshot> {
  const fetchedAt = new Date().toISOString();
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user?.id) {
    return {
      fetchedAt,
      schemaVersionCloud: undefined,
      entities: createEmptyComparableCollections(),
      auxiliary: null,
      readSucceeded: false,
      readFailureMessage: error?.message ?? 'No signed-in session found for cloud verification.',
    };
  }

  const userId = data.session.user.id;
  try {
    const entities = createEmptyComparableCollections();
    for (const entity of Object.keys(ENTITY_TABLES) as SaveBatchEntity[]) {
      const table = ENTITY_TABLES[entity];
      const { data: rows, error: tableError } = await supabase
        .from(table)
        .select('record_id, record, updated_at, deleted_at')
        .eq('user_id', userId);
      if (tableError) throw new Error(`${table}: ${tableError.message}`);
      (rows ?? []).forEach((row: any) => {
        const record = normalizeRecordForVerification(row.record);
        const recordId = String(row.record_id ?? row.record?.id ?? '');
        if (!recordId) return;
        entities[entity].set(recordId, {
          id: recordId,
          updatedAt: typeof row.updated_at === 'string' ? row.updated_at : undefined,
          deletedAt: typeof row.deleted_at === 'string' ? row.deleted_at : null,
          digest: stableHashRecord(record),
          normalizedRecord: record,
        });
      });
    }

    const { data: pref, error: prefError } = await supabase
      .from('user_preferences')
      .select('auxiliary, schema_version, updated_at')
      .eq('user_id', userId)
      .maybeSingle();
    if (prefError) throw new Error(`user_preferences: ${prefError.message}`);

    return {
      fetchedAt,
      schemaVersionCloud: typeof pref?.schema_version === 'number' ? pref.schema_version : undefined,
      entities,
      auxiliary: (pref?.auxiliary as AppAuxiliaryState | null) ?? null,
      readSucceeded: true,
    };
  } catch (readError) {
    return {
      fetchedAt,
      schemaVersionCloud: undefined,
      entities: createEmptyComparableCollections(),
      auxiliary: null,
      readSucceeded: false,
      readFailureMessage: readError instanceof Error ? readError.message : 'Cloud read failed during verification.',
    };
  }
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
        technicalDetail: 'Record exists in local intended state, but no cloud row exists for this record id.',
        localRecordPreview: params.includePreviews && mismatches.length < params.maxMismatchPreviewCount ? local.normalizedRecord : undefined,
      });
      return;
    }

    if (!local && cloud) {
      const isCloudTombstone = Boolean(cloud.deletedAt);
      mismatches.push({
        id: buildMismatchId(params.entity, isCloudTombstone ? 'missing_locally' : 'deleted_locally_but_active_in_cloud', recordId),
        entity: params.entity,
        recordId,
        category: isCloudTombstone ? 'missing_locally' : 'deleted_locally_but_active_in_cloud',
        cloudUpdatedAt: cloud.updatedAt,
        cloudDigest: cloud.digest,
        summary: `${params.entity} ${recordId} exists in cloud but not in local intended state.`,
        technicalDetail: isCloudTombstone
          ? 'Cloud contains a tombstoned record while local intended state has no active row.'
          : 'Cloud contains an active row while local intended state does not.',
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
        technicalDetail: 'Normalized stable digests differ after deterministic comparison.',
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
  const localNormalized = normalizeRecordForVerification(params.localAuxiliary);
  const cloudNormalized = normalizeRecordForVerification(params.cloudAuxiliary ?? {});
  const localDigest = stableHashRecord(localNormalized);
  const cloudDigest = stableHashRecord(cloudNormalized);
  if (localDigest === cloudDigest) return [];
  return [{
    id: buildMismatchId('auxiliary', 'auxiliary_mismatch'),
    entity: 'auxiliary',
    category: 'auxiliary_mismatch',
    localDigest,
    cloudDigest,
    summary: 'Auxiliary preferences/state differ between local intended state and cloud.',
    technicalDetail: 'Deterministic auxiliary blob hash mismatch after removing transient fields.',
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

  return {
    runId: params.runId,
    startedAt: params.startedAt,
    completedAt: params.completedAt,
    basedOnBatchId: params.context.basedOnBatchId,
    basedOnCommittedAt: params.context.basedOnCommittedAt,
    schemaVersionClient: params.schemaVersionClient,
    schemaVersionCloud: params.schemaVersionCloud,
    verified: params.cloudReadSucceeded && params.mismatches.length === 0,
    mismatchCount: params.mismatches.length,
    mismatchCountsByCategory,
    mismatchCountsByEntity,
    comparedRecordCountsByEntity: params.comparedRecordCountsByEntity,
    cloudReadSucceeded: params.cloudReadSucceeded,
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
      technicalDetail: cloudSnapshot.readFailureMessage ?? 'Cloud read failed for verification run.',
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
