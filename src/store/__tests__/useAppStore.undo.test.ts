import { useAppStore } from '../useAppStore';
import { initialBusinessState, initialMetaState, initialUiState } from '../state/initialState';
import { normalizeItem } from '../../lib/utils';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

(function run() {
  useAppStore.setState({ ...initialBusinessState, ...initialUiState, ...initialMetaState });

  const item = normalizeItem({
    id: 'fu-1',
    title: 'FU',
    source: 'email',
    project: '',
    owner: 'Owner',
    status: 'Needs action',
    priority: 'Medium',
    dueDate: '2026-04-07',
    lastTouchDate: '2026-04-07',
    nextTouchDate: '2026-04-08',
    nextAction: 'do',
    summary: 'sum',
    tags: [],
    sourceRef: 'x',
    sourceRefs: [],
    mergedItemIds: [],
    notes: '',
    timeline: [],
    category: 'General',
    owesNextAction: 'Unknown',
    escalationLevel: 'None',
    cadenceDays: 3,
    draftFollowUp: '',
  });

  useAppStore.setState((state) => ({ ...state, items: [item] }));
  useAppStore.getState().deleteItem(item.id);
  assert(!useAppStore.getState().items.some((entry) => entry.id === item.id), 'deleteItem should remove follow-up');
  const undoEntry = useAppStore.getState().undoStack[0];
  assert(undoEntry?.actionKind === 'followup_delete', 'deleteItem should register undo entry');

  const result = useAppStore.getState().executeUndo(undoEntry.id);
  assert(result.ok, 'executeUndo should succeed for pending entry');
  assert(useAppStore.getState().items.some((entry) => entry.id === item.id), 'executeUndo should restore deleted follow-up');

  useAppStore.getState().updateItem(item.id, { dueDate: '2026-04-10' });
  useAppStore.getState().updateItem(item.id, { dueDate: '2026-04-12' });
  const entries = useAppStore.getState().undoStack.filter((entry) => entry.actionKind === 'followup_update');
  assert(entries.length >= 1, 'meaningful updates should register undo entries');
  assert(entries.some((entry) => entry.status === 'pending'), 'latest update undo should remain pending');
})();
