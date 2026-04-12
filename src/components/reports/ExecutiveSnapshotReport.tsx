import { AlertTriangle, CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import type { ExecutiveSnapshotReportResult, ReportTone } from '../../lib/reports';
import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';

const TONE_ICON: Record<ReportTone, typeof CheckCircle2> = {
  warn: Clock3,
  danger: AlertTriangle,
  info: ShieldAlert,
  default: CheckCircle2,
};

export function ExecutiveSnapshotReport({ result }: { result: ExecutiveSnapshotReportResult }) {
  const highestPressure = result.pressurePreview;

  return (
    <div className="space-y-4">
      <AppShellCard surface="data" className="space-y-4">
        <SectionHeader title={result.header.title} subtitle={result.header.subtitle} compact />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {result.header.highlights.map((card) => {
            const Icon = TONE_ICON[card.tone ?? 'default'];
            return (
              <div key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-[0.14em] text-slate-500">
                  <span>{card.label}</span>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="mt-2 text-3xl font-semibold text-slate-950">{card.value}</div>
                {card.helper ? <div className="mt-1 text-xs text-slate-500">{card.helper}</div> : null}
              </div>
            );
          })}
        </div>
      </AppShellCard>

      <AppShellCard surface="data" className="space-y-3">
        <SectionHeader
          title="Highest-pressure queue preview"
          subtitle="Top ranked mixed follow-up and task records based on urgency, blockage, cleanup pressure, and risk score."
          compact
        />
        {highestPressure.length ? (
          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-3 py-2">Record</th>
                  <th className="px-3 py-2">Project</th>
                  <th className="px-3 py-2">Pressure reason</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {highestPressure.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{row.title}</div>
                      <div className="text-xs text-slate-500">{row.recordType === 'task' ? 'Task' : 'Follow-up'} • {row.priority}</div>
                    </td>
                    <td className="px-3 py-2 text-slate-700">{row.project}</td>
                    <td className="px-3 py-2 text-slate-700">{row.pressureReason}</td>
                    <td className="px-3 py-2 text-slate-700">{row.owner}</td>
                    <td className="px-3 py-2 text-slate-700">{row.dueDate ? new Date(row.dueDate).toLocaleDateString() : 'No due date'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <StatTile label="Queue pressure" value="No open queue items" helper="Execution queue is clear for now." />
        )}
      </AppShellCard>
    </div>
  );
}
