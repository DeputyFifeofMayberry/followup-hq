import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { applyProjectFilters, applyProjectSort, buildProjectDerivedRecords, defaultProjectFilters, type ProjectDerivedRecord, type ProjectFilterState } from '../../../lib/projectSelectors';
import { useAppStore } from '../../../store/useAppStore';
import type { DirectoryRecordType, DirectoryTab, ProjectRecord, ProjectSortKey, ProjectStatus } from '../../../types';
import { normalizeProjectInput, validateProjectIdentity } from '../../projects/validation';

export type ProjectDetailTab = 'profile' | 'operational';
export type ProjectWorkspaceMode = 'directory' | 'operational';
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

export function deriveProjectSelection(rows: ProjectDerivedRecord[], visibleRows: ProjectDerivedRecord[], selectedProjectId: string): {
  selectedRow: ProjectDerivedRecord | null;
  selectedVisible: boolean;
} {
  const selectedRow = selectedProjectId ? rows.find((row) => row.project.id === selectedProjectId) ?? null : null;
  const selectedVisible = selectedProjectId ? visibleRows.some((row) => row.project.id === selectedProjectId) : false;
  return { selectedRow, selectedVisible };
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

  const [projectWorkspaceMode, setProjectWorkspaceMode] = useState<ProjectWorkspaceMode>('directory');
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
    setDirectoryWorkspaceSession({ activeTab: nextTab });
  };

  const setSelectedRecord = (recordType: DirectoryRecordType, recordId: string | null) => {
    setDirectoryWorkspaceSession({
      selectedRecordType: recordType,
      selectedRecordId: recordId,
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

  const directoryRows = useMemo(() => applyProjectSort(displayRows, sortKey, sortDirection), [displayRows, sortKey, sortDirection]);
  const operationalRows = useMemo(() => {
    const ordered = [...displayRows].sort((a, b) => {
      const pressureA = a.overdueFollowUpCount + a.overdueTaskCount + a.blockedTaskCount;
      const pressureB = b.overdueFollowUpCount + b.overdueTaskCount + b.blockedTaskCount;
      if (pressureB !== pressureA) return pressureB - pressureA;
      if (b.health.score !== a.health.score) return b.health.score - a.health.score;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
    return ordered;
  }, [displayRows]);

  const visibleRows = projectWorkspaceMode === 'directory' ? directoryRows : operationalRows;
  const selectedProject = selectedProjectId ? projects.find((project) => project.id === selectedProjectId) ?? null : null;

  const { selectedRow, selectedVisible } = useMemo(
    () => deriveProjectSelection(rows, visibleRows, selectedProjectId),
    [rows, visibleRows, selectedProjectId],
  );

  useEffect(() => {
    if (!rows.length) {
      if (selectedProjectId) setSelectedRecord('project', null);
      return;
    }
    if (!selectedProjectId || !projects.some((project) => project.id === selectedProjectId)) {
      const fallback = visibleRows[0]?.project.id ?? rows[0]?.project.id;
      if (fallback) setSelectedProjectId(fallback);
    }
  }, [projects, rows, selectedProjectId, visibleRows]);

  useEffect(() => {
    if (!selectedRow || editing) return;
    setDraft(selectedRow.project);
  }, [selectedRow, editing]);

  useEffect(() => {
    if (projectWorkspaceMode === 'directory' && detailTab === 'operational') {
      setDetailTab('profile');
    }
    if (projectWorkspaceMode === 'operational' && detailTab === 'profile' && !editing) {
      setDetailTab('operational');
    }
  }, [projectWorkspaceMode, detailTab, editing]);

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
    projectWorkspaceMode,
    setProjectWorkspaceMode,
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
    selectedProjectVisible: selectedVisible,
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
    visibleRows,
    directoryRows,
    operationalRows,
    selectedRow,
    saveCreate,
    saveDraft,
    updateProject,
    requestDeleteProject,
    confirmDeleteProject,
    isUnclassifiedProject,
  };
}
