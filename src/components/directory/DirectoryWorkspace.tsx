import { useDirectoryViewModel, PROJECT_STATUS_OPTIONS } from '../../domains/directory/hooks/useDirectoryViewModel';
import { CompaniesDirectoryPane } from './CompaniesDirectoryPane';
import { DirectoryProjectsPane } from './DirectoryProjectsPane';
import { PeopleDirectoryPane } from './PeopleDirectoryPane';
import { ProjectCreateModal } from './ProjectCreateModal';
import { ProjectDeleteModal } from './ProjectDeleteModal';
import { AppShellCard, SectionHeader, SegmentedControl, WorkspacePage } from '../ui/AppPrimitives';

interface DirectoryWorkspaceProps {
  onOpenFollowUp: (recordId: string) => void;
  onOpenTask: (recordId: string) => void;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function DirectoryWorkspace({ onOpenFollowUp, onOpenTask, onOpenDirectoryRecord }: DirectoryWorkspaceProps) {
  const vm = useDirectoryViewModel();
  const tabOptions = [
    { value: 'projects', label: 'Projects' },
    { value: 'people', label: 'People' },
    { value: 'companies', label: 'Companies' },
  ] as const;

  return (
    <WorkspacePage>
      <AppShellCard className="workspace-summary-strip directory-summary-strip" surface="hero">
        <SectionHeader
          title="Directory"
          subtitle="Master context for projects, people, and companies."
          compact
          actions={<SegmentedControl value={vm.tab} onChange={(value) => vm.setTab(value as typeof vm.tab)} options={tabOptions.map((option) => ({ value: option.value, label: option.label }))} />}
        />
        <div className="directory-summary-note">
          Keep project records, key contacts, and company relationships current so triage and execution surfaces stay accurate.
        </div>
      </AppShellCard>

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
    </WorkspacePage>
  );
}
