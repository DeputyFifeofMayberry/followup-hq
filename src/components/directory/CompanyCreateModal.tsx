import type { CompanyDraft } from '../../domains/directory/hooks/useCompaniesDirectoryViewModel';
import { COMPANY_RELATIONSHIP_STATUS_OPTIONS, COMPANY_RESPONSIVENESS_OPTIONS, COMPANY_RISK_TIER_OPTIONS, COMPANY_TYPE_OPTIONS } from '../../domains/directory/hooks/useCompaniesDirectoryViewModel';
import { AppModal, AppModalBody, AppModalHeader } from '../ui/AppPrimitives';

interface CompanyCreateModalProps {
  open: boolean;
  draft: CompanyDraft;
  contacts: Array<{ id: string; name: string }>;
  error: string | null;
  onDraftChange: (value: CompanyDraft) => void;
  onClose: () => void;
  onCreate: () => void;
}

export function CompanyCreateModal({ open, draft, contacts, error, onDraftChange, onClose, onCreate }: CompanyCreateModalProps) {
  if (!open) return null;
  return (
    <AppModal onClose={onClose} onBackdropClick={onClose}>
      <AppModalHeader title="New company" subtitle="Create a complete company record with ownership, relationship health, and primary contact context." onClose={onClose} />
      <AppModalBody>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="field-block md:col-span-2"><span className="field-label">Name *</span><input className="field-input" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>
          <label className="field-block"><span className="field-label">Type</span><select className="field-input" value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as CompanyDraft['type'] })}>{COMPANY_TYPE_OPTIONS.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Primary contact</span><select className="field-input" value={draft.primaryContactId} onChange={(event) => onDraftChange({ ...draft, primaryContactId: event.target.value })}><option value="">No primary contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Internal owner</span><input className="field-input" value={draft.internalOwner} onChange={(event) => onDraftChange({ ...draft, internalOwner: event.target.value })} /></label>
          <label className="field-block"><span className="field-label">Relationship status</span><select className="field-input" value={draft.relationshipStatus} onChange={(event) => onDraftChange({ ...draft, relationshipStatus: event.target.value as CompanyDraft['relationshipStatus'] })}>{COMPANY_RELATIONSHIP_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Risk tier</span><select className="field-input" value={draft.riskTier} onChange={(event) => onDraftChange({ ...draft, riskTier: event.target.value as CompanyDraft['riskTier'] })}>{COMPANY_RISK_TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
          <label className="field-block"><span className="field-label">Responsiveness</span><select className="field-input" value={draft.responsivenessRating} onChange={(event) => onDraftChange({ ...draft, responsivenessRating: event.target.value ? Number(event.target.value) as CompanyDraft['responsivenessRating'] : '' })}><option value="">Not rated</option>{COMPANY_RESPONSIVENESS_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry} / 5</option>)}</select></label>
          <label className="field-block"><span className="field-label">Last reviewed</span><input type="date" className="field-input" value={draft.lastReviewedAt} onChange={(event) => onDraftChange({ ...draft, lastReviewedAt: event.target.value })} /></label>
          <label className="field-block"><span className="field-label">Active project count</span><input className="field-input" inputMode="numeric" value={draft.activeProjectCountCache} onChange={(event) => onDraftChange({ ...draft, activeProjectCountCache: event.target.value })} /></label>
          <label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={draft.aliases} onChange={(event) => onDraftChange({ ...draft, aliases: event.target.value })} /></label>
          <label className="field-block"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={draft.tags} onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })} /></label>
          <label className="field-block md:col-span-2"><span className="field-label">Escalation notes</span><textarea className="field-input min-h-[72px]" value={draft.escalationNotes} onChange={(event) => onDraftChange({ ...draft, escalationNotes: event.target.value })} /></label>
          <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[90px]" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} /></label>
        </div>
        {error ? <div className="mt-3 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</div> : null}
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-700"><input id="company-create-active" type="checkbox" checked={draft.active} onChange={(event) => onDraftChange({ ...draft, active: event.target.checked })} /><label htmlFor="company-create-active">Active company record</label></div>
        <div className="mt-4 flex justify-end gap-2"><button className="action-btn" onClick={onClose}>Cancel</button><button className="primary-btn" onClick={onCreate}>Create company</button></div>
      </AppModalBody>
    </AppModal>
  );
}
