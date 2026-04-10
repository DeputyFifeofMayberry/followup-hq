import type { ContactRecord, FollowUpItem, ProjectRecord } from '../types';
import type { PersistedPayload } from './persistence';
import type { SaveBatchEntity } from './persistenceTypes';
import { normalizeItem } from './utils';
import { normalizeContact } from '../domains/relationships/helpers';
import { normalizeProjectRecord } from '../domains/projects/helpers';

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
const SYNC_TRANSPORT_FIELDS = ['recordVersion', 'updatedByDevice', 'lastBatchId', 'lastOperationAt', 'deletedAt', 'conflictMarker'] as const;

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
  const raw = normalizeRecordForVerification(record) as Record<string, unknown>;
  const seeded = {
    id: String(raw.id ?? ''),
    title: String(raw.title ?? ''),
    source: (raw.source as FollowUpItem['source']) ?? 'Notes',
    project: String(raw.project ?? ''),
    owner: String(raw.owner ?? ''),
    status: (raw.status as FollowUpItem['status']) ?? 'Needs action',
    priority: (raw.priority as FollowUpItem['priority']) ?? 'Medium',
    dueDate: typeof raw.dueDate === 'string' ? raw.dueDate : '1970-01-01T00:00:00.000Z',
    lastTouchDate: typeof raw.lastTouchDate === 'string' ? raw.lastTouchDate : '1970-01-01T00:00:00.000Z',
    nextTouchDate: typeof raw.nextTouchDate === 'string' ? raw.nextTouchDate : '1970-01-01T00:00:00.000Z',
    nextAction: String(raw.nextAction ?? ''),
    summary: String(raw.summary ?? ''),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    sourceRef: String(raw.sourceRef ?? ''),
    sourceRefs: Array.isArray(raw.sourceRefs) ? raw.sourceRefs : [],
    mergedItemIds: Array.isArray(raw.mergedItemIds) ? raw.mergedItemIds : [],
    notes: String(raw.notes ?? ''),
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    category: (raw.category as FollowUpItem['category']) ?? 'General',
    owesNextAction: (raw.owesNextAction as FollowUpItem['owesNextAction']) ?? 'Unknown',
    escalationLevel: (raw.escalationLevel as FollowUpItem['escalationLevel']) ?? 'None',
    cadenceDays: typeof raw.cadenceDays === 'number' && raw.cadenceDays > 0 ? raw.cadenceDays : 3,
    ...raw,
  } as FollowUpItem;
  const canonical = normalizeItem(seeded) as FollowUpItem & Record<string, unknown>;
  FOLLOW_UP_RUNTIME_ONLY_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  FOLLOW_UP_HYDRATION_ONLY_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  SYNC_TRANSPORT_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  return canonical;
}

function canonicalizeProject(record: Record<string, unknown>, metadata?: CanonicalizationMetadata): Record<string, unknown> {
  const raw = normalizeRecordForVerification(record) as ProjectRecord & Record<string, unknown>;
  const canonical = normalizeProjectRecord(raw) as ProjectRecord & Record<string, unknown>;
  if (!Array.isArray(raw.tags) && Array.isArray(canonical.tags)) metadata?.defaultedPaths.push('tags');
  SYNC_TRANSPORT_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
  return canonical;
}

function canonicalizeContact(record: Record<string, unknown>, metadata?: CanonicalizationMetadata): Record<string, unknown> {
  const raw = normalizeRecordForVerification(record) as ContactRecord & Record<string, unknown>;
  const canonical = normalizeContact(raw) as ContactRecord & Record<string, unknown>;
  if (!Array.isArray(raw.tags) && Array.isArray(canonical.tags)) metadata?.defaultedPaths.push('tags');
  if ((raw.role === undefined || raw.role === '') && canonical.role) metadata?.defaultedPaths.push('role');
  if (raw.relationshipStatus === undefined && canonical.relationshipStatus) metadata?.defaultedPaths.push('relationshipStatus');
  if (raw.riskTier === undefined && canonical.riskTier) metadata?.defaultedPaths.push('riskTier');
  if (raw.active === undefined && canonical.active !== undefined) metadata?.defaultedPaths.push('active');
  SYNC_TRANSPORT_FIELDS.forEach((key) => {
    if (key in canonical) metadata?.strippedPaths.push(key);
    delete canonical[key];
  });
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
