import type { ProjectHealthReportResult } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';

export function ProjectHealthReport({ result }: { result: ProjectHealthReportResult }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
      <AppShellCard surface="data" className="space-y-4">
        <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {result.header.highlights.map((card) => (
            <StatTile key={card.id} label={card.label} value={card.value} tone={card.tone} helper={card.helper} />
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-3 py-2">Project</th>
                <th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Open</th>
                <th className="px-3 py-2">Blocked</th>
                <th className="px-3 py-2">Cleanup</th>
                <th className="px-3 py-2">Due now</th>
                <th className="px-3 py-2">Closeout opp.</th>
              </tr>
            </thead>
            <tbody>
              {result.rankedProjects.map((row) => (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium text-slate-900">{row.project}</td>
                  <td className="px-3 py-2 capitalize text-slate-700">{row.severity.replace('_', ' ')}</td>
                  <td className="px-3 py-2 text-slate-700">{row.openTotal}</td>
                  <td className="px-3 py-2 text-slate-700">{row.blockedTotal}</td>
                  <td className="px-3 py-2 text-slate-700">{row.cleanupTotal}</td>
                  <td className="px-3 py-2 text-slate-700">{row.dueNowTotal}</td>
                  <td className="px-3 py-2 text-slate-700">{row.readyToCloseTotal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector" className="space-y-2">
        <SectionHeader title="Top project pressure drivers" subtitle="Highest-weight reasons for the highest ranked project." compact />
        <ul className="space-y-2 text-sm text-slate-700">
          {(result.rankedProjects[0]?.reasons ?? []).map((reason) => (
            <li key={reason.label} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>{reason.label}</span><strong>{reason.weight}</strong></li>
          ))}
        </ul>
      </AppShellCard>
    </div>
  );
}
