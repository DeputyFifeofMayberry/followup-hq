import { useMemo, useState } from 'react';
import { fromDateInputValue, toDateInputValue } from '../lib/utils';
import type { FollowUpItem, TaskItem } from '../types';

interface QuickRecordEditPanelProps {
  record: FollowUpItem | TaskItem;
  type: 'followup' | 'task';
  onSave: (patch: { title?: string; dueDate?: string; owner?: string; project?: string; nextAction?: string; nextStep?: string }) => void;
  onCancel?: () => void;
}

export function QuickRecordEditPanel({ record, type, onSave, onCancel }: QuickRecordEditPanelProps) {
  const [title, setTitle] = useState(record.title);
  const [owner, setOwner] = useState(record.owner);
  const [project, setProject] = useState(record.project);
  const [dueDateInput, setDueDateInput] = useState(toDateInputValue(record.dueDate));
  const [nextMove, setNextMove] = useState(type === 'followup' ? (record as FollowUpItem).nextAction : (record as TaskItem).nextStep);

  const saveDisabled = useMemo(() => !title.trim(), [title]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Quick edit</div>
      <div className="grid gap-2 md:grid-cols-2">
        <label className="field-block"><span className="field-label">Title</span><input value={title} onChange={(event) => setTitle(event.target.value)} className="field-input" /></label>
        <label className="field-block"><span className="field-label">Due date</span><input type="date" value={dueDateInput} onChange={(event) => setDueDateInput(event.target.value)} className="field-input" /></label>
        <label className="field-block"><span className="field-label">Owner / assignee</span><input value={owner} onChange={(event) => setOwner(event.target.value)} className="field-input" /></label>
        <label className="field-block"><span className="field-label">Project</span><input value={project} onChange={(event) => setProject(event.target.value)} className="field-input" /></label>
        <label className="field-block field-block-span-2">
          <span className="field-label">{type === 'followup' ? 'Next action' : 'Next step'}</span>
          <textarea value={nextMove} onChange={(event) => setNextMove(event.target.value)} className="field-textarea" />
        </label>
      </div>
      <div className="mt-3 flex gap-2">
        {onCancel ? <button onClick={onCancel} className="action-btn">Cancel</button> : null}
        <button
          onClick={() => onSave({
            title,
            dueDate: dueDateInput ? fromDateInputValue(dueDateInput) : undefined,
            owner,
            project,
            nextAction: type === 'followup' ? nextMove : undefined,
            nextStep: type === 'task' ? nextMove : undefined,
          })}
          disabled={saveDisabled}
          className="primary-btn disabled:cursor-not-allowed disabled:opacity-50"
        >
          Save quick edit
        </button>
      </div>
    </div>
  );
}
