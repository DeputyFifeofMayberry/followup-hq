import { formatDate, todayIso } from '../../lib/utils';
import type { ProjectStatus } from '../../types';
import { PROJECT_STATUS_OPTIONS, splitLocationValue, toDelimitedArray, type ProjectWorkspaceMode } from '../../domains/directory/hooks/useDirectoryViewModel';
import { ProjectRelationshipLinks } from './ProjectRelationshipLinks';
import { RecordSaveStatus } from '../save/RecordSaveStatus';

interface ProjectProfilePanelProps {
  selectedRow: any;
  editing: boolean;
  draft: any;
  detailTab: 'profile' | 'operational';
  workspaceMode: ProjectWorkspaceMode;
  saveErrors: string[];
  onSetEditing: (value: boolean) => void;
  onDraftChange: (value: any) => void;
  onSaveDraft: () => void;
  onSetDetailTab: (value: 'profile' | 'operational') => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onOpenFollowUp: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function ProjectProfilePanel({ selectedRow, editing, draft, detailTab, workspaceMode, saveErrors, onSetEditing, onDraftChange, onSaveDraft, onSetDetailTab, onArchiveToggle, onDelete, onOpenFollowUp, onOpenTask, onOpenDirectoryRecord }: ProjectProfilePanelProps) {
  if (!selectedRow) return null;

  const followUpPrimary = selectedRow.openFollowUps[0];
  const taskPrimary = selectedRow.openTasks[0];

  return (
    <>
      <div className="mb-3 space-y-3 border-b border-slate-200 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-lg font-semibold text-slate-950">{selectedRow.project.name}</div>
            <div className="text-xs text-slate-600">{selectedRow.project.code || 'No code'} • {selectedRow.project.status} • {selectedRow.project.owner || 'Unassigned owner'}</div>
            <div className="mt-1">
              <RecordSaveStatus record={{ type: 'project', id: selectedRow.project.id }} editing={editing} />
            </div>
          </div>
        </div>

        {workspaceMode === 'directory' ? (
          <div className="flex flex-wrap gap-2">
            <button className="action-btn" onClick={() => onSetEditing(!editing)}>{editing ? 'View mode' : 'Edit project'}</button>
            {editing ? <><button className="action-btn" onClick={() => onSetEditing(false)}>Cancel</button><button className="primary-btn" onClick={onSaveDraft}>Save project</button></> : null}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="primary-btn" disabled={!followUpPrimary} onClick={() => followUpPrimary && onOpenFollowUp(followUpPrimary.id)}>Open project follow-ups</button>
            <button className="primary-btn" disabled={!taskPrimary} onClick={() => taskPrimary && onOpenTask(taskPrimary.id)}>Open project tasks</button>
            <button className="action-btn" onClick={() => onSetEditing(!editing)}>{editing ? 'View mode' : 'Edit project'}</button>
            {editing ? <button className="primary-btn" onClick={onSaveDraft}>Save project</button> : null}
          </div>
        )}

        <div className="flex gap-2">
          <button className={detailTab === 'profile' ? 'primary-btn' : 'action-btn'} onClick={() => onSetDetailTab('profile')}>Project profile</button>
          <button className={detailTab === 'operational' ? 'primary-btn' : 'action-btn'} onClick={() => onSetDetailTab('operational')}>Operational context</button>
        </div>
      </div>

      {detailTab === 'profile' ? (
        <div className="space-y-2 text-sm">
          {editing && draft ? (
            <>
              <div className="rounded-xl border border-slate-200 p-3"><div className="mb-2 font-semibold">Identity</div><div className="grid gap-2 md:grid-cols-2"><label className="field-block"><span className="field-label">Project name *</span><input className="field-input" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label><label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={(draft.aliases ?? []).join(', ')} onChange={(event) => onDraftChange({ ...draft, aliases: toDelimitedArray(event.target.value) })} /></label><label className="field-block"><span className="field-label">Project code</span><input className="field-input" value={draft.code ?? ''} onChange={(event) => onDraftChange({ ...draft, code: event.target.value })} /></label><label className="field-block"><span className="field-label">Status</span><select className="field-input" value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value as ProjectStatus })}>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select></label></div></div>
              <details className="rounded-xl border border-slate-200 p-3" open><summary className="cursor-pointer font-semibold">Operational + metadata</summary><div className="mt-2 grid gap-2 md:grid-cols-2"><label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={draft.owner} onChange={(event) => onDraftChange({ ...draft, owner: event.target.value })} /></label><label className="field-block"><span className="field-label">Phase</span><input className="field-input" value={draft.phase ?? ''} onChange={(event) => onDraftChange({ ...draft, phase: event.target.value })} /></label><label className="field-block"><span className="field-label">Target completion</span><input type="date" className="field-input" value={(draft.targetCompletionDate || '').slice(0, 10)} onChange={(event) => onDraftChange({ ...draft, targetCompletionDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' })} /></label><label className="field-block"><span className="field-label">Location / facility / building</span><input className="field-input" value={[draft.location, draft.facility, draft.building].filter(Boolean).join(' / ')} onChange={(event) => onDraftChange({ ...draft, ...splitLocationValue(event.target.value) })} /></label><label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[84px]" value={draft.notes ?? ''} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} /></label><label className="field-block md:col-span-2"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={(draft.tags ?? []).join(', ')} onChange={(event) => onDraftChange({ ...draft, tags: toDelimitedArray(event.target.value) })} /></label></div></details>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Project profile</div><div className="mt-1 text-xs text-slate-600">{selectedRow.project.code || 'No project code'} • {selectedRow.project.phase || 'No phase set'} • Target {formatDate(selectedRow.project.targetCompletionDate) || 'not set'}</div></div>
              <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Location</div><div className="mt-1 text-xs text-slate-600">{[selectedRow.project.location, selectedRow.project.facility, selectedRow.project.building].filter(Boolean).join(' • ') || '—'}</div></div>
              <div className="rounded-xl border border-slate-200 p-3"><div className="font-semibold">Operational notes</div><div className="mt-1 text-xs text-slate-600">{selectedRow.project.notes || 'No notes yet.'}</div></div>
              <div className="rounded-xl border border-slate-200 p-3"><div className="mb-1 font-semibold">Linked records</div><ProjectRelationshipLinks project={selectedRow.project} onOpenDirectoryRecord={onOpenDirectoryRecord} /></div>
            </>
          )}
          {saveErrors.length > 0 ? <div className="rounded-xl border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">{saveErrors.map((error) => <div key={error}>• {error}</div>)}</div> : null}
          <details className="task-maintenance-disclosure">
            <summary>Maintenance actions</summary>
            <div className="task-maintenance-body">
              <button className="action-btn" onClick={onArchiveToggle}>{selectedRow.project.archived ? 'Unarchive project' : 'Archive project'}</button>
              <button className="action-btn action-btn-danger" onClick={onDelete}>Delete project</button>
            </div>
          </details>
        </div>
      ) : (
        <div className="space-y-2 text-sm">
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="font-semibold">Operational pressure snapshot</div>
            <div className="mt-1 text-xs text-slate-600">Health {selectedRow.health.tier} ({selectedRow.health.score}) • Updated {formatDate(selectedRow.updatedAt)}</div>
            <div className="mt-1 text-xs text-slate-600">Current blocker: {selectedRow.project.currentBlocker || 'None documented'}</div>
            <div className="mt-1 text-xs text-slate-600">Closeout readiness: {selectedRow.project.closeoutReadiness ?? 0}%</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pressure signals</div>
            <div className="mt-2 space-y-1">{selectedRow.health.reasons.length ? selectedRow.health.reasons.map((reason: string) => <div key={reason} className="text-xs text-slate-700">• {reason}</div>) : <div className="text-xs text-slate-600">No major pressure signals.</div>}</div>
            <div className="mt-2 text-xs text-slate-600">Reviewed {formatDate(selectedRow.project.lastReviewedAt || todayIso())}</div>
          </div>
          <div className="rounded-xl border border-slate-200 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Route into execution</div>
            <div className="mt-2 flex flex-wrap gap-2"><button className="primary-btn" disabled={!followUpPrimary} onClick={() => followUpPrimary && onOpenFollowUp(followUpPrimary.id)}>Open project follow-ups</button><button className="primary-btn" disabled={!taskPrimary} onClick={() => taskPrimary && onOpenTask(taskPrimary.id)}>Open project tasks</button></div>
            <div className="mt-2 text-xs text-slate-700">Next action: {selectedRow.project.projectNextAction || 'Not set'}</div>
          </div>
        </div>
      )}
    </>
  );
}
