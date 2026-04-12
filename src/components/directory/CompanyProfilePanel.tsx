import { formatDate } from '../../lib/utils';
import { getCompanyLinkedRecords } from '../../lib/recordContext';
import { useAppStore } from '../../store/useAppStore';
import type { CompanyRecord } from '../../types';
import type { CompanyDraft } from '../../domains/directory/hooks/useCompaniesDirectoryViewModel';
import { COMPANY_RELATIONSHIP_STATUS_OPTIONS, COMPANY_RESPONSIVENESS_OPTIONS, COMPANY_RISK_TIER_OPTIONS, COMPANY_TYPE_OPTIONS } from '../../domains/directory/hooks/useCompaniesDirectoryViewModel';
import { RecordSaveStatus } from '../save/RecordSaveStatus';

interface CompanyProfilePanelProps {
  company: CompanyRecord | null;
  contacts: Array<{ id: string; name: string }>;
  editing: boolean;
  draft: CompanyDraft;
  saveError: string | null;
  onDraftChange: (value: CompanyDraft) => void;
  onBeginEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onOpenProject: (projectId: string) => void;
  onOpenFollowUp: (followUpId: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenContact: (contactId: string) => void;
}

export function CompanyProfilePanel({
  company,
  contacts,
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
  onOpenContact,
}: CompanyProfilePanelProps) {
  const { items, tasks, contacts: allContacts, companies, projects } = useAppStore();

  if (!company) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">Select a company to maintain relationship health, ownership, and linked project/work context.</div>;
  }

  const linked = getCompanyLinkedRecords(company.id, { items, tasks, contacts: allContacts, companies, projects });
  const primaryContact = company.primaryContactId ? allContacts.find((entry) => entry.id === company.primaryContactId) : null;
  const openFollowups = linked.followups.filter((item) => item.status !== 'Closed');
  const openTasks = linked.tasks.filter((task) => task.status !== 'Done');

  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-3">
        <div>
          <div className="text-lg font-semibold text-slate-950">{company.name}</div>
          <div className="text-xs text-slate-600">{company.type} • Primary contact: {primaryContact?.name || 'Not assigned'}</div>
          <div className="mt-1 text-xs text-slate-500">Owner: {company.internalOwner || 'Unassigned'} • Status: {company.relationshipStatus || 'Active'} • Risk: {company.riskTier || 'Low'} • {company.active === false ? 'Archived' : 'Active'}</div>
          <div className="mt-1">
            <RecordSaveStatus record={{ type: 'company', id: company.id }} editing={editing} />
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {!editing ? <button className="primary-btn" onClick={onBeginEdit}>Edit company</button> : null}
          {editing ? <><button className="action-btn" onClick={onCancelEdit}>Cancel</button><button className="primary-btn" onClick={onSaveEdit}>Save</button></> : null}
        </div>
      </div>

      {editing ? (
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-sm font-semibold">Company profile</div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="field-block md:col-span-2"><span className="field-label">Name *</span><input className="field-input" value={draft.name} onChange={(event) => onDraftChange({ ...draft, name: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Type</span><select className="field-input" value={draft.type} onChange={(event) => onDraftChange({ ...draft, type: event.target.value as CompanyDraft['type'] })}>{COMPANY_TYPE_OPTIONS.map((entry) => <option key={entry}>{entry}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Primary contact</span><select className="field-input" value={draft.primaryContactId} onChange={(event) => onDraftChange({ ...draft, primaryContactId: event.target.value })}><option value="">No primary contact</option>{contacts.map((contact) => <option key={contact.id} value={contact.id}>{contact.name}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Internal owner</span><input className="field-input" value={draft.internalOwner} onChange={(event) => onDraftChange({ ...draft, internalOwner: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Relationship status</span><select className="field-input" value={draft.relationshipStatus} onChange={(event) => onDraftChange({ ...draft, relationshipStatus: event.target.value as CompanyDraft['relationshipStatus'] })}>{COMPANY_RELATIONSHIP_STATUS_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Risk tier</span><select className="field-input" value={draft.riskTier} onChange={(event) => onDraftChange({ ...draft, riskTier: event.target.value as CompanyDraft['riskTier'] })}>{COMPANY_RISK_TIER_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}</select></label>
            <label className="field-block"><span className="field-label">Responsiveness</span><select className="field-input" value={draft.responsivenessRating} onChange={(event) => onDraftChange({ ...draft, responsivenessRating: event.target.value ? Number(event.target.value) as CompanyDraft['responsivenessRating'] : '' })}><option value="">Not rated</option>{COMPANY_RESPONSIVENESS_OPTIONS.map((entry) => <option key={entry} value={entry}>{entry} / 5</option>)}</select></label>
            <label className="field-block"><span className="field-label">Last reviewed</span><input type="date" className="field-input" value={draft.lastReviewedAt} onChange={(event) => onDraftChange({ ...draft, lastReviewedAt: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Active project count</span><input className="field-input" inputMode="numeric" value={draft.activeProjectCountCache} onChange={(event) => onDraftChange({ ...draft, activeProjectCountCache: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Aliases (comma-separated)</span><input className="field-input" value={draft.aliases} onChange={(event) => onDraftChange({ ...draft, aliases: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Tags (comma-separated)</span><input className="field-input" value={draft.tags} onChange={(event) => onDraftChange({ ...draft, tags: event.target.value })} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Escalation notes</span><textarea className="field-input min-h-[72px]" value={draft.escalationNotes} onChange={(event) => onDraftChange({ ...draft, escalationNotes: event.target.value })} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Notes</span><textarea className="field-input min-h-[90px]" value={draft.notes} onChange={(event) => onDraftChange({ ...draft, notes: event.target.value })} /></label>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-700"><input id="company-active" type="checkbox" checked={draft.active} onChange={(event) => onDraftChange({ ...draft, active: event.target.checked })} /><label htmlFor="company-active">Active company record</label></div>
          {saveError ? <div className="mt-2 rounded border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-900">{saveError}</div> : null}
        </div>
      ) : (
        <>
          <div className="grid gap-2 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Relationship health</div><div className="mt-1 text-xs text-slate-700">Status: {company.relationshipStatus || 'Active'}</div><div className="text-xs text-slate-700">Risk: {company.riskTier || 'Low'}</div><div className="text-xs text-slate-700">Responsiveness: {company.responsivenessRating ? `${company.responsivenessRating}/5` : 'Not rated'}</div></div>
            <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Maintenance metadata</div><div className="mt-1 text-xs text-slate-700">Last reviewed: {formatDate(company.lastReviewedAt)}</div><div className="text-xs text-slate-700">Active projects: {company.activeProjectCountCache ?? linked.projects.length}</div><div className="text-xs text-slate-700">Primary contact: {primaryContact?.name || 'Not assigned'}</div></div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3">
            <div className="mb-1 text-xs font-medium uppercase text-slate-500">Primary contact and people</div>
            {linked.contacts.length === 0 ? <div className="text-xs text-slate-500">No linked contacts yet.</div> : (
              <div className="flex flex-wrap gap-2">
                {linked.contacts.map((contact) => <button key={contact.id} className={contact.id === primaryContact?.id ? 'rounded border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-semibold' : 'rounded border border-slate-200 px-2 py-1 text-xs'} onClick={() => onOpenContact(contact.id)}>{contact.name}{contact.id === primaryContact?.id ? ' (Primary)' : ''}</button>)}
              </div>
            )}
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
                <div className="mt-1 space-y-1">{openFollowups.slice(0, 3).map((item) => <button key={item.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenFollowUp(item.id)}>{item.title}</button>)}</div>
              </div>
              <div>
                <div className="text-[11px] font-semibold uppercase text-slate-500">Open tasks</div>
                <div className="mt-1 space-y-1">{openTasks.slice(0, 3).map((task) => <button key={task.id} className="w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onOpenTask(task.id)}>{task.title}</button>)}</div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 p-3"><div className="text-xs font-medium uppercase text-slate-500">Notes</div><div className="mt-1 text-xs text-slate-700">{company.notes || 'No notes yet.'}</div><div className="mt-2 text-xs text-slate-500">Escalation notes: {company.escalationNotes || 'None'}</div><div className="mt-1 text-xs text-slate-500">Aliases: {(company.aliases ?? []).join(', ') || 'None'}</div><div className="mt-1 text-xs text-slate-500">Tags: {(company.tags ?? []).join(', ') || 'None'}</div></div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
        <button className="action-btn" onClick={onArchiveToggle}>{company.active === false ? 'Unarchive company' : 'Archive company'}</button>
        <button className="action-btn action-btn-danger" onClick={onDelete}>Delete company</button>
      </div>
    </div>
  );
}
