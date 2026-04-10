import { useAppStore } from '../../useAppStore';
import { initialBusinessState, initialMetaState, initialUiState } from '../../state/initialState';

function resetStore() {
  useAppStore.setState({ ...initialBusinessState, ...initialUiState, ...initialMetaState });
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

(function run() {
  resetStore();
  useAppStore.getState().openExecutionLane('followups', {
    source: 'overview',
    section: 'triage',
    recordId: 'FU-77',
    recordType: 'followup',
    project: 'Project Alpha',
  });

  let state = useAppStore.getState();
  assert(state.selectedId === 'FU-77', 'follow-up record-open should select the target follow-up');
  assert(state.activeView === 'All', 'follow-up record-open should keep active view broad');
  assert(state.followUpFilters.project === 'All', 'follow-up record-open should clear project narrowing');

  resetStore();
  useAppStore.getState().openExecutionLane('followups', {
    source: 'overview',
    section: 'triage',
    project: 'Project Alpha',
  });
  state = useAppStore.getState();
  assert(state.activeView === 'Needs nudge', 'follow-up section-open should preserve queue narrowing');
  assert(state.followUpFilters.project === 'Project Alpha', 'follow-up section-open should preserve project scope');

  resetStore();
  useAppStore.getState().openExecutionLane('tasks', {
    source: 'overview',
    section: 'blocked',
    recordId: 'TASK-22',
    recordType: 'task',
  });
  state = useAppStore.getState();
  assert(state.selectedTaskId === 'TASK-22', 'task record-open should select the target task');
  assert(state.taskStatusFilter === 'All', 'task record-open should not force blocked status scope');
  assert(JSON.stringify(state.executionFilter.types) === JSON.stringify(['task']), 'task record-open should keep task lane filter type');
  assert(state.executionFilter.blockedOnly === false, 'task record-open should clear blocked-only narrowing');

  resetStore();
  useAppStore.getState().openExecutionLane('tasks', {
    source: 'overview',
    section: 'blocked',
  });
  state = useAppStore.getState();
  assert(state.taskStatusFilter === 'Blocked', 'task section-open should preserve blocked status scope');
  assert(JSON.stringify(state.executionFilter.types) === JSON.stringify(['task']), 'task section-open should target task rows');
  assert(state.executionFilter.blockedOnly === true, 'task section-open should narrow to blocked rows');
})();
