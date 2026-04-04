import { applyQueuePreset, applyUnifiedFilter, buildUnifiedQueue, sortUnifiedQueue } from '../../lib/unifiedQueue';
import { createId, todayIso } from '../../lib/utils';
import type { AppStore, AppStoreActions } from '../types';
import type { ExecutionIntent, UnifiedQueueFilter } from '../../types';
import type { SliceContext, SliceGet, SliceSet } from './types';

export function createExecutionViewSlice(set: SliceSet, get: SliceGet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'getUnifiedQueue' | 'setQueuePreset' | 'setExecutionFilter' | 'setExecutionSort' | 'setQueueDensity' | 'saveExecutionView' | 'applyExecutionView' |
  'setExecutionSelectedId' | 'launchExecutionIntent' | 'clearExecutionIntent' | 'openExecutionLane'
> {
  const sectionToTaskFilter = (section?: string): UnifiedQueueFilter => {
    if (section === 'blocked') return { types: ['task'], blockedOnly: true };
    if (section === 'ready_to_close') return { types: ['task'], readyToCloseParentOnly: true };
    return { types: ['task'] };
  };

  const sectionToFollowUpIntentView = (section?: string) => {
    if (section === 'blocked') return 'At risk';
    if (section === 'triage') return 'Needs nudge';
    if (section === 'ready_to_close') return 'Ready to close';
    return 'All';
  };

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
    setExecutionSelectedId: (id) => set({ executionSelectedId: id }),
    launchExecutionIntent: (intent) => {
      const payload: ExecutionIntent = { ...intent, createdAt: new Date().toISOString() };
      set({ executionIntent: payload });
    },
    clearExecutionIntent: () => set({ executionIntent: null }),
    openExecutionLane: (target, options) => {
      const intent: ExecutionIntent = {
        kind: options?.recordId ? 'open_record' : options?.section ? 'open_section' : 'open_lane',
        target,
        recordId: options?.recordId,
        recordType: options?.recordType,
        project: options?.project,
        section: options?.section,
        createdAt: new Date().toISOString(),
      };
      set({ executionIntent: intent });
      if (target === 'followups') {
        if (options?.recordType === 'followup' && options.recordId) set({ selectedId: options.recordId });
        set({
          activeView: sectionToFollowUpIntentView(options?.section),
          followUpFilters: {
            ...get().followUpFilters,
            project: options?.project || 'All',
          },
        });
        return;
      }
      if (options?.recordType === 'task' && options.recordId) set({ selectedTaskId: options.recordId });
      set({
        executionFilter: { ...get().executionFilter, ...sectionToTaskFilter(options?.section) },
        taskStatusFilter: options?.section === 'blocked' ? 'Blocked' : 'All',
      });
    },
  };
}
