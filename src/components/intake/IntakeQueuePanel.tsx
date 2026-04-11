import { TriangleAlert, XCircle } from 'lucide-react';
import type { IntakeQueueItem } from '../../lib/intakeReviewQueue';
import type { IntakeWorkCandidate } from '../../types';
import { candidateTypeLabel, confidenceBand, laneLabel, type QueueLane } from './intakeWorkspaceTypes';

interface Props {
  activeLane: QueueLane;
  byLane: Record<QueueLane, IntakeWorkCandidate[]>;
  queue: IntakeQueueItem[];
  selectedCandidateId: string | null;
  onSelectCandidate: (id: string) => void;
  onSetLane: (lane: QueueLane) => void;
}

export function IntakeQueuePanel({ activeLane, byLane, queue, selectedCandidateId, onSelectCandidate, onSetLane }: Props) {
  const visible = byLane[activeLane];
  return (
    <section className="intake-lane-panel">
      <div className="mb-2 text-sm font-semibold text-slate-900">Review queue</div>
      <p className="mb-2 text-xs text-slate-600">Start here. Pick one candidate, resolve it, then continue down the lane.</p>
      <div className="mb-2 intake-lane-tabs">{(['needs_correction', 'link_duplicate_review', 'ready_to_create', 'reference_only'] as QueueLane[]).map((lane) => <button key={lane} className={`action-btn intake-lane-tab !px-2 !py-1 text-xs ${activeLane === lane ? '!border-sky-300 !bg-sky-50 !text-sky-700' : ''}`} onClick={() => onSetLane(lane)}>{laneLabel(lane)} • {byLane[lane].length}</button>)}</div>
      <div className="space-y-2 max-h-[65vh] overflow-auto">{visible.map((candidate) => {
        const queueItem = queue.find((entry) => entry.id === candidate.id);
        const blockerCount = queueItem?.missingCriticalFields ?? 0;
        return <button key={candidate.id} className={`w-full rounded-xl border p-3 text-left ${selectedCandidateId === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200 bg-white'}`} onClick={() => onSelectCandidate(candidate.id)}>
          <div className="text-sm font-semibold text-slate-900 line-clamp-2">{candidate.title || 'Untitled candidate'}</div>
          <div className="mt-1 text-[11px] text-slate-600">{candidateTypeLabel(candidate.candidateType)} • Confidence {confidenceBand(candidate.confidence)} ({Math.round(candidate.confidence * 100)}%) • Source {queueItem?.sourceType || 'unknown'}</div>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[11px]">
            <span className="rounded bg-slate-100 px-2 py-0.5">Blockers {blockerCount}</span>
            <span className={`rounded px-2 py-0.5 ${queueItem?.duplicateRisk ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}>{queueItem?.duplicateRisk ? 'Duplicate/link risk' : 'No duplicate pressure'}</span>
            {queueItem?.readiness === 'unsafe_to_create' ? <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700"><TriangleAlert className="mr-1 inline h-3 w-3" />Unsafe until corrected</span> : null}
            {queueItem?.readiness === 'needs_link_decision' ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800"><XCircle className="mr-1 inline h-3 w-3" />Link decision required</span> : null}
          </div>
        </button>;
      })}
      {!visible.length ? <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">This lane is clear. Switch lanes or ingest more sources to continue review.</div> : null}
      </div>
    </section>
  );
}
