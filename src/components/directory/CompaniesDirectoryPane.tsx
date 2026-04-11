import { useState } from 'react';
import { buildCompanyDraft, useCompaniesDirectoryViewModel } from '../../domains/directory/hooks/useCompaniesDirectoryViewModel';
import { CompanyCreateModal } from './CompanyCreateModal';
import { CompanyProfilePanel } from './CompanyProfilePanel';

interface CompaniesDirectoryPaneProps {
  vm: {
    selectedRecordType: 'project' | 'contact' | 'company';
    selectedRecordId: string | null;
    setSelectedRecord: (recordType: 'project' | 'contact' | 'company', recordId: string | null) => void;
  };
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
  onOpenFollowUp: (recordId: string) => void;
  onOpenTask: (recordId: string) => void;
}

export function CompaniesDirectoryPane({ vm, onOpenDirectoryRecord, onOpenFollowUp, onOpenTask }: CompaniesDirectoryPaneProps) {
  const companiesVm = useCompaniesDirectoryViewModel(vm);
  const [createDraft, setCreateDraft] = useState(buildCompanyDraft(null));
  const [createError, setCreateError] = useState<string | null>(null);

  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr,1.25fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <input className="field-input min-w-[240px] flex-1" placeholder="Search by company, owner, status, aliases, or tags" value={companiesVm.query} onChange={(event) => companiesVm.setQuery(event.target.value)} />
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={companiesVm.showArchived} onChange={(event) => companiesVm.setShowArchived(event.target.checked)} />Show archived</label>
            <button className="primary-btn" onClick={() => companiesVm.setShowCreate(true)}>New company</button>
          </div>
        </div>

        {companiesVm.selectedCompany && !companiesVm.selectedVisible ? (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Selected company <span className="font-semibold">{companiesVm.selectedCompany.name}</span> is hidden by current filters.
            <button className="ml-2 font-semibold underline" onClick={() => { companiesVm.setQuery(''); companiesVm.setShowArchived(true); }}>Clear filters</button>
          </div>
        ) : null}

        {companiesVm.companies.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No company records yet. Create your first company to anchor relationship context.</div> : null}
        {companiesVm.companies.length > 0 && companiesVm.rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">No companies match this search/filter. Adjust filters to continue.</div> : null}

        <div className="space-y-2">
          {companiesVm.rows.map((company) => (
            <button key={company.id} className={companiesVm.selectedCompany?.id === company.id ? 'w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-left' : 'w-full rounded border border-slate-200 px-3 py-2 text-left'} onClick={() => companiesVm.setSelectedRecord('company', company.id)}>
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{company.name}</div>
                {company.active === false ? <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">Archived</span> : null}
              </div>
              <div className="text-xs text-slate-600">{company.type} • {company.internalOwner || 'Unassigned owner'}</div>
              <div className="text-[11px] text-slate-500">{company.relationshipStatus || 'Active'} • Risk {company.riskTier || 'Low'} • {company.activeProjectCountCache ?? 0} active projects</div>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <CompanyProfilePanel
          company={companiesVm.selectedCompany ?? companiesVm.fallbackCompany}
          contacts={companiesVm.contacts.map((contact) => ({ id: contact.id, name: contact.name }))}
          editing={companiesVm.editing}
          draft={companiesVm.draft}
          saveError={companiesVm.saveError}
          onDraftChange={companiesVm.setDraft}
          onBeginEdit={companiesVm.beginEdit}
          onCancelEdit={companiesVm.cancelEdit}
          onSaveEdit={companiesVm.saveEdit}
          onArchiveToggle={companiesVm.archiveToggle}
          onDelete={companiesVm.removeSelectedCompany}
          onOpenProject={(id) => onOpenDirectoryRecord('project', id)}
          onOpenFollowUp={onOpenFollowUp}
          onOpenTask={onOpenTask}
          onOpenContact={(id) => onOpenDirectoryRecord('contact', id)}
        />
      </section>
      <CompanyCreateModal
        open={companiesVm.showCreate}
        draft={createDraft}
        contacts={companiesVm.contacts.map((contact) => ({ id: contact.id, name: contact.name }))}
        error={createError}
        onDraftChange={setCreateDraft}
        onClose={() => {
          companiesVm.setShowCreate(false);
          setCreateDraft(buildCompanyDraft(null));
          setCreateError(null);
        }}
        onCreate={() => {
          const result = companiesVm.createCompany(createDraft);
          if (!result.ok) {
            setCreateError(result.error);
            return;
          }
          setCreateDraft(buildCompanyDraft(null));
          setCreateError(null);
        }}
      />
    </div>
  );
}
