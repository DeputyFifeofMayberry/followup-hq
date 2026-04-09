import type { ProjectRecord } from '../../types';
import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface ProjectDeleteModalProps {
  open: boolean;
  project: ProjectRecord | null;
  projects: ProjectRecord[];
  followUpCount: number;
  taskCount: number;
  docCount: number;
  deleteTargetId: string;
  deleteConfirm: boolean;
  onDeleteTargetChange: (value: string) => void;
  onDeleteConfirmChange: (value: boolean) => void;
  onClose: () => void;
  onDelete: () => void;
}

export function ProjectDeleteModal({ open, project, projects, followUpCount, taskCount, docCount, deleteTargetId, deleteConfirm, onDeleteTargetChange, onDeleteConfirmChange, onClose, onDelete }: ProjectDeleteModalProps) {
  if (!open || !project) return null;
  const isSystemProject = project.systemProjectKind === 'unclassified';
  return (
    <AppModal size="md" onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="Delete project" subtitle="Archive is recommended unless this was created in error." onClose={onClose} />
      <AppModalBody>
        <div className="space-y-2 text-sm">
          <div>Impacted follow-ups: {followUpCount}</div>
          <div>Impacted tasks: {taskCount}</div>
          <div>Impacted docs: {docCount}</div>
          <label className="field-block"><span className="field-label">Reassign linked records to</span><select className="field-input" value={deleteTargetId} onChange={(event) => onDeleteTargetChange(event.target.value)}>{projects.filter((entry) => entry.id !== project.id).map((entry) => <option key={entry.id} value={entry.id}>{entry.systemProjectKind === 'unclassified' ? 'Unclassified' : entry.name}</option>)}</select></label>
          <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={deleteConfirm} onChange={(event) => onDeleteConfirmChange(event.target.checked)} />I understand this removes the project record and reassigns linked work.</label>
          {isSystemProject ? <div className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900">System unclassified project cannot be deleted.</div> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="action-btn action-btn-danger" disabled={!deleteTargetId || !deleteConfirm || isSystemProject} onClick={onDelete}>Delete project</button></div>
      </AppModalBody>
    </AppModal>
  );
}
