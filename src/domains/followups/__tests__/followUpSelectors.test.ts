import { buildFollowUpCounts, defaultFollowUpFilters, selectFollowUpRows } from '../../../lib/followUpSelectors';
import { starterCompanies, starterContacts, starterItems } from '../../../lib/sample-data';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runFollowUpSelectorChecks() {
  const rows = selectFollowUpRows({
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    search: 'vendor',
    activeView: 'All',
    filters: defaultFollowUpFilters,
  });
  assert(rows.length > 0, 'search should return at least one follow-up');
  const counts = buildFollowUpCounts(rows);
  assert(counts.total === rows.length, 'count total should match rows length');
}

runFollowUpSelectorChecks();
