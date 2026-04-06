/// <reference types="vite/client" />

export const E2E_MODE_STORAGE_KEY = 'setpoint:e2e-mode';

export function isE2EMode(): boolean {
  const envFlag = typeof import.meta !== 'undefined'
    && (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_E2E_MODE === '1';
  if (envFlag) return true;

  if (typeof window !== 'undefined') {
    if ((window as typeof window & { __SETPOINT_E2E__?: boolean }).__SETPOINT_E2E__ === true) {
      return true;
    }
    return window.localStorage.getItem(E2E_MODE_STORAGE_KEY) === '1';
  }

  return false;
}
