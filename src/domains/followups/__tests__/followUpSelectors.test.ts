/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultFollowUpFilters, getActiveFollowUpRowAffectingOptions, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
import { starterCompanies, starterContacts, starterItems } from '../../../lib/sample-data';
import { daysUntil, isOverdue, localDayDelta } from '../../../lib/utils';
import { buildDailyFocusSummary } from '../../../lib/dailyFocus';
import { classifyFollowUpItem } from '../helpers/followUpLanes';
import type { FollowUpItem, TaskItem } from '../../../types';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function withMockedNow(iso: string, run: () => void) {
  const RealDate = Date;
  class MockDate extends RealDate {
    constructor(...args: any[]) {
      if (args.length === 0) {
        super(iso);
        return;
      }
      if (args.length === 1) {
        super(args[0]);
        return;
      }
      if (args.length === 2) {
        super(args[0], args[1]);
        return;
      }
      if (args.length === 3) {
        super(args[0], args[1], args[2]);
        return;
      }
      if (args.length === 4) {
        super(args[0], args[1], args[2], args[3]);
        return;
      }
      if (args.length === 5) {
        super(args[0], args[1], args[2], args[3], args[4]);
        return;
      }
      if (args.length === 6) {
        super(args[0], args[1], args[2], args[3], args[4], args[5]);
        return;
      }
      super(args[0], args[1], args[2], args[3], args[4], args[5], args[6]);
    }
    static now() {
      return new RealDate(iso).getTime();
    }
  }
  (globalThis as any).Date = MockDate;
  try {
    run();
  } finally {
    (globalThis as any).Date = RealDate;
  }
}

function makeFollowUp(overrides: Partial<FollowUpItem>): FollowUpItem {
  return {
    ...starterItems[0],
    id: overrides.id ?? starterItems[0].id,
    title: overrides.title ?? starterItems[0].title,
    dueDate: overrides.dueDate ?? starterItems[0].dueDate,
    nextTouchDate: overrides.nextTouchDate ?? starterItems[0].nextTouchDate,
    status: overrides.status ?? 'Needs action',
    lifecycleState: 'ready',
    dataQuality: 'valid_live',
    needsCleanup: false,
    reviewReasons: [],
    sourceRef: overrides.sourceRef ?? 'test-source',
    owner: overrides.owner ?? 'QA Owner',
    project: overrides.project ?? 'QA Project',
    ...overrides,
  };
}

function makeTask(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: 'task-1',
    title: 'Task',
    project: 'QA Project',
    owner: 'QA Owner',
    status: 'To do',
    priority: 'High',
    dueDate: '2026-04-12T12:00:00.000Z',
    summary: '',
    nextStep: '',
    notes: '',
    tags: [],
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    lifecycleState: 'ready',
    dataQuality: 'valid_live',
    provenance: { sourceType: 'quick_capture', sourceRef: 'task-seed', capturedAt: '2026-04-01T00:00:00.000Z' },
    ...overrides,
  };
}

export function runFollowUpSelectorChecks() {
  const baseInput = {
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    search: '',
    filters: defaultFollowUpFilters,
  };

  const openRows = selectFollowUpRows({ ...baseInput, activeView: 'All' });
  assert(openRows.every((row) => row.status !== 'Closed'), 'All open should never include closed follow-ups');

  const closedRows = selectFollowUpRows({ ...baseInput, activeView: 'Closed' });
  assert(closedRows.every((row) => row.status === 'Closed'), 'Closed view should only include closed follow-ups');

  const counts = selectFollowUpViewCounts(baseInput);
  assert(counts.allOpen === openRows.length, 'All open count should equal all-open rows');
  assert(counts.closed === closedRows.length, 'Closed count should equal closed rows');

  const needsNudgeRows = selectFollowUpRows({ ...baseInput, activeView: 'Needs nudge' });
  const atRiskRows = selectFollowUpRows({ ...baseInput, activeView: 'At risk' });
  const readyToCloseRows = selectFollowUpRows({ ...baseInput, activeView: 'Ready to close' });

  assert(needsNudgeRows.every((row) => row.status !== 'Closed'), 'Needs nudge should exclude closed');
  assert(atRiskRows.every((row) => row.status !== 'Closed'), 'At risk should exclude closed');
  assert(readyToCloseRows.every((row) => row.status !== 'Closed'), 'Ready to close should exclude closed');
  assert(counts.needsNudge === needsNudgeRows.length, 'Needs nudge count should match filtered rows');
  assert(counts.atRisk === atRiskRows.length, 'At risk count should match filtered rows');
  assert(counts.readyToClose === readyToCloseRows.length, 'Ready to close count should match filtered rows');

  const hiddenByPersistedFilters = selectFollowUpRows({
    ...baseInput,
    activeView: 'All',
    search: 'this-term-does-not-match',
    filters: { ...defaultFollowUpFilters, status: 'Closed' },
  });
  assert(hiddenByPersistedFilters.length === 0, 'Persisted search + status filters should be able to hide lane rows');

  const activeOptions = getActiveFollowUpRowAffectingOptions({
    search: 'permit',
    activeView: 'Waiting',
    filters: {
      ...defaultFollowUpFilters,
      status: 'At risk',
      project: 'North Yard',
      owner: 'Avery',
      assignee: 'Jordan',
      waitingOn: 'Vendor',
      escalation: 'Escalate',
      priority: 'Critical',
      actionState: 'Ready to send',
      category: 'Issue',
      dueDateRange: 'overdue',
      nextTouchDateRange: 'today',
      promisedDateRange: 'this_week',
      linkedTaskState: 'blocked_child',
      cleanupOnly: true,
    },
  });
  assert(activeOptions.length === 16, `Expected all row-affecting options to be tracked, got ${activeOptions.length}`);

  withMockedNow('2026-04-10T08:15:00', () => {
    const dueEarlierToday = makeFollowUp({ id: 'TODAY-AM', dueDate: '2026-04-10T00:30:00' });
    const dueLaterToday = makeFollowUp({ id: 'TODAY-PM', dueDate: '2026-04-10T22:30:00' });
    const dueYesterday = makeFollowUp({ id: 'YESTERDAY', dueDate: '2026-04-09T23:00:00' });
    const waiting = makeFollowUp({ id: 'WAITING', status: 'Waiting on external', waitingOn: 'Vendor', dueDate: '2026-04-15T22:30:00' });
    const atRisk = makeFollowUp({ id: 'ATRISK', escalationLevel: 'Critical', dueDate: '2026-04-15T22:30:00' });
    const needsNudgeOnly = makeFollowUp({
      id: 'NUDGE',
      status: 'Waiting on external',
      dueDate: '2026-04-13T08:00:00',
      nextTouchDate: '2026-04-09T07:00:00',
      lastTouchDate: '2026-04-01T07:00:00',
    });
    const closed = makeFollowUp({ id: 'CLOSED', status: 'Closed', dueDate: '2026-04-08T23:00:00' });
    const cleanup = makeFollowUp({ id: 'CLEANUP', lifecycleState: 'review_required', dataQuality: 'review_required', needsCleanup: true, reviewReasons: ['legacy_record_requires_cleanup'] });

    assert(daysUntil(dueEarlierToday.dueDate) === 0, 'daysUntil should return 0 for due earlier today');
    assert(daysUntil(dueLaterToday.dueDate) === 0, 'daysUntil should return 0 for due later today');
    assert(!isOverdue(dueEarlierToday), 'Due-today follow-up must not be overdue');
    assert(isOverdue(dueYesterday), 'Yesterday due follow-up should be overdue');
    assert(localDayDelta(new Date(), dueYesterday.dueDate) < 0, 'Local day delta should mark yesterday as overdue');

    const allRows = [dueEarlierToday, dueLaterToday, dueYesterday, waiting, atRisk, needsNudgeOnly, closed, cleanup];

    const overdueRows = selectFollowUpRows({ ...baseInput, items: allRows, activeView: 'Overdue', search: '', filters: defaultFollowUpFilters });
    assert(overdueRows.length === 1 && overdueRows[0].id === 'YESTERDAY', 'Overdue view should include only prior local-day due dates');

    const todayRows = selectFollowUpRows({ ...baseInput, items: allRows, activeView: 'Today', search: '', filters: defaultFollowUpFilters });
    const todayIds = new Set(todayRows.map((row) => row.id));
    assert(todayRows.length === 2 && todayIds.has('TODAY-AM') && todayIds.has('TODAY-PM'), 'Today view should include only due-today rows');

    const nudgeRows = selectFollowUpRows({ ...baseInput, items: allRows, activeView: 'Needs nudge', search: '', filters: defaultFollowUpFilters });
    const nudgeIds = new Set(nudgeRows.map((row) => row.id));
    assert(nudgeIds.has('NUDGE'), 'Needs nudge should include true nudge-cadence records');
    assert(!nudgeIds.has('YESTERDAY') && !nudgeIds.has('TODAY-AM') && !nudgeIds.has('TODAY-PM'), 'Needs nudge should not include overdue or due-today records');

    const waitingRows = selectFollowUpRows({ ...baseInput, items: allRows, activeView: 'Waiting', search: '', filters: defaultFollowUpFilters });
    assert(waitingRows.some((row) => row.id === 'WAITING'), 'Waiting view should include waiting-status records');

    const atRiskRowsFromSelector = selectFollowUpRows({ ...baseInput, items: allRows, activeView: 'At risk', search: '', filters: defaultFollowUpFilters });
    assert(atRiskRowsFromSelector.some((row) => row.id === 'ATRISK'), 'At risk view should include critical escalation records');

    const cleanupOnlyRows = selectFollowUpRows({
      ...baseInput,
      items: allRows,
      activeView: 'All items',
      filters: { ...defaultFollowUpFilters, cleanupOnly: true },
      search: '',
    });
    assert(cleanupOnlyRows.length === 1 && cleanupOnlyRows[0].id === 'CLEANUP', 'Cleanup-only mode should intentionally target review-required records');

    const cleanupClass = classifyFollowUpItem(cleanup);
    assert(cleanupClass.isCleanupOnly, 'Classification should flag review-required records as cleanup-only');
    assert(cleanupClass.pressureBucket === 'cleanup', 'Review-required classification should use cleanup pressure bucket');

    const overdueClass = classifyFollowUpItem(dueYesterday);
    assert(overdueClass.pressureBucket === 'overdue', 'Overdue record should map to overdue pressure bucket');
    assert(!overdueClass.laneMemberships.has('needs_nudge'), 'Overdue record should not also be in needs nudge lane');

    const dailyFocus = buildDailyFocusSummary(allRows, [makeTask({ id: 'TASK-OVERDUE', dueDate: '2026-04-09T10:00:00.000Z' })]);
    assert(dailyFocus.overdueFollowUps === overdueRows.length, 'Daily Focus overdue follow-ups should align with overdue lane rows');
    assert(dailyFocus.dueTodayFollowUps === todayRows.length, 'Daily Focus due-today follow-ups should align with Today lane rows');
    assert(dailyFocus.nudgeFollowUps === nudgeRows.length, 'Daily Focus nudge follow-ups should align with Needs nudge lane rows');
  });
}

runFollowUpSelectorChecks();
