import { AlertTriangle, CheckCircle2, Link2, PencilLine, Sparkles, Workflow, XCircle } from 'lucide-react';
import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import { candidateTypeLabel, confidenceBand, laneDescription, laneLabel, recommendedActionCue, triageStateTone, type QueueLane } from './intakeWorkspaceTypes';

type QueueQuickAction = 'open' | 'quick_create_followup' | 'quick_create_task' | 'quick_save_reference' | 'review_link';

interface Props {
  activeLane: QueueLane;
  byLane: Record<QueueLane, IntakeQueueItem[]>;
  laneCounts: Record<QueueLane, number>;
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  onSetLane: (lane: QueueLane) => void;
  onQuickAction: (id: string, action: QueueQuickAction) => void;
}

const laneOrder: QueueLane[] = ['needs_correction', 'link_duplicate_review', 'ready_to_create', 'reference_only'];

function defaultQuickAction(item: IntakeQueueItem): { action: QueueQuickAction; label: string } {
  if (item.readiness === 'ready_to_approve' && item.batchSafe) {
    if (item.candidateType === 'task') return { action: 'quick_create_task', label: 'Quick create task' };
    return { action: 'quick_create_followup', label: 'Quick create follow-up' };
  }
  if (item.readiness === 'reference_likely' && item.recommendedAction === 'save_reference') {
    return { action: 'quick_save_reference', label: 'Quick save reference' };
  }
  if (item.readiness === 'needs_link_decision') return { action: 'review_link', label: 'Review link options' };
  return { action: 'open', label: 'Open full review' };
}

export function IntakeQueuePanel({ activeLane, byLane, laneCounts, selectedCandidateId, onSelectCandidate, onSetLane, onQuickAction }: Props) {
  const visible = byLane[activeLane];
  const activeLaneCount = laneCounts[activeLane];
  return (
    <section className="intake-lane-panel">
      <div className="mb-2 text-sm font-semibold text-slate-900">Review queue</div>
      <p className="mb-2 text-xs text-slate-600">Work top-down by action lane. The selected lane groups records by what you should do next.</p>
      <div className="mb-2 intake-lane-tabs">{laneOrder.map((lane) => <button key={lane} className={`action-btn intake-lane-tab intake-lane-tab-ops !px-2 !py-1 text-xs ${activeLane === lane ? 'is-active' : ''}`} onClick={() => onSetLane(lane)}>
        <span className="intake-lane-tab-title">{laneLabel(lane)} • {laneCounts[lane]}</span>
        <span className="intake-lane-tab-subtitle">{laneDescription(lane)}</span>
      </button>)}</div>
      <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Current view</div>
        <div className="text-sm font-semibold text-slate-900">{laneLabel(activeLane)} ({activeLaneCount})</div>
        <div className="text-[11px] text-slate-600">{laneDescription(activeLane)}</div>
      </div>
      <div className="space-y-2 max-h-[65vh] overflow-auto">{visible.map((queueItem) => {
        const blockerCount = queueItem.missingCriticalFields + (queueItem.conflictingEvidence ? 1 : 0);
        const stateTone = triageStateTone(queueItem);
        const quickAction = defaultQuickAction(queueItem);
        return <div key={queueItem.id} className={`intake-queue-row intake-queue-row-${stateTone} ${selectedCandidateId === queueItem.id ? 'is-selected' : ''}`}>
          <button className="w-full text-left" onClick={() => onSelectCandidate(queueItem.id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-semibold text-slate-900 line-clamp-2">{queueItem.title || 'Untitled candidate'}</div>
              <span className={`intake-queue-ready-pill ${queueItem.batchSafe ? 'is-safe' : ''}`}>{queueItem.batchSafe ? 'Safe now' : 'Needs review'}</span>
            </div>
            <div className="mt-1 text-[11px] text-slate-600">{candidateTypeLabel(queueItem.candidateType)} • Confidence {confidenceBand(queueItem.confidence)} ({Math.round(queueItem.confidence * 100)}%) • Source {queueItem.sourceType || 'unknown'}</div>
            <div className="mt-1.5 intake-queue-signal-grid text-[11px]">
              <div><span className="text-slate-500">Decision cue:</span> {recommendedActionCue(queueItem.recommendedAction)}</div>
              <div><span className="text-slate-500">Next step:</span> {queueItem.nextStepHint}</div>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
              <span className={`rounded px-2 py-0.5 ${blockerCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>{blockerCount > 0 ? `Blockers ${blockerCount}` : 'No blockers'}</span>
              <span className={`rounded px-2 py-0.5 ${queueItem.duplicateRisk ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>{queueItem.duplicateRisk ? 'Duplicate/link pressure' : 'No duplicate pressure'}</span>
              {queueItem.readiness === 'unsafe_to_create' ? <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700"><AlertTriangle className="mr-1 inline h-3 w-3" />Unsafe until corrected</span> : null}
              {queueItem.readiness === 'needs_link_decision' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800"><XCircle className="mr-1 inline h-3 w-3" />Link decision required</span> : null}
              {queueItem.readiness === 'reference_likely' ? <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-700"><Sparkles className="mr-1 inline h-3 w-3" />Reference likely</span> : null}
              {queueItem.readiness === 'ready_to_approve' && queueItem.batchSafe ? <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700"><CheckCircle2 className="mr-1 inline h-3 w-3" />Batch-safe</span> : null}
            </div>
          </button>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button className="action-btn !px-2 !py-1 text-[11px]" onClick={() => onQuickAction(queueItem.id, 'open')}><PencilLine className="h-3 w-3" />Full review</button>
            {quickAction.action !== 'open' ? <button className="action-btn !px-2 !py-1 text-[11px] !border-sky-300 !bg-sky-50 !text-sky-700" onClick={() => onQuickAction(queueItem.id, quickAction.action)}>
              {quickAction.action === 'review_link' ? <Link2 className="h-3 w-3" /> : <Workflow className="h-3 w-3" />}
              {quickAction.label}
            </button> : null}
          </div>
        </div>;
      })}
      {!visible.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">This lane is clear. Switch lanes or ingest more sources to continue review.</div> : null}
      </div>
    </section>
  );
}
