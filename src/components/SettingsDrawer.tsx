import { Bell, BellOff, Cog, PlayCircle, Send, ShieldAlert, UserRound } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppMode, ReminderPermissionState } from '../types';
import { formatDateTime } from '../lib/utils';

interface SettingsDrawerProps {
  accountLabel: string;
  appMode: AppMode;
  onChangeAppMode: (mode: AppMode) => void;
  onSignOut: () => void;
  signOutInProgress: boolean;
  reminderPreferences: {
    enabled: boolean;
    evaluationIntervalMinutes: number;
    dueSoonLeadHours: number;
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    notifyFollowUpOverdue: boolean;
    notifyFollowUpDueToday: boolean;
    notifyNeedsNudge: boolean;
    notifyTaskOverdue: boolean;
    notifyTaskDueToday: boolean;
  };
  reminderCenterSummary: {
    permissionState: ReminderPermissionState;
    schedulerState: string;
    lastEvaluatedAt?: string;
    nextPlannedEvaluationAt?: string;
    pendingCount: number;
    overdueCount: number;
    dueTodayCount: number;
    needsNudgeCount: number;
  };
  pendingReminders: Array<{ signature: string; title: string; reason: string }>;
  updateReminderPreferences: (patch: Partial<SettingsDrawerProps['reminderPreferences']>) => void;
  requestReminderPermission: () => Promise<ReminderPermissionState>;
  runReminderEvaluation: (reason?: string) => Promise<void>;
  testReminderNotification: () => Promise<void>;
}

export function SettingsDrawer({
  accountLabel,
  appMode,
  onChangeAppMode,
  onSignOut,
  signOutInProgress,
  reminderPreferences,
  reminderCenterSummary,
  pendingReminders,
  updateReminderPreferences,
  requestReminderPermission,
  runReminderEvaluation,
  testReminderNotification,
}: SettingsDrawerProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const statusLabel = useMemo(() => {
    if (!reminderPreferences.enabled) return 'Reminders off';
    if (reminderCenterSummary.permissionState === 'denied') return 'Permission blocked';
    return `Pending ${reminderCenterSummary.pendingCount}`;
  }, [reminderCenterSummary.pendingCount, reminderCenterSummary.permissionState, reminderPreferences.enabled]);

  return (
    <div className="sync-status-shell" ref={panelRef}>
      <button type="button" className="sync-status-trigger" onClick={() => setOpen((value) => !value)} aria-haspopup="dialog" aria-expanded={open}>
        <Cog className="h-3.5 w-3.5" />
        <span>Settings</span>
      </button>
      {open ? (
        <section className="settings-drawer sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Workspace settings">
          <div className="sync-status-panel-title">Settings</div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Notifications</span>
            <div className="sync-status-row-detail">{statusLabel}</div>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.enabled} onChange={(event) => updateReminderPreferences({ enabled: event.target.checked })} /> Enable reminders</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyFollowUpOverdue} onChange={(event) => updateReminderPreferences({ notifyFollowUpOverdue: event.target.checked })} /> Follow-up overdue</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyFollowUpDueToday} onChange={(event) => updateReminderPreferences({ notifyFollowUpDueToday: event.target.checked })} /> Follow-up due today</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyNeedsNudge} onChange={(event) => updateReminderPreferences({ notifyNeedsNudge: event.target.checked })} /> Needs nudge</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyTaskOverdue} onChange={(event) => updateReminderPreferences({ notifyTaskOverdue: event.target.checked })} /> Task overdue</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyTaskDueToday} onChange={(event) => updateReminderPreferences({ notifyTaskDueToday: event.target.checked })} /> Task due today</label>
            <label className="sync-status-row-detail">Evaluation interval (min) <input className="field-input" type="number" min={1} max={240} value={reminderPreferences.evaluationIntervalMinutes} onChange={(event) => updateReminderPreferences({ evaluationIntervalMinutes: Number(event.target.value) || 15 })} /></label>
            <label className="sync-status-row-detail">Due-soon lead (hours) <input className="field-input" type="number" min={1} max={168} value={reminderPreferences.dueSoonLeadHours} onChange={(event) => updateReminderPreferences({ dueSoonLeadHours: Number(event.target.value) || 24 })} /></label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.quietHoursEnabled} onChange={(event) => updateReminderPreferences({ quietHoursEnabled: event.target.checked })} /> Quiet hours</label>
            <div className="sync-status-actions">
              <label className="sync-status-row-detail">Start <input className="field-input" type="time" value={reminderPreferences.quietHoursStart} onChange={(event) => updateReminderPreferences({ quietHoursStart: event.target.value })} /></label>
              <label className="sync-status-row-detail">End <input className="field-input" type="time" value={reminderPreferences.quietHoursEnd} onChange={(event) => updateReminderPreferences({ quietHoursEnd: event.target.value })} /></label>
            </div>
            <div className="sync-status-actions">
              {reminderPreferences.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {reminderCenterSummary.permissionState !== 'granted' ? <button type="button" className="action-btn" onClick={() => void requestReminderPermission()}><ShieldAlert className="h-3.5 w-3.5" /> Request permission</button> : null}
              <button type="button" className="action-btn" onClick={() => void runReminderEvaluation('manual')}><PlayCircle className="h-3.5 w-3.5" /> Run now</button>
              <button type="button" className="action-btn" onClick={() => void testReminderNotification()}><Send className="h-3.5 w-3.5" /> Send test</button>
            </div>
            <div className="sync-status-row-detail">Last evaluated: {formatDateTime(reminderCenterSummary.lastEvaluatedAt)} · Next: {formatDateTime(reminderCenterSummary.nextPlannedEvaluationAt)}</div>
            <div className="sync-status-row-detail">Pending {reminderCenterSummary.pendingCount} · Overdue {reminderCenterSummary.overdueCount} · Due today {reminderCenterSummary.dueTodayCount} · Needs nudge {reminderCenterSummary.needsNudgeCount}</div>
            {pendingReminders.slice(0, 3).map((candidate) => (
              <div key={candidate.signature} className="sync-status-row-detail">• {candidate.title} — {candidate.reason}</div>
            ))}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Workspace preferences</span>
            <label className="sync-status-row-detail"><input type="radio" name="app-mode" checked={appMode === 'personal'} onChange={() => onChangeAppMode('personal')} /> Personal mode</label>
            <label className="sync-status-row-detail"><input type="radio" name="app-mode" checked={appMode === 'team'} onChange={() => onChangeAppMode('team')} /> Team mode</label>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Account</span>
            <div className="sync-status-row-detail"><UserRound className="h-3.5 w-3.5 inline mr-1" /> {accountLabel}</div>
            <button type="button" className="action-btn" onClick={onSignOut} disabled={signOutInProgress}>{signOutInProgress ? 'Signing out…' : 'Sign out'}</button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
