import type { DirectoryRecordType, DirectoryTab, DirectoryWorkspaceSession } from '../../types';

export const directoryTabByRecordType: Record<DirectoryRecordType, DirectoryTab> = {
  project: 'projects',
  contact: 'people',
  company: 'companies',
};

export const directoryRecordTypeByTab: Record<DirectoryTab, DirectoryRecordType> = {
  projects: 'project',
  people: 'contact',
  companies: 'company',
};

export const defaultDirectoryWorkspaceSession: DirectoryWorkspaceSession = {
  activeTab: 'projects',
  selectedRecordType: 'project',
  selectedRecordId: null,
  selectedByType: {
    project: null,
    contact: null,
    company: null,
  },
};

export function mergeDirectoryWorkspaceSession(
  current: DirectoryWorkspaceSession,
  patch: Partial<DirectoryWorkspaceSession>,
): DirectoryWorkspaceSession {
  const mergedByType = {
    ...current.selectedByType,
    ...(patch.selectedByType ?? {}),
  };

  const selectedRecordType = patch.selectedRecordType
    ?? (patch.activeTab ? directoryRecordTypeByTab[patch.activeTab] : current.selectedRecordType);

  const selectedRecordId = patch.selectedRecordId !== undefined
    ? patch.selectedRecordId
    : mergedByType[selectedRecordType] ?? null;

  mergedByType[selectedRecordType] = selectedRecordId;

  return {
    activeTab: directoryTabByRecordType[selectedRecordType],
    selectedRecordType,
    selectedRecordId,
    selectedByType: mergedByType,
  };
}
