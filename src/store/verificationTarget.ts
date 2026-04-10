import type { PersistedPayload } from '../lib/persistence';
import type { AppStore } from './types';
import { buildPersistedPayload } from './state/persistence';

export function selectVerificationTargetPayload(params: {
  current: AppStore;
  cachedPersistedPayload: PersistedPayload | null;
}): PersistedPayload {
  if (
    params.current.hasLocalUnsavedChanges
    || params.current.pendingBatchCount > 0
    || params.current.unresolvedOutboxCount > 0
    || !params.cachedPersistedPayload
  ) {
    return buildPersistedPayload(params.current);
  }
  return params.cachedPersistedPayload;
}
