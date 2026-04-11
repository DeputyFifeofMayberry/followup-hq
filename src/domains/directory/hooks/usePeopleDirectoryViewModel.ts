import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';
import { fromDateInputValue, toDateInputValue } from '../../../lib/utils';
import type { CompanyRecord, ContactRecord } from '../../../types';

export const CONTACT_RELATIONSHIP_STATUS_OPTIONS: Array<NonNullable<ContactRecord['relationshipStatus']>> = ['Active', 'Watch', 'Escalated', 'Dormant'];
export const CONTACT_RISK_TIER_OPTIONS: Array<NonNullable<ContactRecord['riskTier']>> = ['Low', 'Medium', 'High', 'Critical'];
export const CONTACT_COMMUNICATION_OPTIONS: Array<NonNullable<ContactRecord['preferredCommunicationMethod']>> = ['Email', 'Phone', 'Text', 'Teams', 'In person', 'Other'];
export const CONTACT_RESPONSIVENESS_OPTIONS: Array<NonNullable<ContactRecord['responsivenessRating']>> = [1, 2, 3, 4, 5];

export interface ContactDraft {
  name: string;
  aliases: string;
  email: string;
  phone: string;
  companyId: string;
  role: string;
  title: string;
  department: string;
  preferredCommunicationMethod: '' | NonNullable<ContactRecord['preferredCommunicationMethod']>;
  internalOwner: string;
  responsivenessRating: '' | NonNullable<ContactRecord['responsivenessRating']>;
  relationshipStatus: NonNullable<ContactRecord['relationshipStatus']>;
  riskTier: NonNullable<ContactRecord['riskTier']>;
  lastContactedAt: string;
  lastResponseAt: string;
  escalationNotes: string;
  active: boolean;
  notes: string;
  tags: string;
}

export function toDelimitedArray(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function buildContactDraft(contact?: ContactRecord | null): ContactDraft {
  if (!contact) {
    return {
      name: '',
      aliases: '',
      email: '',
      phone: '',
      companyId: '',
      role: '',
      title: '',
      department: '',
      preferredCommunicationMethod: '',
      internalOwner: '',
      responsivenessRating: '',
      relationshipStatus: 'Active',
      riskTier: 'Low',
      lastContactedAt: '',
      lastResponseAt: '',
      escalationNotes: '',
      active: true,
      notes: '',
      tags: '',
    };
  }

  return {
    name: contact.name || '',
    aliases: (contact.aliases ?? []).join(', '),
    email: contact.email || '',
    phone: contact.phone || '',
    companyId: contact.companyId || '',
    role: contact.role || '',
    title: contact.title || '',
    department: contact.department || '',
    preferredCommunicationMethod: contact.preferredCommunicationMethod || '',
    internalOwner: contact.internalOwner || '',
    responsivenessRating: contact.responsivenessRating || '',
    relationshipStatus: contact.relationshipStatus || 'Active',
    riskTier: contact.riskTier || 'Low',
    lastContactedAt: toDateInputValue(contact.lastContactedAt),
    lastResponseAt: toDateInputValue(contact.lastResponseAt),
    escalationNotes: contact.escalationNotes || '',
    active: contact.active !== false,
    notes: contact.notes || '',
    tags: (contact.tags ?? []).join(', '),
  };
}

export function toContactPatch(draft: ContactDraft): Omit<ContactRecord, 'id'> {
  return {
    name: draft.name.trim(),
    aliases: toDelimitedArray(draft.aliases),
    email: draft.email.trim() || undefined,
    phone: draft.phone.trim() || undefined,
    companyId: draft.companyId || undefined,
    role: draft.role.trim(),
    title: draft.title.trim() || undefined,
    department: draft.department.trim() || undefined,
    preferredCommunicationMethod: draft.preferredCommunicationMethod || undefined,
    internalOwner: draft.internalOwner.trim() || undefined,
    responsivenessRating: draft.responsivenessRating || undefined,
    relationshipStatus: draft.relationshipStatus,
    riskTier: draft.riskTier,
    lastContactedAt: draft.lastContactedAt ? fromDateInputValue(draft.lastContactedAt) : undefined,
    lastResponseAt: draft.lastResponseAt ? fromDateInputValue(draft.lastResponseAt) : undefined,
    escalationNotes: draft.escalationNotes.trim() || undefined,
    active: draft.active,
    notes: draft.notes,
    tags: toDelimitedArray(draft.tags),
  };
}

export function derivePeopleSelection(rows: ContactRecord[], selectedRecordType: 'project' | 'contact' | 'company', selectedRecordId: string | null, contacts: ContactRecord[]) {
  const selectedId = selectedRecordType === 'contact' ? selectedRecordId : null;
  const selectedContact = selectedId ? contacts.find((contact) => contact.id === selectedId) ?? null : null;
  const selectedVisible = selectedId ? rows.some((row) => row.id === selectedId) : false;
  const fallbackContact = rows[0] ?? null;
  return {
    selectedId,
    selectedContact,
    selectedVisible,
    fallbackContact,
  };
}

interface UsePeopleDirectoryViewModelProps {
  selectedRecordType: 'project' | 'contact' | 'company';
  selectedRecordId: string | null;
  setSelectedRecord: (recordType: 'project' | 'contact' | 'company', recordId: string | null) => void;
}

export function usePeopleDirectoryViewModel({ selectedRecordType, selectedRecordId, setSelectedRecord }: UsePeopleDirectoryViewModelProps) {
  const { contacts, companies, addContact, updateContact, deleteContact } = useAppStore(useShallow((state) => ({
    contacts: state.contacts,
    companies: state.companies,
    addContact: state.addContact,
    updateContact: state.updateContact,
    deleteContact: state.deleteContact,
  })));

  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (!showArchived && contact.active === false) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        contact.name,
        contact.email,
        contact.phone,
        contact.role,
        contact.title,
        contact.department,
        ...(contact.aliases ?? []),
        ...(contact.tags ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [contacts, query, showArchived]);

  const selection = derivePeopleSelection(rows, selectedRecordType, selectedRecordId, contacts);

  useEffect(() => {
    if (!rows.length) {
      if (selection.selectedId) setSelectedRecord('contact', null);
      return;
    }

    if (!selection.selectedId || !selection.selectedContact) {
      setSelectedRecord('contact', rows[0].id);
    }
  }, [rows, selection.selectedId, selection.selectedContact, setSelectedRecord]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(buildContactDraft(null));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraft(buildContactDraft(selection.selectedContact));
  }, [editing, selection.selectedContact]);

  const beginEdit = () => {
    if (!selection.selectedContact) return;
    setDraft(buildContactDraft(selection.selectedContact));
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(buildContactDraft(selection.selectedContact));
    setSaveError(null);
    setEditing(false);
  };

  const saveEdit = () => {
    if (!selection.selectedContact) return;
    if (!draft.name.trim()) {
      setSaveError('Contact name is required.');
      return;
    }
    updateContact(selection.selectedContact.id, toContactPatch(draft));
    setSaveError(null);
    setEditing(false);
  };

  const archiveToggle = () => {
    if (!selection.selectedContact) return;
    updateContact(selection.selectedContact.id, { active: selection.selectedContact.active === false });
  };

  const removeSelectedContact = () => {
    if (!selection.selectedContact) return;
    const next = rows.find((row) => row.id !== selection.selectedContact?.id) ?? contacts.find((row) => row.id !== selection.selectedContact?.id) ?? null;
    deleteContact(selection.selectedContact.id);
    setSelectedRecord('contact', next?.id ?? null);
    setEditing(false);
  };

  const createContact = (draftInput: ContactDraft) => {
    if (!draftInput.name.trim()) {
      return { ok: false as const, error: 'Contact name is required.' };
    }
    const createdId = addContact(toContactPatch(draftInput));
    setSelectedRecord('contact', createdId);
    setShowCreate(false);
    setQuery('');
    setShowArchived(true);
    return { ok: true as const, id: createdId };
  };

  return {
    contacts,
    companies,
    query,
    setQuery,
    showArchived,
    setShowArchived,
    rows,
    selectedContact: selection.selectedContact,
    selectedVisible: selection.selectedVisible,
    fallbackContact: selection.fallbackContact,
    setSelectedRecord,
    showCreate,
    setShowCreate,
    editing,
    beginEdit,
    cancelEdit,
    saveEdit,
    draft,
    setDraft,
    saveError,
    archiveToggle,
    removeSelectedContact,
    createContact,
  };
}

export function companyNameById(companies: CompanyRecord[], companyId?: string): string {
  if (!companyId) return 'No company linked';
  return companies.find((company) => company.id === companyId)?.name || 'Unknown company';
}
