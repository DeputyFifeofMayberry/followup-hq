import { describe, expect, it } from 'vitest';
import { deriveProjectSelection } from './useDirectoryViewModel';
import type { ProjectDerivedRecord } from '../../../lib/projectSelectors';

function row(id: string): ProjectDerivedRecord {
  return {
    project: {
      id,
      name: `Project ${id}`,
      status: 'Active',
      owner: 'Owner',
      notes: '',
      tags: [],
      archived: false,
      createdAt: '2026-04-01T00:00:00.000Z',
      updatedAt: '2026-04-01T00:00:00.000Z',
    },
    health: {
      score: 0,
      tier: 'Low',
      reasons: [],
      indicators: { blocked: false, overdue: false, stale: false, waitingHeavy: false, closeoutReady: false },
      breakdown: {
        openFollowUps: 0,
        overdueFollowUps: 0,
        needsNudge: 0,
        atRiskFollowUps: 0,
        waitingFollowUps: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        deferredTasks: 0,
        readyToCloseSignals: 0,
        docsNeedingReview: 0,
        staleIntakeDocs: 0,
        staleActivityDays: 0,
      },
    },
    openFollowUps: [],
    openTasks: [],
    intakeDocs: [],
    overdueFollowUpCount: 0,
    blockedTaskCount: 0,
    overdueTaskCount: 0,
    deferredTaskCount: 0,
    updatedAt: '2026-04-01T00:00:00.000Z',
    contacts: [],
    companies: [],
    reviewFollowUps: [],
    reviewTasks: [],
  } as ProjectDerivedRecord;
}

describe('useDirectoryViewModel helpers', () => {
  it('keeps selected project row anchored when hidden by filters', () => {
    const rows = [row('P1'), row('P2')];
    const visibleRows = [rows[0]];

    const selection = deriveProjectSelection(rows, visibleRows, 'P2');

    expect(selection.selectedRow?.project.id).toBe('P2');
    expect(selection.selectedVisible).toBe(false);
  });

  it('reports visible selection when selected project is in current workspace rows', () => {
    const rows = [row('P1'), row('P2')];
    const visibleRows = [rows[1]];

    const selection = deriveProjectSelection(rows, visibleRows, 'P2');

    expect(selection.selectedRow?.project.id).toBe('P2');
    expect(selection.selectedVisible).toBe(true);
  });
});
