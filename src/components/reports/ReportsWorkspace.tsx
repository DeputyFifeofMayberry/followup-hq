import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { WorkspaceKey } from '../../lib/appModeConfig';
import { useShallow } from 'zustand/react/shallow';
import { ExportWorkspace } from '../ExportWorkspace';
import { AppShellCard, SectionHeader, WorkspacePage } from '../ui/AppPrimitives';
import type { ReportType } from '../../types';
import { reportDefinitions, reportSelectorItems, runReport } from '../../lib/reports/reportRegistry';
import { buildReportingContext } from '../../lib/reports/reportContext';
import { ReportTypeSelector } from './ReportTypeSelector';
import { ExecutiveSnapshotReport } from './ExecutiveSnapshotReport';
import { ProjectHealthReport } from './ProjectHealthReport';
import { OwnerWorkloadReport } from './OwnerWorkloadReport';
import { FollowUpRiskReport } from './FollowUpRiskReport';
import { DataQualityReport } from './DataQualityReport';
import { useAppStore } from '../../store/useAppStore';

export function ReportsWorkspace({
  onOpenDirectoryRecord,
  onSetWorkspace,
}: {
  onOpenDirectoryRecord: (recordType: 'project' | 'contact' | 'company', recordId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}) {
  const { items, tasks, projects } = useAppStore(useShallow((s) => ({ items: s.items, tasks: s.tasks, projects: s.projects })));
  const [selectedReport, setSelectedReport] = useState<ReportType>('executive_snapshot');

  const reportContext = useMemo(() => buildReportingContext({ items, tasks, projects }), [items, tasks, projects]);
  const activeDefinition = reportDefinitions[selectedReport];
  const content = useMemo(() => {
    switch (selectedReport) {
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
  }, [onOpenDirectoryRecord, onSetWorkspace, reportContext, selectedReport]);

  return (
    <WorkspacePage className="space-y-4">
      <AppShellCard className="workspace-summary-strip" surface="hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            title="Reports"
            subtitle="Operational reporting workspace with reusable report builders, shared queue context, and export as a downstream action."
            compact
            actions={<div className="inline-flex items-center gap-1 text-xs text-slate-500"><BarChart3 className="h-3.5 w-3.5" />Reporting domain foundation active</div>}
          />
          <div className="flex flex-wrap gap-2">
            <div className="action-btn pointer-events-none"><Download className="h-4 w-4" />Export controls below</div>
            <div className="action-btn pointer-events-none"><FileSpreadsheet className="h-4 w-4" />{activeDefinition.label}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Current report</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{activeDefinition.label}</div>
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
        <SectionHeader title="Report type" subtitle="Switch report families without leaving the workspace." compact />
        <ReportTypeSelector items={reportSelectorItems} value={selectedReport} onChange={setSelectedReport} />
      </AppShellCard>

      {content}

      <section>
        <ExportWorkspace embedded />
      </section>
    </WorkspacePage>
  );
}
