import { AlertTriangle, ArrowUpRight, FolderKanban, ListChecks, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type {
  ExecutiveDrilldown,
  ExecutivePressureCategory,
  ExecutivePriorityRow,
  ExecutiveSnapshotReportResult,
} from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { WorkspaceKey } from '../../lib/appModeConfig';
import type { ReportType } from '../../types';

function categoryLabel(category: ExecutivePressureCategory): string {
  if (category === 'urgent_pressure') return 'Urgent pressure';
  if (category === 'blocked_drag') return 'Blocked drag';
  if (category === 'waiting_drag') return 'Waiting / dependency drag';
  if (category === 'closeout_opportunity') return 'Closeout opportunity';
  return 'Cleanup distortion';
}

function severityTone(severity: ExecutiveDrilldown['severity']) {
  if (severity === 'critical') return 'text-rose-700 bg-rose-50';
  if (severity === 'at_risk') return 'text-amber-700 bg-amber-50';
  if (severity === 'watch') return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
}

function toWorkspace(category: ExecutivePressureCategory): WorkspaceKey {
  if (category === 'blocked_drag') return 'tasks';
  if (category === 'closeout_opportunity') return 'tasks';
  if (category === 'cleanup_distortion') return 'exports';
  return 'followups';
}

function toRelatedReport(category: ExecutivePressureCategory): ReportType {
  if (category === 'cleanup_distortion') return 'data_quality';
  if (category === 'blocked_drag' || category === 'waiting_drag') return 'owner_workload';
  if (category === 'urgent_pressure') return 'followup_risk';
  return 'project_health';
}

export function ExecutiveSnapshotReport({
  result,
  onOpenDirectoryProject,
  onSetWorkspace,
  onOpenReportType,
}: {
  result: ExecutiveSnapshotReportResult;
  onOpenDirectoryProject: (projectId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
  onOpenReportType: (type: ReportType) => void;
}) {
  const openExecutionLane = useAppStore((state) => state.openExecutionLane);
  const setFollowUpFilters = useAppStore((state) => state.setFollowUpFilters);
  const setTaskWorkspaceSession = useAppStore((state) => state.setTaskWorkspaceSession);

  const [selectedSectionId, setSelectedSectionId] = useState<string | undefined>(result.defaultSelectedSectionId);
  const [selectedPriorityId, setSelectedPriorityId] = useState<string | undefined>(result.defaultSelectedPriorityId);

  useEffect(() => {
    if (!result.sections.length) {
      setSelectedSectionId(undefined);
      return;
    }
    setSelectedSectionId((current) => {
      if (current && result.drilldownsBySectionId[current]) return current;
      return result.defaultSelectedSectionId ?? result.sections[0]?.id;
    });
  }, [result.defaultSelectedSectionId, result.drilldownsBySectionId, result.sections]);

  useEffect(() => {
    if (!result.priorityRows.length) {
      setSelectedPriorityId(undefined);
      return;
    }
    setSelectedPriorityId((current) => {
      if (current && result.drilldownsByPriorityId[current]) return current;
      return result.defaultSelectedPriorityId ?? result.priorityRows[0]?.id;
    });
  }, [result.defaultSelectedPriorityId, result.drilldownsByPriorityId, result.priorityRows]);

  const selectedSection = useMemo(
    () => (selectedSectionId ? result.drilldownsBySectionId[selectedSectionId] : undefined)
      ?? (result.defaultSelectedSectionId ? result.drilldownsBySectionId[result.defaultSelectedSectionId] : undefined),
    [result.defaultSelectedSectionId, result.drilldownsBySectionId, selectedSectionId],
  );

  const selectedPriority = useMemo(
    () => (selectedPriorityId ? result.drilldownsByPriorityId[selectedPriorityId] : undefined)
      ?? (result.defaultSelectedPriorityId ? result.drilldownsByPriorityId[result.defaultSelectedPriorityId] : undefined),
    [result.defaultSelectedPriorityId, result.drilldownsByPriorityId, selectedPriorityId],
  );

  const activeDrilldown = selectedPriority ?? selectedSection;

  const openCategoryExecution = (category: ExecutivePressureCategory) => {
    const workspace = toWorkspace(category);
    if (workspace === 'exports') {
      onOpenReportType('data_quality');
      onSetWorkspace('exports');
      return;
    }

    const route = selectedPriority?.routeContext ?? selectedSection?.routeContext;
    if (workspace === 'followups') {
      openExecutionLane('followups', {
        recordId: route?.primaryFollowUpId,
        recordType: route?.primaryFollowUpId ? 'followup' : undefined,
        project: route?.primaryProject,
        source: 'overview',
        sourceRecordId: route?.primaryProjectId,
        section: category === 'urgent_pressure' ? 'now' : 'triage',
        routeKind: 'action',
        intentLabel: `executive snapshot ${categoryLabel(category)}`,
      });
      setFollowUpFilters({ project: route?.primaryProject || 'All' });
      onSetWorkspace('followups');
      return;
    }

    openExecutionLane('tasks', {
      recordId: route?.primaryTaskId,
      recordType: route?.primaryTaskId ? 'task' : undefined,
      project: route?.primaryProject,
      source: 'overview',
      sourceRecordId: route?.primaryProjectId,
      section: category === 'closeout_opportunity' ? 'ready_to_close' : 'blocked',
      routeKind: 'action',
      intentLabel: `executive snapshot ${categoryLabel(category)}`,
    });
    setTaskWorkspaceSession({ projectFilter: route?.primaryProject || 'All', view: category === 'closeout_opportunity' ? 'today' : 'blocked' });
    onSetWorkspace('tasks');
  };

  const openSelectedRecord = (priority: ExecutivePriorityRow | undefined) => {
    if (!priority) return;
    if (priority.recordType === 'followup') {
      openExecutionLane('followups', {
        recordId: priority.recordId,
        recordType: 'followup',
        project: priority.project,
        source: 'overview',
        sourceRecordId: priority.routeContext.primaryProjectId,
        section: priority.pressureCategory === 'urgent_pressure' ? 'now' : 'triage',
        routeKind: 'action',
        intentLabel: `executive priority ${priority.title}`,
      });
      onSetWorkspace('followups');
      return;
    }
    openExecutionLane('tasks', {
      recordId: priority.recordId,
      recordType: 'task',
      project: priority.project,
      source: 'overview',
      sourceRecordId: priority.routeContext.primaryProjectId,
      section: priority.pressureCategory === 'closeout_opportunity' ? 'ready_to_close' : 'blocked',
      routeKind: 'action',
      intentLabel: `executive priority ${priority.title}`,
    });
    onSetWorkspace('tasks');
  };

  const selectedPriorityRow = result.priorityRows.find((row) => row.id === selectedPriorityId) ?? result.priorityRows[0];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)]">
      <div className="space-y-4">
        <AppShellCard surface="data" className="space-y-4">
          <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {result.header.highlights.map((card) => (
              <StatTile key={card.id} label={card.label} value={card.value} tone={card.tone} helper={card.helper} />
            ))}
          </div>
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Biggest pressure driver</div>
              <div className="mt-1 text-sm text-slate-900">{result.narrative.biggestPressureDriver}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Biggest drag factor</div>
              <div className="mt-1 text-sm text-slate-900">{result.narrative.biggestDragFactor}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Best quick closeout</div>
              <div className="mt-1 text-sm text-slate-900">{result.narrative.biggestQuickWinOpportunity}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="font-semibold uppercase tracking-[0.12em] text-slate-500">Trust distortion warning</div>
              <div className="mt-1 text-sm text-slate-900">{result.narrative.biggestTrustDistortionWarning}</div>
            </div>
          </div>
        </AppShellCard>

        <AppShellCard surface="data" className="space-y-3">
          <SectionHeader title="Command sections" subtitle="Separated pressure, drag, opportunity, and distortion sections for quick command-level scan." compact />
          {!result.sections.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-sm text-slate-500">No significant pressure sections in this scope.</div>
          ) : (
            <div className="space-y-2">
              {result.sections.map((section) => {
                const active = selectedSection?.id === section.id;
                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setSelectedSectionId(section.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left ${active ? 'border-sky-400 bg-sky-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{section.title}</div>
                        <div className="text-xs text-slate-600">{section.subtitle}</div>
                      </div>
                      <div className="text-right">
                        <div className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${severityTone(section.severity)}`}>{section.severity.replace('_', ' ')}</div>
                        <div className="mt-1 text-xs text-slate-600">Score {section.score}</div>
                      </div>
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-700 sm:grid-cols-4">
                      <div><strong>{section.count}</strong> records</div>
                      <div><strong>{section.breakdown.blockedCount}</strong> blocked</div>
                      <div><strong>{section.breakdown.waitingTooLongCount}</strong> waiting too long</div>
                      <div><strong>{section.breakdown.readyToCloseCount}</strong> close-ready</div>
                    </div>
                    <div className="mt-1 text-xs text-slate-600">{section.summary}</div>
                  </button>
                );
              })}
            </div>
          )}
        </AppShellCard>

        <AppShellCard surface="data" className="space-y-3">
          <SectionHeader title="Top pressure records" subtitle="Ranked queue records with direct selection into the drilldown inspector." compact />
          {!result.priorityRows.length ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-sm text-slate-500">No queue pressure rows in this scope.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Record</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Urgency</th>
                    <th className="px-3 py-2">Score</th>
                    <th className="px-3 py-2">Project / owner</th>
                    <th className="px-3 py-2">Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {result.priorityRows.map((row) => {
                    const active = selectedPriorityId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`}
                        onClick={() => setSelectedPriorityId(row.id)}
                      >
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-900">{row.title}</div>
                          <div className="text-xs text-slate-500">{row.recordType} • {row.priority} • {row.status}</div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{categoryLabel(row.pressureCategory)}</td>
                        <td className="px-3 py-2 text-slate-700">{row.urgencyLabel}</td>
                        <td className="px-3 py-2 text-slate-900">{row.score}</td>
                        <td className="px-3 py-2 text-slate-700">{row.project} • {row.owner}</td>
                        <td className="px-3 py-2 text-slate-600">{row.reasonSummary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AppShellCard>
      </div>

      <AppShellCard surface="inspector" className="space-y-4">
        <SectionHeader title={activeDrilldown ? activeDrilldown.title : 'Executive drilldown'} subtitle="Selected section or priority drilldown with why, contributors, next move, and route-out actions." compact />
        {activeDrilldown ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{categoryLabel(activeDrilldown.pressureCategory)}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityTone(activeDrilldown.severity)}`}>{activeDrilldown.severity.replace('_', ' ')}</span>
              </div>
              <div className="mt-1">{activeDrilldown.whyPrioritized}</div>
              <div className="mt-1"><strong>System story:</strong> {activeDrilldown.pressureStory}</div>
              <div className="mt-1"><strong>Recommended next move:</strong> {activeDrilldown.recommendedNextMove}</div>
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Contributing records</div>
              {!activeDrilldown.contributingRecords.length ? (
                <div className="text-slate-500">No contributing records were captured for this drilldown.</div>
              ) : activeDrilldown.contributingRecords.map((entry) => (
                <div key={`${entry.recordType}:${entry.id}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2 py-1.5">
                  <div className="font-medium text-slate-900">{entry.title}</div>
                  <div>{entry.project} • {entry.owner} • {entry.status}</div>
                  <div className="text-slate-600">{entry.reason}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Action recommendations</div>
              {activeDrilldown.recommendations.map((step) => (
                <div key={step.label}>
                  <div className="font-semibold text-slate-900">{step.label}</div>
                  <div>{step.detail}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button className="action-btn" onClick={() => openCategoryExecution(activeDrilldown.pressureCategory)}><ArrowUpRight className="h-4 w-4" />Open scoped lane</button>
              <button className="action-btn" onClick={() => openSelectedRecord(selectedPriorityRow)}><ListChecks className="h-4 w-4" />Open selected record</button>
              <button
                className="action-btn"
                disabled={!activeDrilldown.routeContext.primaryProjectId}
                onClick={() => activeDrilldown.routeContext.primaryProjectId && onOpenDirectoryProject(activeDrilldown.routeContext.primaryProjectId)}
              >
                <FolderKanban className="h-4 w-4" />Open related Project
              </button>
              <button className="action-btn" onClick={() => onOpenReportType(toRelatedReport(activeDrilldown.pressureCategory))}><ShieldAlert className="h-4 w-4" />Open deeper report</button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            <AlertTriangle className="mx-auto mb-2 h-4 w-4" />
            Select a command section or top pressure record to inspect details.
          </div>
        )}
      </AppShellCard>
    </div>
  );
}
