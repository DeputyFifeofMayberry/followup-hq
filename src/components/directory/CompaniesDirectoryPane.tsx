import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import type { CompanyType } from '../../types';
import { CompanyCreateModal } from './CompanyCreateModal';
import { CompanyProfilePanel } from './CompanyProfilePanel';

interface CompaniesDirectoryPaneProps {
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function CompaniesDirectoryPane({ onOpenDirectoryRecord }: CompaniesDirectoryPaneProps) {
  const { companies, addCompany, updateCompany } = useAppStore(useShallow((s) => ({ companies: s.companies, addCompany: s.addCompany, updateCompany: s.updateCompany })));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CompanyType>('Other');

  const rows = useMemo(() => companies.filter((company) => company.name.toLowerCase().includes(query.trim().toLowerCase())), [companies, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <input className="field-input max-w-64" placeholder="Search companies" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="primary-btn" onClick={() => setShowCreate(true)}>New company</button>
        </div>
        <div className="space-y-2">
          {rows.map((company) => (
            <button key={company.id} className={selected?.id === company.id ? 'w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-left' : 'w-full rounded border border-slate-200 px-3 py-2 text-left'} onClick={() => setSelectedId(company.id)}>
              <div className="font-medium">{company.name}</div>
              <div className="text-xs text-slate-600">{company.type}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <CompanyProfilePanel company={selected} onOpenProject={(id) => onOpenDirectoryRecord('project', id)} />
        {selected ? (
          <div className="mt-3 flex gap-2">
            <button className="action-btn" onClick={() => updateCompany(selected.id, { active: selected.active === false ? true : false })}>{selected.active === false ? 'Mark active' : 'Archive'}</button>
          </div>
        ) : null}
      </section>
      <CompanyCreateModal
        open={showCreate}
        name={newName}
        type={newType}
        onNameChange={setNewName}
        onTypeChange={setNewType}
        onClose={() => setShowCreate(false)}
        onCreate={() => {
          const name = newName.trim();
          if (!name) return;
          const id = addCompany({ name, type: newType, notes: '', tags: [], active: true });
          setSelectedId(id);
          setShowCreate(false);
          setNewName('');
          setNewType('Other');
        }}
      />
    </div>
  );
}
