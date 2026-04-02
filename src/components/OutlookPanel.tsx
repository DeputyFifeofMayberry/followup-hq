import { AlertCircle, CheckCircle2, Copy, ExternalLink, Mail, RefreshCw, ShieldCheck, Unplug, Clock3, GitBranch, ArrowRightCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from './Badge';
import { formatDateTime } from '../lib/utils';
import { isTauriRuntime } from '../lib/persistence';
import { buildReplyGapInsights, buildThreadSuggestions } from '../lib/outlookInsights';
import { useAppStore } from '../store/useAppStore';
import { ForwardingIntakeWorkspace } from './ForwardingIntakeWorkspace';
import { useShallow } from 'zustand/react/shallow';

const scopePresets = ['openid', 'profile', 'offline_access', 'User.Read', 'Mail.Read'];

export function OutlookPanel() {
  const {
    items,
    outlookConnection,
    outlookMessages,
    updateOutlookSettings,
    startOutlookAuth,
    completeOutlookAuth,
    syncOutlookMailbox,
    importOutlookMessage,
    disconnectOutlook,
    clearOutlookError,
  } = useAppStore(useShallow((s) => ({
    items: s.items,
    outlookConnection: s.outlookConnection,
    outlookMessages: s.outlookMessages,
    updateOutlookSettings: s.updateOutlookSettings,
    startOutlookAuth: s.startOutlookAuth,
    completeOutlookAuth: s.completeOutlookAuth,
    syncOutlookMailbox: s.syncOutlookMailbox,
    importOutlookMessage: s.importOutlookMessage,
    disconnectOutlook: s.disconnectOutlook,
    clearOutlookError: s.clearOutlookError,
  })));

  const [callbackUrl, setCallbackUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const attentionCount = useMemo(
    () => outlookMessages.filter((message) => message.flagStatus === 'flagged' || message.importance === 'high' || !message.isRead).length,
    [outlookMessages],
  );

  const replyGaps = useMemo(() => buildReplyGapInsights(outlookMessages, items), [outlookMessages, items]);
  const threadSuggestions = useMemo(() => buildThreadSuggestions(outlookMessages, items), [outlookMessages, items]);



  useEffect(() => {
    if (!outlookConnection.authSession || !isTauriRuntime()) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      try {
        const api = await import('@tauri-apps/api/core');
        const callbackUrl = await api.invoke<string | null>('read_outlook_loopback_callback');
        if (!callbackUrl || cancelled) return;
        window.clearInterval(interval);
        if (!cancelled) {
          setCallbackUrl(callbackUrl);
          await completeOutlookAuth(callbackUrl);
          await api.invoke('clear_outlook_loopback_callback');
        }
      } catch {
        // swallow polling errors and let manual fallback remain available
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
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Outlook workspace</h2>
            <p className="mt-1 text-sm text-slate-500">
              Connect Outlook, keep a delta sync cursor, surface reply gaps, and turn live email threads into owned follow-ups.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={outlookConnection.mailboxLinked ? 'success' : 'neutral'}>
              {outlookConnection.mailboxLinked ? 'Mailbox linked' : 'Not linked'}
            </Badge>
            <Badge variant={outlookConnection.syncStatus === 'error' ? 'danger' : outlookConnection.syncStatus === 'syncing' ? 'warn' : 'blue'}>
              {outlookConnection.syncStatus}
            </Badge>
            {outlookConnection.lastSyncMode ? (
              <Badge variant={outlookConnection.lastSyncMode === 'delta' ? 'success' : 'neutral'}>
                {outlookConnection.lastSyncMode === 'delta' ? 'Incremental sync ready' : 'Initial sync'}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 xl:grid-cols-2">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4" /> Microsoft app registration
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
              <label className="block text-sm text-slate-700">
                Sync limit
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={outlookConnection.settings.syncLimit}
                  onChange={(event) => updateOutlookSettings({ syncLimit: Number(event.target.value || 15) })}
                  className="mt-1 h-11 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={outlookConnection.settings.autoPullSent}
                  onChange={(event) => updateOutlookSettings({ autoPullSent: event.target.checked })}
                />
                Also pull Sent Items on each sync
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => void startOutlookAuth()} className="primary-btn bg-slate-950 text-white border-slate-950 hover:bg-slate-800">
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
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
                <ExternalLink className="h-4 w-4 text-sky-700" /> PKCE browser handoff
              </div>
              <p className="text-sm text-slate-600">
                {isTauriRuntime()
                  ? 'Microsoft sign-in should already be opening in your browser. After you approve access, FollowUp HQ will catch the callback automatically on localhost.'
                  : 'Open the authorization URL in your browser. After Microsoft redirects to your redirect URI, copy the full callback URL and paste it below.'}
              </p>
              <textarea
                value={outlookConnection.authSession.authUrl}
                readOnly
                className="mt-3 min-h-28 w-full rounded-2xl border border-slate-300 bg-white p-3 text-xs text-slate-700 outline-none"
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
                  placeholder="Paste the full callback URL after sign-in"
                  className="mt-1 min-h-28 w-full rounded-2xl border border-slate-300 bg-white p-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <button onClick={() => void completeOutlookAuth(callbackUrl)} className="primary-btn mt-3 bg-slate-950 text-white border-slate-950 hover:bg-slate-800">
                Complete sign-in
              </button>
            </div>
          ) : null}

          {outlookConnection.lastError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2 text-sm text-rose-700">
                  <AlertCircle className="mt-0.5 h-4 w-4" />
                  <div>{outlookConnection.lastError}</div>
                </div>
                <button onClick={clearOutlookError} className="text-xs text-rose-700 underline">Dismiss</button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Mailbox</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {outlookConnection.profile?.displayName || 'Not connected'}
              </div>
              <div className="mt-1 text-sm text-slate-500">{outlookConnection.profile?.email || 'Connect Outlook to pull your mail queue.'}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Attention queue</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{attentionCount}</div>
              <div className="mt-1 text-sm text-slate-500">
                {outlookConnection.lastSyncAt ? `Last sync ${formatDateTime(outlookConnection.lastSyncAt)}` : 'No mailbox sync yet'}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Reply gaps</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{replyGaps.length}</div>
              <div className="mt-1 text-sm text-slate-500">Sent threads waiting on a reply.</div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm text-slate-500">Thread suggestions</div>
              <div className="mt-1 text-lg font-semibold text-slate-900">{threadSuggestions.length}</div>
              <div className="mt-1 text-sm text-slate-500">Suggested Outlook-to-follow-up conversions.</div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Sync cursor state</div>
                <div className="text-sm text-slate-500">Phase 9 keeps separate delta cursors for inbox and sent mail.</div>
              </div>
              <GitBranch className="h-5 w-5 text-slate-500" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(['inbox', 'sentitems'] as const).map((folder) => (
                <div key={folder} className="rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
                  <div className="font-medium capitalize text-slate-900">{folder === 'sentitems' ? 'Sent Items' : 'Inbox'}</div>
                  <div className="mt-2">Cursor: {outlookConnection.syncCursorByFolder[folder]?.deltaLink ? 'ready' : 'not started'}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {outlookConnection.syncCursorByFolder[folder]?.lastFolderSyncAt
                      ? `Last folder sync ${formatDateTime(outlookConnection.syncCursorByFolder[folder].lastFolderSyncAt as string)}`
                      : 'No folder sync yet'}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Messages stored: {outlookConnection.syncCursorByFolder[folder]?.lastMessageCount ?? 0}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <ForwardingIntakeWorkspace />

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Waiting-on-reply queue</div>
                <div className="text-sm text-slate-500">Sent threads with no inbound response yet.</div>
              </div>
              <Clock3 className="h-5 w-5 text-slate-500" />
            </div>
            <div className="space-y-3">
              {replyGaps.slice(0, 6).map((gap) => (
                <div key={gap.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{gap.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">Waiting {gap.waitingDays} day{gap.waitingDays === 1 ? '' : 's'} • {gap.waitingOn.join('; ') || 'Unknown recipient'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={gap.waitingDays >= 7 ? 'danger' : 'warn'}>{gap.waitingDays >= 7 ? 'Escalate' : 'Needs nudge'}</Badge>
                      {gap.hasTrackedItem ? <Badge variant="success">Tracked</Badge> : <Badge variant="neutral">Not tracked</Badge>}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{gap.reason}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => importOutlookMessage(gap.sentMessageId)} className="action-btn">
                      <ArrowRightCircle className="h-4 w-4" /> Import / update follow-up
                    </button>
                    {gap.webLink ? <a href={gap.webLink} target="_blank" rel="noreferrer" className="action-btn no-underline"><ExternalLink className="h-4 w-4" /> Open thread</a> : null}
                  </div>
                </div>
              ))}
              {replyGaps.length === 0 ? <div className="text-sm text-slate-500">No reply gaps detected yet.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Thread-aware suggestions</div>
                <div className="text-sm text-slate-500">Phase 9 reads the synced thread shape and suggests the next move.</div>
              </div>
              <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            </div>
            <div className="space-y-3">
              {threadSuggestions.slice(0, 8).map((suggestion) => (
                <div key={suggestion.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-slate-900">{suggestion.subject}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {suggestion.projectHint !== 'General' ? `Project hint: ${suggestion.projectHint}` : 'No strong project hint'}
                        {suggestion.latestActivityAt ? ` • Latest activity ${formatDateTime(suggestion.latestActivityAt)}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={suggestion.suggestedStatus === 'At risk' ? 'danger' : suggestion.suggestedStatus === 'Waiting on external' ? 'warn' : 'blue'}>{suggestion.suggestedStatus}</Badge>
                      <Badge variant={suggestion.suggestedPriority === 'High' || suggestion.suggestedPriority === 'Critical' ? 'danger' : 'neutral'}>{suggestion.suggestedPriority}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-slate-600">{suggestion.recommendation}</div>
                  <ul className="mt-2 list-disc pl-5 text-xs text-slate-500">
                    {suggestion.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button onClick={() => importOutlookMessage(suggestion.sourceMessageId)} className="primary-btn bg-slate-950 text-white border-slate-950 hover:bg-slate-800">
                      Import as follow-up
                    </button>
                    {suggestion.webLink ? <a href={suggestion.webLink} target="_blank" rel="noreferrer" className="action-btn no-underline"><ExternalLink className="h-4 w-4" /> Open thread</a> : null}
                  </div>
                </div>
              ))}
              {threadSuggestions.length === 0 ? <div className="text-sm text-slate-500">No thread suggestions yet. Run a sync after connecting a mailbox.</div> : null}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-slate-900">Recent synced messages</div>
                <div className="text-sm text-slate-500">Convert the important ones into follow-up records.</div>
              </div>
              {outlookConnection.mailboxLinked ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <Mail className="h-5 w-5 text-slate-500" />}
            </div>
            <div className="space-y-3">
              {outlookMessages.slice(0, 12).map((message) => (
                <div key={message.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="font-medium text-slate-900">{message.subject || '(no subject)'}</div>
                      <div className="text-xs text-slate-500">
                        {message.folder === 'sentitems' ? 'Sent' : 'Inbox'} • {message.from}
                      </div>
                      <div className="text-sm text-slate-600">{message.bodyPreview || 'No preview available.'}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={message.folder === 'sentitems' ? 'green' : 'blue'}>{message.folder === 'sentitems' ? 'Sent' : 'Inbox'}</Badge>
                      <Badge variant={message.importance === 'high' ? 'danger' : 'neutral'}>{message.importance}</Badge>
                      {!message.isRead ? <Badge variant="warn">Unread</Badge> : null}
                      {message.flagStatus === 'flagged' ? <Badge variant="warn">Flagged</Badge> : null}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      {message.receivedDateTime ? `Received ${formatDateTime(message.receivedDateTime)}` : message.sentDateTime ? `Sent ${formatDateTime(message.sentDateTime)}` : 'No timestamp'}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {message.webLink ? (
                        <a href={message.webLink} target="_blank" rel="noreferrer" className="action-btn no-underline">
                          <ExternalLink className="h-4 w-4" /> Open thread
                        </a>
                      ) : null}
                      <button onClick={() => importOutlookMessage(message.id)} className="primary-btn bg-slate-950 text-white border-slate-950 hover:bg-slate-800">
                        Import as follow-up
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {outlookMessages.length === 0 ? <div className="text-sm text-slate-500">No Outlook messages have been synced yet.</div> : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
