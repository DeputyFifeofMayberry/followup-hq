import { describe, expect, it } from 'vitest';
import { TASK_INSPECTOR_QUICK_EDIT_FIELDS } from './TaskInspectorModal';

describe('TaskInspectorModal quick edit scope', () => {
  it('keeps quick edit limited to live execution fields', () => {
    expect(TASK_INSPECTOR_QUICK_EDIT_FIELDS).toEqual(['nextStep', 'dueDate', 'priority']);
  });

  it('does not include maintenance-heavy fields', () => {
    expect(TASK_INSPECTOR_QUICK_EDIT_FIELDS).not.toContain('status');
    expect(TASK_INSPECTOR_QUICK_EDIT_FIELDS).not.toContain('blockReason');
    expect(TASK_INSPECTOR_QUICK_EDIT_FIELDS).not.toContain('owner');
  });
});
