import { scoreCandidateMatch } from '../intake/reviewPipeline';
import { normalizeIdentity, mergeAliases } from '../entities';
import { createDraftMessage, transitionOutbound } from '../outboundMessages';
import { applyBulkToFollowUp, previewBulkAction } from '../bulkActions';
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
  const updated = applyBulkToFollowUp(item, { type: 'retag', ids: ['FU1'], tags: ['ops'] });
  assert(updated.tags.includes('alpha') && updated.tags.includes('ops'), 'retag must merge instead of overwrite');
}

export function runTrustUpgradeSelfChecks(): void {
  testIntakeMatchScoring();
  testEntityNormalization();
  testOutboundStateTransitions();
  testBulkPreviewApplyUndoShape();
}

try {
  runTrustUpgradeSelfChecks();
  console.log('trust upgrades self-checks passed');
} catch (error) {
  console.error('trust upgrades self-checks failed');
  throw error;
}
