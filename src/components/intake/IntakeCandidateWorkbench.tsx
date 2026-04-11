import { ClipboardCheck, Link2, Mail, ArrowRight, ShieldAlert, Sparkles, Files, CheckCircle2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { buildCandidateMatchCompareRows } from '../../lib/intakeEvidence';
import { toDateInputValue } from '../../lib/intakeDates';
import type { IntakeQuickFixAction, IntakeReviewPlan } from '../../lib/intakeReviewPlan';
import type { ImportSafetyResult } from '../../lib/intakeImportSafety';
import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../../types';
import { IntakeEvidencePanel } from './IntakeEvidencePanel';
import { candidateTypeLabel, confidenceBand, correctionBucketLabel, decisionLabel, recommendedActionDescription, reviewReasonForField, type SourceTab } from './intakeWorkspaceTypes';

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
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const selectedMatch = props.selectedCandidate?.existingRecordMatches.find((m) => m.id === props.selectedMatchId) ?? props.selectedCandidate?.existingRecordMatches[0] ?? null;
  const suggestedActionLabel = props.selectedReviewPlan ? decisionLabel(props.selectedReviewPlan.suggestedDecision) : 'Needs more correction';

  const compareRows = useMemo(() => (props.selectedCandidate && selectedMatch ? buildCandidateMatchCompareRows(props.selectedCandidate, selectedMatch) : []), [props.selectedCandidate, selectedMatch]);

  if (!props.selectedCandidate) {
    return <section className="intake-workbench-panel">
      <div className="intake-workbench-empty-state">
        <div className="text-sm font-semibold text-slate-900">Ready to resolve the next intake record</div>
        <p className="text-xs text-slate-600">Pick a candidate in the queue. You will review blockers, confirm a decision, and then continue automatically to the next record in this lane.</p>
      </div>
    </section>;
  }

  const c = props.selectedCandidate;
  return (
    <section className="intake-workbench-panel">
      <div className="mb-2 text-sm font-semibold text-slate-900">Candidate workbench</div>
      <p className="mb-2 text-xs text-slate-600">Resolve this record from top to bottom: orient, fix blockers, verify duplicate risk, then finalize one decision.</p>
      <div className="space-y-3">
        <div className="intake-guidance-card intake-workbench-summary-card">
          <div className="intake-workbench-summary-head">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected item</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{c.title || 'Untitled candidate'}</div>
            </div>
            <div className={`intake-confidence-pill intake-confidence-pill-${confidenceBand(c.confidence).toLowerCase()}`}>{confidenceBand(c.confidence)} confidence</div>
          </div>
          <div className="mt-2 intake-summary-metadata-grid text-xs text-slate-700">
            <div><span className="text-slate-500">Candidate type:</span> {candidateTypeLabel(c.candidateType)}</div>
            <div><span className="text-slate-500">Review state:</span> {props.selectedQueueItem?.readiness.replaceAll('_', ' ') || 'manual review'}</div>
            <div><span className="text-slate-500">Project:</span> {c.project || 'Missing'}</div>
            <div><span className="text-slate-500">Owner:</span> {c.owner || c.assignee || 'Missing'}</div>
          </div>
        </div>

        {props.selectedReviewPlan ? <div className="intake-guidance-card intake-guidance-required">
          <div className="intake-workbench-section-head">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Required before create</div>
              <div className="text-xs text-rose-800">{props.selectedReviewPlan.requiredCorrections.length ? `${props.selectedReviewPlan.requiredCorrections.length} blocker(s) must be resolved.` : 'No blockers remain. Create actions are available.'}</div>
            </div>
            {!props.selectedReviewPlan.requiredCorrections.length ? <span className="intake-ready-chip"><CheckCircle2 className="h-3.5 w-3.5" />Ready to decide</span> : null}
          </div>

          {props.selectedReviewPlan.requiredCorrections.length ? <div className="mt-2 space-y-2">{(['missing', 'conflicting', 'weak'] as const).map((status) => {
            const fields = props.requiredCorrectionsByStatus[status];
            if (!fields.length) return null;
            return <div key={status} className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700/90">{correctionBucketLabel(status)}</div>
              {fields.map((field) => {
                const hint = props.selectedActionHints.find((entry) => entry.field.key === field.key);
                const evidenceLocator = field.sourceRefs[0]?.locator || field.sourceRefs[0]?.sourceRef || null;
                return <div key={field.key} className="intake-blocker-row">
                  <div>
                    <div className="font-semibold text-slate-900">{field.label}</div>
                    <div className="text-[11px] text-slate-700">{hint?.nextStep || 'Resolve this field before approving.'}</div>
                    <div className="text-[11px] text-rose-700">Why it matters: {reviewReasonForField(field.key)}</div>
                  </div>
                  {evidenceLocator ? <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => {
                    setEvidenceOpen(true);
                    props.onSetSourceTab('evidence');
                    props.onSelectEvidenceLocator(evidenceLocator);
                  }}>View evidence</button> : null}
                </div>;
              })}
            </div>;
          })}</div> : null}
        </div> : null}

        {props.selectedReviewPlan?.recommendedCorrections.length ? <div className="intake-guidance-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recommended improvements</div>
          <div className="mt-1 text-xs text-slate-600">Helpful quality improvements after blockers are resolved.</div>
          <div className="mt-1 flex flex-wrap gap-1.5">{props.selectedReviewPlan.recommendedCorrections.slice(0, 4).map((field) => <span key={field.key} className="rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{field.label}</span>)}</div>
        </div> : null}

        {props.selectedReviewPlan ? <div className="intake-guidance-card intake-guidance-next-action">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700">Recommended decision</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{suggestedActionLabel}</div>
          <div className="mt-1 text-xs text-slate-700">{props.createBlocked ? `Blocked until required corrections are complete. ${props.selectedReviewPlan.requiredCorrections.length} blocker(s) remaining.` : props.selectedReviewPlan.suggestedDecisionReason}</div>
          <div className="mt-1 text-[11px] text-slate-600">{recommendedActionDescription(props.selectedReviewPlan.suggestedDecision)}</div>
          {props.suggestedQuickFixes.length ? <div className="mt-2 flex flex-wrap gap-1.5">{props.suggestedQuickFixes.map((action) => <button key={action.id} className={`action-btn !px-2 !py-1 text-[11px] ${action.emphasis === 'primary' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => props.onApplyQuickFix(action)}>{action.label}</button>)}</div> : null}
        </div> : null}

        <div className="intake-guidance-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Complete required fields</div>
          <div className="mt-1 intake-edit-grid">
            <label className="field-block intake-edit-field-critical"><span className="field-label">Title <span className="text-rose-700">required</span></span><input className="field-input" value={c.title} onChange={(event) => props.onUpdateCandidate(c.id, { title: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Type <span className="text-rose-700">required</span></span><select className="field-input" value={c.candidateType} onChange={(event) => props.onUpdateCandidate(c.id, { candidateType: event.target.value as IntakeWorkCandidate['candidateType'] })}><option value="followup">Follow-up</option><option value="task">Task</option><option value="reference">Reference</option><option value="update_existing_followup">Update follow-up</option><option value="update_existing_task">Update task</option></select></label>
            <label className="field-block"><span className="field-label">Project <span className="text-rose-700">required</span></span><input className="field-input" value={c.project || ''} onChange={(event) => props.onUpdateCandidate(c.id, { project: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Owner <span className="text-rose-700">required for clear ownership</span></span><input className="field-input" value={c.owner || ''} onChange={(event) => props.onUpdateCandidate(c.id, { owner: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Due date</span><input type="date" className="field-input" value={toDateInputValue(c.dueDate)} onChange={(event) => props.onUpdateCandidate(c.id, { dueDate: event.target.value })} /></label>
            <label className="field-block intake-edit-field-critical"><span className="field-label">Next step</span><input className="field-input" value={c.nextStep || ''} onChange={(event) => props.onUpdateCandidate(c.id, { nextStep: event.target.value })} /></label>
            <label className="field-block"><span className="field-label">Assignee</span><input className="field-input" value={c.assignee || ''} onChange={(event) => props.onUpdateCandidate(c.id, { assignee: event.target.value })} /></label>
            <label className="field-block intake-edit-field-summary"><span className="field-label">Summary</span><textarea className="field-textarea" value={c.summary} onChange={(event) => props.onUpdateCandidate(c.id, { summary: event.target.value })} /></label>
          </div>
        </div>

        {(props.safety && (props.safety.requiresLinkReview || c.existingRecordMatches.length > 0)) ? <div className="intake-guidance-card intake-duplicate-review-card">
          <div className="intake-workbench-section-head">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Link / duplicate decision</div>
              <div className="text-xs text-amber-900">Link if this is the same active record. Create new only when this is clearly distinct work.</div>
            </div>
            {props.duplicateGroup.length > 1 ? <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] text-amber-900">{props.duplicateGroup.length} items in group</span> : null}
          </div>
          <div className="mt-2 space-y-1">{c.existingRecordMatches.map((match) => <button key={match.id} className={`w-full rounded border px-2 py-1 text-left ${selectedMatch?.id === match.id ? 'border-sky-300 bg-white' : 'border-amber-200 bg-amber-50'}`} onClick={() => props.onSelectMatchId(match.id)}>
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold text-slate-900">{match.recordType} • {match.title}</div>
              <div className="text-[11px] text-slate-700">{Math.round(match.score * 100)}% match</div>
            </div>
            <div className="text-[11px] text-slate-700">{match.reason}</div>
          </button>)}</div>
          {compareRows.length ? <div className="intake-match-compare-grid mt-2">{compareRows.slice(0, 5).map((row) => <div key={row.field} className="intake-match-compare-row">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.label}</div>
            <div className="text-[11px] text-slate-700">Candidate: {row.candidateValue}</div>
            <div className="text-[11px] text-slate-700">Existing: {row.existingValue}</div>
          </div>)}</div> : null}
          {selectedMatch ? <div className="mt-2 text-[11px] text-slate-700">Selected link target: <strong>{selectedMatch.recordType} {selectedMatch.id}</strong></div> : null}
        </div> : null}

        <div className="intake-guidance-card intake-decision-bar-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Finalize decision</div>
          <div className="mt-1 text-xs text-slate-700">Primary action reflects recommendation. After action, workbench advances to the next candidate in this lane.</div>
          <div className="intake-decision-primary-row mt-2">
            <button className="primary-btn" disabled={props.createBlocked} onClick={() => props.onDecision('approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
            <button className="action-btn" disabled={props.createBlocked} onClick={() => props.onDecision('approve_task')}><ClipboardCheck className="h-4 w-4" />Create task</button>
            <button className="action-btn" onClick={() => props.onDecision('link')}><Link2 className="h-4 w-4" />Link existing</button>
          </div>
          <div className="intake-decision-secondary-row mt-2">
            <button className="action-btn" onClick={() => props.onDecision('reference')}><Files className="h-4 w-4" />Save reference</button>
            <button className="action-btn" onClick={() => props.onDecision('reject')}><ShieldAlert className="h-4 w-4" />Dismiss</button>
          </div>
          {props.safety && !props.safety.safeToCreateNew ? <label className="mt-2 flex items-center gap-2 text-xs text-rose-700"><input type="checkbox" checked={props.confirmUnsafeCreate} onChange={(event) => props.onSetConfirmUnsafeCreate(event.target.checked)} />Allow unsafe create override (duplicate risk acknowledged).</label> : null}
          {props.createBlocked ? <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">Create-new actions are disabled until blockers are corrected.</div> : null}
        </div>

        <div className="intake-guidance-card">
          <button className="intake-evidence-toggle" onClick={() => setEvidenceOpen((v) => !v)}>
            <span className="inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5" />Evidence inspector</span>
            <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">{evidenceOpen ? 'Hide' : 'Open'} <ArrowRight className="h-3 w-3" /></span>
          </button>
          {evidenceOpen ? <div className="mt-2"><IntakeEvidencePanel selectedAsset={props.selectedAsset} selectedCandidate={props.selectedCandidate} selectedSourceTab={props.selectedSourceTab} selectedEvidenceLocator={props.selectedEvidenceLocator} onSetTab={props.onSetSourceTab} onSelectLocator={props.onSelectEvidenceLocator} /></div> : <div className="mt-1 text-xs text-slate-500">Open when a blocker or duplicate question needs source verification.</div>}
        </div>
      </div>
    </section>
  );
}
