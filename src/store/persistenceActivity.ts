import { todayIso } from '../lib/utils';
import type { LoadFailureStage } from '../lib/persistence';
import type { PersistenceActivityEvent, PersistenceActivityKind } from './state/types';
import { formatPersistenceErrorMessage, normalizePersistenceError } from '../lib/persistenceError';

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

export function describeLoadFallbackFailure(stage?: LoadFailureStage, message?: string): { summary: string; detail: string } {
  const normalizedMessage = message
    ? formatPersistenceErrorMessage(normalizePersistenceError(message, { stage, operation: 'load' }))
    : undefined;

  const missingSchema = normalizedMessage?.includes('Missing table:') || normalizedMessage?.includes('PGRST205');

  if (missingSchema) {
    return {
      summary: 'Cloud persistence setup issue; local cache preserved.',
      detail: normalizedMessage
        ? `SetPoint loaded local cache because required cloud tables are missing. Detail: ${normalizedMessage}`
        : 'SetPoint loaded local cache because required cloud tables are missing.',
    };
  }

  if (stage === 'auth_session') {
    return {
      summary: 'Session lookup failed; local cache preserved.',
      detail: normalizedMessage ? `Session lookup failed. Detail: ${normalizedMessage}` : 'Session lookup failed; local cache preserved your latest data.',
    };
  }

  if (stage) {
    return {
      summary: `Cloud read failed during ${stage}; local cache preserved.`,
      detail: normalizedMessage ? `Cloud read failed during ${stage}. Detail: ${normalizedMessage}` : `Cloud read failed during ${stage}; local cache preserved your latest data.`,
    };
  }

  return {
    summary: 'Cloud read failed; local copy preserved.',
    detail: normalizedMessage ? `Cloud read failed. Detail: ${normalizedMessage}` : 'Cloud read failed; local cache preserved your latest data.',
  };
}
