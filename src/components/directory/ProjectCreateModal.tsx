import type { ProjectStatus } from '../../types';
import { splitLocationValue } from '../../domains/directory/hooks/useDirectoryViewModel';
import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface ProjectCreateModalProps {
  open: boolean;
  draft: any;
  errors: string[];
  statusOptions: ProjectStatus[];
  onDraftChange: (updater: (prev: any) => any) => void;
  onClose: () => void;
  onSave: () => void;
}

export function ProjectCreateModal({ open, draft, errors, statusOptions, onDraftChange, onClose, onSave }: ProjectCreateModalProps) {
  if (!open) return null;
  return (
    <AppModal size="xl" onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="New Project" subtitle="Capture clean project directory metadata before routing operational work." onClose={onClose} />
      <AppModalBody>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="field-block"><span className="field-label">Project name *</span><input className="field-input" value={draft.name} onChange={(event) => onDraftChange((prev) => ({ ...prev, name: event.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Project code</span><input className="field-input" value={draft.code ?? ''} onChange={(event) => onDraftChange((prev) => ({ ...prev, code: event.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={draft.owner} onChange={(event) => onDraftChange((prev) => ({ ...prev, owner: event.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Status</span><select className="field-input" value={draft.status} onChange={(event) => onDraftChange((prev) => ({ ...prev, status: event.target.value as ProjectStatus }))}>{statusOptions.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Client / owner org</span><input className="field-input" value={draft.clientOrg ?? ''} onChange={(event) => onDraftChange((prev) => ({ ...prev, clientOrg: event.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Phase</span><input className="field-input" value={draft.phase ?? ''} onChange={(event) => onDraftChange((prev) => ({ ...prev, phase: event.target.value }))} /></label>
          <label className="field-block"><span className="field-label">Target completion</span><input type="date" className="field-input" value={(draft.targetCompletionDate || '').slice(0, 10)} onChange={(event) => onDraftChange((prev) => ({ ...prev, targetCompletionDate: event.target.value ? `${event.target.value}T00:00:00.000Z` : '' }))} /></label>
          <label className="field-block"><span className="field-label">Location / facility / building</span><input className="field-input" value={[draft.location, draft.facility, draft.building].filter(Boolean).join(' / ')} onChange={(event) => onDraftChange((prev) => ({ ...prev, ...splitLocationValue(event.target.value) }))} /></label>
          <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[80px]" value={draft.notes} onChange={(event) => onDraftChange((prev) => ({ ...prev, notes: event.target.value }))} /></label>
        </div>
        {errors.length > 0 ? <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">{errors.map((error) => <div key={error}>• {error}</div>)}</div> : null}
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={onSave}>Save project</button></div>
      </AppModalBody>
    </AppModal>
  );
}
