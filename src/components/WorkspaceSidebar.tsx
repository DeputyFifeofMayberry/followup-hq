import { BellRing, BriefcaseBusiness, Inbox, LayoutDashboard, Network, Plus, Rocket } from 'lucide-react';
import { useMemo } from 'react';
import { isOverdue, needsNudge } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { PersistenceBanner } from './PersistenceBanner';

export type WorkspaceKey = 'overview' | 'tracker' | 'intake' | 'projects' | 'relationships';

interface WorkspaceSidebarProps {
  workspace: WorkspaceKey;
  onChange: (workspace: WorkspaceKey) => void;
}

const workspaces: Array<{ key: WorkspaceKey; label: string; helper: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', helper: 'Start here each day', icon: LayoutDashboard },
  { key: 'tracker', label: 'Tracker', helper: 'Main follow-up list', icon: BellRing },
  { key: 'intake', label: 'Intake', helper: 'Drop emails and imports', icon: Inbox },
  { key: 'projects', label: 'Projects', helper: 'Project command center', icon: BriefcaseBusiness },
  { key: 'relationships', label: 'Relationships', helper: 'Contacts and companies', icon: Network },
];

export function WorkspaceSidebar({ workspace, onChange }: WorkspaceSidebarProps) {
  const { items, intakeSignals, droppedEmailImports, openCreateModal, openImportModal, setActiveView } = useAppStore(useShallow((s) => ({
    items: s.items,
    intakeSignals: s.intakeSignals,
    droppedEmailImports: s.droppedEmailImports,
    openCreateModal: s.openCreateModal,
    openImportModal: s.openImportModal,
    setActiveView: s.setActiveView,
  })));

  const summary = useMemo(() => {
    const open = items.filter((item) => item.status !== 'Closed').length;
    const nudge = items.filter(needsNudge).length;
    const risk = items.filter((item) => isOverdue(item) || item.status === 'At risk' || item.escalationLevel === 'Critical').length;
    return {
      open,
      nudge,
      risk,
      intake: intakeSignals.length + droppedEmailImports.length,
    };
  }, [items, intakeSignals.length, droppedEmailImports.length]);

  return (
    <aside className="workspace-sidebar-shell">
      <div className="workspace-brand-card">
        <div className="workspace-brand-kicker">FollowUp HQ</div>
        <div className="workspace-brand-title">Clear, focused follow-up management.</div>
        <div className="workspace-brand-copy">Make today’s priorities obvious. Keep project pressure, intake, and accountability in separate, easy-to-read workspaces.</div>
      </div>

      <div className="workspace-sidebar-section">
        <div className="workspace-sidebar-heading">At a glance</div>
        <div className="workspace-mini-metrics">
          <button onClick={() => { onChange('tracker'); setActiveView('All'); }} className="workspace-mini-card"><span>Open</span><strong>{summary.open}</strong></button>
          <button onClick={() => { onChange('tracker'); setActiveView('Needs nudge'); }} className="workspace-mini-card"><span>Nudges</span><strong>{summary.nudge}</strong></button>
          <button onClick={() => { onChange('tracker'); setActiveView('At risk'); }} className="workspace-mini-card"><span>Risk</span><strong>{summary.risk}</strong></button>
          <button onClick={() => onChange('intake')} className="workspace-mini-card"><span>Intake</span><strong>{summary.intake}</strong></button>
        </div>
      </div>

      <nav className="workspace-nav-list" aria-label="Primary">
        {workspaces.map((entry) => {
          const Icon = entry.icon;
          const active = workspace === entry.key;
          return (
            <button
              key={entry.key}
              onClick={() => onChange(entry.key)}
              className={active ? 'workspace-nav-button workspace-nav-button-active' : 'workspace-nav-button'}
            >
              <div className="workspace-nav-icon"><Icon className="h-4 w-4" /></div>
              <div className="workspace-nav-copy">
                <div className="workspace-nav-label">{entry.label}</div>
                <div className="workspace-nav-helper">{entry.helper}</div>
              </div>
            </button>
          );
        })}
      </nav>

      <div className="workspace-sidebar-section">
        <div className="workspace-sidebar-heading">Quick actions</div>
        <div className="workspace-sidebar-actions">
          <button onClick={openCreateModal} className="primary-btn"><Plus className="h-4 w-4" />New item</button>
          <button onClick={openImportModal} className="action-btn"><Rocket className="h-4 w-4" />Import file</button>
          <button onClick={() => { onChange('tracker'); setActiveView('Needs nudge'); }} className="action-btn"><BellRing className="h-4 w-4" />Open nudge queue</button>
        </div>
      </div>

      <div className="workspace-sidebar-footer">
        <PersistenceBanner compact />
      </div>
    </aside>
  );
}
