import { ChevronDown, Search, SlidersHorizontal, Undo2, X } from 'lucide-react';
import { memo } from 'react';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, ExecutionFilterChip, ExecutionToolbarSurface } from '../ui/AppPrimitives';
import type {
  TaskLinkageFilter as LinkageFilter,
  TaskPriorityFilter as PriorityFilter,
  TaskSort,
  TaskStateFilter as StateFilter,
  TaskTimingFilter as TimingFilter,
  TaskQueueView,
} from '../../domains/tasks';
import type { TaskStatus } from '../../types';

type TaskToolbarProps = {
  isMobileLike: boolean;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  onClearSearch: () => void;
  view: TaskQueueView;
  onViewChange: (value: TaskQueueView) => void;
  taskViewOptions: Array<{ value: TaskQueueView; label: string }>;
  viewOptionsOpen: boolean;
  onToggleViewOptions: () => void;
  activeFilterCount: number;
  activeFilterChips: Array<{ key: string; label: string; clear: () => void }>;
  sortSummary: string;
  onResetFilters: () => void;
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
  taskStatusFilter: 'All' | TaskStatus;
  onTaskStatusFilterChange: (value: 'All' | TaskStatus) => void;
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
};

function TaskFilterContent({
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
}: Omit<TaskToolbarProps, 'isMobileLike' | 'searchQuery' | 'onSearchQueryChange' | 'onClearSearch' | 'view' | 'onViewChange' | 'taskViewOptions' | 'viewOptionsOpen' | 'onToggleViewOptions' | 'activeFilterCount' | 'activeFilterChips' | 'sortSummary'>) {
  return (
    <>
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
          <label className="field-block"><span className="field-label">Status</span><select value={taskStatusFilter} onChange={(event) => onTaskStatusFilterChange(event.target.value as 'All' | TaskStatus)} className="field-input">{['All', 'To do', 'In progress', 'Blocked', 'Done'].map((status) => <option key={status} value={status}>{status === 'All' ? 'All statuses' : status}</option>)}</select></label>
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
        <h4 className="task-view-options-title">Linkage and sort</h4>
        <div className="task-view-options-grid task-view-options-grid-personal">
          <label className="field-block"><span className="field-label">Parent linkage</span><select value={linkedFilter} onChange={(event) => onLinkedFilterChange(event.target.value as LinkageFilter)} className="field-input"><option value="all">All</option><option value="linked">Linked only</option><option value="unlinked">Unlinked only</option><option value="parent_at_risk">Parent at risk</option></select></label>
          <label className="field-block"><span className="field-label">Order</span><select value={sortBy} onChange={(event) => onSortByChange(event.target.value as TaskSort)} className="field-input"><option value="due">Due date</option><option value="priority">Priority</option><option value="updated">Recently updated</option></select></label>
        </div>
      </section>

      <div className="task-view-options-reset-row">
        <button onClick={onResetFilters} className="action-btn !px-2.5 !py-1 text-xs"><Undo2 className="h-3.5 w-3.5" />Reset</button>
      </div>
    </>
  );
}

export const TaskToolbar = memo(function TaskToolbar(props: TaskToolbarProps) {
  const {
    isMobileLike,
    searchQuery,
    onSearchQueryChange,
    onClearSearch,
    view,
    onViewChange,
    taskViewOptions,
    viewOptionsOpen,
    onToggleViewOptions,
    activeFilterCount,
    activeFilterChips,
    sortSummary,
    onResetFilters,
    ...filterProps
  } = props;

  if (isMobileLike) {
    const visibleQueueViews = taskViewOptions.filter((option) => ['today', 'overdue', 'upcoming', 'all'].includes(option.value));
    const activeFilterPreview = activeFilterChips.slice(0, 2);

    return (
      <ExecutionToolbarSurface className="task-control-stack-calm task-mobile-control-stack">
        <div className="task-mobile-view-rail" aria-label="Task queue view">
          {visibleQueueViews.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`task-mobile-view-chip ${view === option.value ? 'task-mobile-view-chip-active' : ''}`.trim()}
              onClick={() => onViewChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="task-mobile-search-row">
          <label className="field-block task-search-block">
            <div className="search-field-wrap">
              <Search className="search-field-icon h-4 w-4" />
              <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search tasks" className="field-input search-field-input" />
              {searchQuery ? <button type="button" onClick={onClearSearch} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
            </div>
          </label>
          <button onClick={onToggleViewOptions} className="action-btn task-mobile-filter-btn" aria-expanded={viewOptionsOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </button>
        </div>

        <div className="task-mobile-filter-summary" aria-live="polite">
          {activeFilterCount > 0 ? (
            <>
              <div className="task-mobile-filter-summary-label">Active</div>
              <div className="task-mobile-filter-summary-values">
                {activeFilterPreview.map((chip) => <span key={chip.key}>{chip.label}</span>)}
                {activeFilterChips.length > 2 ? <span>+{activeFilterChips.length - 2} more</span> : null}
              </div>
              <button type="button" className="task-mobile-filter-summary-clear" onClick={onResetFilters}>Reset</button>
            </>
          ) : (
            <div className="task-sort-summary">No active filters. {sortSummary || 'Sorted by due date.'}</div>
          )}
        </div>

        {viewOptionsOpen ? (
          <AppModal size="standard" onClose={onToggleViewOptions} onBackdropClick={onToggleViewOptions} ariaLabel="Task filters">
            <AppModalHeader title="Task filters" subtitle="Apply filters, then jump straight back to your queue." onClose={onToggleViewOptions} />
            <AppModalBody>
              {activeFilterChips.length > 0 ? (
                <div className="task-mobile-active-filter-chips">
                  {activeFilterChips.map((chip) => <ExecutionFilterChip key={chip.key} label={chip.label} onClear={chip.clear} />)}
                  <button type="button" className="execution-filter-chip execution-filter-chip-quiet" onClick={onResetFilters}>Clear all filters</button>
                </div>
              ) : null}
              <div className="task-filters-panel-slim task-filters-panel-mobile">
                <TaskFilterContent {...filterProps} onResetFilters={onResetFilters} />
              </div>
            </AppModalBody>
            <AppModalFooter>
              <button type="button" className="action-btn" onClick={onToggleViewOptions}>Back to queue</button>
            </AppModalFooter>
          </AppModal>
        ) : null}
      </ExecutionToolbarSurface>
    );
  }

  return (
    <ExecutionToolbarSurface className="task-control-stack-calm">
      <div className="task-primary-toolbar-slim">
        <label className="field-block task-search-block">
          <div className="search-field-wrap">
            <Search className="search-field-icon h-4 w-4" />
            <input value={searchQuery} onChange={(event) => onSearchQueryChange(event.target.value)} placeholder="Search tasks" className="field-input search-field-input" />
            {searchQuery ? <button type="button" onClick={onClearSearch} className="search-clear-btn" aria-label="Clear search"><X className="h-4 w-4" /></button> : null}
          </div>
        </label>

        <label className="field-block task-view-picker">
          <select value={view} onChange={(event) => onViewChange(event.target.value as TaskQueueView)} className="field-input">
            {taskViewOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <div className="task-toolbar-actions">
          <button onClick={onToggleViewOptions} className="action-btn" aria-expanded={viewOptionsOpen}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
            <ChevronDown className={`h-4 w-4 ${viewOptionsOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {viewOptionsOpen ? (
        <div className="task-filters-panel-slim">
          <div className="task-view-options-title">More filters</div>
          <TaskFilterContent {...filterProps} onResetFilters={onResetFilters} />
        </div>
      ) : null}
    </ExecutionToolbarSurface>
  );
});
