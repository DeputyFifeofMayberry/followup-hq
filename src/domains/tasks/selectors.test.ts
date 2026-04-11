import { describe, expect, it } from 'vitest';
import { classifyTaskIntoLanes, normalizeTaskStatus } from './lanes';
import { selectOpenTaskCount, selectTaskCounts, selectVisibleTasksForQueue } from './selectors';
import type { TaskItem } from '../../types';

function task(overrides: Partial<TaskItem>): TaskItem {
  return {
    id: 'TSK-1',
    title: 'Task',
    project: 'Ops',
    owner: 'Ada',
    status: 'To do',
    priority: 'Medium',
    nextStep: 'Do work',
    summary: '',
    notes: '',
    tags: [],
    createdAt: '2026-04-10T00:00:00.000Z',
    updatedAt: '2026-04-10T00:00:00.000Z',
    ...overrides,
  };
}

describe('task selectors', () => {
  it('normalizes legacy task statuses into canonical queue statuses', () => {
    expect(normalizeTaskStatus('completed')).toBe('Done');
    expect(normalizeTaskStatus('In Progress')).toBe('In progress');
    expect(normalizeTaskStatus('on_hold')).toBe('Blocked');
    expect(normalizeTaskStatus('open')).toBe('To do');
  });

  it('counts open tasks consistently', () => {
    const tasks = [
      task({ id: 'a', status: 'To do' }),
      task({ id: 'b', status: 'In progress' }),
      task({ id: 'c', status: 'Done' }),
    ];
    expect(selectOpenTaskCount(tasks)).toBe(2);
  });

  it('keeps overdue tasks out of the now lane and in the overdue lane', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const overdue = task({ id: 'overdue', dueDate: '2026-04-09T12:00:00.000Z' });

    expect(classifyTaskIntoLanes(overdue, { now }).inLane.today).toBe(false);
    expect(classifyTaskIntoLanes(overdue, { now }).inLane.overdue).toBe(true);
  });

  it('keeps due-today execution-ready tasks in the now lane', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const dueToday = task({ id: 'today', dueDate: '2026-04-10T20:00:00.000Z' });

    expect(classifyTaskIntoLanes(dueToday, { now }).inLane.today).toBe(true);
  });

  it('places blocked tasks in blocked lane and excludes them from now', () => {
    const blocked = task({ id: 'blocked', status: 'Blocked' });
    const lane = classifyTaskIntoLanes(blocked);

    expect(lane.inLane.blocked).toBe(true);
    expect(lane.inLane.today).toBe(false);
  });

  it('places actively deferred tasks in deferred lane and excludes them from now', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const deferred = task({ id: 'deferred', deferredUntil: '2026-04-12T12:00:00.000Z' });
    const lane = classifyTaskIntoLanes(deferred, { now });

    expect(lane.inLane.deferred).toBe(true);
    expect(lane.inLane.today).toBe(false);
  });

  it('treats deferred-ready-to-reenter tasks as now candidates when otherwise ready', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const deferredReady = task({ id: 'reenter', deferredUntil: '2026-04-08T12:00:00.000Z' });
    const lane = classifyTaskIntoLanes(deferredReady, { now });

    expect(lane.isDeferredReadyToReenter).toBe(true);
    expect(lane.inLane.today).toBe(true);
    expect(lane.inLane.deferred).toBe(false);
  });

  it('routes review-needed tasks to review lane and out of now', () => {
    const reviewTask = task({ id: 'review' });
    const lane = classifyTaskIntoLanes(reviewTask, { isReviewNeeded: () => true });

    expect(lane.inLane.review).toBe(true);
    expect(lane.inLane.today).toBe(false);
  });

  it('routes unlinked open tasks to unlinked lane', () => {
    const unlinked = task({ id: 'unlinked', linkedFollowUpId: undefined });
    const linked = task({ id: 'linked', linkedFollowUpId: 'FUP-1' });

    expect(classifyTaskIntoLanes(unlinked).inLane.unlinked).toBe(true);
    expect(classifyTaskIntoLanes(linked).inLane.unlinked).toBe(false);
  });

  it('routes done-today tasks to recent lane only', () => {
    const now = new Date('2026-04-10T15:00:00.000Z');
    const doneToday = task({ id: 'done-today', status: 'Done', completedAt: '2026-04-10T08:00:00.000Z' });
    const lane = classifyTaskIntoLanes(doneToday, { now });

    expect(lane.inLane.recent).toBe(true);
    expect(lane.inLane.all).toBe(false);
    expect(lane.inLane.today).toBe(false);
  });

  it('derives queue counts from canonical lane membership', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const tasks = [
      task({ id: 'ready-undated' }),
      task({ id: 'overdue', dueDate: '2026-04-09T12:00:00.000Z' }),
      task({ id: 'blocked', status: 'Blocked' }),
      task({ id: 'deferred', deferredUntil: '2026-04-13T12:00:00.000Z' }),
      task({ id: 'review', dueDate: '2026-04-10T12:00:00.000Z' }),
      task({ id: 'done', status: 'Done', completedAt: '2026-04-10T10:00:00.000Z' }),
    ];

    const counts = selectTaskCounts(tasks, {
      now,
      isReviewNeeded: (entry) => entry.id === 'review',
      isExecutionReady: (entry) => entry.id !== 'review',
    });

    expect(counts.open).toBe(5);
    expect(counts.now).toBe(1);
    expect(counts.overdue).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.deferred).toBe(1);
    expect(counts.reviewRequired).toBe(1);
    expect(counts.reviewNotReady).toBe(1);
    expect(counts.doneToday).toBe(1);
  });

  it('keeps all open tasks visible in the all queue even with legacy status values', () => {
    const tasks = [
      task({ id: 'open-legacy', status: 'Open' as TaskItem['status'] }),
      task({ id: 'future', dueDate: '2026-04-12T12:00:00.000Z' }),
      task({ id: 'done-legacy', status: 'Completed' as TaskItem['status'] }),
    ];
    const visible = selectVisibleTasksForQueue(tasks, 'all');
    expect(visible.map((entry) => entry.id)).toEqual(['open-legacy', 'future']);
  });

  it('keeps now lane semantically strict: only due-today or undated execution-ready tasks', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const tasks = [
      task({ id: 'undated-ready' }),
      task({ id: 'today-ready', dueDate: '2026-04-10T16:00:00.000Z' }),
      task({ id: 'overdue', dueDate: '2026-04-09T16:00:00.000Z' }),
      task({ id: 'tomorrow', dueDate: '2026-04-11T16:00:00.000Z' }),
      task({ id: 'blocked', status: 'Blocked' }),
      task({ id: 'review' }),
      task({ id: 'deferred', deferredUntil: '2026-04-12T16:00:00.000Z' }),
    ];

    const visible = selectVisibleTasksForQueue(tasks, 'today', {
      now,
      isReviewNeeded: (entry) => entry.id === 'review',
      isExecutionReady: (entry) => entry.id !== 'review',
    });

    expect(visible.map((entry) => entry.id)).toEqual(['undated-ready', 'today-ready']);
  });
});
