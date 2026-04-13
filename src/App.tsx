import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Building2, CheckCircle2, Command, HardHat, LoaderCircle, LockKeyhole, Mail, Menu, Search, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';

import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { ImportWizardModal } from './components/ImportWizardModal';
import { CreateWorkModal } from './components/CreateWorkModal';
import { MergeModal } from './components/MergeModal';
import { TouchLogModal } from './components/TouchLogModal';
import { WorkspaceRenderer } from './components/app/WorkspaceRenderer';
import { UniversalRecordDrawer } from './components/UniversalRecordDrawer';
import { SetPointMark, SetPointMonogram, SetPointWordmark } from './components/brand';

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
import { buildDailyFocusSummary } from './lib/dailyFocus';
import { SettingsDrawer } from './components/SettingsDrawer';
import { AppToastHost } from './components/app/AppToastHost';
import { BuildStamp } from './components/app/BuildStamp';
import { useReminderScheduler } from './hooks/useReminderScheduler';
import { useConnectivitySync } from './hooks/useConnectivitySync';
import { selectOpenTaskCount } from './domains/tasks/selectors';
import { brand, readBrandStorageValue, writeBrandStorageValue } from './config/brand';

type WorkspaceKey = ModeWorkspaceKey;
const LAST_WORKSPACE_STORAGE_SUFFIX = 'last-workspace';


function MissingSupabaseConfigScreen() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[760px] items-center justify-center">
        <div className="w-full rounded-3xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
          <StatePanel
            tone="warning"
            title={brand.supabaseSetup.title}
            message={brand.supabaseSetup.message}
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
            <div className="login-brand-badge">{brand.appName} • {brand.shellDescriptor}</div>
            <div className="login-brand-copy">
              <SetPointWordmark decorative variant="hero" className="login-brand-wordmark" />
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
              <div>Projects, Relationships, and Reports maintain pressure visibility and reporting confidence.</div>
            </div>
          </div>
        </section>

        <section className="login-card-wrap">
          <div className="login-card">
            <div className="login-card-topbar">
              <div className="login-chip login-chip-brand">
                <SetPointWordmark decorative variant="compact" />
              </div>
              <div className="login-chip login-chip-muted">{brand.auth.secureSignInLabel}</div>
            </div>

            <div className="login-card-copy">
              <h2>{brand.auth.title}</h2>
              <p>{brand.auth.descriptor}</p>
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
                {submitting ? brand.auth.signingInAction : brand.auth.signInAction}
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
  const { setActiveView, setProjectFilter, setSelectedId, setDirectoryWorkspaceSession } = useAppStore(
    useShallow((s) => ({
      setActiveView: s.setActiveView,
      setProjectFilter: s.setProjectFilter,
      setSelectedId: s.setSelectedId,
      setDirectoryWorkspaceSession: s.setDirectoryWorkspaceSession,
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
    const saved = readBrandStorageValue('app-mode');
    return saved === 'team' ? 'team' : 'personal';
  });
  const modeConfig = getModeConfig(appMode);
  const [showCommand, setShowCommand] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [activeCommandIndex, setActiveCommandIndex] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shellUtilitiesOpen, setShellUtilitiesOpen] = useState(false);
  const [navSystemPanelLayout, setNavSystemPanelLayout] = useState<{ maxPx: number; opensDown: boolean } | null>(null);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signOutInProgress, setSignOutInProgress] = useState(false);
  const [saveAndSignOutInProgress, setSaveAndSignOutInProgress] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const commandSearchRef = useRef<HTMLInputElement | null>(null);
  const commandOpenTriggerRef = useRef<HTMLButtonElement | null>(null);
  const shellUtilityRef = useRef<HTMLDivElement | null>(null);
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
    const saved = readBrandStorageValue(LAST_WORKSPACE_STORAGE_SUFFIX);
    if (saved && orderedWorkspaces.includes(saved as WorkspaceKey)) {
      setWorkspace(saved as WorkspaceKey);
    }
  }, [orderedWorkspaces]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    writeBrandStorageValue(LAST_WORKSPACE_STORAGE_SUFFIX, workspace);
  }, [workspace]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      writeBrandStorageValue('app-mode', appMode);
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
      if (event.key === 'Escape' && shellUtilitiesOpen) {
        event.preventDefault();
        setShellUtilitiesOpen(false);
      }
      if (inInputContext) return;
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileNavOpen, modeConfig.workspaceMeta, runPrimaryAction, shellUtilitiesOpen, showCommand, workspace]);

  useLayoutEffect(() => {
    if (!shellUtilitiesOpen) {
      setNavSystemPanelLayout(null);
      return;
    }

    const shell = shellUtilityRef.current;
    if (!shell) return;

    const visualViewport = window.visualViewport;

    const update = () => {
      const el = shellUtilityRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 10;
      const vh = visualViewport?.height ?? window.innerHeight;
      const spaceAbove = Math.max(0, rect.top - margin);
      const spaceBelow = Math.max(0, vh - rect.bottom - margin);
      const cap = vh * 0.9;
      const preferDown = spaceAbove < 280 && spaceBelow > spaceAbove + 32;
      const rawMax = preferDown ? spaceBelow : spaceAbove;
      const maxPx = Math.min(cap, Math.max(96, rawMax));
      setNavSystemPanelLayout({ maxPx, opensDown: preferDown });
    };

    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(shell);
    const rail = document.getElementById('primary-workspace-nav');
    if (rail) ro.observe(rail);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);

    return () => {
      ro.disconnect();
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [shellUtilitiesOpen, mobileNavOpen]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!shellUtilityRef.current?.contains(event.target as Node)) {
        setShellUtilitiesOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

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

  const openTrackerItem = useCallback((itemId: string, view: SavedViewKey = 'All', project = 'All') => {
    setSelectedId(itemId);
    setActiveView(view);
    setProjectFilter(project);
    setWorkspace('followups');
  }, [setActiveView, setProjectFilter, setSelectedId]);

  const openTaskItem = useCallback((taskId: string, project = 'All') => {
    const executionSource = workspace === 'intake'
      ? 'outlook'
      : workspace === 'directory'
        ? 'relationships'
        : workspace === 'overview'
          ? 'overview'
          : 'overview';
    openExecutionLane('tasks', {
      source: executionSource,
      recordId: taskId,
      recordType: 'task',
      project,
      section: 'now',
      intentLabel: 'open task in Tasks',
      routeKind: 'review',
    });
    setWorkspace('tasks');
  }, [openExecutionLane, workspace]);

  const openDirectoryRecord = useCallback((recordType: 'project' | 'contact' | 'company', recordId: string) => {
    setDirectoryWorkspaceSession({
      selectedRecordType: recordType,
      selectedRecordId: recordId,
    });
    setWorkspace('directory');
  }, [setDirectoryWorkspaceSession, setWorkspace]);

  const cleanupFollowUps = items.filter((item) => item.needsCleanup && item.status !== 'Closed').length;
  const cleanupTasks = tasks.filter((task) => task.needsCleanup && task.status !== 'Done').length;
  const combinedCleanup = cleanupFollowUps + cleanupTasks;

  const navCounts: Partial<Record<WorkspaceKey, number>> = {
    overview: workspaceAttentionCounts.worklist,
    followups: workspaceAttentionCounts.followups,
    tasks: selectOpenTaskCount(tasks),
    intake: combinedCleanup,
  };

  const workspaceBody = useMemo(() => (
    <WorkspaceRenderer
      workspace={workspace}
      appMode={appMode}
      openFollowUp={openTrackerItem}
      openTask={openTaskItem}
      setWorkspace={setWorkspace}
      openDirectoryRecord={openDirectoryRecord}
    />
  ), [workspace, appMode, openTrackerItem, openTaskItem, openDirectoryRecord]);

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
  const dailyFocus = useMemo(() => buildDailyFocusSummary(items, tasks), [items, tasks]);
  const dailyFocusSummaryLabel = `${dailyFocus.pressure} overdue • ${dailyFocus.dueTodayFollowUps} due today`;

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
            <div className="app-brand-row">
              <SetPointMonogram decorative className="app-brand-monogram" />
              <div className="app-brand-copy-cluster">
                <div className="app-brand-eyebrow">{modeConfig.shellLabel}</div>
                <SetPointWordmark decorative variant="compact" className="app-brand-title app-brand-title-text" />
              </div>
            </div>
            <div className="app-brand-subline">{brand.shellSubline}</div>
          </div>
          <div className="app-nav-drawer-header">
            <div className="app-nav-drawer-label">Workspace menu</div>
            <div className="app-nav-drawer-current">{currentMeta.userLabel}</div>
            <button
              type="button"
              className="app-nav-drawer-close"
              onClick={() => setMobileNavOpen(false)}
              aria-label="Close workspace navigation"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="app-nav-rail-scroll-body">
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
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>
          <div className="nav-utility-stack">
            <button ref={commandOpenTriggerRef} type="button" onClick={() => setShowCommand(true)} className="nav-command-btn" aria-haspopup="dialog" aria-expanded={showCommand}>
              <Command className="h-4 w-4" />
              Open command
              <span className="nav-command-shortcut">⌘K</span>
            </button>
            <div
              className="nav-system-shell"
              ref={shellUtilityRef}
              style={
                navSystemPanelLayout != null
                  ? ({ '--nav-system-panel-max-h': `${navSystemPanelLayout.maxPx}px` } as React.CSSProperties)
                  : undefined
              }
            >
              <button
                type="button"
                className="nav-system-trigger"
                aria-haspopup="dialog"
                aria-expanded={shellUtilitiesOpen}
                onClick={() => setShellUtilitiesOpen((value) => !value)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                <span>System</span>
              </button>
              {shellUtilitiesOpen ? (
                <section
                  className={[
                    'nav-system-panel app-shell-card app-shell-card-inspector',
                    navSystemPanelLayout?.opensDown ? 'nav-system-panel--opens-down' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="dialog"
                  aria-label="Shell utilities"
                >
                  <div className="nav-system-panel-heading">System</div>
                  <div className="nav-system-panel-section">
                    <div className="nav-system-panel-label">Mode</div>
                    <SegmentedControl value={appMode} onChange={setAppMode} options={[{ value: 'personal', label: 'Personal' }, { value: 'team', label: 'Team' }]} />
                  </div>
                  <div className="nav-system-panel-section nav-system-panel-section-controls">
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
                  <div className="nav-system-panel-section">
                    <div className="nav-system-context-row">
                      <WorkspaceHeaderMetaPill tone="info">{currentHealthLabel}</WorkspaceHeaderMetaPill>
                      {workspace !== 'overview' ? (
                        <button type="button" className="action-chip workspace-focus-link" onClick={() => {
                          setWorkspace('overview');
                          setMobileNavOpen(false);
                          setShellUtilitiesOpen(false);
                        }}>
                          Daily focus: {dailyFocusSummaryLabel}
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="nav-system-panel-section nav-system-panel-section-build">
                    <BuildStamp />
                  </div>
                </section>
              ) : null}
            </div>
          </div>
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
                <SetPointWordmark decorative variant="compact" className="app-compact-shell-wordmark" />
              </div>
              <div className="app-compact-shell-current">
                <span>Workspace</span>
                <strong>{currentMeta.userLabel}</strong>
              </div>
            </div>
            <header className="workspace-header workspace-header-tight app-shell-card app-shell-card-hero">
              <div className="workspace-header-row workspace-header-row-top">
                <div className="workspace-header-main">
                  <div className="workspace-label">{modeConfig.displayName}</div>
                  <div className="workspace-header-title-wrap">
                    <div className="workspace-header-title-row">
                      <h1>{currentMeta.shellTitle}</h1>
                    </div>
                    <p>{currentMeta.shellPurpose.split(".")[0]}.</p>
                  </div>
                </div>
              </div>

              {currentMeta.primaryAction ? (
                <div className="workspace-header-row workspace-header-row-bottom workspace-header-row-actions-only">
                  <div className="workspace-header-actions">
                    <button type="button" onClick={() => runPrimaryAction(currentMeta.primaryAction?.actionKey ?? 'none')} className={currentMeta.primaryAction.primary ? 'primary-btn' : 'action-btn'}>
                      {currentMeta.primaryAction.primary ? <Sparkles className="h-4 w-4" /> : null}
                      {currentMeta.primaryAction.label}
                    </button>
                  </div>
                </div>
              ) : null}
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
            <div className="command-shell-kicker">SetPoint command center</div>
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
                  <div className="text-xs font-semibold tracking-tight text-slate-600">{grouped.group}</div>
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
            <div className="command-shell-shortcuts">
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
                {brand.signOut.pendingChangesMessage}
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
          <StatePanel tone="loading" title={brand.session.loadingTitle} message={brand.session.loadingMessage} />
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <MainApp session={session} />;
}
