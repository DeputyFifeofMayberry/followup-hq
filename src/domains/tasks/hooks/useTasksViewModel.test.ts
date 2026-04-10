import { describe, expect, it } from 'vitest';
import { resolveTaskOpenProjectFilter } from './useTasksViewModel';

describe('resolveTaskOpenProjectFilter', () => {
  it('keeps matching project context when it includes the selected task', () => {
    expect(resolveTaskOpenProjectFilter('North Tower', 'North Tower')).toBe('North Tower');
  });

  it('drops project context when it would hide the selected task', () => {
    expect(resolveTaskOpenProjectFilter('North Tower', 'South Campus')).toBe('All');
  });

  it('defaults to All when no usable project context is provided', () => {
    expect(resolveTaskOpenProjectFilter('North Tower', 'All')).toBe('All');
    expect(resolveTaskOpenProjectFilter('North Tower')).toBe('All');
    expect(resolveTaskOpenProjectFilter(undefined, 'North Tower')).toBe('All');
  });
});
