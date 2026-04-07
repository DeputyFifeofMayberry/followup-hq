import { defaultFollowUpFilters, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
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
}

runFollowUpSelectorChecks();
