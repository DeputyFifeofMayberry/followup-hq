import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyProjectFilters, applyProjectSort, buildProjectDerivedRecords, defaultProjectFilters, type ProjectFilterState } from '../../../lib/projectSelectors';
import { useAppStore } from '../../../store/useAppStore';
import type { DirectoryRecordType, DirectoryTab, ProjectRecord, ProjectSortKey, ProjectStatus } from '../../../types';
import { normalizeProjectInput, validateProjectIdentity } from '../../projects/validation';
import { directoryRecordTypeByTab, directoryTabByRecordType } from '../session';

export type ProjectDetailTab = 'profile' | 'operational';
export type ProjectViewMode = 'directory' | 'operational';
export type ProjectDraft = Omit<ProjectRecord, 'id' | 'createdAt' | 'updatedAt'>;

export const PROJECT_STATUS_OPTIONS: ProjectStatus[] = ['Active', 'On hold', 'Closeout', 'Complete'];

export const blankProjectDraft: ProjectDraft = {
  name: '', aliases: [], code: '', contractReference: '', clientOrg: '', ownerOrg: '', owner: 'Unassigned', superintendent: '', leadAssignee: '',
  phase: '', status: 'Active', targetCompletionDate: '', nextMilestone: '', nextMilestoneDate: '', riskSummary: '', currentBlocker: '', closeoutReadiness: 0,
  projectNextAction: '', location: '', facility: '', building: '', lastReviewedAt: '', notes: '', tags: [], archived: false,
};

export function isUnclassifiedProject(project: ProjectRecord): boolean {
  return project.systemProjectKind === 'unclassified' || project.name.trim().toLowerCase() === 'general';
}

export function toDelimitedArray(value: string): string[] {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

export function splitLocationValue(value: string): Pick<ProjectDraft, 'location' | 'facility' | 'building'> {
  const [location, facility, building] = value.split('/').map((entry) => entry.trim());
  return { location: location || '', facility: facility || '', building: building || '' };
}

export function useDirectoryViewModel() {
  const {
    projects, items, tasks, contacts, companies, intakeDocuments,
    addProject, updateProject, deleteProject,
    directorySession,
    setDirectoryWorkspaceSession,
  } = useAppStore(useShallow((s) => ({
    projects: s.projects,
    items: s.items,
    tasks: s.tasks,
    contacts: s.contacts,
    companies: s.companies,
    intakeDocuments: s.intakeDocuments,
    addProject: s.addProject,
    updateProject: s.updateProject,
    deleteProject: s.deleteProject,
    directorySession: s.directoryWorkspaceSession,
    setDirectoryWorkspaceSession: s.setDirectoryWorkspaceSession,
  })));

  const [projectViewMode, setProjectViewMode] = useState<ProjectViewMode>('directory');
  const [projectFilters, setProjectFilters] = useState<ProjectFilterState>(defaultProjectFilters);
  const [archivedFilter, setArchivedFilter] = useState<'active' | 'archived' | 'all'>('active');
  const [sortKey, setSortKey] = useState<ProjectSortKey>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createDraft, setCreateDraft] = useState<ProjectDraft>(blankProjectDraft);
  const [createErrors, setCreateErrors] = useState<string[]>([]);
  const [detailTab, setDetailTab] = useState<ProjectDetailTab>('profile');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);
  const [saveErrors, setSaveErrors] = useState<string[]>([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const tab = directorySession.activeTab;
  const selectedProjectId = directorySession.selectedByType.project ?? '';

  const setTab = (nextTab: DirectoryTab) => {
    const nextType = directoryRecordTypeByTab[nextTab];
    setDirectoryWorkspaceSession({
      activeTab: nextTab,
      selectedRecordType: nextType,
      selectedRecordId: directorySession.selectedByType[nextType],
    });
  };

  const setSelectedRecord = (recordType: DirectoryRecordType, recordId: string | null) => {
    setDirectoryWorkspaceSession({
      activeTab: directoryTabByRecordType[recordType],
      selectedRecordType: recordType,
      selectedRecordId: recordId,
      selectedByType: {
        ...directorySession.selectedByType,
        [recordType]: recordId,
      },
    });
  };

  const setSelectedProjectId = (projectId: string) => setSelectedRecord('project', projectId);

  const rows = useMemo(() => buildProjectDerivedRecords(projects, items, tasks, intakeDocuments, contacts, companies), [projects, items, tasks, intakeDocuments, contacts, companies]);
  const filteredRows = useMemo(() => applyProjectFilters(rows, projectFilters), [rows, projectFilters]);
  const displayRows = useMemo(() => {
    const activeRows = filteredRows.filter((row) => !row.project.archived);
    const archivedRows = filteredRows.filter((row) => !!row.project.archived);
    if (archivedFilter === 'active') return activeRows;
    if (archivedFilter === 'archived') return archivedRows;
    return filteredRows;
  }, [archivedFilter, filteredRows]);
  const sortedRows = useMemo(() => applyProjectSort(displayRows, sortKey, sortDirection), [displayRows, sortKey, sortDirection]);

  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) ?? null : null;
  const selectedProjectVisible = selectedProjectId ? sortedRows.some((row) => row.project.id === selectedProjectId) : false;

  useEffect(() => {
    if (!sortedRows.length) {
      if (selectedProjectId) setSelectedRecord('project', null);
      return;
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectId(sortedRows[0].project.id);
    }
  }, [projects, selectedProjectId, setDirectoryWorkspaceSession, sortedRows]);

  const selectedRow = sortedRows.find((row) => row.project.id === selectedProjectId) ?? null;

  useEffect(() => {
    if (!selectedRow || editing) return;
    setDraft(selectedRow.project);
  }, [selectedRow, editing]);

  const validateCreate = () => {
    const normalized = normalizeProjectInput(createDraft);
    const validation = validateProjectIdentity({ name: normalized.name, code: normalized.code }, projects);
    setCreateErrors(validation.errors);
    if (validation.errors.length > 0) return null;
    return normalized;
  };

  const validateSave = () => {
    if (!selectedRow || !draft) return null;
    const validation = validateProjectIdentity({ name: draft.name, code: draft.code }, projects, selectedRow.project.id);
    setSaveErrors(validation.errors);
    if (validation.errors.length > 0) return null;
    return normalizeProjectInput(draft);
  };

  const saveCreate = () => {
    const normalized = validateCreate();
    if (!normalized) return;
    const id = addProject({ ...createDraft, ...normalized });
    setSelectedProjectId(id);
    setShowCreateModal(false);
    setCreateDraft(blankProjectDraft);
    setCreateErrors([]);
  };

  const saveDraft = () => {
    if (!selectedRow || !draft) return;
    const normalized = validateSave();
    if (!normalized) return;
    updateProject(selectedRow.project.id, { ...draft, ...normalized });
    setEditing(false);
    setSaveErrors([]);
  };

  const requestDeleteProject = () => {
    if (!selectedRow) return;
    const fallback = projects.find((project) => project.systemProjectKind === 'unclassified' && project.id !== selectedRow.project.id)
      ?? projects.find((project) => project.id !== selectedRow.project.id);
    setDeleteTargetId(fallback?.id ?? '');
    setDeleteConfirm(false);
    setDeleteModalOpen(true);
  };

  const confirmDeleteProject = () => {
    if (!selectedRow || !deleteTargetId) return;
    deleteProject(selectedRow.project.id, deleteTargetId);
    setDeleteModalOpen(false);
    setDeleteConfirm(false);
  };

  return {
    projects,
    items,
    tasks,
    contacts,
    companies,
    intakeDocuments,
    tab,
    setTab,
    projectViewMode,
    setProjectViewMode,
    projectFilters,
    setProjectFilters,
    archivedFilter,
    setArchivedFilter,
    sortKey,
    setSortKey,
    sortDirection,
    setSortDirection,
    selectedProjectId,
    setSelectedProjectId,
    selectedProject,
    selectedProjectVisible,
    selectedRecordType: directorySession.selectedRecordType,
    selectedRecordId: directorySession.selectedRecordId,
    setSelectedRecord,
    showCreateModal,
    setShowCreateModal,
    createDraft,
    setCreateDraft,
    createErrors,
    detailTab,
    setDetailTab,
    editing,
    setEditing,
    draft,
    setDraft,
    saveErrors,
    deleteModalOpen,
    setDeleteModalOpen,
    deleteTargetId,
    setDeleteTargetId,
    deleteConfirm,
    setDeleteConfirm,
    rows,
    sortedRows,
    selectedRow,
    saveCreate,
    saveDraft,
    updateProject,
    requestDeleteProject,
    confirmDeleteProject,
    isUnclassifiedProject,
  };
}
