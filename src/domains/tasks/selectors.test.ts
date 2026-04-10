import { describe, expect, it } from 'vitest';
import { selectOpenTaskCount, selectTaskCounts } from './selectors';
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
  it('counts open tasks consistently', () => {
    const tasks = [
      task({ id: 'a', status: 'To do' }),
      task({ id: 'b', status: 'In progress' }),
      task({ id: 'c', status: 'Done' }),
    ];
    expect(selectOpenTaskCount(tasks)).toBe(2);
  });

  it('derives open-task summary buckets from one source list', () => {
    const now = new Date('2026-04-10T12:00:00.000Z');
    const tasks = [
      task({ id: 'open-overdue', dueDate: '2026-04-09T12:00:00.000Z' }),
      task({ id: 'blocked', status: 'Blocked' }),
      task({ id: 'deferred', deferredUntil: '2026-04-12T12:00:00.000Z' }),
      task({ id: 'done', status: 'Done' }),
    ];

    const counts = selectTaskCounts(tasks, { now });
    expect(counts.open).toBe(3);
    expect(counts.overdue).toBe(1);
    expect(counts.blocked).toBe(1);
    expect(counts.deferred).toBe(1);
  });
});
