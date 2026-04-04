import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Activity, BriefcaseBusiness, Building2, CheckCircle2, Command, FileSpreadsheet, HardHat, Inbox, ListChecks, ListTodo, LockKeyhole, Mail, Search, ShieldCheck, Sparkles, Users } from 'lucide-react';

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

import { supabase, supabaseConfigError } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';
import type { AppMode } from './types';
import { AppModal, AppModalBody, AppModalHeader, SegmentedControl, WorkspaceHeaderMetaPill } from './components/ui/AppPrimitives';

type WorkspaceKey = 'worklist' | 'followups' | 'tasks' | 'projects' | 'relationships' | 'outlook' | 'exports';

const navItems: Array<{ key: WorkspaceKey; label: string; icon: typeof ListChecks }> = [
  { key: 'worklist', label: 'Worklist', icon: ListChecks },
  { key: 'followups', label: 'Follow Ups', icon: Activity },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
  { key: 'outlook', label: 'Intake', icon: Inbox },
  { key: 'projects', label: 'Projects', icon: BriefcaseBusiness },
  { key: 'relationships', label: 'Relationships', icon: Users },
  { key: 'exports', label: 'Exports', icon: FileSpreadsheet },
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
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-slate-700">
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
  personalMode,
}: {
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  onOpenWorkspace: (workspace: string) => void;
  personalMode: boolean;
}) {
  return <OverviewPage onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace as never} personalMode={personalMode} />;
}

function TrackerWorkspace({ personalMode }: { personalMode: boolean }) {
  return (
    <div className="space-y-4">
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
  const { setActiveView, setProjectFilter, setSelectedId } = useAppStore(
    useShallow((s) => ({
      setActiveView: s.setActiveView,
      setProjectFilter: s.setProjectFilter,
      setSelectedId: s.setSelectedId,
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

  const [workspace, setWorkspace] = useState<WorkspaceKey>('worklist');
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'personal';
    const saved = window.localStorage.getItem('followup-hq:app-mode');
    return saved === 'team' ? 'team' : 'personal';
  });
  const [showCommand, setShowCommand] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const commandSearchRef = useRef<HTMLInputElement | null>(null);
  const commandOpenTriggerRef = useRef<HTMLButtonElement | null>(null);

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
      const target = event.target as HTMLElement | null;
      const inInputContext = !!target?.closest('input, textarea, select, [contenteditable="true"]');
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setShowCommand((value) => !value);
      }
      if (event.key === 'Escape' && showCommand) {
        event.preventDefault();
        setShowCommand(false);
      }
      if (inInputContext) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showCommand]);

  useEffect(() => {
    if (!showCommand) {
      setCommandQuery('');
      commandOpenTriggerRef.current?.focus();
      return;
    }
    commandSearchRef.current?.focus();
  }, [showCommand]);

  const openTrackerView = useCallback((view: SavedViewKey, project = 'All') => {
    setActiveView(view);
    setProjectFilter(project);
    setWorkspace('followups');
  }, [setActiveView, setProjectFilter]);

  const openTrackerItem = useCallback((itemId: string, view: SavedViewKey = 'All', project = 'All') => {
    setSelectedId(itemId);
    openTrackerView(view, project);
  }, [openTrackerView, setSelectedId]);

  const selectedItem = items.find((item) => item.id === selectedId) ?? null;
  const cleanupFollowUps = items.filter((item) => item.needsCleanup && item.status !== 'Closed').length;
  const cleanupTasks = tasks.filter((task) => task.needsCleanup && task.status !== 'Done').length;
  const combinedCleanup = cleanupFollowUps + cleanupTasks;

  const navCounts: Partial<Record<WorkspaceKey, number>> = {
    worklist: items.filter((item) => item.status !== 'Closed' && new Date(item.dueDate).getTime() <= Date.now() + 86400000).length,
    followups: items.filter((item) => item.status !== 'Closed').length,
    tasks: tasks.filter((task) => task.status !== 'Done').length,
    outlook: combinedCleanup,
  };

  const workspaceBody = useMemo(() => {
    switch (workspace) {
      case 'followups':
        return <TrackerWorkspace personalMode={appMode === 'personal'} />;
      case 'tasks':
        return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} personalMode={appMode === 'personal'} />;
      case 'exports':
        return <ExportWorkspace />;
      case 'outlook':
        return <OutlookPanel showAdvanced={false} />;
      case 'projects':
        return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} />;
      case 'relationships':
        return <RelationshipBoard />;
      default:
        return <OverviewWorkspace personalMode={appMode === 'personal'} onOpenTrackerView={openTrackerView} onOpenWorkspace={(value) => setWorkspace(value === 'tracker' ? 'followups' : value === 'queue' ? 'worklist' : value as WorkspaceKey)} />;
    }
  }, [workspace, appMode, openTrackerItem, openTrackerView]);

  const openQuickAdd = useCallback(() => {
    window.dispatchEvent(new CustomEvent('followuphq:open-quick-add', { detail: { focus: true, expand: true } }));
  }, []);

  const commands = [
    { label: 'Open Quick Add', run: openQuickAdd },
    { label: 'Open structured follow-up form', run: () => openCreateModal() },
    { label: 'Open structured task form', run: () => openCreateTaskModal() },
    { label: 'Open worklist', run: () => setWorkspace('worklist') },
    { label: 'Open follow-ups', run: () => setWorkspace('followups') },
    { label: 'Open tasks', run: () => setWorkspace('tasks') },
    { label: 'Open intake', run: () => setWorkspace('outlook') },
  ];
  const visibleCommands = commands.filter((command) => command.label.toLowerCase().includes(commandQuery.trim().toLowerCase()));

  const workspaceMeta: Record<WorkspaceKey, { title: string; purpose: string; health: string; actions: Array<{ label: string; run: () => void; primary?: boolean }> }> = {
    worklist: { title: 'Worklist', purpose: appMode === 'personal' ? 'Decide your next personal execution move quickly.' : 'Run the team queue with ownership and pressure visibility.', health: `${navCounts.worklist || 0} items due now`, actions: [{ label: 'Quick Add', run: openQuickAdd, primary: true }, { label: 'New follow-up (structured)', run: openCreateModal }, { label: 'New task (structured)', run: openCreateTaskModal }] },
    followups: { title: 'Follow Ups', purpose: appMode === 'personal' ? 'Keep your commitments moving with summary-first records.' : 'Coordinate follow-up ownership and team accountability.', health: `${navCounts.followups || 0} active follow-ups`, actions: [{ label: 'Quick Add', run: openQuickAdd, primary: true }, { label: 'New follow-up (structured)', run: openCreateModal }] },
    tasks: { title: 'Tasks', purpose: appMode === 'personal' ? 'Process your execution list with low-noise editing.' : 'Align task execution across teammates and linked follow-ups.', health: `${navCounts.tasks || 0} open tasks`, actions: [{ label: 'Quick Add', run: openQuickAdd, primary: true }, { label: 'New task (structured)', run: openCreateTaskModal }] },
    outlook: { title: 'Intake', purpose: appMode === 'personal' ? 'Capture incoming work and clean it into your queue.' : 'Route inbound intake safely for the whole team.', health: `${combinedCleanup} need cleanup`, actions: [{ label: 'Quick Add', run: openQuickAdd, primary: true }] },
    projects: { title: 'Projects', purpose: appMode === 'personal' ? 'Secondary: monitor project context for your own commitments.' : 'Primary team lens for project pressure and escalation.', health: `${items.length} linked follow-ups`, actions: [] },
    relationships: { title: 'Relationships', purpose: appMode === 'personal' ? 'Secondary: keep key relationship notes nearby.' : 'Primary team lens for relationship heat and communication risk.', health: `${items.length} connected threads`, actions: [] },
    exports: { title: 'Exports', purpose: appMode === 'personal' ? 'Export snapshots when you need external reporting.' : 'Export team-facing reporting and cadence summaries.', health: 'Export-ready data', actions: [] },
  };
  const currentMeta = workspaceMeta[workspace];

  return (
    <div className="app-shell text-slate-900">
      <div className="app-shell-glow app-shell-glow-amber" />
      <div className="app-shell-glow app-shell-glow-sky" />
      <div className="app-shell-layout">
        <aside className="app-nav-rail" aria-label="Primary workspace navigation">
          <div className="app-brand-block">
            <div className="app-brand-eyebrow">Daily execution workspace</div>
            <div className="app-brand-title">FollowUp HQ</div>
            <div className="app-brand-subline">Construction operations command</div>
          </div>
          <div className="grid gap-2">
            {navItems.map(({ key, label, icon: Icon }) => {
              const deemphasized = appMode === 'personal' ? (key === 'projects' || key === 'relationships' || key === 'exports') : false;
              return (
              <button
                key={key}
                type="button"
                onClick={() => setWorkspace(key)}
                className={[
                  'nav-card',
                  workspace === key ? 'nav-card-active' : '',
                  deemphasized ? 'nav-card-muted' : '',
                ].filter(Boolean).join(' ')}
                aria-current={workspace === key ? 'page' : undefined}
              >
                <div className="nav-card-row">
                  <span className="nav-label-cluster"><Icon className="h-4 w-4 nav-label-icon" /> <span className="nav-label-primary">{label}</span></span>
                  {navCounts[key] ? <span className="nav-pill"><span className="nav-pill-text">{navCounts[key]}</span></span> : null}
                </div>
              </button>
              );
            })}
          </div>
          <div className="mt-4"><button ref={commandOpenTriggerRef} type="button" onClick={() => setShowCommand(true)} className="nav-command-btn" aria-haspopup="dialog" aria-expanded={showCommand}><Command className="h-4 w-4" />Command palette</button></div>
        </aside>

          <main className="app-main-pane">
            <header className="workspace-header workspace-header-tight app-shell-card app-shell-card-hero">
            <div>
              <div className="workspace-label">{appMode === 'personal' ? 'Personal mode' : 'Team mode'}</div>
              <h1>{currentMeta.title}</h1>
              <p>{currentMeta.purpose}</p>
            </div>
            <div className="workspace-header-meta">
              <SegmentedControl value={appMode} onChange={setAppMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }]} />
              <WorkspaceHeaderMetaPill tone="info">{currentMeta.health}</WorkspaceHeaderMetaPill>
              <div className="workspace-header-actions">
                {currentMeta.actions.map((action) => (
                  <button key={action.label} type="button" onClick={action.run} className={action.primary ? 'primary-btn' : 'action-btn'}>
                    {action.primary ? <Sparkles className="h-4 w-4" /> : null}
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
        <div>
          <AppModal size="standard" onBackdropClick={() => setShowCommand(false)}>
            <div role="dialog" aria-modal="true" aria-label="Command palette" onClick={(e) => e.stopPropagation()}>
              <AppModalHeader title="Command palette" onClose={() => setShowCommand(false)} />
              <AppModalBody scrollable={false}>
            <label className="field-block">
              <span className="field-label">Quick find command</span>
              <div className="search-field-wrap">
                <Search className="search-field-icon h-4 w-4" />
                <input
                  ref={commandSearchRef}
                  className="field-input search-field-input"
                  type="search"
                  placeholder="Type command name"
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                />
              </div>
            </label>
            <div className="space-y-2">{visibleCommands.length ? visibleCommands.map((command) => <button type="button" key={command.label} className="saved-view-card w-full justify-between" onClick={() => { command.run(); setShowCommand(false); }}><span>{command.label}</span><Search className="h-4 w-4" /></button>) : <div className="empty-state"><div className="empty-state-title">No matching command</div><div className="empty-state-message">Try a shorter keyword such as “task” or “follow”.</div></div>}</div>
              </AppModalBody>
            </div>
          </AppModal>
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
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-6 py-5 text-sm text-slate-600 shadow-sm">
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
