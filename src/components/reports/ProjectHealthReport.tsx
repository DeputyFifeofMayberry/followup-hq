import { AppShellCard, SectionHeader, StatTile } from '../ui/AppPrimitives';
import type { ReportViewProps } from './reportModels';

export function ProjectHealthReport({ metrics, queue }: ReportViewProps) {
  const topProjects = Object.entries(queue.reduce<Record<string, number>>((acc, row) => {
    acc[row.project] = (acc[row.project] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
      <AppShellCard surface="data" className="space-y-4">
        <SectionHeader title="Project health" subtitle="Foundation slice: pressure concentration and queue load by project." compact />
        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile label="Blocked work" value={metrics.blocked} tone="warn" />
          <StatTile label="Cleanup pressure" value={metrics.cleanup} tone="info" />
          <StatTile label="Ready to close" value={metrics.readyToClose} tone="default" />
        </div>
      </AppShellCard>
      <AppShellCard surface="inspector" className="space-y-2">
        <SectionHeader title="Top loaded projects" subtitle="Highest open queue volume currently." compact />
        <ul className="space-y-2 text-sm text-slate-700">
          {topProjects.map(([project, count]) => <li key={project} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2"><span>{project}</span><strong>{count}</strong></li>)}
        </ul>
        <p className="text-xs text-slate-500">Next slice: project risk score + trend deltas across follow-ups/tasks.</p>
      </AppShellCard>
    </div>
  );
}
