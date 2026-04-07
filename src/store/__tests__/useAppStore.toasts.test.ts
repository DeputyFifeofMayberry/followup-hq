import { useAppStore } from '../useAppStore';
import { initialUiState } from '../state/initialState';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

(function run() {
  useAppStore.setState({ ...useAppStore.getState(), toasts: [] });

  const firstId = useAppStore.getState().pushToast({ title: 'Task updated', tone: 'success' });
  assert(useAppStore.getState().toasts.length === 1, 'pushToast should add a toast');
  assert(useAppStore.getState().toasts[0].id === firstId, 'pushToast should return toast id');
  assert(!!useAppStore.getState().toasts[0].expiresAt, 'pushToast should set expiry metadata for host auto-dismiss');

  useAppStore.getState().dismissToast(firstId);
  assert(useAppStore.getState().toasts.length === 0, 'dismissToast should remove a toast');

  const expiringId = useAppStore.getState().pushToast({ title: 'Expiring toast', durationMs: 1 });
  useAppStore.getState().expireToast(expiringId);
  assert(useAppStore.getState().toasts.length === 0, 'expireToast should remove a toast for auto-dismiss path');

  const undoId = useAppStore.getState().pushToast({ title: 'Task deleted', action: { label: 'Undo', actionId: 'UNDO_missing' } });
  useAppStore.getState().handleToastAction(undoId);
  const nextToasts = useAppStore.getState().toasts;
  assert(nextToasts.length === 1, 'handleToastAction should emit feedback toast for undo action');
  assert(nextToasts[0].title.toLowerCase().includes('undo'), 'handleToastAction should produce undo feedback');

  useAppStore.setState({ ...useAppStore.getState(), toasts: initialUiState.toasts });
})();
