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

const scopePresets = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];

export function OutlookPanel({ showAdvanced = false }: { showAdvanced?: boolean }) {
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
    <AppShellCard className="space-y-4">
      <SectionHeader
        title="Email Intake"
        subtitle="Recommended path: forward emails into intake, review what gets created, and keep routing predictable."
        actions={
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
            <Badge variant="success">Forwarding-first workflow</Badge>
            <Badge variant={outlookConnection.mailboxLinked ? 'neutral' : 'warn'}>
              {outlookConnection.mailboxLinked ? 'Direct Outlook sync enabled' : 'Direct sync optional'}
            </Badge>
          </div>
        }
      />
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2">
          <button className={`action-btn ${activeTab === 'review' ? 'border-slate-900 bg-white' : 'bg-transparent'}`} onClick={() => setActiveTab('review')}>Review Queue</button>
          <button className={`action-btn ${activeTab === 'history' ? 'border-slate-900 bg-white' : 'bg-transparent'}`} onClick={() => setActiveTab('history')}>Intake History</button>
          <button className={`action-btn ${activeTab === 'rules' ? 'border-slate-900 bg-white' : 'bg-transparent'}`} onClick={() => setActiveTab('rules')}>Rules / Settings</button>
          <button className={`action-btn ${activeTab === 'settings' ? 'border-slate-900 bg-white' : 'bg-transparent'}`} onClick={() => setActiveTab('settings')}>Advanced Outlook Sync</button>
        </div>

        {activeTab === 'review' ? <UniversalIntakeWorkspace /> : null}
        {activeTab === 'history' ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            Intake history is now represented by persistent batches and assets in the Universal Intake Workspace. Select any asset to inspect extracted text, evidence, parse status, and candidate outcomes.
          </div>
        ) : null}
        {activeTab === 'rules' ? <ForwardingIntakeWorkspace /> : null}

        {showAdvanced && activeTab === 'settings' ? (
        <details className="rounded-2xl border border-slate-200 p-4">
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

          <div className="mt-3 rounded-2xl border border-slate-200 p-4">
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
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700">
                Tenant
                <input
                  value={outlookConnection.settings.tenantId}
                  onChange={(event) => updateOutlookSettings({ tenantId: event.target.value || 'common' })}
                  placeholder="common or tenant GUID"
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700 md:col-span-2">
                Redirect URI
                <input
                  value={outlookConnection.settings.redirectUri}
                  onChange={(event) => updateOutlookSettings({ redirectUri: event.target.value })}
                  placeholder="http://localhost"
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block text-sm text-slate-700 md:col-span-2">
                Scopes
                <input
                  value={outlookConnection.settings.scopes.join(' ')}
                  onChange={(event) => updateOutlookSettings({ scopes: event.target.value.split(/[\s,]+/).filter(Boolean) })}
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
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
                      className="inline-flex items-center rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
                className="mt-3 min-h-24 w-full rounded-2xl border border-slate-300 bg-white p-3 text-xs text-slate-700 outline-none"
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
                  className="mt-1 min-h-20 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
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
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Advanced Outlook OAuth and PKCE setup is admin-only. Forwarding intake remains fully available for standard users.
          </div>
        ) : null}
    </AppShellCard>
  );
}
