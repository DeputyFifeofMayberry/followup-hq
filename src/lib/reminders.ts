import type {
  FollowUpItem,
  ReminderCandidate,
  ReminderCenterSummary,
  ReminderKind,
  ReminderLedgerEntry,
  ReminderPermissionState,
  ReminderPreferences,
  ReminderRecordType,
  ReminderSeverity,
  TaskItem,
  WorkspaceAttentionCounts,
} from '../types';
import { isExecutionReady } from '../domains/records/integrity';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const DEFAULT_REMINDER_PREFERENCES: ReminderPreferences = {
  enabled: false,
  useBrowserNotifications: true,
  useDesktopNotifications: true,
  evaluationIntervalMinutes: 15,
  dueSoonLeadHours: 24,
  promisedSoonLeadHours: 24,
  quietHoursEnabled: false,
  quietHoursStart: '21:00',
  quietHoursEnd: '06:30',
  notifyFollowUpOverdue: true,
  notifyFollowUpDueToday: true,
  notifyFollowUpDueSoon: true,
  notifyPromisedDueSoon: true,
  notifyNeedsNudge: true,
  notifyTaskOverdue: true,
  notifyTaskDueToday: true,
  notifyTaskDueSoon: true,
};

export const DEFAULT_WORKSPACE_ATTENTION_COUNTS: WorkspaceAttentionCounts = {
  worklist: 0,
  followups: 0,
  tasks: 0,
};

export const DEFAULT_REMINDER_CENTER_SUMMARY: ReminderCenterSummary = {
  permissionState: 'default',
  schedulerState: 'idle',
  pendingCount: 0,
  overdueCount: 0,
  dueTodayCount: 0,
  needsNudgeCount: 0,
};

function atLocalMidnight(iso: string): number {
  const date = new Date(iso);
  const clone = new Date(date);
  clone.setHours(0, 0, 0, 0);
  return clone.getTime();
}

function sameLocalDay(aIso: string, bIso: string): boolean {
  return atLocalMidnight(aIso) === atLocalMidnight(bIso);
}

function parseTimeToMinutes(time: string): number | null {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function minuteOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function isWithinQuietHours(nowIso: string, start: string, end: string): boolean {
  const startMin = parseTimeToMinutes(start);
  const endMin = parseTimeToMinutes(end);
  if (startMin == null || endMin == null || startMin === endMin) return false;
  const current = minuteOfDay(new Date(nowIso));
  if (startMin < endMin) {
    return current >= startMin && current < endMin;
  }
  return current >= startMin || current < endMin;
}

function followUpNeedsNudgeAt(item: FollowUpItem, nowMs: number): boolean {
  if (item.status === 'Closed' || isFollowUpSnoozed(item, nowMs)) return false;
  const touchWindow = Math.max(1, item.cadenceDays || 3);
  const touchAge = Math.max(0, Math.floor((nowMs - new Date(item.lastTouchDate).getTime()) / DAY_MS));
  if ((item.status === 'Waiting on external' || item.status === 'Waiting internal') && touchAge >= touchWindow) {
    return true;
  }
  return new Date(item.nextTouchDate).getTime() <= nowMs;
}

function isFollowUpSnoozed(item: FollowUpItem, nowMs: number): boolean {
  return Boolean(item.snoozedUntilDate && new Date(item.snoozedUntilDate).getTime() > nowMs);
}

function isTaskDeferred(task: TaskItem, nowMs: number): boolean {
  return Boolean(task.deferredUntil && task.status !== 'Done' && new Date(task.deferredUntil).getTime() > nowMs);
}

function isDueTodayAt(dateIso: string | undefined, nowIso: string): boolean {
  if (!dateIso) return false;
  return sameLocalDay(dateIso, nowIso);
}

function isOverdueAt(dateIso: string | undefined, nowMs: number): boolean {
  if (!dateIso) return false;
  return new Date(dateIso).getTime() < nowMs;
}

function isDueSoon(dateIso: string | undefined, nowMs: number, leadHours: number): boolean {
  if (!dateIso) return false;
  const dueMs = new Date(dateIso).getTime();
  return dueMs > nowMs && dueMs <= nowMs + leadHours * HOUR_MS;
}

function severityForKind(kind: ReminderKind, dueMs: number | null, nowMs: number): ReminderSeverity {
  if (kind.endsWith('overdue')) return 'danger';
  if (kind.endsWith('due_today') || kind === 'followup_needs_nudge') return 'warn';
  if (dueMs != null && dueMs <= nowMs + 4 * HOUR_MS) return 'warn';
  return 'info';
}

function buildBucketKey(kind: ReminderKind, sortTime: string): string {
  if (kind.endsWith('overdue') || kind.endsWith('due_today') || kind === 'followup_needs_nudge') {
    return new Date(sortTime).toISOString().slice(0, 10);
  }
  const date = new Date(sortTime);
  const hourBucket = Math.floor(date.getTime() / HOUR_MS);
  return `h${hourBucket}`;
}

function buildSignature(recordType: ReminderRecordType, recordId: string, kind: ReminderKind, sortTime: string): string {
  return `${recordType}:${recordId}:${kind}:${buildBucketKey(kind, sortTime)}`;
}

function isKindEnabled(kind: ReminderKind, prefs: ReminderPreferences): boolean {
  switch (kind) {
    case 'followup_overdue':
      return prefs.notifyFollowUpOverdue;
    case 'followup_due_today':
      return prefs.notifyFollowUpDueToday;
    case 'followup_due_soon':
      return prefs.notifyFollowUpDueSoon;
    case 'followup_promised_due_soon':
      return prefs.notifyPromisedDueSoon;
    case 'followup_needs_nudge':
      return prefs.notifyNeedsNudge;
    case 'task_overdue':
      return prefs.notifyTaskOverdue;
    case 'task_due_today':
      return prefs.notifyTaskDueToday;
    case 'task_due_soon':
      return prefs.notifyTaskDueSoon;
    default:
      return false;
  }
}

function candidateFromFollowUp(item: FollowUpItem, kind: ReminderKind, sortTime: string, reason: string, nowMs: number): ReminderCandidate {
  const dueMs = item.dueDate ? new Date(item.dueDate).getTime() : null;
  const severity = severityForKind(kind, dueMs, nowMs);
  return {
    id: `${kind}-${item.id}`,
    signature: buildSignature('followup', item.id, kind, sortTime),
    kind,
    recordType: 'followup',
    recordId: item.id,
    title: item.title,
    project: item.project,
    owner: item.owner,
    dueAt: item.dueDate,
    promisedAt: item.promisedDate,
    nextTouchAt: item.nextTouchDate,
    severity,
    workspaceTarget: kind === 'followup_needs_nudge' ? 'worklist' : 'followups',
    message: `${item.title} · ${reason}`,
    reason,
    sortTime,
    deepLink: `/followups/${item.id}`,
  };
}

function candidateFromTask(task: TaskItem, kind: ReminderKind, sortTime: string, reason: string, nowMs: number): ReminderCandidate {
  const dueMs = task.dueDate ? new Date(task.dueDate).getTime() : null;
  return {
    id: `${kind}-${task.id}`,
    signature: buildSignature('task', task.id, kind, sortTime),
    kind,
    recordType: 'task',
    recordId: task.id,
    title: task.title,
    project: task.project,
    owner: task.owner,
    dueAt: task.dueDate,
    severity: severityForKind(kind, dueMs, nowMs),
    workspaceTarget: 'tasks',
    message: `${task.title} · ${reason}`,
    reason,
    sortTime,
    deepLink: `/tasks/${task.id}`,
  };
}

export function evaluateReminderCandidates(
  items: FollowUpItem[],
  tasks: TaskItem[],
  prefs: ReminderPreferences,
  nowIso: string,
): ReminderCandidate[] {
  const nowMs = new Date(nowIso).getTime();
  const candidates: ReminderCandidate[] = [];

  for (const item of items) {
    if (!isExecutionReady(item)) continue;
    if (item.status === 'Closed' || isFollowUpSnoozed(item, nowMs)) continue;

    if (isOverdueAt(item.dueDate, nowMs) && isKindEnabled('followup_overdue', prefs)) {
      candidates.push(candidateFromFollowUp(item, 'followup_overdue', item.dueDate, 'Past due', nowMs));
      continue;
    }

    if (isDueTodayAt(item.dueDate, nowIso) && isKindEnabled('followup_due_today', prefs)) {
      candidates.push(candidateFromFollowUp(item, 'followup_due_today', item.dueDate, 'Due today', nowMs));
    } else if (isDueSoon(item.dueDate, nowMs, prefs.dueSoonLeadHours) && isKindEnabled('followup_due_soon', prefs)) {
      candidates.push(candidateFromFollowUp(item, 'followup_due_soon', item.dueDate, 'Due soon', nowMs));
    }

    if (isDueSoon(item.promisedDate, nowMs, prefs.promisedSoonLeadHours) && isKindEnabled('followup_promised_due_soon', prefs)) {
      candidates.push(candidateFromFollowUp(item, 'followup_promised_due_soon', item.promisedDate ?? item.dueDate, 'Promise date approaching', nowMs));
    }

    if (followUpNeedsNudgeAt(item, nowMs) && isKindEnabled('followup_needs_nudge', prefs)) {
      candidates.push(candidateFromFollowUp(item, 'followup_needs_nudge', item.nextTouchDate, 'Needs touch/nudge', nowMs));
    }
  }

  for (const task of tasks) {
    if (!isExecutionReady(task)) continue;
    if (task.status === 'Done' || isTaskDeferred(task, nowMs)) continue;

    if (isOverdueAt(task.dueDate, nowMs) && isKindEnabled('task_overdue', prefs)) {
      candidates.push(candidateFromTask(task, 'task_overdue', task.dueDate ?? nowIso, 'Past due', nowMs));
      continue;
    }

    if (isDueTodayAt(task.dueDate, nowIso) && isKindEnabled('task_due_today', prefs)) {
      candidates.push(candidateFromTask(task, 'task_due_today', task.dueDate ?? nowIso, 'Due today', nowMs));
    } else if (isDueSoon(task.dueDate, nowMs, prefs.dueSoonLeadHours) && isKindEnabled('task_due_soon', prefs)) {
      candidates.push(candidateFromTask(task, 'task_due_soon', task.dueDate ?? nowIso, 'Due soon', nowMs));
    }
  }

  return candidates.sort((a, b) => {
    const severityScore = { danger: 3, warn: 2, info: 1 };
    if (severityScore[b.severity] !== severityScore[a.severity]) {
      return severityScore[b.severity] - severityScore[a.severity];
    }
    return new Date(a.sortTime).getTime() - new Date(b.sortTime).getTime();
  });
}

export function buildWorkspaceAttentionCounts(
  items: FollowUpItem[],
  tasks: TaskItem[],
  prefs: ReminderPreferences,
  nowIso: string,
): WorkspaceAttentionCounts {
  const candidates = evaluateReminderCandidates(items, tasks, prefs, nowIso);
  const followups = new Set(candidates.filter((candidate) => candidate.recordType === 'followup').map((candidate) => candidate.recordId)).size;
  const tasksCount = new Set(candidates.filter((candidate) => candidate.recordType === 'task').map((candidate) => candidate.recordId)).size;
  return {
    worklist: followups + tasksCount,
    followups,
    tasks: tasksCount,
  };
}

export function buildReminderCenterSummary(
  candidates: ReminderCandidate[],
  permissionState: ReminderPermissionState,
  schedulerState: ReminderCenterSummary['schedulerState'],
  lastEvaluatedAt?: string,
  nextPlannedEvaluationAt?: string,
  lastDeliveredAt?: string,
): ReminderCenterSummary {
  return {
    permissionState,
    schedulerState,
    lastEvaluatedAt,
    nextPlannedEvaluationAt,
    pendingCount: candidates.length,
    overdueCount: candidates.filter((candidate) => candidate.kind.endsWith('overdue')).length,
    dueTodayCount: candidates.filter((candidate) => candidate.kind.endsWith('due_today')).length,
    needsNudgeCount: candidates.filter((candidate) => candidate.kind === 'followup_needs_nudge').length,
    lastDeliveredAt,
  };
}

function cooldownMsForKind(kind: ReminderKind): number {
  if (kind.endsWith('overdue')) return 12 * HOUR_MS;
  if (kind.endsWith('due_today')) return 8 * HOUR_MS;
  if (kind === 'followup_needs_nudge') return 12 * HOUR_MS;
  return 2 * HOUR_MS;
}

export function shouldDeliverReminder(
  candidate: ReminderCandidate,
  ledgerEntry: ReminderLedgerEntry | undefined,
  prefs: ReminderPreferences,
  nowIso: string,
): boolean {
  if (!prefs.enabled || !isKindEnabled(candidate.kind, prefs)) return false;
  const nowMs = new Date(nowIso).getTime();

  if (prefs.quietHoursEnabled && isWithinQuietHours(nowIso, prefs.quietHoursStart, prefs.quietHoursEnd)) {
    return false;
  }

  if (!ledgerEntry) return true;

  if (ledgerEntry.mutedUntil && new Date(ledgerEntry.mutedUntil).getTime() > nowMs) {
    return false;
  }

  if (ledgerEntry.lastDismissedAt && sameLocalDay(ledgerEntry.lastDismissedAt, nowIso)) {
    return false;
  }

  const deliveredAtMs = new Date(ledgerEntry.lastDeliveredAt).getTime();
  if (Number.isNaN(deliveredAtMs)) return true;

  const sameSignature = ledgerEntry.signature === candidate.signature;
  if (sameSignature && nowMs - deliveredAtMs < cooldownMsForKind(candidate.kind)) {
    return false;
  }

  return true;
}
