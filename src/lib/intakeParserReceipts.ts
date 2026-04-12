import type { IntakeAssetRecord, IntakeParserReceipt, IntakeReceiptNextStep, IntakeRecoveredContentStatus, IntakeWeakSourceRoute } from '../types';
import type { IntakeFileCapabilityState } from './intakeFileCapabilities';

function deriveRecoveredContentStatus(asset: Pick<IntakeAssetRecord, 'parseStatus' | 'extractedText' | 'extractionChunks' | 'extractionConfidence'>): IntakeRecoveredContentStatus {
  if (asset.parseStatus === 'failed') return 'none';
  const chunkCount = asset.extractionChunks?.length ?? 0;
  const textLength = asset.extractedText?.trim().length ?? 0;
  const confidence = asset.extractionConfidence ?? 0;
  if (!chunkCount && textLength < 30) return 'none';
  if (chunkCount >= 2 && textLength >= 240 && confidence >= 0.68) return 'substantial';
  return 'partial';
}

function deriveWeakSourceRoute(input: {
  capabilityClass: IntakeFileCapabilityState;
  parseStatus: IntakeAssetRecord['parseStatus'];
  admissionState: NonNullable<IntakeAssetRecord['admissionState']>;
}): IntakeWeakSourceRoute {
  if (input.capabilityClass === 'blocked' || input.parseStatus === 'failed') return 'blocked_source';
  if (input.admissionState === 'action_ready') return 'actionable_queue';
  return 'weak_source_review';
}

function deriveNextSteps(input: {
  route: IntakeWeakSourceRoute;
  receipt: Pick<IntakeParserReceipt, 'capabilityClass' | 'admissionState'>;
  hasRetrySource: boolean;
  hasRecoveredContent: boolean;
}): IntakeReceiptNextStep[] {
  const steps: IntakeReceiptNextStep[] = [];
  if (input.route === 'actionable_queue') {
    steps.push('create_action_after_review');
    return steps;
  }

  if (input.route === 'blocked_source') {
    if (input.hasRetrySource) steps.push('retry_parse');
    steps.push('remove_failed_asset');
    steps.push('review_extracted_source');
    return [...new Set(steps)];
  }

  if (input.receipt.capabilityClass === 'manual_review_only') steps.push('interpret_manually');
  if (input.receipt.admissionState === 'extracted_only' || input.hasRecoveredContent) steps.push('review_extracted_source');
  if (input.hasRetrySource) steps.push('retry_parse');
  steps.push('save_as_reference');
  return [...new Set(steps)];
}

export function buildParserReceipt(input: {
  asset: Pick<IntakeAssetRecord,
  'fileName' | 'fileType' | 'parseStatus' | 'parseQuality' | 'admissionState' | 'warnings' | 'metadata' | 'admissionReasons' | 'errors' | 'extractedText' | 'extractionChunks' | 'extractionConfidence' | 'retrySource'>;
  capabilityClass: IntakeFileCapabilityState;
}): IntakeParserReceipt {
  const admissionState = input.asset.admissionState ?? 'reviewable';
  const parserPath = String(input.asset.metadata?.extractionMode || 'standard_parse');
  const recoveredContentStatus = deriveRecoveredContentStatus(input.asset);
  const route = deriveWeakSourceRoute({
    capabilityClass: input.capabilityClass,
    parseStatus: input.asset.parseStatus,
    admissionState,
  });

  const downgradeReasons = [
    ...(input.capabilityClass === 'manual_review_only' ? ['Source format is accepted on a manual-review path only.'] : []),
    ...(input.capabilityClass === 'blocked' ? ['Source format is blocked for intake parsing.'] : []),
    ...(input.asset.parseQuality === 'weak' ? ['Parse quality is weak.'] : []),
    ...(admissionState !== 'action_ready' ? (input.asset.admissionReasons ?? []) : []),
    ...(input.asset.errors?.length ? [input.asset.errors[0]] : []),
  ];

  return {
    sourceFileName: input.asset.fileName,
    sourceFileType: input.asset.fileType,
    capabilityClass: input.capabilityClass,
    parserPath,
    parseQuality: input.asset.parseQuality,
    admissionState,
    weakSourceRoute: route,
    recoveredContentStatus,
    warningSummary: [...new Set(input.asset.warnings ?? [])].slice(0, 6),
    downgradeReasons: [...new Set(downgradeReasons.filter(Boolean))],
    userNextSteps: deriveNextSteps({
      route,
      receipt: { capabilityClass: input.capabilityClass, admissionState },
      hasRetrySource: Boolean(input.asset.retrySource),
      hasRecoveredContent: recoveredContentStatus !== 'none',
    }),
  };
}

export function isWeakSourceReceipt(receipt?: IntakeParserReceipt): boolean {
  return receipt?.weakSourceRoute === 'weak_source_review' || receipt?.weakSourceRoute === 'blocked_source';
}
