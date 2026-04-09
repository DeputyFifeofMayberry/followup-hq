import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../store/useAppStore';
import { ContactCreateModal } from './ContactCreateModal';
import { ContactProfilePanel } from './ContactProfilePanel';

interface PeopleDirectoryPaneProps {
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function PeopleDirectoryPane({ onOpenDirectoryRecord }: PeopleDirectoryPaneProps) {
  const { contacts, addContact, updateContact } = useAppStore(useShallow((s) => ({ contacts: s.contacts, addContact: s.addContact, updateContact: s.updateContact })));
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState('');

  const rows = useMemo(() => contacts.filter((contact) => contact.name.toLowerCase().includes(query.trim().toLowerCase())), [contacts, query]);
  const selected = rows.find((row) => row.id === selectedId) ?? rows[0] ?? null;

  return (
    <div className="grid gap-4 xl:grid-cols-[1.2fr,1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <input className="field-input max-w-64" placeholder="Search contacts" value={query} onChange={(event) => setQuery(event.target.value)} />
          <button className="primary-btn" onClick={() => setShowCreate(true)}>New contact</button>
        </div>
        <div className="space-y-2">
          {rows.map((contact) => (
            <button key={contact.id} className={selected?.id === contact.id ? 'w-full rounded border border-slate-300 bg-slate-50 px-3 py-2 text-left' : 'w-full rounded border border-slate-200 px-3 py-2 text-left'} onClick={() => setSelectedId(contact.id)}>
              <div className="font-medium">{contact.name}</div>
              <div className="text-xs text-slate-600">{contact.role || 'Contact'}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <ContactProfilePanel contact={selected} onOpenProject={(id) => onOpenDirectoryRecord('project', id)} />
        {selected ? (
          <div className="mt-3 flex gap-2">
            <button className="action-btn" onClick={() => updateContact(selected.id, { active: selected.active === false ? true : false })}>{selected.active === false ? 'Mark active' : 'Archive'}</button>
          </div>
        ) : null}
      </section>
      <ContactCreateModal
        open={showCreate}
        name={newName}
        role={newRole}
        onNameChange={setNewName}
        onRoleChange={setNewRole}
        onClose={() => setShowCreate(false)}
        onCreate={() => {
          const name = newName.trim();
          if (!name) return;
          const id = addContact({ name, role: newRole.trim(), notes: '', tags: [], active: true });
          setSelectedId(id);
          setShowCreate(false);
          setNewName('');
          setNewRole('');
        }}
      />
    </div>
  );
}
