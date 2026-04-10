import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Building2, CheckCircle2, Command, HardHat, LoaderCircle, LockKeyhole, Mail, Menu, Search, ShieldCheck, Sparkles, X } from 'lucide-react';

import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { ImportWizardModal } from './components/ImportWizardModal';
import { CreateWorkModal } from './components/CreateWorkModal';
import { MergeModal } from './components/MergeModal';
import { TouchLogModal } from './components/TouchLogModal';
import { WorkspaceRenderer } from './components/app/WorkspaceRenderer';
import { UniversalRecordDrawer } from './components/UniversalRecordDrawer';
import { SetPointMark, SetPointMonogram } from './components/brand';

import { supabase, supabaseConfigError } from './lib/supabase';
import { performSignOut, type SignOutLocalPolicy } from './lib/auth/signOut';
import { setPersistenceScopeUserId } from './lib/persistenceIdentity';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';
import type { AppMode } from './types';
import { getModeConfig, getWorkspaceOrder, type WorkspaceKey as ModeWorkspaceKey } from './lib/appModeConfig';
import { buildCommandPaletteConfig, buildGlobalRecordSearchIndex, filterCommands, type AppCommandGroup } from './lib/commandPaletteConfig';
import { workspaceIcons } from './lib/workspaceRegistry';
import { AppModal, AppModalBody, AppModalHeader, NoMatchesState, SegmentedControl, StatePanel, WorkspaceHeaderMetaPill } from './components/ui/AppPrimitives';
import { SyncStatusControl } from './components/SyncStatusControl';
import { isE2EMode } from './lib/e2eMode';
import { isDueToday, isOverdue, isTaskDueWithin, isTaskOverdue, needsNudge } from './lib/utils';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AppToastHost } from './components/app/AppToastHost';
import { useReminderScheduler } from './hooks/useReminderScheduler';
import { useConnectivitySync } from './hooks/useConnectivitySync';

type WorkspaceKey = ModeWorkspaceKey;
const LAST_WORKSPACE_STORAGE_KEY = 'followup-hq:last-workspace';


function MissingSupabaseConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[760px] items-center justify-center">
        <div className="w-full rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <StatePanel
            tone="warning"
            title="Supabase setup needed"
            message="FollowUp HQ needs valid Supabase environment variables before the app can load."
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
            <div className="login-brand-badge">FollowUp HQ • Daily construction workflow</div>
            <div className="login-brand-copy">
              <h1>Daily construction execution.</h1>
              <p>
                Capture inbound work, triage it quickly, and move it through accountable follow-up and task execution.
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
              <div className="login-chip login-chip-brand">FollowUp HQ</div>
              <div className="login-chip login-chip-muted">Secure sign-in</div>
            </div>

            <div className="login-card-copy">
              <h2>Sign in</h2>
              <p>Enter your daily operations workspace to triage work, track commitments, and finish execution.</p>
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

function MainApp({ session }: { session: Session }) {
  const initializeApp = useAppStore((s) => s.initializeApp);
  const { setActiveView, setProjectFilter, setSelectedId } = useAppStore(
    useShallow((s) => ({
      setActiveView: s.setActiveView,
      setProjectFilter: s.setProjectFilter,
      setSelectedId: s.setSelectedId,
    })),
  );
  const { openCreateModal, openCreateTaskModal, openCreateWorkModal, openRecordDrawer, openExecutionLane, items, tasks, projects, contacts, companies, selectedId, selectedTaskId, hasLocalUnsavedChanges, unsavedChangeCount, outboxState, unresolvedOutboxCount, syncState, flushPersistenceNow, workspaceAttentionCounts, hydrated, reminderPreferences, reminderCenterSummary, pendingReminders, updateReminderPreferences, requestReminderPermission, runReminderEvaluation, testReminderNotification } = useAppStore(
    useShallow((s) => ({
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
      openCreateWorkModal: s.openCreateWorkModal,
      openRecordDrawer: s.openRecordDrawer,
      openExecutionLane: s.openExecutionLane,
      items: s.items,
      tasks: s.tasks,
      projects: s.projects,
      contacts: s.contacts,
      companies: s.companies,
      selectedId: s.selectedId,
      selectedTaskId: s.selectedTaskId,
      hasLocalUnsavedChanges: s.hasLocalUnsavedChanges,
      unsavedChangeCount: s.unsavedChangeCount,
      outboxState: s.outboxState,
      unresolvedOutboxCount: s.unresolvedOutboxCount,
      syncState: s.syncState,
      flushPersistenceNow: s.flushPersistenceNow,
      workspaceAttentionCounts: s.workspaceAttentionCounts,
      hydrated: s.hydrated,
      reminderPreferences: s.reminderPreferences,
      reminderCenterSummary: s.reminderCenterSummary,
      pendingReminders: s.pendingReminders,
      updateReminderPreferences: s.updateReminderPreferences,
      requestReminderPermission: s.requestReminderPermission,
      runReminderEvaluation: s.runReminderEvaluation,
      testReminderNotification: s.testReminderNotification,
    })),
  );
  useReminderScheduler(hydrated);
  useConnectivitySync(Boolean(session));

  const [workspace, setWorkspace] = useState<WorkspaceKey>('overview');
  const [appMode, setAppMode] = useState<AppMode>(() => {
    if (typeof window === 'undefined') return 'personal';
    const saved = window.localStorage.getItem('followup-hq:app-mode');
    return saved === 'team' ? 'team' : 'personal';
  });
  const modeConfig = getModeConfig(appMode);
  const [showCommand, setShowCommand] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [saveAndSignOutInProgress, setSaveAndSignOutInProgress] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const commandSearchRef = useRef<HTMLInputElement | null>(null);
  const commandOpenTriggerRef = useRef<HTMLButtonElement | null>(null);
  const runPrimaryAction = useCallback((actionKey: 'new-followup' | 'new-task' | 'new-work' | 'none') => {
    if (actionKey === 'new-followup') {
      openCreateModal();
      return;
    }
    if (actionKey === 'new-task') {
      openCreateTaskModal();
      return;
    }
    if (actionKey === 'new-work') {
      openCreateWorkModal();
    }
  }, [openCreateModal, openCreateTaskModal, openCreateWorkModal]);
  const orderedWorkspaces = getWorkspaceOrder();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = window.localStorage.getItem(LAST_WORKSPACE_STORAGE_KEY);
    if (saved && orderedWorkspaces.includes(saved as WorkspaceKey)) {
      setWorkspace(saved as WorkspaceKey);
    }
  }, [orderedWorkspaces]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(LAST_WORKSPACE_STORAGE_KEY, workspace);
  }, [workspace]);

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
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'n') {
        event.preventDefault();
        runPrimaryAction(modeConfig.workspaceMeta[workspace].primaryAction?.actionKey ?? 'new-followup');
      }
      if (event.key === 'Escape' && showCommand) {
        event.preventDefault();
        setShowCommand(false);
      }
      if (event.key === 'Escape' && mobileNavOpen) {
        event.preventDefault();
        setMobileNavOpen(false);
      }
      if (inInputContext) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen, modeConfig.workspaceMeta, runPrimaryAction, showCommand, workspace]);

  useEffect(() => {
    if (!showCommand) {
      setCommandQuery('');
      commandOpenTriggerRef.current?.focus();
      return;
    }
    commandSearchRef.current?.focus();
  }, [showCommand]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const closeOnDesktop = () => {
      if (window.innerWidth >= 1200) {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
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

  const openTaskItem = useCallback((_taskId: string, project = 'All') => {
    setProjectFilter(project);
    setWorkspace('tasks');
  }, [setProjectFilter]);

  const cleanupFollowUps = items.filter((item) => item.needsCleanup && item.status !== 'Closed').length;
  const cleanupTasks = tasks.filter((task) => task.needsCleanup && task.status !== 'Done').length;
  const combinedCleanup = cleanupFollowUps + cleanupTasks;

  const navCounts: Partial<Record<WorkspaceKey, number>> = {
    overview: workspaceAttentionCounts.worklist,
    followups: workspaceAttentionCounts.followups,
    tasks: workspaceAttentionCounts.tasks,
    intake: combinedCleanup,
  };

  const workspaceBody = useMemo(() => (
    <WorkspaceRenderer
      workspace={workspace}
      appMode={appMode}
      openTrackerView={openTrackerView}
      openFollowUp={openTrackerItem}
      openTask={openTaskItem}
      setWorkspace={setWorkspace}
    />
  ), [workspace, appMode, openTrackerItem, openTaskItem, openTrackerView]);

  const navSections = useMemo(() => {
    const workspaceEntries = orderedWorkspaces.map((key) => ({ key, meta: modeConfig.workspaceMeta[key] }));
    return [
      { title: 'Primary workflow', tone: 'core' as const, items: workspaceEntries.filter(({ meta }) => meta.category === 'core') },
      { title: 'Support & reference', tone: 'support' as const, items: workspaceEntries.filter(({ meta }) => meta.category === 'support') },
    ];
  }, [modeConfig.workspaceMeta, orderedWorkspaces]);

  const commands = useMemo(() => buildCommandPaletteConfig({
    orderedWorkspaces,
    getWorkspaceLabel: (key) => modeConfig.workspaceMeta[key].userLabel,
    openCreateModal,
    openCreateTaskModal,
    setWorkspace,
    openRecordDrawer,
    openProjectContext: (projectName: string) => {
      openExecutionLane('followups', { project: projectName, source: 'projects', intentLabel: `project context ${projectName}` });
      setProjectFilter(projectName);
      setWorkspace('directory');
    },
    openSelectedInDrawer: () => {
      if (selectedTaskId) {
        openRecordDrawer({ type: 'task', id: selectedTaskId });
        return;
      }
      if (selectedId) {
        openRecordDrawer({ type: 'followup', id: selectedId });
      }
    },
    recordIndex: buildGlobalRecordSearchIndex({ items, tasks, projects, contacts, companies }),
  }), [modeConfig.workspaceMeta, openCreateModal, openCreateTaskModal, orderedWorkspaces, openRecordDrawer, openExecutionLane, setProjectFilter, selectedTaskId, selectedId, items, tasks, projects, contacts, companies]);
  const visibleCommands = useMemo(() => filterCommands(commands, commandQuery), [commands, commandQuery]);
  const groupedVisibleCommands = useMemo(() => {
    const groups: AppCommandGroup[] = ['Create', 'Navigation', 'Records', 'Workspaces'];
    return groups
      .map((group) => ({ group, commands: visibleCommands.filter((command) => command.group === group) }))
      .filter((entry) => entry.commands.length > 0);
  }, [visibleCommands]);
  const flatVisibleCommands = useMemo(() => groupedVisibleCommands.flatMap((entry) => entry.commands), [groupedVisibleCommands]);
  useEffect(() => {
    setActiveCommandIndex(0);
  }, [commandQuery, showCommand]);
  useEffect(() => {
    if (!flatVisibleCommands.length) {
      setActiveCommandIndex(0);
      return;
    }
    if (activeCommandIndex >= flatVisibleCommands.length) {
      setActiveCommandIndex(flatVisibleCommands.length - 1);
    }
  }, [activeCommandIndex, flatVisibleCommands]);

  const currentMeta = modeConfig.workspaceMeta[workspace];
  const currentHealthLabel = currentMeta.healthLabel({ navCounts, totalItems: items.length, combinedCleanup });
  const outboxRequiresAttention = ['queued', 'flushing', 'failed', 'conflict'].includes(outboxState);
  const hasSignOutRisk = hasLocalUnsavedChanges
    || unsavedChangeCount > 0
    || outboxRequiresAttention
    || unresolvedOutboxCount > 0
    || syncState === 'saving';
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasSignOutRisk) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasSignOutRisk]);
  const accountLabel = session.user.email ?? 'Account';
  const dailyFocus = useMemo(() => {
    const overdueFollowUps = items.filter((item) => isOverdue(item)).length;
    const dueTodayFollowUps = items.filter((item) => item.status !== 'Closed' && isDueToday(item)).length;
    const nudgeFollowUps = items.filter((item) => needsNudge(item)).length;
    const overdueTasks = tasks.filter((task) => isTaskOverdue(task)).length;
    const dueSoonTasks = tasks.filter((task) => isTaskDueWithin(task, 2)).length;
    return {
      overdueFollowUps,
      dueTodayFollowUps,
      nudgeFollowUps,
      overdueTasks,
      dueSoonTasks,
      pressure: overdueFollowUps + overdueTasks,
    };
  }, [items, tasks]);

  const executeSignOut = useCallback(async (localPolicy: SignOutLocalPolicy) => {
    if (signOutInProgress) return;
    setSignOutInProgress(true);
    setSignOutError(null);
    try {
      await performSignOut({ session, localPolicy });
      setShowSignOutModal(false);
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Sign out could not be completed.');
    } finally {
      setSignOutInProgress(false);
    }
  }, [session, signOutInProgress]);

  const handleStartSignOut = useCallback(() => {
    if (signOutInProgress) return;
    if (!hasSignOutRisk) {
      void executeSignOut('clear-scoped-persistence');
      return;
    }
    setShowSignOutModal(true);
  }, [executeSignOut, hasSignOutRisk, signOutInProgress]);

  return (
    <div className={`app-shell text-slate-900 ${currentMeta.category === 'support' ? 'app-shell-support-workspace' : 'app-shell-primary-workspace'}`}>
      <div className="app-shell-layout">
        <aside id="primary-workspace-nav" className={`app-nav-rail ${modeConfig.supportViewsMuted ? 'app-nav-rail-support-muted' : ''} ${mobileNavOpen ? 'app-nav-rail-mobile-open' : ''}`} aria-label="Primary workspace navigation">
          <div className="app-brand-block">
            <div className="app-brand-eyebrow">{modeConfig.shellLabel}</div>
            <div className="app-brand-title app-brand-title-text">FollowUp HQ</div>
            <div className="app-brand-subline">Daily operations</div>
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
                        onClick={() => {
                          setWorkspace(key);
                          setMobileNavOpen(false);
                        }}
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
                                                        {navCounts[key] && (active || section.tone === 'core') ? <span className="nav-pill"><span className="nav-pill-text">{navCounts[key]}</span></span> : null}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <div className="mt-4"><button ref={commandOpenTriggerRef} type="button" onClick={() => setShowCommand(true)} className="nav-command-btn" aria-haspopup="dialog" aria-expanded={showCommand}><Command className="h-4 w-4" />Open command</button></div>
        </aside>
        {mobileNavOpen ? <button type="button" className="app-nav-overlay" aria-label="Close navigation drawer" onClick={() => setMobileNavOpen(false)} /> : null}

          <main className="app-main-pane">
            <div className="app-compact-shell-bar">
              <button type="button" className="app-compact-shell-btn" onClick={() => setMobileNavOpen((value) => !value)} aria-expanded={mobileNavOpen} aria-controls="primary-workspace-nav">
                {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                Workspace menu
              </button>
              <div className="app-compact-shell-brand">
                <SetPointMonogram decorative className="app-compact-shell-monogram" />
                <strong className="app-compact-shell-wordmark">FollowUp HQ</strong>
              </div>
              <div className="app-compact-shell-current">
                <span>{modeConfig.displayName}</span>
                <strong>{currentMeta.shellTitle}</strong>
              </div>
            </div>
            <header className="workspace-header workspace-header-tight app-shell-card app-shell-card-hero">
              <div className="workspace-header-row workspace-header-row-top">
                <div className="workspace-header-main">
                  <div className="workspace-label">{modeConfig.displayName}</div>
                  <h1>{currentMeta.shellTitle}</h1>
                  <p>{currentMeta.shellPurpose.split(".")[0]}.</p>
                </div>
                <div className="workspace-header-meta-top">
                  <SegmentedControl value={appMode} onChange={setAppMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }]} />
                  <WorkspaceHeaderMetaPill tone="info">{currentHealthLabel}</WorkspaceHeaderMetaPill>
                  <SyncStatusControl />
                  <SettingsDrawer
                    accountLabel={accountLabel}
                    appMode={appMode}
                    onChangeAppMode={setAppMode}
                    onSignOut={handleStartSignOut}
                    signOutInProgress={signOutInProgress}
                    reminderPreferences={reminderPreferences}
                    reminderCenterSummary={reminderCenterSummary}
                    pendingReminders={pendingReminders}
                    updateReminderPreferences={updateReminderPreferences}
                    requestReminderPermission={requestReminderPermission}
                    runReminderEvaluation={runReminderEvaluation}
                    testReminderNotification={testReminderNotification}
                  />
                </div>
              </div>

              <div className="workspace-header-row workspace-header-row-bottom">
                <div className="workspace-header-actions">
                  {currentMeta.primaryAction ? (
                    <button type="button" onClick={() => runPrimaryAction(currentMeta.primaryAction?.actionKey ?? 'none')} className={currentMeta.primaryAction.primary ? 'primary-btn' : 'action-btn'}>
                      {currentMeta.primaryAction.primary ? <Sparkles className="h-4 w-4" /> : null}
                      {currentMeta.primaryAction.label}
                    </button>
                  ) : null}
                  <button type="button" className="action-btn" onClick={() => runPrimaryAction('new-followup')} title="Quick capture (Ctrl/Cmd+Shift+N)">
                    <Sparkles className="h-4 w-4" />
                    Quick add
                  </button>
                </div>

                <details className="daily-focus-strip">
                  <summary>
                    <span className="daily-focus-label">Daily focus</span>
                    <span className="daily-focus-summary">{dailyFocus.pressure} overdue • {dailyFocus.dueTodayFollowUps} due today • {dailyFocus.nudgeFollowUps} nudge</span>
                  </summary>
                  <div className="daily-focus-actions">
                    <button type="button" className="action-chip" onClick={() => openTrackerView('Overdue')}>Overdue</button>
                    <button type="button" className="action-chip" onClick={() => openTrackerView('Today')}>Due today</button>
                    <button type="button" className="action-chip" onClick={() => openTrackerView('Needs nudge')}>Needs nudge</button>
                    <span className="daily-focus-task-meta">Tasks: {dailyFocus.overdueTasks} overdue · {dailyFocus.dueSoonTasks} due soon</span>
                  </div>
                </details>
              </div>
            </header>
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
                  placeholder="Type command, tab, or record"
                  value={commandQuery}
                  onChange={(event) => setCommandQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (!flatVisibleCommands.length) return;
                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setActiveCommandIndex((value) => (value + 1) % flatVisibleCommands.length);
                    } else if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveCommandIndex((value) => (value - 1 + flatVisibleCommands.length) % flatVisibleCommands.length);
                    } else if (event.key === 'Enter') {
                      event.preventDefault();
                      flatVisibleCommands[activeCommandIndex]?.run();
                      setShowCommand(false);
                    }
                  }}
                />
              </div>
            </label>
            <div className="space-y-3">
              {groupedVisibleCommands.length ? groupedVisibleCommands.map((grouped) => (
                <section key={grouped.group} className="space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{grouped.group}</div>
                  <div className="space-y-2">
                    {grouped.commands.map((command) => {
                      const commandIndex = flatVisibleCommands.findIndex((entry) => entry.id === command.id);
                      const isActiveCommand = commandIndex === activeCommandIndex;
                      return (
                      <button
                        type="button"
                        key={command.id}
                        className={`saved-view-card w-full justify-between ${isActiveCommand ? 'ring-2 ring-slate-300' : ''}`}
                        onClick={() => {
                          command.run();
                          setShowCommand(false);
                        }}
                        onMouseEnter={() => setActiveCommandIndex(commandIndex)}
                      >
                        <span className="text-left">
                          <span>{command.label}</span>
                          {command.subtitle ? <span className="block text-xs text-slate-500">{command.subtitle}</span> : null}
                        </span>
                        <Search className="h-4 w-4" />
                      </button>
                      );
                    })}
                  </div>
                </section>
              )) : <NoMatchesState title="No matching command" message="Try a shorter keyword such as “task” or “follow”." />}
            </div>
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              ↑/↓ move • Enter run • Esc close • Ctrl/Cmd+Shift+N quick capture
            </div>
              </AppModalBody>
            </div>
          </AppModal>
        </div>
      ) : null}

      {showSignOutModal ? (
        <AppModal size="standard" onBackdropClick={() => {
          if (signOutInProgress || saveAndSignOutInProgress) return;
          setShowSignOutModal(false);
          setSignOutError(null);
        }}
        >
          <div role="dialog" aria-modal="true" aria-label="Confirm sign out" onClick={(e) => e.stopPropagation()}>
            <AppModalHeader title="Sign out" subtitle="Choose how to handle local recovery data." onClose={() => {
              if (signOutInProgress || saveAndSignOutInProgress) return;
              setShowSignOutModal(false);
              setSignOutError(null);
            }}
            />
            <AppModalBody>
              <p className="text-sm text-slate-600">
                You have pending local changes or recovery items. Choose how FollowUp HQ should handle this account before signing out.
              </p>
              <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <div>Unsaved local changes: {hasLocalUnsavedChanges || unsavedChangeCount > 0 ? `${Math.max(unsavedChangeCount, 1)} pending` : 'none'}</div>
                <div>Outbox status: {outboxState}</div>
                <div>Unresolved outbox entries: {unresolvedOutboxCount}</div>
                <div>Current sync state: {syncState}</div>
              </div>
              {signOutError ? <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{signOutError}</div> : null}
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="primary-btn"
                  disabled={signOutInProgress || saveAndSignOutInProgress}
                  onClick={() => {
                    setSaveAndSignOutInProgress(true);
                    setSignOutError(null);
                    void flushPersistenceNow()
                      .then(async () => {
                        const next = useAppStore.getState();
                        const stillRisky = next.hasLocalUnsavedChanges
                          || next.unsavedChangeCount > 0
                          || ['queued', 'flushing', 'failed', 'conflict'].includes(next.outboxState)
                          || next.unresolvedOutboxCount > 0
                          || next.syncState === 'saving';
                        if (stillRisky) {
                          setSignOutError('Save did not fully complete yet. You can keep protected local recovery for this account and sign out.');
                          return;
                        }
                        await executeSignOut('clear-scoped-persistence');
                      })
                      .catch((error) => {
                        setSignOutError(error instanceof Error ? error.message : 'Save attempt failed.');
                      })
                      .finally(() => setSaveAndSignOutInProgress(false));
                  }}
                >
                  {saveAndSignOutInProgress ? <LoaderCircle className="h-4 w-4 state-spin" /> : null}
                  {saveAndSignOutInProgress ? 'Saving before sign out…' : 'Save and sign out'}
                </button>
                <button
                  type="button"
                  className="action-btn"
                  disabled={signOutInProgress || saveAndSignOutInProgress}
                  onClick={() => { void executeSignOut('keep-protected-recovery'); }}
                >
                  {signOutInProgress ? <LoaderCircle className="h-4 w-4 state-spin" /> : null}
                  Sign out and keep protected local recovery for this account
                </button>
                <button type="button" className="action-btn" disabled={signOutInProgress || saveAndSignOutInProgress} onClick={() => {
                  setShowSignOutModal(false);
                  setSignOutError(null);
                }}
                >Cancel</button>
              </div>
            </AppModalBody>
          </div>
        </AppModal>
      ) : null}

      <CreateWorkModal />
      <TouchLogModal />
      <ImportWizardModal />
      <MergeModal />
      <FollowUpDraftModal />
      <UniversalRecordDrawer />
      <AppToastHost />
    </div>
  );
}

export default function App() {
  const e2eMode = isE2EMode();
  const [session, setSession] = useState<Session | null>(e2eMode ? ({ user: { id: 'e2e-user' } } as Session) : null);
  const [loadingSession, setLoadingSession] = useState(!e2eMode);

  useEffect(() => {
    if (e2eMode) {
      setSession({ user: { id: 'e2e-user' } } as Session);
      setLoadingSession(false);
      return;
    }

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
  }, [e2eMode]);

  useEffect(() => {
    setPersistenceScopeUserId(session?.user?.id ?? null);
  }, [session?.user?.id]);

  if (supabaseConfigError && !e2eMode) {
    return <MissingSupabaseConfigScreen />;
  }

  if (loadingSession) {
    return (
      <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-[560px] items-center justify-center">
          <StatePanel tone="loading" title="Loading session" message="Checking your FollowUp HQ session and workspace context..." />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <MainApp session={session} />;
}
