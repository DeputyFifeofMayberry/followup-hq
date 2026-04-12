import { AlertTriangle, ArrowUpRight, FolderKanban, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { OwnerWorkloadCategory, OwnerWorkloadDrilldown, OwnerWorkloadReportResult, OwnerWorkloadRow } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { WorkspaceKey } from '../../lib/appModeConfig';

function tierTone(tier: OwnerWorkloadRow['tier']) {
  if (tier === 'Overloaded') return 'text-rose-700 bg-rose-50';
  if (tier === 'High') return 'text-amber-700 bg-amber-50';
  if (tier === 'Watch') return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
}

function pressureLabel(pressure: OwnerWorkloadCategory): string {
  if (pressure === 'urgency_pressure') return 'Urgency';
  if (pressure === 'blocked_pressure') return 'Blocked';
  if (pressure === 'waiting_pressure') return 'Waiting';
  if (pressure === 'cleanup_distortion') return 'Cleanup';
  if (pressure === 'risk_concentration') return 'Severe risk';
  if (pressure === 'closeout_relief') return 'Closeout relief';
  return 'Volume';
}

function DetailTable({ rows, empty }: { rows: OwnerWorkloadDrilldown['highestPressureRows']; empty: string }) {
  if (!rows.length) return <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">{empty}</div>;
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-xs">
        <thead className="bg-slate-50 text-left uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th className="px-2 py-2">Record</th>
            <th className="px-2 py-2">Project</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2">Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-t border-slate-100">
              <td className="px-2 py-2 text-slate-900">{row.title}</td>
              <td className="px-2 py-2 text-slate-700">{row.project}</td>
              <td className="px-2 py-2 text-slate-700">{row.status}</td>
              <td className="px-2 py-2 text-slate-600">{row.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function OwnerWorkloadReport({
  result,
  onOpenDirectoryProject,
  onSetWorkspace,
}: {
  result: OwnerWorkloadReportResult;
  onOpenDirectoryProject: (projectId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}) {
  const openExecutionLane = useAppStore((state) => state.openExecutionLane);
  const setFollowUpFilters = useAppStore((state) => state.setFollowUpFilters);
  const setTaskWorkspaceSession = useAppStore((state) => state.setTaskWorkspaceSession);

  const [selectedOwnerId, setSelectedOwnerId] = useState<string | undefined>(result.defaultSelectedOwnerId);

  useEffect(() => {
    if (!result.rankedOwners.length) {
      setSelectedOwnerId(undefined);
      return;
    }

    setSelectedOwnerId((current) => {
      if (current && result.drilldownsByOwnerId[current]) return current;
      return result.defaultSelectedOwnerId ?? result.rankedOwners[0]?.id;
    });
  }, [result.defaultSelectedOwnerId, result.drilldownsByOwnerId, result.rankedOwners]);

  const selected = useMemo(
    () => (selectedOwnerId ? result.drilldownsByOwnerId[selectedOwnerId] : undefined)
      ?? (result.defaultSelectedOwnerId ? result.drilldownsByOwnerId[result.defaultSelectedOwnerId] : undefined),
    [result.defaultSelectedOwnerId, result.drilldownsByOwnerId, selectedOwnerId],
  );

  const handleOpenFollowUps = () => {
    if (!selected) return;
    openExecutionLane('followups', {
      recordId: selected.routeContext.hottestFollowUpId,
      recordType: selected.routeContext.hottestFollowUpId ? 'followup' : undefined,
      project: selected.routeContext.primaryProject,
      source: 'overview',
      sourceRecordId: selected.routeContext.primaryProjectId,
      section: selected.score.urgencyPressure > selected.score.blockedPressure ? 'now' : 'triage',
      routeKind: 'action',
      intentLabel: `owner workload ${selected.owner}`,
    });
    setFollowUpFilters({ owner: selected.owner, project: selected.routeContext.primaryProject || 'All' });
    onSetWorkspace('followups');
  };

  const handleOpenTasks = () => {
    if (!selected) return;
    openExecutionLane('tasks', {
      recordId: selected.routeContext.hottestTaskId,
      recordType: selected.routeContext.hottestTaskId ? 'task' : undefined,
      project: selected.routeContext.primaryProject,
      source: 'overview',
      sourceRecordId: selected.routeContext.primaryProjectId,
      section: selected.score.blockedPressure > 0 ? 'blocked' : 'now',
      routeKind: 'action',
      intentLabel: `owner workload tasks ${selected.owner}`,
    });
    setTaskWorkspaceSession({ ownerFilter: selected.owner, projectFilter: selected.routeContext.primaryProject || 'All' });
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
          <StatTile label="Overloaded owners" value={result.overloadedOwnerCount} tone={result.overloadedOwnerCount ? 'danger' : 'default'} />
          <StatTile label="Due-now-heavy" value={result.dueNowHeavyOwnerCount} tone={result.dueNowHeavyOwnerCount ? 'warn' : 'default'} />
          <StatTile label="Blocked-heavy" value={result.blockedHeavyOwnerCount} tone={result.blockedHeavyOwnerCount ? 'warn' : 'default'} />
          <StatTile label="Waiting-heavy" value={result.waitingHeavyOwnerCount} tone={result.waitingHeavyOwnerCount ? 'info' : 'default'} />
          <StatTile label="Cleanup-distorted" value={result.cleanupDistortedOwnerCount} tone={result.cleanupDistortedOwnerCount ? 'info' : 'default'} />
        </div>

        {!result.rankedOwners.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
            No owner workload signals detected in the current report scope.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Open workload</th>
                  <th className="px-3 py-2">Due now</th>
                  <th className="px-3 py-2">Blocked</th>
                  <th className="px-3 py-2">Waiting</th>
                  <th className="px-3 py-2">Cleanup</th>
                  <th className="px-3 py-2">Top driver</th>
                </tr>
              </thead>
              <tbody>
                {result.rankedOwners.map((row) => {
                  const active = selected?.owner === row.owner;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`.trim()}
                      onClick={() => setSelectedOwnerId(row.id)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{row.owner}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierTone(row.tier)}`}>{row.tier}</span></td>
                      <td className="px-3 py-2 text-slate-900">{row.score.total}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.openTotal}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.dueNowTotal}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.blockedTotal}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.waitingTotal}</td>
                      <td className="px-3 py-2 text-slate-700">{row.breakdown.cleanupTotal}</td>
                      <td className="px-3 py-2 text-slate-600">{row.topDriverSummary}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppShellCard>

      <AppShellCard surface="inspector" className="space-y-4">
        <SectionHeader title={selected ? selected.owner : 'Owner detail'} subtitle="Selected owner drilldown: pressure mix, workload drivers, and direct route-to-action options." compact />

        {selected ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{selected.owner}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${tierTone(selected.tier)}`}>{selected.tier}</span>
              </div>
              <div className="mt-1">{selected.narrative}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">Urgency pressure <strong className="block text-base">{selected.score.urgencyPressure}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Blocked + waiting <strong className="block text-base">{selected.score.blockedPressure + selected.score.waitingPressure}</strong></div>
              <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-800">Cleanup + severe risk <strong className="block text-base">{selected.score.cleanupDistortion + selected.score.riskConcentration}</strong></div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Workload breakdown</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>Open follow-ups/tasks: <strong>{selected.breakdown.followUpOpen}/{selected.breakdown.taskOpen}</strong></div>
                <div>Overdue / due now: <strong>{selected.breakdown.overdueTotal}/{selected.breakdown.dueNowTotal}</strong></div>
                <div>Blocked records: <strong>{selected.breakdown.blockedTotal}</strong></div>
                <div>Waiting records: <strong>{selected.breakdown.waitingTotal}</strong></div>
                <div>Waiting too long: <strong>{selected.breakdown.waitingTooLongTotal}</strong></div>
                <div>Cleanup distortion: <strong>{selected.breakdown.cleanupTotal}</strong></div>
                <div>Severe-risk concentration: <strong>{selected.breakdown.severeTotal}</strong></div>
                <div>Closeout opportunities: <strong>{selected.breakdown.closeoutReadyTotal}</strong></div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Structured workload drivers</div>
              <ul className="space-y-2 text-xs">
                {selected.drivers.map((driver) => (
                  <li key={driver.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{driver.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">{driver.impact > 0 ? '+' : ''}{driver.impact}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.08em] text-slate-500">{pressureLabel(driver.category)}</div>
                    {driver.detail ? <div className="mt-1 text-slate-600">{driver.detail}</div> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Highest-pressure records</div>
              <DetailTable rows={selected.highestPressureRows} empty="No immediate high-pressure records for this owner." />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Blocked / waiting records</div>
              <DetailTable rows={selected.blockedRows} empty="No blocked or waiting drag signals currently attached." />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Cleanup-distorted records</div>
              <DetailTable rows={selected.cleanupRows} empty="No cleanup-distorted records currently attached." />
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button className="action-btn" onClick={handleOpenFollowUps}><ArrowUpRight className="h-4 w-4" />Open Follow Ups</button>
              <button className="action-btn" onClick={handleOpenTasks}><ListChecks className="h-4 w-4" />Open Tasks</button>
              <button
                className="action-btn"
                disabled={!selected.routeContext.primaryProjectId}
                onClick={() => selected.routeContext.primaryProjectId && onOpenDirectoryProject(selected.routeContext.primaryProjectId)}
              >
                <FolderKanban className="h-4 w-4" />Open primary Project
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            <AlertTriangle className="mx-auto mb-2 h-4 w-4" />
            Select a ranked owner to inspect workload pressure drivers.
          </div>
        )}
      </AppShellCard>
    </div>
  );
}
