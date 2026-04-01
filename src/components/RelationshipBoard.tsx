import { Building2, Pencil, PlusCircle, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildCompanySummary, buildContactSummary, buildOwnerSummary } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

export function RelationshipBoard() {
  const { items, contacts, companies, addContact, addCompany, updateContact, updateCompany, deleteContact, deleteCompany } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    addContact: s.addContact,
    addCompany: s.addCompany,
    updateContact: s.updateContact,
    updateCompany: s.updateCompany,
    deleteContact: s.deleteContact,
    deleteCompany: s.deleteCompany,
  })));
  const contactSummary = useMemo(() => buildContactSummary(items, contacts, companies), [items, contacts, companies]);
  const companySummary = useMemo(() => buildCompanySummary(items, companies), [items, companies]);
  const ownerSummary = useMemo(() => buildOwnerSummary(items), [items]);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<'Government' | 'Owner' | 'Vendor' | 'Subcontractor' | 'Consultant' | 'Internal' | 'Other'>('Vendor');
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Relationships and ownership</h2>
        <p className="mt-1 text-sm text-slate-500">Manage people and companies, then see exactly where waiting, overdue work, and nudge pressure are stacking up.</p>
      </div>
      <div className="grid gap-6 p-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Internal ownership load</div>
            <div className="space-y-2">
              {ownerSummary.map((owner) => (
                <div key={owner.owner} className="rounded-2xl border border-slate-200 p-3 text-sm">
                  <div className="font-medium text-slate-900">{owner.owner}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <div>Active: {owner.activeCount}</div>
                    <div>Waiting: {owner.waitingCount}</div>
                    <div>Overdue: {owner.overdueCount}</div>
                    <div>Needs nudge: {owner.needsNudgeCount}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4" />Contacts</div>
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
              <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Add contact name" className="field-input" />
              <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email" className="field-input" />
              <button onClick={() => { if (!contactName.trim()) return; addContact({ name: contactName.trim(), email: contactEmail.trim(), role: 'External', notes: '', tags: [] }); setContactName(''); setContactEmail(''); }} className="primary-btn"><PlusCircle className="h-4 w-4" />Add</button>
            </div>
            <div className="mt-3 space-y-2">
              {contactSummary.map((contact) => {
                const full = contacts.find((entry) => entry.id === contact.id);
                if (!full) return null;
                const waitingItems = items.filter((item) => item.contactId === full.id && item.waitingOn);
                const editing = editingContactId === full.id;
                return (
                  <div key={contact.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{full.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{full.email || 'No email'} • {full.role}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingContactId(editing ? null : full.id)} className="action-btn"><Pencil className="h-4 w-4" />{editing ? 'Done' : 'Edit'}</button>
                        <button onClick={() => { if (window.confirm('Delete this contact? Linked items will keep working but lose the contact link.')) deleteContact(full.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <div>Waiting: {contact.waitingCount}</div>
                      <div>Overdue: {contact.overdueCount}</div>
                      <div>Touch age: {contact.averageTouchAge}d</div>
                    </div>
                    {waitingItems.length > 0 ? <div className="mt-2 text-xs text-slate-500">Waiting on: {waitingItems.map((item) => item.title).slice(0, 2).join(' • ')}</div> : null}
                    {editing ? (
                      <div className="mt-3 grid gap-2">
                        <input value={full.name} onChange={(e) => updateContact(full.id, { name: e.target.value })} className="field-input" placeholder="Name" />
                        <input value={full.email ?? ''} onChange={(e) => updateContact(full.id, { email: e.target.value })} className="field-input" placeholder="Email" />
                        <input value={full.role} onChange={(e) => updateContact(full.id, { role: e.target.value })} className="field-input" placeholder="Role" />
                        <textarea value={full.notes} onChange={(e) => updateContact(full.id, { notes: e.target.value })} className="field-textarea" placeholder="Notes" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Building2 className="h-4 w-4" />Companies</div>
            <div className="grid gap-2 sm:grid-cols-[1.2fr_1fr_auto]">
              <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Add company name" className="field-input" />
              <select value={companyType} onChange={(e) => setCompanyType(e.target.value as typeof companyType)} className="field-input">
                <option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option>
              </select>
              <button onClick={() => { if (!companyName.trim()) return; addCompany({ name: companyName.trim(), type: companyType, notes: '', tags: [] }); setCompanyName(''); }} className="primary-btn"><PlusCircle className="h-4 w-4" />Add</button>
            </div>
            <div className="mt-3 space-y-2">
              {companySummary.map((company) => {
                const full = companies.find((entry) => entry.id === company.id);
                if (!full) return null;
                const waitingItems = items.filter((item) => item.companyId === full.id && item.waitingOn);
                const editing = editingCompanyId === full.id;
                return (
                  <div key={company.id} className="rounded-2xl border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{full.name}</div>
                        <div className="mt-1 text-xs text-slate-500">{full.type}</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setEditingCompanyId(editing ? null : full.id)} className="action-btn"><Pencil className="h-4 w-4" />{editing ? 'Done' : 'Edit'}</button>
                        <button onClick={() => { if (window.confirm('Delete this company? Linked records will keep working but lose the company link.')) deleteCompany(full.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-slate-600">
                      <div>Waiting: {company.waitingCount}</div>
                      <div>Overdue: {company.overdueCount}</div>
                      <div>Touch age: {company.averageTouchAge}d</div>
                    </div>
                    {waitingItems.length > 0 ? <div className="mt-2 text-xs text-slate-500">Holding up: {waitingItems.map((item) => item.title).slice(0, 2).join(' • ')}</div> : null}
                    {editing ? (
                      <div className="mt-3 grid gap-2">
                        <input value={full.name} onChange={(e) => updateCompany(full.id, { name: e.target.value })} className="field-input" placeholder="Company" />
                        <select value={full.type} onChange={(e) => updateCompany(full.id, { type: e.target.value as typeof full.type })} className="field-input">
                          <option>Government</option><option>Owner</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Internal</option><option>Other</option>
                        </select>
                        <textarea value={full.notes} onChange={(e) => updateCompany(full.id, { notes: e.target.value })} className="field-textarea" placeholder="Notes" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
