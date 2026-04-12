export const brand = {
  appName: 'SetPoint',
  shellTitle: 'SetPoint',
  shellSubline: 'Daily operations',
  shellDescriptor: 'Daily construction workflow',
  auth: {
    title: 'Sign in',
    descriptor: 'Enter your daily operations workspace to triage work, track commitments, and finish execution.',
    secureSignInLabel: 'Secure sign-in',
    signInAction: 'Sign in to SetPoint',
    signingInAction: 'Signing in...',
  },
  session: {
    loadingTitle: 'Loading session',
    loadingMessage: 'Checking your SetPoint session and workspace context...',
  },
  supabaseSetup: {
    title: 'Supabase setup needed',
    message: 'SetPoint needs valid Supabase environment variables before the app can load.',
  },
  signOut: {
    pendingChangesMessage: 'You have pending local changes or recovery items. Choose how SetPoint should handle this account before signing out.',
  },
  runtimeError: {
    title: 'SetPoint hit a runtime error',
  },
  storage: {
    keyPrefix: 'setpoint',
    legacyKeyPrefix: 'followup-hq',
  },
} as const;

function canUseLocalStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function buildBrandStorageKey(suffix: string): string {
  return `${brand.storage.keyPrefix}:${suffix}`;
}

export function buildLegacyBrandStorageKey(suffix: string): string {
  return `${brand.storage.legacyKeyPrefix}:${suffix}`;
}

export function readBrandStorageValue(suffix: string): string | null {
  if (!canUseLocalStorage()) return null;
  const nextKey = buildBrandStorageKey(suffix);
  const current = window.localStorage.getItem(nextKey);
  if (current !== null) return current;

  const legacyKey = buildLegacyBrandStorageKey(suffix);
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy === null) return null;

  window.localStorage.setItem(nextKey, legacy);
  window.localStorage.removeItem(legacyKey);
  return legacy;
}

export function writeBrandStorageValue(suffix: string, value: string): void {
  if (!canUseLocalStorage()) return;
  const nextKey = buildBrandStorageKey(suffix);
  window.localStorage.setItem(nextKey, value);
  window.localStorage.removeItem(buildLegacyBrandStorageKey(suffix));
}
