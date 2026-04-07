import { createId } from '../../lib/utils';
import { UNDO_STACK_LIMIT, UNDO_WINDOW_MS, type UndoEntry, type UndoExecutionResult, type UndoRegistrationInput } from '../../lib/undo';
import type { AppStore } from '../types';
import { applyItemMutationEffects, applyTaskMutationEffects } from './mutationEffects';

function nowIso(): string {
  return new Date().toISOString();
}

function toEpoch(value: string): number {
  return new Date(value).getTime();
}

function cleanupExpired(entries: UndoEntry[], atIso: string): UndoEntry[] {
  const at = toEpoch(atIso);
  return entries
    .map((entry) => {
      if (entry.status === 'pending' && toEpoch(entry.expiresAt) <= at) {
        return { ...entry, status: 'expired' as const, reason: 'expired' };
      }
      return entry;
    })
    .filter((entry) => entry.status === 'pending' || entry.status === 'undone')
    .slice(0, UNDO_STACK_LIMIT);
}

function hasOverlap(a: UndoEntry['entityRefs'], b: UndoEntry['entityRefs']): boolean {
  const keys = new Set(a.map((ref) => `${ref.type}:${ref.id}`));
  return b.some((ref) => keys.has(`${ref.type}:${ref.id}`));
}

export function registerUndoEntryWithCleanup(stack: UndoEntry[], input: UndoRegistrationInput, createdAt = nowIso()): { stack: UndoEntry[]; entry: UndoEntry } {
  const cleaned = cleanupExpired(stack, createdAt);
  const entry: UndoEntry = {
    id: createId('UNDO'),
    actionKind: input.actionKind,
    title: input.title,
    message: input.message,
    createdAt,
    expiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
    status: 'pending',
    entityRefs: input.entityRefs,
    dirtyRecordRefs: input.dirtyRecordRefs,
    snapshots: input.snapshots,
    auxiliarySnapshot: input.auxiliarySnapshot,
    mutationGroupId: input.mutationGroupId,
    overlapPolicy: input.overlapPolicy ?? 'supersede-older-overlapping',
    operationSummary: input.operationSummary,
  };
  const superseded = cleaned.map((existing) => {
    if (existing.status !== 'pending') return existing;
    if (!hasOverlap(existing.entityRefs, entry.entityRefs)) return existing;
    return { ...existing, status: 'superseded' as const, reason: 'record_changed_again' };
  });
  return { stack: [entry, ...superseded].filter((item) => item.status === 'pending' || item.status === 'undone').slice(0, UNDO_STACK_LIMIT), entry };
}

function restoreSnapshots(state: AppStore, entry: UndoEntry): Partial<AppStore> | null {
  if (!entry.snapshots.length) return null;
  const itemMap = new Map(state.items.map((item) => [item.id, item]));
  const taskMap = new Map(state.tasks.map((task) => [task.id, task]));

  for (const snapshot of entry.snapshots) {
    if (snapshot.entityType === 'followup') {
      if (snapshot.before === null) itemMap.delete(snapshot.id);
      else itemMap.set(snapshot.id, snapshot.before as AppStore['items'][number]);
    }
    if (snapshot.entityType === 'task') {
      if (snapshot.before === null) taskMap.delete(snapshot.id);
      else taskMap.set(snapshot.id, snapshot.before as AppStore['tasks'][number]);
    }
  }

  const items = Array.from(itemMap.values());
  const tasks = Array.from(taskMap.values());
  let nextState: Partial<AppStore> = {
    items,
    tasks,
  };

  if (entry.auxiliarySnapshot?.dismissedDuplicatePairs) {
    nextState.dismissedDuplicatePairs = entry.auxiliarySnapshot.dismissedDuplicatePairs;
  }
  if (entry.auxiliarySnapshot?.intakeDocuments) {
    const docs = new Map(state.intakeDocuments.map((doc) => [doc.id, doc]));
    entry.auxiliarySnapshot.intakeDocuments.forEach((docSnapshot) => {
      docs.set(docSnapshot.id, docSnapshot.before as AppStore['intakeDocuments'][number]);
    });
    nextState.intakeDocuments = Array.from(docs.values());
  }

  const withItemEffects = applyItemMutationEffects({
    items,
    tasks,
    projects: state.projects,
    dismissedDuplicatePairs: nextState.dismissedDuplicatePairs ?? state.dismissedDuplicatePairs,
  }, items);

  const withTaskEffects = applyTaskMutationEffects({
    items: withItemEffects.items,
    tasks,
    projects: withItemEffects.projects,
    dismissedDuplicatePairs: nextState.dismissedDuplicatePairs ?? state.dismissedDuplicatePairs,
  }, tasks);

  nextState = {
    ...nextState,
    items: withTaskEffects.items,
    tasks: withTaskEffects.tasks,
    projects: withTaskEffects.projects,
    duplicateReviews: withItemEffects.duplicateReviews,
  };

  return nextState;
}

export function executeUndoFromStack(state: AppStore, entryId: string): { nextState: Partial<AppStore>; result: UndoExecutionResult } {
  const at = nowIso();
  const cleaned = cleanupExpired(state.undoStack, at);
  const entry = cleaned.find((item) => item.id === entryId);
  if (!entry) {
    return { nextState: { undoStack: cleaned }, result: { ok: false, status: 'not_found', reason: 'not_found' } };
  }
  if (entry.status !== 'pending') {
    return { nextState: { undoStack: cleaned }, result: { ok: false, status: entry.status === 'expired' ? 'expired' : 'superseded', reason: entry.status === 'expired' ? 'expired' : 'superseded', entryId } };
  }
  if (toEpoch(entry.expiresAt) <= toEpoch(at)) {
    const nextStack = cleaned.map((item) => item.id === entryId ? { ...item, status: 'expired' as const, reason: 'expired' } : item);
    return { nextState: { undoStack: nextStack }, result: { ok: false, status: 'expired', reason: 'expired', entryId } };
  }
  const restored = restoreSnapshots(state, entry);
  if (!restored) {
    const failed = cleaned.map((item) => item.id === entryId ? { ...item, status: 'failed' as const, reason: 'missing_snapshot' } : item);
    return { nextState: { undoStack: failed }, result: { ok: false, status: 'failed', reason: 'missing_snapshot', entryId } };
  }

  const nextStack = cleaned.map((item) => item.id === entryId ? { ...item, status: 'undone' as const, reason: undefined } : item);
  return {
    nextState: {
      ...restored,
      undoStack: nextStack,
      lastUndoCleanupAt: at,
    },
    result: { ok: true, status: 'undone', entryId, dirtyRecordRefs: entry.dirtyRecordRefs },
  };
}

export function invalidateOverlappingUndoEntries(stack: UndoEntry[], refs: UndoEntry['entityRefs'], reason = 'record_changed_again'): UndoEntry[] {
  return stack.map((entry) => {
    if (entry.status !== 'pending') return entry;
    if (!hasOverlap(entry.entityRefs, refs)) return entry;
    return { ...entry, status: 'superseded', reason };
  });
}

export function clearExpiredUndoEntries(stack: UndoEntry[], atIso = nowIso()): UndoEntry[] {
  return cleanupExpired(stack, atIso);
}
