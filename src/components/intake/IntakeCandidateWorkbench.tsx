import { ClipboardCheck, Link2, Mail } from 'lucide-react';
import { toDateInputValue } from '../../lib/intakeDates';
import type { IntakeQuickFixAction, IntakeReviewPlan } from '../../lib/intakeReviewPlan';
import type { ImportSafetyResult } from '../../lib/intakeImportSafety';
import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../../types';
import { IntakeEvidencePanel } from './IntakeEvidencePanel';
import { actionIsPrimary, candidateTypeLabel, correctionBucketLabel, decisionLabel, recommendedActionDescription, reviewReasonForField, type SourceTab } from './intakeWorkspaceTypes';

interface Props {
  selectedCandidate: IntakeWorkCandidate | null;
  selectedQueueItem: IntakeQueueItem | null;
  selectedAsset: IntakeAssetRecord | null;
  selectedReviewPlan: IntakeReviewPlan | null;
  selectedActionHints: Array<{ field: { key: string }; nextStep: string }>;
  requiredCorrectionsByStatus: Record<'missing' | 'weak' | 'conflicting', NonNullable<IntakeReviewPlan>['requiredCorrections']>;
  suggestedQuickFixes: IntakeQuickFixAction[];
  selectedMatchId: string | null;
  createBlocked: boolean;
  safety: ImportSafetyResult | null;
  confirmUnsafeCreate: boolean;
  selectedSourceTab: SourceTab;
  selectedEvidenceLocator: string | null;
  duplicateGroup: IntakeWorkCandidate[];
  onUpdateCandidate: (id: string, patch: Partial<IntakeWorkCandidate>) => void;
  onDecision: (decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link') => void;
  onSetConfirmUnsafeCreate: (value: boolean) => void;
  onApplyQuickFix: (action: IntakeQuickFixAction) => void;
  onSelectMatchId: (id: string | null) => void;
  onSelectCandidateId: (id: string) => void;
  onSetSourceTab: (tab: SourceTab) => void;
  onSelectEvidenceLocator: (locator: string | null) => void;
}

export function IntakeCandidateWorkbench(props: Props) {
  const selectedMatch = props.selectedCandidate?.existingRecordMatches.find((m) => m.id === props.selectedMatchId) ?? props.selectedCandidate?.existingRecordMatches[0] ?? null;
  const suggestedActionLabel = props.selectedReviewPlan ? decisionLabel(props.selectedReviewPlan.suggestedDecision) : 'Needs more correction';

  if (!props.selectedCandidate) {
    return <section className="intake-workbench-panel"><div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Select a candidate from the queue to begin resolving intake decisions.</div></section>;
  }

  const c = props.selectedCandidate;
  return (
    <section className="intake-workbench-panel">
      <div className="mb-2 text-sm font-semibold text-slate-900">Candidate workbench</div>
      <p className="mb-2 text-xs text-slate-600">Resolve one candidate at a time: correct blockers, confirm action, then move to the next queue item.</p>
      <div className="space-y-3">
        <div className="intake-guidance-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Candidate summary</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{c.title || 'Untitled candidate'}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
            <span className="rounded bg-slate-100 px-2 py-0.5">{candidateTypeLabel(c.candidateType)}</span>
            <span className="rounded bg-slate-100 px-2 py-0.5">Confidence {Math.round(c.confidence * 100)}%</span>
            <span className="rounded bg-slate-100 px-2 py-0.5">Queue {props.selectedQueueItem?.readiness.replaceAll('_', ' ') || 'manual review'}</span>
          </div>
        </div>

        {props.selectedReviewPlan ? <div className="intake-guidance-card intake-guidance-required">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Required corrections</div>
          {props.selectedReviewPlan.requiredCorrections.length ? <div className="mt-1 space-y-2">{(['missing', 'conflicting', 'weak'] as const).map((status) => {
            const fields = props.requiredCorrectionsByStatus[status];
            if (!fields.length) return null;
            return <div key={status} className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700/90">{correctionBucketLabel(status)}</div>
              {fields.map((field) => {
                const hint = props.selectedActionHints.find((entry) => entry.field.key === field.key);
                return <div key={field.key} className="rounded-md border border-rose-200 bg-white px-2 py-1.5 text-xs text-slate-700"><div className="font-semibold text-slate-900">{field.label}</div><div>{hint?.nextStep || 'Resolve this field before approving.'}</div><div className="text-[11px] text-rose-700">{reviewReasonForField(field.key)}</div></div>;
              })}
            </div>;
          })}</div> : <div className="mt-1 text-xs text-emerald-700">No blocking corrections. Candidate can move to decision.</div>}
        </div> : null}

        {props.selectedReviewPlan ? <div className="intake-guidance-card intake-guidance-next-action">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Suggested next action</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{suggestedActionLabel}</div>
          <div className="mt-1 text-xs text-slate-700">{props.createBlocked ? `Needs more correction before action. ${props.selectedReviewPlan.requiredCorrections.length} blocker(s) remaining.` : props.selectedReviewPlan.suggestedDecisionReason}</div>
          <div className="mt-1 text-[11px] text-slate-600">{recommendedActionDescription(props.selectedReviewPlan.suggestedDecision)}</div>
          {props.suggestedQuickFixes.length ? <div className="mt-2 flex flex-wrap gap-1.5">{props.suggestedQuickFixes.map((action) => <button key={action.id} className={`action-btn !px-2 !py-1 text-[11px] ${action.emphasis === 'primary' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => props.onApplyQuickFix(action)}>{action.label}</button>)}</div> : null}
        </div> : null}

        <div className="intake-guidance-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Editable fields</div>
          <div className="mt-1 grid gap-2 md:grid-cols-2">
            <label className="field-block md:col-span-2"><span className="field-label">Title (required)</span><input className="field-input" value={c.title} onChange={(event) => props.onUpdateCandidate(c.id, { title: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Type</span><select className="field-input" value={c.candidateType} onChange={(event) => props.onUpdateCandidate(c.id, { candidateType: event.target.value as IntakeWorkCandidate['candidateType'] })}><option value="followup">Follow-up</option><option value="task">Task</option><option value="reference">Reference</option><option value="update_existing_followup">Update follow-up</option><option value="update_existing_task">Update task</option></select></label>
            <label className="field-block"><span className="field-label">Project (required)</span><input className="field-input" value={c.project || ''} onChange={(event) => props.onUpdateCandidate(c.id, { project: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Due date</span><input type="date" className="field-input" value={toDateInputValue(c.dueDate)} onChange={(event) => props.onUpdateCandidate(c.id, { dueDate: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Next step</span><input className="field-input" value={c.nextStep || ''} onChange={(event) => props.onUpdateCandidate(c.id, { nextStep: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Assignee</span><input className="field-input" value={c.assignee || ''} onChange={(event) => props.onUpdateCandidate(c.id, { assignee: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Owner</span><input className="field-input" value={c.owner || ''} onChange={(event) => props.onUpdateCandidate(c.id, { owner: event.target.value })} /></label>
            <label className="field-block md:col-span-2"><span className="field-label">Summary</span><textarea className="field-textarea" value={c.summary} onChange={(event) => props.onUpdateCandidate(c.id, { summary: event.target.value })} /></label>
          </div>
        </div>

        {(props.safety && (props.safety.requiresLinkReview || c.existingRecordMatches.length > 0)) ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
          <div className="mb-1 font-semibold">Link / duplicate review</div>
          <div className="space-y-1">{c.existingRecordMatches.map((match) => <button key={match.id} className={`w-full rounded border px-2 py-1 text-left ${selectedMatch?.id === match.id ? 'border-sky-300 bg-white' : 'border-amber-200 bg-amber-100/30'}`} onClick={() => props.onSelectMatchId(match.id)}>{match.recordType} • {match.title} • {Math.round(match.score * 100)}%<div className="text-[11px]">{match.reason}</div></button>)}</div>
        </div> : null}

        <div className="intake-guidance-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Final decision</div>
          <div className="mt-1 flex flex-wrap gap-2">
            <button className={props.selectedReviewPlan && actionIsPrimary('link', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} onClick={() => props.onDecision('link')}><Link2 className="h-4 w-4" />Link existing</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('approve_followup', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} disabled={props.createBlocked} onClick={() => props.onDecision('approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('approve_task', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} disabled={props.createBlocked} onClick={() => props.onDecision('approve_task')}><ClipboardCheck className="h-4 w-4" />Create task</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('reference', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} onClick={() => props.onDecision('reference')}>Save reference</button>
            <button className="action-btn" onClick={() => props.onDecision('reject')}>Dismiss</button>
          </div>
          {props.safety && !props.safety.safeToCreateNew ? <label className="mt-1 flex items-center gap-2 text-xs text-rose-700"><input type="checkbox" checked={props.confirmUnsafeCreate} onChange={(event) => props.onSetConfirmUnsafeCreate(event.target.checked)} />Confirm override: create new despite duplicate risk.</label> : null}
        </div>

        <IntakeEvidencePanel selectedAsset={props.selectedAsset} selectedCandidate={props.selectedCandidate} selectedSourceTab={props.selectedSourceTab} selectedEvidenceLocator={props.selectedEvidenceLocator} onSetTab={props.onSetSourceTab} onSelectLocator={props.onSelectEvidenceLocator} />
      </div>
    </section>
  );
}
