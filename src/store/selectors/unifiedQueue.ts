import { applyQueuePreset, applyUnifiedFilter, buildUnifiedQueue, sortUnifiedQueue } from '../../lib/unifiedQueue';
import type { AppStore } from '../types';

type UnifiedQueueInputs = Pick<AppStore, 'items' | 'tasks' | 'queuePreset' | 'executionFilter' | 'executionSort'>;

export function selectMaterializedUnifiedQueue(state: UnifiedQueueInputs) {
  const queue = buildUnifiedQueue(state.items, state.tasks);
  const preset = applyQueuePreset(queue, state.queuePreset);
  return sortUnifiedQueue(applyUnifiedFilter(preset, state.executionFilter), state.executionSort);
}
