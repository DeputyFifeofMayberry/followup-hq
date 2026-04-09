import type { ProjectFilterState } from '../../lib/projectSelectors';
import type { ProjectSortKey } from '../../types';
import { PROJECT_STATUS_OPTIONS } from '../../domains/directory/hooks/useDirectoryViewModel';
import { ProjectDirectoryTable } from './ProjectDirectoryTable';
import { ProjectOperationalCards } from './ProjectOperationalCards';
import { ProjectProfilePanel } from './ProjectProfilePanel';
import { StatePanel } from '../ui/AppPrimitives';

interface DirectoryProjectsPaneProps {
  vm: any;
  onOpenFollowUp: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function DirectoryProjectsPane({ vm, onOpenFollowUp, onOpenTask, onOpenDirectoryRecord }: DirectoryProjectsPaneProps) {
  const sortedRows = vm.sortedRows;
  return (
    <div className="grid gap-4 xl:grid-cols-[1.6fr,1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button className="primary-btn" onClick={() => vm.setShowCreateModal(true)}>New Project</button>
          <select className="field-input max-w-44" value={vm.projectViewMode} onChange={(event) => vm.setProjectViewMode(event.target.value)}><option value="directory">Directory view</option><option value="operational">Operational pressure view</option></select>
          <select className="field-input max-w-44" value={vm.archivedFilter} onChange={(event) => vm.setArchivedFilter(event.target.value)}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">Active + archived</option></select>
          <input className="field-input max-w-56" placeholder="Search projects" value={vm.projectFilters.query} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, query: event.target.value }))} />
          <select className="field-input max-w-44" value={vm.projectFilters.status} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, status: event.target.value }))}><option value="All">All status</option>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
          <select className="field-input max-w-44" value={vm.projectFilters.owner} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, owner: event.target.value }))}><option value="All">All owners</option>{[...new Set(vm.projects.map((project: any) => project.owner))].filter(Boolean).map((owner) => <option key={owner}>{owner}</option>)}</select>
          <select className="field-input max-w-44" value={vm.sortKey} onChange={(event) => vm.setSortKey(event.target.value as ProjectSortKey)}><option value="name">Sort: name</option><option value="updated">Sort: last activity</option><option value="targetDate">Sort: target completion</option><option value="overdueWork">Sort: overdue work</option><option value="health">Sort: health</option></select>
          <button className="action-btn" onClick={() => vm.setSortDirection((prev: 'asc' | 'desc') => prev === 'asc' ? 'desc' : 'asc')}>Order: {vm.sortDirection === 'asc' ? 'Ascending' : 'Descending'}</button>
        </div>
        {sortedRows.length === 0 ? <StatePanel tone="empty" title={vm.projects.length === 0 ? 'No projects yet' : 'No matching projects'} message={vm.projects.length === 0 ? 'Create your first project to start building the directory.' : 'Try adjusting search, status, owner, or archive filters.'} /> : vm.projectViewMode === 'directory' ? <ProjectDirectoryTable rows={sortedRows} selectedProjectId={vm.selectedProjectId} onSelectProject={vm.setSelectedProjectId} /> : <ProjectOperationalCards rows={sortedRows} onSelectProject={vm.setSelectedProjectId} />}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        {!vm.selectedRow ? <StatePanel tone="empty" title="Select a project" message="Choose a project to review its profile and operational context." /> : (
          <ProjectProfilePanel
            selectedRow={vm.selectedRow}
            editing={vm.editing}
            draft={vm.draft}
            detailTab={vm.detailTab}
            saveErrors={vm.saveErrors}
            onSetEditing={vm.setEditing}
            onDraftChange={vm.setDraft}
            onSaveDraft={vm.saveDraft}
            onSetDetailTab={vm.setDetailTab}
            onArchiveToggle={() => vm.updateProject(vm.selectedRow.project.id, { archived: !vm.selectedRow.project.archived })}
            onDelete={vm.requestDeleteProject}
            onOpenFollowUp={onOpenFollowUp}
            onOpenTask={onOpenTask}
            onOpenDirectoryRecord={onOpenDirectoryRecord}
          />
        )}
      </section>
    </div>
  );
}
