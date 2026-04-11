import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildFollowUpCounts, defaultFollowUpFilters, getActiveFollowUpRowAffectingOptions, selectFollowUpQueuePressureCounts, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
import { deriveFollowUpSelectionScope } from '../helpers/selectionScope';

type FollowUpRowResetActions = {
  setActiveView: (view: 'All') => void;
  setSearch: (value: string) => void;
  resetFollowUpFilters: () => void;
};

export function resetAllFollowUpRowAffectingOptions(actions: FollowUpRowResetActions) {
  actions.setActiveView('All');
  actions.setSearch('');
  actions.resetFollowUpFilters();
}

export function useFollowUpsViewModel() {
  const store = useAppStore(
    useShallow((s) => ({
      items: s.items,
      contacts: s.contacts,
      companies: s.companies,
      tasks: s.tasks,
      search: s.search,
      activeView: s.activeView,
      followUpFilters: s.followUpFilters,
      selectedId: s.selectedId,
      duplicateReviews: s.duplicateReviews,
      selectedFollowUpIds: s.selectedFollowUpIds,
      followUpColumns: s.followUpColumns,
      followUpTableDensity: s.followUpTableDensity,
      executionIntent: s.executionIntent,
      openCreateModal: s.openCreateModal,
      clearExecutionIntent: s.clearExecutionIntent,
      setSelectedId: s.setSelectedId,
      setActiveView: s.setActiveView,
      setSearch: s.setSearch,
      setFollowUpFilters: s.setFollowUpFilters,
      resetFollowUpFilters: s.resetFollowUpFilters,
      clearFollowUpSelection: s.clearFollowUpSelection,
      batchUpdateFollowUps: s.batchUpdateFollowUps,
      runValidatedBatchFollowUpTransition: s.runValidatedBatchFollowUpTransition,
      setFollowUpColumns: s.setFollowUpColumns,
      setFollowUpTableDensity: s.setFollowUpTableDensity,
      toggleFollowUpSelection: s.toggleFollowUpSelection,
      selectAllVisibleFollowUps: s.selectAllVisibleFollowUps,
      markNudged: s.markNudged,
      openTouchModal: s.openTouchModal,
      snoozeItem: s.snoozeItem,
      deleteItem: s.deleteItem,
      confirmFollowUpSent: s.confirmFollowUpSent,
      updateItem: s.updateItem,
    })),
  );

  const filteredRows = useMemo(
    () => selectFollowUpRows({
      items: store.items,
      contacts: store.contacts,
      companies: store.companies,
      search: store.search,
      activeView: store.activeView,
      filters: store.followUpFilters,
    }),
    [store.items, store.contacts, store.companies, store.search, store.activeView, store.followUpFilters],
  );

  const selectionScope = useMemo(
    () => deriveFollowUpSelectionScope(store.items, filteredRows, store.selectedFollowUpIds),
    [store.items, filteredRows, store.selectedFollowUpIds],
  );

  const viewCounts = useMemo(
    () => selectFollowUpViewCounts({
      items: store.items,
      contacts: store.contacts,
      companies: store.companies,
      search: store.search,
      filters: store.followUpFilters,
    }),
    [store.items, store.contacts, store.companies, store.search, store.followUpFilters],
  );
  const queuePressureCounts = useMemo(
    () => selectFollowUpQueuePressureCounts({
      items: store.items,
      contacts: store.contacts,
      companies: store.companies,
      search: store.search,
      filters: store.followUpFilters,
    }),
    [store.items, store.contacts, store.companies, store.search, store.followUpFilters],
  );

  const queueStats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);

  const followUpStats = useMemo(() => ({
    openTaskCount: store.tasks.filter((task) => task.status !== 'Done').length,
    selectedCount: selectionScope.selectedIds.length,
    actionableSelectedCount: selectionScope.actionableIds.length,
    hiddenSelectedCount: selectionScope.hiddenIds.length,
  }), [store.tasks, selectionScope.selectedIds.length, selectionScope.actionableIds.length, selectionScope.hiddenIds.length]);

  const activeRowAffectingOptions = useMemo(() => getActiveFollowUpRowAffectingOptions({
    search: store.search,
    activeView: store.activeView,
    filters: store.followUpFilters,
  }), [store.search, store.activeView, store.followUpFilters]);

  const clearFollowUpRowAffectingOption = (key: (typeof activeRowAffectingOptions)[number]['key']) => {
    if (key === 'activeView') {
      store.setActiveView('All');
      return;
    }
    if (key === 'search') {
      store.setSearch('');
      return;
    }
    if (key === 'cleanupOnly') {
      store.setFollowUpFilters({ cleanupOnly: false });
      return;
    }
    if (key === 'status') {
      store.setFollowUpFilters({ status: defaultFollowUpFilters.status });
      return;
    }
    if (key === 'project') {
      store.setFollowUpFilters({ project: defaultFollowUpFilters.project });
      return;
    }
    if (key === 'owner') {
      store.setFollowUpFilters({ owner: defaultFollowUpFilters.owner });
      return;
    }
    if (key === 'assignee') {
      store.setFollowUpFilters({ assignee: defaultFollowUpFilters.assignee });
      return;
    }
    if (key === 'waitingOn') {
      store.setFollowUpFilters({ waitingOn: defaultFollowUpFilters.waitingOn });
      return;
    }
    if (key === 'escalation') {
      store.setFollowUpFilters({ escalation: defaultFollowUpFilters.escalation });
      return;
    }
    if (key === 'priority') {
      store.setFollowUpFilters({ priority: defaultFollowUpFilters.priority });
      return;
    }
    if (key === 'actionState') {
      store.setFollowUpFilters({ actionState: defaultFollowUpFilters.actionState });
      return;
    }
    if (key === 'category') {
      store.setFollowUpFilters({ category: defaultFollowUpFilters.category });
      return;
    }
    if (key === 'dueDateRange') {
      store.setFollowUpFilters({ dueDateRange: defaultFollowUpFilters.dueDateRange });
      return;
    }
    if (key === 'nextTouchDateRange') {
      store.setFollowUpFilters({ nextTouchDateRange: defaultFollowUpFilters.nextTouchDateRange });
      return;
    }
    if (key === 'promisedDateRange') {
      store.setFollowUpFilters({ promisedDateRange: defaultFollowUpFilters.promisedDateRange });
      return;
    }
    if (key === 'linkedTaskState') {
      store.setFollowUpFilters({ linkedTaskState: defaultFollowUpFilters.linkedTaskState });
    }
  };

  const resetAllRowAffectingOptions = () => {
    resetAllFollowUpRowAffectingOptions({
      setActiveView: store.setActiveView,
      setSearch: store.setSearch,
      resetFollowUpFilters: store.resetFollowUpFilters,
    });
  };

  const revealFollowUpRecord = (recordId: string) => {
    const record = store.items.find((item) => item.id === recordId);
    if (!record) return false;

    const queueMatches = selectFollowUpRows({
      items: [record],
      contacts: store.contacts,
      companies: store.companies,
      search: '',
      activeView: store.activeView,
      filters: defaultFollowUpFilters,
    }).length > 0;
    if (!queueMatches) store.setActiveView(record.status === 'Closed' ? 'All items' : 'All');

    const term = store.search.trim().toLowerCase();
    if (term) {
      const haystack = [
        record.id,
        record.title,
        record.project,
        record.owner,
        record.assigneeDisplayName || '',
        record.nextAction,
        record.summary,
        record.tags.join(' '),
        record.threadKey ?? '',
        record.waitingOn ?? '',
        store.contacts.find((entry) => entry.id === record.contactId)?.name ?? '',
        store.companies.find((entry) => entry.id === record.companyId)?.name ?? '',
      ].join(' ').toLowerCase();
      if (!haystack.includes(term)) store.setSearch('');
    }

    const patch: Partial<typeof store.followUpFilters> = {};
    if (store.followUpFilters.status !== 'All' && store.followUpFilters.status !== record.status) patch.status = 'All';
    if (store.followUpFilters.project !== 'All' && store.followUpFilters.project !== record.project) patch.project = 'All';
    if (store.followUpFilters.owner !== 'All' && store.followUpFilters.owner !== record.owner) patch.owner = 'All';
    if (store.followUpFilters.assignee !== 'All' && store.followUpFilters.assignee !== (record.assigneeDisplayName || record.owner)) patch.assignee = 'All';
    if (store.followUpFilters.waitingOn !== 'All' && store.followUpFilters.waitingOn !== (record.waitingOn || 'Unspecified')) patch.waitingOn = 'All';
    if (store.followUpFilters.escalation !== 'All' && store.followUpFilters.escalation !== record.escalationLevel) patch.escalation = 'All';
    if (store.followUpFilters.priority !== 'All' && store.followUpFilters.priority !== record.priority) patch.priority = 'All';
    if (store.followUpFilters.actionState !== 'All' && store.followUpFilters.actionState !== (record.actionState || 'Draft created')) patch.actionState = 'All';
    if (store.followUpFilters.category !== 'All' && store.followUpFilters.category !== record.category) patch.category = 'All';
    if (store.followUpFilters.dueDateRange !== 'all') patch.dueDateRange = 'all';
    if (store.followUpFilters.nextTouchDateRange !== 'all') patch.nextTouchDateRange = 'all';
    if (store.followUpFilters.promisedDateRange !== 'all') patch.promisedDateRange = 'all';
    if (store.followUpFilters.linkedTaskState !== 'all') patch.linkedTaskState = 'all';
    if (store.followUpFilters.cleanupOnly && !record.needsCleanup) patch.cleanupOnly = false;
    if (Object.keys(patch).length) store.setFollowUpFilters(patch);
    return true;
  };

  const duplicateCount = store.duplicateReviews.length;
  const hasActiveRowNarrowing = activeRowAffectingOptions.length > 0;
  const emptyStateMessage = hasActiveRowNarrowing
    ? `No follow-ups match the current filters: ${activeRowAffectingOptions.map((entry) => entry.label).join(' • ')}.`
    : 'No follow-ups yet. Add your first follow-up to start this lane.';

  const queueSummary = useMemo(() => {
    const shown = filteredRows.length;
    const itemLabel = shown === 1 ? 'follow-up' : 'follow-ups';
    if (store.activeView === 'All') return `Showing ${shown} open ${itemLabel}.`;
    if (store.activeView === 'Today') return `Showing ${shown} due-today ${itemLabel}.`;
    if (store.activeView === 'Needs nudge') return `Showing ${shown} ${store.activeView.toLowerCase()} ${itemLabel}; ${queueStats.overdueTouches} touch${queueStats.overdueTouches === 1 ? '' : 'es'} are overdue.`;
    if (store.activeView === 'At risk') return `Showing ${shown} at-risk ${itemLabel}.`;
    if (store.activeView === 'Waiting') return `Showing ${shown} waiting ${itemLabel}.`;
    if (store.activeView === 'Overdue') return `Showing ${shown} overdue ${itemLabel}.`;
    if (store.activeView === 'Closed') return `Showing ${shown} closed ${itemLabel}.`;
    if (store.activeView === 'All items') return `Showing ${shown} total ${itemLabel} across open and closed.`;
    return `Showing ${shown} ${store.activeView.toLowerCase()} ${itemLabel}.`;
  }, [store.activeView, filteredRows.length, queueStats.overdueTouches]);

  return {
    ...store,
    filteredRows,
    followUpStats,
    queueStats,
    queuePressureCounts,
    viewCounts,
    duplicateCount,
    activeOptionCount: activeRowAffectingOptions.length,
    activeRowAffectingOptions,
    hasActiveRowNarrowing,
    emptyStateMessage,
    clearFollowUpRowAffectingOption,
    resetAllRowAffectingOptions,
    revealFollowUpRecord,
    queueSummary,
    selectionScope,
    actionableSelectedFollowUpIds: selectionScope.actionableIds,
    hiddenSelectionCount: selectionScope.hiddenIds.length,
    selectedFollowUp: store.items.find((item) => item.id === store.selectedId) ?? null,
  };
}
