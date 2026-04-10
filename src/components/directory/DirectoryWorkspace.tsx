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
          subtitle="Master context for projects, people, and companies across daily execution."
          compact
          actions={<SegmentedControl value={vm.tab} onChange={(value) => vm.setTab(value as typeof vm.tab)} options={tabOptions.map((option) => ({ value: option.value, label: option.label }))} />}
        />
        <div className="directory-summary-note">Keep master records clean so commitments, execution, and reporting stay reliable.</div>
      </AppShellCard>

      <div className="support-workspace-shell">
        <div>
          {vm.tab === 'projects' ? <DirectoryProjectsPane vm={vm} onOpenFollowUp={onOpenFollowUp} onOpenTask={onOpenTask} onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}
          {vm.tab === 'people' ? <PeopleDirectoryPane onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}
          {vm.tab === 'companies' ? <CompaniesDirectoryPane onOpenDirectoryRecord={onOpenDirectoryRecord} /> : null}
        </div>
        <aside className="support-layout-card support-layout-card-quiet">
          <h3 className="text-sm font-semibold text-slate-900">Directory operating guidance</h3>
          <p className="mt-1 text-xs text-slate-600">Keep master records clean and linked so execution queues stay trustworthy. Project health, contact ownership, and company context should support follow-up and task flow—not compete with it.</p>
        </aside>
      </div>

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
