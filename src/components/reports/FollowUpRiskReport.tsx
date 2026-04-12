import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { ReportViewProps } from './reportModels';

export function FollowUpRiskReport({ metrics, queue }: ReportViewProps) {
  const followUpRows = queue.filter((row) => row.recordType === 'followup');
  const waiting = followUpRows.filter((row) => row.queueFlags.waiting).length;

  return (
    <div className="space-y-4">
      <AppShellCard surface="data" className="space-y-3">
        <SectionHeader title="Follow-up risk" subtitle="Foundation slice: pressure in active commitments and waiting dependencies." compact />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Due now" value={metrics.dueNow} tone="danger" />
          <StatTile label="Blocked" value={metrics.blocked} tone="warn" />
          <StatTile label="Waiting" value={waiting} tone="info" />
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector">
        <p className="text-sm text-slate-700">Next slice: commitment aging buckets, escalation-level breakdown, and dependency-chain risk mapping.</p>
      </AppShellCard>
    </div>
  );
}
