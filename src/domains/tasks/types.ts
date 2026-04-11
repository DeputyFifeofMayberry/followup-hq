import type { TaskWorkspaceSession } from '../../types';

export type {
  TaskItem,
  TaskStatus,
  TaskSort,
  TaskView,
  TaskTimingFilter,
  TaskStateFilter,
  TaskLinkageFilter,
  TaskPriorityFilter,
  TaskWorkspaceSession,
} from '../../types';

export const defaultTaskWorkspaceSession: TaskWorkspaceSession = {
  view: 'all',
  searchQuery: '',
  sortBy: 'due',
  projectFilter: 'All',
  assigneeFilter: 'All',
  ownerFilter: 'All',
  statusFilter: 'All',
  linkedFilter: 'all',
  timingFilter: 'all',
  stateFilter: 'all',
  priorityFilter: 'All',
};
