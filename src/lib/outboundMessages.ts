import { createId, todayIso } from './utils';

export type OutboundState = 'draft' | 'ready_to_send' | 'sent_unverified' | 'sent_verified' | 'replied' | 'failed';

export interface OutboundMessage {
  id: string;
  followUpId: string;
  state: OutboundState;
  subject: string;
  body: string;
  recipients: string[];
  provider: 'manual' | 'mailto' | 'outlook' | 'other';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  externalRef?: string;
  confirmationSource?: string;
}

export function createDraftMessage(followUpId: string, subject: string, body: string, recipients: string[]): OutboundMessage {
  const now = todayIso();
  return { id: createId('OUT'), followUpId, subject, body, recipients, provider: 'manual', state: 'draft', createdAt: now, updatedAt: now };
}

export function transitionOutbound(
  message: OutboundMessage,
  event: 'mark_ready' | 'mark_sent_unverified' | 'mark_sent_verified' | 'mark_replied' | 'mark_failed',
  meta?: { externalRef?: string; confirmationSource?: string },
): OutboundMessage {
  const updatedAt = todayIso();
  if (event === 'mark_ready') return { ...message, state: 'ready_to_send', updatedAt };
  if (event === 'mark_sent_unverified') return { ...message, state: 'sent_unverified', sentAt: message.sentAt ?? updatedAt, updatedAt, externalRef: meta?.externalRef ?? message.externalRef };
  if (event === 'mark_sent_verified') return { ...message, state: 'sent_verified', sentAt: message.sentAt ?? updatedAt, updatedAt, externalRef: meta?.externalRef ?? message.externalRef, confirmationSource: meta?.confirmationSource ?? message.confirmationSource };
  if (event === 'mark_replied') return { ...message, state: 'replied', updatedAt };
  return { ...message, state: 'failed', updatedAt };
}
