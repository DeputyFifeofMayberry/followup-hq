import { scoreCandidateMatch } from '../intake/reviewPipeline';
import { normalizeIdentity, mergeAliases } from '../entities';
import { createDraftMessage, transitionOutbound } from '../outboundMessages';
import { applyBulkToFollowUp, previewBulkAction } from '../bulkActions';
import { filterFollowUps } from '../export';
import type { FollowUpItem } from '../../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function testIntakeMatchScoring(): void {
  const scored = scoreCandidateMatch(
    { title: 'RFI 220 response needed', project: 'B995', dueDate: '2026-04-08', waitingOn: 'owner team', summary: 'Need vendor response', sourceRefs: ['email:thread:abc'] },
    { title: 'RFI 220 vendor response needed', project: 'B995', dueDate: '2026-04-09', waitingOn: 'owner team', summary: 'Waiting for vendor response', sourceRefs: ['email:thread:abc'] },
  );
  assert(scored.score >= 0.75, `expected high match score, got ${scored.score}`);
  assert(scored.matchedFields.includes('title') && scored.matchedFields.includes('project'), 'expected title/project matched fields');
}

function testEntityNormalization(): void {
  assert(normalizeIdentity(' ACME, Inc. ') === 'acme inc', 'should normalize case/spacing/punctuation');
  const aliases = mergeAliases(['acme inc'], ['Acme Inc.', 'ACME  INC', 'acme-inc']);
  assert(aliases.length === 1, 'alias merge should dedupe normalization variants');
}

function testOutboundStateTransitions(): void {
  const draft = createDraftMessage('FU1', 'Status check', 'Body', ['a@acme.com']);
  const ready = transitionOutbound(draft, 'mark_ready');
  const sent = transitionOutbound(ready, 'mark_sent_verified', { confirmationSource: 'manual-receipt' });
  assert(sent.state === 'sent_verified', 'outbound should reach sent_verified');
  assert(sent.confirmationSource === 'manual-receipt', 'confirmation source should persist');
}

function testBulkPreviewApplyUndoShape(): void {
  const item: FollowUpItem = {
    id: 'FU1', title: 'Review submittal', source: 'Notes', project: 'B995', owner: 'Jared', status: 'Needs action', priority: 'Medium',
    dueDate: '2026-04-10', lastTouchDate: '2026-04-01T00:00:00.000Z', nextTouchDate: '2026-04-04T00:00:00.000Z', nextAction: 'Ping vendor', summary: 'Awaiting package',
    tags: ['alpha'], sourceRef: 'manual', sourceRefs: [], mergedItemIds: [], notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Vendor', escalationLevel: 'None', cadenceDays: 3,
  };
  const preview = previewBulkAction({ type: 'retag', ids: ['FU1'], tags: ['ops'] }, [item], []);
  assert(preview.affected === 1, 'bulk preview should include one target');
  assert(preview.skippedForIntegrity === 0, 'retag should not skip trusted/lifecycle states');
  const updated = applyBulkToFollowUp(item, { type: 'retag', ids: ['FU1'], tags: ['ops'] });
  assert(updated.tags.includes('alpha') && updated.tags.includes('ops'), 'retag must merge instead of overwrite');

  const reviewItem = { ...item, id: 'FU2', lifecycleState: 'review_required' as const, reviewReasons: ['missing_project_link' as const], dataQuality: 'review_required' as const, needsCleanup: true };
  const closePreview = previewBulkAction({ type: 'close', ids: ['FU1', 'FU2'] }, [item, reviewItem], []);
  assert(closePreview.affected === 1 && closePreview.skippedForIntegrity === 1, 'close should skip review records');
  const unchanged = applyBulkToFollowUp(reviewItem, { type: 'close', ids: ['FU2'] });
  assert(unchanged.status === reviewItem.status, 'non-trusted review records should not be bulk-closed');
}

function testExportTrustDefaults(): void {
  const trusted: FollowUpItem = {
    id: 'FU-LIVE', title: 'Live follow-up', source: 'Notes', project: 'P', owner: 'Owner', status: 'Needs action', priority: 'Medium',
    dueDate: '2026-04-10', lastTouchDate: '2026-04-01T00:00:00.000Z', nextTouchDate: '2026-04-04T00:00:00.000Z', nextAction: 'Ping vendor', summary: 'Awaiting package',
    tags: [], sourceRef: 'manual', sourceRefs: [], mergedItemIds: [], notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Vendor', escalationLevel: 'None', cadenceDays: 3, lifecycleState: 'ready', dataQuality: 'valid_live',
  };
  const review = { ...trusted, id: 'FU-REVIEW', lifecycleState: 'review_required' as const, dataQuality: 'review_required' as const, reviewReasons: ['missing_project_link' as const], needsCleanup: true };
  const defaults = filterFollowUps([trusted, review], {
    savedView: 'All',
    project: 'All',
    owner: 'All',
    statuses: ['All'],
    priorities: ['All'],
    search: '',
    dueFrom: '',
    dueTo: '',
    nextTouchFrom: '',
    nextTouchTo: '',
    includeClosed: true,
    onlyOverdue: false,
    onlyNeedsNudge: false,
    tagQuery: '',
    includeReviewRequired: false,
    includeDraftRecords: false,
  });
  assert(defaults.length === 1 && defaults[0].id === 'FU-LIVE', 'default export should include trusted live records only');
}

export function runTrustUpgradeSelfChecks(): void {
  testIntakeMatchScoring();
  testEntityNormalization();
  testOutboundStateTransitions();
  testBulkPreviewApplyUndoShape();
  testExportTrustDefaults();
}

try {
  runTrustUpgradeSelfChecks();
  console.log('trust upgrades self-checks passed');
} catch (error) {
  console.error('trust upgrades self-checks failed');
  throw error;
}
