import type {
  FollowUpItem,
  FollowUpPriority,
  FollowUpStatus,
  OutlookMessage,
  OutlookReplyGap,
  OutlookThreadSuggestion,
} from '../types';

function normalizeSubject(subject: string): string {
  return subject
    .toLowerCase()
    .replace(/^(re|fw|fwd):\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function conversationKey(message: OutlookMessage): string {
  return message.conversationId || message.internetMessageId || `${normalizeSubject(message.subject)}::${message.from}`;
}

function toEpoch(value?: string): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysOld(value?: string): number {
  const epoch = toEpoch(value);
  if (!epoch) return 0;
  return Math.max(0, Math.floor((Date.now() - epoch) / 86_400_000));
}

function inferProjectHint(subject: string, bodyPreview: string): string {
  const haystack = `${subject} ${bodyPreview}`;
  const matches = haystack.match(/\b(B\d{3,4}|BOSC|NAVFAC|PSNS|Shop\s*\d+|Weld\s*Shop|Chillers?)\b/gi);
  if (!matches?.length) return 'General';
  const first = matches[0].replace(/\s+/g, ' ').trim();
  if (/^B\d{3,4}$/i.test(first)) return first.toUpperCase();
  return first;
}

function alreadyTracked(items: FollowUpItem[], message: OutlookMessage, key: string): boolean {
  return items.some((item) => {
    const refs = new Set([item.sourceRef, ...item.sourceRefs, item.notes]);
    return refs.has(message.sourceRef)
      || (message.webLink ? refs.has(message.webLink) : false)
      || refs.has(key)
      || item.title.trim().toLowerCase() === message.subject.trim().toLowerCase();
  });
}

function priorityForMessage(message: OutlookMessage, ageDays: number): FollowUpPriority {
  if (message.importance === 'high' || message.flagStatus === 'flagged' || ageDays >= 7) return 'High';
  if (ageDays >= 3 || !message.isRead) return 'Medium';
  return 'Low';
}

function latestActivity(messages: OutlookMessage[]): string | undefined {
  return [...messages]
    .map((message) => message.receivedDateTime || message.sentDateTime)
    .filter(Boolean)
    .sort((a, b) => toEpoch(b) - toEpoch(a))[0];
}

export function buildReplyGapInsights(messages: OutlookMessage[], items: FollowUpItem[]): OutlookReplyGap[] {
  const groups = new Map<string, OutlookMessage[]>();
  messages.forEach((message) => {
    const key = conversationKey(message);
    const existing = groups.get(key) ?? [];
    existing.push(message);
    groups.set(key, existing);
  });

  const gaps: OutlookReplyGap[] = [];
  groups.forEach((threadMessages, key) => {
    const sent = threadMessages
      .filter((message) => message.folder === 'sentitems' && message.sentDateTime)
      .sort((a, b) => toEpoch(b.sentDateTime) - toEpoch(a.sentDateTime));
    if (!sent.length) return;
    const latestSent = sent[0];
    const latestSentEpoch = toEpoch(latestSent.sentDateTime);
    const inboundAfter = threadMessages.some((message) => message.folder === 'inbox' && toEpoch(message.receivedDateTime) > latestSentEpoch);
    if (inboundAfter) return;
    const waitingDays = daysOld(latestSent.sentDateTime);
    if (waitingDays < 2) return;
    const tracked = alreadyTracked(items, latestSent, key);
    gaps.push({
      id: `gap-${latestSent.id}`,
      conversationId: key,
      subject: latestSent.subject || '(no subject)',
      sentMessageId: latestSent.id,
      waitingDays,
      latestSentAt: latestSent.sentDateTime ?? new Date().toISOString(),
      waitingOn: latestSent.toRecipients,
      hasTrackedItem: tracked,
      reason: tracked
        ? `Sent thread has no reply after ${waitingDays} days and is already linked to a tracked record.`
        : `Sent thread has no reply after ${waitingDays} days and is not yet tracked in SetPoint.`,
      webLink: latestSent.webLink,
    });
  });

  return gaps.sort((a, b) => b.waitingDays - a.waitingDays);
}

export function buildThreadSuggestions(messages: OutlookMessage[], items: FollowUpItem[]): OutlookThreadSuggestion[] {
  const groups = new Map<string, OutlookMessage[]>();
  messages.forEach((message) => {
    const key = conversationKey(message);
    const existing = groups.get(key) ?? [];
    existing.push(message);
    groups.set(key, existing);
  });

  const suggestions: OutlookThreadSuggestion[] = [];

  groups.forEach((threadMessages, key) => {
    const latest = [...threadMessages].sort((a, b) => {
      const aAt = toEpoch(a.receivedDateTime || a.sentDateTime);
      const bAt = toEpoch(b.receivedDateTime || b.sentDateTime);
      return bAt - aAt;
    })[0];
    if (!latest) return;

    const tracked = alreadyTracked(items, latest, key);
    const reasons: string[] = [];
    const ageDays = daysOld(latest.receivedDateTime || latest.sentDateTime);
    const projectHint = inferProjectHint(latest.subject, latest.bodyPreview);
    const unreadInbound = threadMessages.some((message) => message.folder === 'inbox' && !message.isRead);
    const flagged = threadMessages.some((message) => message.flagStatus === 'flagged');
    const highImportance = threadMessages.some((message) => message.importance === 'high');
    const sentWithoutReply = buildReplyGapInsights(threadMessages, items)[0];

    let suggestedStatus: FollowUpStatus = latest.folder === 'sentitems' ? 'Waiting on external' : 'Needs action';
    let recommendation = latest.folder === 'sentitems'
      ? 'Review the sent thread, confirm if a reply is overdue, and send a nudge if needed.'
      : 'Review the latest inbox thread and convert it into an owned follow-up if action is required.';

    if (unreadInbound) reasons.push('Unread inbound mail is in this thread.');
    if (flagged) reasons.push('The thread contains at least one flagged email.');
    if (highImportance) reasons.push('The thread contains a high-importance email.');
    if (ageDays >= 4) reasons.push(`Latest thread activity is ${ageDays} days old.`);
    if (projectHint !== 'General') reasons.push(`Likely project match: ${projectHint}.`);
    if (sentWithoutReply) reasons.push(`No inbound reply after the last sent email for ${sentWithoutReply.waitingDays} days.`);
    if (tracked) reasons.push('A matching SetPoint record already exists.');

    if (sentWithoutReply) {
      suggestedStatus = sentWithoutReply.waitingDays >= 7 ? 'At risk' : 'Waiting on external';
      recommendation = sentWithoutReply.waitingDays >= 7
        ? 'Escalate the overdue sent thread or send a stronger follow-up because the reply gap is aging out.'
        : 'Create or update a waiting-on-external record and schedule the next nudge.';
    } else if (unreadInbound && ageDays >= 2) {
      suggestedStatus = 'Needs action';
      recommendation = 'Review the inbound thread, assign ownership, and convert it to a tracked action item.';
    }

    const shouldSuggest = (!tracked && (unreadInbound || flagged || highImportance || sentWithoutReply || ageDays >= 3))
      || (tracked && sentWithoutReply && sentWithoutReply.waitingDays >= 5);
    if (!shouldSuggest) return;

    suggestions.push({
      id: `thread-${latest.id}`,
      conversationId: key,
      sourceMessageId: latest.id,
      subject: latest.subject || '(no subject)',
      suggestedStatus,
      suggestedPriority: priorityForMessage(latest, ageDays),
      recommendation,
      reasons: reasons.length ? reasons : ['Recent Outlook thread merits review.'],
      projectHint,
      waitingOn: latest.folder === 'sentitems' ? latest.toRecipients[0] : undefined,
      latestActivityAt: latestActivity(threadMessages),
      webLink: latest.webLink,
    });
  });

  return suggestions.sort((a, b) => {
    const priorityOrder: Record<FollowUpPriority, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
    const score = priorityOrder[b.suggestedPriority] - priorityOrder[a.suggestedPriority];
    if (score !== 0) return score;
    return toEpoch(b.latestActivityAt) - toEpoch(a.latestActivityAt);
  });
}
