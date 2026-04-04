import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildFollowUpCounts, selectFollowUpRows } from '../../../lib/followUpSelectors';

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

  return { ...store, filteredRows, followUpStats, openTaskCount };
}
