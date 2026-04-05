import { todayIso } from '../lib/utils';
import type { PersistenceActivityEvent, PersistenceActivityKind } from './state/types';

const MAX_ACTIVITY = 8;

function eventId() {
  return `persist-${Math.random().toString(36).slice(2, 10)}`;
}

export function createPersistenceActivityEvent(input: {
  kind: PersistenceActivityKind;
  summary: string;
  detail?: string;
  at?: string;
}): PersistenceActivityEvent {
  return {
    id: eventId(),
    at: input.at ?? todayIso(),
    kind: input.kind,
    summary: input.summary,
    detail: input.detail,
  };
}

export function appendPersistenceActivity(
  existing: PersistenceActivityEvent[],
  next: PersistenceActivityEvent,
  max = MAX_ACTIVITY,
): PersistenceActivityEvent[] {
  const recent = existing[0];
  const duplicate = recent && recent.kind === next.kind && recent.summary === next.summary && recent.detail === next.detail;
  if (duplicate) {
    return [{ ...next, id: recent.id }, ...existing.slice(1)].slice(0, max);
  }
  return [next, ...existing].slice(0, max);
}
