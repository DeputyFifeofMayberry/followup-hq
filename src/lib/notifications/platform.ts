import { invoke } from '@tauri-apps/api/core';
import type { ReminderPermissionState } from '../../types';

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function detectBrowserNotificationSupport(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function detectTauriNotificationSupport(): boolean {
  return isTauriRuntime();
}

function getBrowserPermissionState(): ReminderPermissionState {
  if (!detectBrowserNotificationSupport()) return 'unsupported';
  return Notification.permission;
}

export async function getEffectivePermissionState(): Promise<ReminderPermissionState> {
  if (detectTauriNotificationSupport()) {
    try {
      const granted = await invoke<boolean>('plugin:notification|is_permission_granted');
      return granted ? 'granted' : 'default';
    } catch {
      return 'unsupported';
    }
  }
  return getBrowserPermissionState();
}

export async function requestNotificationPermissionForCurrentPlatform(): Promise<ReminderPermissionState> {
  if (detectTauriNotificationSupport()) {
    try {
      const granted = await invoke<boolean>('plugin:notification|is_permission_granted');
      if (granted) return 'granted';
      const permission = await invoke<'granted' | 'denied' | 'default'>('plugin:notification|request_permission');
      return permission === 'granted' ? 'granted' : 'denied';
    } catch {
      return 'unsupported';
    }
  }

  if (!detectBrowserNotificationSupport()) return 'unsupported';
  const permission = await Notification.requestPermission();
  return permission;
}

export async function sendTauriNotification(title: string, body: string): Promise<boolean> {
  if (!detectTauriNotificationSupport()) return false;
  try {
    await invoke('plugin:notification|show', {
      notification: {
        title,
        body,
      },
    });
    return true;
  } catch {
    return false;
  }
}
