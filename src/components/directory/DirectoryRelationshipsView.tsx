import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { getCompanyLinkedRecords, getContactLinkedRecords } from '../../lib/recordContext';
import { useAppStore } from '../../store/useAppStore';

interface DirectoryRelationshipsViewProps {
  kind: 'people' | 'companies';
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function DirectoryRelationshipsView({ kind, onOpenDirectoryRecord }: DirectoryRelationshipsViewProps) {
  const { contacts, companies, items, tasks, projects } = useAppStore(useShallow((s) => ({ contacts: s.contacts, companies: s.companies, items: s.items, tasks: s.tasks, projects: s.projects })));
  const [query, setQuery] = useState('');

  const records = useMemo(() => {
    if (kind === 'people') {
      return contacts
        .filter((contact) => contact.name.toLowerCase().includes(query.trim().toLowerCase()))
        .map((contact) => {
          const linked = getContactLinkedRecords(contact.id, { items, tasks, contacts, companies, projects });
          return { id: contact.id, name: contact.name, subtitle: contact.role || 'Contact', linkedProjects: linked.projects };
        });
    }
    return companies
      .filter((company) => company.name.toLowerCase().includes(query.trim().toLowerCase()))
      .map((company) => {
        const linked = getCompanyLinkedRecords(company.id, { items, tasks, contacts, companies, projects });
        return { id: company.id, name: company.name, subtitle: company.type, linkedProjects: linked.projects };
      });
  }, [companies, contacts, items, kind, projects, query, tasks]);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold text-slate-950">{kind === 'people' ? 'People directory' : 'Company directory'}</div>
          <div className="text-xs text-slate-600">Direct and inferred project relationships are shown side-by-side.</div>
        </div>
        <input className="field-input max-w-56" placeholder={`Search ${kind}`} value={query} onChange={(event) => setQuery(event.target.value)} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        {records.map((record) => (
          <div key={record.id} className="rounded-xl border border-slate-200 p-3">
            <button className="font-semibold text-slate-900" onClick={() => onOpenDirectoryRecord(kind === 'people' ? 'contact' : 'company', record.id)}>{record.name}</button>
            <div className="text-xs text-slate-600">{record.subtitle}</div>
            <div className="mt-2 text-xs text-slate-600">Linked projects: {record.linkedProjects.length === 0 ? '—' : record.linkedProjects.map((project) => project.name).join(', ')}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
