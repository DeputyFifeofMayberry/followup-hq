import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightCircle, CalendarClock, Plus } from 'lucide-react';
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

type QuickCapturePayload = {
  title: string;
  project: string;
  owner: string;
  assignee?: string;
  nextStep: string;
};

type TaskListProps = {
  filteredTasks: TaskItem[];
  selectedTaskId: string | null;
  laneFeedback: { tone: 'success' | 'warn'; message: string } | null;
  projectOptions: string[];
  ownerOptions: string[];
  assigneeOptions: string[];
  quickCaptureDefaults: { project: string; owner: string; assignee: string; nextStep: string };
  onSelectTask: (taskId: string) => void;
  onDoneTask: (task: TaskItem) => void;
  onSetDueToday: (task: TaskItem) => void;
  onSetDueTomorrow: (task: TaskItem) => void;
  onOpenLinkedFollowUp: (task: TaskItem) => void;
  onQuickAdd: (payload: QuickCapturePayload) => { ok: boolean; message?: string };
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
  projectOptions,
  ownerOptions,
  assigneeOptions,
  quickCaptureDefaults,
  onSelectTask,
  onDoneTask,
  onSetDueToday,
  onSetDueTomorrow,
  onOpenLinkedFollowUp,
  onQuickAdd,
  getParentLinkedFollowUpId,
  renderNowSignal,
}: TaskListProps) {
  const [quickAddActive, setQuickAddActive] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [quickAddDraft, setQuickAddDraft] = useState<QuickCapturePayload>({ title: '', project: '', owner: '', assignee: '', nextStep: '' });
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!quickAddActive) return;
    setQuickAddDraft({
      title: '',
      project: quickCaptureDefaults.project,
      owner: quickCaptureDefaults.owner,
      assignee: quickCaptureDefaults.assignee,
      nextStep: quickCaptureDefaults.nextStep,
    });
    setQuickAddError(null);
  }, [quickAddActive, quickCaptureDefaults]);

  const canSubmitQuickAdd = useMemo(() => Boolean(
    quickAddDraft.title.trim()
    && quickAddDraft.project.trim()
    && quickAddDraft.owner.trim()
    && quickAddDraft.nextStep.trim(),
  ), [quickAddDraft]);

  const closeQuickCapture = () => {
    setQuickAddActive(false);
    setQuickAddError(null);
    setQuickAddDraft({ title: '', project: '', owner: '', assignee: '', nextStep: '' });
  };

  const commitQuickAdd = () => {
    const result = onQuickAdd({
      title: quickAddDraft.title.trim(),
      project: quickAddDraft.project.trim(),
      owner: quickAddDraft.owner.trim(),
      assignee: quickAddDraft.assignee?.trim() || undefined,
      nextStep: quickAddDraft.nextStep.trim(),
    });
    if (!result.ok) {
      setQuickAddError(result.message || 'Complete required fields before creating a task.');
      return;
    }
    closeQuickCapture();
  };

  const handleQuickAddKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      commitQuickAdd();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeQuickCapture();
    }
  };

  return (
    <div className="workspace-list-content task-list-content">
      <div className="task-quick-add-row">
        {quickAddActive ? (
          <div className="task-quick-capture-panel" onKeyDown={handleQuickAddKeyDown}>
            <div className="task-quick-capture-grid">
              <label className="field-block"><span className="field-label">Title</span><input ref={titleRef} autoFocus value={quickAddDraft.title} onChange={(e) => setQuickAddDraft((prev) => ({ ...prev, title: e.target.value }))} className="field-input" placeholder="What needs to happen?" /></label>
              <label className="field-block"><span className="field-label">Project</span><select value={quickAddDraft.project} onChange={(e) => setQuickAddDraft((prev) => ({ ...prev, project: e.target.value }))} className="field-input"><option value="">Select project</option>{projectOptions.filter((p) => p !== 'All').map((p) => <option key={p} value={p}>{p}</option>)}</select></label>
              <label className="field-block"><span className="field-label">Owner</span><select value={quickAddDraft.owner} onChange={(e) => setQuickAddDraft((prev) => ({ ...prev, owner: e.target.value }))} className="field-input"><option value="">Select owner</option>{ownerOptions.filter((o) => o !== 'All').map((o) => <option key={o} value={o}>{o}</option>)}</select></label>
              <label className="field-block"><span className="field-label">Assignee</span><select value={quickAddDraft.assignee || ''} onChange={(e) => setQuickAddDraft((prev) => ({ ...prev, assignee: e.target.value }))} className="field-input"><option value="">Same as owner</option>{assigneeOptions.filter((a) => a !== 'All').map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
              <label className="field-block task-quick-capture-next-step"><span className="field-label">Next step</span><input value={quickAddDraft.nextStep} onChange={(e) => setQuickAddDraft((prev) => ({ ...prev, nextStep: e.target.value }))} className="field-input" placeholder="First executable move" /></label>
            </div>
            {quickAddError ? <div className="task-quick-capture-error">{quickAddError}</div> : null}
            <div className="task-quick-capture-actions">
              <button onClick={closeQuickCapture} className="action-btn !px-2.5 !py-1 text-xs">Cancel (Esc)</button>
              <button onClick={commitQuickAdd} className="primary-btn !px-2.5 !py-1 text-xs" disabled={!canSubmitQuickAdd}>Create task (Enter)</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setQuickAddActive(true); setTimeout(() => titleRef.current?.focus(), 0); }}
            className="task-quick-add-trigger"
          >
            <Plus className="h-3.5 w-3.5" />
            Fast capture task
          </button>
        )}
      </div>

      {laneFeedback ? <div className={`task-lane-feedback ${laneFeedback.tone === 'warn' ? 'task-lane-feedback-warn' : 'task-lane-feedback-success'}`}>{laneFeedback.message}</div> : null}

      {filteredTasks.length === 0 ? <EmptyState title="No tasks in this queue" message="Switch queue views or adjust Options to expose work." /> : filteredTasks.map((task) => {
        const hasParent = getParentLinkedFollowUpId(task.linkedFollowUpId);
        const signal = renderNowSignal(task);
        const isSelected = selectedTaskId === task.id;
        const metaSummary = summarizeMeta(task);
        const dueLabel = task.deferredUntil ? `Deferred until ${formatDate(task.deferredUntil)}` : task.dueDate ? `Due ${formatDate(task.dueDate)}` : 'No due date';
        const linkedLabel = hasParent ? 'Linked to follow-up' : 'Unlinked task';

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
                <div className="scan-row-meta">{dueLabel} • {task.project} • Owner {task.owner}{task.assigneeDisplayName ? ` • Assignee ${task.assigneeDisplayName}` : ''} • {linkedLabel}{metaSummary ? ` • ${metaSummary}` : ''}</div>
              </div>
              <div className="scan-row-sidecar scan-row-sidecar-quiet" onClick={(event) => event.stopPropagation()}>
                <div className="scan-row-badge-cluster">
                  {signal.isOverdue ? <Badge variant="danger">Overdue</Badge> : task.status === 'Blocked' ? <Badge variant="warn">Blocked</Badge> : signal.needsReview ? <Badge variant="warn">Review</Badge> : null}
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
                  </div>
                </details>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
