import type { FollowUpRiskReportResult } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';

export function FollowUpRiskReport({ result }: { result: FollowUpRiskReportResult }) {
  return (
    <div className="space-y-4">
      <AppShellCard surface="data" className="space-y-3">
        <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="High risk" value={result.highRiskCount} tone="danger" />
          <StatTile label="Watch" value={result.watchCount} tone="warn" />
          <StatTile label="Stable" value={result.stableCount} tone="default" />
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector" className="space-y-3">
        <SectionHeader title="Ranked risky follow-ups" subtitle="Ordered by timing pressure, waiting dependencies, and child-task blockers." compact />
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Follow-up</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Top risk basis</th>
                <th className="px-3 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {result.rankedFollowUps.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2">
                    <div className="font-medium text-slate-900">{row.title}</div>
                    <div className="text-xs text-slate-500">{row.project}</div>
                  </td>
                  <td className="px-3 py-2 capitalize text-slate-700">{row.severity.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-slate-700">{row.reasons[0]?.label ?? 'General queue pressure'}</td>
                  <td className="px-3 py-2 text-slate-700">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShellCard>
    </div>
  );
}
