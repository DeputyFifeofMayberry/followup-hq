import type { CompanyRecord, ContactRecord, ProjectRecord } from '../types';

export function normalizeIdentity(value?: string): string {
  return (value || '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function mergeAliases(existing: string[] = [], additions: Array<string | undefined>): string[] {
  const set = new Set(existing.map(normalizeIdentity).filter(Boolean));
  for (const entry of additions) {
    const norm = normalizeIdentity(entry);
    if (norm) set.add(norm);
  }
  return [...set];
}

export function findProjectByAlias(projects: ProjectRecord[], value?: string): ProjectRecord | undefined {
  const needle = normalizeIdentity(value);
  if (!needle) return undefined;
  return projects.find((project) => normalizeIdentity(project.name) === needle || (project.aliases || []).includes(needle));
}

export function findCompanyByAlias(companies: CompanyRecord[], value?: string): CompanyRecord | undefined {
  const needle = normalizeIdentity(value);
  if (!needle) return undefined;
  return companies.find((company) => normalizeIdentity(company.name) === needle || (company.aliases || []).includes(needle));
}

export function findContactByAlias(contacts: ContactRecord[], input: { name?: string; email?: string }): ContactRecord | undefined {
  const emailNeedle = normalizeIdentity(input.email);
  if (emailNeedle) {
    const byEmail = contacts.find((contact) => normalizeIdentity(contact.email) === emailNeedle || (contact.aliases || []).includes(emailNeedle));
    if (byEmail) return byEmail;
  }
  const nameNeedle = normalizeIdentity(input.name);
  if (!nameNeedle) return undefined;
  return contacts.find((contact) => normalizeIdentity(contact.name) === nameNeedle || (contact.aliases || []).includes(nameNeedle));
}
