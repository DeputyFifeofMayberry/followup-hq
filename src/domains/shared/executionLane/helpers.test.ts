import { describe, expect, it } from 'vitest';
import { getExecutionLaneNextSelection, resolveExecutionLaneSelection } from './helpers';

describe('execution lane selection helpers', () => {
  it('prefers targeted id when present in queue', () => {
    expect(resolveExecutionLaneSelection({ selectedId: 'a', targetedId: 'b', queueIds: ['b', 'c'] })).toBe('b');
  });

  it('keeps current selection when still present', () => {
    expect(getExecutionLaneNextSelection(['a', 'b'], 'a')).toEqual({ nextSelectedId: 'a', reason: 'kept_current' });
  });

  it('advances to next row when current item is removed', () => {
    expect(getExecutionLaneNextSelection(['b', 'c'], 'a', ['a'])).toEqual({ nextSelectedId: 'b', reason: 'advanced_next' });
  });

  it('falls back to previous row when removed item was at end', () => {
    expect(getExecutionLaneNextSelection(['a', 'b'], 'c', ['c'])).toEqual({ nextSelectedId: 'b', reason: 'fallback_previous' });
  });
});
