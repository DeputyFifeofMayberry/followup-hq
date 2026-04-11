import { formatDate } from '../../lib/utils';
import { getContactLinkedRecords } from '../../lib/recordContext';
import { useAppStore } from '../../store/useAppStore';
import type { ContactRecord } from '../../types';
import type { ContactDraft } from '../../domains/directory/hooks/usePeopleDirectoryViewModel';
import { CONTACT_COMMUNICATION_OPTIONS, CONTACT_RELATIONSHIP_STATUS_OPTIONS, CONTACT_RESPONSIVENESS_OPTIONS, CONTACT_RISK_TIER_OPTIONS, companyNameById } from '../../domains/directory/hooks/usePeopleDirectoryViewModel';

interface ContactProfilePanelProps {
  contact: ContactRecord | null;
  companies: Array<{ id: string; name: string }>;
  editing: boolean;
  draft: ContactDraft;
  saveError: string | null;
  onDraftChange: (value: ContactDraft) => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenFollowUp: (followUpId: string) => void;
  onOpenTask: (taskId: string) => void;
}

export function ContactProfilePanel({
  contact,
  companies,
  editing,
  draft,
  saveError,
  onDraftChange,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onArchiveToggle,
  onDelete,
  onOpenProject,
  onOpenFollowUp,
  onOpenTask,
}: ContactProfilePanelProps) {
  const { items, tasks, contacts, companies: companyRecords, projects } = useAppStore();

  if (!contact) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Select a contact to view profile details, ownership, and linked work context.</div>;
  }

  const linked = getContactLinkedRecords(contact.id, { items, tasks, contacts, companies: companyRecords, projects });

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div>
          <div className="text-lg font-semibold text-slate-950">{contact.name}</div>
          <div className="text-xs text-slate-600">{companyNameById(companyRecords, contact.companyId)} • {contact.title || contact.role || 'Role not set'}</div>
          <div className="mt-1 text-xs text-slate-500">Owner: {contact.internalOwner || 'Unassigned'} • Status: {contact.relationshipStatus || 'Active'} • Risk: {contact.riskTier || 'Low'}</div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!editing ? <button className="primary-btn" onClick={onBeginEdit}>Edit contact</button> : null}
          {editing ? <><button className="action-btn" onClick={onCancelEdit}>Cancel</button><button className="primary-btn" onClick={onSaveEdit}>Save</button></> : null}
        </div>
      </div>

      {editing ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Contact profile</div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="field-block md:col-span-2"><span className="field-label">Name *</span><input className="field-input" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Company</span><select className="field-input" value={draft.companyId} onChange={(event) => onDraftChange({ ...draft, companyId: event.target.value })}><option value="">No linked company</option>{companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Role</span><input className="field-input" value={draft.role} onChange={(event) => onDraftChange({ ...draft, role: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Title</span><input className="field-input" value={draft.title} onChange={(event) => onDraftChange({ ...draft, title: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Department</span><input className="field-input" value={draft.department} onChange={(event) => onDraftChange({ ...draft, department: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Internal owner</span><input className="field-input" value={draft.internalOwner} onChange={(event) => onDraftChange({ ...draft, internalOwner: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Relationship status</span><select className="field-input" value={draft.relationshipStatus} onChange={(event) => onDraftChange({ ...draft, relationshipStatus: event.target.value as ContactDraft['relationshipStatus'] })}>{CONTACT_RELATIONSHIP_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Risk tier</span><select className="field-input" value={draft.riskTier} onChange={(event) => onDraftChange({ ...draft, riskTier: event.target.value as ContactDraft['riskTier'] })}>{CONTACT_RISK_TIER_OPTIONS.map((tier) => <option key={tier} value={tier}>{tier}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Responsiveness</span><select className="field-input" value={draft.responsivenessRating} onChange={(event) => onDraftChange({ ...draft, responsivenessRating: event.target.value ? Number(event.target.value) as ContactDraft['responsivenessRating'] : '' })}><option value="">Not rated</option>{CONTACT_RESPONSIVENESS_OPTIONS.map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label>
            <label className="field-block"><span className="field-label">Preferred communication</span><select className="field-input" value={draft.preferredCommunicationMethod} onChange={(event) => onDraftChange({ ...draft, preferredCommunicationMethod: event.target.value as ContactDraft['preferredCommunicationMethod'] })}><option value="">Not set</option>{CONTACT_COMMUNICATION_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Last contacted</span><input type="date" className="field-input" value={draft.lastContactedAt} onChange={(event) => onDraftChange({ ...draft, lastContactedAt: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Last response</span><input type="date" className="field-input" value={draft.lastResponseAt} onChange={(event) => onDraftChange({ ...draft, lastResponseAt: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Email</span><input className="field-input" value={draft.email} onChange={(event) => onDraftChange({ ...draft, email: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Phone</span><input className="field-input" value={draft.phone} onChange={(event) => onDraftChange({ ...draft, phone: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={draft.aliases} onChange={(event) => onDraftChange({ ...draft, aliases: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={draft.tags} onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Escalation notes</span><textarea className="field-input min-h-[72px]" value={draft.escalationNotes} onChange={(event) => onDraftChange({ ...draft, escalationNotes: event.target.value })} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[90px]" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} /></label>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input id="contact-active" type="checkbox" checked={draft.active} onChange={(event) => onDraftChange({ ...draft, active: event.target.checked })} /><label htmlFor="contact-active">Active contact record</label></div>
          {saveError ? <div className="mt-2 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{saveError}</div> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Communication</div><div className="mt-1 text-xs text-slate-700">{contact.email || 'No email'}</div><div className="text-xs text-slate-700">{contact.phone || 'No phone'}</div><div className="text-xs text-slate-500">Preferred: {contact.preferredCommunicationMethod || 'Not set'}</div></div>
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Relationship metadata</div><div className="mt-1 text-xs text-slate-700">Responsiveness: {contact.responsivenessRating ? `${contact.responsivenessRating}/5` : 'Not rated'}</div><div className="text-xs text-slate-700">Last contacted: {formatDate(contact.lastContactedAt)}</div><div className="text-xs text-slate-700">Last response: {formatDate(contact.lastResponseAt)}</div></div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-medium uppercase text-slate-500">Linked projects</div>
            {linked.projects.length === 0 ? <div className="text-xs text-slate-500">No linked projects.</div> : <div className="flex flex-wrap gap-2">{linked.projects.map((project) => <button key={project.id} className="rounded border border-slate-200 px-2 py-1 text-xs" onClick={() => onOpenProject(project.id)}>{project.name}</button>)}</div>}
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-medium uppercase text-slate-500">Linked work context</div>
            <div className="text-xs text-slate-700">{linked.followups.length} follow-ups • {linked.tasks.length} tasks</div>
            <div className="mt-2 grid gap-2 md:grid-cols-2">
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Open follow-ups</div>
                <div className="mt-1 space-y-1">{linked.followups.filter((item) => item.status !== 'Closed').slice(0, 3).map((item) => <button key={item.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenFollowUp(item.id)}>{item.title}</button>)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Open tasks</div>
                <div className="mt-1 space-y-1">{linked.tasks.filter((task) => task.status !== 'Done').slice(0, 3).map((task) => <button key={task.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenTask(task.id)}>{task.title}</button>)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Notes</div><div className="mt-1 text-xs text-slate-700">{contact.notes || 'No notes yet.'}</div><div className="mt-2 text-xs text-slate-500">Escalation notes: {contact.escalationNotes || 'None'}</div><div className="mt-1 text-xs text-slate-500">Tags: {(contact.tags ?? []).join(', ') || 'None'}</div></div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <button className="action-btn" onClick={onArchiveToggle}>{contact.active === false ? 'Unarchive contact' : 'Archive contact'}</button>
        <button className="action-btn action-btn-danger" onClick={onDelete}>Delete contact</button>
      </div>
    </div>
  );
}
