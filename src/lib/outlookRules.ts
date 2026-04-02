import type { OutlookMessage, OutlookTriageRule } from '../types';
import { todayIso } from './utils';

function senderAddress(message: OutlookMessage): string {
  const match = message.from.match(/<([^>]+)>/);
  return (match?.[1] ?? message.from).trim().toLowerCase();
}

function senderDomain(message: OutlookMessage): string {
  return senderAddress(message).split('@')[1] ?? '';
}

function recipients(message: OutlookMessage): string[] {
  return [...message.toRecipients, ...message.ccRecipients].map((entry) => {
    const match = entry.match(/<([^>]+)>/);
    return (match?.[1] ?? entry).trim().toLowerCase();
  });
}

export function getDefaultOutlookTriageRules(): OutlookTriageRule[] {
  const now = todayIso();
  return [
    {
      id: 'otr-system-ignore-noreply',
      name: 'Ignore automated senders',
      enabled: true,
      priority: 10,
      source: 'system',
      conditions: { senderEmailContains: 'noreply' },
      action: 'ignore',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'otr-system-review-flagged-inbox',
      name: 'Review flagged inbox as task',
      enabled: true,
      priority: 30,
      source: 'system',
      conditions: { folder: 'inbox', flagged: true },
      action: 'review-task',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'otr-system-review-important-project',
      name: 'Review high importance with project match',
      enabled: true,
      priority: 40,
      source: 'system',
      conditions: { folder: 'inbox', minConfidence: 70, projectMatchRequired: true },
      action: 'review-task',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'otr-system-auto-sent-followup-safe',
      name: 'Auto create sent follow-up when safe',
      enabled: true,
      priority: 90,
      source: 'system',
      conditions: { folder: 'sentitems', categoryContains: 'follow up', threadHasNoReplyAfterSent: true, minConfidence: 95 },
      action: 'auto-follow-up',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

export function messageMatchesRule(message: OutlookMessage, rule: OutlookTriageRule, opts: { confidence: number; hasProjectMatch: boolean; noReplyAfterSent: boolean; internalDomains: string[] }): boolean {
  if (!rule.enabled) return false;
  const { conditions } = rule;
  const sender = senderAddress(message);
  const senderDom = senderDomain(message);
  const allRecipients = recipients(message);

  if (conditions.folder && conditions.folder !== message.folder) return false;
  if (conditions.senderEmailContains && !sender.includes(conditions.senderEmailContains.toLowerCase())) return false;
  if (conditions.senderDomain && senderDom !== conditions.senderDomain.toLowerCase()) return false;
  if (conditions.recipientDomain && !allRecipients.some((entry) => entry.endsWith(`@${conditions.recipientDomain!.toLowerCase()}`))) return false;
  if (conditions.categoryContains && !message.categories.some((category) => category.toLowerCase().includes(conditions.categoryContains!.toLowerCase()))) return false;
  if (typeof conditions.flagged === 'boolean' && (message.flagStatus === 'flagged') !== conditions.flagged) return false;
  if (conditions.projectMatchRequired && !opts.hasProjectMatch) return false;
  if (conditions.threadHasNoReplyAfterSent && !opts.noReplyAfterSent) return false;
  if (typeof conditions.minConfidence === 'number' && opts.confidence < conditions.minConfidence) return false;
  if (conditions.senderKind === 'internal' && !opts.internalDomains.includes(senderDom)) return false;
  if (conditions.senderKind === 'external' && opts.internalDomains.includes(senderDom)) return false;
  if (conditions.subjectContains && !message.subject.toLowerCase().includes(conditions.subjectContains.toLowerCase())) return false;
  if (conditions.bodyContains && !message.bodyPreview.toLowerCase().includes(conditions.bodyContains.toLowerCase())) return false;
  return true;
}
