import { ArrowUpRight, FolderKanban, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { ProjectHealthDrilldown, ProjectHealthReportResult, ProjectHealthRow } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { WorkspaceKey } from '../../lib/appModeConfig';

interface ProjectHealthReportProps {
  result: ProjectHealthReportResult;
  onOpenDirectoryProject: (projectId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}

function tierTone(tier: ProjectHealthRow['tier']) {
  if (tier === 'Critical') return 'text-rose-700 bg-rose-50';
  if (tier === 'High') return 'text-amber-700 bg-amber-50';
  if (tier === 'Moderate') return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
}

function RecordTable({ rows, empty }: { rows: ProjectHealthDrilldown['highestPressureRows']; empty: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">{empty}</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-left uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-2 py-2">Record</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Owner</th>
            <th className="px-2 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-2 py-2 text-slate-900">{row.title}</td>
              <td className="px-2 py-2 text-slate-700">{row.status}</td>
              <td className="px-2 py-2 text-slate-700">{row.owner}</td>
              <td className="px-2 py-2 text-slate-600">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectHealthReport({ result, onOpenDirectoryProject, onSetWorkspace }: ProjectHealthReportProps) {
  const openExecutionLane = useAppStore((state) => state.openExecutionLane);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>(result.defaultSelectedProjectId);

  useEffect(() => {
    if (!result.rankedProjects.length) {
      setSelectedProjectId(undefined);
      return;
    }

    setSelectedProjectId((current) => {
      if (current && result.drilldownsByProjectId[current]) return current;
      return result.defaultSelectedProjectId ?? result.rankedProjects[0]?.id;
    });
  }, [result.defaultSelectedProjectId, result.drilldownsByProjectId, result.rankedProjects]);

  const selected = useMemo(
    () => (selectedProjectId ? result.drilldownsByProjectId[selectedProjectId] : undefined) ?? (result.defaultSelectedProjectId ? result.drilldownsByProjectId[result.defaultSelectedProjectId] : undefined),
    [result.defaultSelectedProjectId, result.drilldownsByProjectId, selectedProjectId],
  );

  const handleOpenFollowUps = () => {
    if (!selected) return;
    openExecutionLane('followups', {
      project: selected.routeContext.projectName,
      source: 'projects',
      sourceRecordId: selected.routeContext.projectId,
      section: 'now',
      intentLabel: `project health ${selected.project}`,
      routeKind: 'review',
    });
    onSetWorkspace('followups');
  };

  const handleOpenTasks = () => {
    if (!selected) return;
    openExecutionLane('tasks', {
      project: selected.routeContext.projectName,
      source: 'projects',
      sourceRecordId: selected.routeContext.projectId,
      section: 'blocked',
      intentLabel: `project health ${selected.project}`,
      routeKind: 'review',
    });
    onSetWorkspace('tasks');
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.75fr)_minmax(360px,1fr)]">
      <AppShellCard surface="data" className="space-y-4">
        <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {result.header.highlights.map((card) => (
            <StatTile key={card.id} label={card.label} value={card.value} tone={card.tone} helper={card.helper} />
          ))}
        </div>

        {!result.rankedProjects.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
            No active project health signals yet. Add follow-ups or tasks to start ranking operational pressure.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Open work</th>
                  <th className="px-3 py-2">Due now</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">Cleanup</th>
                  <th className="px-3 py-2">Closeout opp.</th>
                  <th className="px-3 py-2">Top reason</th>
                </tr>
              </thead>
              <tbody>
                {result.rankedProjects.map((row) => {
                  const active = selected?.projectId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`.trim()}
                      onClick={() => setSelectedProjectId(row.id)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{row.project}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierTone(row.tier)}`}>{row.tier}</span></td>
                      <td className="px-3 py-2 text-slate-900">{row.score.total}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.openWorkTotal}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.dueNow}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.blocked}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.cleanupQueue + row.breakdown.integrityReview}</td>
                      <td className="px-3 py-2 text-slate-700">{row.score.closeoutOpportunity}</td>
                      <td className="px-3 py-2 text-slate-600">{row.topReasonSummary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppShellCard>

      <AppShellCard surface="inspector" className="space-y-4">
        <SectionHeader title={selected ? selected.project : 'Project detail'} subtitle="Selected project drilldown: risk drivers, distortion pressure, and closeout route options." compact />

        {selected ? (
          <>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-[11px] uppercase tracking-[0.12em] text-slate-500">Top drivers</div>
                <ul className="mt-1 space-y-1 text-xs text-slate-700">
                  {selected.summary.topDrivers.map((driver) => <li key={driver}>• {driver}</li>)}
                </ul>
              </div>
              <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
                <div><strong>Biggest risk:</strong> {selected.summary.biggestRisk}</div>
                <div className="mt-1"><strong>Cleanup distortion:</strong> {selected.summary.biggestCleanupDistortion}</div>
                <div className="mt-1"><strong>Best closeout opportunity:</strong> {selected.summary.bestCloseoutOpportunity}</div>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">Execution pressure <strong className="block text-base">{selected.score.executionPressure}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Cleanup distortion <strong className="block text-base">{selected.score.cleanupDistortion}</strong></div>
              <div className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-900">Closeout opportunity <strong className="block text-base">{selected.score.closeoutOpportunity}</strong></div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Highest-pressure records</div>
              <RecordTable rows={selected.highestPressureRows} empty="No immediate pressure records for this project." />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cleanup / trust distortion records</div>
              <RecordTable rows={selected.cleanupRows} empty="No cleanup distortion records currently attached." />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Closeout opportunities</div>
              <RecordTable rows={selected.closeoutRows} empty="No closeout-ready records currently detected." />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button
                className="action-btn"
                onClick={() => selected.routeContext.projectId && onOpenDirectoryProject(selected.routeContext.projectId)}
                disabled={!selected.routeContext.projectId}
              >
                <FolderKanban className="h-4 w-4" />Open in Projects
              </button>
              <button className="action-btn" onClick={handleOpenFollowUps}><ArrowUpRight className="h-4 w-4" />Open Follow Ups</button>
              <button className="action-btn" onClick={handleOpenTasks}><ListChecks className="h-4 w-4" />Open Tasks</button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">Select a ranked project to view detailed health drivers.</div>
        )}
      </AppShellCard>
    </div>
  );
}
