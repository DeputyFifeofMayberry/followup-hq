import type { ExecutiveSnapshotReportResult, ReportingContext } from './contracts';

export function buildExecutiveSnapshotReport(context: ReportingContext): ExecutiveSnapshotReportResult {
  const pressurePreview = context.queue.slice(0, 8).map((row) => ({
    id: row.id,
    recordType: row.recordType,
    title: row.title,
    project: row.project,
    owner: row.owner,
    dueDate: row.dueDate,
    priority: row.priority,
    pressureReason: row.whyInQueue,
  }));

  return {
    header: {
      title: 'Executive snapshot',
      subtitle: 'Current execution pressure, risk posture, and closeout opportunity from live queue truth.',
      scope: context.scope,
      highlights: [
        { id: 'due', label: 'Due now', value: context.executionStats.due, helper: 'Needs same-day movement.', tone: 'danger' },
        { id: 'blocked', label: 'Blocked', value: context.executionStats.blocked, helper: 'Stalled work requiring intervention.', tone: 'warn' },
        { id: 'cleanup', label: 'Needs review / cleanup', value: context.executionStats.cleanup, helper: 'Records needing quality correction.', tone: 'info' },
        { id: 'close', label: 'Ready to close', value: context.executionStats.closeable, helper: 'Close opportunities in queue.', tone: 'default' },
        { id: 'open-followups', label: 'Open follow-ups', value: context.scope.openFollowUps, tone: 'default' },
        { id: 'open-tasks', label: 'Open tasks', value: context.scope.openTasks, tone: 'default' },
      ],
    },
    pressurePreview,
  };
}
