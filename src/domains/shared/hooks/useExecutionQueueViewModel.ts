import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionQueueStats } from '../selectors/executionQueueSelectors';

export function useExecutionQueueViewModel() {
  const store = useAppStore(useShallow((s) => ({
    getUnifiedQueue: s.getUnifiedQueue,
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
  })));

  const queue = store.getUnifiedQueue();
  const stats = useMemo(() => buildExecutionQueueStats(queue), [queue]);

  return { ...store, queue, stats };
}
