import type { FollowUpItem, TaskItem } from '../types';
import { todayIso } from './utils';
import { isTrustedLiveRecord } from '../domains/records/integrity';

export type BulkActionType = 'close' | 'reopen' | 'nudge' | 'snooze' | 'escalate' | 'assign' | 'retag' | 'set_next_touch' | 'set_due_date';

export interface BulkActionSpec {
  type: BulkActionType;
  ids: string[];
  value?: string;
  days?: number;
  tags?: string[];
}

export interface BulkPreview {
  affected: number;
  skipped: number;
  warnings: string[];
  changes: string[];
  skippedForIntegrity: number;
}

function actionRequiresTrustedLive(spec: BulkActionSpec): boolean {
  return spec.type !== 'retag';
}

export function previewBulkAction(spec: BulkActionSpec, items: FollowUpItem[], tasks: TaskItem[]): BulkPreview {
  const itemSet = new Set(spec.ids);
  const all = [...items, ...tasks.filter((task) => !items.some((item) => item.id === task.id))];
  const selected = all.filter((entry) => itemSet.has(entry.id));
  const integritySkipped = actionRequiresTrustedLive(spec)
    ? selected.filter((entry) => !isTrustedLiveRecord(entry)).length
    : 0;
  const skipped = spec.ids.length - selected.length + integritySkipped;
  const warnings: string[] = [];
  const changes: string[] = [];

  if (spec.type === 'retag') changes.push(`Merge tags: ${(spec.tags || []).join(', ') || '(none)'}`);
  if (spec.type === 'snooze') changes.push(`Shift next touch/due by ${spec.days || 0} days`);
  if (spec.type === 'assign') changes.push(`Assign owner/assignee to ${spec.value || '(empty)'}`);
  if (spec.type === 'close') changes.push('Set state to closed/done');
  if (spec.type === 'reopen') changes.push('Reopen to active state');
  if (spec.type === 'set_due_date') changes.push(`Set due date to ${spec.value || '(empty)'}`);
  if (spec.type === 'set_next_touch') changes.push(`Set next touch date to ${spec.value || '(empty)'}`);

  if (spec.type === 'close' && selected.some((entry) => 'status' in entry && (entry as FollowUpItem).status === 'Closed')) warnings.push('Some follow-ups are already closed.');
  if (spec.type === 'retag' && !(spec.tags || []).length) warnings.push('No tags provided.');
  if (integritySkipped > 0) warnings.push(`${integritySkipped} selected record${integritySkipped === 1 ? ' was' : 's were'} skipped because ${integritySkipped === 1 ? 'it is' : 'they are'} not trusted live records.`);

  return { affected: selected.length - integritySkipped, skipped, warnings, changes, skippedForIntegrity: integritySkipped };
}

export function applyBulkToFollowUp(item: FollowUpItem, spec: BulkActionSpec): FollowUpItem {
  if (actionRequiresTrustedLive(spec) && !isTrustedLiveRecord(item)) return item;
  if (spec.type === 'close') return { ...item, status: 'Closed', actionState: 'Complete', lastActionAt: todayIso() };
  if (spec.type === 'reopen') return { ...item, status: 'Needs action', actionState: 'Draft created', lastActionAt: todayIso() };
  if (spec.type === 'nudge') return { ...item, lastNudgedAt: todayIso(), lastTouchDate: todayIso(), lastActionAt: todayIso() };
  if (spec.type === 'snooze') {
    const days = spec.days || 0;
    const next = new Date(Date.now() + days * 86400000).toISOString();
    return { ...item, nextTouchDate: next, snoozedUntilDate: next, lastActionAt: todayIso() };
  }
  if (spec.type === 'escalate') return { ...item, escalationLevel: 'Escalate', lastActionAt: todayIso() };
  if (spec.type === 'assign') return { ...item, assigneeDisplayName: spec.value || item.assigneeDisplayName, lastActionAt: todayIso() };
  if (spec.type === 'retag') return { ...item, tags: [...new Set([...(item.tags || []), ...(spec.tags || [])])], lastActionAt: todayIso() };
  if (spec.type === 'set_next_touch' && spec.value) return { ...item, nextTouchDate: spec.value, lastActionAt: todayIso() };
  if (spec.type === 'set_due_date' && spec.value) return { ...item, dueDate: spec.value, lastActionAt: todayIso() };
  return item;
}
