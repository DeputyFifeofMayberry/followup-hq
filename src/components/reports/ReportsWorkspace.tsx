import { BarChart3, Clock3, Copy, Download, FilePlus2, FileSpreadsheet, History, Pin, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2 } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
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
import { ReportTrustPanel } from './ReportTrustPanel';
import { buildReportRunSummaryFromHeader, createReportRunSignature } from '../../lib/reports/reportRuns';
import type { ReportHeaderSummary } from '../../lib/reports/contracts';

const SCOPE_MODE_OPTIONS: Array<{ value: ReportDraftState['scope']['mode']; label: string; helper: string }> = [
  { value: 'trusted_live_only', label: 'Trusted live only', helper: 'Strict execution-ready view.' },
  { value: 'trusted_live_plus_review', label: 'Trusted live + review', helper: 'Blend live and review-required records.' },
  { value: 'all_records', label: 'All records', helper: 'Include all trust states for broad visibility.' },
  { value: 'cleanup_audit', label: 'Cleanup audit', helper: 'Focus only on records needing trust correction.' },
];

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
    reportRuns,
    recordReportRun,
    recordReportRunExport,
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
    reportRuns: s.reportRuns,
    recordReportRun: s.recordReportRun,
    recordReportRunExport: s.recordReportRunExport,
  })));

  const activeDefinition = savedReportDefinitions.find((entry) => entry.id === activeReportDefinitionId) ?? savedReportDefinitions[0];
  const isDirty = activeDefinition ? !reportDraftEquals(toReportDraftState(activeDefinition), reportDraft) : false;
  const reportContext = useMemo(() => buildReportingContext({ items, tasks, projects, draft: reportDraft }), [items, tasks, projects, reportDraft]);
  const reportMeta = reportDefinitions[reportDraft.reportType];
  const pinnedReports = savedReportDefinitions.filter((entry) => entry.isPinned);
  const otherReports = savedReportDefinitions.filter((entry) => !entry.isPinned);

  const { content, activeTrust, activeHeader } = useMemo((): { content: ReactNode; activeTrust: ReportHeaderSummary['trust']; activeHeader: ReportHeaderSummary } => {
    switch (reportDraft.reportType) {
      case 'executive_snapshot': {
        const result = runReport('executive_snapshot', reportContext);
        return {
          content: (
            <ExecutiveSnapshotReport
              result={result}
              onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
              onSetWorkspace={onSetWorkspace}
              onOpenReportType={(reportType) => setReportDraft({ reportType })}
            />
          ),
          activeTrust: result.header.trust,
          activeHeader: result.header,
        };
      }
      case 'project_health': {
        const result = runReport('project_health', reportContext);
        return {
          content: (
            <ProjectHealthReport
              result={result}
              onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
              onSetWorkspace={onSetWorkspace}
            />
          ),
          activeTrust: result.header.trust,
          activeHeader: result.header,
        };
      }
      case 'owner_workload': {
        const result = runReport('owner_workload', reportContext);
        return {
          content: (
            <OwnerWorkloadReport
              result={result}
              onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
              onSetWorkspace={onSetWorkspace}
            />
          ),
          activeTrust: result.header.trust,
          activeHeader: result.header,
        };
      }
      case 'followup_risk': {
        const result = runReport('followup_risk', reportContext);
        return {
          content: (
            <FollowUpRiskReport
              result={result}
              onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
              onSetWorkspace={onSetWorkspace}
            />
          ),
          activeTrust: result.header.trust,
          activeHeader: result.header,
        };
      }
      case 'data_quality': {
        const result = runReport('data_quality', reportContext);
        return {
          content: (
            <DataQualityReport
              result={result}
              onOpenDirectoryProject={(projectId) => onOpenDirectoryRecord('project', projectId)}
              onSetWorkspace={onSetWorkspace}
            />
          ),
          activeTrust: result.header.trust,
          activeHeader: result.header,
        };
      }
      default:
        return {
          content: null,
          activeTrust: { scopeReceipt: reportContext.scopeReceipt, confidence: reportContext.confidence, topExclusions: reportContext.scopeReceipt.excludedBuckets.slice(0, 4) },
          activeHeader: {
            title: reportMeta.label,
            subtitle: reportMeta.description,
            scope: reportContext.scope,
            trust: { scopeReceipt: reportContext.scopeReceipt, confidence: reportContext.confidence, topExclusions: reportContext.scopeReceipt.excludedBuckets.slice(0, 4) },
            highlights: [],
          },
        };
    }
  }, [onOpenDirectoryRecord, onSetWorkspace, reportContext, reportDraft.reportType, reportMeta.description, reportMeta.label, setReportDraft]);

  const activeDefinitionRuns = useMemo(
    () => (activeDefinition
      ? reportRuns
        .filter((run) => run.reportDefinitionId === activeDefinition.id)
        .sort((a, b) => new Date(b.ranAt).getTime() - new Date(a.ranAt).getTime())
      : []),
    [activeDefinition, reportRuns],
  );
  const activeDraftSignature = createReportRunSignature(reportDraft);
  const compatibleRuns = activeDefinitionRuns.filter((run) => run.draftSignature === activeDraftSignature);
  const latestCompatibleRun = compatibleRuns[0] ?? activeDefinitionRuns[0];
  const hasFreshSnapshotForDraft = Boolean(latestCompatibleRun && latestCompatibleRun.draftSignature === activeDraftSignature);
  const previousRun = compatibleRuns[1] ?? activeDefinitionRuns[1];
  const handleRecordRun = () => {
    if (!activeDefinition) return;
    recordReportRun({
      reportDefinitionId: activeDefinition.id,
      reportNameSnapshot: activeDefinition.name,
      reportType: reportDraft.reportType,
      scopeMode: reportDraft.scope.mode,
      draftSignature: activeDraftSignature,
      summary: buildReportRunSummaryFromHeader(activeHeader),
    });
  };

  const exportProvenance = latestCompatibleRun ? {
    reportName: latestCompatibleRun.reportNameSnapshot,
    reportTypeLabel: reportMeta.label,
    scopeModeLabel: activeTrust.scopeReceipt.modeLabel,
    ranAt: latestCompatibleRun.ranAt,
    includedCount: latestCompatibleRun.summary.includedCount,
    excludedCount: latestCompatibleRun.summary.excludedCount,
    confidenceLabel: latestCompatibleRun.summary.confidenceLabel,
    comparedToPreviousRun: Boolean(latestCompatibleRun.deltaFromPrevious),
  } : undefined;


  return (
    <WorkspacePage className="space-y-4">
      <AppShellCard className="workspace-summary-strip" surface="hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            title="Reports"
            subtitle="Operational reports with explicit scope receipts and confidence context."
            compact
            actions={<div className="inline-flex items-center gap-1 text-xs text-slate-500"><BarChart3 className="h-3.5 w-3.5" />Operational reporting system</div>}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="action-btn" onClick={() => createSavedReportDefinition({ name: 'New Report', draft: reportDraft })}><FilePlus2 className="h-4 w-4" />Create new report</button>
            <button type="button" className="action-btn" onClick={handleRecordRun}><RefreshCw className="h-4 w-4" />Refresh snapshot</button>
            <div className="action-btn pointer-events-none"><Download className="h-4 w-4" />Export controls below</div>
            <div className="action-btn pointer-events-none"><FileSpreadsheet className="h-4 w-4" />{reportMeta.label}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Active report</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{activeDefinition?.name ?? reportMeta.label}</div>
            <div className="mt-1 text-xs text-slate-500">{isDirty ? 'Unsaved draft changes' : 'Saved definition is current'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Scope mode</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{reportContext.scopeReceipt.modeLabel}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Included vs excluded</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{reportContext.scopeReceipt.includedCount} / {reportContext.scopeReceipt.excludedCount}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-amber-700">Confidence</div>
            <div className="mt-2 inline-flex items-center gap-1 text-lg font-semibold text-slate-950"><ShieldCheck className="h-4 w-4" />{reportContext.confidence.label}</div>
          </div>
        </div>
        {!hasFreshSnapshotForDraft ? (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
            Snapshot is stale for this draft configuration. Refresh snapshot to align compare/export provenance with the current draft.
          </div>
        ) : null}
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
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          <label className="field-block md:col-span-2">
            <span className="field-label">Scope mode</span>
            <select className="field-input" value={reportDraft.scope.mode} onChange={(event) => setReportDraft({ scope: { mode: event.target.value as ReportDraftState['scope']['mode'] } })}>
              {SCOPE_MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label} — {option.helper}</option>
              ))}
            </select>
          </label>
          <label className="field-block">
            <span className="field-label">Project filter</span>
            <input className="field-input" value={reportDraft.scope.project ?? ''} onChange={(event) => setReportDraft({ scope: { project: event.target.value || undefined } })} placeholder="All projects" />
          </label>
          <label className="field-block">
            <span className="field-label">Owner filter</span>
            <input className="field-input" value={reportDraft.scope.owner ?? ''} onChange={(event) => setReportDraft({ scope: { owner: event.target.value || undefined } })} placeholder="All owners" />
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 md:pt-7">
            <input type="checkbox" checked={reportDraft.scope.includeClosed} onChange={(event) => setReportDraft({ scope: { includeClosed: event.target.checked } })} />Include closed/done
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      <ReportTrustPanel trust={activeTrust} />
      <AppShellCard surface="inspector" className="space-y-3">
        <SectionHeader title="Run history" subtitle="Durable report snapshots with compare-to-last-run and export linkage." compact />
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Latest run</div>
              <div className="mt-2 text-sm font-semibold text-slate-950">{latestCompatibleRun ? new Date(latestCompatibleRun.ranAt).toLocaleString() : 'No run yet for this draft'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Included delta</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{latestCompatibleRun?.deltaFromPrevious ? `${latestCompatibleRun.deltaFromPrevious.includedCountDelta >= 0 ? '+' : ''}${latestCompatibleRun.deltaFromPrevious.includedCountDelta}` : '—'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Excluded delta</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{latestCompatibleRun?.deltaFromPrevious ? `${latestCompatibleRun.deltaFromPrevious.excludedCountDelta >= 0 ? '+' : ''}${latestCompatibleRun.deltaFromPrevious.excludedCountDelta}` : '—'}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-amber-700">Confidence change</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{latestCompatibleRun?.deltaFromPrevious ? `${latestCompatibleRun.deltaFromPrevious.previousConfidenceTier} → ${latestCompatibleRun.deltaFromPrevious.currentConfidenceTier}` : latestCompatibleRun?.summary.confidenceLabel ?? '—'}</div>
          </div>
        </div>
        {latestCompatibleRun?.deltaFromPrevious?.metricDeltas.length ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <div className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><Clock3 className="h-3.5 w-3.5" />Top metric changes since prior run</div>
            <ul className="space-y-1">
              {latestCompatibleRun.deltaFromPrevious.metricDeltas.slice(0, 5).map((metric) => (
                <li key={metric.key}>• {metric.label}: {metric.currentValue} ({metric.delta >= 0 ? '+' : ''}{metric.delta})</li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-2 inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500"><History className="h-3.5 w-3.5" />Recent runs</div>
          {activeDefinitionRuns.length ? (
            <ul className="space-y-2 text-sm text-slate-700">
              {activeDefinitionRuns.slice(0, 5).map((run) => (
                <li key={run.id} className="rounded-xl bg-slate-50 px-3 py-2">
                  <div className="font-medium text-slate-900">{new Date(run.ranAt).toLocaleString()} · {run.summary.includedCount}/{run.summary.excludedCount} · {run.summary.confidenceLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">{run.exportRecords[0] ? `Latest export: ${run.exportRecords[0].fileName}` : 'No export linked yet.'}</div>
                </li>
              ))}
            </ul>
          ) : <div className="text-sm text-slate-500">No run history yet. Use “Refresh snapshot” to capture this report state.</div>}
          {previousRun ? <div className="mt-2 text-xs text-slate-500">Comparing against run from {new Date(previousRun.ranAt).toLocaleString()}.</div> : null}
        </div>
      </AppShellCard>

      {content}

      <section>
        <ExportWorkspace
          embedded
          reportTrustSummary={activeTrust}
          reportProvenance={exportProvenance}
          onExported={({ format, fileName }) => {
            if (!latestCompatibleRun || !hasFreshSnapshotForDraft) return;
            recordReportRunExport({
              runId: latestCompatibleRun.id,
              format,
              fileName,
              detailLevel: reportDraft.export.detailLevel,
              includeSummarySheet: reportDraft.export.includeSummarySheet,
            });
          }}
        />
      </section>
    </WorkspacePage>
  );
}
