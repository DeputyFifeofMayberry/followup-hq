import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';

export function useTasksViewModel() {
  return useAppStore(useShallow((s) => ({
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
  })));
}
