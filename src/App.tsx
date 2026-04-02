import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Activity, BriefcaseBusiness, Building2, CheckCircle2, Command, FileSpreadsheet, HardHat, LayoutDashboard, ListChecks, ListTodo, LockKeyhole, Mail, PanelRight, Plus, Search, ShieldCheck, Users } from 'lucide-react';

import { DuplicateReviewPanel } from './components/DuplicateReviewPanel';
import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { ImportWizardModal } from './components/ImportWizardModal';
import { ItemDetailPanel } from './components/ItemDetailPanel';
import { CreateWorkModal } from './components/CreateWorkModal';
import { OverviewPage } from './components/OverviewPage';
import { MergeModal } from './components/MergeModal';
import { ProjectCommandCenter } from './components/ProjectCommandCenter';
import { RelationshipBoard } from './components/RelationshipBoard';
import { TouchLogModal } from './components/TouchLogModal';
import { TrackerTable } from './components/TrackerTable';
import { ControlBar } from './components/ControlBar';
import { TaskWorkspace } from './components/TaskWorkspace';
import { ExportWorkspace } from './components/ExportWorkspace';
import { OutlookPanel } from './components/OutlookPanel';
import { UniversalCapture } from './components/UniversalCapture';
import { PersonalAgendaBoard } from './components/PersonalAgendaBoard';

import { supabase, supabaseConfigError } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';
import type { AppUserRole } from './types';
import type { AppMode } from './types';

type WorkspaceKey = 'today' | 'followups' | 'tasks' | 'overview' | 'outlook' | 'projects' | 'relationships' | 'exports';

type NavGroup = 'main' | 'more';

const navItems: Array<{ key: WorkspaceKey; label: string; icon: typeof LayoutDashboard; group: NavGroup; roles: AppUserRole[] }> = [
  { key: 'today', label: 'Today', icon: ListChecks, group: 'main', roles: ['user', 'manager', 'admin'] },
  { key: 'followups', label: 'Follow Ups', icon: Activity, group: 'main', roles: ['user', 'manager', 'admin'] },
  { key: 'tasks', label: 'Tasks', icon: ListTodo, group: 'main', roles: ['user', 'manager', 'admin'] },
  { key: 'projects', label: 'Projects', icon: BriefcaseBusiness, group: 'more', roles: ['manager', 'admin'] },
  { key: 'relationships', label: 'Relationships', icon: Users, group: 'more', roles: ['manager', 'admin'] },
  { key: 'outlook', label: 'Email Intake', icon: Mail, group: 'more', roles: ['user', 'manager', 'admin'] },
  { key: 'exports', label: 'Exports', icon: FileSpreadsheet, group: 'more', roles: ['manager', 'admin'] },
  { key: 'overview', label: 'Admin Overview', icon: LayoutDashboard, group: 'more', roles: ['admin'] },
];

function FollowUpHQMark() {
  return (
    <svg viewBox="0 0 720 520" role="img" aria-label="FollowUp HQ construction themed logo" className="login-hero-mark">
      <defs>
        <linearGradient id="heroSteel" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>
        <linearGradient id="heroAccent" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <linearGradient id="heroDark" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
      </defs>

      <rect x="52" y="58" width="616" height="404" rx="36" fill="rgba(15,23,42,0.16)" />
      <rect x="38" y="44" width="616" height="404" rx="36" fill="url(#heroDark)" stroke="rgba(248,250,252,0.12)" />

      <g opacity="0.2">
        <path d="M84 366 210 246l72 68 122-132 64 57 85-81" fill="none" stroke="#38bdf8" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M86 396h520" stroke="#94a3b8" strokeWidth="6" strokeLinecap="round" />
        <path d="M120 154h122" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
        <path d="M120 182h86" stroke="#475569" strokeWidth="8" strokeLinecap="round" />
      </g>

      <g transform="translate(80 88)">
        <rect x="0" y="54" width="188" height="222" rx="28" fill="#111827" stroke="rgba(255,255,255,0.08)" />
        <rect x="22" y="78" width="144" height="18" rx="9" fill="#1f2937" />
        <rect x="22" y="112" width="110" height="14" rx="7" fill="#334155" />
        <rect x="22" y="144" width="144" height="14" rx="7" fill="#334155" />
        <rect x="22" y="176" width="90" height="14" rx="7" fill="#334155" />
        <rect x="22" y="210" width="126" height="32" rx="16" fill="#0ea5e9" opacity="0.85" />

        <path d="M58 42c6-40 36-64 81-64 45 0 74 24 81 64" fill="#f59e0b" />
        <path d="M44 42h174" stroke="#fdba74" strokeWidth="13" strokeLinecap="round" />
        <path d="M79 42v38M137 42v38M194 42v38" stroke="#fcd34d" strokeWidth="10" strokeLinecap="round" />
        <path d="M158 35c18 8 27 25 29 53" fill="none" stroke="#6b7280" strokeWidth="7" strokeLinecap="round" />
        <rect x="178" y="85" width="26" height="82" rx="13" fill="url(#heroSteel)" transform="rotate(17 178 85)" />
      </g>

      <g transform="translate(308 150)">
        <text x="0" y="110" fontSize="92" fontWeight="800" fill="#f8fafc" letterSpacing="-3">FollowUp</text>
        <text x="2" y="206" fontSize="96" fontWeight="800" fill="url(#heroAccent)" letterSpacing="1">HQ</text>
        <path d="M2 228h244" stroke="#fb923c" strokeWidth="10" strokeLinecap="round" />
        <path d="M284 42h104" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M336 42v96" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M292 138h88" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M352 154h72" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <circle cx="426" cy="154" r="18" fill="#f59e0b" />
      </g>
    </svg>
  );
}

function MissingSupabaseConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[760px] items-center justify-center">
        <div className="w-full rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-amber-900">Supabase setup needed</h1>
          <p className="mt-2 text-sm text-amber-800">
            FollowUp HQ needs valid Supabase environment variables before the app can load.
          </p>
          <div className="mt-4 rounded-2xl border border-amber-200 bg-white p-4 text-sm text-slate-700">
            <div className="font-medium text-slate-900">Current issue</div>
            <code className="mt-2 block rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-800">{supabaseConfigError ?? 'Supabase configuration unavailable.'}</code>
            <div className="mt-3 text-xs text-slate-600">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> in your local environment (for example in a <code>.env</code> file), then restart the dev server.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
    }

    setSubmitting(false);
  };

  return (
    <div className="login-shell">
      <div className="login-bg-grid" />
      <div className="login-bg-glow login-bg-glow-one" />
      <div className="login-bg-glow login-bg-glow-two" />

      <div className="login-layout">
        <section className="login-brand-panel">
          <div className="login-brand-header">
            <div className="login-brand-badge">Construction follow-up command center</div>
            <div className="login-brand-copy">
              <h1>Professional follow-up control for active construction work.</h1>
              <p>
                Keep emails, field issues, commitments, and project actions in one clean system built for execution.
              </p>
            </div>
          </div>

          <div className="login-hero-panel">
            <FollowUpHQMark />
          </div>

          <div className="login-brand-points">
            <div className="login-point-card">
              <HardHat className="h-5 w-5" />
              <div>Track field issues, RFIs, and owner commitments with less clutter.</div>
            </div>
            <div className="login-point-card">
              <Building2 className="h-5 w-5" />
              <div>Organize work by project, owner, urgency, and next touch date.</div>
            </div>
            <div className="login-point-card">
              <ShieldCheck className="h-5 w-5" />
              <div>Secure cloud-backed access through your FollowUp HQ account.</div>
            </div>
          </div>
        </section>

        <section className="login-card-wrap">
          <div className="login-card">
            <div className="login-card-topbar">
              <div className="login-chip">FollowUp HQ</div>
              <div className="login-chip login-chip-muted">Secure sign-in</div>
            </div>

            <div className="login-card-copy">
              <h2>Sign in</h2>
              <p>Access your live follow-up data, project board, and saved workspace.</p>
            </div>

            <form onSubmit={handleSubmit} className="login-form">
              <label className="login-field">
                <span className="login-field-label">Email</span>
                <div className="login-input-wrap">
                  <Mail className="login-input-icon h-5 w-5" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="login-input"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                </div>
              </label>

              <label className="login-field">
                <span className="login-field-label">Password</span>
                <div className="login-input-wrap">
                  <LockKeyhole className="login-input-icon h-5 w-5" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="login-input"
                    placeholder="Password"
                    autoComplete="current-password"
                    required
                  />
                </div>
              </label>

              {errorMessage ? (
                <div className="login-error">{errorMessage}</div>
              ) : null}

              <button type="submit" disabled={submitting} className="login-submit-btn">
                {submitting ? 'Signing in...' : 'Sign in to FollowUp HQ'}
              </button>
            </form>

            <div className="login-security-strip">
              <CheckCircle2 className="h-5 w-5" />
              <span>Secure Supabase authentication and cloud-backed persistence.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function OverviewWorkspace({
  onOpenTrackerView,
  onOpenWorkspace,
}: {
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  onOpenWorkspace: (workspace: string) => void;
}) {
  return <OverviewPage onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace as never} />;
}

function TrackerWorkspace({ personalMode }: { personalMode: boolean }) {
  return (
    <div className="space-y-5">
      <ControlBar />
      <div className="tracker-main-grid">
        <div className="space-y-5">
          <TrackerTable personalMode={personalMode} />
          <DuplicateReviewPanel />
        </div>
        <ItemDetailPanel personalMode={personalMode} />
      </div>
    </div>
  );
}

function MainApp() {
  const initializeApp = useAppStore((s) => s.initializeApp);
  const { setActiveView, setProjectFilter, setSelectedId, setSelectedTaskId } = useAppStore(
    useShallow((s) => ({
      setActiveView: s.setActiveView,
      setProjectFilter: s.setProjectFilter,
      setSelectedId: s.setSelectedId,
      setSelectedTaskId: s.setSelectedTaskId,
    })),
  );
  const { openCreateModal, openCreateTaskModal, items, tasks, selectedId } = useAppStore(
    useShallow((s) => ({
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
      items: s.items,
      tasks: s.tasks,
      selectedId: s.selectedId,
    })),
  );

  const [workspace, setWorkspace] = useState<WorkspaceKey>('today');
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'personal';
    const saved = window.localStorage.getItem('followup-hq:app-mode');
    return saved === 'team' ? 'team' : 'personal';
  });
  const [showCommand, setShowCommand] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [role] = useState<AppUserRole>('user');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('followup-hq:app-mode', appMode);
    }
  }, [appMode]);

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommand((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const openTrackerView = useCallback((view: SavedViewKey, project = 'All') => {
    setActiveView(view);
    setProjectFilter(project);
    setWorkspace('followups');
  }, [setActiveView, setProjectFilter]);

  const openTrackerItem = useCallback((itemId: string, view: SavedViewKey = 'All', project = 'All') => {
    setSelectedId(itemId);
    openTrackerView(view, project);
  }, [openTrackerView, setSelectedId]);

  const openTaskItem = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setWorkspace('tasks');
  }, [setSelectedTaskId]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const cleanupFollowUps = items.filter((item) => item.needsCleanup && item.status !== 'Closed');
  const cleanupTasks = tasks.filter((task) => task.needsCleanup && task.status !== 'Done');
  const combinedCleanup = cleanupFollowUps.length + cleanupTasks.length;

  const progressToday = useMemo(() => {
    const today = new Date().toDateString();
    const touched = items.filter((item) => item.timeline.some((entry) => new Date(entry.at).toDateString() === today && entry.type === 'touched')).length;
    const closed = items.filter((item) => item.status === 'Closed' && item.lastActionAt && new Date(item.lastActionAt).toDateString() === today).length;
    const tasksDone = tasks.filter((task) => task.status === 'Done' && task.completedAt && new Date(task.completedAt).toDateString() === today).length;
    const advancedWaiting = items.filter((item) => item.timeline.some((entry) => new Date(entry.at).toDateString() === today && /waiting|nudged/i.test(entry.summary))).length;
    return { touched, closed, tasksDone, advancedWaiting };
  }, [items, tasks]);

  const workspaceBody = useMemo(() => {
    switch (workspace) {
      case 'followups':
        return <TrackerWorkspace personalMode={appMode === 'personal'} />;
      case 'today':
        {
        const activeFollowUps = items.filter((item) => item.status !== 'Closed');
        const waitingTooLong = activeFollowUps.filter((item) => item.status.includes('Waiting') && (Date.now() - new Date(item.lastTouchDate).getTime()) > 7 * 86400000);
        const dueToday = activeFollowUps.filter((item) => new Date(item.dueDate).toDateString() === new Date().toDateString());
        const noNextAction = [...activeFollowUps.filter((item) => !item.nextAction.trim()), ...tasks.filter((task) => task.status !== 'Done' && !task.nextStep.trim())];
        const likelyNudges = activeFollowUps.filter((item) => item.status.includes('Waiting') && (Date.now() - new Date(item.lastTouchDate).getTime()) > Math.max(2, item.cadenceDays) * 86400000);
        return (
          <div className="workspace-master-detail workspace-master-detail-today">
            <section className="workspace-list-panel">
              <div className="workspace-list-head">
                <div>
                  <div className="workspace-list-title">Start my day</div>
                  <p className="workspace-list-subtitle">Work the highest-risk records first, then clear intake cleanup.</p>
                </div>
                <div className="workspace-kpi-strip">
                  <div className="workspace-kpi-card"><span>Overdue</span><strong>{activeFollowUps.filter((item) => new Date(item.dueDate).getTime() < Date.now()).length}</strong></div>
                  <div className="workspace-kpi-card"><span>Due today</span><strong>{dueToday.length}</strong></div>
                  <div className="workspace-kpi-card"><span>Waiting too long</span><strong>{waitingTooLong.length}</strong></div>
                  <div className="workspace-kpi-card"><span>Likely nudges</span><strong>{likelyNudges.length}</strong></div>
                  <div className="workspace-kpi-card"><span>No next action</span><strong>{noNextAction.length}</strong></div>
                </div>
              </div>
              <div className="workspace-action-row">
                <button onClick={() => openTrackerView('Overdue')} className="action-btn">Review overdue</button>
                <button onClick={() => openTrackerView('Needs nudge')} className="action-btn">Review nudges</button>
                <button onClick={() => setWorkspace('tasks')} className="action-btn">Review blocked</button>
                <button onClick={openCreateModal} className="action-btn">New follow-up</button>
                <button onClick={openCreateTaskModal} className="action-btn">New task</button>
              </div>
              <div className="workspace-list-content">
                <div className="section-note-row">
                  <div className="section-note-head">Intake needing review</div>
                  <div className="section-note-count">{combinedCleanup}</div>
                </div>
                <div className="space-y-2">
                  {cleanupFollowUps.slice(0, 3).map((item) => (
                    <button key={item.id} onClick={() => openTrackerItem(item.id)} className="workspace-list-row">
                      {item.title} · {(item.cleanupReasons || []).join(', ')}
                    </button>
                  ))}
                  {cleanupTasks.slice(0, 2).map((task) => (
                    <button key={task.id} onClick={() => openTaskItem(task.id)} className="workspace-list-row">
                      {task.title} · {(task.cleanupReasons || []).join(', ')}
                    </button>
                  ))}
                </div>
              </div>
            </section>
            <div className="workspace-inspector-panel">
              <PersonalAgendaBoard />
              <section className="inspector-stats">
                <div className="workspace-list-title">Progress today</div>
                <div className="inspector-stats-grid">
                  <div className="inspector-stat">Touched <strong>{progressToday.touched}</strong></div>
                  <div className="inspector-stat">Closed <strong>{progressToday.closed}</strong></div>
                  <div className="inspector-stat">Tasks done <strong>{progressToday.tasksDone}</strong></div>
                  <div className="inspector-stat">Waiting advanced <strong>{progressToday.advancedWaiting}</strong></div>
                </div>
              </section>
            </div>
          </div>
        );
      }
      case 'tasks':
        return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} personalMode={appMode === 'personal'} />;
      case 'exports':
        return <ExportWorkspace />;
      case 'outlook':
        return <OutlookPanel showAdvanced={role === 'admin'} />;
      case 'projects':
        return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} />;
      case 'relationships':
        return <RelationshipBoard />;
      default:
        return <OverviewWorkspace onOpenTrackerView={openTrackerView} onOpenWorkspace={(value) => setWorkspace(value === 'queue' ? 'today' : value === 'tracker' ? 'followups' : value as WorkspaceKey)} />;
    }
  }, [workspace, openTaskItem, openTrackerItem, openTrackerView, selectedItem?.project, selectedId, combinedCleanup, cleanupFollowUps, cleanupTasks, progressToday]);

  const commands = [
    { label: 'New follow-up', run: () => openCreateModal() },
    { label: 'New task', run: () => openCreateTaskModal() },
    { label: 'Open today', run: () => setWorkspace('today') },
    { label: 'Open queue', run: () => setWorkspace('today') },
    ...(appMode === 'team' ? [{ label: 'Search follow-ups', run: () => setWorkspace('followups') }, { label: 'Search tasks', run: () => setWorkspace('tasks') }, { label: 'Open projects', run: () => setWorkspace('projects') }] : []),
    { label: 'Open intake review', run: () => setWorkspace('outlook') },
  ];

  const workspaceMeta: Record<WorkspaceKey, { title: string; purpose: string; health: string; actions: Array<{ label: string; run: () => void; primary?: boolean }> }> = {
    today: {
      title: 'Today execution',
      purpose: 'Run today’s follow-ups and tasks from one unified worklist.',
      health: `${progressToday.touched + progressToday.tasksDone} actions completed today`,
      actions: [{ label: 'New follow-up', run: openCreateModal, primary: true }, { label: 'New task', run: openCreateTaskModal }],
    },
    followups: {
      title: 'Follow Ups',
      purpose: 'Scan and execute follow-ups with fast inline edits and a focused inspector.',
      health: `${items.filter((item) => item.status !== 'Closed').length} active follow-ups`,
      actions: [{ label: 'Add follow-up', run: openCreateModal, primary: true }],
    },
    tasks: {
      title: 'Tasks',
      purpose: 'Work internal execution tasks with tight scan, status, and ownership controls.',
      health: `${tasks.filter((task) => task.status !== 'Done').length} open tasks`,
      actions: [{ label: 'Add task', run: openCreateTaskModal, primary: true }],
    },
    overview: { title: 'Admin Overview', purpose: 'Monitor system health and throughput.', health: `${items.length + tasks.length} tracked records`, actions: [] },
    outlook: { title: 'Email Intake', purpose: 'Review Outlook ingestion and low-confidence capture cleanup.', health: `${combinedCleanup} items need cleanup`, actions: [] },
    projects: { title: 'Projects', purpose: 'Track project-level workload, risk, and execution outcomes.', health: `${items.length} linked follow-ups`, actions: [] },
    relationships: { title: 'Relationships', purpose: 'Manage contact relationships and connected execution history.', health: `${items.length} connected threads`, actions: [] },
    exports: { title: 'Exports', purpose: 'Generate operational exports for reporting and coordination.', health: 'Export-ready data', actions: [] },
  };

  const currentMeta = workspaceMeta[workspace];

  return (
    <div className="app-shell text-slate-900">
      <div className="app-shell-layout">
        <aside className="app-nav-rail">
            <div className="app-brand-block">
              <div className="app-brand-eyebrow">Daily execution workspace</div>
              <div className="app-brand-title">FollowUp HQ</div>
            </div>
            <div className="mb-3 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <button onClick={() => setAppMode('personal')} className={appMode === 'personal' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Personal</button>
              <button onClick={() => setAppMode('team')} className={appMode === 'team' ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>Team</button>
            </div>
            <div className="grid gap-2">
              {navItems.filter((item) => item.group === 'main' && item.roles.includes(role) && (appMode === 'team' || item.key === 'today')).map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => setWorkspace(key)} className={workspace === key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-900"><Icon className="h-4 w-4" />{label}</div>
                </button>
              ))}
              <button onClick={() => setShowMore((value) => !value)} className={showMore ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
                <div className="flex items-center gap-3 text-sm font-medium text-slate-900"><PanelRight className="h-4 w-4" />More</div>
              </button>
            </div>
            {showMore ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">More</div>
              <div className="mt-2 grid gap-2">
                  {navItems.filter((item) => item.roles.includes(role) && ((appMode === 'personal' && ['followups', 'tasks', 'outlook'].includes(item.key)) || (appMode === 'team' && item.group === 'more'))).map(({ key, label, icon: Icon }) => (
                  <button key={key} onClick={() => setWorkspace(key)} className={workspace === key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}>
                    <div className="flex items-center gap-3 text-sm font-medium text-slate-900"><Icon className="h-4 w-4" />{label}</div>
                  </button>
                ))}
              </div>
              </div>
            ) : null}
            <div className="mt-4 grid gap-2">
              <button onClick={() => setShowCommand(true)} className="action-btn justify-start"><Command className="h-4 w-4" />Command palette</button>
            </div>
          </aside>

          <main className="app-main-pane">
            <header className="workspace-header">
              <div>
                <div className="workspace-label">{appMode === 'personal' ? 'Personal mode' : 'Team mode'}</div>
                <h1>{currentMeta.title}</h1>
                <p>{currentMeta.purpose}</p>
              </div>
              <div className="workspace-header-meta">
                <div className="workspace-health-pill">{currentMeta.health}</div>
                <div className="workspace-header-actions">
                  {currentMeta.actions.map((action) => (
                    <button key={action.label} onClick={action.run} className={action.primary ? 'primary-btn' : 'action-btn'}>
                      {action.primary ? <Plus className="h-4 w-4" /> : null}
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            </header>
            <UniversalCapture contextProject={selectedItem?.project} contextOwner={selectedItem?.owner} contextFollowUpId={selectedId} />
            {workspaceBody}
          </main>
        </div>

      {showCommand ? (
        <div className="modal-backdrop" onClick={() => setShowCommand(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="text-lg font-semibold text-slate-900">Command palette</div>
              <button onClick={() => setShowCommand(false)} className="action-btn">Close</button>
            </div>
            <div className="space-y-2">
              {commands.map((command) => (
                <button key={command.label} className="saved-view-card w-full justify-between" onClick={() => { command.run(); setShowCommand(false); }}>
                  <span>{command.label}</span>
                  <Search className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <CreateWorkModal />
      <TouchLogModal />
      <ImportWizardModal />
      <MergeModal />
      <FollowUpDraftModal />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    if (supabaseConfigError) {
      setLoadingSession(false);
      return;
    }

    let isMounted = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;

      if (error) {
        console.error('Failed to get Supabase session:', error);
      }

      setSession(data.session ?? null);
      setLoadingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoadingSession(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  if (supabaseConfigError) {
    return <MissingSupabaseConfigScreen />;
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-[560px] items-center justify-center">
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-5 text-sm text-slate-600 shadow-sm">
            Loading session...
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <MainApp />;
}
