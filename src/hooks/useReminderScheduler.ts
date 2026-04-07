import { useEffect, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppStore } from '../store/useAppStore';

const STORM_GUARD_MS = 1200;

export function useReminderScheduler(hydrated: boolean): void {
  const {
    runReminderEvaluation,
    deliverEligibleReminders,
    setReminderSchedulerState,
    setReminderNextEvaluationAt,
    evaluationIntervalMinutes,
  } = useAppStore(useShallow((state) => ({
    runReminderEvaluation: state.runReminderEvaluation,
    deliverEligibleReminders: state.deliverEligibleReminders,
    setReminderSchedulerState: state.setReminderSchedulerState,
    setReminderNextEvaluationAt: state.setReminderNextEvaluationAt,
    evaluationIntervalMinutes: state.reminderPreferences.evaluationIntervalMinutes,
  })));

  const timerRef = useRef<number | null>(null);
  const lastRunRef = useRef(0);

  useEffect(() => {
    if (!hydrated) return;

    const run = async () => {
      const now = Date.now();
      if (now - lastRunRef.current < STORM_GUARD_MS) return;
      lastRunRef.current = now;
      setReminderSchedulerState('running');
      await runReminderEvaluation('scheduler');
      const nowIso = new Date().toISOString();
      await deliverEligibleReminders(useAppStore.getState().pendingReminders, nowIso);
      setReminderSchedulerState('idle');
    };

    void run();

    const onFocus = () => { void run(); };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        void run();
      }
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    const intervalMs = Math.max(1, evaluationIntervalMinutes) * 60 * 1000;
    timerRef.current = window.setInterval(() => {
      setReminderNextEvaluationAt(new Date(Date.now() + intervalMs).toISOString());
      void run();
    }, intervalMs);
    setReminderNextEvaluationAt(new Date(Date.now() + intervalMs).toISOString());

    return () => {
      setReminderSchedulerState('paused');
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current);
      }
      timerRef.current = null;
    };
  }, [hydrated, runReminderEvaluation, deliverEligibleReminders, setReminderSchedulerState, setReminderNextEvaluationAt, evaluationIntervalMinutes]);
}
