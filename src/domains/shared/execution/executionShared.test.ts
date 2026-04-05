import { describe, expect, it } from 'vitest';
import type { UnifiedQueueItem } from '../../../types';
import {
  buildExecutionLaneMetrics,
  executionIntentToHandoff,
  executionLaneRegistry,
  resolvePostActionSelection,
  selectExecutionLaneItems,
  toExecutionRecordSurface,
} from './index';

const baseRow: UnifiedQueueItem = {
  id: 'FU-1',
  recordType: 'followup',
  title: 'Follow up on RFI',
  project: 'North Tower',
  owner: 'Alex',
  assignee: 'Taylor',
  status: 'Needs action',
  priority: 'High',
  dueDate: '2026-04-06T00:00:00.000Z',
  nextTouchDate: '2026-04-06T00:00:00.000Z',
  needsCleanup: false,
  primaryNextAction: 'Send reminder',
  whyInQueue: 'Due tomorrow',
  queueReasons: ['Due tomorrow'],
  queueFlags: {
    overdue: false,
    dueToday: true,
    dueThisWeek: true,
    needsTouchToday: false,
    waitingTooLong: false,
    blocked: false,
    deferred: false,
    cleanupRequired: false,
    parentAtRisk: false,
    readyToCloseParent: false,
    orphanedTask: false,
    linked: false,
    waiting: false,
  },
  score: 90,
};

describe('shared execution domain', () => {
  it('maps queue items into shared execution record surface', () => {
    const surface = toExecutionRecordSurface(baseRow);
    expect(surface.id).toBe(baseRow.id);
    expect(surface.routeTarget.preferredLane).toBe('followups');
    expect(surface.nextMoveSummary).toBe('Send reminder');
  });

  it('builds shared lane metrics from lane items', () => {
    const items = selectExecutionLaneItems('followups', [baseRow]);
    const metrics = buildExecutionLaneMetrics(items, 'FU-1', {
      source: 'overview',
      targetLane: 'followups',
      targetRecordId: 'FU-1',
      routeKind: 'review',
      createdAt: new Date().toISOString(),
    });

    expect(metrics.visible).toBe(1);
    expect(metrics.dueNow).toBe(1);
    expect(metrics.selected).toBe(1);
    expect(metrics.routed).toBe(1);
  });

  it('converts execution intent to a shared handoff contract', () => {
    const handoff = executionIntentToHandoff({
      kind: 'open_record',
      source: 'projects',
      target: 'tasks',
      recordType: 'task',
      recordId: 'TS-1',
      intentLabel: 'review project tasks',
      createdAt: '2026-04-05T00:00:00.000Z',
    });

    expect(handoff?.targetLane).toBe('tasks');
    expect(handoff?.routeKind).toBe('review');
  });

  it('applies lane progression policy for defer actions', () => {
    const selected = resolvePostActionSelection(executionLaneRegistry.tasks, ['A', 'B'], 'A', { actionGroup: 'defer_snooze' });
    expect(selected).toBe('A');
  });
});
