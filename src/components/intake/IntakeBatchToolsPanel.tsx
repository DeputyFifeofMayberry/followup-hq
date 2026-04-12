import { CheckCircle2 } from 'lucide-react';
import { isWeakSourceReceipt } from '../../lib/intakeParserReceipts';
import type { IntakeAssetRecord, IntakeBatchRecord, IntakeWorkCandidate } from '../../types';

interface Props {
  intakeBatches: IntakeBatchRecord[];
  intakeAssets: IntakeAssetRecord[];
  intakeWorkCandidates: IntakeWorkCandidate[];
  archiveIntakeBatch: (batchId: string) => void;
  clearFinalizedIntakeCandidates: (batchId?: string) => void;
  removeIntakeAsset: (assetId: string) => void;
  retryIntakeAssetParse: (assetId: string) => Promise<{ status: 'success' | 'failed'; message: string }>;
  deleteIntakeBatchIfEmpty: (batchId: string) => void;
  onFeedback: (tone: 'success' | 'error', message: string) => void;
}

export function IntakeBatchToolsPanel(props: Props) {
  const activeBatches = props.intakeBatches.filter((batch) => batch.status !== 'archived');
  const archivedBatches = props.intakeBatches.filter((batch) => batch.status === 'archived');

  return (
    <section className="intake-support-panel intake-tools-panel">
      <details className="intake-tools-disclosure">
        <summary>
          <span>Batch lifecycle and recovery tools</span>
          <span className="intake-intro-chip"><CheckCircle2 className="h-3.5 w-3.5" />Batches {props.intakeBatches.length}</span>
        </summary>
        <div className="intake-tools-disclosure-body">
          <div className="space-y-2">
            {activeBatches.slice(0, 8).map((batch) => {
              const batchAssets = props.intakeAssets.filter((asset) => asset.batchId === batch.id && !asset.parentAssetId);
              const batchCandidates = props.intakeWorkCandidates.filter((candidate) => candidate.batchId === batch.id);
              const failures = batchAssets.filter((asset) => asset.parseStatus === 'failed');
              const weakSources = batchAssets.filter((asset) => isWeakSourceReceipt(asset.parserReceipt));
              return <div key={batch.id} className="rounded-lg border border-slate-200 p-2 text-xs">
                <div className="font-semibold text-slate-900">{batch.id} • {batch.createdAt}</div>
                <div className="text-slate-600">Files {batch.stats.filesProcessed} • Candidates {batch.stats.candidatesCreated} • Pending {batch.stats.activeCandidates ?? batchCandidates.filter((entry) => entry.approvalStatus === 'pending').length} • Failures {batch.stats.failedParses} • Weak/degraded {weakSources.length}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button className="action-btn !px-2 !py-1 text-xs" onClick={() => props.clearFinalizedIntakeCandidates(batch.id)}>Clear finalized</button>
                  <button className="action-btn !px-2 !py-1 text-xs" onClick={() => props.archiveIntakeBatch(batch.id)}>Archive batch</button>
                  <button className="action-btn !px-2 !py-1 text-xs" onClick={() => props.deleteIntakeBatchIfEmpty(batch.id)}>Delete if empty</button>
                </div>
                {weakSources.map((asset) => <div key={asset.id} className="mt-1 rounded border border-amber-200 bg-amber-50 px-2 py-1">
                  <div className="font-semibold text-slate-900">{asset.fileName}</div>
                  <div className="text-slate-700">{asset.parserReceipt?.downgradeReasons.slice(0, 2).join(' · ') || asset.errors[0] || asset.warnings[0]}</div>
                  <div className="text-[11px] text-slate-600">Parser path {asset.parserReceipt?.parserPath || asset.metadata.extractionMode || 'standard_parse'} • Next steps {asset.parserReceipt?.userNextSteps.join(' → ') || 'review_extracted_source'}</div>
                  <div className="mt-1 flex gap-1">{asset.retrySource ? <button className="action-btn !px-2 !py-0.5 text-[11px]" onClick={async () => {
                    const result = await props.retryIntakeAssetParse(asset.id);
                    props.onFeedback(result.status === 'success' ? 'success' : 'error', result.message);
                  }}>Retry parse</button> : <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{asset.retryUnavailableReason || 'Retry unavailable for this legacy source.'}</span>}
                  {(asset.parseStatus === 'failed' || failures.some((entry) => entry.id === asset.id)) ? <button className="action-btn !px-2 !py-0.5 text-[11px]" onClick={() => props.removeIntakeAsset(asset.id)}>Remove failed asset</button> : null}</div>
                </div>)}
              </div>;
            })}
            {!activeBatches.length ? <div className="text-xs text-slate-500">No active batches.</div> : null}
            {archivedBatches.length ? <div className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">Archived history: {archivedBatches.map((batch) => `${batch.id} (${batch.stats.candidatesCreated} candidates)`).slice(0, 4).join(' · ')}</div> : null}
          </div>
        </div>
      </details>
    </section>
  );
}
