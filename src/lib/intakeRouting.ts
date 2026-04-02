import type {
  FollowUpItem,
  ForwardedEmailRecord,
  ForwardedEmailRule,
  ForwardedIngestionLedgerEntry,
  ForwardedIntakeCandidate,
  ForwardedRoutingAuditEntry,
  ForwardedRoutingDecision,
  TaskItem,
} from '../types';
import { matchesForwardedRule } from './intakeRules';
import { addDaysIso, createId, todayIso } from './utils';

export interface ForwardingRoutingContext {
  rules: ForwardedEmailRule[];
  ledger: ForwardedIngestionLedgerEntry[];
  items: FollowUpItem[];
  tasks: TaskItem[];
  candidates: ForwardedIntakeCandidate[];
  internalDomains: string[];
}

export interface ForwardingRoutingResult {
  decision: ForwardedRoutingDecision;
  confidence: number;
  suggestedType: 'task' | 'followup' | 'reference';
  reasons: string[];
  warnings: string[];
  duplicateWarnings: string[];
  ruleIds: string[];
  ruleOwner?: string;
  ruleProject?: string;
  rulePriority?: string;
}

function openConflicts(record: ForwardedEmailRecord, items: FollowUpItem[], tasks: TaskItem[]): string[] {
  const warnings: string[] = [];
  if (items.some((item) => item.status !== 'Closed' && item.title.toLowerCase() === record.originalSubject.toLowerCase())) warnings.push('Open follow-up already exists with same subject');
  if (tasks.some((task) => task.status !== 'Done' && task.title.toLowerCase() === record.originalSubject.toLowerCase())) warnings.push('Open task already exists with same subject');
  return warnings;
}

export function routeForwardedEmail(record: ForwardedEmailRecord, context: ForwardingRoutingContext): ForwardingRoutingResult {
  const reasons: string[] = [];
  const warnings: string[] = [...record.parseWarnings];
  const duplicates: string[] = [];
  const recipientCount = record.originalRecipients.length + record.cc.length;

  if (/noreply|do-not-reply|notification/.test(record.originalSender.toLowerCase())) warnings.push('Blocked: sender matches noreply/system pattern');
  if (/newsletter|unsubscribe|digest|marketing/.test(`${record.originalSubject} ${record.bodyText}`.toLowerCase())) warnings.push('Blocked: newsletter or marketing style content');
  if (!record.bodyText.trim()) warnings.push('Blocked: empty parse body');
  if (context.ledger.some((entry) => entry.dedupeSignature === record.dedupeSignature)) duplicates.push('Duplicate dedupe signature already processed');

  duplicates.push(...openConflicts(record, context.items, context.tasks));

  if (record.parsedCommandHints.type) reasons.push(`Positive: explicit command ${record.parsedCommandHints.type}`);
  if (record.parsedCommandHints.project) reasons.push(`Positive: explicit project ${record.parsedCommandHints.project}`);
  if (record.parsedCommandHints.owner) reasons.push(`Positive: explicit owner ${record.parsedCommandHints.owner}`);
  if (record.parsedCommandHints.dueDate) reasons.push(`Positive: explicit due date ${record.parsedCommandHints.dueDate}`);
  if (record.parsedProjectHints.length) reasons.push(`Positive: parsed project hint ${record.parsedProjectHints[0]}`);
  if (/please|need|action|required|follow up|waiting on/.test(record.bodyText.toLowerCase())) reasons.push('Positive: action language detected');
  if (/fyi|for awareness|no action/.test(record.bodyText.toLowerCase())) reasons.push('Negative: FYI/no-action language');
  if (recipientCount > 10) reasons.push('Negative: broad recipient list');

  let confidence = record.parserConfidence;
  if (record.parsedCommandHints.type) confidence += 20;
  if (record.parsedProjectHints.length) confidence += 8;
  if (/Negative:/.test(reasons.join(' '))) confidence -= 12;
  confidence = Math.max(0, Math.min(100, confidence));

  const matchingRules = context.rules
    .filter((rule) => matchesForwardedRule(rule, record, { recipientCount, internalDomains: context.internalDomains }))
    .sort((a, b) => a.priority - b.priority);

  let suggestedType: 'task' | 'followup' | 'reference' = record.parsedCommandHints.type ?? (/waiting on|reply/.test(record.bodyText.toLowerCase()) ? 'followup' : 'task');
  let decision: ForwardedRoutingDecision = 'reference';
  let autoAllowedByRule = false;
  let blockedAuto = false;
  let ruleOwner: string | undefined;
  let ruleProject: string | undefined;
  let rulePriority: string | undefined;

  for (const rule of matchingRules) {
    if (rule.action === 'ignore') decision = 'ignore';
    if (rule.action === 'review-task') { decision = 'review'; suggestedType = 'task'; }
    if (rule.action === 'review-followup') { decision = 'review'; suggestedType = 'followup'; }
    if (rule.action === 'review-reference') { decision = 'review'; suggestedType = 'reference'; }
    if (rule.action === 'allow-auto-task') { autoAllowedByRule = true; suggestedType = 'task'; }
    if (rule.action === 'allow-auto-followup') { autoAllowedByRule = true; suggestedType = 'followup'; }
    if (rule.action === 'block-auto-create') blockedAuto = true;
    if (rule.action === 'boost-confidence') confidence += rule.confidenceBoost ?? 10;
    if (rule.action === 'set-owner') ruleOwner = rule.value;
    if (rule.action === 'set-project') ruleProject = rule.value;
    if (rule.action === 'set-default-priority') rulePriority = rule.value;
  }

  confidence = Math.max(0, Math.min(100, Math.round(confidence)));

  const canAuto = !warnings.some((w) => w.startsWith('Blocked:')) && duplicates.length === 0 && !blockedAuto && confidence >= 90 && (Boolean(record.parsedCommandHints.type) || autoAllowedByRule);

  if (decision === 'ignore') {
    // keep ignore
  } else if (canAuto) {
    decision = suggestedType === 'followup' ? 'auto-followup' : 'auto-task';
  } else if (confidence >= 60) {
    decision = 'review';
  } else if (confidence >= 35) {
    decision = 'reference';
  } else {
    decision = 'ignore';
  }

  reasons.push(`Decision: ${decision}, confidence ${confidence}`);

  return {
    decision,
    confidence,
    suggestedType,
    reasons,
    warnings,
    duplicateWarnings: duplicates,
    ruleIds: matchingRules.map((r) => r.id),
    ruleOwner,
    ruleProject,
    rulePriority,
  };
}

export function buildForwardedLedgerEntry(record: ForwardedEmailRecord, result: ForwardingRoutingResult, patch: { taskId?: string; followUpId?: string } = {}): ForwardedIngestionLedgerEntry {
  return {
    id: `fwl-${record.id}`,
    forwardedEmailId: record.id,
    dedupeSignature: record.dedupeSignature,
    normalizedSubject: record.normalizedSubject,
    sender: record.originalSender,
    sentAt: record.originalSentAt,
    sourceMessageIds: record.sourceMessageIdentifiers,
    linkedTaskId: patch.taskId,
    linkedFollowUpId: patch.followUpId,
    lastRoutingDecision: result.decision,
    evaluatedAt: todayIso(),
  };
}

export function buildForwardingCandidate(record: ForwardedEmailRecord, result: ForwardingRoutingResult): ForwardedIntakeCandidate {
  return {
    id: createId('FWC'),
    forwardedEmailId: record.id,
    normalizedSubject: record.normalizedSubject,
    originalSender: record.originalSender,
    forwardingAlias: record.forwardingAlias,
    parsedProject: record.parsedCommandHints.project ?? record.parsedProjectHints[0],
    suggestedType: result.suggestedType,
    confidence: result.confidence,
    reasons: result.reasons,
    warnings: result.warnings,
    duplicateWarnings: result.duplicateWarnings,
    parsedCommands: record.parsedCommandHints.tags,
    parseQuality: record.parseQuality,
    status: 'pending',
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}

export function buildForwardingAudit(record: ForwardedEmailRecord, result: ForwardingRoutingResult, patch: { taskId?: string; followUpId?: string } = {}): ForwardedRoutingAuditEntry {
  return {
    id: createId('FWA'),
    forwardedEmailId: record.id,
    ruleIds: result.ruleIds,
    signals: [...result.reasons, ...result.warnings, ...result.duplicateWarnings],
    confidence: result.confidence,
    result: result.decision,
    reasons: result.reasons,
    createdTaskId: patch.taskId,
    createdFollowUpId: patch.followUpId,
    createdAt: todayIso(),
  };
}

export function buildTaskFromForwarded(record: ForwardedEmailRecord, owner = 'Jared', project = 'General'): TaskItem {
  return {
    id: createId('TSK'),
    title: record.originalSubject,
    project,
    owner,
    status: 'To do',
    priority: (record.parsedCommandHints.priority as TaskItem['priority']) ?? 'Medium',
    dueDate: record.parsedCommandHints.dueDate ?? addDaysIso(todayIso(), 2),
    summary: record.bodyText.slice(0, 240),
    nextStep: 'Review forwarded email and execute action.',
    notes: `Forwarded intake ${record.id} from ${record.originalSender}`,
    tags: ['Forwarded Intake', ...record.parsedCommandHints.tags],
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}
