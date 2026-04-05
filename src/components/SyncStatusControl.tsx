import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AlertTriangle, CheckCircle2, Cloud, Database, LoaderCircle, LogOut, RefreshCcw, Save, Upload, UserRound } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../lib/utils';
import { getCloudConfirmationLabel, getSyncStatusModel, selectSyncMetaSnapshot } from '../lib/syncStatus';
import { supabase } from '../lib/supabase';
import { signOut } from '../lib/auth';

function SyncStateIcon({ tone, spinning }: { tone: 'info' | 'success' | 'warn' | 'danger'; spinning: boolean }) {
  if (spinning || tone === 'info') return <LoaderCircle className={spinning ? 'h-3.5 w-3.5 state-spin' : 'h-3.5 w-3.5'} />;
  if (tone === 'danger') return <AlertTriangle className="h-3.5 w-3.5" />;
  if (tone === 'warn') return <Upload className="h-3.5 w-3.5" />;
  return <CheckCircle2 className="h-3.5 w-3.5" />;
}

export function SyncStatusControl() {
  const syncMeta = useAppStore(useShallow((s) => ({
    ...selectSyncMetaSnapshot(s),
    dirtyRecordRefs: s.dirtyRecordRefs,
    persistenceActivity: s.persistenceActivity,
    flushPersistenceNow: s.flushPersistenceNow,
    retryPersistenceNow: s.retryPersistenceNow,
  })));
  const [open, setOpen] = useState(false);
  const [runningManualSave, setRunningManualSave] = useState(false);
  const [runningRetry, setRunningRetry] = useState(false);
  const [email, setEmail] = useState<string>('');
  const [signingOut, setSigningOut] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const statusModel = useMemo(() => getSyncStatusModel(syncMeta), [syncMeta]);

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

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div className="sync-status-shell" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`sync-status-trigger sync-status-trigger-${statusModel.tone}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
        <span>{statusModel.stateLabel}</span>
      </button>

      {open ? (
        <section className="sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Sync status details">
          <div className="sync-status-panel-title">Save & sync trust center</div>
          <div className="sync-status-row">
            <span className="sync-status-row-label">Current state</span>
            <div className="sync-status-row-value">
              <SyncStateIcon tone={statusModel.stateTone} spinning={statusModel.showSpinner} />
              <span>{statusModel.stateLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.stateDescription}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Persistence mode</span>
            <div className="sync-status-row-value">
              {syncMeta.persistenceMode === 'supabase' ? <Cloud className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />}
              <span>{statusModel.modeLabel}</span>
            </div>
            <div className="sync-status-row-detail">{statusModel.modeDescription}</div>
            <div className="sync-status-row-detail">{syncMeta.persistenceMode === 'supabase' ? 'Cloud-backed mode: SetPoint writes to your account and keeps a local cache for resilience.' : 'Local/browser mode: data stays on this device/browser profile and does not sync across devices.'}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Trust diagnostics</span>
            <div className="sync-status-diagnostics-grid">
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last confirmed cloud save</div>
                <div className="sync-status-row-detail">{syncMeta.lastCloudConfirmedAt ? formatDateTime(syncMeta.lastCloudConfirmedAt) : 'No confirmed cloud save recorded yet.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last local write</div>
                <div className="sync-status-row-detail">{syncMeta.lastLocalWriteAt ? formatDateTime(syncMeta.lastLocalWriteAt) : 'No local writes recorded yet.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Last failed sync attempt</div>
                <div className="sync-status-row-detail">{syncMeta.lastFailedSyncAt ? formatDateTime(syncMeta.lastFailedSyncAt) : 'No failed sync attempts recorded.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Unsaved local edits</div>
                <div className="sync-status-row-detail">{syncMeta.hasLocalUnsavedChanges ? `${syncMeta.unsavedChangeCount} record${syncMeta.unsavedChangeCount === 1 ? '' : 's'} with unsaved edits` : 'No pending local edits.'}</div>
              </div>
              <div>
                <div className="sync-status-row-detail sync-status-row-detail-strong">Cloud confirmation status</div>
                <div className="sync-status-row-detail">
                  {getCloudConfirmationLabel(syncMeta)}
                </div>
              </div>
            </div>
            {syncMeta.lastFallbackRestoreAt ? (
              <div className="sync-status-row-detail">
                Last fallback/local recovery restore: {formatDateTime(syncMeta.lastFallbackRestoreAt)}
              </div>
            ) : null}
            {syncMeta.loadedFromLocalRecoveryCache ? (
              <div className="sync-status-row-detail">
                This session is currently using the local recovery cache to prevent data loss while cloud confirmation catches up.
              </div>
            ) : null}
            {syncMeta.dirtyRecordRefs.length ? (
              <div className="sync-status-row-detail">
                Dirty records in focus: {syncMeta.dirtyRecordRefs.slice(0, 3).map((ref) => `${ref.type} ${ref.id}`).join(', ')}
                {syncMeta.dirtyRecordRefs.length > 3 ? ` +${syncMeta.dirtyRecordRefs.length - 3} more` : ''}
              </div>
            ) : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Session</span>
            <div className="sync-status-row-value">
              <UserRound className="h-3.5 w-3.5" />
              <span>{email ? `Signed in as ${email}` : 'Signed-in account unavailable.'}</span>
            </div>
            <div className="sync-status-row-detail">Your session controls cloud-backed persistence availability and account-linked sync.</div>
            <button
              type="button"
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
              className="action-btn sync-status-signout"
              disabled={signingOut}
            >
              <LogOut className="h-3.5 w-3.5" />
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Recent sync activity</span>
            {syncMeta.persistenceActivity.length ? (
              <ul className="sync-status-activity-list" aria-label="Persistence activity log">
                {syncMeta.persistenceActivity.map((entry) => (
                  <li key={entry.id} className="sync-status-activity-item">
                    <div className="sync-status-activity-top">
                      <span className="sync-status-row-detail-strong">{entry.summary}</span>
                      <span className="sync-status-row-detail">{formatDateTime(entry.at)}</span>
                    </div>
                    {entry.detail ? <div className="sync-status-row-detail">{entry.detail}</div> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="sync-status-row-detail">No sync activity recorded yet.</div>
            )}
          </div>

          <div className="sync-status-actions">
            <button
              type="button"
              className="action-btn"
              disabled={!syncMeta.hasLocalUnsavedChanges || runningManualSave}
              onClick={() => {
                setRunningManualSave(true);
                void syncMeta.flushPersistenceNow().finally(() => setRunningManualSave(false));
              }}
            >
              <Save className="h-3.5 w-3.5" />
              {runningManualSave ? 'Saving now…' : 'Save now'}
            </button>
            <button
              type="button"
              className="action-btn"
              disabled={syncMeta.syncState !== 'error' || runningRetry}
              onClick={() => {
                setRunningRetry(true);
                void syncMeta.retryPersistenceNow().finally(() => setRunningRetry(false));
              }}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              {runningRetry ? 'Retrying…' : 'Retry failed save'}
            </button>
          </div>

          {syncMeta.saveError ? (
            <div className="sync-status-error">
              <AlertTriangle className="h-4 w-4" />
              <span>{syncMeta.saveError}</span>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
