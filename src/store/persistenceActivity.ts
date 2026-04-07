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
  if (next.kind === 'failed') {
    const priorIndex = existing.findIndex((event) => event.kind === 'failed' && event.summary === next.summary && event.detail === next.detail);
    if (priorIndex >= 0) {
      const prior = existing[priorIndex];
      const pruned = existing.filter((event, index) => index !== priorIndex);
      return [{ ...next, id: prior.id }, ...pruned].slice(0, max);
    }
  }
  if (next.summary.startsWith('Cloud sync blocked by')) {
    const priorIndex = existing.findIndex((event) => event.summary === next.summary && event.detail === next.detail);
    if (priorIndex >= 0) {
      const prior = existing[priorIndex];
      const pruned = existing.filter((event, index) => index !== priorIndex);
      return [{ ...next, id: prior.id }, ...pruned].slice(0, max);
    }
  }
  return [next, ...existing].slice(0, max);
}

export function describeLoadFallbackFailure(
  stage?: LoadFailureStage,
  message?: string,
  backendFailureKind?: 'none' | 'schema-mismatch' | 'missing-rpc' | 'missing-hashing-dependency' | 'permissions' | 'auth' | 'unknown',
): { summary: string; detail: string } {
  const normalizedMessage = message
    ? formatPersistenceErrorMessage(normalizePersistenceError(message, { stage, operation: 'load' }))
    : undefined;

  if (backendFailureKind === 'schema-mismatch') {
    return {
      summary: 'Cloud sync blocked by schema mismatch.',
      detail: normalizedMessage
        ? `Changes are saved locally. Cloud sync is blocked until the Supabase schema is updated. Technical detail: ${normalizedMessage}`
        : 'Changes are saved locally. Cloud sync is blocked until the Supabase schema is updated.',
    };
  }

  if (backendFailureKind === 'missing-rpc') {
    return {
      summary: 'Cloud sync blocked by missing RPC.',
      detail: normalizedMessage
        ? `Changes are saved locally. Cloud sync is blocked because apply_save_batch is missing. Technical detail: ${normalizedMessage}`
        : 'Changes are saved locally. Cloud sync is blocked because apply_save_batch is missing.',
    };
  }

  if (backendFailureKind === 'missing-hashing-dependency') {
    return {
      summary: 'Cloud sync blocked by missing hashing support.',
      detail: normalizedMessage
        ? `Changes are saved locally. Cloud persistence backend is missing required hashing support (pgcrypto). Technical detail: ${normalizedMessage}`
        : 'Changes are saved locally. Cloud persistence backend is missing required hashing support (pgcrypto).',
    };
  }

  const missingSchema = normalizedMessage?.includes('Missing table:') || normalizedMessage?.includes('PGRST205');
  if (missingSchema) {
    return {
      summary: 'Opened using protected local data.',
      detail: normalizedMessage
        ? `Cloud data could not be confirmed because required tables are missing. Technical detail: ${normalizedMessage}`
        : 'Cloud data could not be confirmed because required tables are missing.',
    };
  }

  if (stage === 'auth_session') {
    return {
      summary: 'Opened using protected local data.',
      detail: normalizedMessage
        ? `Cloud data could not be confirmed during session check. Technical detail: ${normalizedMessage}`
        : 'Cloud data could not be confirmed during session check, so SetPoint opened your protected local copy.',
    };
  }

  if (stage) {
    return {
      summary: 'Opened using protected local data.',
      detail: normalizedMessage
        ? `Cloud data could not be confirmed during ${stage}. Technical detail: ${normalizedMessage}`
        : `Cloud data could not be confirmed during ${stage}, so SetPoint opened your protected local copy.`,
    };
  }

  return {
    summary: 'Opened using protected local data.',
    detail: normalizedMessage
      ? `Cloud data could not be confirmed. Technical detail: ${normalizedMessage}`
      : 'Cloud data could not be confirmed, so SetPoint opened your protected local copy.',
  };
}
