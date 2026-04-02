import type { OutlookMessage } from '../types';

export interface OutlookSignalSummary {
  positive: string[];
  negative: string[];
  hardBlocks: string[];
  suggestedType: 'task' | 'follow-up';
  projectHint?: string;
  hasProjectMatch: boolean;
}

const NO_REPLY_WAIT_DAYS = 3;

function text(value: string): string {
  return value.toLowerCase();
}

export function projectHint(subject: string, body: string): string | undefined {
  const hit = `${subject} ${body}`.match(/\b(B\d{3,4}|RFI[-\s]?\d+|SUB[-\s]?\d+)\b/i);
  return hit?.[1]?.toUpperCase();
}

export function evaluateSignals(message: OutlookMessage, context: { internalDomains: string[]; noReplyAfterSent: boolean; noReplyDays: number }): OutlookSignalSummary {
  const positive: string[] = [];
  const negative: string[] = [];
  const hardBlocks: string[] = [];
  const senderLower = text(message.from);
  const subjectLower = text(message.subject);
  const bodyLower = text(message.bodyPreview);
  const recipients = message.toRecipients.length + message.ccRecipients.length;
  const hint = projectHint(message.subject, message.bodyPreview);

  if (/no[-\s]?reply|do[-\s]?not[-\s]?reply|automated/.test(senderLower)) hardBlocks.push('Blocked: sender matches noreply/automated pattern');
  if (/automatic reply|out of office|ooo/.test(subjectLower)) hardBlocks.push('Blocked: auto-reply/out-of-office traffic');
  if (/calendar|meeting|invite/.test(subjectLower) && /teams|zoom|meeting/.test(bodyLower)) hardBlocks.push('Blocked: calendar/meeting traffic');
  if (/newsletter|unsubscribe|marketing/.test(subjectLower + bodyLower)) hardBlocks.push('Blocked: newsletter/marketing style message');

  if (message.flagStatus === 'flagged') positive.push('Positive: Outlook flagged');
  if (message.importance === 'high') positive.push('Positive: high importance');
  if (message.categories.length > 0) positive.push('Positive: categories present');
  if (hint) positive.push(`Positive: project hint ${hint}`);

  if (/please|need|action|required|by\s+\w+day/.test(bodyLower)) positive.push('Positive: imperative/action language detected');
  if (/waiting on|follow up|circling back|any update/.test(subjectLower + bodyLower)) positive.push('Positive: follow-up waiting language detected');

  if (/fyi|for awareness|no action/.test(subjectLower + bodyLower)) negative.push('Negative: FYI/no-action language');
  if (recipients >= 8) negative.push('Negative: broad recipient list');
  if (/notification|alert|digest/.test(subjectLower + bodyLower)) negative.push('Negative: likely system notification wording');

  if (message.folder === 'sentitems' && context.noReplyAfterSent && context.noReplyDays >= NO_REPLY_WAIT_DAYS) {
    positive.push(`Positive: sent mail without newer inbound reply for ${context.noReplyDays} days`);
  }

  const suggestedType: 'task' | 'follow-up' = message.folder === 'sentitems' ? 'follow-up' : /waiting on|reply|response/.test(subjectLower + bodyLower) ? 'follow-up' : 'task';

  return {
    positive,
    negative,
    hardBlocks,
    suggestedType,
    projectHint: hint,
    hasProjectMatch: Boolean(hint),
  };
}
