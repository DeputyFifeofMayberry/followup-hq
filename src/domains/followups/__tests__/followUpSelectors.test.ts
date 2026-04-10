import { defaultFollowUpFilters, getActiveFollowUpRowAffectingOptions, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
import { starterCompanies, starterContacts, starterItems } from '../../../lib/sample-data';
import { daysUntil, isOverdue, localDayDelta } from '../../../lib/utils';
import type { FollowUpItem } from '../../../types';

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).Date = MockDate;
  try {
    run();
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    assert(daysUntil(dueEarlierToday.dueDate) === 0, 'daysUntil should return 0 for due earlier today');
    assert(daysUntil(dueLaterToday.dueDate) === 0, 'daysUntil should return 0 for due later today');
    assert(!isOverdue(dueEarlierToday), 'Due-today follow-up must not be overdue');
    assert(isOverdue(dueYesterday), 'Yesterday due follow-up should be overdue');
    assert(localDayDelta(new Date(), dueYesterday.dueDate) < 0, 'Local day delta should mark yesterday as overdue');

    const selectorRows = selectFollowUpRows({
      ...baseInput,
      items: [dueEarlierToday, dueLaterToday, dueYesterday],
      activeView: 'Overdue',
      search: '',
      filters: defaultFollowUpFilters,
    });
    assert(selectorRows.length === 1 && selectorRows[0].id === 'YESTERDAY', 'Overdue view should include only prior local-day due dates');

    const todayDueRows = selectFollowUpRows({
      ...baseInput,
      items: [dueEarlierToday, dueLaterToday, dueYesterday],
      activeView: 'All',
      filters: { ...defaultFollowUpFilters, dueDateRange: 'today' },
      search: '',
    });
    assert(todayDueRows.length === 2, 'Today due-date filter should include all items due on the local calendar day');
  });
}

runFollowUpSelectorChecks();
