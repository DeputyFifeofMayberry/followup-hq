import type { UnifiedQueueItem } from '../../../types';

export interface ExecutionQueueStats {
  due: number;
  blocked: number;
  cleanup: number;
  closeable: number;
}

export interface ExecutionDailySection {
  key: 'now' | 'triage' | 'blocked' | 'ready_to_close';
  title: string;
  subtitle: string;
  rows: UnifiedQueueItem[];
}

export function buildExecutionQueueStats(queue: UnifiedQueueItem[]): ExecutionQueueStats {
  return {
    due: queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).length,
    blocked: queue.filter((row) => row.queueFlags.blocked || row.queueFlags.parentAtRisk).length,
    cleanup: queue.filter((row) => row.queueFlags.cleanupRequired).length,
    closeable: queue.filter((row) => row.queueFlags.readyToCloseParent).length,
  };
}

export function buildExecutionDailySections(queue: UnifiedQueueItem[]): ExecutionDailySection[] {
  return [
    {
      key: 'now',
      title: 'Now',
      subtitle: 'Immediate commitments and timing pressure.',
      rows: queue.filter((row) => row.queueFlags.overdue || row.queueFlags.dueToday || row.queueFlags.needsTouchToday).slice(0, 20),
    },
    {
      key: 'triage',
      title: 'Needs triage',
      subtitle: 'Requires routing, cleanup, or owner/next-step clarity.',
      rows: queue.filter((row) => row.queueFlags.cleanupRequired || row.queueFlags.waitingTooLong || row.queueFlags.orphanedTask).slice(0, 20),
    },
    {
      key: 'blocked',
      title: 'Blocked / waiting',
      subtitle: 'Stalled or dependent work that needs unblock decisions.',
      rows: queue.filter((row) => row.queueFlags.blocked || row.queueFlags.waiting).slice(0, 20),
    },
    {
      key: 'ready_to_close',
      title: 'Ready to close',
      subtitle: 'Completion opportunities to shrink open loops.',
      rows: queue.filter((row) => row.queueFlags.readyToCloseParent).slice(0, 20),
    },
  ];
}
