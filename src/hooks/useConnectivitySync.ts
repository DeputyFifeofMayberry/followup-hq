import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

const MAX_AUTO_RETRIES = 3;

export function useConnectivitySync(enabled: boolean): void {
  const setConnectivityState = useAppStore((s) => s.setConnectivityState);
  const retryPersistenceNow = useAppStore((s) => s.retryPersistenceNow);
  const unresolvedOutboxCount = useAppStore((s) => s.unresolvedOutboxCount);
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const replayPending = () => {
      if (unresolvedOutboxCount <= 0) {
        retryAttemptRef.current = 0;
        return;
      }
      const nextAttempt = retryAttemptRef.current + 1;
      retryAttemptRef.current = nextAttempt;
      const delay = Math.min(3000, 500 * nextAttempt);
      window.setTimeout(() => {
        void retryPersistenceNow();
      }, delay);
      if (nextAttempt >= MAX_AUTO_RETRIES) {
        retryAttemptRef.current = MAX_AUTO_RETRIES;
      }
    };

    const apply = (online: boolean) => {
      setConnectivityState(online ? 'online' : 'offline');
      if (online) replayPending();
    };

    apply(navigator.onLine);
    const onOnline = () => apply(true);
    const onOffline = () => apply(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [enabled, retryPersistenceNow, setConnectivityState, unresolvedOutboxCount]);
}
