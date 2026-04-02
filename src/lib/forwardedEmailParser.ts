import type { ForwardedEmailCommandHints, ForwardedEmailProviderPayload, ForwardedEmailRecord } from '../types';
import { createId, todayIso, uniqueStrings } from './utils';

function normalizeSubject(subject: string): string {
  return subject.toLowerCase().replace(/^(fw|fwd|re):\s*/gi, '').replace(/\s+/g, ' ').trim();
}

function parseAddressLine(value?: string): string[] {
  if (!value) return [];
  return uniqueStrings((value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).map((entry) => entry.toLowerCase()));
}

function parseDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function readForwardedHeader(bodyText: string, label: string): string | undefined {
  const match = bodyText.match(new RegExp(`(?:^|\\n)${label}:\\s*(.+)$`, 'im'));
  return match?.[1]?.trim();
}

export function parseCommandHints(subject: string, bodyText: string): ForwardedEmailCommandHints {
  const combined = `${subject}\n${bodyText.split('\n').slice(0, 12).join('\n')}`;
  const tags = uniqueStrings((combined.match(/#([a-z0-9:_-]+)/gi) ?? []).map((entry) => entry.toLowerCase()));
  const hint: ForwardedEmailCommandHints = { tags };

  if (/\[(task|followup|follow-up|ref|reference)\]/i.test(combined)) {
    const t = combined.match(/\[(task|followup|follow-up|ref|reference)\]/i)?.[1]?.toLowerCase();
    hint.type = t === 'task' ? 'task' : t?.startsWith('follow') ? 'followup' : 'reference';
  }
  if (/#task\b/i.test(combined)) hint.type = 'task';
  if (/#followup\b|#follow-up\b/i.test(combined)) hint.type = 'followup';
  if (/#ref\b|#reference\b/i.test(combined)) hint.type = 'reference';

  const project = combined.match(/(?:#project:|\bp:)([A-Za-z0-9_-]+)/i)?.[1];
  const owner = combined.match(/(?:#owner:|\bo:)([A-Za-z][A-Za-z\s-]+)/i)?.[1];
  const due = combined.match(/(?:#due:|\bdue:)(\d{4}-\d{2}-\d{2})/i)?.[1];
  const pri = combined.match(/(?:#priority:|\bpri:)(low|medium|high|critical)/i)?.[1];
  const wait = combined.match(/(?:#wait:|\bwait:)([^\n]+)/i)?.[1];

  if (project) hint.project = project.toUpperCase();
  if (owner) hint.owner = owner.trim();
  if (due) hint.dueDate = due;
  if (pri) hint.priority = `${pri[0].toUpperCase()}${pri.slice(1).toLowerCase()}` as ForwardedEmailCommandHints['priority'];
  if (wait) hint.waitingOn = wait.trim();

  return hint;
}

function parserConfidence(record: Pick<ForwardedEmailRecord, 'originalSender' | 'originalSubject' | 'bodyText' | 'parsedCommandHints' | 'parseWarnings'>): number {
  let score = 45;
  if (record.originalSender.includes('@')) score += 15;
  if (record.originalSubject.trim().length > 3) score += 10;
  if (record.bodyText.trim().length > 60) score += 15;
  if (record.parsedCommandHints.type) score += 20;
  if (record.parseWarnings.length) score -= record.parseWarnings.length * 8;
  return Math.max(0, Math.min(100, score));
}

export function buildForwardedDedupeSignature(sender: string, normalizedSubject: string, sentAt?: string, bodyText?: string): string {
  const bodySlice = (bodyText ?? '').toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 140);
  return [sender.toLowerCase(), normalizedSubject, sentAt ?? '', bodySlice].join('::');
}

export function parseForwardedProviderPayload(payload: ForwardedEmailProviderPayload): ForwardedEmailRecord {
  const bodyText = payload.text?.trim() || '';
  const forwardedFrom = readForwardedHeader(bodyText, 'From') ?? payload.envelopeFrom ?? 'unknown@unknown';
  const forwardedTo = parseAddressLine(readForwardedHeader(bodyText, 'To'));
  const forwardedCc = parseAddressLine(readForwardedHeader(bodyText, 'Cc'));
  const forwardedDate = parseDate(readForwardedHeader(bodyText, 'Date') ?? readForwardedHeader(bodyText, 'Sent'));
  const forwardedSubject = readForwardedHeader(bodyText, 'Subject') ?? payload.subject;
  const normalized = normalizeSubject(forwardedSubject);
  const commandHints = parseCommandHints(payload.subject, bodyText);
  const parsedProjectHints = uniqueStrings([commandHints.project, ...((`${payload.subject} ${bodyText}`).match(/\b(B\d{3,4}|RFI[-\s]?\d+|SUB[-\s]?\d+)\b/gi) ?? [])].filter(Boolean) as string[]);

  const parseWarnings: string[] = [];
  if (!bodyText) parseWarnings.push('Forwarded body text missing.');
  if (!forwardedFrom.includes('@')) parseWarnings.push('Original sender could not be confidently extracted.');

  const record: ForwardedEmailRecord = {
    id: createId('FWD'),
    receivedAt: payload.receivedAt ?? todayIso(),
    forwardingAddress: payload.forwardingAddress,
    forwardingAlias: payload.forwardingAddress.split('@')[0],
    originalSubject: forwardedSubject,
    normalizedSubject: normalized,
    originalSender: forwardedFrom,
    originalRecipients: forwardedTo,
    cc: forwardedCc,
    originalSentAt: forwardedDate,
    bodyText,
    htmlBody: payload.html,
    attachments: payload.attachments ?? [],
    parsedProjectHints,
    parsedCommandHints: commandHints,
    parseQuality: parseWarnings.length ? (parseWarnings.length > 1 ? 'weak' : 'partial') : 'strong',
    parseWarnings,
    parserConfidence: 0,
    dedupeSignature: '',
    sourceMessageIdentifiers: uniqueStrings([readForwardedHeader(bodyText, 'Message-ID') ?? '', readForwardedHeader(bodyText, 'Thread-Topic') ?? ''].filter(Boolean)),
    rawForwardingMarkers: uniqueStrings((bodyText.match(/^-{2,}\s*Forwarded message\s*-{2,}$/gim) ?? []).map((entry) => entry.trim())),
    status: 'parsed',
  };

  const confidence = parserConfidence(record);
  return {
    ...record,
    parserConfidence: confidence,
    dedupeSignature: buildForwardedDedupeSignature(record.originalSender, record.normalizedSubject, record.originalSentAt, record.bodyText),
  };
}
