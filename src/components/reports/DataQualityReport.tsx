import { AlertTriangle, ArrowUpRight, FolderKanban, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type {
  DataQualityAffectedRecord,
  DataQualityCategory,
  DataQualityReportResult,
  DataQualitySeverity,
} from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { WorkspaceKey } from '../../lib/appModeConfig';

function severityTone(severity: DataQualitySeverity) {
  if (severity === 'Critical') return 'text-rose-700 bg-rose-50';
  if (severity === 'High') return 'text-amber-700 bg-amber-50';
  if (severity === 'Moderate') return 'text-sky-700 bg-sky-50';
  return 'text-slate-700 bg-slate-100';
}

function categoryLabel(category: DataQualityCategory): string {
  if (category === 'structural_linkage') return 'Structural linkage';
  if (category === 'ownership_assignment') return 'Ownership / assignment';
  if (category === 'provenance_trust') return 'Provenance / trust';
  if (category === 'draft_incomplete') return 'Draft / incomplete';
  if (category === 'cleanup_operational') return 'Cleanup operational debt';
  return 'Orphaned execution';
}

export function DataQualityReport({
  result,
  onOpenDirectoryProject,
  onSetWorkspace,
}: {
  result: DataQualityReportResult;
  onOpenDirectoryProject: (projectId: string) => void;
  onSetWorkspace: (workspace: WorkspaceKey) => void;
}) {
  const openExecutionLane = useAppStore((state) => state.openExecutionLane);
  const setFollowUpFilters = useAppStore((state) => state.setFollowUpFilters);
  const setTaskWorkspaceSession = useAppStore((state) => state.setTaskWorkspaceSession);

  const [selectedBucketId, setSelectedBucketId] = useState<string | undefined>(result.defaultSelectedBucketId);
  const [selectedRecordKey, setSelectedRecordKey] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!result.rankedBuckets.length) {
      setSelectedBucketId(undefined);
      setSelectedRecordKey(undefined);
      return;
    }

    setSelectedBucketId((current) => {
      if (current && result.drilldownsByBucketId[current]) return current;
      return result.defaultSelectedBucketId ?? result.rankedBuckets[0]?.id;
    });
  }, [result.defaultSelectedBucketId, result.drilldownsByBucketId, result.rankedBuckets]);

  const selected = useMemo(
    () => (selectedBucketId ? result.drilldownsByBucketId[selectedBucketId] : undefined)
      ?? (result.defaultSelectedBucketId ? result.drilldownsByBucketId[result.defaultSelectedBucketId] : undefined),
    [result.defaultSelectedBucketId, result.drilldownsByBucketId, selectedBucketId],
  );

  useEffect(() => {
    if (!selected?.representativeRecords.length) {
      setSelectedRecordKey(undefined);
      return;
    }
    setSelectedRecordKey((current) => {
      if (current && selected.representativeRecords.some((entry) => `${entry.recordType}:${entry.id}` === current)) return current;
      const first = selected.representativeRecords[0];
      return `${first.recordType}:${first.id}`;
    });
  }, [selected]);

  const selectedRecord = useMemo(
    () => selected?.representativeRecords.find((entry) => `${entry.recordType}:${entry.id}` === selectedRecordKey) ?? selected?.representativeRecords[0],
    [selected, selectedRecordKey],
  );

  const openRecord = (record: DataQualityAffectedRecord | undefined) => {
    if (!record || !selected) return;
    if (record.recordType === 'followup') {
      openExecutionLane('followups', {
        recordId: record.id,
        recordType: 'followup',
        project: record.project,
        source: 'overview',
        sourceRecordId: selected.routeContext.primaryProjectId,
        section: 'triage',
        routeKind: 'action',
        intentLabel: `data quality ${categoryLabel(selected.category)}`,
      });
      setFollowUpFilters({ project: record.project || 'All', owner: record.owner || 'All' });
      onSetWorkspace('followups');
      return;
    }

    openExecutionLane('tasks', {
      recordId: record.id,
      recordType: 'task',
      project: record.project,
      source: 'overview',
      sourceRecordId: selected.routeContext.primaryProjectId,
      section: selected.category === 'orphaned_execution' ? 'triage' : 'blocked',
      routeKind: 'action',
      intentLabel: `data quality ${categoryLabel(selected.category)}`,
    });
    setTaskWorkspaceSession({ projectFilter: record.project || 'All', ownerFilter: record.owner || 'All', view: selected.category === 'orphaned_execution' ? 'unlinked' : 'review' });
    onSetWorkspace('tasks');
  };

  const openBucketFollowUps = () => {
    if (!selected) return;
    openExecutionLane('followups', {
      recordId: selected.routeContext.representativeFollowUpId,
      recordType: selected.routeContext.representativeFollowUpId ? 'followup' : undefined,
      project: selected.routeContext.primaryProject,
      source: 'projects',
      sourceRecordId: selected.routeContext.primaryProjectId,
      section: 'triage',
      routeKind: 'review',
      intentLabel: `data quality ${categoryLabel(selected.category)}`,
    });
    setFollowUpFilters({ project: selected.routeContext.primaryProject || 'All' });
    onSetWorkspace('followups');
  };

  const openBucketTasks = () => {
    if (!selected) return;
    openExecutionLane('tasks', {
      recordId: selected.routeContext.representativeTaskId,
      recordType: selected.routeContext.representativeTaskId ? 'task' : undefined,
      project: selected.routeContext.primaryProject,
      source: 'projects',
      sourceRecordId: selected.routeContext.primaryProjectId,
      section: selected.category === 'orphaned_execution' ? 'triage' : 'blocked',
      routeKind: 'review',
      intentLabel: `data quality ${categoryLabel(selected.category)}`,
    });
    setTaskWorkspaceSession({ projectFilter: selected.routeContext.primaryProject || 'All', view: selected.category === 'orphaned_execution' ? 'unlinked' : 'review' });
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
          <StatTile label="Needs cleanup" value={result.cleanupCount} tone={result.cleanupCount ? 'warn' : 'default'} />
          <StatTile label="Orphaned tasks" value={result.orphanedTaskCount} tone={result.orphanedTaskCount ? 'warn' : 'default'} />
          <StatTile label="Draft records" value={result.draftCount} tone={result.draftCount ? 'info' : 'default'} />
          <StatTile label="Routing-broken" value={result.routingBrokenCount} tone={result.routingBrokenCount ? 'danger' : 'default'} />
          <StatTile label="Top-priority buckets" value={result.highestPriorityBucketCount} tone={result.highestPriorityBucketCount ? 'danger' : 'default'} />
        </div>

        {!result.rankedBuckets.length ? (
          <div className="rounded-2xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">
            No significant data-quality remediation buckets detected in this report scope.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Issue family</th>
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Priority</th>
                  <th className="px-3 py-2">Affected</th>
                  <th className="px-3 py-2">Top reason</th>
                  <th className="px-3 py-2">Remediation focus</th>
                  <th className="px-3 py-2">Trust impact</th>
                </tr>
              </thead>
              <tbody>
                {result.rankedBuckets.map((row) => {
                  const active = selected?.bucketId === row.id;
                  return (
                    <tr
                      key={row.id}
                      className={`cursor-pointer border-t border-slate-100 ${active ? 'bg-sky-50/70' : 'hover:bg-slate-50'}`.trim()}
                      onClick={() => setSelectedBucketId(row.id)}
                    >
                      <td className="px-3 py-2 font-medium text-slate-900">{categoryLabel(row.category)}</td>
                      <td className="px-3 py-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityTone(row.severity)}`}>{row.severity}</span></td>
                      <td className="px-3 py-2 text-slate-900">{row.priorityScore}</td>
                      <td className="px-3 py-2 text-slate-700">{row.affectedCount}</td>
                      <td className="px-3 py-2 text-slate-600">{row.topReasonSummary}</td>
                      <td className="px-3 py-2 text-slate-600">{row.remediationFocus}</td>
                      <td className="px-3 py-2 text-slate-700">{row.materiallyDistortsTrust ? 'Material' : 'Limited'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AppShellCard>

      <AppShellCard surface="inspector" className="space-y-4">
        <SectionHeader title={selected ? categoryLabel(selected.category) : 'Issue bucket detail'} subtitle="Selected remediation bucket drilldown: priority basis, representative records, and route-to-fix actions." compact />

        {selected ? (
          <>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-900">{categoryLabel(selected.category)}</div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityTone(selected.severity)}`}>{selected.severity}</span>
              </div>
              <div className="mt-1">{selected.whyPrioritized}</div>
              <div className="mt-1"><strong>Remediation focus:</strong> {selected.remediationGuidance}</div>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-rose-50 p-3 text-xs text-rose-900">Trust distortion <strong className="block text-base">{selected.breakdown.trustDistortionCount}</strong></div>
              <div className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">Routing broken <strong className="block text-base">{selected.breakdown.routingBrokenCount}</strong></div>
              <div className="rounded-xl bg-slate-100 p-3 text-xs text-slate-800">Execution blocked <strong className="block text-base">{selected.breakdown.executionBlockedCount}</strong></div>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Structured drivers</div>
              <ul className="space-y-2 text-xs">
                {selected.drivers.map((driver) => (
                  <li key={driver.key} className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900">{driver.label}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">+{driver.impact}</span>
                    </div>
                    {driver.detail ? <div className="mt-1 text-slate-600">{driver.detail}</div> : null}
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Representative affected records</div>
              {!selected.representativeRecords.length ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">No representative records available for this bucket.</div>
              ) : (
                <div className="space-y-2">
                  {selected.representativeRecords.map((record) => {
                    const active = selectedRecord && selectedRecord.id === record.id && selectedRecord.recordType === record.recordType;
                    return (
                      <button
                        type="button"
                        key={`${record.recordType}:${record.id}:${record.reasonKey}`}
                        className={`w-full rounded-xl border px-3 py-2 text-left text-xs ${active ? 'border-sky-400 bg-sky-50/70' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                        onClick={() => setSelectedRecordKey(`${record.recordType}:${record.id}`)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-slate-900">{record.title}</span>
                          <span className="uppercase tracking-[0.08em] text-slate-500">{record.recordType}</span>
                        </div>
                        <div className="mt-1 text-slate-600">{record.project} • {record.owner || 'Unassigned'}</div>
                        <div className="mt-1 text-slate-600">{record.reasonLabel}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {selectedRecord ? (
              <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">Selected record</div>
                <div className="mt-1">{selectedRecord.title} ({selectedRecord.recordType})</div>
                <div className="mt-1"><strong>Issue:</strong> {selectedRecord.reasonLabel}</div>
                <div className="mt-1"><strong>Impact area:</strong> {selectedRecord.impactLabel}</div>
                <button type="button" className="action-btn mt-2" onClick={() => openRecord(selectedRecord)}><ArrowUpRight className="h-4 w-4" />Open selected record</button>
              </div>
            ) : null}

            <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700">
              <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">What should happen next</div>
              <ul className="space-y-1">
                {selected.nextActions.map((step) => <li key={step}>• {step}</li>)}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
              <button className="action-btn" onClick={openBucketFollowUps}><ArrowUpRight className="h-4 w-4" />Route to Follow Ups</button>
              <button className="action-btn" onClick={openBucketTasks}><ListChecks className="h-4 w-4" />Route to Tasks</button>
              <button
                className="action-btn"
                disabled={!selected.routeContext.primaryProjectId}
                onClick={() => selected.routeContext.primaryProjectId && onOpenDirectoryProject(selected.routeContext.primaryProjectId)}
              >
                <FolderKanban className="h-4 w-4" />Open related Project
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-500">
            <AlertTriangle className="mx-auto mb-2 h-4 w-4" />
            Select an issue bucket to inspect remediation detail.
          </div>
        )}
      </AppShellCard>
    </div>
  );
}
