import { AppShellCard, SectionHeader } from '../ui/AppPrimitives';
import type { ReportViewProps } from './reportModels';

export function OwnerWorkloadReport({ queue }: ReportViewProps) {
  const owners = Object.entries(queue.reduce<Record<string, { total: number; blocked: number }>>((acc, row) => {
    if (!acc[row.owner]) acc[row.owner] = { total: 0, blocked: 0 };
    acc[row.owner].total += 1;
    if (row.queueFlags.blocked) acc[row.owner].blocked += 1;
    return acc;
  }, {})).sort((a, b) => b[1].total - a[1].total).slice(0, 8);

  return (
    <AppShellCard surface="data" className="space-y-3">
      <SectionHeader title="Owner workload" subtitle="Foundation slice: current open queue load per owner with blocked pressure." compact />
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
            <tr><th className="px-3 py-2">Owner</th><th className="px-3 py-2">Open queue items</th><th className="px-3 py-2">Blocked items</th></tr>
          </thead>
          <tbody>
            {owners.map(([owner, summary]) => (
              <tr key={owner} className="border-t border-slate-100">
                <td className="px-3 py-2 font-medium text-slate-900">{owner}</td>
                <td className="px-3 py-2">{summary.total}</td>
                <td className="px-3 py-2">{summary.blocked}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">Next slice: capacity balancing, due-window workload, and owner trend deltas.</p>
    </AppShellCard>
  );
}
