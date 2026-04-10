import {
  buildVerificationSummary,
  classifyReadFailureKind,
  compareEntityCollections,
  exportVerificationIncident,
  resolveVerificationSessionUserIdWithRetry,
  stableHashRecord,
  verifyPersistedState,
  type VerificationSourceSnapshot,
} from '../persistenceVerification';
import type { PersistedPayload } from '../persistence';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function payload(): PersistedPayload {
  return {
    items: [{ id: 'i1', title: 'Item', status: 'Needs action', updatedAt: '2026-04-06T10:00:00.000Z' } as any],
    tasks: [{ id: 't1', title: 'Task', status: 'Todo', updatedAt: '2026-04-06T10:00:00.000Z' } as any],
    projects: [{ id: 'p1', name: 'Proj', updatedAt: '2026-04-06T10:00:00.000Z' } as any],
    contacts: [{ id: 'c1', name: 'Contact', updatedAt: '2026-04-06T10:00:00.000Z' } as any],
    companies: [{ id: 'co1', name: 'Company', updatedAt: '2026-04-06T10:00:00.000Z' } as any],
    auxiliary: { intakeSignals: [], intakeDocuments: [], dismissedDuplicatePairs: [], droppedEmailImports: [], outlookConnection: { settings: {}, mailboxLinked: false, syncStatus: 'idle', syncCursorByFolder: { inbox: {}, sentitems: {} } }, outlookMessages: [], forwardedEmails: [], forwardedRules: [], forwardedCandidates: [], forwardedLedger: [], forwardedRoutingAudit: [], intakeCandidates: [], intakeAssets: [], intakeBatches: [], intakeWorkCandidates: [], intakeReviewerFeedback: [], savedExecutionViews: [] } as any,
  };
}

function cloudSnapshotFromPayload(local: PersistedPayload): VerificationSourceSnapshot {
  const mapFrom = (records: any[]) => new Map(records.map((record) => [record.id, { id: record.id, updatedAt: record.updatedAt, deletedAt: null, digest: stableHashRecord(record), normalizedRecord: record }]));
  return {
    fetchedAt: '2026-04-06T10:00:00.000Z',
    schemaVersionCloud: undefined,
    readSucceeded: true,
    entities: {
      items: mapFrom(local.items),
      tasks: mapFrom(local.tasks),
      projects: mapFrom(local.projects),
      contacts: mapFrom(local.contacts),
      companies: mapFrom(local.companies),
    },
    auxiliary: local.auxiliary,
  };
}

async function testVerificationSuccess(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  const result = await verifyPersistedState({
    target: { payload: local, schemaVersionClient: 1 },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloud,
  });
  assert(result.summary.verified === true, 'matching snapshots should verify');
  assert(result.summary.mismatchCount === 0, 'matching snapshots should have zero mismatches');
  assert(result.summary.schemaVersionCloud === undefined, 'cloud schema version should be optional');
}

async function testRuntimeEnrichedFollowUpsDoNotCauseFalseMismatch(): Promise<void> {
  const local = payload();
  local.items = [{
    ...local.items[0],
    linkedTaskCount: 3,
    openLinkedTaskCount: 2,
    blockedLinkedTaskCount: 1,
    overdueLinkedTaskCount: 1,
    doneLinkedTaskCount: 1,
    allLinkedTasksDone: false,
    childWorkflowSignal: 'at_risk',
  } as any];
  const cloud = cloudSnapshotFromPayload(payload());
  const result = await verifyPersistedState({
    target: { payload: local },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloud,
  });
  assert(result.summary.verified === true, 'runtime-enriched follow-up rollup fields should be excluded from canonical verification');
}

async function testMissingCloudRecord(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  cloud.entities.items.delete('i1');
  const result = await verifyPersistedState({ target: { payload: local }, context: { mode: 'manual' }, cloudSnapshotReader: async () => cloud });
  assert(result.mismatches.some((m) => m.category === 'missing_in_cloud' && m.entity === 'items'), 'missing cloud record should be categorized');
}

async function testMissingLocalRecord(): Promise<void> {
  const local = payload();
  local.tasks = [];
  const cloud = cloudSnapshotFromPayload(payload());
  const result = await verifyPersistedState({ target: { payload: local }, context: { mode: 'manual' }, cloudSnapshotReader: async () => cloud });
  assert(result.mismatches.some((m) => m.category === 'deleted_locally_but_active_in_cloud' && m.entity === 'tasks'), 'missing local record should be categorized');
}

async function testContentMismatchAndTombstoneMismatch(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  cloud.entities.projects.set('p1', { ...cloud.entities.projects.get('p1')!, normalizedRecord: { id: 'p1', name: 'Changed' }, digest: 'changed-digest' });
  cloud.entities.contacts.set('c1', { ...cloud.entities.contacts.get('c1')!, deletedAt: '2026-04-06T09:59:00.000Z' });
  const result = await verifyPersistedState({ target: { payload: local }, context: { mode: 'manual' }, cloudSnapshotReader: async () => cloud });
  assert(result.mismatches.some((m) => m.category === 'content_mismatch' && m.entity === 'projects'), 'content mismatch should be detected');
  assert(result.mismatches.some((m) => m.category === 'tombstoned_in_cloud_but_active_locally' && m.entity === 'contacts'), 'tombstone mismatch should be detected');
}

async function testAuxAndSchemaMismatchAndReadFailure(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  cloud.auxiliary = { ...local.auxiliary, followUpTableDensity: 'comfortable' } as any;
  cloud.schemaVersionCloud = 3;
  const result = await verifyPersistedState({ target: { payload: local, schemaVersionClient: 1 }, context: { mode: 'manual' }, cloudSnapshotReader: async () => cloud });
  assert(result.mismatches.some((m) => m.category === 'auxiliary_mismatch'), 'auxiliary mismatch should be detected');
  assert(result.mismatches.some((m) => m.category === 'schema_version_mismatch'), 'schema mismatch should be detected');

  const readFailed = await verifyPersistedState({
    target: { payload: local },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => ({ ...cloud, readSucceeded: false, readFailureMessage: 'network down' }),
  });
  assert(readFailed.summary.verified === false, 'failed reads cannot verify');
  assert(readFailed.mismatches.some((m) => m.category === 'verification_read_failed'), 'failed reads should produce verification_read_failed mismatch');
  assert(readFailed.summary.mismatchCount === 0, 'verification read failures should not count as divergence mismatches');
  assert(readFailed.summary.verificationReadFailed === true, 'verification summary should explicitly flag read-failed runs');
}

async function testAuxiliaryCanonicalDefaultsDoNotMismatch(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  local.auxiliary = {
    ...local.auxiliary,
    followUpTableDensity: undefined,
    followUpDuplicateModule: undefined,
    savedFollowUpViews: undefined,
    reminderLedger: undefined,
  } as any;
  cloud.auxiliary = {
    ...cloud.auxiliary,
    followUpTableDensity: 'compact',
    followUpDuplicateModule: 'auto',
    savedFollowUpViews: [],
    reminderLedger: [],
  } as any;

  const result = await verifyPersistedState({
    target: { payload: local },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloud,
  });
  assert(result.summary.verified === true, 'canonical auxiliary defaults should not produce false auxiliary_mismatch');
}

async function testOptionalCloudSchemaMetadataDoesNotBlockVerification(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  cloud.schemaVersionCloud = undefined;
  const result = await verifyPersistedState({
    target: { payload: local, schemaVersionClient: 1 },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloud,
  });
  assert(result.summary.verified === true, 'verification should succeed when optional schema metadata is absent');
  assert(result.mismatches.every((mismatch) => mismatch.category !== 'schema_version_mismatch'), 'schema mismatch should not be emitted when cloud schema metadata is missing');
}

function testBackendContractFailureClassification(): void {
  const contractFailureKind = classifyReadFailureKind({ code: '42703', message: 'column user_preferences.schema_version does not exist' });
  assert(contractFailureKind === 'backend-contract', `missing-column errors should classify as backend-contract, got ${contractFailureKind}`);
  const networkFailureKind = classifyReadFailureKind(new Error('network timeout while fetching'));
  assert(networkFailureKind === 'network', `network errors should remain network, got ${networkFailureKind}`);
  const noSessionSummary = buildVerificationSummary({
    runId: 'run-1',
    startedAt: '2026-04-06T10:00:00.000Z',
    completedAt: '2026-04-06T10:00:10.000Z',
    context: { mode: 'manual' },
    mismatches: [],
    comparedRecordCountsByEntity: {},
    cloudReadSucceeded: false,
    cloudReadFailureMessage: 'Verification cloud read could not start because no signed-in session was available.',
    cloudReadFailureKind: 'no-session',
    cloudReadFailureStage: 'auth',
    cloudReadAttempts: 1,
  });
  assert(noSessionSummary.verificationReadFailureKind === 'no-session', 'no-session failures should remain distinct from backend contract failures');
}

async function testTransientSessionRecoveryReadPath(): Promise<void> {
  let sessionReads = 0;
  const resolved = await resolveVerificationSessionUserIdWithRetry({
    getSession: async () => {
      sessionReads += 1;
      if (sessionReads === 1) return { data: { session: null }, error: null } as any;
      return { data: { session: { user: { id: 'user-1' } } }, error: null } as any;
    },
    getUser: async () => ({ data: { user: null }, error: null } as any),
  });
  assert(resolved.userId === 'user-1', 'session retry should recover user id once auth session is hydrated');
  assert(resolved.attempts === 2, 'session retry should record both attempts');
}

async function testExportReportHasSummaryAndNoSecrets(): Promise<void> {
  const local = payload();
  const result = await verifyPersistedState({ target: { payload: local }, context: { mode: 'manual' }, cloudSnapshotReader: async () => cloudSnapshotFromPayload(local) });
  const report = exportVerificationIncident({ verificationResult: result, cloudConfirmationStatus: 'cloud-confirmed', sessionTrustState: 'healthy' });
  assert(Boolean(report.verificationSummary.runId), 'report should include verification summary');
  assert(Array.isArray(report.mismatchList), 'report should include mismatch list');
  assert(!JSON.stringify(report).toLowerCase().includes('token'), 'report should not include token-like fields');
}

async function testMismatchDiagnosticsIncludeChangedPaths(): Promise<void> {
  const local = payload();
  const cloud = cloudSnapshotFromPayload(local);
  cloud.entities.items.set('i1', {
    ...cloud.entities.items.get('i1')!,
    normalizedRecord: { ...cloud.entities.items.get('i1')!.normalizedRecord, title: 'Changed title' },
    digest: 'changed',
  });
  cloud.auxiliary = { ...cloud.auxiliary, followUpTableDensity: 'comfortable' } as any;
  const result = await verifyPersistedState({
    target: { payload: local },
    context: { mode: 'manual' },
    cloudSnapshotReader: async () => cloud,
  });
  const contentMismatch = result.mismatches.find((mismatch) => mismatch.category === 'content_mismatch');
  const auxiliaryMismatch = result.mismatches.find((mismatch) => mismatch.category === 'auxiliary_mismatch');
  assert(Boolean(contentMismatch?.technicalDetail.includes('Changed paths: title')), 'content mismatch should include changed paths diagnostics');
  assert(Boolean(auxiliaryMismatch?.technicalDetail.includes('Changed paths: followUpTableDensity')), 'auxiliary mismatch should include changed paths diagnostics');
}

function testCompareEntityCollectionsHelper(): void {
  const local = new Map([['x', { id: 'x', digest: 'a', normalizedRecord: { id: 'x' } } as any]]);
  const cloud = new Map<string, any>();
  const mismatches = compareEntityCollections({ entity: 'items', local: local as any, cloud: cloud as any, includePreviews: true, maxMismatchPreviewCount: 5 });
  assert(mismatches[0]?.category === 'missing_in_cloud', 'helper should detect missing_in_cloud');
}

(async function run() {
  await testVerificationSuccess();
  await testRuntimeEnrichedFollowUpsDoNotCauseFalseMismatch();
  await testMissingCloudRecord();
  await testMissingLocalRecord();
  await testContentMismatchAndTombstoneMismatch();
  await testAuxAndSchemaMismatchAndReadFailure();
  await testAuxiliaryCanonicalDefaultsDoNotMismatch();
  await testOptionalCloudSchemaMetadataDoesNotBlockVerification();
  await testTransientSessionRecoveryReadPath();
  testBackendContractFailureClassification();
  await testExportReportHasSummaryAndNoSecrets();
  await testMismatchDiagnosticsIncludeChangedPaths();
  testCompareEntityCollectionsHelper();
})();
