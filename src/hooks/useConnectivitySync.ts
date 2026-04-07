import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useConnectivitySync(enabled: boolean): void {
  const setConnectivityState = useAppStore((s) => s.setConnectivityState);
  const retryPersistenceNow = useAppStore((s) => s.retryPersistenceNow);
  const unresolvedOutboxCount = useAppStore((s) => s.unresolvedOutboxCount);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const apply = (online: boolean) => {
      setConnectivityState(online ? 'online' : 'offline');
      if (online && unresolvedOutboxCount > 0) {
        void retryPersistenceNow();
      }
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
