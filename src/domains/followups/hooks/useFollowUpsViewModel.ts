import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildFollowUpCounts, selectFollowUpRows } from '../../../lib/followUpSelectors';
import { buildExecutionLaneMetrics, selectExecutionLaneItems } from '../../shared';

export function useFollowUpsViewModel() {
  const store = useAppStore(
    useShallow((s) => ({
      items: s.items,
      contacts: s.contacts,
      companies: s.companies,
      search: s.search,
      activeView: s.activeView,
      followUpFilters: s.followUpFilters,
      tasks: s.tasks,
      openCreateModal: s.openCreateModal,
      setSelectedId: s.setSelectedId,
      setActiveView: s.setActiveView,
      setFollowUpFilters: s.setFollowUpFilters,
      executionIntent: s.executionIntent,
      clearExecutionIntent: s.clearExecutionIntent,
      getUnifiedQueue: s.getUnifiedQueue,
      executionLaneSessions: s.executionLaneSessions,
      lastExecutionRoute: s.lastExecutionRoute,
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

  const followUpStats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);
  const openTaskCount = useMemo(() => store.tasks.filter((task) => task.status !== 'Done').length, [store.tasks]);
  const laneItems = useMemo(
    () => selectExecutionLaneItems('followups', store.getUnifiedQueue(), { project: store.executionLaneSessions.followups.lastProjectScope ?? undefined }),
    [store.getUnifiedQueue, store.executionLaneSessions.followups.lastProjectScope],
  );
  const executionMetrics = useMemo(
    () => buildExecutionLaneMetrics(laneItems, store.selectedId, store.lastExecutionRoute),
    [laneItems, store.selectedId, store.lastExecutionRoute],
  );

  return { ...store, filteredRows, followUpStats, openTaskCount, laneItems, executionMetrics };
}
