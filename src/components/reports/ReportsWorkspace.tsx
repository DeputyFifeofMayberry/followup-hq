import { BarChart3, Copy, Download, FilePlus2, FileSpreadsheet, Pin, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { WorkspaceKey } from '../../lib/appModeConfig';
import { useShallow } from 'zustand/react/shallow';
import { ExportWorkspace } from '../ExportWorkspace';
import { AppShellCard, SectionHeader, WorkspacePage } from '../ui/AppPrimitives';
import { reportDefinitions, reportSelectorItems, runReport } from '../../lib/reports/reportRegistry';
import { buildReportingContext } from '../../lib/reports/reportContext';
import { reportDraftEquals, toReportDraftState } from '../../lib/reports/savedDefinitions';
import { ReportTypeSelector } from './ReportTypeSelector';
import { ExecutiveSnapshotReport } from './ExecutiveSnapshotReport';
import { ProjectHealthReport } from './ProjectHealthReport';
import { OwnerWorkloadReport } from './OwnerWorkloadReport';
import { FollowUpRiskReport } from './FollowUpRiskReport';
import { DataQualityReport } from './DataQualityReport';
import { useAppStore } from '../../store/useAppStore';
import type { ReportDraftState } from '../../types';

export function ReportsWorkspace({
  onOpenDirectoryRecord,
  onSetWorkspace,
}: {
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}) {
  const {
    items,
    tasks,
    projects,
    savedReportDefinitions,
    activeReportDefinitionId,
    reportDraft,
    openSavedReportDefinition,
    setReportDraft,
    saveActiveReportDraft,
    saveReportDraftAsNew,
    revertActiveReportDraft,
    createSavedReportDefinition,
    updateSavedReportDefinition,
    deleteSavedReportDefinition,
    duplicateSavedReportDefinition,
    pinSavedReportDefinition,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    savedReportDefinitions: s.savedReportDefinitions,
    activeReportDefinitionId: s.activeReportDefinitionId,
    reportDraft: s.reportDraft,
    openSavedReportDefinition: s.openSavedReportDefinition,
    setReportDraft: s.setReportDraft,
    saveActiveReportDraft: s.saveActiveReportDraft,
    saveReportDraftAsNew: s.saveReportDraftAsNew,
    revertActiveReportDraft: s.revertActiveReportDraft,
    createSavedReportDefinition: s.createSavedReportDefinition,
    updateSavedReportDefinition: s.updateSavedReportDefinition,
    deleteSavedReportDefinition: s.deleteSavedReportDefinition,
    duplicateSavedReportDefinition: s.duplicateSavedReportDefinition,
    pinSavedReportDefinition: s.pinSavedReportDefinition,
  })));

  const activeDefinition = savedReportDefinitions.find((entry) => entry.id === activeReportDefinitionId) ?? savedReportDefinitions[0];
  const isDirty = activeDefinition ? !reportDraftEquals(toReportDraftState(activeDefinition), reportDraft) : false;
  const reportContext = useMemo(() => buildReportingContext({ items, tasks, projects, draft: reportDraft }), [items, tasks, projects, reportDraft]);
  const reportMeta = reportDefinitions[reportDraft.reportType];
  const pinnedReports = savedReportDefinitions.filter((entry) => entry.isPinned);
  const otherReports = savedReportDefinitions.filter((entry) => !entry.isPinned);

  const content = useMemo(() => {
    switch (reportDraft.reportType) {
      case 'executive_snapshot':
        return <ExecutiveSnapshotReport result={runReport('executive_snapshot', reportContext)} />;
      case 'project_health':
        return (
          <ProjectHealthReport
            result={runReport('project_health', reportContext)}
            onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
            onSetWorkspace={onSetWorkspace}
          />
        );
      case 'owner_workload':
        return <OwnerWorkloadReport result={runReport('owner_workload', reportContext)} />;
      case 'followup_risk':
        return <FollowUpRiskReport result={runReport('followup_risk', reportContext)} />;
      case 'data_quality':
        return <DataQualityReport result={runReport('data_quality', reportContext)} />;
      default:
        return null;
    }
  }, [onOpenDirectoryRecord, onSetWorkspace, reportContext, reportDraft.reportType]);

  return (
    <WorkspacePage className="space-y-4">
      <AppShellCard className="workspace-summary-strip" surface="hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            title="Reports"
            subtitle="Reusable report definitions with explicit draft-vs-saved control, pinned starters, and downstream export."
            compact
            actions={<div className="inline-flex items-center gap-1 text-xs text-slate-500"><BarChart3 className="h-3.5 w-3.5" />Operational reporting system</div>}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="action-btn" onClick={() => createSavedReportDefinition({ name: 'New Report', draft: reportDraft })}><FilePlus2 className="h-4 w-4" />Create new report</button>
            <div className="action-btn pointer-events-none"><Download className="h-4 w-4" />Export controls below</div>
            <div className="action-btn pointer-events-none"><FileSpreadsheet className="h-4 w-4" />{reportMeta.label}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Active report</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{activeDefinition?.name ?? reportMeta.label}</div>
            <div className="mt-1 text-xs text-slate-500">{isDirty ? 'Unsaved draft changes' : 'Saved definition is current'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Scope</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{reportContext.scope.openExecutionRecords} open execution records</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-amber-700">Immediate pressure</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{reportContext.executionStats.due + reportContext.executionStats.blocked} need action now</div>
          </div>
        </div>
      </AppShellCard>

      <AppShellCard surface="command" className="space-y-3">
        <SectionHeader title="Saved reports" subtitle="Open pinned starters and custom definitions. Edits remain draft until explicitly saved." compact />
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Pinned</div>
            {pinnedReports.map((report) => (
              <div key={report.id} className={`rounded-2xl border p-3 ${report.id === activeReportDefinitionId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
                <button type="button" className="w-full text-left" onClick={() => openSavedReportDefinition(report.id)}>
                  <div className="text-sm font-semibold">{report.name}</div>
                  <div className={`mt-1 text-xs ${report.id === activeReportDefinitionId ? 'text-slate-200' : 'text-slate-500'}`}>{reportDefinitions[report.reportType].label}</div>
                </button>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <button type="button" className="action-btn" onClick={() => duplicateSavedReportDefinition(report.id)}><Copy className="h-3.5 w-3.5" />Duplicate</button>
                  <button type="button" className="action-btn" onClick={() => pinSavedReportDefinition(report.id, !report.isPinned)}><Pin className="h-3.5 w-3.5" />{report.isPinned ? 'Unpin' : 'Pin'}</button>
                  {!report.isBuiltInTemplate ? <button type="button" className="action-btn" onClick={() => deleteSavedReportDefinition(report.id)}><Trash2 className="h-3.5 w-3.5" />Delete</button> : null}
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Other saved</div>
            {otherReports.map((report) => (
              <div key={report.id} className={`rounded-2xl border p-3 ${report.id === activeReportDefinitionId ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
                <button type="button" className="w-full text-left" onClick={() => openSavedReportDefinition(report.id)}>
                  <div className="text-sm font-semibold">{report.name}</div>
                  <div className={`mt-1 text-xs ${report.id === activeReportDefinitionId ? 'text-slate-200' : 'text-slate-500'}`}>{reportDefinitions[report.reportType].label}</div>
                </button>
                <div className="mt-2 flex flex-wrap gap-1 text-xs">
                  <button type="button" className="action-btn" onClick={() => duplicateSavedReportDefinition(report.id)}><Copy className="h-3.5 w-3.5" />Duplicate</button>
                  <button type="button" className="action-btn" onClick={() => pinSavedReportDefinition(report.id, !report.isPinned)}><Pin className="h-3.5 w-3.5" />{report.isPinned ? 'Unpin' : 'Pin'}</button>
                  {!report.isBuiltInTemplate ? <button type="button" className="action-btn" onClick={() => deleteSavedReportDefinition(report.id)}><Trash2 className="h-3.5 w-3.5" />Delete</button> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </AppShellCard>

      <AppShellCard surface="command" className="space-y-3">
        <SectionHeader title="Report configuration" subtitle="Change type/scope/display as a draft, then save or save as." compact />
        <ReportTypeSelector items={reportSelectorItems} value={reportDraft.reportType} onChange={(value) => setReportDraft({ reportType: value })} />
        <div className="grid gap-3 md:grid-cols-3">
          <label className="field-block">
            <span className="field-label">Scope mode</span>
            <select className="field-input" value={reportDraft.scope.mode} onChange={(event) => setReportDraft({ scope: { mode: event.target.value as ReportDraftState['scope']['mode'] } })}>
              <option value="all_open">All open</option>
              <option value="project">One project</option>
              <option value="owner">One owner</option>
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Project scope</span>
            <input className="field-input" value={reportDraft.scope.project ?? ''} onChange={(event) => setReportDraft({ scope: { project: event.target.value } })} placeholder="Project name" />
          </label>
          <label className="field-block">
            <span className="field-label">Owner scope</span>
            <input className="field-input" value={reportDraft.scope.owner ?? ''} onChange={(event) => setReportDraft({ scope: { owner: event.target.value } })} placeholder="Owner name" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={reportDraft.scope.includeClosed} onChange={(event) => setReportDraft({ scope: { includeClosed: event.target.checked } })} />Include closed/done records
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            Row limit
            <input type="number" min={5} max={50} className="field-input w-24" value={reportDraft.display.rowLimit} onChange={(event) => setReportDraft({ display: { rowLimit: Number(event.target.value) || 8 } })} />
          </label>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="primary-btn" disabled={!isDirty || activeDefinition?.isBuiltInTemplate} onClick={() => saveActiveReportDraft()}><Save className="h-4 w-4" />Save changes</button>
          <button type="button" className="action-btn" onClick={() => {
            const name = window.prompt('Save report as', `${activeDefinition?.name ?? 'Report'} Copy`);
            if (name) saveReportDraftAsNew(name);
          }}><Copy className="h-4 w-4" />Save as new</button>
          <button type="button" className="action-btn" disabled={!isDirty} onClick={() => revertActiveReportDraft()}><RotateCcw className="h-4 w-4" />Revert</button>
          <button type="button" className="action-btn" onClick={() => {
            if (!activeDefinition || activeDefinition.isBuiltInTemplate) return;
            const name = window.prompt('Rename report', activeDefinition.name);
            if (name) updateSavedReportDefinition(activeDefinition.id, { name });
          }}>Rename</button>
          {activeDefinition?.isBuiltInTemplate ? <div className="text-xs text-slate-500">Built-in templates are protected. Duplicate to edit safely.</div> : null}
        </div>
      </AppShellCard>

      {content}

      <section>
        <ExportWorkspace embedded />
      </section>
    </WorkspacePage>
  );
}
