import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Activity, BriefcaseBusiness, Building2, CheckCircle2, ChevronDown, FileSpreadsheet, HardHat, LayoutDashboard, ListChecks, ListTodo, LockKeyhole, Mail, ShieldCheck, Users } from 'lucide-react';

import { DuplicateReviewPanel } from './components/DuplicateReviewPanel';
import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { Header } from './components/Header';
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
import { WorkQueueBoard } from './components/WorkQueueBoard';
import { OutlookPanel } from './components/OutlookPanel';
import { UniversalCapture } from './components/UniversalCapture';

import { supabase, supabaseConfigError } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'tasks' | 'outlook' | 'projects' | 'relationships' | 'exports';

const primaryWorkspaces: Array<{ key: WorkspaceKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'queue', label: 'Queue', icon: ListChecks },
  { key: 'tracker', label: 'Follow Ups', icon: Activity },
  { key: 'tasks', label: 'Tasks', icon: ListTodo },
];

const utilityWorkspaces: Array<{ key: WorkspaceKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'exports', label: 'Exports', icon: FileSpreadsheet },
  { key: 'outlook', label: 'Email Intake', icon: Mail },
  { key: 'projects', label: 'Projects', icon: BriefcaseBusiness },
  { key: 'relationships', label: 'Relationships', icon: Users },
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
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
}) {
  return <OverviewPage onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace} />;
}

function TrackerWorkspace() {
  return (
    <div className="space-y-5">
      <ControlBar />
      <div className="tracker-main-grid">
        <div className="space-y-5">
          <TrackerTable />
          <DuplicateReviewPanel />
        </div>
        <ItemDetailPanel />
      </div>
    </div>
  );
}

function QueueSummaryStrip({
  onOpenTrackerView,
  onOpenTasks,
}: {
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  onOpenTasks: () => void;
}) {
  const { items, tasks } = useAppStore(useShallow((s) => ({ items: s.items, tasks: s.tasks })));
  const needsAction = items.filter((item) => item.status !== 'Closed').length;
  const nudgeCount = items.filter((item) => item.status !== 'Closed' && new Date(item.nextTouchDate).getTime() <= Date.now()).length;
  const openTasks = tasks.filter((task) => task.status !== 'Done').length;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Queue summary</div>
      <div className="grid gap-2 sm:grid-cols-3">
        <button onClick={() => onOpenTrackerView('All')} className="saved-view-card text-left">
          <div className="text-xs text-slate-500">Open follow-ups</div>
          <div className="text-xl font-semibold text-slate-900">{needsAction}</div>
        </button>
        <button onClick={() => onOpenTrackerView('Needs nudge')} className="saved-view-card text-left">
          <div className="text-xs text-slate-500">Needs touch now</div>
          <div className="text-xl font-semibold text-amber-700">{nudgeCount}</div>
        </button>
        <button onClick={onOpenTasks} className="saved-view-card text-left">
          <div className="text-xs text-slate-500">Open tasks</div>
          <div className="text-xl font-semibold text-slate-900">{openTasks}</div>
        </button>
      </div>
    </section>
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
  const { openCreateModal, openCreateTaskModal } = useAppStore(
    useShallow((s) => ({
      openCreateModal: s.openCreateModal,
      openCreateTaskModal: s.openCreateTaskModal,
    })),
  );

  const [workspace, setWorkspace] = useState<WorkspaceKey>('queue');
  const [showUtilities, setShowUtilities] = useState(false);

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  const openTrackerView = useCallback((view: SavedViewKey, project = 'All') => {
    setActiveView(view);
    setProjectFilter(project);
    setWorkspace('tracker');
  }, [setActiveView, setProjectFilter]);

  const openTrackerItem = useCallback((itemId: string, view: SavedViewKey = 'All', project = 'All') => {
    setSelectedId(itemId);
    openTrackerView(view, project);
  }, [openTrackerView, setSelectedId]);
  const openTaskItem = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setWorkspace('tasks');
  }, [setSelectedTaskId]);

  const workspaceBody = useMemo(() => {
    switch (workspace) {
      case 'tracker':
        return <TrackerWorkspace />;
      case 'queue':
        return <WorkQueueBoard onOpenFollowUp={(id) => openTrackerItem(id)} onOpenTask={openTaskItem} />;
      case 'tasks':
        return <TaskWorkspace onOpenLinkedFollowUp={(id) => openTrackerItem(id)} />;
      case 'exports':
        return <ExportWorkspace />;
      case 'outlook':
        return <OutlookPanel />;
      case 'projects':
        return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} />;
      case 'relationships':
        return <RelationshipBoard />;
      default:
        return <OverviewWorkspace onOpenTrackerView={openTrackerView} onOpenWorkspace={setWorkspace} />;
    }
  }, [workspace, openTaskItem, openTrackerItem, openTrackerView]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1780px] space-y-6">
        <Header />
        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
            <div className="grid gap-2">
              {primaryWorkspaces.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    setWorkspace(key);
                    setShowUtilities(false);
                  }}
                  className={workspace === key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}
                >
                  <div className="flex items-center gap-3 text-sm font-medium text-slate-900">
                    <Icon className="h-4 w-4" />
                    {label}
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4">
              <button onClick={() => setShowUtilities((current) => !current)} className="saved-view-card w-full justify-between">
                <span className="text-sm font-medium text-slate-900">Utilities/Admin</span>
                <ChevronDown className={showUtilities ? 'h-4 w-4 rotate-180 transition-transform' : 'h-4 w-4 transition-transform'} />
              </button>
              {showUtilities ? (
                <div className="mt-2 grid gap-2">
                  {utilityWorkspaces.map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setWorkspace(key)}
                      className={workspace === key ? 'saved-view-card saved-view-card-active' : 'saved-view-card'}
                    >
                      <div className="flex items-center gap-3 text-sm font-medium text-slate-900">
                        <Icon className="h-4 w-4" />
                        {label}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Today actions</div>
              <div className="mt-2 grid gap-2">
                <button onClick={openCreateModal} className="action-btn justify-start">Create work</button>
                <button onClick={openCreateTaskModal} className="action-btn justify-start">Create task mode</button>
              </div>
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            <UniversalCapture />
            {workspace === 'queue' ? <QueueSummaryStrip onOpenTrackerView={openTrackerView} onOpenTasks={() => setWorkspace('tasks')} /> : null}
            {workspaceBody}
          </main>
        </div>
      </div>

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
