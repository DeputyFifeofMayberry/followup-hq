import type { FollowUpItem, ReminderLedgerEntry, TaskItem } from '../../types';
import {
  buildWorkspaceAttentionCounts,
  DEFAULT_REMINDER_PREFERENCES,
  evaluateReminderCandidates,
  isWithinQuietHours,
  shouldDeliverReminder,
} from '../reminders';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function buildFollowUp(overrides: Partial<FollowUpItem>): FollowUpItem {
  return {
    id: 'f1',
    title: 'Follow up',
    source: 'Email',
    project: 'P1',
    owner: 'Owner',
    status: 'Needs action',
    priority: 'High',
    dueDate: '2026-04-10T12:00:00.000Z',
    promisedDate: undefined,
    lastTouchDate: '2026-04-01T12:00:00.000Z',
    nextTouchDate: '2026-04-09T12:00:00.000Z',
    nextAction: 'Call',
    summary: 'summary',
    tags: [],
    sourceRef: 'ref',
    sourceRefs: ['ref'],
    mergedItemIds: [],
    notes: '',
    timeline: [],
    category: 'General',
    owesNextAction: 'Internal',
    escalationLevel: 'None',
    cadenceDays: 3,
    ...overrides,
  };
}

function buildTask(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: 't1',
    title: 'Task',
    project: 'P1',
    owner: 'Owner',
    status: 'To do',
    priority: 'High',
    dueDate: '2026-04-10T16:00:00.000Z',
    summary: '',
    nextStep: '',
    notes: '',
    tags: [],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    ...overrides,
  };
}

const now = '2026-04-10T09:00:00.000Z';
const enabledPrefs = { ...DEFAULT_REMINDER_PREFERENCES, enabled: true };

const overdueFollowUp = buildFollowUp({ id: 'f-overdue', dueDate: '2026-04-09T08:00:00.000Z' });
const dueTodayFollowUp = buildFollowUp({ id: 'f-today', dueDate: '2026-04-10T15:00:00.000Z' });
const nudgeFollowUp = buildFollowUp({ id: 'f-nudge', status: 'Waiting on external', dueDate: '2026-04-13T12:00:00.000Z', lastTouchDate: '2026-04-01T00:00:00.000Z', nextTouchDate: '2026-04-15T00:00:00.000Z' });
const promisedSoonFollowUp = buildFollowUp({ id: 'f-promise', dueDate: '2026-04-15T12:00:00.000Z', promisedDate: '2026-04-10T12:00:00.000Z' });
const deferredTask = buildTask({ id: 't-deferred', dueDate: '2026-04-10T12:00:00.000Z', deferredUntil: '2026-04-11T12:00:00.000Z' });
const overdueTask = buildTask({ id: 't-overdue', dueDate: '2026-04-09T08:00:00.000Z' });

const candidates = evaluateReminderCandidates(
  [overdueFollowUp, dueTodayFollowUp, nudgeFollowUp, promisedSoonFollowUp],
  [deferredTask, overdueTask],
  enabledPrefs,
  now,
);

assert(candidates.some((c) => c.recordId === 'f-overdue' && c.kind === 'followup_overdue'), 'should detect overdue follow-up');
assert(candidates.some((c) => c.recordId === 'f-today' && c.kind === 'followup_due_today'), 'should detect due today follow-up');
assert(candidates.some((c) => c.recordId === 'f-nudge' && c.kind === 'followup_needs_nudge'), 'should detect needs nudge follow-up');
assert(candidates.some((c) => c.recordId === 'f-promise' && c.kind === 'followup_promised_due_soon'), 'should detect promised soon follow-up');
assert(candidates.some((c) => c.recordId === 't-overdue' && c.kind === 'task_overdue'), 'should detect overdue task');
assert(!candidates.some((c) => c.recordId === 't-deferred'), 'should skip deferred task while deferred');

assert(isWithinQuietHours('2026-04-10T22:00:00.000Z', '21:00', '06:30'), 'quiet hours should include late night');
assert(isWithinQuietHours('2026-04-11T05:30:00.000Z', '21:00', '06:30'), 'quiet hours should include early morning across midnight');
assert(!isWithinQuietHours('2026-04-11T14:00:00.000Z', '21:00', '06:30'), 'quiet hours should exclude midday');

const dueSoon = candidates.find((candidate) => candidate.kind === 'followup_promised_due_soon');
assert(Boolean(dueSoon), 'due soon candidate expected');
const ledger: ReminderLedgerEntry = {
  signature: dueSoon!.signature,
  lastDeliveredAt: '2026-04-10T08:10:00.000Z',
  deliveryCount: 1,
};
assert(!shouldDeliverReminder(dueSoon!, ledger, enabledPrefs, now), 'should cooldown duplicate due soon reminder');
assert(shouldDeliverReminder(dueSoon!, ledger, enabledPrefs, '2026-04-10T12:30:00.000Z'), 'should allow due soon reminder after cooldown window');

const attention = buildWorkspaceAttentionCounts([overdueFollowUp, dueTodayFollowUp], [overdueTask], enabledPrefs, now);
assert(attention.followups >= 2, 'workspace followups attention should include actionable follow-up candidates');
assert(attention.tasks >= 1, 'workspace tasks attention should include actionable task candidates');
assert(attention.worklist === attention.followups + attention.tasks, 'worklist attention should be sum of followups and tasks');

const legacyPrefsPayload: Record<string, never> | undefined = undefined;
const hydratedPrefs = { ...DEFAULT_REMINDER_PREFERENCES, ...(legacyPrefsPayload ?? {}) };
assert(hydratedPrefs.enabled === DEFAULT_REMINDER_PREFERENCES.enabled, 'hydration should keep reminder preference defaults when payload missing');
const oldLedger: ReminderLedgerEntry[] = [];
assert(Array.isArray(oldLedger), 'legacy payload without reminder ledger should hydrate to empty ledger');
