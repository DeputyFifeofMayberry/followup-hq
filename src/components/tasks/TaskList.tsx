import { useRef, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { Badge } from '../Badge';
import { EmptyState } from '../ui/AppPrimitives';
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
  completedToday: TaskItem[];
  onSelectTask: (taskId: string) => void;
  onDoneTask: (task: TaskItem) => void;
  onToggleBlockTask: (task: TaskItem) => void;
  onQuickAdd: (title: string) => void;
  getParentLinkedFollowUpId: (linkedFollowUpId?: string | null) => boolean;
  renderNowSignal: (task: TaskItem) => TaskSignal;
};

function summarizeMeta(task: TaskItem) {
  if (!task.summary) return '';
  const clean = task.summary.trim();
  if (!clean) return '';
  return clean.length > 78 ? `${clean.slice(0, 75)}…` : clean;
}

export function TaskList({
  filteredTasks,
  selectedTaskId,
  laneFeedback,
  completedToday,
  onSelectTask,
  onDoneTask,
  onToggleBlockTask,
  onQuickAdd,
  getParentLinkedFollowUpId,
  renderNowSignal,
}: TaskListProps) {
  // Fix 2: Inline quick-add state
  const [quickAddDraft, setQuickAddDraft] = useState('');
  const [quickAddActive, setQuickAddActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const commitQuickAdd = () => {
    const title = quickAddDraft.trim();
    if (title) {
      onQuickAdd(title);
      setQuickAddDraft('');
    }
    setQuickAddActive(false);
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commitQuickAdd(); }
    if (e.key === 'Escape') { setQuickAddDraft(''); setQuickAddActive(false); }
  };

  return (
    <div className="workspace-list-content task-list-content">
      {/* Fix 2: Inline quick-add row */}
      <div className="task-quick-add-row">
        {quickAddActive ? (
          <div className="task-quick-add-input-row">
            <input
              ref={inputRef}
              autoFocus
              value={quickAddDraft}
              onChange={(e) => setQuickAddDraft(e.target.value)}
              onKeyDown={handleQuickAddKeyDown}
              onBlur={commitQuickAdd}
              placeholder="Task title — press Enter to add, Esc to cancel"
              className="field-input task-quick-add-input"
            />
          </div>
        ) : (
          <button
            onClick={() => { setQuickAddActive(true); setTimeout(() => inputRef.current?.focus(), 0); }}
            className="task-quick-add-trigger"
          >
            <Plus className="h-3.5 w-3.5" />
            Quick add task
          </button>
        )}
      </div>

      {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}

      {filteredTasks.length === 0 ? <EmptyState title="No tasks in this view" message="Try another view or open Options to adjust filters." /> : filteredTasks.map((task) => {
        const hasParent = getParentLinkedFollowUpId(task.linkedFollowUpId);
        const signal = renderNowSignal(task);
        const isSelected = selectedTaskId === task.id;
        const metaSummary = summarizeMeta(task);
        const showCritical = task.priority === 'Critical' && !signal.isOverdue && task.status !== 'Blocked';

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
                <div className="scan-row-meta">{(task.assigneeDisplayName || task.owner)} • {task.project}{metaSummary ? ` • ${metaSummary}` : ''}</div>
              </div>
              <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                <div className="scan-row-badge-cluster">
                  {task.status === 'Blocked' ? <Badge variant="warn">Blocked</Badge> : null}
                  {signal.isOverdue ? <Badge variant="danger">Overdue</Badge> : signal.dueSoon ? <Badge variant="neutral">Due soon</Badge> : null}
                  {showCritical ? <Badge variant="danger">Critical</Badge> : null}
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

      {/* Fix 5: Completed-today footer — visible only when view='today' (completedToday is empty otherwise) */}
      {completedToday.length > 0 ? (
        <div className="task-completed-today-section">
          <div className="task-completed-today-header">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span>Done today ({completedToday.length})</span>
          </div>
          {completedToday.map((task) => (
            <div key={task.id} className="task-completed-today-row">
              <span className="task-completed-today-title">{task.title}</span>
              <span className="task-completed-today-meta">{task.project}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
