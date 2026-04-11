import type { ContactDraft } from '../../domains/directory/hooks/usePeopleDirectoryViewModel';
import { CONTACT_COMMUNICATION_OPTIONS, CONTACT_RELATIONSHIP_STATUS_OPTIONS, CONTACT_RESPONSIVENESS_OPTIONS, CONTACT_RISK_TIER_OPTIONS } from '../../domains/directory/hooks/usePeopleDirectoryViewModel';
import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface ContactCreateModalProps {
  open: boolean;
  draft: ContactDraft;
  companies: Array<{ id: string; name: string }>;
  error: string | null;
  onDraftChange: (value: ContactDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}

function updateDraftField<K extends keyof ContactDraft>(draft: ContactDraft, key: K, value: ContactDraft[K], onDraftChange: (next: ContactDraft) => void) {
  onDraftChange({ ...draft, [key]: value });
}

export function ContactCreateModal({ open, draft, companies, error, onDraftChange, onClose, onCreate }: ContactCreateModalProps) {
  if (!open) return null;

  return (
    <AppModal onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="New contact" subtitle="Create a complete people record for relationship management." onClose={onClose} />
      <AppModalBody>
        <div className="space-y-4">
          <div className="grid gap-2 md:grid-cols-2">
            <label className="field-block md:col-span-2"><span className="field-label">Name *</span><input autoFocus className="field-input" value={draft.name} onChange={(event) => updateDraftField(draft, 'name', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Role</span><input className="field-input" value={draft.role} onChange={(event) => updateDraftField(draft, 'role', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Title</span><input className="field-input" value={draft.title} onChange={(event) => updateDraftField(draft, 'title', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Department</span><input className="field-input" value={draft.department} onChange={(event) => updateDraftField(draft, 'department', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Company</span><select className="field-input" value={draft.companyId} onChange={(event) => updateDraftField(draft, 'companyId', event.target.value, onDraftChange)}><option value="">No linked company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Email</span><input className="field-input" value={draft.email} onChange={(event) => updateDraftField(draft, 'email', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Phone</span><input className="field-input" value={draft.phone} onChange={(event) => updateDraftField(draft, 'phone', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Internal owner</span><input className="field-input" value={draft.internalOwner} onChange={(event) => updateDraftField(draft, 'internalOwner', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Relationship status</span><select className="field-input" value={draft.relationshipStatus} onChange={(event) => updateDraftField(draft, 'relationshipStatus', event.target.value as ContactDraft['relationshipStatus'], onDraftChange)}>{CONTACT_RELATIONSHIP_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Risk tier</span><select className="field-input" value={draft.riskTier} onChange={(event) => updateDraftField(draft, 'riskTier', event.target.value as ContactDraft['riskTier'], onDraftChange)}>{CONTACT_RISK_TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Responsiveness</span><select className="field-input" value={draft.responsivenessRating} onChange={(event) => updateDraftField(draft, 'responsivenessRating', event.target.value ? Number(event.target.value) as ContactDraft['responsivenessRating'] : '', onDraftChange)}><option value="">Not rated</option>{CONTACT_RESPONSIVENESS_OPTIONS.map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label className="field-block"><span className="field-label">Preferred communication</span><select className="field-input" value={draft.preferredCommunicationMethod} onChange={(event) => updateDraftField(draft, 'preferredCommunicationMethod', event.target.value as ContactDraft['preferredCommunicationMethod'], onDraftChange)}><option value="">Not set</option>{CONTACT_COMMUNICATION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={draft.tags} onChange={(event) => updateDraftField(draft, 'tags', event.target.value, onDraftChange)} /></label>
            <label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={draft.aliases} onChange={(event) => updateDraftField(draft, 'aliases', event.target.value, onDraftChange)} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[88px]" value={draft.notes} onChange={(event) => updateDraftField(draft, 'notes', event.target.value, onDraftChange)} /></label>
          </div>
          {error ? <div className="rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={onCreate}>Create contact</button></div>
      </AppModalBody>
    </AppModal>
  );
}
