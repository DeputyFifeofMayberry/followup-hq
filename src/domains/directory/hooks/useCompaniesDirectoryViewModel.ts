import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { fromDateInputValue, toDateInputValue } from '../../../lib/utils';
import { useAppStore } from '../../../store/useAppStore';
import type { CompanyRecord, CompanyType } from '../../../types';
import { toDelimitedArray } from './usePeopleDirectoryViewModel';

export const COMPANY_TYPE_OPTIONS: CompanyType[] = ['Government', 'Owner', 'Vendor', 'Subcontractor', 'Consultant', 'Internal', 'Other'];
export const COMPANY_RELATIONSHIP_STATUS_OPTIONS: Array<NonNullable<CompanyRecord['relationshipStatus']>> = ['Active', 'Watch', 'Escalated', 'Dormant'];
export const COMPANY_RISK_TIER_OPTIONS: Array<NonNullable<CompanyRecord['riskTier']>> = ['Low', 'Medium', 'High', 'Critical'];
export const COMPANY_RESPONSIVENESS_OPTIONS: Array<NonNullable<CompanyRecord['responsivenessRating']>> = [1, 2, 3, 4, 5];

export interface CompanyDraft {
  name: string;
  aliases: string;
  type: CompanyType;
  primaryContactId: string;
  internalOwner: string;
  relationshipStatus: NonNullable<CompanyRecord['relationshipStatus']>;
  responsivenessRating: '' | NonNullable<CompanyRecord['responsivenessRating']>;
  riskTier: NonNullable<CompanyRecord['riskTier']>;
  activeProjectCountCache: string;
  lastReviewedAt: string;
  escalationNotes: string;
  active: boolean;
  notes: string;
  tags: string;
}

export function buildCompanyDraft(company?: CompanyRecord | null): CompanyDraft {
  if (!company) {
    return {
      name: '',
      aliases: '',
      type: 'Other',
      primaryContactId: '',
      internalOwner: '',
      relationshipStatus: 'Active',
      responsivenessRating: '',
      riskTier: 'Low',
      activeProjectCountCache: '',
      lastReviewedAt: '',
      escalationNotes: '',
      active: true,
      notes: '',
      tags: '',
    };
  }

  return {
    name: company.name || '',
    aliases: (company.aliases ?? []).join(', '),
    type: company.type || 'Other',
    primaryContactId: company.primaryContactId || '',
    internalOwner: company.internalOwner || '',
    relationshipStatus: company.relationshipStatus || 'Active',
    responsivenessRating: company.responsivenessRating || '',
    riskTier: company.riskTier || 'Low',
    activeProjectCountCache: company.activeProjectCountCache ? String(company.activeProjectCountCache) : '',
    lastReviewedAt: toDateInputValue(company.lastReviewedAt),
    escalationNotes: company.escalationNotes || '',
    active: company.active !== false,
    notes: company.notes || '',
    tags: (company.tags ?? []).join(', '),
  };
}

export function toCompanyPatch(draft: CompanyDraft): Omit<CompanyRecord, 'id'> {
  const numericProjectCount = draft.activeProjectCountCache.trim();
  return {
    name: draft.name.trim(),
    aliases: toDelimitedArray(draft.aliases),
    type: draft.type,
    primaryContactId: draft.primaryContactId || undefined,
    internalOwner: draft.internalOwner.trim() || undefined,
    relationshipStatus: draft.relationshipStatus,
    responsivenessRating: draft.responsivenessRating || undefined,
    riskTier: draft.riskTier,
    activeProjectCountCache: numericProjectCount ? Number(numericProjectCount) : undefined,
    lastReviewedAt: draft.lastReviewedAt ? fromDateInputValue(draft.lastReviewedAt) : undefined,
    escalationNotes: draft.escalationNotes.trim() || undefined,
    active: draft.active,
    notes: draft.notes,
    tags: toDelimitedArray(draft.tags),
  };
}

export function deriveCompaniesSelection(rows: CompanyRecord[], selectedRecordType: 'project' | 'contact' | 'company', selectedRecordId: string | null, companies: CompanyRecord[]) {
  const selectedId = selectedRecordType === 'company' ? selectedRecordId : null;
  const selectedCompany = selectedId ? companies.find((company) => company.id === selectedId) ?? null : null;
  const selectedVisible = selectedId ? rows.some((row) => row.id === selectedId) : false;
  const fallbackCompany = rows[0] ?? null;
  return {
    selectedId,
    selectedCompany,
    selectedVisible,
    fallbackCompany,
  };
}

interface UseCompaniesDirectoryViewModelProps {
  selectedRecordType: 'project' | 'contact' | 'company';
  selectedRecordId: string | null;
  setSelectedRecord: (recordType: 'project' | 'contact' | 'company', recordId: string | null) => void;
}

export function useCompaniesDirectoryViewModel({ selectedRecordType, selectedRecordId, setSelectedRecord }: UseCompaniesDirectoryViewModelProps) {
  const { companies, contacts, addCompany, updateCompany, deleteCompany } = useAppStore(useShallow((state) => ({
    companies: state.companies,
    contacts: state.contacts,
    addCompany: state.addCompany,
    updateCompany: state.updateCompany,
    deleteCompany: state.deleteCompany,
  })));

  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return companies.filter((company) => {
      if (!showArchived && company.active === false) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        company.name,
        company.type,
        company.internalOwner,
        company.relationshipStatus,
        company.escalationNotes,
        ...(company.aliases ?? []),
        ...(company.tags ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(normalizedQuery);
    });
  }, [companies, query, showArchived]);

  const selection = deriveCompaniesSelection(rows, selectedRecordType, selectedRecordId, companies);

  useEffect(() => {
    if (!rows.length) {
      if (selection.selectedId) setSelectedRecord('company', null);
      return;
    }

    if (!selection.selectedId || !selection.selectedCompany) {
      setSelectedRecord('company', rows[0].id);
    }
  }, [rows, selection.selectedCompany, selection.selectedId, setSelectedRecord]);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<CompanyDraft>(buildCompanyDraft(null));
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setDraft(buildCompanyDraft(selection.selectedCompany));
  }, [editing, selection.selectedCompany]);

  const beginEdit = () => {
    if (!selection.selectedCompany) return;
    setDraft(buildCompanyDraft(selection.selectedCompany));
    setSaveError(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setDraft(buildCompanyDraft(selection.selectedCompany));
    setSaveError(null);
    setEditing(false);
  };

  const saveEdit = () => {
    if (!selection.selectedCompany) return;
    if (!draft.name.trim()) {
      setSaveError('Company name is required.');
      return;
    }
    if (draft.activeProjectCountCache.trim() && Number.isNaN(Number(draft.activeProjectCountCache.trim()))) {
      setSaveError('Active project count must be a number.');
      return;
    }
    updateCompany(selection.selectedCompany.id, toCompanyPatch(draft));
    setSaveError(null);
    setEditing(false);
  };

  const archiveToggle = () => {
    if (!selection.selectedCompany) return;
    updateCompany(selection.selectedCompany.id, { active: selection.selectedCompany.active === false });
  };

  const removeSelectedCompany = () => {
    if (!selection.selectedCompany) return;
    const next = rows.find((row) => row.id !== selection.selectedCompany?.id) ?? companies.find((row) => row.id !== selection.selectedCompany?.id) ?? null;
    deleteCompany(selection.selectedCompany.id);
    setSelectedRecord('company', next?.id ?? null);
    setEditing(false);
  };

  const createCompany = (draftInput: CompanyDraft) => {
    if (!draftInput.name.trim()) {
      return { ok: false as const, error: 'Company name is required.' };
    }
    if (draftInput.activeProjectCountCache.trim() && Number.isNaN(Number(draftInput.activeProjectCountCache.trim()))) {
      return { ok: false as const, error: 'Active project count must be a number.' };
    }
    const createdId = addCompany(toCompanyPatch(draftInput));
    setSelectedRecord('company', createdId);
    setShowCreate(false);
    setQuery('');
    setShowArchived(true);
    return { ok: true as const, id: createdId };
  };

  return {
    companies,
    contacts,
    query,
    setQuery,
    showArchived,
    setShowArchived,
    rows,
    selectedCompany: selection.selectedCompany,
    selectedVisible: selection.selectedVisible,
    fallbackCompany: selection.fallbackCompany,
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
    removeSelectedCompany,
    createCompany,
  };
}
