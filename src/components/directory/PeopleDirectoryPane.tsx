import { useState } from 'react';
import { buildContactDraft, usePeopleDirectoryViewModel } from '../../domains/directory/hooks/usePeopleDirectoryViewModel';
import { ContactCreateModal } from './ContactCreateModal';
import { ContactProfilePanel } from './ContactProfilePanel';
import { RecordSaveStatus } from '../save/RecordSaveStatus';

interface PeopleDirectoryPaneProps {
  vm: {
    selectedRecordType: 'project' | 'contact' | 'company';
    selectedRecordId: string | null;
    setSelectedRecord: (recordType: 'project' | 'contact' | 'company', recordId: string | null) => void;
  };
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
  onOpenFollowUp: (recordId: string) => void;
  onOpenTask: (recordId: string) => void;
}

export function PeopleDirectoryPane({ vm, onOpenDirectoryRecord, onOpenFollowUp, onOpenTask }: PeopleDirectoryPaneProps) {
  const peopleVm = usePeopleDirectoryViewModel(vm);
  const [createDraft, setCreateDraft] = useState(buildContactDraft(null));
  const [createError, setCreateError] = useState<string | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,1.25fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input className="field-input min-w-[240px] flex-1" placeholder="Search by name, role, email, phone, alias, or tag" value={peopleVm.query} onChange={(event) => peopleVm.setQuery(event.target.value)} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={peopleVm.showArchived} onChange={(event) => peopleVm.setShowArchived(event.target.checked)} />Show archived</label>
            <button className="primary-btn" onClick={() => peopleVm.setShowCreate(true)}>New contact</button>
          </div>
        </div>

        {peopleVm.selectedContact && !peopleVm.selectedVisible ? (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Selected contact <span className="font-semibold">{peopleVm.selectedContact.name}</span> is hidden by current filters.
            <button className="ml-2 font-semibold underline" onClick={() => { peopleVm.setQuery(''); peopleVm.setShowArchived(true); }}>Clear filters</button>
          </div>
        ) : null}

        {peopleVm.contacts.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No people records yet. Create your first contact to start relationship tracking.</div> : null}
        {peopleVm.contacts.length > 0 && peopleVm.rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No contacts match this search/filter. Adjust filters to continue.</div> : null}

        <div className="space-y-2">
          {peopleVm.rows.map((contact) => (
            <button key={contact.id} className={peopleVm.selectedContact?.id === contact.id ? 'w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-left' : 'w-full rounded border border-slate-200 px-3 py-2 text-left'} onClick={() => peopleVm.setSelectedRecord('contact', contact.id)}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{contact.name}</div>
                {contact.active === false ? <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Archived</span> : null}
              </div>
              <div className="text-xs text-slate-600">{contact.title || contact.role || 'Role not set'} • {contact.internalOwner || 'Unassigned owner'}</div>
              <div className="text-[11px] text-slate-500">{contact.relationshipStatus || 'Active'} • Risk {contact.riskTier || 'Low'}</div>
              {peopleVm.selectedContact?.id === contact.id ? <div className="mt-1"><RecordSaveStatus record={{ type: 'contact', id: contact.id }} compact /></div> : null}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <ContactProfilePanel
          contact={peopleVm.selectedContact ?? peopleVm.fallbackContact}
          companies={peopleVm.companies.map((company) => ({ id: company.id, name: company.name }))}
          editing={peopleVm.editing}
          draft={peopleVm.draft}
          saveError={peopleVm.saveError}
          onDraftChange={peopleVm.setDraft}
          onBeginEdit={peopleVm.beginEdit}
          onCancelEdit={peopleVm.cancelEdit}
          onSaveEdit={peopleVm.saveEdit}
          onArchiveToggle={peopleVm.archiveToggle}
          onDelete={peopleVm.removeSelectedContact}
          onOpenProject={(id) => onOpenDirectoryRecord('project', id)}
          onOpenFollowUp={onOpenFollowUp}
          onOpenTask={onOpenTask}
        />
      </section>

      <ContactCreateModal
        open={peopleVm.showCreate}
        draft={createDraft}
        companies={peopleVm.companies.map((company) => ({ id: company.id, name: company.name }))}
        error={createError}
        onDraftChange={setCreateDraft}
        onClose={() => {
          peopleVm.setShowCreate(false);
          setCreateDraft(buildContactDraft(null));
          setCreateError(null);
        }}
        onCreate={() => {
          const result = peopleVm.createContact(createDraft);
          if (!result.ok) {
            setCreateError(result.error);
            return;
          }
          setCreateDraft(buildContactDraft(null));
          setCreateError(null);
        }}
      />
    </div>
  );
}
