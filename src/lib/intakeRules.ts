import type { ForwardedEmailRecord, ForwardedEmailRule } from '../types';
import { todayIso } from './utils';

export function getDefaultForwardedRules(): ForwardedEmailRule[] {
  const now = todayIso();
  return [
    {
      id: 'fwd-rule-ignore-newsletter',
      name: 'Ignore newsletters and marketing',
      enabled: true,
      priority: 10,
      source: 'system',
      conditions: { subjectContains: 'newsletter' },
      action: 'ignore',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fwd-rule-ignore-noreply',
      name: 'Ignore no-reply sender',
      enabled: true,
      priority: 20,
      source: 'system',
      conditions: { senderEmailContains: 'noreply' },
      action: 'ignore',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fwd-rule-review-command-task',
      name: 'Review task commands',
      enabled: true,
      priority: 40,
      source: 'system',
      conditions: { commandTag: 'task' },
      action: 'review-task',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fwd-rule-review-command-followup',
      name: 'Review follow-up commands',
      enabled: true,
      priority: 50,
      source: 'system',
      conditions: { commandTag: 'followup' },
      action: 'review-followup',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'fwd-rule-block-auto-default',
      name: 'Block auto-create by default',
      enabled: true,
      priority: 90,
      source: 'system',
      conditions: {},
      action: 'block-auto-create',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function matchesForwardedRule(rule: ForwardedEmailRule, record: ForwardedEmailRecord, input: { recipientCount: number; internalDomains: string[] }): boolean {
  if (!rule.enabled) return false;
  const c = rule.conditions;
  const senderLower = record.originalSender.toLowerCase();
  const subjectLower = record.originalSubject.toLowerCase();
  const bodyLower = record.bodyText.toLowerCase();

  if (c.forwardingAlias && record.forwardingAlias.toLowerCase() !== c.forwardingAlias.toLowerCase()) return false;
  if (c.senderEmailContains && !senderLower.includes(c.senderEmailContains.toLowerCase())) return false;
  if (c.senderDomain && !senderLower.includes(`@${c.senderDomain.toLowerCase()}`)) return false;
  if (c.subjectContains && !subjectLower.includes(c.subjectContains.toLowerCase())) return false;
  if (c.bodyContains && !bodyLower.includes(c.bodyContains.toLowerCase())) return false;
  if (typeof c.projectHintPresent === 'boolean' && Boolean(record.parsedProjectHints.length) !== c.projectHintPresent) return false;
  if (c.commandTag && !record.parsedCommandHints.tags.some((tag) => tag.includes(c.commandTag!.toLowerCase()))) return false;
  if (typeof c.attachmentPresent === 'boolean' && Boolean(record.attachments.length) !== c.attachmentPresent) return false;
  if (c.senderKind === 'internal' || c.senderKind === 'external') {
    const senderDomain = senderLower.split('@')[1] ?? '';
    const isInternal = input.internalDomains.includes(senderDomain);
    if (c.senderKind === 'internal' && !isInternal) return false;
    if (c.senderKind === 'external' && isInternal) return false;
  }
  if (typeof c.minParserConfidence === 'number' && record.parserConfidence < c.minParserConfidence) return false;
  if (typeof c.maxRecipientCount === 'number' && input.recipientCount > c.maxRecipientCount) return false;
  if (c.threadSignatureContains && !record.dedupeSignature.includes(c.threadSignatureContains.toLowerCase())) return false;

  return true;
}
