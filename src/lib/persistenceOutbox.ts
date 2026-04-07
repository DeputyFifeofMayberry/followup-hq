import type { SaveBatchOperation } from './persistenceTypes';
import { getPersistenceScopeUserId } from './persistenceIdentity';
import { clearPersistenceBlob, loadPersistenceBlob, savePersistenceBlob } from './persistenceStorage';

const OUTBOX_KEY_PREFIX = 'followup_hq_persistence_outbox_v1';
const LEGACY_OUTBOX_KEY = 'followup_hq_persistence_outbox_v1';

export type OutboxStatus = 'queued' | 'flushing' | 'failed' | 'conflict' | 'committed' | 'superseded';

export interface OutboxOperation extends SaveBatchOperation {}

export interface OutboxEntry {
  outboxEntryId: string;
  batchId: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  sessionId: string;
  status: OutboxStatus;
  operations: OutboxOperation[];
  operationCount: number;
  payloadHash: string;
  basedOnReceiptBatchId?: string;
  basedOnVerificationRunId?: string;
  lastError?: string;
  retryCount: number;
  blockedReason?: string;
}

export interface OutboxState {
  entries: OutboxEntry[];
  updatedAt: string;
}

export interface OutboxFlushResult {
  entryId: string;
  status: OutboxStatus;
  outboxSafeToClear: boolean;
  conflictIds?: string[];
  error?: string;
}

function createId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function buildOutboxKey(userId: string | null): string {
  if (!userId) return `${OUTBOX_KEY_PREFIX}:anonymous`;
  return `${OUTBOX_KEY_PREFIX}:user:${userId}`;
}

export function buildLegacyOutboxKey(): string {
  return LEGACY_OUTBOX_KEY;
}

function resolveOutboxKey(userId?: string | null): string {
  return buildOutboxKey(userId ?? getPersistenceScopeUserId());
}

function parseOutbox(raw: string | null): OutboxState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OutboxState;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function loadOutboxState(userId?: string | null): Promise<OutboxState> {
  const raw = await loadPersistenceBlob(resolveOutboxKey(userId), buildLegacyOutboxKey());
  return parseOutbox(raw) ?? { entries: [], updatedAt: new Date(0).toISOString() };
}

export async function saveOutboxState(state: OutboxState, userId?: string | null): Promise<OutboxState> {
  const next = { ...state, updatedAt: new Date().toISOString() };
  await savePersistenceBlob(resolveOutboxKey(userId), JSON.stringify(next), buildLegacyOutboxKey());
  return next;
}

export async function clearOutboxForUser(userId: string): Promise<void> {
  await clearPersistenceBlob(buildOutboxKey(userId));
}

export async function enqueueOutboxEntry(input: Omit<OutboxEntry, 'outboxEntryId' | 'createdAt' | 'updatedAt'> & { outboxEntryId?: string; createdAt?: string; updatedAt?: string }, userId?: string | null): Promise<OutboxEntry> {
  const now = new Date().toISOString();
  const entry: OutboxEntry = {
    ...input,
    outboxEntryId: input.outboxEntryId ?? createId('outbox'),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  const state = await loadOutboxState(userId);
  return upsertOutboxEntry(entry, state, userId);
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

export async function listUnresolvedOutboxEntries(state?: OutboxState): Promise<OutboxEntry[]> {
  const source = state ?? await loadOutboxState();
  return source.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
}

export async function updateOutboxEntry(entryId: string, patch: Partial<OutboxEntry>, userId?: string | null): Promise<OutboxEntry | null> {
  const state = await loadOutboxState(userId);
  const existing = state.entries.find((entry) => entry.outboxEntryId === entryId);
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await upsertOutboxEntry(next, state, userId);
  return next;
}

export async function clearCommittedOutboxEntries(userId?: string | null): Promise<OutboxState> {
  const state = await loadOutboxState(userId);
  state.entries = state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
  return saveOutboxState(state, userId);
}
