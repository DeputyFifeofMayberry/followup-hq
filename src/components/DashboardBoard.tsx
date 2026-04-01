import { BriefcaseBusiness, TriangleAlert, Users } from 'lucide-react';
import { useMemo } from 'react';
import { buildOwnerSummary, buildProjectDashboard } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { SavedViewKey } from '../types';

type WorkspaceKey = 'overview' | 'tracker' | 'intake' | 'projects' | 'relationships';

export function DashboardBoard({ onOpenTrackerView, onOpenWorkspace }: { onOpenTrackerView: (view: SavedViewKey, project?: string) => void; onOpenWorkspace: (workspace: WorkspaceKey) => void }) {
  const items = useAppStore((s) => s.items);
  const projects = useAppStore((s) => s.projects);
  const intakeDocuments = useAppStore((s) => s.intakeDocuments);
  const documentCounts = useMemo(() => intakeDocuments.reduce<Record<string, number>>((acc, doc) => { if (doc.projectId) acc[doc.projectId] = (acc[doc.projectId] ?? 0) + 1; return acc; }, {}), [intakeDocuments]);
  const projectSummary = useMemo(() => buildProjectDashboard(items, projects, documentCounts), [items, projects, documentCounts]);
  const ownerSummary = useMemo(() => buildOwnerSummary(items), [items]);
  const waitingBoard = useMemo(() => {
    const grouped = new Map<string, number>();
    items.forEach((item) => {
      if (!item.waitingOn) return;
      grouped.set(item.waitingOn, (grouped.get(item.waitingOn) ?? 0) + 1);
    });
    return [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  }, [items]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold text-slate-950">Operational dashboards</h2>
        <p className="mt-1 text-sm text-slate-500">Keep project exposure, owner load, and waiting-on accountability in one view.</p>
      </div>
      <div className="grid gap-6 p-4 xl:grid-cols-3">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><BriefcaseBusiness className="h-4 w-4" />Project exposure</div>
          <div className="space-y-2">
            {projectSummary.slice(0, 8).map((project) => (
              <button key={project.project} onClick={() => onOpenWorkspace('projects')} className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50">
                <div className="font-medium text-slate-900">{project.project}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Open: {project.openCount}</div><div>Waiting: {project.waitingCount}</div>
                  <div>Overdue: {project.overdueCount}</div><div>Critical: {project.criticalCount}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><Users className="h-4 w-4" />Owner workload</div>
          <div className="space-y-2">
            {ownerSummary.map((owner) => (
              <button key={owner.owner} onClick={() => onOpenTrackerView('All')} className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50">
                <div className="font-medium text-slate-900">{owner.owner}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>Active: {owner.activeCount}</div><div>Waiting: {owner.waitingCount}</div>
                  <div>Overdue: {owner.overdueCount}</div><div>Escalated: {owner.escalatedCount}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900"><TriangleAlert className="h-4 w-4" />Waiting on board</div>
          <div className="space-y-2">
            {waitingBoard.map(([who, count]) => (
              <button key={who} onClick={() => onOpenTrackerView('Waiting')} className="w-full rounded-2xl border border-slate-200 p-3 text-left text-sm transition hover:bg-slate-50">
                <div className="font-medium text-slate-900">{who}</div>
                <div className="mt-1 text-xs text-slate-600">{count} open item{count === 1 ? '' : 's'} are waiting here.</div>
              </button>
            ))}
            {waitingBoard.length === 0 ? <div className="text-sm text-slate-500">No waiting-on parties logged yet.</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
