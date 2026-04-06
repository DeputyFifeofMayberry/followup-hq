import type { SaveBatchOperation } from './persistenceTypes';
import { getPersistenceScopeUserId } from './persistenceIdentity';

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

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
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

function migrateLegacyOutboxIfNeeded(userId?: string | null): void {
  if (!canUseStorage()) return;
  const scopeUserId = userId ?? getPersistenceScopeUserId();
  if (!scopeUserId) return;

  const scopedKey = buildOutboxKey(scopeUserId);
  const legacyKey = buildLegacyOutboxKey();
  const scopedRaw = window.localStorage.getItem(scopedKey);
  if (scopedRaw) return;

  const legacyRaw = window.localStorage.getItem(legacyKey);
  if (!legacyRaw) return;

  const legacyState = parseOutbox(legacyRaw);
  if (!legacyState) return;

  try {
    window.localStorage.setItem(scopedKey, JSON.stringify(legacyState));
    window.localStorage.removeItem(legacyKey);
  } catch {
    // ignore
  }
}

export function loadOutboxState(userId?: string | null): OutboxState {
  if (!canUseStorage()) return { entries: [], updatedAt: new Date(0).toISOString() };
  migrateLegacyOutboxIfNeeded(userId);
  try {
    const raw = window.localStorage.getItem(resolveOutboxKey(userId));
    return parseOutbox(raw) ?? { entries: [], updatedAt: new Date(0).toISOString() };
  } catch {
    return { entries: [], updatedAt: new Date(0).toISOString() };
  }
}

export function saveOutboxState(state: OutboxState, userId?: string | null): OutboxState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(resolveOutboxKey(userId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearOutboxForUser(userId: string): void {
  if (!canUseStorage()) return;
  try {
    window.localStorage.removeItem(buildOutboxKey(userId));
  } catch {
    // ignore
  }
}

export function enqueueOutboxEntry(input: Omit<OutboxEntry, 'outboxEntryId' | 'createdAt' | 'updatedAt'> & { outboxEntryId?: string; createdAt?: string; updatedAt?: string }, userId?: string | null): OutboxEntry {
  const now = new Date().toISOString();
  const entry: OutboxEntry = {
    ...input,
    outboxEntryId: input.outboxEntryId ?? createId('outbox'),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  const state = loadOutboxState(userId);
  return upsertOutboxEntry(entry, state, userId);
}

export function upsertOutboxEntry(entry: OutboxEntry, existingState?: OutboxState, userId?: string | null): OutboxEntry {
  const state = existingState ?? loadOutboxState(userId);
  const index = state.entries.findIndex((candidate) => candidate.outboxEntryId === entry.outboxEntryId);
  const next = { ...entry, updatedAt: new Date().toISOString() };
  if (index >= 0) state.entries[index] = next;
  else state.entries.push(next);
  saveOutboxState(state, userId);
  return next;
}

export function listUnresolvedOutboxEntries(state = loadOutboxState()): OutboxEntry[] {
  return state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
}

export function updateOutboxEntry(entryId: string, patch: Partial<OutboxEntry>, userId?: string | null): OutboxEntry | null {
  const state = loadOutboxState(userId);
  const existing = state.entries.find((entry) => entry.outboxEntryId === entryId);
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  upsertOutboxEntry(next, state, userId);
  return next;
}

export function clearCommittedOutboxEntries(userId?: string | null): OutboxState {
  const state = loadOutboxState(userId);
  state.entries = state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
  return saveOutboxState(state, userId);
}
