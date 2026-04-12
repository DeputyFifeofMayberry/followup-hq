import { AlertTriangle, ArrowUpRight, FolderKanban, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { FollowUpRiskCategory, FollowUpRiskDrilldown, FollowUpRiskReportResult, FollowUpRiskRow } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { WorkspaceKey } from '../../lib/appModeConfig';

function tierTone(tier: FollowUpRiskRow['tier']) {
  if (tier === 'Severe') return 'text-rose-700 bg-rose-50';
  if (tier === 'High') return 'text-amber-700 bg-amber-50';
  if (tier === 'Watch') return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
}

function riskCategoryLabel(category: FollowUpRiskCategory): string {
  if (category === 'timing_pressure') return 'Timing';
  if (category === 'dependency_waiting') return 'Dependency';
  if (category === 'execution_block') return 'Execution block';
  if (category === 'cleanup_distortion') return 'Cleanup';
  if (category === 'escalation_risk') return 'Escalation';
  return 'Missing plan';
}

function formatDaySignal(days?: number, overdueLabel = 'Overdue'): string {
  if (days === undefined) return '—';
  if (days < 0) return `${Math.abs(days)}d ${overdueLabel.toLowerCase()}`;
  if (days === 0) return 'Today';
  return `in ${days}d`;
}

function DriverList({ drivers }: { drivers: FollowUpRiskDrilldown['drivers'] }) {
  if (!drivers.length) return <div className="text-xs text-slate-500">No major driver captured.</div>;
  return (
    <ul className="space-y-2 text-xs">
      {drivers.map((driver) => (
        <li key={driver.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">{driver.label}</span>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">+{driver.impact}</span>
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-slate-500">{riskCategoryLabel(driver.category)}</div>
          {driver.detail ? <div className="mt-1 text-slate-600">{driver.detail}</div> : null}
        </li>
      ))}
    </ul>
  );
}

export function FollowUpRiskReport({
  result,
  onOpenDirectoryProject,
  onSetWorkspace,
}: {
  result: FollowUpRiskReportResult;
  onOpenDirectoryProject: (projectId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}) {
  const openExecutionLane = useAppStore((state) => state.openExecutionLane);
  const [selectedFollowUpId, setSelectedFollowUpId] = useState<string | undefined>(result.defaultSelectedFollowUpId);

  useEffect(() => {
    if (!result.rankedFollowUps.length) {
      setSelectedFollowUpId(undefined);
      return;
    }

    setSelectedFollowUpId((current) => {
      if (current && result.drilldownsByFollowUpId[current]) return current;
      return result.defaultSelectedFollowUpId ?? result.rankedFollowUps[0]?.followUpId;
    });
  }, [result.defaultSelectedFollowUpId, result.drilldownsByFollowUpId, result.rankedFollowUps]);

  const selected = useMemo(
    () => (selectedFollowUpId ? result.drilldownsByFollowUpId[selectedFollowUpId] : undefined)
      ?? (result.defaultSelectedFollowUpId ? result.drilldownsByFollowUpId[result.defaultSelectedFollowUpId] : undefined),
    [result.defaultSelectedFollowUpId, result.drilldownsByFollowUpId, selectedFollowUpId],
  );

  const handleOpenFollowUp = () => {
    if (!selected) return;
    openExecutionLane('followups', {
      recordId: selected.followUpId,
      recordType: 'followup',
      project: selected.project,
      source: 'overview',
      sourceRecordId: selected.routeContext.projectId,
      routeKind: 'review',
      intentLabel: `follow-up risk ${selected.title}`,
    });
    onSetWorkspace('followups');
  };

  const handleOpenTasks = () => {
    if (!selected) return;
    openExecutionLane('tasks', {
      recordId: selected.routeContext.primaryTaskId,
      recordType: selected.routeContext.primaryTaskId ? 'task' : undefined,
      project: selected.project,
      source: 'overview',
      sourceRecordId: selected.routeContext.projectId,
      section: selected.score.executionBlock > 0 ? 'blocked' : 'now',
      routeKind: 'action',
      intentLabel: `follow-up risk linked tasks ${selected.title}`,
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

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <StatTile label="Due-now risk" value={result.dueNowRiskCount} tone={result.dueNowRiskCount ? 'danger' : 'default'} helper="Overdue + today commitments" />
          <StatTile label="Waiting / dependency" value={result.waitingDependencyRiskCount} tone={result.waitingDependencyRiskCount ? 'warn' : 'default'} />
          <StatTile label="Blocked execution" value={result.blockedExecutionRiskCount} tone={result.blockedExecutionRiskCount ? 'warn' : 'default'} />
          <StatTile label="Escalation risk" value={result.escalationRiskCount} tone={result.escalationRiskCount ? 'danger' : 'default'} />
          <StatTile label="Cleanup distortion" value={result.cleanupDistortedCount} tone={result.cleanupDistortedCount ? 'info' : 'default'} />
        </div>

        {!result.rankedFollowUps.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
            No follow-up risk signals detected in the current report scope.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Follow-up</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Risk basis</th>
                  <th className="px-3 py-2">Due</th>
                  <th className="px-3 py-2">Next touch</th>
                  <th className="px-3 py-2">Waiting</th>
                  <th className="px-3 py-2">Child tasks</th>
                  <th className="px-3 py-2">Escalation</th>
                </tr>
              </thead>
              <tbody>
                {result.rankedFollowUps.map((row) => {
                  const active = selected?.followUpId === row.followUpId;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`.trim()}
                      onClick={() => setSelectedFollowUpId(row.followUpId)}
                    >
                      <td className="px-3 py-2">
                        <div className="font-medium text-slate-900">{row.title}</div>
                        <div className="text-xs text-slate-500">{row.project} • {row.owner}</div>
                      </td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierTone(row.tier)}`}>{row.tier}</span></td>
                      <td className="px-3 py-2 text-slate-900">{row.score}</td>
                      <td className="px-3 py-2 text-slate-700">
                        <div>{riskCategoryLabel(row.topRiskCategory)}</div>
                        <div className="text-xs text-slate-500">{row.topRiskSummary}</div>
                      </td>
                      <td className="px-3 py-2 text-slate-700">{formatDaySignal(row.breakdown.dueInDays)}</td>
                      <td className="px-3 py-2 text-slate-700">{formatDaySignal(row.breakdown.nextTouchInDays)}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.waitingOn || (row.breakdown.waitingTooLong ? 'Yes' : '—')}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.linkedBlockedTaskCount}/{row.breakdown.linkedOverdueTaskCount}</td>
                      <td className="px-3 py-2 text-slate-700">{row.riskScore.escalationRisk > 0 ? 'Active' : 'None'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppShellCard>

      <AppShellCard surface="inspector" className="space-y-4">
        <SectionHeader title={selected ? selected.title : 'Follow-up detail'} subtitle="Selected follow-up drilldown: explain risk drivers, timing/dependency pressure, and next action routes." compact />

        {selected ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{selected.project}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierTone(selected.tier)}`}>{selected.tier}</span>
              </div>
              <div className="mt-1">{selected.riskSummary}</div>
              <div className="mt-1"><strong>Recommended next move:</strong> {selected.recommendedNextMove}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">Timing pressure <strong className="block text-base">{selected.score.timingPressure}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Execution/dependency <strong className="block text-base">{selected.score.executionBlock + selected.score.dependencyWaiting}</strong></div>
              <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-800">Cleanup + plan clarity <strong className="block text-base">{selected.score.cleanupDistortion + selected.score.missingPlan}</strong></div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Timing / dependency / blockage</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Due: <strong>{formatDaySignal(selected.breakdown.dueInDays)}</strong></div>
                <div>Next touch: <strong>{formatDaySignal(selected.breakdown.nextTouchInDays)}</strong></div>
                <div>Promised: <strong>{formatDaySignal(selected.breakdown.promisedInDays)}</strong></div>
                <div>Waiting: <strong>{selected.breakdown.waitingOn || (selected.breakdown.waitingTooLong ? 'Yes' : 'No')}</strong></div>
                <div>Blocked state: <strong>{selected.breakdown.blocked ? 'Yes' : 'No'}</strong></div>
                <div>Stale touch: <strong>{selected.breakdown.staleTouchDays !== undefined ? `${selected.breakdown.staleTouchDays}d` : '—'}</strong></div>
                <div>Linked open tasks: <strong>{selected.breakdown.linkedOpenTaskCount}</strong></div>
                <div>Blocked/overdue linked tasks: <strong>{selected.breakdown.linkedBlockedTaskCount}/{selected.breakdown.linkedOverdueTaskCount}</strong></div>
                <div>Cleanup distortion: <strong>{selected.breakdown.cleanupRequired ? 'Yes' : 'No'}</strong></div>
                <div>Escalation: <strong>{selected.breakdown.escalated ? 'Active' : 'None'}</strong></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Structured risk drivers</div>
              <DriverList drivers={selected.drivers} />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button className="action-btn" onClick={handleOpenFollowUp}><ArrowUpRight className="h-4 w-4" />Open in Follow Ups</button>
              <button className="action-btn" onClick={handleOpenTasks}><ListChecks className="h-4 w-4" />Open related Tasks</button>
              <button
                className="action-btn"
                disabled={!selected.routeContext.projectId}
                onClick={() => selected.routeContext.projectId && onOpenDirectoryProject(selected.routeContext.projectId)}
              >
                <FolderKanban className="h-4 w-4" />Open Project
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            <AlertTriangle className="mx-auto mb-2 h-4 w-4" />
            Select a ranked follow-up to inspect operational risk drivers.
          </div>
        )}
      </AppShellCard>
    </div>
  );
}
