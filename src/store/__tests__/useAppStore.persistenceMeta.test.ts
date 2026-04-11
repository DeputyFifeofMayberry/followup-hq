import { resolvePostSaveMetaState } from '../persistenceMeta';
import { deriveVerificationMetaFromResult } from '../verificationState';
import { selectVerificationTargetPayload } from '../verificationTarget';
import { initialBusinessState, initialMetaState, initialUiState } from '../state/initialState';
import { buildPersistedPayload } from '../state/persistence';
import { verifyPersistedState, stableHashRecord } from '../../lib/persistenceVerification';
import { canonicalizeEntityRecordForVerification } from '../../lib/persistenceCanonicalization';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testNoOpSavePreservesConservativeTrust(): void {
  const state = resolvePostSaveMetaState({
    persistenceMode: 'supabase',
    syncState: 'error',
    cloudSyncStatus: 'cloud-save-failed-local-preserved',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T10:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T10:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:05:00.000Z',
    lastFallbackRestoreAt: undefined,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-save-failed',
    sessionDegradedAt: '2026-04-05T10:06:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: '2026-04-05T10:05:00.000Z',
    lastSuccessfulCloudPersistAt: '2026-04-05T10:00:00.000Z',
    lastConfirmedBatchId: undefined,
    lastConfirmedBatchCommittedAt: undefined,
    lastReceiptStatus: undefined,
    lastReceiptHashMatch: undefined,
    lastReceiptSchemaVersion: undefined,
    lastReceiptTouchedTables: undefined,
    lastReceiptOperationCount: undefined,
    lastReceiptOperationCountsByEntity: undefined,
    lastFailedBatchId: undefined,
    saveProof: {
      latestLocalSaveAttemptAt: '2026-04-05T10:05:00.000Z',
      latestDurableLocalWriteAt: '2026-04-05T10:05:00.000Z',
      latestCloudConfirmedCommitAt: '2026-04-05T10:00:00.000Z',
      latestConfirmedBatchId: undefined,
      latestReceiptStatus: undefined,
      latestReceiptHashMatch: undefined,
      latestReceiptSchemaVersion: undefined,
      latestReceiptTouchedTables: undefined,
      latestReceiptOperationCount: undefined,
      latestReceiptOperationCountsByEntity: undefined,
      latestFailedBatchId: undefined,
      latestFailureMessage: undefined,
      latestFailureClass: undefined,
      cloudProofState: 'degraded',
    },
  }, 'supabase', '2026-04-05T11:00:00.000Z', false);

  assert(state.cloudSyncStatus === 'cloud-save-failed-local-preserved', 'no-op save should not promote trust status');
  assert(state.lastCloudConfirmedAt === '2026-04-05T10:00:00.000Z', 'no-op save should not refresh cloud confirmation timestamp');
  assert(state.lastLocalWriteAt === '2026-04-05T10:05:00.000Z', 'no-op save should not refresh local write timestamp');
  assert(state.saveProof.cloudProofState === 'degraded', 'no-op save should preserve degraded proof classification');
}

function testPersistedSupabaseSavePromotesTrust(): void {
  const state = resolvePostSaveMetaState({
    persistenceMode: 'supabase',
    syncState: 'dirty',
    cloudSyncStatus: 'pending-cloud',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: undefined,
    lastCloudConfirmedAt: undefined,
    lastLocalWriteAt: undefined,
    lastFallbackRestoreAt: undefined,
    sessionTrustState: 'degraded',
    sessionDegraded: true,
    sessionDegradedReason: 'cloud-read-failed-fallback',
    sessionDegradedAt: '2026-04-05T10:58:00.000Z',
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: undefined,
    lastSuccessfulCloudPersistAt: undefined,
    lastConfirmedBatchId: undefined,
    lastConfirmedBatchCommittedAt: undefined,
    lastReceiptStatus: undefined,
    lastReceiptHashMatch: undefined,
    lastReceiptSchemaVersion: undefined,
    lastReceiptTouchedTables: undefined,
    lastReceiptOperationCount: undefined,
    lastReceiptOperationCountsByEntity: undefined,
    lastFailedBatchId: undefined,
    saveProof: {
      latestLocalSaveAttemptAt: undefined,
      latestDurableLocalWriteAt: undefined,
      latestCloudConfirmedCommitAt: undefined,
      latestConfirmedBatchId: undefined,
      latestReceiptStatus: undefined,
      latestReceiptHashMatch: undefined,
      latestReceiptSchemaVersion: undefined,
      latestReceiptTouchedTables: undefined,
      latestReceiptOperationCount: undefined,
      latestReceiptOperationCountsByEntity: undefined,
      latestFailedBatchId: undefined,
      latestFailureMessage: undefined,
      latestFailureClass: undefined,
      cloudProofState: 'pending',
    },
  }, 'supabase', '2026-04-05T11:00:00.000Z', true, {
    attemptedAt: '2026-04-05T11:00:00.000Z',
    completedTables: [],
    staleDeleteWarnings: [],
    receiptStatus: 'committed',
    batchId: 'batch-xyz',
    committedAt: '2026-04-05T11:00:00.000Z',
  });

  assert(state.cloudSyncStatus === 'cloud-confirmed', 'persisted save should promote to cloud confirmed');
  assert(state.lastCloudConfirmedAt === '2026-04-05T11:00:00.000Z', 'persisted save should update cloud confirmed timestamp');
  assert(state.sessionDegraded === false, 'confirmed cloud save should clear degraded session state');
  assert(state.sessionTrustState === 'recovered', 'confirmed cloud save should mark recovered session trust state');
  assert(state.saveProof.cloudProofState === 'confirmed', 'persisted save should mark canonical save proof as confirmed');
}

function testSupabasePersistWithoutCommittedReceiptStaysPendingCloud(): void {
  const state = resolvePostSaveMetaState({
    persistenceMode: 'supabase',
    syncState: 'dirty',
    cloudSyncStatus: 'pending-cloud',
    loadedFromLocalRecoveryCache: false,
    lastSyncedAt: '2026-04-05T10:00:00.000Z',
    lastCloudConfirmedAt: '2026-04-05T10:00:00.000Z',
    lastLocalWriteAt: '2026-04-05T10:00:00.000Z',
    lastFallbackRestoreAt: undefined,
    sessionTrustState: 'healthy',
    sessionDegraded: false,
    sessionDegradedReason: 'none',
    sessionDegradedAt: undefined,
    sessionDegradedClearedByCloudSave: false,
    sessionTrustRecoveredAt: undefined,
    lastSuccessfulPersistAt: undefined,
    lastSuccessfulCloudPersistAt: '2026-04-05T10:00:00.000Z',
    lastConfirmedBatchId: undefined,
    lastConfirmedBatchCommittedAt: undefined,
    lastReceiptStatus: undefined,
    lastReceiptHashMatch: undefined,
    lastReceiptSchemaVersion: undefined,
    lastReceiptTouchedTables: undefined,
    lastReceiptOperationCount: undefined,
    lastReceiptOperationCountsByEntity: undefined,
    lastFailedBatchId: undefined,
    saveProof: {
      latestLocalSaveAttemptAt: '2026-04-05T10:00:00.000Z',
      latestDurableLocalWriteAt: '2026-04-05T10:00:00.000Z',
      latestCloudConfirmedCommitAt: '2026-04-05T10:00:00.000Z',
      latestConfirmedBatchId: undefined,
      latestReceiptStatus: undefined,
      latestReceiptHashMatch: undefined,
      latestReceiptSchemaVersion: undefined,
      latestReceiptTouchedTables: undefined,
      latestReceiptOperationCount: undefined,
      latestReceiptOperationCountsByEntity: undefined,
      latestFailedBatchId: undefined,
      latestFailureMessage: undefined,
      latestFailureClass: undefined,
      cloudProofState: 'confirmed',
    },
  }, 'supabase', '2026-04-05T11:00:00.000Z', true, {
    attemptedAt: '2026-04-05T11:00:00.000Z',
    completedTables: [],
    staleDeleteWarnings: [],
    receiptStatus: 'received',
  });

  assert(state.cloudSyncStatus === 'pending-cloud', 'uncommitted receipt should remain pending-cloud');
  assert(state.lastCloudConfirmedAt === '2026-04-05T10:00:00.000Z', 'uncommitted receipt should not update cloud confirmation timestamp');
  assert(state.lastConfirmedBatchId === undefined, 'uncommitted receipt should not synthesize confirmed batch id');
  assert(state.saveProof.cloudProofState === 'pending', 'uncommitted receipt should keep canonical save proof pending');
}

function testVerifyNowProjectionStates(): void {
  const readFailed = deriveVerificationMetaFromResult({
    summary: {
      verified: false,
      cloudReadSucceeded: false,
      verificationReadFailed: true,
      verificationReadFailureMessage: 'Auth session lookup failed during verification read: network',
      mismatchCount: 0,
    },
    mismatches: [],
  } as any);
  assert(readFailed.verificationState === 'read-failed', 'verification read failure should map to read-failed state');
  assert(readFailed.recoveryReviewNeeded === false, 'verification read failure should not open recovery review queue');

  const mismatch = deriveVerificationMetaFromResult({
    summary: {
      verified: false,
      cloudReadSucceeded: true,
      mismatchCount: 2,
    },
    mismatches: [],
  } as any);
  assert(mismatch.verificationState === 'mismatch-found', 'real divergence should map to mismatch-found');
  assert(mismatch.recoveryReviewNeeded === true, 'real divergence should require recovery review');

  const matched = deriveVerificationMetaFromResult({
    summary: {
      verified: true,
      cloudReadSucceeded: true,
      mismatchCount: 0,
    },
    mismatches: [],
  } as any);
  assert(matched.verificationState === 'verified-match', 'verified comparison should map to verified-match');
  assert(matched.recoveryReviewNeeded === false, 'verified comparison should clear recovery review queue');

  const timestampOnlyDrift = deriveVerificationMetaFromResult({
    summary: {
      verified: true,
      cloudReadSucceeded: true,
      mismatchCount: 0,
      timestampDriftCount: 2,
    },
    mismatches: [
      { category: 'newer_locally' },
      { category: 'newer_in_cloud' },
    ],
  } as any);
  assert(timestampOnlyDrift.verificationState === 'verified-match', 'timestamp-only drift should still map to verified-match');
  assert(timestampOnlyDrift.recoveryReviewNeeded === false, 'timestamp-only drift should not require recovery review');
}

function buildStoreLikeForVerificationTarget(overrides: Record<string, unknown> = {}): any {
  return {
    ...initialBusinessState,
    ...initialUiState,
    ...initialMetaState,
    ...overrides,
  };
}

function testVerifyNowUsesCachedPersistedPayloadWhenStateIsClean(): void {
  const current = buildStoreLikeForVerificationTarget({
    hasLocalUnsavedChanges: false,
    pendingBatchCount: 0,
    unresolvedOutboxCount: 0,
    tasks: [{ id: 'task-1', title: 'Runtime normalized', updatedAt: '2026-04-10T10:00:00.000Z' }],
  });
  const cached = buildPersistedPayload(buildStoreLikeForVerificationTarget({
    tasks: [{ id: 'task-1', title: 'Persisted raw', updatedAt: '2026-04-09T10:00:00.000Z' }],
  }));
  const selected = selectVerificationTargetPayload({ current, cachedPersistedPayload: cached });
  assert(selected.payload.tasks[0]?.title === 'Persisted raw', 'clean verify runs should compare against canonical cached persisted payload');
  assert(selected.source === 'cached-persisted-payload', 'clean verify runs should report canonical cache as verification source');
}

function testVerifyNowFallsBackToLiveStateWhenUnsavedChangesExist(): void {
  const current = buildStoreLikeForVerificationTarget({
    hasLocalUnsavedChanges: true,
    pendingBatchCount: 0,
    unresolvedOutboxCount: 0,
    tasks: [{ id: 'task-1', title: 'Unsaved edit', updatedAt: '2026-04-10T10:00:00.000Z' }],
  });
  const cached = buildPersistedPayload(buildStoreLikeForVerificationTarget({
    tasks: [{ id: 'task-1', title: 'Persisted raw', updatedAt: '2026-04-09T10:00:00.000Z' }],
  }));
  const selected = selectVerificationTargetPayload({ current, cachedPersistedPayload: cached });
  assert(selected.payload.tasks[0]?.title === 'Unsaved edit', 'verify should include live state only when unsaved/local outbox drift exists');
  assert(selected.source === 'runtime-rebuild', 'dirty verify runs should report runtime rebuild source');
}

async function testCleanStartupVerifyNowResultsInVerifiedMatch(): Promise<void> {
  const clean = buildStoreLikeForVerificationTarget({
    hasLocalUnsavedChanges: false,
    pendingBatchCount: 0,
    unresolvedOutboxCount: 0,
    localRevision: 6,
    lastCloudConfirmedRevision: 6,
    items: [{ id: 'item-1', title: 'Parity', status: 'Needs action', updatedAt: '2026-04-10T10:00:00.000Z', recordVersion: 2 }],
    projects: [{ id: 'proj-1', name: 'Parity Project', owner: 'Owner', status: 'Active', notes: '', tags: [], createdAt: '2026-04-10T10:00:00.000Z', updatedAt: '2026-04-10T10:00:00.000Z', recordVersion: 2 }],
    contacts: [{ id: 'contact-1', name: 'Parity Contact', role: '', notes: '', tags: [], updatedAt: '2026-04-10T10:00:00.000Z', recordVersion: 2 }],
  });
  const cached = buildPersistedPayload(clean);
  const target = selectVerificationTargetPayload({ current: clean, cachedPersistedPayload: cached });
  const cloudSnapshot = {
    fetchedAt: '2026-04-10T10:00:00.000Z',
    schemaVersionCloud: undefined,
    readSucceeded: true,
    entities: {
      items: new Map([['item-1', { id: 'item-1', digest: stableHashRecord(canonicalizeEntityRecordForVerification('items', { id: 'item-1', title: 'Parity', status: 'Needs action', updatedAt: '2026-04-10T10:00:00.000Z' } as any)), normalizedRecord: canonicalizeEntityRecordForVerification('items', { id: 'item-1', title: 'Parity', status: 'Needs action', updatedAt: '2026-04-10T10:00:00.000Z' } as any), canonicalStrippedPaths: [], canonicalDefaultedPaths: [] }]]),
      tasks: new Map(),
      projects: new Map([['proj-1', { id: 'proj-1', digest: stableHashRecord(canonicalizeEntityRecordForVerification('projects', { id: 'proj-1', name: 'Parity Project', owner: 'Owner', status: 'Active', notes: '', tags: [], createdAt: '2026-04-10T10:00:00.000Z', updatedAt: '2026-04-10T10:00:00.000Z' } as any)), normalizedRecord: canonicalizeEntityRecordForVerification('projects', { id: 'proj-1', name: 'Parity Project', owner: 'Owner', status: 'Active', notes: '', tags: [], createdAt: '2026-04-10T10:00:00.000Z', updatedAt: '2026-04-10T10:00:00.000Z' } as any), canonicalStrippedPaths: [], canonicalDefaultedPaths: [] }]]),
      contacts: new Map([['contact-1', { id: 'contact-1', digest: stableHashRecord(canonicalizeEntityRecordForVerification('contacts', { id: 'contact-1', name: 'Parity Contact', notes: '', tags: [], updatedAt: '2026-04-10T10:00:00.000Z' } as any)), normalizedRecord: canonicalizeEntityRecordForVerification('contacts', { id: 'contact-1', name: 'Parity Contact', notes: '', tags: [], updatedAt: '2026-04-10T10:00:00.000Z' } as any), canonicalStrippedPaths: [], canonicalDefaultedPaths: [] }]]),
      companies: new Map(),
    },
    auxiliary: cached.auxiliary,
  } as any;
  const result = await verifyPersistedState({
    target: { payload: target.payload, localPayloadSource: target.source, schemaVersionClient: 1 },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloudSnapshot,
  });
  assert(result.summary.verified === true, 'clean startup verify now should resolve to verified-match semantics');
  assert(result.summary.mismatchCount === 0, 'clean startup verify now should not report content mismatches');
}

(async function run() {
  testNoOpSavePreservesConservativeTrust();
  testPersistedSupabaseSavePromotesTrust();
  testSupabasePersistWithoutCommittedReceiptStaysPendingCloud();
  testVerifyNowProjectionStates();
  testVerifyNowUsesCachedPersistedPayloadWhenStateIsClean();
  testVerifyNowFallsBackToLiveStateWhenUnsavedChangesExist();
  await testCleanStartupVerifyNowResultsInVerifiedMatch();
})();
