import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { buildExecutionLaneMetrics, selectExecutionLaneItems } from '../../shared';
import { useMemo } from 'react';

export function useTasksViewModel() {
  const store = useAppStore(useShallow((s) => ({
    tasks: s.tasks,
    items: s.items,
    projects: s.projects,
    selectedTaskId: s.selectedTaskId,
    taskOwnerFilter: s.taskOwnerFilter,
    taskStatusFilter: s.taskStatusFilter,
    setSelectedTaskId: s.setSelectedTaskId,
    setTaskOwnerFilter: s.setTaskOwnerFilter,
    setTaskStatusFilter: s.setTaskStatusFilter,
    openCreateTaskModal: s.openCreateTaskModal,
    openEditTaskModal: s.openEditTaskModal,
    deleteTask: s.deleteTask,
    updateTask: s.updateTask,
    attemptTaskTransition: s.attemptTaskTransition,
    executionIntent: s.executionIntent,
    clearExecutionIntent: s.clearExecutionIntent,
    getUnifiedQueue: s.getUnifiedQueue,
    executionLaneSessions: s.executionLaneSessions,
    lastExecutionRoute: s.lastExecutionRoute,
  })));

  const laneItems = useMemo(
    () => selectExecutionLaneItems('tasks', store.getUnifiedQueue(), { project: store.executionLaneSessions.tasks.lastProjectScope ?? undefined }),
    [store.getUnifiedQueue, store.executionLaneSessions.tasks.lastProjectScope],
  );
  const executionMetrics = useMemo(
    () => buildExecutionLaneMetrics(laneItems, store.selectedTaskId, store.lastExecutionRoute),
    [laneItems, store.selectedTaskId, store.lastExecutionRoute],
  );

  return { ...store, laneItems, executionMetrics };
}
