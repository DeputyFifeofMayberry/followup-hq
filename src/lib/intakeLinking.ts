import type { FollowUpItem, IntakeWorkCandidate, TaskItem } from '../types';
import { buildTouchEvent, todayIso } from './utils';

export function enrichFollowUpFromIntakeLink(item: FollowUpItem, candidate: IntakeWorkCandidate): FollowUpItem {
  const sourceRef = `Intake asset ${candidate.assetId} (batch ${candidate.batchId})`;
  return {
    ...item,
    sourceRefs: [...new Set([...(item.sourceRefs ?? []), sourceRef])],
    timeline: [buildTouchEvent(`Linked intake candidate "${candidate.title}" from ${sourceRef}.`, 'imported'), ...item.timeline],
    notes: `${item.notes || ''}${item.notes ? '\n\n' : ''}[Intake link] ${candidate.summary.slice(0, 280)}`.trim(),
  };
}

export function enrichTaskFromIntakeLink(task: TaskItem, candidate: IntakeWorkCandidate): TaskItem {
  const sourceRef = `Intake asset ${candidate.assetId} (batch ${candidate.batchId})`;
  return {
    ...task,
    contextNote: `${task.contextNote || ''}${task.contextNote ? '\n' : ''}[Intake link] ${candidate.summary.slice(0, 220)}`.trim(),
    notes: `${task.notes || ''}${task.notes ? '\n\n' : ''}[Intake provenance] ${sourceRef}`.trim(),
    provenance: task.provenance?.sourceType === 'intake' ? task.provenance : { ...(task.provenance ?? { capturedAt: todayIso(), sourceType: 'intake' as const }), sourceType: 'intake', sourceRef, sourceBatchId: candidate.batchId },
  };
}
