import { starterItems, starterTasks } from '../../sample-data';
import { resolveCandidateMatches } from '../reviewPipeline';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runReviewPipelineChecks() {
  const matches = resolveCandidateMatches({
    id: 'cand-1',
    batchId: 'batch-1',
    assetId: 'asset-1',
    candidateType: 'followup',
    suggestedAction: 'create_new',
    confidence: 0.8,
    title: starterItems[0].title,
    project: starterItems[0].project,
    dueDate: starterItems[0].dueDate,
    waitingOn: starterItems[0].waitingOn,
    summary: starterItems[0].summary,
    nextStep: 'follow up',
    tags: [],
    explanation: [],
    evidence: [],
    fieldConfidence: {},
    warnings: [],
    duplicateMatches: [],
    existingRecordMatches: [],
    approvalStatus: 'pending',
    owner: 'Jared',
    assignee: 'Jared',
    priority: 'High',
    statusHint: 'Needs action',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, starterItems, starterTasks);

  assert(matches.length > 0, 'review pipeline should find at least one candidate match');
  assert(matches[0].score >= 0.45, 'top match should clear duplicate/link threshold');
}

runReviewPipelineChecks();
