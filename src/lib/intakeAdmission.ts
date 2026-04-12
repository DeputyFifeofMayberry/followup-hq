import type { IntakeAssetRecord, IntakeEvidence, IntakeWorkCandidate } from '../types';
import type { IntakeFileCapabilityState } from './intakeFileCapabilities';

export type IntakeAdmissionState = 'extracted_only' | 'reviewable' | 'action_ready';

export interface IntakeAdmissionAssessment {
  state: IntakeAdmissionState;
  reasons: string[];
}

const WEAK_EXTRACTION_PATTERN = /best-effort|manual review|fallback|weak parse|low parse quality|noisy|legacy|inferred/i;

function evidenceScore(evidence: IntakeEvidence[], field: string): number {
  return evidence
    .filter((entry) => entry.field.toLowerCase() === field.toLowerCase())
    .reduce((max, entry) => Math.max(max, entry.score ?? 0), 0);
}

function fieldConfidence(candidate: IntakeWorkCandidate, key: 'title' | 'type' | 'project' | 'owner' | 'dueDate' | 'nextStep') {
  if (key === 'type') return candidate.fieldConfidence?.type ?? candidate.confidence;
  return candidate.fieldConfidence?.[key] ?? candidate.confidence;
}

export function assessIntakeAssetAdmission(input: {
  asset: Pick<IntakeAssetRecord, 'parseStatus' | 'parseQuality' | 'extractedText' | 'extractionConfidence' | 'warnings' | 'extractionChunks' | 'metadata'>;
  capabilityState: IntakeFileCapabilityState;
}): IntakeAdmissionAssessment {
  const { asset, capabilityState } = input;
  const reasons: string[] = [];
  const chunkCount = asset.extractionChunks?.length ?? 0;
  const hasRecoveredSource = Boolean(asset.extractedText?.trim().length || chunkCount);

  if (!hasRecoveredSource || asset.parseStatus === 'failed') {
    return {
      state: 'extracted_only',
      reasons: ['Source extraction failed or recovered no useful text.'],
    };
  }

  if (capabilityState === 'manual_review_only') {
    reasons.push('Source format is best-effort/manual-review by capability policy.');
  }

  const confidence = asset.extractionConfidence ?? 0;
  const weakWarnings = (asset.warnings ?? []).filter((warning) => WEAK_EXTRACTION_PATTERN.test(warning));
  const extractionMode = typeof asset.metadata?.extractionMode === 'string' ? asset.metadata.extractionMode : '';

  if (asset.parseQuality === 'weak') reasons.push('Extraction quality is weak.');
  if (weakWarnings.length > 0) reasons.push('Extraction warnings indicate degraded/best-effort recovery.');
  if (/best_effort|fallback|legacy|msg_best_effort/i.test(extractionMode)) reasons.push('Parser used a degraded extraction path.');
  if (chunkCount <= 1) reasons.push('Very limited chunk evidence was recovered.');

  const trustworthyStructure = capabilityState === 'parse_supported'
    && asset.parseQuality !== 'weak'
    && confidence >= 0.72
    && chunkCount >= 2
    && weakWarnings.length === 0
    && !/best_effort|fallback|legacy/i.test(extractionMode);

  if (trustworthyStructure) {
    return { state: 'action_ready', reasons: ['Extraction quality and structure support action-ready admission.'] };
  }

  return {
    state: capabilityState === 'manual_review_only' && (confidence < 0.36 || chunkCount === 0) ? 'extracted_only' : 'reviewable',
    reasons: reasons.length ? reasons : ['Recovered source requires interpretation before action-ready admission.'],
  };
}

export function assessIntakeCandidateAdmission(input: {
  candidate: IntakeWorkCandidate;
  assetAdmissionState: IntakeAdmissionState;
}): IntakeAdmissionAssessment {
  const { candidate, assetAdmissionState } = input;
  const reasons: string[] = [];

  if (assetAdmissionState === 'extracted_only') {
    return {
      state: 'extracted_only',
      reasons: ['Asset is source-recovery only; candidate cannot be admitted as actionable work.'],
    };
  }

  const title = candidate.title?.trim();
  const project = candidate.project?.trim();
  const typeConfidence = fieldConfidence(candidate, 'type');
  const titleConfidence = fieldConfidence(candidate, 'title');
  const projectConfidence = fieldConfidence(candidate, 'project');

  const titleEvidence = evidenceScore(candidate.evidence, 'title');
  const projectEvidence = evidenceScore(candidate.evidence, 'project');

  const titleStrong = Boolean(title && title.length >= 6 && titleConfidence >= 0.72 && (titleEvidence >= 0.6 || titleConfidence >= 0.84));
  const typeStrong = typeConfidence >= 0.72;
  const projectStrong = Boolean(project && project.length >= 2 && projectConfidence >= 0.7 && (projectEvidence >= 0.58 || projectConfidence >= 0.84));

  const ownerAnchor = Boolean((candidate.owner || candidate.assignee)?.trim()) && fieldConfidence(candidate, 'owner') >= 0.64;
  const dueDateAnchor = Boolean(candidate.dueDate?.trim()) && fieldConfidence(candidate, 'dueDate') >= 0.66;
  const nextStepAnchor = Boolean(candidate.nextStep?.trim() && candidate.nextStep.trim().length >= 8) && fieldConfidence(candidate, 'nextStep') >= 0.58;
  const hasExecutionAnchor = ownerAnchor || dueDateAnchor || nextStepAnchor;

  if (!titleStrong) reasons.push('Title evidence is not strong enough for action-ready admission.');
  if (!typeStrong) reasons.push('Type confidence is below action-ready threshold.');
  if (!projectStrong) reasons.push('Project evidence is not strong enough for action-ready admission.');
  if (!hasExecutionAnchor) reasons.push('No credible execution anchor found (owner, due date, or next step).');

  if (assetAdmissionState !== 'action_ready') reasons.push('Asset admission is reviewable, not action-ready.');
  if (candidate.candidateType === 'reference' || candidate.suggestedAction === 'reference_only') reasons.push('Candidate is currently reference-oriented.');

  if (assetAdmissionState === 'action_ready' && titleStrong && typeStrong && projectStrong && hasExecutionAnchor && candidate.candidateType !== 'reference') {
    return {
      state: 'action_ready',
      reasons: ['Core fields and execution anchor have credible evidence for action-ready admission.'],
    };
  }

  return { state: 'reviewable', reasons };
}

export function resolveCandidateAdmissionState(candidate: Pick<IntakeWorkCandidate, 'admissionState'>): IntakeAdmissionState {
  return candidate.admissionState ?? 'action_ready';
}
