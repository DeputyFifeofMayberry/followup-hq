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
