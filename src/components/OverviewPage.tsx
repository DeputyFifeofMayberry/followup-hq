import { AlertTriangle, ArrowRight, ArrowDownToLine, BellRing, BriefcaseBusiness, ListTodo, Plus, Users } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from './Badge';
import type { SavedViewKey } from '../types';
import {
  buildCompanySummary,
  buildContactSummary,
  buildProjectDashboard,
  formatDate,
  isOverdue,
  needsNudge,
} from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

type WorkspaceKey = 'overview' | 'tracker' | 'tasks' | 'intake' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
}

export function OverviewPage({ onOpenWorkspace, onOpenTrackerView }: OverviewPageProps) {
  const {
    items,
    tasks,
    contacts,
    companies,
    projects,
    intakeSignals,
    droppedEmailImports,
    intakeDocuments,
    hydrated,
    setSelectedId,
    openCreateModal,
    openCreateTaskModal,
    openImportModal,
  } = useAppStore(
    useShallow((s) => ({
      items: s.items,
      tasks: s.tasks,
      contacts: s.contacts,
      companies: s.companies,
      projects: s.projects,
      intakeSignals: s.intakeSignals,
      intakeDocuments: s.intakeDocuments,
      droppedEmailImports: s.droppedEmailImports,
      hydrated: s.hydrated,
      setSelectedId: s.setSelectedId,
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
      openImportModal: s.openImportModal,
    })),
  );

  const priorityItems = useMemo(() => {
    return items
      .filter((item) => item.status !== 'Closed')
      .filter((item) => needsNudge(item) || isOverdue(item) || item.escalationLevel === 'Critical')
      .sort((a, b) => new Date(a.nextTouchDate).getTime() - new Date(b.nextTouchDate).getTime())
      .slice(0, 5);
  }, [items]);

  const documentCounts = useMemo(
    () =>
      intakeDocuments.reduce<Record<string, number>>((acc, doc) => {
        if (doc.projectId) acc[doc.projectId] = (acc[doc.projectId] ?? 0) + 1;
        return acc;
      }, {}),
    [intakeDocuments],
  );

  const projectSummary = useMemo(
    () => buildProjectDashboard(items, projects, documentCounts).slice(0, 3),
    [items, projects, documentCounts],
  );
  const contactSummary = useMemo(() => buildContactSummary(items, contacts, companies).slice(0, 3), [items, contacts, companies]);
  const companySummary = useMemo(() => buildCompanySummary(items, companies).slice(0, 3), [items, companies]);

  const openFollowUps = items.filter((item) => item.status !== 'Closed').length;
  const openTasks = tasks.filter((task) => task.status !== 'Done').length;
  const nudgeCount = items.filter(needsNudge).length;
  const highRiskCount = items.filter((item) => isOverdue(item) || item.status === 'At risk' || item.escalationLevel === 'Critical').length;
  const intakeCount = droppedEmailImports.length + intakeSignals.length;

  const statCards = [
    {
      label: 'Open follow-ups',
      value: openFollowUps,
      helper: 'Live items being tracked',
      icon: BellRing,
      action: () => onOpenTrackerView('All'),
    },
    {
      label: 'Needs nudge',
      value: nudgeCount,
      helper: 'Worth touching now',
      icon: AlertTriangle,
      action: () => onOpenTrackerView('Needs nudge'),
    },
    {
      label: 'Open tasks',
      value: openTasks,
      helper: 'Internal work still open',
      icon: ListTodo,
      action: () => onOpenWorkspace('tasks'),
    },
    {
      label: 'Intake',
      value: intakeCount,
      helper: 'Items waiting for triage',
      icon: ArrowDownToLine,
      action: () => onOpenWorkspace('intake'),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <div className="workspace-page-kicker">Overview</div>
            <h2 className="workspace-page-title">At a glance</h2>
            <p className="workspace-page-copy">
              This page should answer one question fast: what needs attention right now?
            </p>
          </div>
          <div className="overview-header-chip">
            {highRiskCount} high-risk item{highRiskCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="overview-stat-grid">
          {hydrated
            ? statCards.map((card) => {
                const Icon = card.icon;
                return (
                  <button key={card.label} onClick={card.action} className="overview-stat-card">
                    <div className="overview-stat-top">
                      <div>
                        <div className="overview-stat-label">{card.label}</div>
                        <div className="overview-stat-value">{card.value}</div>
                      </div>
                      <div className="overview-stat-icon">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div className="overview-stat-helper">{card.helper}</div>
                  </button>
                );
              })
            : Array.from({ length: 4 }).map((_, index) => <div key={index} className="overview-stat-card" style={{ minHeight: '132px' }} />)}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_360px]">
        <section className="workspace-card">
          <div className="workspace-card-header">
            <div>
              <h3 className="workspace-card-title">Top priorities</h3>
              <p className="workspace-card-copy">Keep this list short. Open the tracker for the full queue.</p>
            </div>
            <button onClick={() => onOpenTrackerView('Needs nudge')} className="action-btn">Open queue</button>
          </div>

          <div className="overview-priority-list">
            {!hydrated ? (
              <div className="text-sm text-slate-500">Loading priorities…</div>
            ) : priorityItems.length === 0 ? (
              <div className="text-sm text-slate-500">Nothing urgent right now.</div>
            ) : (
              priorityItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedId(item.id);
                    onOpenTrackerView('Needs nudge');
                  }}
                  className="overview-priority-row"
                >
                  <div className="overview-priority-main">
                    <div className="overview-priority-title">{item.title}</div>
                    <div className="overview-priority-meta">
                      {item.project} • {item.owner} • Next touch {formatDate(item.nextTouchDate)}
                    </div>
                  </div>
                  <div className="overview-priority-badges">
                    <Badge variant={item.escalationLevel === 'Critical' ? 'danger' : item.status === 'At risk' ? 'warn' : 'neutral'}>
                      {item.escalationLevel}
                    </Badge>
                    {needsNudge(item) ? <Badge variant="warn">Nudge</Badge> : null}
                    {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Quick actions</h3>
              <p className="workspace-card-copy">Do the common things without hunting for them.</p>
            </div>
          </div>

          <div className="overview-action-stack">
            <button onClick={openCreateModal} className="primary-btn justify-start">
              <Plus className="h-4 w-4" />
              Add follow-up
            </button>
            <button onClick={openCreateTaskModal} className="action-btn justify-start">
              <ListTodo className="h-4 w-4" />
              Add task
            </button>
            <button onClick={openImportModal} className="action-btn justify-start">
              <ArrowDownToLine className="h-4 w-4" />
              Import issues / emails
            </button>
            <button onClick={() => onOpenWorkspace('projects')} className="action-btn justify-start">
              <BriefcaseBusiness className="h-4 w-4" />
              Open projects
            </button>
            <button onClick={() => onOpenWorkspace('relationships')} className="action-btn justify-start">
              <Users className="h-4 w-4" />
              Open relationships
            </button>
          </div>

          <div className="overview-mini-panel">
            <div className="overview-mini-label">Inbox pressure</div>
            <div className="overview-mini-value">{intakeCount}</div>
            <div className="overview-mini-copy">
              {droppedEmailImports.length} dropped email{droppedEmailImports.length === 1 ? '' : 's'} • {intakeSignals.length} intake signal{intakeSignals.length === 1 ? '' : 's'}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Projects to watch</h3>
              <p className="workspace-card-copy">Only the highest-pressure projects belong here.</p>
            </div>
          </div>
          <div className="space-y-3">
            {!hydrated ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : projectSummary.length === 0 ? (
              <div className="text-sm text-slate-500">No active projects yet.</div>
            ) : (
              projectSummary.map((project) => (
                <button key={project.project} onClick={() => onOpenWorkspace('projects')} className="overview-summary-row">
                  <div>
                    <div className="font-medium text-slate-900">{project.project}</div>
                    <div className="text-xs text-slate-500">Open {project.openCount} • Waiting {project.waitingCount} • Overdue {project.overdueCount}</div>
                  </div>
                  <div className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
                    {project.healthScore}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Contacts waiting on items</h3>
              <p className="workspace-card-copy">People currently holding up follow-up items.</p>
            </div>
          </div>
          <div className="space-y-3">
            {!hydrated ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : contactSummary.length === 0 ? (
              <div className="text-sm text-slate-500">No contact pressure yet.</div>
            ) : (
              contactSummary.map((contact) => (
                <button key={contact.id} onClick={() => onOpenWorkspace('relationships')} className="overview-summary-row">
                  <div>
                    <div className="font-medium text-slate-900">{contact.label}</div>
                    <div className="text-xs text-slate-500">Waiting {contact.waitingCount} • Overdue {contact.overdueCount}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{contact.openCount} open</div>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Companies carrying risk</h3>
              <p className="workspace-card-copy">Vendors and partners with the most open pressure.</p>
            </div>
          </div>
          <div className="space-y-3">
            {!hydrated ? (
              <div className="text-sm text-slate-500">Loading…</div>
            ) : companySummary.length === 0 ? (
              <div className="text-sm text-slate-500">No company pressure yet.</div>
            ) : (
              companySummary.map((company) => (
                <button key={company.id} onClick={() => onOpenWorkspace('relationships')} className="overview-summary-row">
                  <div>
                    <div className="font-medium text-slate-900">{company.label}</div>
                    <div className="text-xs text-slate-500">Waiting {company.waitingCount} • Overdue {company.overdueCount}</div>
                  </div>
                  <div className="text-sm font-medium text-slate-700">{company.openCount} open</div>
                </button>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
