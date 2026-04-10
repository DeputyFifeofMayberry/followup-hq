import type { PersistedPayload } from '../lib/persistence';
import type { AppStore } from './types';
import { buildPersistedPayload } from './state/persistence';
import { buildCanonicalVerificationPayload } from '../lib/persistenceCanonicalization';

export interface VerificationTargetSelection {
  payload: PersistedPayload;
  source: 'cached-persisted-payload' | 'runtime-rebuild';
}

export function selectVerificationTargetPayload(params: {
  current: AppStore;
  cachedPersistedPayload: PersistedPayload | null;
}): VerificationTargetSelection {
  if (
    params.current.hasLocalUnsavedChanges
    || params.current.pendingBatchCount > 0
    || params.current.unresolvedOutboxCount > 0
    || !params.cachedPersistedPayload
  ) {
    return {
      payload: buildCanonicalVerificationPayload(buildPersistedPayload(params.current)),
      source: 'runtime-rebuild',
    };
  }
  return {
    payload: buildCanonicalVerificationPayload(params.cachedPersistedPayload),
    source: 'cached-persisted-payload',
  };
}
