const DEVICE_ID_STORAGE_KEY = 'followup_hq_device_id_v1';
const SESSION_ID_STORAGE_KEY = 'followup_hq_session_id_v1';
const PERSISTENCE_SCOPE_USER_ID_KEY = 'followup_hq_persistence_scope_user_id_v1';

function canUseStorage(storage: Storage | undefined): storage is Storage {
  return typeof storage !== 'undefined';
}

function generateIdentifier(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 12)}-${Date.now().toString(36)}`;
}

export function getStableDeviceId(): string {
  if (typeof window === 'undefined' || !canUseStorage(window.localStorage)) {
    return generateIdentifier('device');
  }

  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = generateIdentifier('device');
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, created);
  return created;
}

export function getSessionScopedId(): string {
  if (typeof window === 'undefined' || !canUseStorage(window.sessionStorage)) {
    return generateIdentifier('session');
  }

  const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
  if (existing) return existing;

  const created = generateIdentifier('session');
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, created);
  return created;
}

export function resetSessionScopedId(): string {
  if (typeof window === 'undefined' || !canUseStorage(window.sessionStorage)) {
    return generateIdentifier('session');
  }

  const created = generateIdentifier('session');
  window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, created);
  return created;
}

export function setPersistenceScopeUserId(userId: string | null): void {
  if (typeof window === 'undefined' || !canUseStorage(window.sessionStorage)) return;
  if (!userId) {
    window.sessionStorage.removeItem(PERSISTENCE_SCOPE_USER_ID_KEY);
    return;
  }
  window.sessionStorage.setItem(PERSISTENCE_SCOPE_USER_ID_KEY, userId);
}

export function getPersistenceScopeUserId(): string | null {
  if (typeof window === 'undefined' || !canUseStorage(window.sessionStorage)) return null;
  return window.sessionStorage.getItem(PERSISTENCE_SCOPE_USER_ID_KEY);
}
