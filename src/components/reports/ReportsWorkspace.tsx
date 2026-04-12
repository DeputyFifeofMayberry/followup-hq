import { BarChart3, Download, FileSpreadsheet } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildExecutionQueueStats } from '../../domains/shared/selectors/executionQueueSelectors';
import { buildUnifiedQueue } from '../../lib/unifiedQueue';
import { ExportWorkspace } from '../ExportWorkspace';
import { AppShellCard, SectionHeader, WorkspacePage } from '../ui/AppPrimitives';
import type { ReportMetricSnapshot, ReportSelectorItem, ReportSummaryCardModel, ReportType } from '../../types';
import type { ReportViewProps } from './reportModels';
import { ReportTypeSelector } from './ReportTypeSelector';
import { ExecutiveSnapshotReport } from './ExecutiveSnapshotReport';
import { ProjectHealthReport } from './ProjectHealthReport';
import { OwnerWorkloadReport } from './OwnerWorkloadReport';
import { FollowUpRiskReport } from './FollowUpRiskReport';
import { DataQualityReport } from './DataQualityReport';
import { useAppStore } from '../../store/useAppStore';

const REPORT_SELECTOR_ITEMS: ReportSelectorItem[] = [
  { id: 'executive_snapshot', label: 'Executive snapshot', description: 'Live execution posture for leaders.' },
  { id: 'project_health', label: 'Project health', description: 'Pressure concentration across projects.' },
  { id: 'owner_workload', label: 'Owner workload', description: 'Current owner load and imbalance signals.' },
  { id: 'followup_risk', label: 'Follow-up risk', description: 'Commitment risk and dependency pressure.' },
  { id: 'data_quality', label: 'Data quality / cleanup', description: 'Readiness and cleanup trust signals.' },
];

function buildSummaryCards(metrics: ReportMetricSnapshot): ReportSummaryCardModel[] {
  return [
    { id: 'due', label: 'Due now', value: metrics.dueNow, helper: 'Needs same-day movement.', tone: 'danger' },
    { id: 'blocked', label: 'Blocked', value: metrics.blocked, helper: 'Stalled work requiring intervention.', tone: 'warn' },
    { id: 'cleanup', label: 'Needs review / cleanup', value: metrics.cleanup, helper: 'Records needing quality correction.', tone: 'info' },
    { id: 'close', label: 'Ready to close', value: metrics.readyToClose, helper: 'Close opportunities in queue.', tone: 'default' },
    { id: 'open-followups', label: 'Open follow-ups', value: metrics.openFollowUps, tone: 'default' },
    { id: 'open-tasks', label: 'Open tasks', value: metrics.openTasks, tone: 'default' },
  ];
}

export function ReportsWorkspace() {
  const { items, tasks } = useAppStore(useShallow((s) => ({ items: s.items, tasks: s.tasks })));
  const [selectedReport, setSelectedReport] = useState<ReportType>('executive_snapshot');

  const queue = useMemo(() => buildUnifiedQueue(items, tasks), [items, tasks]);
  const executionStats = useMemo(() => buildExecutionQueueStats(queue), [queue]);
  const metrics = useMemo<ReportMetricSnapshot>(() => ({
    dueNow: executionStats.due,
    blocked: executionStats.blocked,
    cleanup: executionStats.cleanup,
    readyToClose: executionStats.closeable,
    openFollowUps: items.filter((item) => item.status !== 'Closed').length,
    openTasks: tasks.filter((task) => task.status !== 'Done').length,
  }), [executionStats, items, tasks]);

  const summaryCards = useMemo(() => buildSummaryCards(metrics), [metrics]);

  const reportProps: ReportViewProps = {
    queue,
    metrics,
    summaryCards,
  };

  const reportRegistry: Record<ReportType, ReactElement> = {
    executive_snapshot: <ExecutiveSnapshotReport {...reportProps} />,
    project_health: <ProjectHealthReport {...reportProps} />,
    owner_workload: <OwnerWorkloadReport {...reportProps} />,
    followup_risk: <FollowUpRiskReport {...reportProps} />,
    data_quality: <DataQualityReport {...reportProps} />,
  };

  const selectedLabel = REPORT_SELECTOR_ITEMS.find((item) => item.id === selectedReport)?.label ?? 'Report';

  return (
    <WorkspacePage className="space-y-4">
      <AppShellCard className="workspace-summary-strip" surface="hero">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <SectionHeader
            title="Reports"
            subtitle="Operational reporting workspace for scanning execution pressure, risk, and closeout posture before taking downstream export actions."
            compact
            actions={<div className="inline-flex items-center gap-1 text-xs text-slate-500"><BarChart3 className="h-3.5 w-3.5" />Live in-app reporting foundation</div>}
          />
          <div className="flex flex-wrap gap-2">
            <div className="action-btn pointer-events-none"><Download className="h-4 w-4" />Export controls below</div>
            <div className="action-btn pointer-events-none"><FileSpreadsheet className="h-4 w-4" />{selectedLabel}</div>
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Current report</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{selectedLabel}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Scope</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{metrics.openFollowUps + metrics.openTasks} open execution records</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-xs uppercase tracking-[0.12em] text-amber-700">Immediate pressure</div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{metrics.dueNow + metrics.blocked} need action now</div>
          </div>
        </div>
      </AppShellCard>

      <AppShellCard surface="command" className="space-y-3">
        <SectionHeader title="Report type" subtitle="Switch report families without leaving the workspace." compact />
        <ReportTypeSelector items={REPORT_SELECTOR_ITEMS} value={selectedReport} onChange={setSelectedReport} />
      </AppShellCard>

      {reportRegistry[selectedReport]}

      <section>
        <ExportWorkspace embedded />
      </section>
    </WorkspacePage>
  );
}
