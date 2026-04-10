import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildFollowUpCounts, defaultFollowUpFilters, getActiveFollowUpRowAffectingOptions, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';
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

  useEffect(() => {
    if (!selectionScope.missingIds.length) return;
    store.selectAllVisibleFollowUps(selectionScope.selectedIds);
  }, [selectionScope.missingIds.length, selectionScope.selectedIds, store.selectAllVisibleFollowUps]);

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

  const queueStats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);

  const followUpStats = useMemo(() => ({
    openTaskCount: store.tasks.filter((task) => task.status !== 'Done').length,
    selectedCount: selectionScope.selectedIds.length,
    actionableSelectedCount: selectionScope.actionableIds.length,
  }), [store.tasks, selectionScope.selectedIds.length, selectionScope.actionableIds.length]);

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

  const duplicateCount = store.duplicateReviews.length;
  const hasActiveRowNarrowing = activeRowAffectingOptions.length > 0;
  const emptyStateMessage = hasActiveRowNarrowing
    ? `No follow-ups match the current filters: ${activeRowAffectingOptions.map((entry) => entry.label).join(' • ')}.`
    : 'No follow-ups yet. Add your first follow-up to start this lane.';

  const queueSummary = useMemo(() => {
    const scopeLabel = store.activeView === 'All' ? 'All open' : store.activeView;
    if (store.activeView === 'Closed') {
      return `Closed · ${filteredRows.length} shown`;
    }
    if (store.activeView === 'Needs nudge') {
      return `Needs nudge · ${filteredRows.length} shown · ${queueStats.overdueTouches} overdue touches`;
    }
    return `${scopeLabel} · ${filteredRows.length} shown · ${queueStats.needsNudge} need nudge · ${queueStats.readyToClose} ready to close`;
  }, [store.activeView, filteredRows.length, queueStats.needsNudge, queueStats.readyToClose, queueStats.overdueTouches]);

  return {
    ...store,
    filteredRows,
    followUpStats,
    queueStats,
    viewCounts,
    duplicateCount,
    activeOptionCount: activeRowAffectingOptions.length,
    activeRowAffectingOptions,
    hasActiveRowNarrowing,
    emptyStateMessage,
    clearFollowUpRowAffectingOption,
    resetAllRowAffectingOptions,
    queueSummary,
    selectionScope,
    actionableSelectedFollowUpIds: selectionScope.actionableIds,
    hiddenSelectionCount: selectionScope.hiddenIds.length,
    selectedFollowUp: store.items.find((item) => item.id === store.selectedId) ?? null,
  };
}
