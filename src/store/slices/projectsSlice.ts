import { createId, todayIso, resolveProjectName, normalizeItem } from '../../lib/utils';
import { attachProjects } from '../../domains/followups/helpers';
import { normalizeTask } from '../../domains/tasks/helpers';
import { normalizeProjectRecord, stampProject } from '../../domains/projects/helpers';
import { normalizeProjectInput, validateProjectIdentity } from '../../domains/projects/validation';
import { enforceFollowUpIntegrity, enforceTaskIntegrity } from '../../domains/records/integrity';
import type { IntakeDocumentRecord } from '../../types';
import type { AppStore, AppStoreActions } from '../types';
import type { SliceContext, SliceSet } from './types';

export function createProjectsSlice(set: SliceSet, { queuePersist }: SliceContext): Pick<AppStoreActions,
  'addProject' | 'updateProject' | 'linkContactToProject' | 'unlinkContactFromProject' | 'linkCompanyToProject' | 'unlinkCompanyFromProject' | 'reassignProjectRecords' | 'deleteProject' | 'addIntakeDocument' | 'updateIntakeDocument' | 'setIntakeDocumentDisposition' | 'deleteIntakeDocument'
> {
  return {
    addProject: (input) => {
      const id = createId('PRJ');
      set((state: AppStore) => {
        const normalized = normalizeProjectInput(input);
        const validation = validateProjectIdentity({ name: normalized.name, code: normalized.code }, state.projects);
        if (validation.errors.length > 0) return state;
        return {
          projects: [...state.projects, normalizeProjectRecord({
            id,
            ...input,
            ...normalized,
            systemProjectKind: input.systemProjectKind,
            linkedContactIds: input.linkedContactIds ?? [],
            linkedCompanyIds: input.linkedCompanyIds ?? [],
            createdAt: todayIso(),
            updatedAt: todayIso(),
          })].sort((a, b) => a.name.localeCompare(b.name)),
        };
      });
      queuePersist();
      return id;
    },
    updateProject: (id, patch) => {
      set((state: AppStore) => {
        const original = state.projects.find((project) => project.id === id);
        if (!original) return state;
        const nextName = (patch.name ?? original.name).trim();
        const nextCode = (patch.code ?? original.code ?? '').trim() || undefined;
        const validation = validateProjectIdentity({ name: nextName, code: nextCode }, state.projects, id);
        if (validation.errors.length > 0) return state;
        const projects = state.projects.map((project) => (project.id === id
          ? normalizeProjectRecord(stampProject(project, {
            ...patch,
            name: nextName,
            code: nextCode,
            owner: (patch.owner ?? project.owner).trim() || 'Unassigned',
            notes: (patch.notes ?? project.notes).trim(),
            aliases: patch.aliases ? patch.aliases.map((entry) => entry.trim()).filter(Boolean) : project.aliases,
            tags: patch.tags ? patch.tags.map((entry) => entry.trim()).filter(Boolean) : project.tags,
            linkedContactIds: patch.linkedContactIds ?? project.linkedContactIds ?? [],
            linkedCompanyIds: patch.linkedCompanyIds ?? project.linkedCompanyIds ?? [],
          }))
          : project));
        const renamedTo = projects.find((project) => project.id === id)?.name ?? original.name ?? 'General';
        const items = patch.name && patch.name !== original.name
          ? attachProjects(state.items.map((item) => item.projectId === id ? normalizeItem({ ...item, project: renamedTo }) : item), projects)
          : attachProjects(state.items, projects);
        const tasks = state.tasks.map((task) => task.projectId === id ? normalizeTask({ ...task, project: renamedTo }) : task);
        const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, project: renamedTo } : doc);
        return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, tasks, intakeDocuments };
      });
      queuePersist();
    },
    linkContactToProject: (projectId, contactId) => {
      set((state: AppStore) => ({
        projects: state.projects.map((project) => project.id !== projectId
          ? project
          : stampProject(project, { linkedContactIds: [...new Set([...(project.linkedContactIds ?? []), contactId])] })),
      }));
      queuePersist();
    },
    unlinkContactFromProject: (projectId, contactId) => {
      set((state: AppStore) => ({
        projects: state.projects.map((project) => project.id !== projectId
          ? project
          : stampProject(project, { linkedContactIds: (project.linkedContactIds ?? []).filter((id) => id !== contactId) })),
      }));
      queuePersist();
    },
    linkCompanyToProject: (projectId, companyId) => {
      set((state: AppStore) => ({
        projects: state.projects.map((project) => project.id !== projectId
          ? project
          : stampProject(project, { linkedCompanyIds: [...new Set([...(project.linkedCompanyIds ?? []), companyId])] })),
      }));
      queuePersist();
    },
    unlinkCompanyFromProject: (projectId, companyId) => {
      set((state: AppStore) => ({
        projects: state.projects.map((project) => project.id !== projectId
          ? project
          : stampProject(project, { linkedCompanyIds: (project.linkedCompanyIds ?? []).filter((id) => id !== companyId) })),
      }));
      queuePersist();
    },
    reassignProjectRecords: (fromProjectId, toProjectId, recordTypes = ['followups', 'tasks', 'docs']) => { set((state: AppStore) => { if (fromProjectId === toProjectId) return state; const target = state.projects.find((project) => project.id === toProjectId); if (!target) return state; const typeSet = new Set(recordTypes); const items = typeSet.has('followups') ? attachProjects(state.items.map((item) => item.projectId === fromProjectId ? normalizeItem({ ...item, projectId: target.id, project: target.name }) : item), state.projects) : state.items; const tasks = typeSet.has('tasks') ? state.tasks.map((task) => task.projectId === fromProjectId ? normalizeTask({ ...task, projectId: target.id, project: target.name }) : task) : state.tasks; const intakeDocuments = typeSet.has('docs') ? state.intakeDocuments.map((doc) => doc.projectId === fromProjectId ? { ...doc, projectId: target.id, project: target.name } : doc) : state.intakeDocuments; return { items, tasks, intakeDocuments }; }); queuePersist(); },
    deleteProject: (id, reassignToProjectId) => {
      set((state: AppStore) => {
        const sourceProject = state.projects.find((project) => project.id === id);
        if (!sourceProject) return state;
        if (sourceProject.systemProjectKind === 'unclassified') return state;
        if (state.projects.length <= 1) return state;
        const targetProject = state.projects.find((project) => project.id === reassignToProjectId && project.id !== id);
        if (!targetProject) return state;
        const projects = state.projects.filter((project) => project.id !== id);
        const items = attachProjects(state.items.map((item) => item.projectId === id ? enforceFollowUpIntegrity(normalizeItem({ ...item, projectId: targetProject.id, project: targetProject.name }), projects) : item), projects);
        const tasks = state.tasks.map((task) => task.projectId === id ? enforceTaskIntegrity(normalizeTask({ ...task, projectId: targetProject.id, project: targetProject.name }), projects) : task);
        const intakeDocuments = state.intakeDocuments.map((doc) => doc.projectId === id ? { ...doc, projectId: targetProject.id, project: targetProject.name } : doc);
        return { projects: projects.sort((a, b) => a.name.localeCompare(b.name)), items, tasks, intakeDocuments };
      });
      queuePersist();
    },
    addIntakeDocument: (input) => { const id = createId('DOC'); set((state: AppStore) => { const project = input.projectId ? state.projects.find((entry) => entry.id === input.projectId) : state.projects.find((entry) => entry.name.toLowerCase() === (input.project ?? '').toLowerCase()); const record: IntakeDocumentRecord = { id, name: input.name, kind: input.kind, disposition: 'Unprocessed', projectId: project?.id ?? input.projectId, project: project?.name ?? input.project ?? 'General', owner: input.owner ?? project?.owner ?? 'Unassigned', sourceRef: input.sourceRef ?? 'Uploaded to intake', uploadedAt: todayIso(), notes: input.notes ?? '', tags: input.tags ?? [] }; return { intakeDocuments: [record, ...state.intakeDocuments] }; }); queuePersist(); return id; },
    updateIntakeDocument: (id, patch) => { set((state: AppStore) => ({ intakeDocuments: state.intakeDocuments.map((doc) => doc.id !== id ? doc : { ...doc, ...patch, project: resolveProjectName(patch.projectId, patch.project, state.projects) }) })); queuePersist(); },
    setIntakeDocumentDisposition: (id, disposition, linkedFollowUpId) => { set((state: AppStore) => ({ intakeDocuments: state.intakeDocuments.map((doc) => doc.id === id ? { ...doc, disposition, linkedFollowUpId: linkedFollowUpId ?? doc.linkedFollowUpId } : doc) })); queuePersist(); },
    deleteIntakeDocument: (id) => { set((state: AppStore) => ({ intakeDocuments: state.intakeDocuments.filter((doc) => doc.id !== id) })); queuePersist(); },
  };
}
