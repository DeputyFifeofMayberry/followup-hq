import type { ReminderCandidate, ReminderPermissionState, ReminderPreferences } from '../../types';
import { detectBrowserNotificationSupport, detectTauriNotificationSupport, sendTauriNotification } from './platform';

export interface ReminderDeliveryResult {
  delivered: boolean;
  platform: 'tauri' | 'browser' | 'none';
  reason?: string;
}

export async function deliverReminderNotification(
  candidate: ReminderCandidate,
  prefs: ReminderPreferences,
  permissionState: ReminderPermissionState,
): Promise<ReminderDeliveryResult> {
  if (permissionState !== 'granted') {
    return { delivered: false, platform: 'none', reason: 'permission-not-granted' };
  }

  if (prefs.useDesktopNotifications && detectTauriNotificationSupport()) {
    const delivered = await sendTauriNotification(candidate.title, candidate.message);
    return delivered
      ? { delivered: true, platform: 'tauri' }
      : { delivered: false, platform: 'tauri', reason: 'delivery-failed' };
  }

  if (prefs.useBrowserNotifications && detectBrowserNotificationSupport()) {
    try {
      const notification = new Notification(candidate.title, {
        body: candidate.message,
        tag: candidate.signature,
      });
      notification.onclick = () => {
        if (typeof window !== 'undefined') {
          window.focus();
        }
      };
      return { delivered: true, platform: 'browser' };
    } catch {
      return { delivered: false, platform: 'browser', reason: 'delivery-failed' };
    }
  }

  return { delivered: false, platform: 'none', reason: 'unsupported-or-disabled' };
}
