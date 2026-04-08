import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildFollowUpCounts, selectFollowUpRows, selectFollowUpViewCounts } from '../../../lib/followUpSelectors';

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
    selectedCount: store.selectedFollowUpIds.length,
  }), [store.tasks, store.selectedFollowUpIds.length]);

  const activeOptionCount = useMemo(() => (
    [
      store.followUpFilters.status !== 'All',
      store.followUpFilters.project !== 'All',
      store.followUpFilters.owner !== 'All',
      store.followUpFilters.assignee !== 'All',
      store.followUpFilters.priority !== 'All',
      store.followUpFilters.cleanupOnly,
      store.followUpFilters.dueDateRange !== 'all',
      store.followUpFilters.nextTouchDateRange !== 'all',
      store.followUpTableDensity !== 'compact',
      store.followUpColumns.length > 6,
    ].filter(Boolean).length
  ), [store.followUpFilters, store.followUpTableDensity, store.followUpColumns.length]);

  const duplicateCount = store.duplicateReviews.length;

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
    activeOptionCount,
    queueSummary,
    selectedFollowUp: store.items.find((item) => item.id === store.selectedId) ?? null,
  };
}
