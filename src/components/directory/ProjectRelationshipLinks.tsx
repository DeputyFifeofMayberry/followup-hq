import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import type { CompanyRecord, ContactRecord, ProjectRecord } from '../../types';

interface ProjectRelationshipLinksProps {
  project: ProjectRecord;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

function LinkSection<T extends ContactRecord | CompanyRecord>({
  title,
  direct,
  inferred,
  query,
  setQuery,
  newName,
  setNewName,
  candidates,
  onLink,
  onUnlink,
  onCreate,
  onOpen,
}: {
  title: string;
  direct: T[];
  inferred: T[];
  query: string;
  setQuery: (value: string) => void;
  newName: string;
  setNewName: (value: string) => void;
  candidates: T[];
  onLink: (id: string) => void;
  onUnlink: (id: string) => void;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
      {direct.length === 0 ? <div className="mb-2 text-xs text-slate-500">No direct links yet.</div> : (
        <div className="mb-2 space-y-1">
          {direct.map((record) => (
            <div key={record.id} className="flex items-center justify-between rounded border border-slate-200 px-2 py-1 text-xs">
              <button className="text-left font-medium" onClick={() => onOpen(record.id)}>{record.name}</button>
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">Direct link</span>
                <button className="text-rose-700" onClick={() => onUnlink(record.id)}>Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {inferred.map((record) => (
        <div key={record.id} className="mb-1 flex items-center justify-between rounded border border-slate-100 px-2 py-1 text-xs text-slate-600">
          <button className="text-left" onClick={() => onOpen(record.id)}>{record.name}</button>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]">Referenced by work items</span>
        </div>
      ))}
      <input className="field-input mt-2" placeholder={`Search ${title.toLowerCase()}`} value={query} onChange={(event) => setQuery(event.target.value)} />
      <div className="mt-1 max-h-24 overflow-auto rounded border border-slate-200 p-1">
        {candidates.slice(0, 8).map((record) => <button key={record.id} className="mb-1 w-full rounded border border-slate-200 px-2 py-1 text-left text-xs" onClick={() => onLink(record.id)}>{record.name}</button>)}
        {candidates.length === 0 ? <div className="text-xs text-slate-500">No matches.</div> : null}
      </div>
      <div className="mt-1 flex gap-2">
        <input className="field-input" placeholder={`Create ${title.slice(0, -1).toLowerCase()}`} value={newName} onChange={(event) => setNewName(event.target.value)} />
        <button className="action-btn" onClick={onCreate}>Create</button>
      </div>
    </div>
  );
}

export function ProjectRelationshipLinks({ project, onOpenDirectoryRecord }: ProjectRelationshipLinksProps) {
  const {
    contacts, companies, items, tasks,
    linkContactToProject, unlinkContactFromProject, linkCompanyToProject, unlinkCompanyFromProject,
    addContact, addCompany,
  } = useAppStore(useShallow((s) => ({
    contacts: s.contacts,
    companies: s.companies,
    items: s.items,
    tasks: s.tasks,
    linkContactToProject: s.linkContactToProject,
    unlinkContactFromProject: s.unlinkContactFromProject,
    linkCompanyToProject: s.linkCompanyToProject,
    unlinkCompanyFromProject: s.unlinkCompanyFromProject,
    addContact: s.addContact,
    addCompany: s.addCompany,
  })));

  const [contactQuery, setContactQuery] = useState('');
  const [companyQuery, setCompanyQuery] = useState('');
  const [newContactName, setNewContactName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  const directContactIds = new Set(project.linkedContactIds ?? []);
  const directCompanyIds = new Set(project.linkedCompanyIds ?? []);

  const inferredContactIds = useMemo(() => new Set([
    ...items.filter((item) => item.projectId === project.id && item.contactId).map((item) => item.contactId as string),
    ...tasks.filter((task) => task.projectId === project.id && task.contactId).map((task) => task.contactId as string),
  ]), [items, tasks, project.id]);

  const inferredCompanyIds = useMemo(() => new Set([
    ...items.filter((item) => item.projectId === project.id && item.companyId).map((item) => item.companyId as string),
    ...tasks.filter((task) => task.projectId === project.id && task.companyId).map((task) => task.companyId as string),
  ]), [items, tasks, project.id]);

  const directContacts = contacts.filter((contact) => directContactIds.has(contact.id));
  const inferredContacts = contacts.filter((contact) => !directContactIds.has(contact.id) && inferredContactIds.has(contact.id));
  const directCompanies = companies.filter((company) => directCompanyIds.has(company.id));
  const inferredCompanies = companies.filter((company) => !directCompanyIds.has(company.id) && inferredCompanyIds.has(company.id));

  const contactCandidates = contacts.filter((contact) =>
    contact.name.toLowerCase().includes(contactQuery.trim().toLowerCase()) && !directContactIds.has(contact.id));
  const companyCandidates = companies.filter((company) =>
    company.name.toLowerCase().includes(companyQuery.trim().toLowerCase()) && !directCompanyIds.has(company.id));

  const createAndLinkContact = () => {
    const name = newContactName.trim();
    if (!name) return;
    const id = addContact({ name, role: 'Project contact', notes: '', tags: [], active: true });
    linkContactToProject(project.id, id);
    setNewContactName('');
  };

  const createAndLinkCompany = () => {
    const name = newCompanyName.trim();
    if (!name) return;
    const id = addCompany({ name, type: 'Other', notes: '', tags: [], active: true });
    linkCompanyToProject(project.id, id);
    setNewCompanyName('');
  };

  return (
    <div className="grid gap-2 md:grid-cols-2">
      <LinkSection
        title="Linked contacts"
        direct={directContacts}
        inferred={inferredContacts}
        query={contactQuery}
        setQuery={setContactQuery}
        newName={newContactName}
        setNewName={setNewContactName}
        candidates={contactCandidates}
        onLink={(id) => linkContactToProject(project.id, id)}
        onUnlink={(id) => unlinkContactFromProject(project.id, id)}
        onCreate={createAndLinkContact}
        onOpen={(id) => onOpenDirectoryRecord('contact', id)}
      />
      <LinkSection
        title="Linked companies"
        direct={directCompanies}
        inferred={inferredCompanies}
        query={companyQuery}
        setQuery={setCompanyQuery}
        newName={newCompanyName}
        setNewName={setNewCompanyName}
        candidates={companyCandidates}
        onLink={(id) => linkCompanyToProject(project.id, id)}
        onUnlink={(id) => unlinkCompanyFromProject(project.id, id)}
        onCreate={createAndLinkCompany}
        onOpen={(id) => onOpenDirectoryRecord('company', id)}
      />
    </div>
  );
}
