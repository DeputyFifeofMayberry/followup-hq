import { ChevronDown, Plus, Search, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { memo } from 'react';

type TaskView = 'today' | 'overdue' | 'upcoming' | 'blocked' | 'review' | 'deferred' | 'unlinked' | 'recent' | 'all';
type TaskSort = 'due' | 'priority' | 'updated';
type TimingFilter = 'all' | 'overdue' | 'today' | 'this_week' | 'no_due_date';
type StateFilter = 'all' | 'deferred_only' | 'review_needed_only' | 'blocked_without_unblock';
type LinkageFilter = 'all' | 'linked' | 'unlinked' | 'parent_at_risk';
type PriorityFilter = 'All' | 'Low' | 'Medium' | 'High' | 'Critical';

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
  linkedFilter: LinkageFilter;
  onLinkedFilterChange: (value: LinkageFilter) => void;
  timingFilter: TimingFilter;
  onTimingFilterChange: (value: TimingFilter) => void;
  stateFilter: StateFilter;
  onStateFilterChange: (value: StateFilter) => void;
  priorityFilter: PriorityFilter;
  onPriorityFilterChange: (value: PriorityFilter) => void;
  sortBy: TaskSort;
  onSortByChange: (value: TaskSort) => void;
  onResetFilters: () => void;
  activeFilterChips: FilterChip[];
  sortSummary: string;
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
  timingFilter,
  onTimingFilterChange,
  stateFilter,
  onStateFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  sortBy,
  onSortByChange,
  onResetFilters,
  activeFilterChips,
  sortSummary,
}: TaskToolbarProps) {
  return (
    <div className="workspace-control-stack task-control-stack-calm">
      <div className={`task-primary-toolbar-slim ${isMobileLike ? 'task-primary-toolbar-slim-mobile' : ''}`}>
        <label className="field-block task-search-block">
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search tasks" className="field-input search-field-input" />
            {searchQuery ? <button type="button" onClick={onClearSearch} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        <label className="field-block task-view-picker">
          <span className="field-label">Queue</span>
          <select value={view} onChange={(event) => onViewChange(event.target.value as TaskView)} className="field-input">
            {taskViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <div className="task-toolbar-actions">
          <button onClick={onToggleViewOptions} className="action-btn" aria-expanded={viewOptionsOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            Options{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
          </button>
          <button onClick={onOpenCreateTaskModal} className="primary-btn"><Plus className="h-4 w-4" />Add task</button>
        </div>
      </div>

      {viewOptionsOpen ? (
        <details className="task-filters-panel-slim" open>
          <summary className="task-view-options-title">Advanced filters and layout</summary>
          <section className="task-view-options-section">
            <h4 className="task-view-options-title">Scope</h4>
            <div className={`task-view-options-grid ${personalMode ? 'task-view-options-grid-personal' : ''}`}>
              <label className="field-block"><span className="field-label">Project</span><select value={projectFilter} onChange={(event) => onProjectFilterChange(event.target.value)} className="field-input">{projectOptions.map((project) => <option key={project} value={project}>{project === 'All' ? 'All projects' : project}</option>)}</select></label>
              <label className="field-block"><span className="field-label">Assignee</span><select value={assigneeFilter} onChange={(event) => onAssigneeFilterChange(event.target.value)} className="field-input">{assignees.map((assignee) => <option key={assignee} value={assignee}>{assignee === 'All' ? 'All assignees' : assignee}</option>)}</select></label>
              {!personalMode ? <label className="field-block"><span className="field-label">Owner</span><select value={taskOwnerFilter} onChange={(event) => onTaskOwnerFilterChange(event.target.value)} className="field-input">{owners.map((owner) => <option key={owner} value={owner}>{owner === 'All' ? 'All owners' : owner}</option>)}</select></label> : null}
            </div>
          </section>

          <section className="task-view-options-section">
            <h4 className="task-view-options-title">State</h4>
            <div className="task-view-options-grid task-view-options-grid-personal">
              <label className="field-block"><span className="field-label">Status</span><select value={taskStatusFilter} onChange={(event) => onTaskStatusFilterChange(event.target.value as 'All' | 'To do' | 'In progress' | 'Blocked' | 'Done')} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
              <label className="field-block"><span className="field-label">Operational state</span><select value={stateFilter} onChange={(event) => onStateFilterChange(event.target.value as StateFilter)} className="field-input"><option value="all">All</option><option value="deferred_only">Deferred only</option><option value="review_needed_only">Review needed only</option><option value="blocked_without_unblock">Blocked without next step</option></select></label>
            </div>
          </section>

          <section className="task-view-options-section">
            <h4 className="task-view-options-title">Timing</h4>
            <div className="task-view-options-grid task-view-options-grid-personal">
              <label className="field-block"><span className="field-label">Date window</span><select value={timingFilter} onChange={(event) => onTimingFilterChange(event.target.value as TimingFilter)} className="field-input"><option value="all">All timing</option><option value="overdue">Overdue only</option><option value="today">Due today</option><option value="this_week">Due this week</option><option value="no_due_date">No due date</option></select></label>
              <label className="field-block"><span className="field-label">Priority</span><select value={priorityFilter} onChange={(event) => onPriorityFilterChange(event.target.value as PriorityFilter)} className="field-input"><option value="All">All priorities</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select></label>
            </div>
          </section>

          <section className="task-view-options-section">
            <h4 className="task-view-options-title">Linkage</h4>
            <div className="task-view-options-grid task-view-options-grid-personal">
              <label className="field-block"><span className="field-label">Parent linkage</span><select value={linkedFilter} onChange={(event) => onLinkedFilterChange(event.target.value as LinkageFilter)} className="field-input"><option value="all">All</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option><option value="parent_at_risk">Parent at risk</option></select></label>
            </div>
          </section>

          <section className="task-view-options-section">
            <h4 className="task-view-options-title">Sort</h4>
            <div className="task-view-options-grid task-view-options-grid-personal">
              <label className="field-block"><span className="field-label">Order</span><select value={sortBy} onChange={(event) => onSortByChange(event.target.value as TaskSort)} className="field-input"><option value="due">Due date</option><option value="priority">Priority</option><option value="updated">Recently updated</option></select></label>
            </div>
          </section>

          <div className="task-view-options-reset-row">
            <button onClick={onResetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset</button>
          </div>
        </details>
      ) : null}

      {activeFilterChips.length > 0 || sortSummary ? (
        <div className="task-filter-chip-row task-filter-chip-row-muted">
          {activeFilterChips.map((chip) => <button key={chip.key} onClick={chip.clear} className="task-filter-chip task-filter-chip-quiet">{chip.label} <span aria-hidden="true">×</span></button>)}
          {sortSummary ? <span className="task-sort-summary">{sortSummary}</span> : null}
        </div>
      ) : null}
    </div>
  );
});
