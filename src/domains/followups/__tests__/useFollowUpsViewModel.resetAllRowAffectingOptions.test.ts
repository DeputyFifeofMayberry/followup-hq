import { defaultFollowUpFilters, selectFollowUpRows } from '../../../lib/followUpSelectors';
import { starterCompanies, starterContacts, starterItems } from '../../../lib/sample-data';
import { resetAllFollowUpRowAffectingOptions } from '../hooks/useFollowUpsViewModel';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function runResetAllRowAffectingOptionsChecks() {
  const calls: string[] = [];
  const actions = {
    setActiveView: (view: 'All') => calls.push(`activeView:${view}`),
    setSearch: (value: string) => calls.push(`search:${value}`),
    resetFollowUpFilters: () => calls.push('filters:reset'),
  };

  resetAllFollowUpRowAffectingOptions(actions);
  assert(
    calls.join('|') === 'activeView:All|search:|filters:reset',
    `Expected reset to clear activeView/search/filters, received ${calls.join('|')}`,
  );

  const hiddenRows = selectFollowUpRows({
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    search: 'this-term-does-not-match',
    activeView: 'Waiting',
    filters: { ...defaultFollowUpFilters, status: 'Closed' },
  });
  assert(hiddenRows.length === 0, 'Expected row-affecting narrowing to hide rows before reset');

  const visibleRowsAfterReset = selectFollowUpRows({
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    search: '',
    activeView: 'All',
    filters: defaultFollowUpFilters,
  });
  assert(visibleRowsAfterReset.length > 0, 'Expected reset defaults to reveal rows hidden by narrowing');
}

runResetAllRowAffectingOptionsChecks();
