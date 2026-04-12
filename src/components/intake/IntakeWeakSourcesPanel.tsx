import { AlertTriangle, CircleOff, Wrench } from 'lucide-react';
import { isWeakSourceReceipt } from '../../lib/intakeParserReceipts';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../../types';

interface Props {
  intakeAssets: IntakeAssetRecord[];
  intakeWorkCandidates: IntakeWorkCandidate[];
}

export function IntakeWeakSourcesPanel({ intakeAssets, intakeWorkCandidates }: Props) {
  const rootAssets = intakeAssets.filter((asset) => !asset.parentAssetId);
  const weakAssets = rootAssets.filter((asset) => isWeakSourceReceipt(asset.parserReceipt));
  const needsAttention = weakAssets.filter((asset) => asset.parseStatus === 'failed' || asset.admissionState === 'extracted_only');
  const recoveredReviewable = weakAssets.filter((asset) => asset.admissionState === 'reviewable' && asset.parseStatus !== 'failed');
  const weakCandidateCount = intakeWorkCandidates.filter((candidate) => candidate.admissionState !== 'action_ready' && candidate.approvalStatus === 'pending').length;

  if (!weakAssets.length) return null;

  return (
    <section className="intake-support-panel intake-weak-sources-panel">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Degraded source routing</div>
          <div className="text-sm font-semibold text-slate-900">{weakAssets.length} weak/degraded intake source(s) need explicit handling</div>
          <div className="text-xs text-slate-600">These sources are preserved with parser receipts and routed to review/recovery, not mixed into the clean actionable path.</div>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          <span className="intake-intro-chip"><AlertTriangle className="h-3.5 w-3.5" />Needs attention {needsAttention.length}</span>
          <span className="intake-intro-chip"><Wrench className="h-3.5 w-3.5" />Reviewable recovered {recoveredReviewable.length}</span>
          <span className="intake-intro-chip"><CircleOff className="h-3.5 w-3.5" />Pending weak candidates {weakCandidateCount}</span>
        </div>
      </div>
      <div className="mt-2 space-y-1.5">
        {weakAssets.slice(0, 5).map((asset) => (
          <div key={asset.id} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1.5 text-xs">
            <div className="font-semibold text-slate-900">{asset.fileName}</div>
            <div className="text-slate-700">{asset.parserReceipt?.downgradeReasons.slice(0, 2).join(' · ') || 'Recovered with limited trust.'}</div>
            <div className="text-slate-600">Next: {asset.parserReceipt?.userNextSteps.join(' → ') || 'review_extracted_source'}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
