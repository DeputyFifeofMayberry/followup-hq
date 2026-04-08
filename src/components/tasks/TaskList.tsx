import { memo } from 'react';
import { Badge } from '../Badge';
import { EmptyState } from '../ui/AppPrimitives';
import { priorityTone } from '../../lib/utils';
import type { TaskItem } from '../../types';

type TaskSignal = {
  whyNow: string;
  nextMove: string;
  isOverdue: boolean;
  dueSoon: boolean;
};

type TaskListProps = {
  filteredTasks: TaskItem[];
  selectedTaskId: string | null;
  laneFeedback: { tone: 'success' | 'warn'; message: string } | null;
  onSelectTask: (taskId: string) => void;
  onDoneTask: (task: TaskItem) => void;
  onToggleBlockTask: (task: TaskItem) => void;
  getParentLinkedFollowUpId: (linkedFollowUpId?: string | null) => boolean;
  renderNowSignal: (task: TaskItem) => TaskSignal;
};

export const TaskList = memo(function TaskList({
  filteredTasks,
  selectedTaskId,
  laneFeedback,
  onSelectTask,
  onDoneTask,
  onToggleBlockTask,
  getParentLinkedFollowUpId,
  renderNowSignal,
}: TaskListProps) {
  return (
    <div className="workspace-list-content task-list-content">
      {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}
      {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try another view or open Options to adjust filters." /> : filteredTasks.map((task) => {
        const hasParent = getParentLinkedFollowUpId(task.linkedFollowUpId);
        const signal = renderNowSignal(task);
        const isSelected = selectedTaskId === task.id;
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
                <div className="scan-row-secondary">{signal.whyNow} • Next: {signal.nextMove}</div>
                <div className="scan-row-meta">{(task.assigneeDisplayName || task.owner)} • {task.project}{task.summary ? ` • ${task.summary}` : ''}</div>
              </div>
              <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                <div className="scan-row-badge-cluster">
                  {task.status === 'Blocked' ? <Badge variant="warn">Blocked</Badge> : null}
                  {signal.isOverdue ? <Badge variant="danger">Overdue</Badge> : signal.dueSoon ? <Badge variant="neutral">Due soon</Badge> : null}
                  <Badge variant={priorityTone(task.priority)}>{task.priority}</Badge>
                  {!hasParent ? <Badge variant="neutral">Unlinked</Badge> : null}
                </div>
                <div className="scan-row-action-cluster">
                  {task.status !== 'Done' ? <button onClick={() => onDoneTask(task)} className="action-btn !px-2.5 !py-1 text-xs">Done</button> : null}
                  <button onClick={() => onToggleBlockTask(task)} className="action-btn !px-2.5 !py-1 text-xs">{task.status === 'Blocked' ? 'Unblock' : 'Block'}</button>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
});
