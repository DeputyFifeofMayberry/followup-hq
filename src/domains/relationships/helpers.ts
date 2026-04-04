import type { CompanyRecord, ContactRecord } from '../../types';

export function normalizeContact(contact: ContactRecord): ContactRecord {
  return {
    ...contact,
    name: (contact.name || '').trim(),
    email: contact.email?.trim() || undefined,
    phone: contact.phone?.trim() || undefined,
    companyId: contact.companyId || undefined,
    role: (contact.role || 'External').trim() || 'External',
    title: contact.title?.trim() || undefined,
    department: contact.department?.trim() || undefined,
    preferredCommunicationMethod: contact.preferredCommunicationMethod || undefined,
    internalOwner: contact.internalOwner?.trim() || undefined,
    responsivenessRating: contact.responsivenessRating || undefined,
    relationshipStatus: contact.relationshipStatus || 'Active',
    lastContactedAt: contact.lastContactedAt || undefined,
    lastResponseAt: contact.lastResponseAt || undefined,
    escalationNotes: contact.escalationNotes?.trim() || undefined,
    riskTier: contact.riskTier || 'Low',
    active: contact.active ?? true,
    notes: (contact.notes || '').trim(),
    completionNote: contact.completionNote || undefined,
    tags: [...new Set((contact.tags || []).map((tag) => tag.trim()).filter(Boolean))],
  };
}

export function normalizeCompany(company: CompanyRecord): CompanyRecord {
  return {
    ...company,
    name: (company.name || '').trim(),
    type: company.type || 'Other',
    primaryContactId: company.primaryContactId || undefined,
    internalOwner: company.internalOwner?.trim() || undefined,
    relationshipStatus: company.relationshipStatus || 'Active',
    responsivenessRating: company.responsivenessRating || undefined,
    riskTier: company.riskTier || 'Low',
    activeProjectCountCache: company.activeProjectCountCache || undefined,
    lastReviewedAt: company.lastReviewedAt || undefined,
    escalationNotes: company.escalationNotes?.trim() || undefined,
    active: company.active ?? true,
    notes: (company.notes || '').trim(),
    completionNote: company.completionNote || undefined,
    tags: [...new Set((company.tags || []).map((tag) => tag.trim()).filter(Boolean))],
  };
}
