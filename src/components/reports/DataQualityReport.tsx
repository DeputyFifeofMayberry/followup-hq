import type { DataQualityReportResult } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';

export function DataQualityReport({ result }: { result: DataQualityReportResult }) {
  return (
    <div className="space-y-4">
      <AppShellCard surface="data" className="space-y-3">
        <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Needs cleanup" value={result.cleanupCount} tone="warn" />
          <StatTile label="Orphaned tasks" value={result.orphanedTaskCount} tone="info" />
          <StatTile label="Draft records" value={result.draftCount} tone="default" />
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector" className="space-y-2">
        <SectionHeader title="Top integrity review reasons" subtitle="Grouped by reason model so cleanup work can be triaged intentionally." compact />
        <ul className="space-y-2 text-sm text-slate-700">
          {result.reasons.map((reason) => (
            <li key={reason.reasonKey} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 gap-3">
              <span>{reason.label}</span>
              <strong>{reason.count}</strong>
            </li>
          ))}
        </ul>
      </AppShellCard>
    </div>
  );
}
