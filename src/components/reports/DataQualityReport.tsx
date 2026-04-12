import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { ReportViewProps } from './reportModels';

export function DataQualityReport({ metrics, queue }: ReportViewProps) {
  const orphanedTasks = queue.filter((row) => row.recordType === 'task' && row.queueFlags.orphanedTask).length;

  return (
    <div className="space-y-4">
      <AppShellCard surface="data" className="space-y-3">
        <SectionHeader title="Data quality / cleanup" subtitle="Foundation slice: records needing cleanup before they can be trusted as execution truth." compact />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Needs cleanup" value={metrics.cleanup} tone="warn" />
          <StatTile label="Orphaned tasks" value={orphanedTasks} tone="info" />
          <StatTile label="Ready to close" value={metrics.readyToClose} tone="default" helper="Close-ready items can reduce queue noise once confirmed." />
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector">
        <p className="text-sm text-slate-700">Next slice: cleanup reason grouping, missing-field diagnostics, and remediation queue workflows.</p>
      </AppShellCard>
    </div>
  );
}
