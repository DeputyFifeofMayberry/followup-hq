import { ChevronDown, Plus, Search, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { memo } from 'react';
import { AppBadge } from '../ui/AppPrimitives';

type TaskView = 'today' | 'upcoming' | 'blocked' | 'all';
type TaskSort = 'due' | 'priority' | 'updated';

type FilterChip = { key: string; label: string; clear: () => void };

type TaskToolbarProps = {
  isMobileLike: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  view: TaskView;
  onViewChange: (value: TaskView) => void;
  taskViewOptions: Array<{ value: TaskView; label: string }>;
  viewOptionsOpen: boolean;
  onToggleViewOptions: () => void;
  onOpenCreateTaskModal: () => void;
  activeFilterCount: number;
  personalMode: boolean;
  projectFilter: string;
  projectOptions: string[];
  onProjectFilterChange: (value: string) => void;
  assigneeFilter: string;
  assignees: string[];
  onAssigneeFilterChange: (value: string) => void;
  taskOwnerFilter: string;
  owners: string[];
  onTaskOwnerFilterChange: (value: string) => void;
  taskStatusFilter: 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done';
  onTaskStatusFilterChange: (value: 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done') => void;
  linkedFilter: 'all' | 'linked' | 'unlinked';
  onLinkedFilterChange: (value: 'all' | 'linked' | 'unlinked') => void;
  sortBy: TaskSort;
  onSortByChange: (value: TaskSort) => void;
  onResetFilters: () => void;
  activeFilterChips: FilterChip[];
};

export const TaskToolbar = memo(function TaskToolbar({
  isMobileLike,
  searchQuery,
  onSearchQueryChange,
  onClearSearch,
  view,
  onViewChange,
  taskViewOptions,
  viewOptionsOpen,
  onToggleViewOptions,
  onOpenCreateTaskModal,
  activeFilterCount,
  personalMode,
  projectFilter,
  projectOptions,
  onProjectFilterChange,
  assigneeFilter,
  assignees,
  onAssigneeFilterChange,
  taskOwnerFilter,
  owners,
  onTaskOwnerFilterChange,
  taskStatusFilter,
  onTaskStatusFilterChange,
  linkedFilter,
  onLinkedFilterChange,
  sortBy,
  onSortByChange,
  onResetFilters,
  activeFilterChips,
}: TaskToolbarProps) {
  return (
    <div className="workspace-control-stack task-control-stack-calm">
      <div className={`task-primary-toolbar-slim ${isMobileLike ? 'task-primary-toolbar-slim-mobile' : ''}`}>
        <label className="field-block task-search-block">
          <span className="field-label">Search</span>
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Title, next step, notes" className="field-input search-field-input" />
            {searchQuery ? <button type="button" onClick={onClearSearch} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        <label className="field-block task-view-picker">
          <span className="field-label">View</span>
          <select value={view} onChange={(event) => onViewChange(event.target.value as TaskView)} className="field-input">
            {taskViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <div className="task-toolbar-actions">
          <button onClick={onToggleViewOptions} className="action-btn">
            <SlidersHorizontal className="h-4 w-4" />
            Options
            {activeFilterCount > 0 ? <AppBadge tone="info">{activeFilterCount}</AppBadge> : null}
            <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onOpenCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
        </div>
      </div>

      {viewOptionsOpen ? (
        <div className="task-filters-panel-slim">
          <div className={`task-view-options-grid ${personalMode ? 'task-view-options-grid-personal' : ''}`}>
            <label className="field-block"><span className="field-label">Project</span><select value={projectFilter} onChange={(event) => onProjectFilterChange(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Assignee</span><select value={assigneeFilter} onChange={(event) => onAssigneeFilterChange(event.target.value)} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select></label>
            {!personalMode ? <label className="field-block"><span className="field-label">Owner</span><select value={taskOwnerFilter} onChange={(event) => onTaskOwnerFilterChange(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select></label> : null}
            <label className="field-block"><span className="field-label">Status</span><select value={taskStatusFilter} onChange={(event) => onTaskStatusFilterChange(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Linked</span><select value={linkedFilter} onChange={(event) => onLinkedFilterChange(event.target.value as 'all' | 'linked' | 'unlinked')} className="field-input"><option value="all">All</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option></select></label>
            <label className="field-block"><span className="field-label">Sort</span><select value={sortBy} onChange={(event) => onSortByChange(event.target.value as TaskSort)} className="field-input"><option value="due">Due date</option><option value="priority">Priority</option><option value="updated">Recently updated</option></select></label>
          </div>
          <div className="task-view-options-reset-row">
            <button onClick={onResetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset</button>
          </div>
        </div>
      ) : null}

      {activeFilterChips.length > 1 ? (
        <div className="task-filter-chip-row task-filter-chip-row-muted">
          {activeFilterChips.map((chip) => <button key={chip.key} onClick={chip.clear} className="task-filter-chip task-filter-chip-quiet">{chip.label} <span aria-hidden="true">×</span></button>)}
        </div>
      ) : null}
    </div>
  );
});
