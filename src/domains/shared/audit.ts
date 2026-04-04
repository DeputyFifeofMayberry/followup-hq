import { createId, todayIso } from '../../lib/utils';
import type { AuditEntry, IntakeReviewerFeedback } from '../../types';

export function makeAuditEntry(input: Omit<AuditEntry, 'id' | 'at'>): AuditEntry {
  return { id: createId('AUD'), at: todayIso(), ...input };
}

export function appendReviewerFeedback(existing: IntakeReviewerFeedback[], feedback: Omit<IntakeReviewerFeedback, 'id' | 'createdAt'>): IntakeReviewerFeedback[] {
  return [{ ...feedback, id: createId('IRF'), createdAt: todayIso() }, ...existing].slice(0, 800);
}
