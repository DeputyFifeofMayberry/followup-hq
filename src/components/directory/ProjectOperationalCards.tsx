import type { ProjectDerivedRecord } from '../../lib/projectSelectors';

interface ProjectOperationalCardsProps {
  rows: ProjectDerivedRecord[];
  onSelectProject: (projectId: string) => void;
}

export function ProjectOperationalCards({ rows, onSelectProject }: ProjectOperationalCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => (
        <button key={row.project.id} className="rounded-xl border border-slate-200 p-3 text-left" onClick={() => onSelectProject(row.project.id)}>
          <div className="font-semibold text-slate-900">{row.project.name}</div>
          <div className="mt-1 text-xs text-slate-600">Pressure {row.health.score} • {row.health.tier}</div>
          <div className="mt-2 text-xs text-slate-600">Overdue {row.overdueFollowUpCount + row.overdueTaskCount} • Blocked {row.blockedTaskCount}</div>
        </button>
      ))}
    </div>
  );
}
