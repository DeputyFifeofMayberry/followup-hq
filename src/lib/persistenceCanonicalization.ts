import type { ContactRecord, FollowUpItem, ProjectRecord } from '../types';
import type { PersistedPayload } from './persistence';
import type { SaveBatchEntity } from './persistenceTypes';

const FOLLOW_UP_RUNTIME_ONLY_FIELDS = [
  'linkedTaskCount',
  'openLinkedTaskCount',
  'blockedLinkedTaskCount',
  'overdueLinkedTaskCount',
  'doneLinkedTaskCount',
  'allLinkedTasksDone',
  'childWorkflowSignal',
] as const;

const FOLLOW_UP_HYDRATION_ONLY_FIELDS = [
  'lifecycleState',
  'reviewReasons',
  'invalidReason',
  'dataQuality',
  'provenance',
] as const;

const COMMON_TRANSIENT_FIELDS = ['_runtime', '_ui', 'isSelected', 'isExpanded', '__optimistic'] as const;

export interface CanonicalizationMetadata {
  strippedPaths: string[];
  defaultedPaths: string[];
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
  COMMON_TRANSIENT_FIELDS.forEach((key) => {
    delete (clone as Record<string, unknown>)[key];
  });
  return clone;
}

function canonicalizeItem(record: Record<string, unknown>, metadata?: CanonicalizationMetadata): Record<string, unknown> {
  const canonical = normalizeRecordForVerification(record) as FollowUpItem & Record<string, unknown>;
  FOLLOW_UP_RUNTIME_ONLY_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  FOLLOW_UP_HYDRATION_ONLY_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  return canonical;
}

function canonicalizeProject(record: Record<string, unknown>, metadata?: CanonicalizationMetadata): Record<string, unknown> {
  const canonical = normalizeRecordForVerification(record) as ProjectRecord & Record<string, unknown>;
  if (!Array.isArray(canonical.tags)) {
    canonical.tags = [];
    metadata?.defaultedPaths.push('tags');
  }
  if (canonical.archived === undefined) {
    canonical.archived = false;
    metadata?.defaultedPaths.push('archived');
  }
  return canonical;
}

function canonicalizeContact(record: Record<string, unknown>, metadata?: CanonicalizationMetadata): Record<string, unknown> {
  const canonical = normalizeRecordForVerification(record) as ContactRecord & Record<string, unknown>;
  if (!Array.isArray(canonical.tags)) {
    canonical.tags = [];
    metadata?.defaultedPaths.push('tags');
  }
  if (canonical.role === undefined || canonical.role === '') {
    canonical.role = 'External';
    metadata?.defaultedPaths.push('role');
  }
  if (canonical.relationshipStatus === undefined) {
    canonical.relationshipStatus = 'Active';
    metadata?.defaultedPaths.push('relationshipStatus');
  }
  if (canonical.riskTier === undefined) {
    canonical.riskTier = 'Low';
    metadata?.defaultedPaths.push('riskTier');
  }
  if (canonical.active === undefined) {
    canonical.active = true;
    metadata?.defaultedPaths.push('active');
  }
  return canonical;
}

export function canonicalizeEntityRecordForVerification(
  entity: SaveBatchEntity,
  record: Record<string, unknown>,
  metadata?: CanonicalizationMetadata,
): Record<string, unknown> {
  if (entity === 'items') return canonicalizeItem(record, metadata);
  if (entity === 'projects') return canonicalizeProject(record, metadata);
  if (entity === 'contacts') return canonicalizeContact(record, metadata);
  return normalizeRecordForVerification(record);
}

function canonicalizeEntityCollection(entity: SaveBatchEntity, records: unknown[]): unknown[] {
  return records
    .map((record) => canonicalizeEntityRecordForVerification(entity, record as Record<string, unknown>))
    .sort((a, b) => String((a as Record<string, unknown>).id ?? '').localeCompare(String((b as Record<string, unknown>).id ?? '')));
}

export function buildCanonicalVerificationPayload(payload: PersistedPayload): PersistedPayload {
  return {
    ...payload,
    items: canonicalizeEntityCollection('items', payload.items as unknown[]) as PersistedPayload['items'],
    tasks: canonicalizeEntityCollection('tasks', payload.tasks as unknown[]) as PersistedPayload['tasks'],
    projects: canonicalizeEntityCollection('projects', payload.projects as unknown[]) as PersistedPayload['projects'],
    contacts: canonicalizeEntityCollection('contacts', payload.contacts as unknown[]) as PersistedPayload['contacts'],
    companies: canonicalizeEntityCollection('companies', payload.companies as unknown[]) as PersistedPayload['companies'],
  };
}

export function stableHashRecord(record: unknown): string {
  return stableSerialize(normalizeRecordForVerification(record));
}
