import { ArrowRightCircle, CalendarClock } from 'lucide-react';
import { Badge } from '../Badge';
import { EmptyState } from '../ui/AppPrimitives';
import { formatDate } from '../../lib/utils';
import type { TaskItem } from '../../types';

type TaskSignal = {
  whyNow: string;
  nextMove: string;
  isOverdue: boolean;
  dueSoon: boolean;
  needsReview?: boolean;
};

type TaskListProps = {
  isMobileLike?: boolean;
  filteredTasks: TaskItem[];
  completedToday: TaskItem[];
  view: 'today' | 'overdue' | 'upcoming' | 'blocked' | 'review' | 'deferred' | 'unlinked' | 'recent' | 'all';
  selectedTaskId: string | null;
  laneFeedback: { tone: 'success' | 'warn'; message: string } | null;
  onSelectTask: (taskId: string) => void;
  onDoneTask: (task: TaskItem) => void;
  onSetDueToday: (task: TaskItem) => void;
  onSetDueTomorrow: (task: TaskItem) => void;
  onOpenLinkedFollowUp: (task: TaskItem) => void;
  onRequestDeleteTask: (task: TaskItem) => void;
  getParentLinkedFollowUpId: (linkedFollowUpId?: string | null) => boolean;
  renderNowSignal: (task: TaskItem) => TaskSignal;
  hasActiveNarrowing?: boolean;
  activeFilterLabels?: string[];
  onResetFilters?: () => void;
};

function summarizeMeta(task: TaskItem) {
  if (!task.summary) return '';
  const clean = task.summary.trim();
  if (!clean) return '';
  return clean.length > 78 ? `${clean.slice(0, 75)}…` : clean;
}

export function TaskList({
  isMobileLike = false,
  filteredTasks,
  completedToday,
  view,
  selectedTaskId,
  laneFeedback,
  onSelectTask,
  onDoneTask,
  onSetDueToday,
  onSetDueTomorrow,
  onOpenLinkedFollowUp,
  onRequestDeleteTask,
  getParentLinkedFollowUpId,
  renderNowSignal,
  hasActiveNarrowing = false,
  activeFilterLabels = [],
  onResetFilters,
}: TaskListProps) {
  return (
    <div className="workspace-list-content task-list-content">
      {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}

      {filteredTasks.length === 0 ? (
        <div className="tracker-empty-state-wrap">
          <EmptyState
            title={hasActiveNarrowing ? 'No tasks match the current filters' : 'No tasks in this queue'}
            message={hasActiveNarrowing ? `No tasks match: ${activeFilterLabels.join(' • ')}.` : 'Switch queue views or adjust filters to expose work.'}
          />
          {hasActiveNarrowing ? <button type="button" className="primary-btn" onClick={onResetFilters}>Reset filters</button> : null}
        </div>
      ) : filteredTasks.map((task) => {
        const hasParent = getParentLinkedFollowUpId(task.linkedFollowUpId);
        const signal = renderNowSignal(task);
        const isSelected = selectedTaskId === task.id;
        const metaSummary = summarizeMeta(task);
        const dueLabel = task.deferredUntil ? `Deferred until ${formatDate(task.deferredUntil)}` : task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date';
        const linkedLabel = hasParent ? 'Linked follow-up' : 'Unlinked';
        const urgentLabel = signal.isOverdue ? 'Overdue' : task.status === 'Blocked' ? 'Blocked' : signal.needsReview ? 'Review' : null;

        if (isMobileLike) {
          return (
            <article key={task.id} className={`tracker-mobile-card task-mobile-queue-card ${isSelected ? 'tracker-mobile-card-active' : ''}`}>
              <button type="button" className="tracker-mobile-main" onClick={() => onSelectTask(task.id)}>
                <div className="tracker-mobile-title-row">
                  <h3>{task.title}</h3>
                  <div className="tracker-mobile-badges">
                    {urgentLabel ? <Badge variant={signal.isOverdue ? 'danger' : 'warn'}>{urgentLabel}</Badge> : null}
                    <Badge kind="meta" variant="neutral">{task.priority}</Badge>
                  </div>
                </div>
                <p className="tracker-mobile-mainline">{signal.whyNow}</p>
                <p className="tracker-mobile-next-move"><strong>Next:</strong> {signal.nextMove}</p>
                <div className="scan-row-badge-cluster task-row-meta-chips">
                  <Badge kind="meta" variant="neutral">{task.project}</Badge>
                  <Badge kind="meta" variant="neutral">{dueLabel}</Badge>
                  <Badge kind="meta" variant="neutral">{linkedLabel}</Badge>
                </div>
                {metaSummary ? <p className="tracker-mobile-support">{metaSummary}</p> : null}
              </button>
              <div className="tracker-mobile-actions-row">
                {task.status !== 'Done' ? <button onClick={() => onDoneTask(task)} className="primary-btn tracker-mobile-primary-action">Complete</button> : <span className="tracker-mobile-support">Completed</span>}
                <details className="tracker-mobile-more-actions task-mobile-more-actions">
                  <summary><span className="action-btn tracker-mobile-more-trigger">More</span></summary>
                  <div className="tracker-mobile-more-menu">
                    <button onClick={() => onSetDueToday(task)} className="tracker-mobile-more-menu-item">Today</button>
                    <button onClick={() => onSetDueTomorrow(task)} className="tracker-mobile-more-menu-item"><CalendarClock className="h-3.5 w-3.5" />Tomorrow</button>
                    {task.linkedFollowUpId ? <button onClick={() => onOpenLinkedFollowUp(task)} className="tracker-mobile-more-menu-item"><ArrowRightCircle className="h-3.5 w-3.5" />Linked</button> : null}
                    <button onClick={() => onRequestDeleteTask(task)} className="tracker-mobile-more-menu-item tracker-mobile-more-menu-item-danger">Delete</button>
                  </div>
                </details>
              </div>
            </article>
          );
        }

        return (
          <button
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            className={`workspace-data-row task-work-row ${isSelected ? 'workspace-data-row-active list-row-family-active' : ''}`}
            aria-current={isSelected ? 'true' : undefined}
          >
            <div className="scan-row-layout scan-row-layout-quiet">
              <div className="scan-row-content">
                <div className="scan-row-primary">{task.title}</div>
                <div className="task-row-why-now">{signal.whyNow}</div>
                <div className="task-row-next-move">Next move: {signal.nextMove}</div>
                <div className="scan-row-badge-cluster task-row-meta-chips">
                  <Badge kind="meta" variant="neutral">{task.project}</Badge>
                  <Badge kind="meta" variant="neutral">{linkedLabel}</Badge>
                  {task.assigneeDisplayName ? <Badge kind="meta" variant="neutral">{task.assigneeDisplayName}</Badge> : null}
                  <Badge kind="meta" variant="neutral">{dueLabel}</Badge>
                </div>
                {metaSummary ? <div className="scan-row-meta">{metaSummary}</div> : null}
              </div>
              <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                <div className="scan-row-badge-cluster">
                  {urgentLabel ? <Badge variant={signal.isOverdue ? 'danger' : 'warn'}>{urgentLabel}</Badge> : null}
                </div>
                <div className="scan-row-action-cluster">
                  {task.status !== 'Done' ? <button onClick={() => onDoneTask(task)} className="action-btn !px-2.5 !py-1 text-xs">Done</button> : null}
                </div>
                <details className="task-row-more-actions">
                  <summary>More</summary>
                  <div className="scan-row-action-cluster">
                    <button onClick={() => onSetDueToday(task)} className="action-btn !px-2.5 !py-1 text-xs" aria-label="Set due today">Today</button>
                    <button onClick={() => onSetDueTomorrow(task)} className="action-btn !px-2.5 !py-1 text-xs"><CalendarClock className="h-3.5 w-3.5" />Tomorrow</button>
                    {task.linkedFollowUpId ? <button onClick={() => onOpenLinkedFollowUp(task)} className="action-btn !px-2.5 !py-1 text-xs"><ArrowRightCircle className="h-3.5 w-3.5" />Linked</button> : null}
                    <button onClick={() => onRequestDeleteTask(task)} className="action-btn action-btn-danger !px-2.5 !py-1 text-xs">Delete</button>
                  </div>
                </details>
              </div>
            </div>
          </button>
        );
      })}

      {view !== 'recent' && completedToday.length > 0 ? (
        <section className="task-completed-today-section" aria-label="Completed today">
          <div className="task-completed-today-header">Momentum today · {completedToday.length} done</div>
          {completedToday.slice(0, 3).map((task) => (
            <div key={task.id} className="task-completed-today-row">
              <span className="task-completed-today-title">{task.title}</span>
              <span className="task-completed-today-meta">{task.project}</span>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
