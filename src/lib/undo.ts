import type { DirtyRecordRef } from '../store/persistenceQueue';
import type { FollowUpItem, TaskItem } from '../types';

export const UNDO_WINDOW_MS = 30_000;
export const UNDO_STACK_LIMIT = 10;

export type UndoableEntityType = 'followup' | 'task' | 'project' | 'contact' | 'company' | 'auxiliary';

export type UndoActionKind =
  | 'followup_delete'
  | 'followup_merge'
  | 'followup_bulk_transition'
  | 'followup_bulk_patch'
  | 'followup_update'
  | 'followup_touch_log'
  | 'followup_snooze'
  | 'followup_escalation'
  | 'task_delete'
  | 'task_update'
  | 'task_transition'
  | 'bulk_action'
  | 'custom';

export interface UndoEntitySnapshot<T = unknown> {
  entityType: UndoableEntityType;
  id: string;
  before: T | null;
  after?: T | null;
}

export interface UndoAuxiliarySnapshot {
  dismissedDuplicatePairs?: string[];
  intakeDocuments?: Array<{ id: string; before: unknown; after?: unknown }>;
}

export interface UndoEntry {
  id: string;
  actionKind: UndoActionKind;
  title: string;
  message?: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'undone' | 'expired' | 'superseded' | 'failed';
  entityRefs: Array<{ type: UndoableEntityType; id: string }>;
  dirtyRecordRefs: DirtyRecordRef[];
  snapshots: UndoEntitySnapshot[];
  auxiliarySnapshot?: UndoAuxiliarySnapshot;
  sourceToastId?: string;
  mutationGroupId?: string;
  reason?: string;
  overlapPolicy: 'supersede-older-overlapping' | 'latest-only';
  operationSummary?: {
    affected: number;
    skipped?: number;
    warnings?: string[];
  };
}

export interface UndoRegistrationInput {
  actionKind: UndoActionKind;
  title: string;
  message?: string;
  entityRefs: Array<{ type: UndoableEntityType; id: string }>;
  dirtyRecordRefs: DirtyRecordRef[];
  snapshots: UndoEntitySnapshot[];
  auxiliarySnapshot?: UndoAuxiliarySnapshot;
  mutationGroupId?: string;
  overlapPolicy?: UndoEntry['overlapPolicy'];
  operationSummary?: UndoEntry['operationSummary'];
}

export type UndoConflictReason = 'expired' | 'superseded' | 'record_changed_again' | 'missing_snapshot' | 'not_found';

export interface UndoExecutionResult {
  ok: boolean;
  status: 'undone' | 'expired' | 'superseded' | 'failed' | 'not_found';
  reason?: UndoConflictReason;
  entryId?: string;
  dirtyRecordRefs?: DirtyRecordRef[];
}

export function isMeaningfulUndoableFollowUpUpdate(patch: Partial<FollowUpItem>): boolean {
  const keys: Array<keyof FollowUpItem> = [
    'status',
    'dueDate',
    'nextTouchDate',
    'assigneeDisplayName',
    'assigneeUserId',
    'owner',
    'escalationLevel',
    'snoozedUntilDate',
    'actionState',
    'waitingOn',
    'promisedDate',
  ];
  return keys.some((key) => patch[key] !== undefined);
}

export function isMeaningfulUndoableTaskUpdate(patch: Partial<TaskItem>): boolean {
  const keys: Array<keyof TaskItem> = [
    'status',
    'dueDate',
    'assigneeDisplayName',
    'assigneeUserId',
    'owner',
    'priority',
    'project',
    'blockReason',
    'deferredUntil',
  ];
  return keys.some((key) => patch[key] !== undefined);
}

export function buildBulkUndoTitle(affected: number, verb: string): string {
  return `${affected} follow-ups ${verb}`;
}
