import { describe, expect, it } from 'vitest';
import { buildContactDraft, derivePeopleSelection, toContactPatch } from './usePeopleDirectoryViewModel';
import type { ContactRecord } from '../../../types';

function contact(overrides: Partial<ContactRecord>): ContactRecord {
  return {
    id: 'CT-1',
    name: 'Alex Rivera',
    role: 'Estimator',
    notes: '',
    tags: [],
    active: true,
    ...overrides,
  };
}

describe('usePeopleDirectoryViewModel helpers', () => {
  it('builds a complete draft from a contact record', () => {
    const draft = buildContactDraft(contact({
      aliases: ['A. Rivera'],
      email: 'alex@example.com',
      relationshipStatus: 'Watch',
      riskTier: 'High',
      responsivenessRating: 3,
      lastContactedAt: '2026-04-01T12:00:00.000Z',
    }));

    expect(draft.aliases).toBe('A. Rivera');
    expect(draft.email).toBe('alex@example.com');
    expect(draft.relationshipStatus).toBe('Watch');
    expect(draft.riskTier).toBe('High');
    expect(draft.responsivenessRating).toBe(3);
    expect(draft.lastContactedAt).toBe('2026-04-01');
  });

  it('normalizes save payload with trimmed and transformed values', () => {
    const payload = toContactPatch({
      ...buildContactDraft(null),
      name: '  Taylor Kim  ',
      aliases: 'TK,  Ops lead ',
      tags: 'priority, west',
      lastContactedAt: '2026-04-09',
    });

    expect(payload.name).toBe('Taylor Kim');
    expect(payload.aliases).toEqual(['TK', 'Ops lead']);
    expect(payload.tags).toEqual(['priority', 'west']);
    expect(payload.lastContactedAt?.startsWith('2026-04-09')).toBe(true);
  });

  it('keeps selected contact anchored even when filtered out', () => {
    const contacts = [contact({ id: 'CT-1', name: 'A' }), contact({ id: 'CT-2', name: 'B' })];
    const rows = [contacts[0]];
    const selection = derivePeopleSelection(rows, 'contact', 'CT-2', contacts);

    expect(selection.selectedContact?.id).toBe('CT-2');
    expect(selection.selectedVisible).toBe(false);
    expect(selection.fallbackContact?.id).toBe('CT-1');
  });
});
