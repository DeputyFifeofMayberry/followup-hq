import type { VerificationResult, VerificationState } from './state/types';

export function deriveVerificationMetaFromResult(result: VerificationResult): {
  verificationState: VerificationState;
  recoveryReviewNeeded: boolean;
  failureMessage?: string;
  activitySummary: string;
  activityDetail: string;
} {
  if (!result.summary.cloudReadSucceeded) {
    return {
      verificationState: 'read-failed',
      recoveryReviewNeeded: false,
      failureMessage: result.summary.verificationReadFailureMessage ?? result.mismatches[0]?.technicalDetail,
      activitySummary: 'Could not complete cloud verification read.',
      activityDetail: result.summary.verificationReadFailureMessage ?? 'Verification cloud read failed before mismatch comparison.',
    };
  }

  if (result.summary.verified) {
    return {
      verificationState: 'verified-match',
      recoveryReviewNeeded: false,
      failureMessage: undefined,
      activitySummary: 'Verified match with cloud state.',
      activityDetail: 'Last verification matched current cloud state.',
    };
  }

  return {
    verificationState: 'mismatch-found',
    recoveryReviewNeeded: true,
    failureMessage: undefined,
    activitySummary: 'Recovery review needed.',
    activityDetail: `Last verification found ${result.summary.mismatchCount} mismatch${result.summary.mismatchCount === 1 ? '' : 'es'}.`,
  };
}
