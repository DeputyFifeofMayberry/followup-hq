import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Building2, CheckCircle2, Command, HardHat, LockKeyhole, Mail, Search, ShieldCheck, Sparkles } from 'lucide-react';

import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { ImportWizardModal } from './components/ImportWizardModal';
import { CreateWorkModal } from './components/CreateWorkModal';
import { MergeModal } from './components/MergeModal';
import { TouchLogModal } from './components/TouchLogModal';
import { UniversalCapture } from './components/UniversalCapture';
import { WorkspaceRenderer } from './components/app/WorkspaceRenderer';

import { supabase, supabaseConfigError } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';
import type { AppMode } from './types';
import { getModeConfig, getWorkspaceOrder, type WorkspaceKey as ModeWorkspaceKey } from './lib/appModeConfig';
import { buildCommandPaletteConfig, filterCommands } from './lib/commandPaletteConfig';
import { workspaceIcons } from './lib/workspaceRegistry';
import { AppModal, AppModalBody, AppModalHeader, NoMatchesState, SegmentedControl, StatePanel, WorkspaceHeaderMetaPill } from './components/ui/AppPrimitives';

type WorkspaceKey = ModeWorkspaceKey;

function SetPointMark() {
  return (
    <svg viewBox="0 0 720 520" role="img" aria-label="SetPoint execution workspace mark" className="login-hero-mark">
      <defs>
        <linearGradient id="heroSteel" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#f8fafc" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="heroAccent" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
        <linearGradient id="heroDark" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#111827" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
      </defs>

      <rect x="52" y="58" width="616" height="404" rx="36" fill="rgba(15,23,42,0.16)" />
      <rect x="38" y="44" width="616" height="404" rx="36" fill="url(#heroDark)" stroke="rgba(248,250,252,0.12)" />

      <g opacity="0.2">
        <path d="M84 366 210 246l72 68 122-132 64 57 85-81" fill="none" stroke="#14b8a6" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
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

        <path d="M58 42c6-40 36-64 81-64 45 0 74 24 81 64" fill="#0f766e" />
        <path d="M44 42h174" stroke="#14b8a6" strokeWidth="13" strokeLinecap="round" />
        <path d="M79 42v38M137 42v38M194 42v38" stroke="#5eead4" strokeWidth="10" strokeLinecap="round" />
        <path d="M158 35c18 8 27 25 29 53" fill="none" stroke="#6b7280" strokeWidth="7" strokeLinecap="round" />
        <rect x="178" y="85" width="26" height="82" rx="13" fill="url(#heroSteel)" transform="rotate(17 178 85)" />
      </g>

      <g transform="translate(308 150)">
        <text x="0" y="110" fontSize="92" fontWeight="800" fill="#f8fafc" letterSpacing="-3">SetPoint</text>
        <text x="2" y="206" fontSize="44" fontWeight="700" fill="url(#heroAccent)" letterSpacing="2">FROM INTAKE TO CLOSEOUT</text>
        <path d="M2 228h420" stroke="#2dd4bf" strokeWidth="10" strokeLinecap="round" />
        <path d="M284 42h104" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M336 42v96" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M292 138h88" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <path d="M352 154h72" stroke="#94a3b8" strokeWidth="14" strokeLinecap="round" />
        <circle cx="426" cy="154" r="18" fill="#14b8a6" />
      </g>
    </svg>
  );
}


function MissingSupabaseConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[760px] items-center justify-center">
        <div className="w-full rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <StatePanel
            tone="warning"
            title="Supabase setup needed"
            message="SetPoint needs valid Supabase environment variables before the app can load."
          />
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
            <div className="login-brand-badge">SetPoint • Construction execution workspace</div>
            <div className="login-brand-copy">
              <h1>From intake to closeout.</h1>
              <p>
                Capture inbound work, route it into execution lanes, and close it out with accountable coordination across projects and stakeholders.
              </p>
            </div>
          </div>

          <div className="login-hero-panel">
            <SetPointMark />
          </div>

          <div className="login-brand-points">
            <div className="login-point-card">
              <HardHat className="h-5 w-5" />
              <div>Intake and triage keep field updates, RFIs, and commitments aligned before work starts.</div>
            </div>
            <div className="login-point-card">
              <Building2 className="h-5 w-5" />
              <div>Follow Ups and Tasks drive execution with ownership, due dates, and next actions.</div>
            </div>
            <div className="login-point-card">
              <ShieldCheck className="h-5 w-5" />
              <div>Projects, Relationships, and Exports maintain pressure visibility and reporting confidence.</div>
            </div>
          </div>
        </section>

        <section className="login-card-wrap">
          <div className="login-card">
            <div className="login-card-topbar">
              <div className="login-chip">SetPoint</div>
              <div className="login-chip login-chip-muted">Secure sign-in</div>
            </div>

            <div className="login-card-copy">
              <h2>Sign in</h2>
              <p>Enter your execution workspace to move inbound work through routing, accountability, and closeout.</p>
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
                {submitting ? 'Signing in...' : 'Sign in to SetPoint'}
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

  const workspaceBody = useMemo(() => (
    <WorkspaceRenderer
      workspace={workspace}
      appMode={appMode}
      openTrackerView={openTrackerView}
      openTrackerItem={openTrackerItem}
      setWorkspace={setWorkspace}
    />
  ), [workspace, appMode, openTrackerItem, openTrackerView]);

  const orderedWorkspaces = getWorkspaceOrder();
  const navSections = useMemo(() => {
    const workspaceEntries = orderedWorkspaces.map((key) => ({ key, meta: modeConfig.workspaceMeta[key] }));
    return [
      { title: 'Primary workflow', tone: 'core' as const, items: workspaceEntries.filter(({ meta }) => meta.category === 'core') },
      { title: 'Support & reference', tone: 'support' as const, items: workspaceEntries.filter(({ meta }) => meta.category === 'support') },
    ];
  }, [modeConfig.workspaceMeta, orderedWorkspaces]);

  const runPrimaryAction = useCallback((actionKey: 'new-followup' | 'new-task' | 'none') => {
    if (actionKey === 'new-followup') {
      openCreateModal();
      return;
    }
    if (actionKey === 'new-task') {
      openCreateTaskModal();
    }
  }, [openCreateModal, openCreateTaskModal]);

  const commands = useMemo(() => buildCommandPaletteConfig({
    orderedWorkspaces,
    getWorkspaceLabel: (key) => modeConfig.workspaceMeta[key].userLabel,
    openCreateModal,
    openCreateTaskModal,
    setWorkspace,
  }), [modeConfig.workspaceMeta, openCreateModal, openCreateTaskModal, orderedWorkspaces]);
  const visibleCommands = useMemo(() => filterCommands(commands, commandQuery), [commands, commandQuery]);

  const currentMeta = modeConfig.workspaceMeta[workspace];
  const currentHealthLabel = currentMeta.healthLabel({ navCounts, totalItems: items.length, combinedCleanup });
  const showUniversalCapture = currentMeta.showUniversalCapture;

  return (
    <div className={`app-shell text-slate-900 ${currentMeta.category === 'support' ? 'app-shell-support-workspace' : 'app-shell-primary-workspace'}`}>
      <div className="app-shell-layout">
        <aside className={`app-nav-rail ${modeConfig.supportViewsMuted ? 'app-nav-rail-support-muted' : ''}`} aria-label="Primary workspace navigation">
          <div className="app-brand-block">
            <div className="app-brand-eyebrow">{modeConfig.shellLabel}</div>
            <div className="app-brand-title">SetPoint</div>
            <div className="app-brand-subline">From intake to closeout.</div>
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
                  {section.items.map(({ key, meta }) => {
                    const Icon = workspaceIcons[key];
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
                          section.tone === 'support' ? 'nav-card-muted' : '',
                          !active && section.tone === 'core' ? 'nav-card-primary-inactive' : '',
                        ].filter(Boolean).join(' ')}
                        aria-current={active ? 'page' : undefined}
                      >
                        <div className="nav-card-row">
                          <span className="nav-label-cluster">
                            <span className="nav-icon-shell"><Icon className="h-4 w-4 nav-label-icon" /></span>
                            <span className="nav-label-primary">{meta.userLabel}</span>
                          </span>
                          <span className="nav-card-meta-row">
                            {meta.startSurface ? <span className="nav-start-pill">Start here</span> : null}
                            {navCounts[key] ? <span className="nav-pill"><span className="nav-pill-text">{navCounts[key]}</span></span> : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-4"><button ref={commandOpenTriggerRef} type="button" onClick={() => setShowCommand(true)} className="nav-command-btn" aria-haspopup="dialog" aria-expanded={showCommand}><Command className="h-4 w-4" />Open SetPoint command palette</button></div>
        </aside>

          <main className="app-main-pane">
            <header className="workspace-header workspace-header-tight app-shell-card app-shell-card-hero">
              <div className="workspace-header-main">
                <div className="workspace-label">{modeConfig.displayName}</div>
                <h1>{currentMeta.shellTitle}</h1>
                <p>{currentMeta.shellPurpose}</p>
                <p className="workspace-shell-subcopy">{modeConfig.shellDescription}</p>
              </div>
              <div className="workspace-header-meta">
                <div className="workspace-header-meta-top">
                  <SegmentedControl value={appMode} onChange={setAppMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }]} />
                  <WorkspaceHeaderMetaPill tone="info">{currentHealthLabel}</WorkspaceHeaderMetaPill>
                </div>
                <div className="workspace-header-actions">
                  {currentMeta.primaryAction ? (
                    <button type="button" onClick={() => runPrimaryAction(currentMeta.primaryAction?.actionKey ?? 'none')} className={currentMeta.primaryAction.primary ? 'primary-btn' : 'action-btn'}>
                      {currentMeta.primaryAction.primary ? <Sparkles className="h-4 w-4" /> : null}
                      {currentMeta.primaryAction.label}
                    </button>
                  ) : null}
                </div>
              </div>
            </header>
            {showUniversalCapture ? (
              <section className="app-capture-slot app-shell-card app-shell-card-command">
                <UniversalCapture contextProject={selectedItem?.project} contextOwner={selectedItem?.owner} contextFollowUpId={selectedId} />
              </section>
            ) : null}
            <section className="workspace-body-slot">
              {workspaceBody}
            </section>
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
                  placeholder="Type command or workspace"
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                />
              </div>
            </label>
            <div className="space-y-2">{visibleCommands.length ? visibleCommands.map((command) => <button type="button" key={command.label} className="saved-view-card w-full justify-between" onClick={() => { command.run(); setShowCommand(false); }}><span>{command.label}</span><Search className="h-4 w-4" /></button>) : <NoMatchesState title="No matching command" message="Try a shorter keyword such as “task” or “follow”." />}</div>
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
          <StatePanel tone="loading" title="Loading session" message="Checking your SetPoint session and workspace context..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <MainApp />;
}
