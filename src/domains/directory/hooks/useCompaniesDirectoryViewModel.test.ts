import { describe, expect, it } from 'vitest';
import { buildCompanyDraft, deriveCompaniesSelection, toCompanyPatch } from './useCompaniesDirectoryViewModel';
import type { CompanyRecord } from '../../../types';

function company(overrides: Partial<CompanyRecord>): CompanyRecord {
  return {
    id: 'CO-1',
    name: 'Northstar Partners',
    type: 'Vendor',
    notes: '',
    tags: [],
    active: true,
    ...overrides,
  };
}

describe('useCompaniesDirectoryViewModel helpers', () => {
  it('builds a complete draft from a company record', () => {
    const draft = buildCompanyDraft(company({
      aliases: ['NSP'],
      relationshipStatus: 'Watch',
      riskTier: 'High',
      responsivenessRating: 2,
      lastReviewedAt: '2026-04-03T12:00:00.000Z',
      activeProjectCountCache: 4,
    }));

    expect(draft.aliases).toBe('NSP');
    expect(draft.relationshipStatus).toBe('Watch');
    expect(draft.riskTier).toBe('High');
    expect(draft.responsivenessRating).toBe(2);
    expect(draft.lastReviewedAt).toBe('2026-04-03');
    expect(draft.activeProjectCountCache).toBe('4');
  });

  it('normalizes save payload with trimmed and transformed values', () => {
    const payload = toCompanyPatch({
      ...buildCompanyDraft(null),
      name: '  Summit Group  ',
      aliases: 'SG,  Summit ',
      tags: 'strategic, west',
      activeProjectCountCache: ' 8 ',
      lastReviewedAt: '2026-04-09',
    });

    expect(payload.name).toBe('Summit Group');
    expect(payload.aliases).toEqual(['SG', 'Summit']);
    expect(payload.tags).toEqual(['strategic', 'west']);
    expect(payload.activeProjectCountCache).toBe(8);
    expect(payload.lastReviewedAt?.startsWith('2026-04-09')).toBe(true);
  });

  it('keeps selected company anchored even when filtered out', () => {
    const companies = [company({ id: 'CO-1', name: 'A' }), company({ id: 'CO-2', name: 'B' })];
    const rows = [companies[0]];
    const selection = deriveCompaniesSelection(rows, 'company', 'CO-2', companies);

    expect(selection.selectedCompany?.id).toBe('CO-2');
    expect(selection.selectedVisible).toBe(false);
    expect(selection.fallbackCompany?.id).toBe('CO-1');
  });
});
