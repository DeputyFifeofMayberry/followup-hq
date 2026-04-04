import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../../../store/useAppStore';

export function useProjectsViewModel() {
  return useAppStore(useShallow((s) => ({
    projects: s.projects,
    items: s.items,
    tasks: s.tasks,
    contacts: s.contacts,
    companies: s.companies,
    intakeDocuments: s.intakeDocuments,
    updateProject: s.updateProject,
    addProject: s.addProject,
    deleteProject: s.deleteProject,
  })));
}
