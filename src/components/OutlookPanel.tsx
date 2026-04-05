import { AlertCircle, CheckCircle2, Copy, ExternalLink, Mail, RefreshCw, ShieldCheck, Unplug, Wrench } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Badge } from './Badge';
import { formatDateTime } from '../lib/utils';
import { isTauriRuntime } from '../lib/persistence';
import { useAppStore } from '../store/useAppStore';
import { ForwardingIntakeWorkspace } from './ForwardingIntakeWorkspace';
import { UniversalIntakeWorkspace } from './UniversalIntakeWorkspace';
import { AppShellCard, SectionHeader, StatTile } from './ui/AppPrimitives';
import { useShallow } from 'zustand/react/shallow';
import type { WorkspaceKey } from '../lib/appModeConfig';

const scopePresets = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];

export function OutlookPanel({ showAdvanced = false, setWorkspace }: { showAdvanced?: boolean; setWorkspace: (workspace: WorkspaceKey) => void }) {
  const {
    outlookConnection,
    updateOutlookSettings,
    startOutlookAuth,
    completeOutlookAuth,
    syncOutlookMailbox,
    disconnectOutlook,
    clearOutlookError,
  } = useAppStore(useShallow((s) => ({
    outlookConnection: s.outlookConnection,
    updateOutlookSettings: s.updateOutlookSettings,
    startOutlookAuth: s.startOutlookAuth,
    completeOutlookAuth: s.completeOutlookAuth,
    syncOutlookMailbox: s.syncOutlookMailbox,
    disconnectOutlook: s.disconnectOutlook,
    clearOutlookError: s.clearOutlookError,
  })));

  const [callbackUrl, setCallbackUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'review' | 'history' | 'rules' | 'settings'>('review');
  const processedCallbackRef = useRef<string | null>(null);

  useEffect(() => {
    if (!outlookConnection.authSession || !isTauriRuntime()) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const api = await import('@tauri-apps/api/core');
        const pendingCallback = await api.invoke<string | null>('read_outlook_loopback_callback');
        if (!pendingCallback || cancelled || processedCallbackRef.current === pendingCallback) return;
        processedCallbackRef.current = pendingCallback;
        window.clearInterval(interval);
        if (!cancelled) {
          setCallbackUrl((current) => (current === pendingCallback ? current : pendingCallback));
          await completeOutlookAuth(pendingCallback);
          await api.invoke('clear_outlook_loopback_callback');
        }
      } catch {
        // keep manual callback fallback available
      }
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [outlookConnection.authSession, completeOutlookAuth]);

  const copyAuthUrl = async () => {
    if (!outlookConnection.authSession?.authUrl) return;
    await navigator.clipboard.writeText(outlookConnection.authSession.authUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <AppShellCard className="space-y-4 outlook-command-surface" surface="command">
      <SectionHeader
        title="Intake review lane"
        subtitle="Start with the review queue, process inbound work quickly, then use admin utilities only when needed."
        actions={
          <div className="flex flex-wrap gap-2 tonal-chip-panel">
            <Badge variant="success">Forwarding-first workflow</Badge>
            <Badge variant={outlookConnection.mailboxLinked ? 'neutral' : 'warn'}>
              {outlookConnection.mailboxLinked ? 'Direct Outlook sync enabled' : 'Direct sync optional'}
            </Badge>
            <button onClick={() => setWorkspace('worklist')} className="action-btn !px-2.5 !py-1 text-xs">Return to Overview</button>
          </div>
        }
      />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-sm font-semibold text-slate-900">Review queue</div>
              <div className="text-xs text-slate-600">Open Intake, work Needs review items, approve or route, then move on.</div>
            </div>
            <button className={`outlook-tab-btn ${activeTab === 'review' ? 'outlook-tab-btn-active' : ''}`} onClick={() => setActiveTab('review')}>
              Open review lane
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3 text-xs">
            <span className="font-semibold uppercase tracking-wide text-slate-500">Utilities</span>
            <button className={`outlook-tab-btn ${activeTab === 'history' ? 'outlook-tab-btn-active' : ''}`} onClick={() => setActiveTab('history')}>History</button>
            <button className={`outlook-tab-btn ${activeTab === 'rules' ? 'outlook-tab-btn-active' : ''}`} onClick={() => setActiveTab('rules')}>Rules</button>
            <button className={`outlook-tab-btn ${activeTab === 'settings' ? 'outlook-tab-btn-active' : ''}`} onClick={() => setActiveTab('settings')}>Advanced sync</button>
          </div>
        </div>

        {activeTab === 'review' ? <UniversalIntakeWorkspace setWorkspace={setWorkspace} /> : null}
        {activeTab === 'history' ? (
          <div className="surface-block text-sm text-slate-700">
            Intake history is outcome-first. Use it to confirm prior decisions and rule impact after today’s queue is processed.
          </div>
        ) : null}
        {activeTab === 'rules' ? <ForwardingIntakeWorkspace /> : null}

        {showAdvanced && activeTab === 'settings' ? (
        <details className="rounded-2xl border border-slate-200 p-4 app-shell-card app-shell-card-inspector">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900">
            <Wrench className="h-4 w-4" /> Advanced: Experimental direct Outlook sync
          </summary>
          <p className="mt-2 text-sm text-slate-600">
            This path is secondary. Use it only if you need mailbox pull/sync in addition to forwarding intake.
          </p>

          {outlookConnection.lastError ? (
            <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <div>{outlookConnection.lastError}</div>
                </div>
                <button onClick={clearOutlookError} className="text-xs text-rose-700 underline">Dismiss</button>
              </div>
            </div>
          ) : null}

          <div className="mt-3 rounded-2xl border border-slate-200 p-4 inspector-block">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4" /> Outlook app settings
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-sm text-slate-700">
                Client ID
                <input
                  value={outlookConnection.settings.clientId}
                  onChange={(event) => updateOutlookSettings({ clientId: event.target.value })}
                  placeholder="Application (client) ID"
                  className="field-input mt-1 h-11 w-full rounded-2xl px-4 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Tenant
                <input
                  value={outlookConnection.settings.tenantId}
                  onChange={(event) => updateOutlookSettings({ tenantId: event.target.value || 'common' })}
                  placeholder="common or tenant GUID"
                  className="field-input mt-1 h-11 w-full rounded-2xl px-4 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700 md:col-span-2">
                Redirect URI
                <input
                  value={outlookConnection.settings.redirectUri}
                  onChange={(event) => updateOutlookSettings({ redirectUri: event.target.value })}
                  placeholder="http://localhost"
                  className="field-input mt-1 h-11 w-full rounded-2xl px-4 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700 md:col-span-2">
                Scopes
                <input
                  value={outlookConnection.settings.scopes.join(' ')}
                  onChange={(event) => updateOutlookSettings({ scopes: event.target.value.split(/[\s,]+/).filter(Boolean) })}
                  className="field-input mt-1 h-11 w-full rounded-2xl px-4 text-sm outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
                <div className="mt-2 flex flex-wrap gap-2">
                  {scopePresets.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => {
                        const next = outlookConnection.settings.scopes.includes(scope)
                          ? outlookConnection.settings.scopes.filter((value) => value !== scope)
                          : [...outlookConnection.settings.scopes, scope];
                        updateOutlookSettings({ scopes: next });
                      }}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-slate-50 px-3 py-1 text-xs text-slate-700 hover:bg-slate-100"
                    >
                      {scope}
                    </button>
                  ))}
                </div>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => void startOutlookAuth()} className="primary-btn border-slate-950 bg-slate-950 text-white hover:bg-slate-800">
                <ShieldCheck className="h-4 w-4" /> Start sign-in
              </button>
              <button onClick={() => void syncOutlookMailbox()} className="action-btn" disabled={!outlookConnection.mailboxLinked || outlookConnection.syncStatus === 'syncing'}>
                <RefreshCw className="h-4 w-4" /> {outlookConnection.syncCursorByFolder.inbox.deltaLink ? 'Run incremental sync' : 'Run first sync'}
              </button>
              <button onClick={disconnectOutlook} className="action-btn" disabled={!outlookConnection.mailboxLinked && !outlookConnection.authSession}>
                <Unplug className="h-4 w-4" /> Disconnect
              </button>
            </div>
          </div>

          {outlookConnection.authSession ? (
            <div className="mt-3 rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ExternalLink className="h-4 w-4 text-sky-700" /> PKCE browser handoff
              </div>
              <textarea
                value={outlookConnection.authSession.authUrl}
                readOnly
                className="field-textarea mt-3 min-h-24 w-full rounded-2xl p-3 text-xs text-slate-700 outline-none"
              />
              <div className="mt-3 flex flex-wrap gap-3">
                <button onClick={() => void copyAuthUrl()} className="action-btn">
                  <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy auth URL'}
                </button>
                <a href={outlookConnection.authSession.authUrl} target="_blank" rel="noreferrer" className="action-btn no-underline">
                  <ExternalLink className="h-4 w-4" /> Open in browser
                </a>
              </div>
              <label className="mt-4 block text-sm text-slate-700">
                Callback URL
                <textarea
                  value={callbackUrl}
                  onChange={(event) => setCallbackUrl(event.target.value)}
                  placeholder="Paste callback URL after sign-in"
                  className="field-textarea mt-1 min-h-20 w-full rounded-2xl p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <button onClick={() => void completeOutlookAuth(callbackUrl)} className="primary-btn mt-3 border-slate-950 bg-slate-950 text-white hover:bg-slate-800">
                Complete sign-in
              </button>
            </div>
          ) : null}

          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Mailbox" value={outlookConnection.profile?.displayName || 'Not connected'} helper={outlookConnection.profile?.email || 'Connect only if direct sync is required.'} />
            <StatTile label="Sync status" value={outlookConnection.syncStatus} helper={outlookConnection.lastSyncAt ? `Last sync ${formatDateTime(outlookConnection.lastSyncAt)}` : 'No sync run yet'} />
            <StatTile label="Connection" value={outlookConnection.mailboxLinked ? 'Linked' : 'Optional'} helper={outlookConnection.mailboxLinked ? 'Direct mailbox sync available.' : 'Forwarding flow works without this.'} />
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            {outlookConnection.mailboxLinked ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <Mail className="h-4 w-4 text-slate-500" />}
            Direct sync remains available, but forwarding intake is the primary workflow.
          </div>
        </details>
        ) : activeTab === 'settings' ? (
          <div className="surface-block text-sm text-slate-600">
            Advanced Outlook OAuth and PKCE setup is admin-only. Forwarding intake remains fully available for standard users.
          </div>
        ) : null}
    </AppShellCard>
  );
}
