import { useAppStore } from '../useAppStore';
import { initialBusinessState, initialMetaState, initialUiState } from '../state/initialState';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testResetForLogout(): void {
  useAppStore.setState({
    ...useAppStore.getState(),
    hydrated: true,
    selectedId: 'item-1',
    selectedTaskId: 'task-1',
    itemModal: { open: true, mode: 'edit', itemId: 'item-1' },
    taskModal: { open: true, mode: 'edit', taskId: 'task-1' },
    mergeModal: { open: true, baseId: 'item-1', candidateId: 'item-2' },
    draftModal: { open: true, itemId: 'item-1' },
    importModalOpen: true,
    touchModalOpen: true,
    recordDrawerRef: { type: 'followup', id: 'item-1' },
    conflictQueue: [{
      id: 'conflict-1',
      entity: 'followup',
      recordId: 'item-1',
      conflictType: 'revision_mismatch',
      summary: 'Conflict',
      status: 'open',
      createdAt: new Date().toISOString(),
    }],
    duplicateReviews: [{ left: { id: 'a' } as any, right: { id: 'b' } as any, score: 0.9, reasons: ['test'] }],
  });

  useAppStore.getState().resetForLogout();
  const state = useAppStore.getState();

  assert(state.hydrated === initialMetaState.hydrated, 'resetForLogout should reset meta state to signed-out baseline');
  assert(state.itemModal.open === false && state.taskModal.open === false, 'resetForLogout should close modals');
  assert(state.recordDrawerRef === null, 'resetForLogout should close drawers');
  assert(state.selectedId === null && state.selectedTaskId === null, 'resetForLogout should clear selections');
  assert(state.conflictQueue.length === 0, 'resetForLogout should clear conflict queue');
  assert(state.duplicateReviews.length === 0, 'resetForLogout should clear duplicate review state');
  assert(state.items.length === initialBusinessState.items.length, 'resetForLogout should reset business entities');
  assert(state.followUpColumns.length === initialUiState.followUpColumns.length, 'resetForLogout should preserve initial UI defaults');
}

(function run() {
  testResetForLogout();
})();
