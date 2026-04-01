import { ArrowRight, BellRing, BriefcaseBusiness, Inbox, Network } from 'lucide-react';
import { useMemo } from 'react';
import { Badge } from './Badge';
import type { WorkspaceKey } from './WorkspaceSidebar';
import { buildCompanySummary, buildContactSummary, buildProjectDashboard, formatDate, isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
}

export function OverviewPage({ onOpenWorkspace }: OverviewPageProps) {
  const { items, contacts, companies, projects, intakeSignals, droppedEmailImports, intakeDocuments, setSelectedId, setActiveView } = useAppStore(useShallow((s) => ({
    items: s.items,
    contacts: s.contacts,
    companies: s.companies,
    projects: s.projects,
    intakeSignals: s.intakeSignals,
    intakeDocuments: s.intakeDocuments,
    droppedEmailImports: s.droppedEmailImports,
    setSelectedId: s.setSelectedId,
    setActiveView: s.setActiveView,
  })));

  const priorityItems = useMemo(() => {
    return items
      .filter((item) => item.status !== 'Closed')
      .filter((item) => needsNudge(item) || isOverdue(item) || item.escalationLevel === 'Critical')
      .sort((a, b) => new Date(a.nextTouchDate).getTime() - new Date(b.nextTouchDate).getTime())
      .slice(0, 6);
  }, [items]);

  const documentCounts = useMemo(() => intakeDocuments.reduce<Record<string, number>>((acc, doc) => { if (doc.projectId) acc[doc.projectId] = (acc[doc.projectId] ?? 0) + 1; return acc; }, {}), [intakeDocuments]);
  const projectSummary = useMemo(() => buildProjectDashboard(items, projects, documentCounts).slice(0, 4), [items, projects, documentCounts]);
  const contactSummary = useMemo(() => buildContactSummary(items, contacts, companies).slice(0, 4), [items, contacts, companies]);
  const companySummary = useMemo(() => buildCompanySummary(items, companies).slice(0, 4), [items, companies]);

  const overviewCards = [
    {
      key: 'tracker' as const,
      title: 'Work the queue',
      helper: 'Open the tracker on the nudge view and handle the next most important follow-ups.',
      icon: BellRing,
      meta: `${priorityItems.length} items need attention`,
      action: () => {
        setActiveView('Needs nudge');
        onOpenWorkspace('tracker');
      },
    },
    {
      key: 'intake' as const,
      title: 'Triage intake',
      helper: 'Dropped emails and intake signals waiting to be converted into tracked items.',
      icon: Inbox,
      meta: `${droppedEmailImports.length + intakeSignals.length} items in intake`,
      action: () => onOpenWorkspace('intake'),
    },
    {
      key: 'projects' as const,
      title: 'Review projects',
      helper: 'See project exposure, weekly action queues, and report-ready summaries.',
      icon: BriefcaseBusiness,
      meta: `${projectSummary.length} active projects`,
      action: () => onOpenWorkspace('projects'),
    },
    {
      key: 'relationships' as const,
      title: 'Check people and companies',
      helper: 'Find who work is waiting on and which partners are carrying the most risk.',
      icon: Network,
      meta: `${contacts.length} contacts • ${companies.length} companies`,
      action: () => onOpenWorkspace('relationships'),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="workspace-hero-card">
        <div>
          <div className="workspace-page-kicker">Overview</div>
          <h2 className="workspace-page-title">A simpler home screen for the whole app.</h2>
          <p className="workspace-page-copy">
            Start here, then jump into one focused workspace at a time. The goal is to make today’s work obvious without burying you in every panel at once.
          </p>
        </div>
        <div className="workspace-hero-actions">
          {overviewCards.map((card) => {
            const Icon = card.icon;
            return (
              <button key={card.key} onClick={card.action} className="workspace-launch-card">
                <div className="workspace-launch-icon"><Icon className="h-4 w-4" /></div>
                <div>
                  <div className="workspace-launch-title">{card.title}</div>
                  <div className="workspace-launch-helper">{card.helper}</div>
                  <div className="workspace-launch-meta">{card.meta}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="workspace-card">
        <div className="workspace-card-header">
          <div>
            <h3 className="workspace-card-title">Top priorities</h3>
            <p className="workspace-card-copy">The six items most likely to need action right now.</p>
          </div>
          <button onClick={() => { setActiveView('Needs nudge'); onOpenWorkspace('tracker'); }} className="action-btn">Open tracker</button>
        </div>
        <div className="overview-priority-list">
          {priorityItems.map((item) => (
            <button key={item.id} onClick={() => { setSelectedId(item.id); onOpenWorkspace('tracker'); }} className="overview-priority-row">
              <div>
                <div className="overview-priority-title">{item.title}</div>
                <div className="overview-priority-meta">{item.project} • {item.owner} • Next touch {formatDate(item.nextTouchDate)}</div>
              </div>
              <div className="overview-priority-badges">
                <Badge variant={item.escalationLevel === 'Critical' ? 'danger' : item.status === 'At risk' ? 'warn' : 'neutral'}>{item.escalationLevel}</Badge>
                {needsNudge(item) ? <Badge variant="warn">Nudge</Badge> : null}
                {isOverdue(item) ? <Badge variant="danger">Overdue</Badge> : null}
              </div>
            </button>
          ))}
          {priorityItems.length === 0 ? <div className="text-sm text-slate-500">Nothing urgent right now.</div> : null}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Project snapshot</h3>
              <p className="workspace-card-copy">Open count, waiting count, and critical pressure by project.</p>
            </div>
          </div>
          <div className="space-y-3">
            {projectSummary.map((project) => (
              <button key={project.project} onClick={() => onOpenWorkspace('projects')} className="overview-summary-row">
                <div>
                  <div className="font-medium text-slate-900">{project.project}</div>
                  <div className="text-xs text-slate-500">Open {project.openCount} • Waiting {project.waitingCount} • Overdue {project.overdueCount}</div>
                </div>
                <Badge variant={project.criticalCount > 0 ? 'danger' : 'neutral'}>{project.healthScore}</Badge>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Contacts waiting board</h3>
              <p className="workspace-card-copy">Who currently has open follow-ups sitting with them.</p>
            </div>
          </div>
          <div className="space-y-3">
            {contactSummary.map((contact) => (
              <button key={contact.id} onClick={() => onOpenWorkspace('relationships')} className="overview-summary-row">
                <div>
                  <div className="font-medium text-slate-900">{contact.label}</div>
                  <div className="text-xs text-slate-500">Waiting {contact.waitingCount} • Overdue {contact.overdueCount} • Touch age {contact.averageTouchAge}d</div>
                </div>
                <Badge variant={contact.overdueCount > 0 ? 'warn' : 'neutral'}>{contact.openCount} open</Badge>
              </button>
            ))}
          </div>
        </section>

        <section className="workspace-card">
          <div className="workspace-card-header compact">
            <div>
              <h3 className="workspace-card-title">Companies carrying risk</h3>
              <p className="workspace-card-copy">High-risk partners and vendors with the most open pressure.</p>
            </div>
          </div>
          <div className="space-y-3">
            {companySummary.map((company) => (
              <button key={company.id} onClick={() => onOpenWorkspace('relationships')} className="overview-summary-row">
                <div>
                  <div className="font-medium text-slate-900">{company.label}</div>
                  <div className="text-xs text-slate-500">Waiting {company.waitingCount} • Overdue {company.overdueCount} • Touch age {company.averageTouchAge}d</div>
                </div>
                <Badge variant={company.overdueCount > 0 ? 'warn' : 'neutral'}>{company.openCount} open</Badge>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
