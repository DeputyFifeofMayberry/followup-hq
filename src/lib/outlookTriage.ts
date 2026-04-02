import type {
  FollowUpItem,
  OutlookAutomationAuditEntry,
  OutlookIngestionLedgerEntry,
  OutlookMessage,
  OutlookTriageCandidate,
  OutlookTriageDecision,
  OutlookTriageRule,
  TaskItem,
} from '../types';
import { buildPairKey } from './duplicateDetection';
import { messageMatchesRule } from './outlookRules';
import { evaluateSignals } from './outlookSignals';
import { addDaysIso, createId, todayIso } from './utils';

export interface TriageContext {
  rules: OutlookTriageRule[];
  ledger: OutlookIngestionLedgerEntry[];
  items: FollowUpItem[];
  tasks: TaskItem[];
  existingCandidates: OutlookTriageCandidate[];
  internalDomains: string[];
  noReplyAfterSentByConversation: Record<string, { noReply: boolean; noReplyDays: number }>;
}

export interface TriageOutput {
  decision: OutlookTriageDecision;
  confidence: number;
  suggestedType: 'task' | 'follow-up';
  reasons: string[];
  blockingReasons: string[];
  duplicateInfo: string[];
  matchedRuleIds: string[];
}

export function buildMessageSignature(message: OutlookMessage): string {
  return [
    message.subject.trim().toLowerCase(),
    message.bodyPreview.trim().toLowerCase().slice(0, 160),
    message.folder,
    message.flagStatus ?? '',
    message.importance,
    message.categories.join('|').toLowerCase(),
    message.receivedDateTime ?? '',
    message.sentDateTime ?? '',
  ].join('::');
}

function computeConfidence(positiveCount: number, negativeCount: number, hasProjectMatch: boolean): number {
  let score = 50 + positiveCount * 12 - negativeCount * 10 + (hasProjectMatch ? 8 : -6);
  if (score > 100) score = 100;
  if (score < 0) score = 0;
  return score;
}

function hasOpenThreadConflict(message: OutlookMessage, items: FollowUpItem[]): boolean {
  return items.some((item) => item.status !== 'Closed' && item.threadKey && message.conversationId && item.threadKey === message.conversationId);
}

function hasOpenTaskConflict(message: OutlookMessage, tasks: TaskItem[]): boolean {
  return tasks.some((task) => task.status !== 'Done' && task.title.toLowerCase() === message.subject.toLowerCase());
}

export function evaluateOutlookMessage(message: OutlookMessage, context: TriageContext): TriageOutput {
  const ledgerEntry = context.ledger.find((entry) => entry.messageId === message.id);
  const noReplyContext = context.noReplyAfterSentByConversation[message.conversationId ?? ''] ?? { noReply: false, noReplyDays: 0 };
  const signals = evaluateSignals(message, { internalDomains: context.internalDomains, noReplyAfterSent: noReplyContext.noReply, noReplyDays: noReplyContext.noReplyDays });
  const duplicateInfo: string[] = [];
  const blockingReasons = [...signals.hardBlocks];
  const reasons = [...signals.positive, ...signals.negative];

  if (ledgerEntry?.linkedFollowUpId || ledgerEntry?.linkedTaskId) {
    blockingReasons.push('Blocked: already linked by ingestion ledger');
  }

  if (hasOpenThreadConflict(message, context.items)) {
    blockingReasons.push('Blocked: existing open follow-up on same conversationId');
    duplicateInfo.push('Open thread conflict with existing follow-up');
  }
  if (hasOpenTaskConflict(message, context.tasks)) {
    blockingReasons.push('Blocked: existing open task with similar subject');
    duplicateInfo.push('Open task conflict by subject');
  }

  const confidenceBase = computeConfidence(signals.positive.length, signals.negative.length, signals.hasProjectMatch);
  let confidence = confidenceBase;

  const matchedRules = context.rules
    .filter((rule) => messageMatchesRule(message, rule, {
      confidence,
      hasProjectMatch: signals.hasProjectMatch,
      noReplyAfterSent: noReplyContext.noReply,
      internalDomains: context.internalDomains,
    }))
    .sort((a, b) => a.priority - b.priority);

  matchedRules.forEach((rule) => {
    if (rule.action === 'boost-confidence') confidence += rule.confidenceBoost ?? 10;
    if (rule.action === 'block-auto-create') blockingReasons.push(`Blocked by rule: ${rule.name}`);
  });

  const hardRule = matchedRules.find((rule) => ['ignore', 'review-task', 'review-follow-up', 'auto-task', 'auto-follow-up'].includes(rule.action));
  const allowAuto = !blockingReasons.length;

  let decision: OutlookTriageDecision = 'ignore';
  let suggestedType: 'task' | 'follow-up' = signals.suggestedType;

  if (hardRule?.action === 'ignore') {
    decision = 'ignore';
    reasons.push(`Decision: ignored by explicit rule ${hardRule.name}`);
  } else if (hardRule?.action === 'review-task') {
    decision = 'review';
    suggestedType = 'task';
  } else if (hardRule?.action === 'review-follow-up') {
    decision = 'review';
    suggestedType = 'follow-up';
  } else if (hardRule?.action === 'auto-task') {
    decision = allowAuto && confidence >= 90 ? 'auto-task' : 'review';
    suggestedType = 'task';
  } else if (hardRule?.action === 'auto-follow-up') {
    decision = allowAuto && confidence >= 90 ? 'auto-follow-up' : 'review';
    suggestedType = 'follow-up';
  } else {
    if (confidence >= 90 && allowAuto) {
      decision = suggestedType === 'task' ? 'auto-task' : 'auto-follow-up';
    } else if (confidence >= 60) {
      decision = 'review';
    } else {
      decision = 'ignore';
    }
  }

  if (blockingReasons.length && decision.startsWith('auto')) decision = 'review';

  if (message.folder === 'sentitems' && suggestedType === 'follow-up') {
    if (!noReplyContext.noReply || noReplyContext.noReplyDays < 3) {
      blockingReasons.push('Blocked: sent follow-up wait threshold not met');
      if (decision === 'auto-follow-up') decision = 'review';
    }
  }

  reasons.push(`Decision: ${decision}, confidence ${Math.round(confidence)}`);

  return {
    decision: blockingReasons.length && decision === 'ignore' ? 'blocked' : decision,
    confidence: Math.max(0, Math.min(100, Math.round(confidence))),
    suggestedType,
    reasons,
    blockingReasons,
    duplicateInfo,
    matchedRuleIds: matchedRules.map((rule) => rule.id),
  };
}

export function upsertLedgerEntry(ledger: OutlookIngestionLedgerEntry[], message: OutlookMessage, output: TriageOutput, patch: { linkedTaskId?: string; linkedFollowUpId?: string } = {}): OutlookIngestionLedgerEntry[] {
  const next: OutlookIngestionLedgerEntry = {
    id: `led-${message.id}`,
    messageId: message.id,
    internetMessageId: message.internetMessageId,
    conversationId: message.conversationId,
    folder: message.folder,
    messageSignature: buildMessageSignature(message),
    triageResult: output.decision,
    linkedFollowUpId: patch.linkedFollowUpId,
    linkedTaskId: patch.linkedTaskId,
    lastEvaluatedAt: todayIso(),
    lastDecisionReason: output.reasons.at(-1) ?? 'No reason captured',
  };
  return [...ledger.filter((entry) => entry.messageId !== message.id), next];
}

export function buildCandidate(message: OutlookMessage, output: TriageOutput): OutlookTriageCandidate {
  return {
    id: createId('OTC'),
    messageId: message.id,
    internetMessageId: message.internetMessageId,
    conversationId: message.conversationId,
    sourceMessageIds: [message.id],
    suggestedType: output.suggestedType,
    suggestedProject: output.reasons.find((reason) => reason.includes('project hint'))?.split('project hint ')[1],
    suggestedOwner: 'Jared',
    suggestedPriority: output.confidence >= 85 ? 'High' : 'Medium',
    suggestedDueDate: addDaysIso(todayIso(), output.suggestedType === 'follow-up' ? 2 : 1),
    suggestedWaitingOn: output.suggestedType === 'follow-up' ? message.toRecipients[0] : undefined,
    confidence: output.confidence,
    reasons: output.reasons,
    blockingReasons: output.blockingReasons,
    duplicateInfo: output.duplicateInfo,
    status: 'pending',
    sourceMessageSubject: message.subject,
    sourceMessageFrom: message.from,
    sourceMessageFolder: message.folder,
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}

export function buildAudit(message: OutlookMessage, output: TriageOutput, patch: { taskId?: string; followUpId?: string } = {}): OutlookAutomationAuditEntry {
  return {
    id: createId('OTA'),
    messageId: message.id,
    conversationId: message.conversationId,
    matchedRuleIds: output.matchedRuleIds,
    signalsUsed: output.reasons.filter((reason) => reason.startsWith('Positive:') || reason.startsWith('Negative:') || reason.startsWith('Blocked:')),
    confidence: output.confidence,
    result: output.decision,
    reasons: output.reasons,
    createdTaskId: patch.taskId,
    createdFollowUpId: patch.followUpId,
    createdAt: todayIso(),
  };
}

export function findSimilarRecentCandidate(existing: OutlookTriageCandidate[], message: OutlookMessage): OutlookTriageCandidate | undefined {
  return existing.find((candidate) => candidate.status === 'pending' && ((candidate.conversationId && candidate.conversationId === message.conversationId) || buildPairKey(candidate.sourceMessageSubject.toLowerCase(), message.subject.toLowerCase()) === buildPairKey(candidate.sourceMessageSubject.toLowerCase(), message.subject.toLowerCase())));
}
