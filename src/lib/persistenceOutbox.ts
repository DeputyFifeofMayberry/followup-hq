import type { SaveBatchOperation } from './persistenceTypes';

const OUTBOX_KEY = 'followup_hq_persistence_outbox_v1';

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

export function loadOutboxState(): OutboxState {
  if (!canUseStorage()) return { entries: [], updatedAt: new Date(0).toISOString() };
  try {
    const raw = window.localStorage.getItem(OUTBOX_KEY);
    if (!raw) return { entries: [], updatedAt: new Date(0).toISOString() };
    const parsed = JSON.parse(raw) as OutboxState;
    return {
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString(),
    };
  } catch {
    return { entries: [], updatedAt: new Date(0).toISOString() };
  }
}

export function saveOutboxState(state: OutboxState): OutboxState {
  const next = { ...state, updatedAt: new Date().toISOString() };
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function enqueueOutboxEntry(input: Omit<OutboxEntry, 'outboxEntryId' | 'createdAt' | 'updatedAt'> & { outboxEntryId?: string; createdAt?: string; updatedAt?: string }): OutboxEntry {
  const now = new Date().toISOString();
  const entry: OutboxEntry = {
    ...input,
    outboxEntryId: input.outboxEntryId ?? createId('outbox'),
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
  };
  const state = loadOutboxState();
  return upsertOutboxEntry(entry, state);
}

export function upsertOutboxEntry(entry: OutboxEntry, existingState?: OutboxState): OutboxEntry {
  const state = existingState ?? loadOutboxState();
  const index = state.entries.findIndex((candidate) => candidate.outboxEntryId === entry.outboxEntryId);
  const next = { ...entry, updatedAt: new Date().toISOString() };
  if (index >= 0) state.entries[index] = next;
  else state.entries.push(next);
  saveOutboxState(state);
  return next;
}

export function listUnresolvedOutboxEntries(state = loadOutboxState()): OutboxEntry[] {
  return state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
}

export function updateOutboxEntry(entryId: string, patch: Partial<OutboxEntry>): OutboxEntry | null {
  const state = loadOutboxState();
  const existing = state.entries.find((entry) => entry.outboxEntryId === entryId);
  if (!existing) return null;
  const next = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  upsertOutboxEntry(next, state);
  return next;
}

export function clearCommittedOutboxEntries(): OutboxState {
  const state = loadOutboxState();
  state.entries = state.entries.filter((entry) => !['committed', 'superseded'].includes(entry.status));
  return saveOutboxState(state);
}
