import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { selectMaterializedUnifiedQueue } from '../../../store/selectors/unifiedQueue';
import { buildExecutionDailySections, buildExecutionQueueStats } from '../selectors/executionQueueSelectors';

export function useExecutionQueueViewModel() {
  const store = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    setSelectedId: s.setSelectedId,
    setSelectedTaskId: s.setSelectedTaskId,
    openCreateFromCapture: s.openCreateFromCapture,
    openTouchModal: s.openTouchModal,
    openDraftModal: s.openDraftModal,
    markNudged: s.markNudged,
    snoozeItem: s.snoozeItem,
    updateItem: s.updateItem,
    attemptFollowUpTransition: s.attemptFollowUpTransition,
    attemptTaskTransition: s.attemptTaskTransition,
    queuePreset: s.queuePreset,
    setQueuePreset: s.setQueuePreset,
    savedExecutionViews: s.savedExecutionViews,
    applyExecutionView: s.applyExecutionView,
    saveExecutionView: s.saveExecutionView,
    executionFilter: s.executionFilter,
    setExecutionFilter: s.setExecutionFilter,
    executionSort: s.executionSort,
    setExecutionSort: s.setExecutionSort,
    queueDensity: s.queueDensity,
    setQueueDensity: s.setQueueDensity,
    runValidatedBatchFollowUpTransition: s.runValidatedBatchFollowUpTransition,
    executionSelectedId: s.executionSelectedId,
    setExecutionSelectedId: s.setExecutionSelectedId,
    openExecutionLane: s.openExecutionLane,
    executionIntent: s.executionIntent,
    clearExecutionIntent: s.clearExecutionIntent,
  })));

  const queue = useMemo(() => selectMaterializedUnifiedQueue({
    items: store.items,
    tasks: store.tasks,
    queuePreset: store.queuePreset,
    executionFilter: store.executionFilter,
    executionSort: store.executionSort,
  }), [store.items, store.tasks, store.queuePreset, store.executionFilter, store.executionSort]);
  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);
  const dailySections = useMemo(() => buildExecutionDailySections(queue), [queue]);

  return { ...store, queue, stats, dailySections };
}
