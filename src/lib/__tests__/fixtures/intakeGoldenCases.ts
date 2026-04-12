import { buildParserReceipt } from '../../intakeParserReceipts';
import type { FollowUpItem, IntakeAssetRecord, IntakeBatchRecord, IntakeParserReceipt, TaskItem } from '../../../types';

export interface IntakeGoldenExpectedOutcome {
  admission: 'action_ready' | 'reviewable' | 'extracted_only';
  candidateCount: { min: number; max: number };
  actionableLane: 'actionable' | 'reviewable' | 'extracted_only';
  likelyType?: 'task' | 'followup' | 'reference';
  likelyProjectIncludes?: string;
  likelyTitleIncludes?: string;
  expectsDuplicatePressure?: boolean;
  expectedReadiness?: 'ready_to_approve' | 'ready_after_correction' | 'needs_link_decision' | 'reference_likely' | 'unsafe_to_create' | 'manual_review_required';
  expectedTriage?: 'ready_now' | 'needs_correction' | 'link_review' | 'reference_likely' | 'manual_review';
  batchSafeAllowed?: boolean;
  expectedDecision?: 'create_new_task' | 'create_new_followup' | 'duplicate_update_review' | 'save_reference' | 'link_existing';
}

export interface IntakeGoldenCase {
  id: string;
  category: string;
  description: string;
  asset: IntakeAssetRecord;
  existingFollowups: FollowUpItem[];
  existingTasks: TaskItem[];
  expected: IntakeGoldenExpectedOutcome;
}

function baseAsset(overrides: Partial<IntakeAssetRecord>): IntakeAssetRecord {
  const asset: IntakeAssetRecord = {
    id: `asset-${overrides.id ?? 'seed'}`,
    batchId: 'batch-golden',
    fileName: 'source.eml',
    fileType: 'message/rfc822',
    sizeBytes: 1200,
    kind: 'email',
    source: 'drop',
    uploadedAt: '2026-04-12',
    parseStatus: 'parsed',
    parseQuality: 'strong',
    metadata: { capabilityState: 'parse_supported', extractionMode: 'structured_chunks' },
    extractedText: 'placeholder',
    extractedPreview: 'placeholder',
    warnings: [],
    errors: [],
    attachmentIds: [],
    sourceRefs: ['email:body'],
    contentHash: `hash-${overrides.id ?? 'seed'}`,
    extractionConfidence: 0.9,
    extractionChunks: [],
    admissionState: 'action_ready',
    admissionReasons: [],
    ...overrides,
  };

  if (!asset.parserReceipt) {
    asset.parserReceipt = buildParserReceipt({
      asset,
      capabilityClass: String(asset.metadata.capabilityState || 'parse_supported') as 'parse_supported' | 'manual_review_only' | 'blocked',
    });
  }
  return asset;
}

function existingFollowup(seed: Partial<FollowUpItem>): FollowUpItem {
  return {
    id: seed.id ?? 'FU-1',
    title: seed.title ?? 'Existing follow-up',
    source: 'Email',
    sourceRef: 'seed',
    project: seed.project ?? 'Project Atlas',
    owner: seed.owner ?? 'Alex Kim',
    status: 'Needs action',
    priority: 'Medium',
    dueDate: seed.dueDate,
    lastTouchDate: '2026-04-10',
    nextTouchDate: seed.dueDate ?? '2026-04-14',
    nextAction: 'Follow up',
    summary: seed.summary ?? 'Existing follow-up summary',
    tags: [],
    sourceRefs: seed.sourceRefs,
    mergedItemIds: [],
    waitingOn: seed.waitingOn,
    notes: '',
    timeline: [],
    category: 'Coordination',
    owesNextAction: 'Unknown',
    escalationLevel: 'None',
    cadenceDays: 3,
    createdAt: '2026-04-10',
    updatedAt: '2026-04-10',
  } as FollowUpItem;
}

function existingTask(seed: Partial<TaskItem>): TaskItem {
  return {
    id: seed.id ?? 'TSK-1',
    title: seed.title ?? 'Existing task',
    project: seed.project ?? 'Project Atlas',
    owner: seed.owner ?? 'Alex Kim',
    status: 'To do',
    priority: 'Medium',
    dueDate: seed.dueDate,
    summary: seed.summary ?? 'Existing task summary',
    nextStep: seed.nextStep ?? 'Complete task',
    notes: '',
    tags: [],
    createdAt: '2026-04-10',
    updatedAt: '2026-04-10',
  } as TaskItem;
}

export const INTAKE_GOLDEN_BATCH: IntakeBatchRecord = {
  id: 'batch-golden',
  createdAt: '2026-04-12',
  source: 'drop',
  assetIds: [],
  status: 'review',
  stats: {
    filesProcessed: 0,
    candidatesCreated: 0,
    highConfidence: 0,
    failedParses: 0,
    duplicatesFlagged: 0,
  },
};

export const INTAKE_GOLDEN_CASES: IntakeGoldenCase[] = [
  {
    id: 'clean-email-actionable',
    category: 'clean email with explicit project/action',
    description: 'Structured request with project, owner, and explicit due date should be action-ready and queue-safe.',
    asset: baseAsset({
      id: 'clean-email-actionable',
      fileName: 'atlas-rfi-followup.eml',
      extractedText: 'Subject: Atlas RFI response due 2026-04-18. Please have Alex Kim submit RFI package for Project Atlas by 2026-04-18.',
      extractedPreview: 'Atlas RFI response due 2026-04-18',
      extractionChunks: [{ id: 'c1', sourceRef: 'email:body', kind: 'email_body', text: 'Task: Submit Atlas RFI response package. Project Atlas. Owner Alex Kim. Due 2026-04-18. Next step submit package.', quality: 0.96, fieldHints: { title: 'Submit Atlas RFI response package', project: 'Project Atlas', owner: 'Alex Kim', dueDate: '2026-04-18', nextStep: 'Submit package', priority: 'High' } }],
      extractionConfidence: 0.97,
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'action_ready',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'actionable',
      likelyType: 'task',
      likelyProjectIncludes: 'Atlas',
      likelyTitleIncludes: 'submit',
      expectsDuplicatePressure: false,
      expectedDecision: 'create_new_task',
    },
  },
  {
    id: 'email-followup-owner-waiting',
    category: 'email that should become a follow-up',
    description: 'Waiting-on language with explicit owner/date should prefer follow-up admission and ready-now triage.',
    asset: baseAsset({
      id: 'email-followup-owner-waiting',
      fileName: 'vendor-followup.eml',
      extractedText: 'Please follow up with Metro Electric on pending quote for Project Meridian by 2026-04-20.',
      extractionChunks: [{ id: 'c2', sourceRef: 'email:body', kind: 'email_body', text: 'Follow up with Metro Electric on pending quote. Project Meridian. Owner Jamie Lee. Due 2026-04-20. Waiting on vendor pricing.', quality: 0.92, fieldHints: { title: 'Follow up with Metro Electric on pending quote', project: 'Project Meridian', owner: 'Jamie Lee', dueDate: '2026-04-20', waitingOn: 'Metro Electric pricing', nextStep: 'Call vendor for pricing' } }],
      extractionConfidence: 0.93,
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'action_ready',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'actionable',
      likelyType: 'followup',
      likelyProjectIncludes: 'Meridian',
      expectedDecision: 'create_new_followup',
    },
  },
  {
    id: 'reference-only-informational',
    category: 'informational/reference-only source',
    description: 'FYI/status bulletin without explicit owner should remain reference-likely and never be batch safe.',
    asset: baseAsset({
      id: 'reference-only-informational',
      fileName: 'fyi-status-email.eml',
      extractedText: 'FYI only: weekly status digest for Project Harbor. No action required.',
      extractionChunks: [{ id: 'c3', sourceRef: 'email:body', kind: 'email_body', text: 'FYI only weekly status digest. Project Harbor. Reference update for records. No action required.', quality: 0.8, fieldHints: { title: 'Weekly status digest', project: 'Project Harbor', summary: 'Reference-only status digest no action required' } }],
      extractionConfidence: 0.79,
      admissionState: 'reviewable',
      admissionReasons: ['Reference-style content does not provide clear execution anchors.'],
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'reviewable',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'reviewable',
      expectedReadiness: 'reference_likely',
      batchSafeAllowed: false,
      expectedDecision: 'save_reference',
    },
  },
  {
    id: 'duplicate-link-pressure',
    category: 'duplicate/link-pressure case',
    description: 'Near-identical record should trigger duplicate pressure and link-review-first routing.',
    asset: baseAsset({
      id: 'duplicate-link-pressure',
      fileName: 'duplicate-reminder.eml',
      extractedText: 'Reminder: Follow up with Metro Electric on pending quote for Project Meridian due 2026-04-20.',
      extractionChunks: [{ id: 'c4', sourceRef: 'email:body', kind: 'email_body', text: 'Follow up with Metro Electric on pending quote. Project Meridian. Owner Jamie Lee. Due 2026-04-20. Waiting on vendor pricing.', quality: 0.94, fieldHints: { title: 'Follow up with Metro Electric on pending quote', project: 'Project Meridian', owner: 'Jamie Lee', dueDate: '2026-04-20', waitingOn: 'Metro Electric pricing' } }],
      extractionConfidence: 0.95,
    }),
    existingFollowups: [existingFollowup({ id: 'FU-dup-1', title: 'Follow up with Metro Electric on pending quote', project: 'Project Meridian', owner: 'Jamie Lee', dueDate: '2026-04-20', waitingOn: 'Metro Electric pricing' })],
    existingTasks: [],
    expected: {
      admission: 'action_ready',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'actionable',
      likelyType: 'followup',
      expectsDuplicatePressure: true,
      batchSafeAllowed: false,
      expectedDecision: 'link_existing',
    },
  },
  {
    id: 'weak-degraded-email',
    category: 'weak/degraded source (reviewable)',
    description: 'Low-quality extraction should stay reviewable/manual and not create action-ready queue items.',
    asset: baseAsset({
      id: 'weak-degraded-email',
      fileName: 'legacy-thread.msg',
      fileType: 'application/vnd.ms-outlook',
      parseStatus: 'review_needed',
      parseQuality: 'weak',
      metadata: { capabilityState: 'manual_review_only', extractionMode: 'msg_best_effort' },
      warnings: ['Outlook .msg parsing is best-effort; verify fields before approval.'],
      extractedText: 'Legacy message recovered partially. Maybe Project Falcon. Need owner and due date confirmation.',
      extractionChunks: [{ id: 'c5', sourceRef: 'msg:body', kind: 'email_body', text: 'Need review. Project Falcon maybe. Waiting on subcontractor details.', quality: 0.54, fieldHints: { title: 'Need review for Falcon message', project: 'Project Falcon' } }],
      extractionConfidence: 0.52,
      admissionState: 'reviewable',
      admissionReasons: ['Source requires interpretation before action-ready approval.'],
      parserReceipt: {
        sourceFileName: 'legacy-thread.msg',
        sourceFileType: 'application/vnd.ms-outlook',
        capabilityClass: 'manual_review_only',
        parserPath: 'msg_best_effort',
        parseQuality: 'weak',
        admissionState: 'reviewable',
        weakSourceRoute: 'weak_source_review',
        recoveredContentStatus: 'partial',
        warningSummary: ['Outlook .msg parsing is best-effort; verify fields before approval.'],
        downgradeReasons: ['Source format is accepted on a manual-review path only.', 'Parse quality is weak.'],
        userNextSteps: ['interpret_manually', 'review_extracted_source', 'save_as_reference'],
      } as IntakeParserReceipt,
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'reviewable',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'reviewable',
      expectedReadiness: 'reference_likely',
      batchSafeAllowed: false,
      expectedDecision: 'save_reference',
    },
  },
  {
    id: 'spreadsheet-row-tracker',
    category: 'spreadsheet-like row tracker input',
    description: 'Tracker row with explicit task fields should stay structured and actionable.',
    asset: baseAsset({
      id: 'spreadsheet-row-tracker',
      kind: 'spreadsheet',
      fileName: 'row-tracker.xlsx',
      fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      extractedText: 'Task row for Project Beacon',
      extractionChunks: [{ id: 'c6', sourceRef: 'Tracker#row14', locator: 'Tracker!A14:F14', kind: 'sheet_row', text: 'Task: Submit permit log | Project: Project Beacon | Owner: Drew Chen | Due: 2026-04-25 | Next: Send to city', quality: 0.94, fieldHints: { title: 'Submit permit log', project: 'Project Beacon', owner: 'Drew Chen', dueDate: '2026-04-25', nextStep: 'Send to city' }, rowNumber: 14, sheetName: 'Tracker' }],
      extractionConfidence: 0.95,
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'action_ready',
      candidateCount: { min: 1, max: 3 },
      actionableLane: 'actionable',
      likelyType: 'task',
      likelyProjectIncludes: 'Beacon',
      expectedDecision: 'create_new_task',
    },
  },
  {
    id: 'pdf-partial-trust',
    category: 'PDF/document source with partial trust',
    description: 'Partial PDF extraction should remain correction-needed (not auto-ready) despite candidate creation.',
    asset: baseAsset({
      id: 'pdf-partial-trust',
      kind: 'pdf',
      fileName: 'meeting-notes.pdf',
      fileType: 'application/pdf',
      parseQuality: 'partial',
      parseStatus: 'parsed',
      extractedText: 'Meeting notes mention action items for Project Canyon and a possible due date.',
      extractionChunks: [{ id: 'c7', sourceRef: 'pdf:page1', locator: 'p1', kind: 'pdf_page', text: 'Action item: coordinate closeout checklist for Project Canyon. Owner appears to be Pat. Due maybe 2026-04-30.', quality: 0.68, fieldHints: { title: 'Coordinate closeout checklist', project: 'Project Canyon', owner: 'Pat', dueDate: '2026-04-30' } }],
      extractionConfidence: 0.69,
      admissionState: 'reviewable',
      admissionReasons: ['Evidence quality is partial and should be confirmed before action-ready admission.'],
      parserReceipt: {
        sourceFileName: 'meeting-notes.pdf',
        sourceFileType: 'application/pdf',
        capabilityClass: 'parse_supported',
        parserPath: 'pdf_text',
        parseQuality: 'partial',
        admissionState: 'reviewable',
        weakSourceRoute: 'weak_source_review',
        recoveredContentStatus: 'partial',
        warningSummary: [],
        downgradeReasons: ['Evidence quality is partial and should be confirmed before action-ready admission.'],
        userNextSteps: ['review_extracted_source', 'save_as_reference'],
      },
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'reviewable',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'reviewable',
      expectedReadiness: 'reference_likely',
      batchSafeAllowed: false,
      expectedDecision: 'save_reference',
    },
  },
  {
    id: 'legacy-extracted-only',
    category: 'legacy/manual-review-only class (extracted-only)',
    description: 'Failed/blocked legacy source should remain extracted-only with zero candidates.',
    asset: baseAsset({
      id: 'legacy-extracted-only',
      fileName: 'scanned-fax.tif',
      fileType: 'image/tiff',
      kind: 'unknown',
      parseStatus: 'failed',
      parseQuality: 'failed',
      metadata: { capabilityState: 'blocked', extractionMode: 'none' },
      extractedText: '',
      extractedPreview: '',
      warnings: ['Source format is blocked for intake parsing.'],
      errors: ['No parser available for image/tiff.'],
      extractionConfidence: 0,
      admissionState: 'extracted_only',
      admissionReasons: ['Source extraction failed or recovered no useful text.'],
      parserReceipt: {
        sourceFileName: 'scanned-fax.tif',
        sourceFileType: 'image/tiff',
        capabilityClass: 'blocked',
        parserPath: 'none',
        parseQuality: 'failed',
        admissionState: 'extracted_only',
        weakSourceRoute: 'blocked_source',
        recoveredContentStatus: 'none',
        warningSummary: ['Source format is blocked for intake parsing.'],
        downgradeReasons: ['Source format is blocked for intake parsing.', 'No parser available for image/tiff.'],
        userNextSteps: ['remove_failed_asset', 'review_extracted_source'],
      },
    }),
    existingFollowups: [],
    existingTasks: [],
    expected: {
      admission: 'extracted_only',
      candidateCount: { min: 0, max: 0 },
      actionableLane: 'extracted_only',
      batchSafeAllowed: false,
    },
  },
  {
    id: 'email-task-explicit-action',
    category: 'email that should become a task',
    description: 'Imperative action language and checklist framing should favor task create-new path.',
    asset: baseAsset({
      id: 'email-task-explicit-action',
      fileName: 'submittal-action.eml',
      extractedText: 'Please submit updated concrete submittal package for Project Keystone by 2026-04-22.',
      extractionChunks: [{ id: 'c8', sourceRef: 'email:body', kind: 'email_body', text: 'Action item: Submit updated concrete submittal package. Project Keystone. Owner Riley Park. Due 2026-04-22. Next step send submittal to engineer.', quality: 0.95, fieldHints: { title: 'Submit updated concrete submittal package', project: 'Project Keystone', owner: 'Riley Park', dueDate: '2026-04-22', nextStep: 'Send submittal to engineer' } }],
      extractionConfidence: 0.96,
    }),
    existingFollowups: [],
    existingTasks: [existingTask({ id: 'TSK-old', title: 'Review older submittal log', project: 'Project Keystone', dueDate: '2026-04-10' })],
    expected: {
      admission: 'action_ready',
      candidateCount: { min: 1, max: 2 },
      actionableLane: 'actionable',
      likelyType: 'task',
      likelyProjectIncludes: 'Keystone',
      expectedDecision: 'create_new_task',
    },
  },
];
