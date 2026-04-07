import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Bell, BellOff, Clock3, PlayCircle, Send, ShieldAlert } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { formatDateTime } from '../lib/utils';

export function ReminderCenterControl() {
  const {
    reminderPreferences,
    reminderCenterSummary,
    pendingReminders,
    updateReminderPreferences,
    requestReminderPermission,
    runReminderEvaluation,
    testReminderNotification,
  } = useAppStore(useShallow((state) => ({
    reminderPreferences: state.reminderPreferences,
    reminderCenterSummary: state.reminderCenterSummary,
    pendingReminders: state.pendingReminders,
    updateReminderPreferences: state.updateReminderPreferences,
    requestReminderPermission: state.requestReminderPermission,
    runReminderEvaluation: state.runReminderEvaluation,
    testReminderNotification: state.testReminderNotification,
  })));
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const statusLabel = useMemo(() => {
    if (!reminderPreferences.enabled) return 'Reminders off';
    if (reminderCenterSummary.permissionState === 'denied') return 'Permission blocked';
    if (reminderPreferences.quietHoursEnabled) return 'Quiet hours active';
    return `Pending ${reminderCenterSummary.pendingCount}`;
  }, [reminderCenterSummary.pendingCount, reminderCenterSummary.permissionState, reminderPreferences.enabled, reminderPreferences.quietHoursEnabled]);

  return (
    <div className="sync-status-shell" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={`sync-status-trigger ${reminderPreferences.enabled ? 'sync-status-trigger-info' : 'sync-status-trigger-warn'}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        {reminderPreferences.enabled ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
        <span>{statusLabel}</span>
      </button>

      {open ? (
        <section className="sync-status-panel app-shell-card app-shell-card-inspector" role="dialog" aria-label="Reminder center details">
          <div className="sync-status-panel-title">Reminder center</div>
          <div className="sync-status-row">
            <span className="sync-status-row-label">Permission</span>
            <div className="sync-status-row-detail">State: {reminderCenterSummary.permissionState}</div>
            {reminderCenterSummary.permissionState !== 'granted' ? (
              <button type="button" className="action-btn" onClick={() => void requestReminderPermission()}>
                <ShieldAlert className="h-3.5 w-3.5" /> Request permission
              </button>
            ) : null}
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Scheduler</span>
            <div className="sync-status-row-detail">State: {reminderCenterSummary.schedulerState}</div>
            <div className="sync-status-row-detail">Last evaluated: {formatDateTime(reminderCenterSummary.lastEvaluatedAt)}</div>
            <div className="sync-status-row-detail">Next evaluation: {formatDateTime(reminderCenterSummary.nextPlannedEvaluationAt)}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Counts</span>
            <div className="sync-status-row-detail">Pending {reminderCenterSummary.pendingCount} · Overdue {reminderCenterSummary.overdueCount} · Due today {reminderCenterSummary.dueTodayCount} · Needs nudge {reminderCenterSummary.needsNudgeCount}</div>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Settings</span>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.enabled} onChange={(event) => updateReminderPreferences({ enabled: event.target.checked })} /> Enable reminders</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyFollowUpOverdue} onChange={(event) => updateReminderPreferences({ notifyFollowUpOverdue: event.target.checked })} /> Follow-up overdue</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyFollowUpDueToday} onChange={(event) => updateReminderPreferences({ notifyFollowUpDueToday: event.target.checked })} /> Follow-up due today</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyNeedsNudge} onChange={(event) => updateReminderPreferences({ notifyNeedsNudge: event.target.checked })} /> Needs nudge</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyTaskOverdue} onChange={(event) => updateReminderPreferences({ notifyTaskOverdue: event.target.checked })} /> Task overdue</label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.notifyTaskDueToday} onChange={(event) => updateReminderPreferences({ notifyTaskDueToday: event.target.checked })} /> Task due today</label>
            <label className="sync-status-row-detail">Interval minutes <input className="field-input" type="number" min={1} max={240} value={reminderPreferences.evaluationIntervalMinutes} onChange={(event) => updateReminderPreferences({ evaluationIntervalMinutes: Number(event.target.value) || 15 })} /></label>
            <label className="sync-status-row-detail">Due soon lead hours <input className="field-input" type="number" min={1} max={168} value={reminderPreferences.dueSoonLeadHours} onChange={(event) => updateReminderPreferences({ dueSoonLeadHours: Number(event.target.value) || 24 })} /></label>
            <label className="sync-status-row-detail"><input type="checkbox" checked={reminderPreferences.quietHoursEnabled} onChange={(event) => updateReminderPreferences({ quietHoursEnabled: event.target.checked })} /> Quiet hours</label>
            <div className="sync-status-actions">
              <label className="sync-status-row-detail">Start <input className="field-input" type="time" value={reminderPreferences.quietHoursStart} onChange={(event) => updateReminderPreferences({ quietHoursStart: event.target.value })} /></label>
              <label className="sync-status-row-detail">End <input className="field-input" type="time" value={reminderPreferences.quietHoursEnd} onChange={(event) => updateReminderPreferences({ quietHoursEnd: event.target.value })} /></label>
            </div>
          </div>

          <div className="sync-status-actions">
            <button type="button" className="action-btn" onClick={() => void runReminderEvaluation('manual')}><PlayCircle className="h-3.5 w-3.5" /> Run now</button>
            <button type="button" className="action-btn" onClick={() => void testReminderNotification()}><Send className="h-3.5 w-3.5" /> Send test</button>
          </div>

          <div className="sync-status-row">
            <span className="sync-status-row-label">Top pending</span>
            {pendingReminders.slice(0, 5).map((candidate) => (
              <div key={candidate.signature} className="sync-status-row-detail"><Clock3 className="h-3.5 w-3.5 inline mr-1" /> {candidate.title} — {candidate.reason}</div>
            ))}
            {pendingReminders.length === 0 ? <div className="sync-status-row-detail">No pending reminders.</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
