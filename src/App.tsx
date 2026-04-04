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
import { getModeConfig, type WorkspaceKey as ModeWorkspaceKey } from './lib/appModeConfig';
import { AppModal, AppModalBody, AppModalHeader, AppShellCard, SectionHeader, SegmentedControl, StatTile, WorkspaceHeaderMetaPill, WorkspacePage, WorkspacePrimaryLayout, WorkspaceSummaryStrip, WorkspaceTopStack } from './components/ui/AppPrimitives';
import { buildFollowUpCounts, selectFollowUpRows } from './lib/followUpSelectors';

type WorkspaceKey = ModeWorkspaceKey;

const navSections: Array<{ title: string; tone?: 'support'; items: Array<{ key: WorkspaceKey; label: string; icon: typeof ListChecks }> }> = [
  {
    title: 'Core workflow',
    items: [
      { key: 'worklist', label: 'Overview', icon: ListChecks },
      { key: 'followups', label: 'Follow Ups', icon: Activity },
      { key: 'tasks', label: 'Tasks', icon: ListTodo },
      { key: 'outlook', label: 'Intake', icon: Inbox },
    ],
  },
  {
    title: 'Supporting views',
    tone: 'support',
    items: [
      { key: 'projects', label: 'Projects', icon: BriefcaseBusiness },
      { key: 'relationships', label: 'Relationships', icon: Users },
      { key: 'exports', label: 'Exports', icon: FileSpreadsheet },
    ],
  },
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
  appMode,
}: {
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  onOpenWorkspace: (workspace: string) => void;
  personalMode: boolean;
  appMode: AppMode;
}) {
  return <OverviewPage onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace as never} personalMode={personalMode} appMode={appMode} />;
}

function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { items, contacts, companies, search, activeView, followUpFilters, tasks, openCreateModal } = useAppStore(
    useShallow((s) => ({
      items: s.items,
      contacts: s.contacts,
      companies: s.companies,
      search: s.search,
      activeView: s.activeView,
      followUpFilters: s.followUpFilters,
      tasks: s.tasks,
      openCreateModal: s.openCreateModal,
    })),
  );
  const filteredRows = useMemo(() => selectFollowUpRows({ items, contacts, companies, search, activeView, filters: followUpFilters }), [items, contacts, companies, search, activeView, followUpFilters]);
  const followUpStats = useMemo(() => buildFollowUpCounts(filteredRows), [filteredRows]);
  const openTaskCount = useMemo(() => tasks.filter((task) => task.status !== 'Done').length, [tasks]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <WorkspaceSummaryStrip className="overview-hero-card">
          <SectionHeader title="Follow-up execution queue" subtitle={personalMode ? 'Daily follow-through, ownership, and closure in one lane.' : 'Team ownership, nudges, and closeout decisions in one lane.'} actions={<button onClick={openCreateModal} className="primary-btn"><Sparkles className="h-4 w-4" />Add follow-up</button>} compact />
          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Visible follow-ups" value={followUpStats.total} helper="Current filtered queue" />
            <StatTile label="Overdue" value={followUpStats.overdue} helper="Past due date" tone={followUpStats.overdue ? 'warn' : 'default'} />
            <StatTile label="Needs nudge" value={followUpStats.needsNudge} helper="Touch timing drift" tone={followUpStats.needsNudge ? 'warn' : 'default'} />
            <StatTile label="Open tasks" value={openTaskCount} helper="Cross-workspace pressure" />
          </div>
          <div className="workspace-toolbar-row overview-support-row">
            <span className="overview-inline-guidance"><strong>Follow-up loop:</strong> Filter queue → run quick actions → review detail panel.</span>
            <span className="overview-inline-guidance">Bulk actions appear below filters whenever rows are selected.</span>
          </div>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>
      <WorkspacePrimaryLayout className="tracker-main-grid" inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel tracker-workspace-main" surface="data">
          <SectionHeader title="Follow-up queue" subtitle="Primary execution table with parallel controls and bulk actions." compact />
          <ControlBar compact />
          <TrackerTable personalMode={personalMode} appMode={appMode} embedded />
          <DuplicateReviewPanel />
        </AppShellCard>
        <ItemDetailPanel personalMode={personalMode} />
      </WorkspacePrimaryLayout>
    </WorkspacePage>
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
  const modeConfig = getModeConfig(appMode);
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
        return <TrackerWorkspace personalMode={appMode === 'personal'} appMode={appMode} />;
      case 'tasks':
        return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} personalMode={appMode === 'personal'} appMode={appMode} />;
      case 'exports':
        return <ExportWorkspace />;
      case 'outlook':
        return <OutlookPanel showAdvanced={false} />;
      case 'projects':
        return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} appMode={appMode} />;
      case 'relationships':
        return <RelationshipBoard appMode={appMode} />;
      default:
        return (
          <OverviewWorkspace
            personalMode={appMode === 'personal'}
            appMode={appMode}
            onOpenTrackerView={openTrackerView}
            onOpenWorkspace={(value) => {
              if (value === 'tracker' || value === 'followups') return setWorkspace('followups');
              if (value === 'queue' || value === 'overview') return setWorkspace('worklist');
              if (value === 'outlook') return setWorkspace('outlook');
              return setWorkspace(value as WorkspaceKey);
            }}
          />
        );
    }
  }, [workspace, appMode, openTrackerItem, openTrackerView]);

  const commands = [
    { label: 'New follow-up', run: () => openCreateModal() },
    { label: 'New task', run: () => openCreateTaskModal() },
    { label: 'Open overview', run: () => setWorkspace('worklist') },
    { label: 'Open follow-ups', run: () => setWorkspace('followups') },
    { label: 'Open tasks', run: () => setWorkspace('tasks') },
    { label: 'Open intake', run: () => setWorkspace('outlook') },
  ];
  const visibleCommands = commands.filter((command) => command.label.toLowerCase().includes(commandQuery.trim().toLowerCase()));

  const workspaceMeta: Record<WorkspaceKey, { title: string; purpose: string; health: string; actions: Array<{ label: string; run: () => void; primary?: boolean }> }> = {
    worklist: { title: 'Overview', purpose: 'Start here each day to triage work, review intake, and move into execution.', health: `${navCounts.worklist || 0} due now across your execution loop`, actions: [{ label: 'New follow-up', run: openCreateModal, primary: true }] },
    followups: { title: 'Follow Ups', purpose: appMode === 'personal' ? 'Execution workspace for moving commitments forward and closing loops.' : 'Execution workspace for team follow-up ownership, nudges, and closure.', health: `${navCounts.followups || 0} active follow-ups`, actions: [{ label: 'Add follow-up', run: openCreateModal, primary: true }] },
    tasks: { title: 'Tasks', purpose: appMode === 'personal' ? 'Execution workspace for shipping assigned work with low friction.' : 'Execution workspace for task throughput, assignees, and linked follow-ups.', health: `${navCounts.tasks || 0} open tasks`, actions: [{ label: 'Add task', run: openCreateTaskModal, primary: true }] },
    outlook: { title: 'Intake', purpose: appMode === 'personal' ? 'Core workflow intake lane: capture and clean work before execution.' : 'Core workflow intake lane for routing inbound work into team execution.', health: `${combinedCleanup} need cleanup`, actions: [] },
    projects: { title: 'Projects', purpose: appMode === 'personal' ? 'Supporting view for project context behind your core daily execution.' : 'Supporting view for project-level pressure, risk, and escalation context.', health: `${items.length} linked follow-ups`, actions: [] },
    relationships: { title: 'Relationships', purpose: appMode === 'personal' ? 'Supporting view for relationship context while you run core workflows.' : 'Supporting view for relationship heat, history, and communication context.', health: `${items.length} connected threads`, actions: [] },
    exports: { title: 'Exports', purpose: appMode === 'personal' ? 'Supporting view for snapshots and reporting outside daily execution.' : 'Supporting view for team reporting packs and external status exports.', health: 'Export-ready data', actions: [] },
  };

  const currentMeta = workspaceMeta[workspace];
  const showUniversalCapture = ['worklist', 'followups', 'tasks', 'outlook'].includes(workspace);

  return (
    <div className="app-shell text-slate-900">
      <div className="app-shell-layout">
        <aside className="app-nav-rail" aria-label="Primary workspace navigation">
          <div className="app-brand-block">
            <div className="app-brand-eyebrow">{modeConfig.shellLabel}</div>
            <div className="app-brand-title">FollowUp HQ</div>
            <div className="app-brand-subline">Construction operations command</div>
          </div>
          <div className="nav-section-stack">
            {navSections.map((section) => (
              <section
                key={section.title}
                className={section.tone === 'support' ? 'nav-section nav-section-support' : 'nav-section'}
                aria-label={section.title}
              >
                <div className="nav-section-heading">{section.title}</div>
                <div className="grid gap-2">
                  {section.items.map(({ key, label, icon: Icon }) => {
                    const deemphasized = section.tone === 'support' || (appMode === 'personal' ? (key === 'projects' || key === 'relationships' || key === 'exports') : false);
                    const active = workspace === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setWorkspace(key)}
                        className={[
                          'nav-card',
                          active ? 'nav-card-active' : '',
                          section.tone === 'support' ? 'nav-card-support' : 'nav-card-core',
                          deemphasized ? 'nav-card-muted' : '',
                        ].filter(Boolean).join(' ')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <div className="nav-card-row">
                          <span className="nav-label-cluster"><Icon className="h-4 w-4 nav-label-icon" /> <span className="nav-label-primary">{label}</span></span>
                          {navCounts[key] ? <span className="nav-pill"><span className="nav-pill-text">{navCounts[key]}</span></span> : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-4"><button ref={commandOpenTriggerRef} type="button" onClick={() => setShowCommand(true)} className="nav-command-btn" aria-haspopup="dialog" aria-expanded={showCommand}><Command className="h-4 w-4" />Command palette</button></div>
        </aside>

          <main className="app-main-pane">
            <header className="workspace-header workspace-header-tight app-shell-card app-shell-card-hero">
            <div>
              <div className="workspace-label">{modeConfig.displayName}</div>
              <h1>{currentMeta.title}</h1>
              <p>{currentMeta.purpose}</p>
              <p className="workspace-shell-subcopy">{modeConfig.shellDescription}</p>
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
            {showUniversalCapture ? <UniversalCapture contextProject={selectedItem?.project} contextOwner={selectedItem?.owner} contextFollowUpId={selectedId} /> : null}
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
