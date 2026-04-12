import { ClipboardCheck, Link2, Mail, ShieldAlert, Sparkles, Files, CheckCircle2, Expand, Minimize2, ArrowRightCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildCandidateMatchCompareRows, type IntakeFieldReviewKey } from '../../lib/intakeEvidence';
import { toDateInputValue } from '../../lib/intakeDates';
import type { IntakeQuickFixAction, IntakeReviewPlan } from '../../lib/intakeReviewPlan';
import type { ImportSafetyResult } from '../../lib/intakeImportSafety';
import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import type { IntakeAssetRecord, IntakeWorkCandidate } from '../../types';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader } from '../ui/AppPrimitives';
import { IntakeEvidencePanel } from './IntakeEvidencePanel';
import { actionIsPrimary, candidateTypeLabel, confidenceBand, correctionBucketLabel, createActionBlockReason, decisionLabel, describeEvidenceFocus, editorTargetLabel, laneDescription, laneLabel, recommendedActionDescription, reviewReasonForField, toEditorTargetForField, triageStateTone, type QueueLane, type SourceTab, type IntakeReviewEditorTarget } from './intakeWorkspaceTypes';

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
  activeLane: QueueLane;
  lanePosition: number;
  laneTotal: number;
  fullReviewOpen: boolean;
  onUpdateCandidate: (id: string, patch: Partial<IntakeWorkCandidate>) => void;
  onDecision: (decision: 'approve_followup' | 'approve_task' | 'reference' | 'reject' | 'link') => void;
  onSetConfirmUnsafeCreate: (value: boolean) => void;
  onApplyQuickFix: (action: IntakeQuickFixAction) => void;
  onSelectMatchId: (id: string | null) => void;
  onSetSourceTab: (tab: SourceTab) => void;
  onSelectEvidenceLocator: (locator: string | null) => void;
  onOpenFullReview: () => void;
  onCloseFullReview: () => void;
}

export function IntakeCandidateWorkbench(props: Props) {
  const selectedMatch = props.selectedCandidate?.existingRecordMatches.find((m) => m.id === props.selectedMatchId) ?? props.selectedCandidate?.existingRecordMatches[0] ?? null;
  const suggestedActionLabel = props.selectedReviewPlan ? decisionLabel(props.selectedReviewPlan.suggestedDecision) : 'Needs more correction';
  const createActionBlockedReason = createActionBlockReason({
    createBlocked: props.createBlocked,
    safeToCreateNew: Boolean(props.safety?.safeToCreateNew),
    confirmUnsafeCreate: props.confirmUnsafeCreate,
  });
  const createActionDisabled = Boolean(createActionBlockedReason);
  const compareRows = useMemo(() => (props.selectedCandidate && selectedMatch ? buildCandidateMatchCompareRows(props.selectedCandidate, selectedMatch) : []), [props.selectedCandidate, selectedMatch]);
  const [activeEditorTarget, setActiveEditorTarget] = useState<IntakeReviewEditorTarget | null>(null);
  const [evidenceFocusLabel, setEvidenceFocusLabel] = useState<string | null>(null);
  const fieldRefs = useRef<Partial<Record<IntakeReviewEditorTarget, HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLDivElement | null>>>({});

  useEffect(() => {
    setActiveEditorTarget(null);
    setEvidenceFocusLabel(null);
  }, [props.selectedCandidate?.id]);

  const focusEditorTarget = (target: IntakeReviewEditorTarget) => {
    setActiveEditorTarget(target);
    const node = fieldRefs.current[target];
    if (!node) return;
    node.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if ('focus' in node) node.focus();
  };

  const focusFieldForCorrection = (fieldKey: IntakeFieldReviewKey, fieldLabel: string, evidenceLocator?: string | null) => {
    const target = toEditorTargetForField(fieldKey);
    focusEditorTarget(target);
    if (evidenceLocator) {
      props.onSetSourceTab('evidence');
      props.onSelectEvidenceLocator(evidenceLocator);
      setEvidenceFocusLabel(describeEvidenceFocus({ fieldLabel, locator: evidenceLocator }));
    }
  };

  if (!props.selectedCandidate) {
    return <section className="intake-workbench-panel">
      <div className="intake-workbench-empty-state">
        <div className="text-sm font-semibold text-slate-900">Ready to resolve the next intake record</div>
        <p className="text-xs text-slate-600">Pick a candidate in the queue. Start with quick triage, then open full review only when deeper correction is needed.</p>
      </div>
    </section>;
  }

  const c = props.selectedCandidate;
  const selectedStateTone = props.selectedQueueItem ? triageStateTone(props.selectedQueueItem) : 'correction';
  const selectedStateLabel = selectedStateTone === 'safe'
    ? 'Safe item'
    : selectedStateTone === 'link'
      ? 'Link review item'
      : selectedStateTone === 'reference'
        ? 'Reference lane item'
        : 'Correction required';
  const blockerCount = props.selectedReviewPlan?.requiredCorrections.length ?? 0;
  const recommendedCount = props.selectedReviewPlan?.recommendedCorrections.length ?? 0;

  return (
    <section className="intake-workbench-panel">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">Selected-item triage</div>
          <p className="text-xs text-slate-600">Glance, decide, continue. Open full review only when this item needs deeper correction.</p>
        </div>
        <button className="action-btn !px-2 !py-1 text-xs" onClick={props.onOpenFullReview}><Expand className="h-3.5 w-3.5" />Open full review</button>
      </div>

      <div className="space-y-3">
        <div className={`intake-guidance-card intake-workbench-summary-card intake-workbench-summary-card-${selectedStateTone}`}>
          <div className="intake-workbench-summary-head">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Selected item</div>
              <div className="mt-1 text-base font-semibold text-slate-900">{c.title || 'Untitled candidate'}</div>
              <div className="mt-1 text-[11px] text-slate-600">Lane: {laneLabel(props.activeLane)} ({props.lanePosition}/{props.laneTotal || 1}) • {laneDescription(props.activeLane)}</div>
            </div>
            <div className={`intake-confidence-pill intake-confidence-pill-${confidenceBand(c.confidence).toLowerCase()}`}>{confidenceBand(c.confidence)} confidence</div>
          </div>
          <div className="mt-2 intake-summary-metadata-grid text-xs text-slate-700">
            <div><span className="text-slate-500">Candidate type:</span> {candidateTypeLabel(c.candidateType)}</div>
            <div><span className="text-slate-500">Review state:</span> {props.selectedQueueItem?.readiness.replaceAll('_', ' ') || 'manual review'}</div>
            <div><span className="text-slate-500">Triage state:</span> {selectedStateLabel}</div>
            <div><span className="text-slate-500">Recommended decision:</span> {suggestedActionLabel}</div>
          </div>
        </div>

        <div className="intake-guidance-card intake-triage-cues-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fast decision cues</div>
          <div className="mt-2 intake-triage-cues-grid text-xs text-slate-700">
            <div className={`intake-triage-cue ${blockerCount > 0 ? 'is-danger' : 'is-safe'}`}>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Blockers</div>
              <div className="font-semibold">{blockerCount > 0 ? `${blockerCount} required correction(s)` : 'No blockers'}</div>
            </div>
            <div className={`intake-triage-cue ${(props.safety?.requiresLinkReview || c.existingRecordMatches.length > 0) ? 'is-warn' : ''}`}>
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Duplicate / link pressure</div>
              <div className="font-semibold">{(props.safety?.requiresLinkReview || c.existingRecordMatches.length > 0) ? `${c.existingRecordMatches.length || 1} potential existing record match(es)` : 'No strong duplicate pressure'}</div>
            </div>
            <div className="intake-triage-cue">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Next action guidance</div>
              <div className="font-semibold">{props.createBlocked ? 'Fix blockers before create-new actions.' : recommendedActionDescription(props.selectedReviewPlan?.suggestedDecision || 'reject')}</div>
            </div>
          </div>
          {props.suggestedQuickFixes.length ? <div className="mt-2 flex flex-wrap gap-1.5">
            {props.suggestedQuickFixes.map((action) => <button key={action.id} className={`action-btn !px-2 !py-1 text-[11px] ${action.emphasis === 'primary' ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => props.onApplyQuickFix(action)}>{action.label}</button>)}
          </div> : null}
          <div className="mt-2 text-[11px] text-slate-600">Need field-level edits, duplicate comparisons, or evidence checks? Use <strong>Open full review</strong>.</div>
        </div>

        <div className="intake-guidance-card intake-decision-bar-card">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Primary actions</div>
          <div className="mt-1 text-xs text-slate-700">Take the fastest safe action here, or open full review when confidence is not high enough.</div>
          <div className="intake-decision-primary-row mt-2">
            <button className={props.selectedReviewPlan && actionIsPrimary('approve_followup', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} disabled={createActionDisabled} onClick={() => props.onDecision('approve_followup')}><Mail className="h-4 w-4" />Create follow-up</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('approve_task', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} disabled={createActionDisabled} onClick={() => props.onDecision('approve_task')}><ClipboardCheck className="h-4 w-4" />Create task</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('link', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} disabled={!c.existingRecordMatches.length} onClick={() => props.onDecision('link')}><Link2 className="h-4 w-4" />Link existing</button>
          </div>
          <div className="intake-decision-secondary-row mt-2">
            <button className={props.selectedReviewPlan && actionIsPrimary('reference', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} onClick={() => props.onDecision('reference')}><Files className="h-4 w-4" />Save reference</button>
            <button className={props.selectedReviewPlan && actionIsPrimary('reject', props.selectedReviewPlan, props.createBlocked) ? 'primary-btn' : 'action-btn'} onClick={() => props.onDecision('reject')}><ShieldAlert className="h-4 w-4" />Dismiss</button>
            <button className="action-btn" onClick={props.onOpenFullReview}><Sparkles className="h-4 w-4" />Review details</button>
          </div>
          {props.safety && !props.safety.safeToCreateNew ? <label className="mt-2 flex items-center gap-2 text-xs text-rose-700"><input type="checkbox" checked={props.confirmUnsafeCreate} onChange={(event) => props.onSetConfirmUnsafeCreate(event.target.checked)} />Allow unsafe create override (duplicate risk acknowledged).</label> : null}
          {createActionBlockedReason ? <div className="mt-2 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] text-rose-700">{createActionBlockedReason}</div> : null}
        </div>
      </div>

      {props.fullReviewOpen ? <AppModal size="wide" onClose={props.onCloseFullReview} onBackdropClick={props.onCloseFullReview} ariaLabel="Intake full review">
        <AppModalHeader
          title={`Full review: ${c.title || 'Untitled candidate'}`}
          subtitle={`Lane ${laneLabel(props.activeLane)} • ${blockerCount} blocker(s) • ${recommendedCount} suggested improvements`}
          onClose={props.onCloseFullReview}
          closeLabel="Back to triage"
        />
        <AppModalBody>
          <div className="space-y-3">
            {props.selectedReviewPlan ? <div className="intake-guidance-card intake-guidance-required">
              <div className="intake-workbench-section-head">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Correction loop</div>
                  <div className="text-xs text-rose-800">{props.selectedReviewPlan.requiredCorrections.length ? `${props.selectedReviewPlan.requiredCorrections.length} blocker(s): resolve each blocker, verify evidence, then decide.` : 'No blockers remain. Decide from the action rail.'}</div>
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
                    const target = toEditorTargetForField(field.key);
                    return <div key={field.key} className={`intake-blocker-row ${activeEditorTarget === target ? 'intake-blocker-row-active' : ''}`}>
                      <div>
                        <div className="font-semibold text-slate-900">{field.label}</div>
                        <div className="text-[11px] text-slate-700">{hint?.nextStep || 'Resolve this field before approving.'}</div>
                        <div className="text-[11px] text-rose-700">Why it matters: {reviewReasonForField(field.key)}</div>
                      </div>
                      <div className="intake-blocker-actions">
                        <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => focusEditorTarget(target)}><ArrowRightCircle className="h-3.5 w-3.5" />Fix {editorTargetLabel(target)}</button>
                        {evidenceLocator ? <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => focusFieldForCorrection(field.key, field.label, evidenceLocator)}>View evidence</button> : null}
                      </div>
                    </div>;
                  })}
                </div>;
              })}</div> : null}
            </div> : null}

            <div className="intake-guidance-card">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Correction editor</div>
              <div className="mt-1 text-xs text-slate-600">Required fields are grouped first for fast blocker cleanup, with supporting fields below.</div>
              <div className="mt-2 intake-correction-editor-layout">
                <div className="intake-correction-main">
                  <div className="intake-editor-group">
                    <div className="intake-editor-group-title">Required for create-new</div>
                    <div className="intake-edit-grid intake-edit-grid-critical">
                      <label className={`field-block intake-edit-field-critical ${activeEditorTarget === 'title' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Title <span className="text-rose-700">required</span></span><input ref={(node) => { fieldRefs.current.title = node; }} className="field-input" value={c.title} onChange={(event) => props.onUpdateCandidate(c.id, { title: event.target.value })} /></label>
                      <label className={`field-block ${activeEditorTarget === 'candidateType' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Type <span className="text-rose-700">required</span></span><select ref={(node) => { fieldRefs.current.candidateType = node; }} className="field-input" value={c.candidateType} onChange={(event) => props.onUpdateCandidate(c.id, { candidateType: event.target.value as IntakeWorkCandidate['candidateType'] })}><option value="followup">Follow-up</option><option value="task">Task</option><option value="reference">Reference</option><option value="update_existing_followup">Update follow-up</option><option value="update_existing_task">Update task</option></select></label>
                      <label className={`field-block ${activeEditorTarget === 'project' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Project <span className="text-rose-700">required</span></span><input ref={(node) => { fieldRefs.current.project = node; }} className="field-input" value={c.project || ''} onChange={(event) => props.onUpdateCandidate(c.id, { project: event.target.value })} /></label>
                      <label className={`field-block ${activeEditorTarget === 'owner' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Owner <span className="text-rose-700">required for clear ownership</span></span><input ref={(node) => { fieldRefs.current.owner = node; }} className="field-input" value={c.owner || ''} onChange={(event) => props.onUpdateCandidate(c.id, { owner: event.target.value })} /></label>
                      <label className={`field-block ${activeEditorTarget === 'dueDate' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Due date <span className="text-rose-700">required for create-new</span></span><input ref={(node) => { fieldRefs.current.dueDate = node; }} type="date" className="field-input" value={toDateInputValue(c.dueDate)} onChange={(event) => props.onUpdateCandidate(c.id, { dueDate: event.target.value })} /></label>
                      <label className={`field-block intake-edit-field-critical ${activeEditorTarget === 'nextStep' ? 'intake-edit-field-active' : ''}`}><span className="field-label">Next step</span><input ref={(node) => { fieldRefs.current.nextStep = node; }} className="field-input" value={c.nextStep || ''} onChange={(event) => props.onUpdateCandidate(c.id, { nextStep: event.target.value })} /></label>
                    </div>
                  </div>

                  {(props.safety && (props.safety.requiresLinkReview || c.existingRecordMatches.length > 0)) ? <div className={`intake-editor-group intake-duplicate-review-card ${activeEditorTarget === 'duplicateReview' ? 'intake-edit-field-active' : ''}`}>
                    <div ref={(node) => { fieldRefs.current.duplicateReview = node; }} className="intake-workbench-section-head">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-800">Link / duplicate decision</div>
                        <div className="text-xs text-amber-900">Compare before deciding create-new. Selected match stays wired to the final decision action.</div>
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

                  <div className="intake-editor-group">
                    <div className="intake-editor-group-title">Supporting detail</div>
                    <div className="intake-edit-grid">
                      <label className="field-block"><span className="field-label">Assignee</span><input className="field-input" value={c.assignee || ''} onChange={(event) => props.onUpdateCandidate(c.id, { assignee: event.target.value })} /></label>
                      <label className="field-block intake-edit-field-summary"><span className="field-label">Summary</span><textarea className="field-textarea" value={c.summary} onChange={(event) => props.onUpdateCandidate(c.id, { summary: event.target.value })} /></label>
                    </div>
                  </div>
                </div>

                <div className="intake-correction-sidecar">
                  <div className="intake-guidance-card">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Evidence inspector</div>
                      <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => {
                        props.onSetSourceTab('overview');
                        setEvidenceFocusLabel(null);
                      }}><Minimize2 className="h-3.5 w-3.5" />Reset</button>
                    </div>
                    <div className="mt-2"><IntakeEvidencePanel selectedAsset={props.selectedAsset} selectedCandidate={props.selectedCandidate} selectedSourceTab={props.selectedSourceTab} selectedEvidenceLocator={props.selectedEvidenceLocator} evidenceFocusLabel={evidenceFocusLabel} onSetTab={props.onSetSourceTab} onSelectLocator={props.onSelectEvidenceLocator} /></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="intake-full-review-action-rail">
              <div className="text-xs text-slate-700">{createActionBlockedReason ?? 'No create blockers. Choose the final decision path.'}</div>
              <div className="intake-decision-primary-row">
                <button className="action-btn" onClick={() => props.onDecision('reference')}><Files className="h-4 w-4" />Save reference</button>
                <button className="action-btn" onClick={() => props.onDecision('link')} disabled={!c.existingRecordMatches.length}><Link2 className="h-4 w-4" />Link existing</button>
                <button className="primary-btn" onClick={() => props.onDecision('approve_followup')} disabled={createActionDisabled}><Mail className="h-4 w-4" />Create follow-up</button>
                <button className="primary-btn" onClick={() => props.onDecision('approve_task')} disabled={createActionDisabled}><ClipboardCheck className="h-4 w-4" />Create task</button>
              </div>
            </div>
          </div>
        </AppModalBody>
        <AppModalFooter>
          <div className="flex w-full items-center justify-between gap-2">
            <div className="text-xs text-slate-600">Back to triage when done, or decide directly from the action rail.</div>
            <button className="action-btn" onClick={props.onCloseFullReview}>Close full review</button>
          </div>
        </AppModalFooter>
      </AppModal> : null}
    </section>
  );
}
