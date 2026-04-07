import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { AppToastCard, AppToastStack, AppToastViewport } from '../ui/AppPrimitives';
import { useAppStore } from '../../store/useAppStore';

export function AppToastHost() {
  const { toasts, pauseOnHover, dismissToast, expireToast, handleToastAction } = useAppStore(
    useShallow((state) => ({
      toasts: state.toasts,
      pauseOnHover: state.toastConfig.pauseOnHover,
      dismissToast: state.dismissToast,
      expireToast: state.expireToast,
      handleToastAction: state.handleToastAction,
    })),
  );
  const timersRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id));
    toasts.forEach((toast) => {
      if (timersRef.current.has(toast.id) || !toast.durationMs || toast.durationMs <= 0) return;
      const remaining = toast.expiresAt ? Math.max(0, new Date(toast.expiresAt).getTime() - Date.now()) : toast.durationMs;
      const timerId = window.setTimeout(() => {
        timersRef.current.delete(toast.id);
        expireToast(toast.id);
      }, remaining);
      timersRef.current.set(toast.id, timerId);
    });
    timersRef.current.forEach((timerId, id) => {
      if (activeIds.has(id)) return;
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    });
  }, [expireToast, toasts]);

  useEffect(() => () => {
    timersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    timersRef.current.clear();
  }, []);

  const controls = useMemo(() => ({
    pause: (id: string) => {
      if (!pauseOnHover) return;
      const timerId = timersRef.current.get(id);
      if (!timerId) return;
      window.clearTimeout(timerId);
      timersRef.current.delete(id);
    },
    resume: (id: string, durationMs?: number) => {
      if (!pauseOnHover || !durationMs || durationMs <= 0 || timersRef.current.has(id)) return;
      const timerId = window.setTimeout(() => {
        timersRef.current.delete(id);
        expireToast(id);
      }, Math.min(1600, durationMs));
      timersRef.current.set(id, timerId);
    },
  }), [expireToast, pauseOnHover]);

  if (!toasts.length) return null;

  return (
    <AppToastViewport>
      <AppToastStack>
        {toasts.map((toast) => (
          <AppToastCard
            key={toast.id}
            toast={toast}
            onDismiss={() => dismissToast(toast.id)}
            onAction={toast.action ? () => handleToastAction(toast.id) : undefined}
            onPause={() => controls.pause(toast.id)}
            onResume={() => controls.resume(toast.id, toast.durationMs)}
          />
        ))}
      </AppToastStack>
    </AppToastViewport>
  );
}
