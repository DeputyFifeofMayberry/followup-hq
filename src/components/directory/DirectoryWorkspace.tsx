import { useDirectoryViewModel, PROJECT_STATUS_OPTIONS } from '../../domains/directory/hooks/useDirectoryViewModel';
import { CompaniesDirectoryPane } from './CompaniesDirectoryPane';
import { DirectoryProjectsPane } from './DirectoryProjectsPane';
import { PeopleDirectoryPane } from './PeopleDirectoryPane';
import { ProjectCreateModal } from './ProjectCreateModal';
import { ProjectDeleteModal } from './ProjectDeleteModal';

interface DirectoryWorkspaceProps {
  onOpenFollowUp: (recordId: string) => void;
  onOpenTask: (recordId: string) => void;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function DirectoryWorkspace({ onOpenFollowUp, onOpenTask, onOpenDirectoryRecord }: DirectoryWorkspaceProps) {
  const vm = useDirectoryViewModel();

  return (
    <div className="workspace-page">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-950">Directory</h2>
          <p className="text-sm text-slate-600">Master data for projects, people, and companies. Operational pressure is available as secondary context.</p>
        </div>
        <div className="flex gap-2">
          {(['projects', 'people', 'companies'] as const).map((tab) => (
            <button key={tab} className={vm.tab === tab ? 'primary-btn' : 'action-btn'} onClick={() => vm.setTab(tab)}>{tab[0].toUpperCase()}{tab.slice(1)}</button>
          ))}
        </div>
      </div>

      {vm.tab === 'projects' ? <DirectoryProjectsPane vm={vm} onOpenFollowUp={onOpenFollowUp} onOpenTask={onOpenTask} onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}
      {vm.tab === 'people' ? <PeopleDirectoryPane onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}
      {vm.tab === 'companies' ? <CompaniesDirectoryPane onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}

      <ProjectCreateModal
        open={vm.showCreateModal}
        draft={vm.createDraft}
        errors={vm.createErrors}
        statusOptions={PROJECT_STATUS_OPTIONS}
        onDraftChange={vm.setCreateDraft}
        onClose={() => vm.setShowCreateModal(false)}
        onSave={vm.saveCreate}
      />

      <ProjectDeleteModal
        open={vm.deleteModalOpen}
        project={vm.selectedRow?.project ?? null}
        projects={vm.projects}
        followUpCount={vm.items.filter((item) => item.projectId === vm.selectedRow?.project.id).length}
        taskCount={vm.tasks.filter((task) => task.projectId === vm.selectedRow?.project.id).length}
        docCount={vm.intakeDocuments.filter((doc) => doc.projectId === vm.selectedRow?.project.id).length}
        deleteTargetId={vm.deleteTargetId}
        deleteConfirm={vm.deleteConfirm}
        onDeleteTargetChange={vm.setDeleteTargetId}
        onDeleteConfirmChange={vm.setDeleteConfirm}
        onClose={() => vm.setDeleteModalOpen(false)}
        onDelete={vm.confirmDeleteProject}
      />
    </div>
  );
}
