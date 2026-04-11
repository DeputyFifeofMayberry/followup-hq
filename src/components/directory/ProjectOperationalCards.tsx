import { formatDate } from '../../lib/utils';
import type { ProjectDerivedRecord } from '../../lib/projectSelectors';

interface ProjectOperationalCardsProps {
  rows: ProjectDerivedRecord[];
  selectedProjectId: string;
  onSelectProject: (projectId: string) => void;
  onOpenFollowUp: (id: string) => void;
  onOpenTask: (id: string) => void;
}

export function ProjectOperationalCards({ rows, selectedProjectId, onSelectProject, onOpenFollowUp, onOpenTask }: ProjectOperationalCardsProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {rows.map((row) => {
        const isSelected = row.project.id === selectedProjectId;
        return (
          <div key={row.project.id} className={isSelected ? 'rounded-xl border border-slate-300 bg-slate-50 p-3 text-left' : 'rounded-xl border border-slate-200 p-3 text-left'}>
            <button className="w-full text-left" onClick={() => onSelectProject(row.project.id)}>
              <div className="font-semibold text-slate-900">{row.project.name}</div>
              <div className="mt-1 text-xs text-slate-600">{row.project.owner || 'Unassigned owner'} • {row.project.status}</div>
              <div className="mt-2 text-xs text-slate-600">Pressure {row.health.score} • {row.health.tier}</div>
              <div className="mt-1 text-xs text-slate-600">Overdue {row.overdueFollowUpCount + row.overdueTaskCount} • Blocked {row.blockedTaskCount} • Ready {row.project.closeoutReadiness ?? 0}%</div>
              <div className="mt-1 text-xs text-slate-500">Milestone {row.project.nextMilestone || 'None set'}{row.project.nextMilestoneDate ? ` • ${formatDate(row.project.nextMilestoneDate)}` : ''}</div>
            </button>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="action-btn" disabled={row.openFollowUps.length === 0} onClick={() => row.openFollowUps[0] && onOpenFollowUp(row.openFollowUps[0].id)}>Open follow-ups</button>
              <button className="action-btn" disabled={row.openTasks.length === 0} onClick={() => row.openTasks[0] && onOpenTask(row.openTasks[0].id)}>Open tasks</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
