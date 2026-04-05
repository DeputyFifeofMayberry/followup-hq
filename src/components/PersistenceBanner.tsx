import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, LoaderCircle, LogOut, TriangleAlert, UserRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import { getSyncStatusModel } from '../lib/syncStatus';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

export function PersistenceBanner({ compact = false }: { compact?: boolean }) {
  const { persistenceMode, saveError, hydrated, syncState, lastSyncedAt, unsavedChangeCount, hasLocalUnsavedChanges } = useAppStore(useShallow((s) => ({
    persistenceMode: s.persistenceMode,
    saveError: s.saveError,
    hydrated: s.hydrated,
    syncState: s.syncState,
    lastSyncedAt: s.lastSyncedAt,
    unsavedChangeCount: s.unsavedChangeCount,
    hasLocalUnsavedChanges: s.hasLocalUnsavedChanges,
  })));
  const [email, setEmail] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setEmail(data.user?.email ?? '');
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? '');
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const statusModel = useMemo(() => getSyncStatusModel({
    persistenceMode,
    saveError,
    hydrated,
    syncState,
    unsavedChangeCount,
    hasLocalUnsavedChanges,
    lastSyncedAt,
  }), [hydrated, syncState, persistenceMode, saveError, unsavedChangeCount, hasLocalUnsavedChanges, lastSyncedAt]);

  const StatusIcon = statusModel.stateTone === 'danger'
    ? AlertTriangle
    : statusModel.showSpinner || statusModel.stateTone === 'info'
      ? LoaderCircle
      : CheckCircle2;

  if (compact) {
    if (!saveError && syncState !== 'saving' && syncState !== 'error' && !hasLocalUnsavedChanges) {
      return null;
    }
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
        <div className="flex items-center gap-2 text-slate-700">
          <StatusIcon className={statusModel.showSpinner ? 'h-4 w-4 state-spin' : 'h-4 w-4'} />
          <span className="font-medium">{statusModel.stateLabel}</span>
        </div>
        <div className="mt-1 text-slate-500">{statusModel.stateDescription}</div>
        {hasLocalUnsavedChanges ? <div className="mt-1 text-slate-500">{unsavedChangeCount} pending local change{unsavedChangeCount === 1 ? '' : 's'}.</div> : null}
        {email ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
            <UserRound className="h-3.5 w-3.5" />
            {email}
          </div>
        ) : null}
        {saveError ? (
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
            <TriangleAlert className="h-3.5 w-3.5" />
            {saveError}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
            <StatusIcon className={statusModel.showSpinner ? 'h-4 w-4 state-spin' : 'h-4 w-4'} />
            <span className="font-medium">{statusModel.stateLabel}</span>
            <span className="text-slate-500">{statusModel.stateDescription}</span>
          </div>
          {saveError ? (
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
              <TriangleAlert className="h-4 w-4" />
              {saveError}
            </div>
          ) : null}
        </div>
        {email ? (
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
              <UserRound className="h-4 w-4" />
              Signed in as {email}
            </div>
            <button
              type="button"
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              disabled={signingOut}
            >
              <LogOut className="h-4 w-4" />
              {signingOut ? 'Signing out' : 'Sign out'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
