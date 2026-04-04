import { applyQueuePreset, applyUnifiedFilter, buildUnifiedQueue, sortUnifiedQueue } from '../../lib/unifiedQueue';
import { createId, todayIso } from '../../lib/utils';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

export function createExecutionViewSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'getUnifiedQueue' | 'setQueuePreset' | 'setExecutionFilter' | 'setExecutionSort' | 'setQueueDensity' | 'saveExecutionView' | 'applyExecutionView'
> {
  return {
    getUnifiedQueue: () => {
      const state = get();
      const queue = buildUnifiedQueue(state.items, state.tasks);
      const preset = applyQueuePreset(queue, state.queuePreset);
      return sortUnifiedQueue(applyUnifiedFilter(preset, state.executionFilter), state.executionSort);
    },
    setQueuePreset: (preset) => set({ queuePreset: preset }),
    setExecutionFilter: (filter) => set({ executionFilter: filter }),
    setExecutionSort: (sort) => set({ executionSort: sort }),
    setQueueDensity: (density) => set({ queueDensity: density }),
    saveExecutionView: (name, scope = 'personal') => {
      set((state: AppStore) => ({
        savedExecutionViews: [{ id: createId('VIEW'), name, scope, createdAt: todayIso(), preset: state.queuePreset, filter: state.executionFilter }, ...state.savedExecutionViews],
      }));
      queuePersist();
    },
    applyExecutionView: (viewId) => {
      const view = get().savedExecutionViews.find((entry) => entry.id === viewId);
      if (!view) return;
      set({ queuePreset: view.preset ?? 'Today', executionFilter: view.filter ?? {} });
    },
  };
}
