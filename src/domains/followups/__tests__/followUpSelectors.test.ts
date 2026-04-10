import { defaultFollowUpFilters, getActiveFollowUpRowAffectingOptions, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
import { starterCompanies, starterContacts, starterItems } from '../../../lib/sample-data';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
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
}

runFollowUpSelectorChecks();
