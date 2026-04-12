import type { OwnerWorkloadReportResult } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';

export function OwnerWorkloadReport({ result }: { result: OwnerWorkloadReportResult }) {
  return (
    <AppShellCard surface="data" className="space-y-3">
      <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
      <div className="grid gap-3 sm:grid-cols-3">
        {result.header.highlights.map((card) => (
          <StatTile key={card.id} label={card.label} value={card.value} tone={card.tone} helper={card.helper} />
        ))}
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr>
              <th className="px-3 py-2">Owner</th>
              <th className="px-3 py-2">Severity</th>
              <th className="px-3 py-2">Open workload</th>
              <th className="px-3 py-2">Blocked</th>
              <th className="px-3 py-2">Due now</th>
              <th className="px-3 py-2">Waiting</th>
            </tr>
          </thead>
          <tbody>
            {result.rankedOwners.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{row.owner}</td>
                <td className="px-3 py-2 capitalize text-slate-700">{row.severity.replace('_', ' ')}</td>
                <td className="px-3 py-2">{row.openTotal}</td>
                <td className="px-3 py-2">{row.blockedTotal}</td>
                <td className="px-3 py-2">{row.dueNowTotal}</td>
                <td className="px-3 py-2">{row.waitingTotal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShellCard>
  );
}
