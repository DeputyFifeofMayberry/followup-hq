import { describe, expect, it } from 'vitest';
import { defaultDirectoryWorkspaceSession, mergeDirectoryWorkspaceSession } from './session';

describe('directory session merge', () => {
  it('keeps active tab, selected type, and selected id aligned', () => {
    const next = mergeDirectoryWorkspaceSession(defaultDirectoryWorkspaceSession, {
      selectedRecordType: 'company',
      selectedRecordId: 'CO-101',
    });

    expect(next.activeTab).toBe('companies');
    expect(next.selectedRecordType).toBe('company');
    expect(next.selectedRecordId).toBe('CO-101');
    expect(next.selectedByType.company).toBe('CO-101');
  });

  it('switches tabs by restoring the record selection for that tab type', () => {
    const seeded = mergeDirectoryWorkspaceSession(defaultDirectoryWorkspaceSession, {
      selectedByType: { contact: 'CT-12', project: 'PR-1', company: 'CO-8' },
    });

    const next = mergeDirectoryWorkspaceSession(seeded, { activeTab: 'people' });

    expect(next.activeTab).toBe('people');
    expect(next.selectedRecordType).toBe('contact');
    expect(next.selectedRecordId).toBe('CT-12');
  });
});
