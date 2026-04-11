import type { ProjectFilterState } from '../../lib/projectSelectors';
import type { ProjectSortKey } from '../../types';
import { PROJECT_STATUS_OPTIONS } from '../../domains/directory/hooks/useDirectoryViewModel';
import { ProjectDirectoryTable } from './ProjectDirectoryTable';
import { ProjectOperationalCards } from './ProjectOperationalCards';
import { ProjectProfilePanel } from './ProjectProfilePanel';
import { SegmentedControl, StatePanel } from '../ui/AppPrimitives';

interface DirectoryProjectsPaneProps {
  vm: any;
  onOpenFollowUp: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
}

export function DirectoryProjectsPane({ vm, onOpenFollowUp, onOpenTask, onOpenDirectoryRecord }: DirectoryProjectsPaneProps) {
  const rows = vm.visibleRows;
  const modeOptions = [
    { value: 'directory', label: 'Project Directory' },
    { value: 'operational', label: 'Operational Context' },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.45fr,1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 space-y-3 border-b border-slate-200 pb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Projects workspace</div>
              <div className="text-xs text-slate-600">
                {vm.projectWorkspaceMode === 'directory'
                  ? 'Maintain project master records and relationship quality.'
                  : 'Review project pressure and route directly into execution queues.'}
              </div>
            </div>
            <button className="primary-btn" onClick={() => vm.setShowCreateModal(true)}>New Project</button>
          </div>

          <SegmentedControl value={vm.projectWorkspaceMode} onChange={(value) => vm.setProjectWorkspaceMode(value as typeof vm.projectWorkspaceMode)} options={modeOptions} />

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <input className="field-input" placeholder="Search name, code, owner, milestone" value={vm.projectFilters.query} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, query: event.target.value }))} />
            <select className="field-input" value={vm.projectFilters.status} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, status: event.target.value }))}><option value="All">All status</option>{PROJECT_STATUS_OPTIONS.map((status) => <option key={status}>{status}</option>)}</select>
            <select className="field-input" value={vm.projectFilters.owner} onChange={(event) => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, owner: event.target.value }))}><option value="All">All owners</option>{[...new Set(vm.projects.map((project: any) => project.owner))].filter(Boolean).map((owner) => <option key={String(owner)}>{String(owner)}</option>)}</select>
            <select className="field-input" value={vm.archivedFilter} onChange={(event) => vm.setArchivedFilter(event.target.value)}><option value="active">Active only</option><option value="archived">Archived only</option><option value="all">Active + archived</option></select>
          </div>

          <details className="rounded-xl border border-slate-200 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-slate-500">Sorting controls</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              <select className="field-input max-w-52" value={vm.sortKey} onChange={(event) => vm.setSortKey(event.target.value as ProjectSortKey)}><option value="name">Sort: name</option><option value="updated">Sort: last activity</option><option value="targetDate">Sort: target completion</option><option value="overdueWork">Sort: overdue work</option><option value="health">Sort: health</option></select>
              <button className="action-btn" onClick={() => vm.setSortDirection((prev: 'asc' | 'desc') => prev === 'asc' ? 'desc' : 'asc')}>Order: {vm.sortDirection === 'asc' ? 'Ascending' : 'Descending'}</button>
            </div>
          </details>
        </div>

        {vm.selectedProject && !vm.selectedProjectVisible ? (
          <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Selected project <span className="font-semibold">{vm.selectedProject.name}</span> is hidden by current filters.
            <button
              className="ml-2 font-semibold underline"
              onClick={() => vm.setProjectFilters((prev: ProjectFilterState) => ({ ...prev, query: '', owner: 'All', status: 'All' }))}
            >
              Clear search + owner + status
            </button>
          </div>
        ) : null}

        {rows.length === 0 ? <StatePanel tone="empty" title={vm.projects.length === 0 ? 'No projects yet' : 'No matching projects'} message={vm.projects.length === 0 ? 'Create your first project to start building the directory.' : 'Adjust search, status, owner, or archive filters to see projects.'} /> : vm.projectWorkspaceMode === 'directory' ? <ProjectDirectoryTable rows={rows} selectedProjectId={vm.selectedProjectId} onSelectProject={vm.setSelectedProjectId} /> : <ProjectOperationalCards rows={rows} selectedProjectId={vm.selectedProjectId} onSelectProject={vm.setSelectedProjectId} onOpenFollowUp={onOpenFollowUp} onOpenTask={onOpenTask} />}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        {!vm.selectedRow ? <StatePanel tone="empty" title="Select a project" message="Choose a project to review profile details and operational pressure." /> : (
          <ProjectProfilePanel
            selectedRow={vm.selectedRow}
            editing={vm.editing}
            draft={vm.draft}
            detailTab={vm.detailTab}
            saveErrors={vm.saveErrors}
            workspaceMode={vm.projectWorkspaceMode}
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
