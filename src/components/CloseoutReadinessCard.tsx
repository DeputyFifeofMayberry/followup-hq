import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { FollowUpCloseoutEvaluation } from '../lib/closeoutReadiness';

interface CloseoutReadinessCardProps {
  evaluation: FollowUpCloseoutEvaluation;
  onAddCompletionNote?: () => void;
  onOpenTask?: (id: string) => void;
  onReviewLinkedRecords?: () => void;
}

const readinessTone: Record<FollowUpCloseoutEvaluation['readiness'], string> = {
  ready_to_close: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  close_with_override: 'border-amber-200 bg-amber-50 text-amber-900',
  not_ready_to_close: 'border-rose-200 bg-rose-50 text-rose-900',
};

const readinessLabel: Record<FollowUpCloseoutEvaluation['readiness'], string> = {
  ready_to_close: 'Ready to close',
  close_with_override: 'Close with override',
  not_ready_to_close: 'Not ready to close',
};

export function CloseoutReadinessCard({ evaluation, onAddCompletionNote, onOpenTask, onReviewLinkedRecords }: CloseoutReadinessCardProps) {
  return (
    <div className="space-y-2">
      <div className={`rounded-xl border p-2 text-xs ${readinessTone[evaluation.readiness]}`}>
        <div className="font-semibold">{readinessLabel[evaluation.readiness]}</div>
        <div className="mt-1">{evaluation.summary}</div>
      </div>

      {evaluation.hardBlockers.length ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2 text-xs text-rose-900">
          <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5" />Hard blockers</div>
          {evaluation.hardBlockers.map((condition) => <div key={condition.code}>• {condition.detail}</div>)}
          {evaluation.hardBlockers.some((condition) => condition.code === 'missing_completion_note') && onAddCompletionNote ? <button onClick={onAddCompletionNote} className="action-btn mt-2 !px-2 !py-1 text-xs">Add completion note</button> : null}
        </div>
      ) : null}

      {evaluation.overrideRequired.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
          <div className="mb-1 flex items-center gap-1 font-semibold"><ShieldAlert className="h-3.5 w-3.5" />Override-required conditions</div>
          {evaluation.overrideRequired.map((condition) => <div key={condition.code}>• {condition.detail}</div>)}
          {onOpenTask && evaluation.overrideRequired[0]?.relatedRecordIds?.[0] ? <button onClick={() => onOpenTask(evaluation.overrideRequired[0].relatedRecordIds![0])} className="action-btn mt-2 !px-2 !py-1 text-xs">Open blocking child task</button> : null}
        </div>
      ) : null}

      {evaluation.warnings.length ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          <div className="mb-1 font-semibold">Warnings</div>
          {evaluation.warnings.map((condition) => <div key={condition.code}>• {condition.detail}</div>)}
          {evaluation.warnings.some((condition) => condition.code === 'intake_review_ambiguity') && onReviewLinkedRecords ? <button onClick={onReviewLinkedRecords} className="action-btn mt-2 !px-2 !py-1 text-xs">Review linked records</button> : null}
        </div>
      ) : null}

      {evaluation.readySignals.length ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2 text-xs text-emerald-900">
          <div className="mb-1 flex items-center gap-1 font-semibold"><CheckCircle2 className="h-3.5 w-3.5" />Ready signals</div>
          {evaluation.readySignals.map((condition) => <div key={condition.code}>• {condition.detail}</div>)}
        </div>
      ) : null}
    </div>
  );
}
