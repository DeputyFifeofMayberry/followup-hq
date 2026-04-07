import type { SaveBatchOperation } from './persistenceTypes';
import { getPersistenceScopeUserId } from './persistenceIdentity';
import { clearPersistenceBlob, loadPersistenceBlob, savePersistenceBlob } from './persistenceStorage';

const OUTBOX_KEY_PREFIX = 'followup_hq_persistence_outbox_v2';
const LEGACY_OUTBOX_KEY = 'followup_hq_persistence_outbox_v1';

export type OutboxStatus = 'queued' | 'sending' | 'failed' | 'conflict' | 'committed' | 'superseded';
export interface OutboxOperation extends SaveBatchOperation {}

export interface OutboxEntry {
  outboxEntryId: string;
  batchId: string;
  localRevision: number;
  basedOnCloudRevision?: number;
  basedOnBatchId?: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  sessionId: string;
  status: OutboxStatus;
  operations: OutboxOperation[];
  operationCount: number;
  payloadHash: string;
  lastError?: string;
  retryCount: number;
}

export interface OutboxState {
  entries: OutboxEntry[];
  updatedAt: string;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function normalizeStatus(input: unknown): OutboxStatus {
  if (input === 'sending' || input === 'flushing') return 'sending';
  if (input === 'failed' || input === 'conflict' || input === 'committed' || input === 'superseded') return input;
  return 'queued';
}

function normalizeEntry(parsed: unknown): OutboxEntry | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const row = parsed as Record<string, unknown>;
  const operations = Array.isArray(row.operations) ? row.operations as OutboxOperation[] : [];
  return {
    outboxEntryId: typeof row.outboxEntryId === 'string' ? row.outboxEntryId : createId('outbox'),
    batchId: typeof row.batchId === 'string' ? row.batchId : createId('batch'),
    localRevision: Number(row.localRevision ?? 0),
    basedOnCloudRevision: typeof row.basedOnCloudRevision === 'number' ? row.basedOnCloudRevision : undefined,
    basedOnBatchId: typeof row.basedOnBatchId === 'string' ? row.basedOnBatchId : undefined,
    createdAt: typeof row.createdAt === 'string' ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : new Date().toISOString(),
    deviceId: typeof row.deviceId === 'string' ? row.deviceId : 'unknown-device',
    sessionId: typeof row.sessionId === 'string' ? row.sessionId : 'unknown-session',
    status: normalizeStatus(row.status),
    operations,
    operationCount: Number(row.operationCount ?? operations.length),
    payloadHash: typeof row.payloadHash === 'string' ? row.payloadHash : 'unknown-hash',
    lastError: typeof row.lastError === 'string' ? row.lastError : undefined,
    retryCount: Number(row.retryCount ?? 0),
  };
}

export function buildOutboxKey(userId: string | null): string {
  if (!userId) return `${OUTBOX_KEY_PREFIX}:anonymous`;
  return `${OUTBOX_KEY_PREFIX}:user:${userId}`;
}

function resolveOutboxKey(userId?: string | null): string {
  return buildOutboxKey(userId ?? getPersistenceScopeUserId());
}

function parseOutbox(raw: string | null): OutboxState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { entries?: unknown[]; updatedAt?: string };
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry).filter(Boolean) as OutboxEntry[] : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadOutboxState(userId?: string | null): Promise<OutboxState> {
  const raw = await loadPersistenceBlob(resolveOutboxKey(userId), LEGACY_OUTBOX_KEY);
  return parseOutbox(raw) ?? { entries: [], updatedAt: new Date(0).toISOString() };
}

export async function saveOutboxState(state: OutboxState, userId?: string | null): Promise<OutboxState> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await savePersistenceBlob(resolveOutboxKey(userId), JSON.stringify(next), LEGACY_OUTBOX_KEY);
  return next;
}

export async function clearOutboxForUser(userId: string): Promise<void> {
  await clearPersistenceBlob(buildOutboxKey(userId));
}

export async function loadPendingBatchesForUser(userId?: string | null): Promise<OutboxEntry[]> {
  const state = await loadOutboxState(userId);
  return state.entries.filter((e) => ['queued', 'sending', 'failed', 'conflict'].includes(e.status));
}

export async function upsertOutboxEntry(entry: OutboxEntry, existingState?: OutboxState, userId?: string | null): Promise<OutboxEntry> {
  const state = existingState ?? await loadOutboxState(userId);
  const index = state.entries.findIndex((candidate) => candidate.outboxEntryId === entry.outboxEntryId);
  const next = { ...entry, updatedAt: new Date().toISOString() };
  if (index >= 0) state.entries[index] = next;
  else state.entries.push(next);
  await saveOutboxState(state, userId);
  return next;
}

export async function enqueueOutboxEntry(input: Omit<OutboxEntry, 'outboxEntryId' | 'createdAt' | 'updatedAt'>, userId?: string | null): Promise<OutboxEntry> {
  const now = new Date().toISOString();
  return upsertOutboxEntry({ ...input, outboxEntryId: createId('outbox'), createdAt: now, updatedAt: now }, undefined, userId);
}

export async function getNextBatchToSend(userId?: string | null): Promise<OutboxEntry | null> {
  const pending = await loadPendingBatchesForUser(userId);
  const sorted = pending
    .filter((e) => e.status !== 'conflict')
    .sort((a, b) => a.localRevision - b.localRevision || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return sorted[0] ?? null;
}

export async function markBatchSending(entryId: string, userId?: string | null): Promise<OutboxEntry | null> {
  return markStatus(entryId, 'sending', undefined, userId);
}

export async function markBatchCommitted(entryId: string, userId?: string | null): Promise<OutboxEntry | null> {
  return markStatus(entryId, 'committed', undefined, userId);
}

export async function markBatchFailed(entryId: string, error: string, userId?: string | null): Promise<OutboxEntry | null> {
  const state = await loadOutboxState(userId);
  const existing = state.entries.find((entry) => entry.outboxEntryId === entryId);
  if (!existing) return null;
  return upsertOutboxEntry({ ...existing, status: 'failed', retryCount: existing.retryCount + 1, lastError: error }, state, userId);
}

export async function markBatchConflict(entryId: string, error: string, userId?: string | null): Promise<OutboxEntry | null> {
  return markStatus(entryId, 'conflict', error, userId);
}

async function markStatus(entryId: string, status: OutboxStatus, lastError?: string, userId?: string | null): Promise<OutboxEntry | null> {
  const state = await loadOutboxState(userId);
  const existing = state.entries.find((entry) => entry.outboxEntryId === entryId);
  if (!existing) return null;
  return upsertOutboxEntry({ ...existing, status, lastError }, state, userId);
}

export async function compactSupersededBatches(confirmedRevision: number, userId?: string | null): Promise<OutboxState> {
  const state = await loadOutboxState(userId);
  state.entries = state.entries.map((entry) => {
    if (entry.localRevision <= confirmedRevision && entry.status !== 'conflict') {
      return { ...entry, status: 'superseded' as const };
    }
    return entry;
  });
  state.entries = state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
  return saveOutboxState(state, userId);
}

export async function listUnresolvedOutboxEntries(state?: OutboxState): Promise<OutboxEntry[]> {
  const source = state ?? await loadOutboxState();
  return source.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
}

export async function clearCommittedOutboxEntries(userId?: string | null): Promise<OutboxState> {
  return compactSupersededBatches(Number.MAX_SAFE_INTEGER, userId);
}
