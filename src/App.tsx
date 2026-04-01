import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useShallow } from 'zustand/react/shallow';
import { Activity, ArrowDownToLine, BriefcaseBusiness, LayoutDashboard, Plus, Users } from 'lucide-react';

import { DailyReviewBoard } from './components/DailyReviewBoard';
import { DashboardBoard } from './components/DashboardBoard';
import { DuplicateReviewPanel } from './components/DuplicateReviewPanel';
import { FollowUpDraftModal } from './components/FollowUpDraftModal';
import { Header } from './components/Header';
import { ImportWizardModal } from './components/ImportWizardModal';
import { IntakePanel } from './components/IntakePanel';
import { ItemDetailPanel } from './components/ItemDetailPanel';
import { ItemFormModal } from './components/ItemFormModal';
import { MergeModal } from './components/MergeModal';
import { PersistenceBanner } from './components/PersistenceBanner';
import { ProjectCommandCenter } from './components/ProjectCommandCenter';
import { RelationshipBoard } from './components/RelationshipBoard';
import { SavedViewsBar } from './components/SavedViewsBar';
import { StatsGrid } from './components/StatsGrid';
import { TouchLogModal } from './components/TouchLogModal';
import { TrackerTable } from './components/TrackerTable';
import { ControlBar } from './components/ControlBar';

import { supabase } from './lib/supabase';
import { useAppStore } from './store/useAppStore';
import type { SavedViewKey } from './types';

type WorkspaceKey = 'overview' | 'tracker' | 'intake' | 'projects' | 'relationships';

const workspaces: Array<{ key: WorkspaceKey; label: string; icon: typeof LayoutDashboard }> = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'tracker', label: 'Tracker', icon: Activity },
  { key: 'intake', label: 'Intake', icon: ArrowDownToLine },
  { key: 'projects', label: 'Projects', icon: BriefcaseBusiness },
  { key: 'relationships', label: 'Relationships', icon: Users },
];

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
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto flex min-h-[80vh] max-w-[560px] items-center">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-950">Sign in</h1>
            <p className="mt-2 text-sm text-slate-500">
              Sign in to load and save your Follow Up HQ data from Supabase.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Email</div>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="block">
              <div className="mb-1 text-sm font-medium text-slate-700">Password</div>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none transition focus:border-slate-500"
                placeholder="Password"
                autoComplete="current-password"
                required
              />
            </label>

            {errorMessage ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {errorMessage}
              </div>
            ) : null}

            <button type="submit" disabled={submitting} className="primary-btn w-full justify-center">
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function QuickActionsCard({ onOpenTrackerView }: { onOpenTrackerView: (view: SavedViewKey, project?: string) => void }) {
  const { openCreateModal, openImportModal } = useAppStore(
    useShallow((s) => ({
      openCreateModal: s.openCreateModal,
      openImportModal: s.openImportModal,
    })),
  );

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Quick actions</h2>
          <p className="mt-1 text-sm text-slate-500">Keep the common actions one click away.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
          <Plus className="h-5 w-5" />
        </div>
      </div>
      <div className="mt-4 grid gap-3">
        <button onClick={openCreateModal} className="primary-btn justify-start">
          Add follow-up
        </button>
        <button onClick={openImportModal} className="action-btn justify-start">
          Import CSV / Excel issues
        </button>
        <button onClick={() => onOpenTrackerView('Needs nudge')} className="action-btn justify-start">
          Open nudge queue
        </button>
        <button onClick={() => onOpenTrackerView('Today')} className="action-btn justify-start">
          Run daily review
        </button>
      </div>
    </section>
  );
}

function OverviewWorkspace({
  onOpenTrackerView,
  onOpenWorkspace,
}: {
  onOpenTrackerView: (view: SavedViewKey, project?: string) => void;
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_340px]">
        <StatsGrid onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace} />
        <QuickActionsCard onOpenTrackerView={onOpenTrackerView} />
      </div>
      <DailyReviewBoard />
      <DashboardBoard onOpenTrackerView={onOpenTrackerView} onOpenWorkspace={onOpenWorkspace} />
    </div>
  );
}

function TrackerWorkspace() {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_420px]">
      <div className="space-y-6">
        <SavedViewsBar />
        <ControlBar />
        <TrackerTable />
        <DuplicateReviewPanel />
      </div>
      <ItemDetailPanel />
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

  const [workspace, setWorkspace] = useState<WorkspaceKey>('overview');

  useEffect(() => {
    void initializeApp();
  }, [initializeApp]);

  const openTrackerView = (view: SavedViewKey, project = 'All') => {
    setActiveView(view);
    setProjectFilter(project);
    setWorkspace('tracker');
  };

  const openTrackerItem = (itemId: string, view: SavedViewKey = 'All', project = 'All') => {
    setSelectedId(itemId);
    openTrackerView(view, project);
  };

  const workspaceBody = useMemo(() => {
    switch (workspace) {
      case 'tracker':
        return <TrackerWorkspace />;
      case 'intake':
        return <IntakePanel />;
      case 'projects':
        return <ProjectCommandCenter onFocusTracker={openTrackerView} onOpenItem={openTrackerItem} />;
      case 'relationships':
        return <RelationshipBoard />;
      default:
        return <OverviewWorkspace onOpenTrackerView={openTrackerView} onOpenWorkspace={setWorkspace} />;
    }
  }, [workspace]);

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 text-slate-900 sm:px-6 xl:px-8">
      <div className="mx-auto max-w-[1780px] space-y-6">
        <Header />
        <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm xl:sticky xl:top-6 xl:self-start">
            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
            <div className="grid gap-2">
              {workspaces.map(({ key, label, icon: Icon }) => (
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
            <div className="mt-4">
              <PersistenceBanner compact />
            </div>
          </aside>

          <main className="min-w-0">{workspaceBody}</main>
        </div>
      </div>

      <ItemFormModal />
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