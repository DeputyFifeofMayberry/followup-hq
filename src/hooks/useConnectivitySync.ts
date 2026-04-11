import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

const MAX_AUTO_RETRIES = 3;

export function useConnectivitySync(enabled: boolean): void {
  const setConnectivityState = useAppStore((s) => s.setConnectivityState);
  const replayPendingPersistenceNow = useAppStore((s) => s.replayPendingPersistenceNow);
  const unresolvedOutboxCount = useAppStore((s) => s.unresolvedOutboxCount);
  const retryAttemptRef = useRef(0);
  const replayTimerRef = useRef<number | null>(null);
  const replayInFlightRef = useRef(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const replayPending = () => {
      if (unresolvedOutboxCount <= 0) {
        retryAttemptRef.current = 0;
        if (replayTimerRef.current) window.clearTimeout(replayTimerRef.current);
        replayTimerRef.current = null;
        return;
      }
      if (replayInFlightRef.current) return;
      if (replayTimerRef.current) window.clearTimeout(replayTimerRef.current);
      const nextAttempt = retryAttemptRef.current + 1;
      retryAttemptRef.current = nextAttempt;
      const delay = Math.min(3000, 500 * nextAttempt);
      replayTimerRef.current = window.setTimeout(() => {
        replayInFlightRef.current = true;
        void replayPendingPersistenceNow().finally(() => {
          replayInFlightRef.current = false;
        });
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
      if (replayTimerRef.current) window.clearTimeout(replayTimerRef.current);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [enabled, replayPendingPersistenceNow, setConnectivityState, unresolvedOutboxCount]);
}
