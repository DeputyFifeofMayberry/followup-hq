import { parseCommandHints, parseForwardedProviderPayload } from '../forwardedEmailParser';
import { getDefaultForwardedRules } from '../intakeRules';
import { routeForwardedEmail } from '../intakeRouting';
import type { ForwardedEmailProviderPayload } from '../../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function payload(overrides: Partial<ForwardedEmailProviderPayload> = {}): ForwardedEmailProviderPayload {
  return {
    provider: 'mock',
    forwardingAddress: 'jared+in@yourdomain.com',
    subject: 'Fwd: Action needed [task] p:B995 due:2026-04-10',
    text: 'Forwarded message\nFrom: vendor@example.com\nTo: jared@yourdomain.com\nDate: Tue, 01 Apr 2026 10:15:00 -0700\nSubject: Action needed\n\nPlease provide update by Friday. #task #project:B995',
    ...overrides,
  };
}

export function runForwardedIntakeSelfChecks(): void {
  const parsed = parseForwardedProviderPayload(payload());
  assert(parsed.originalSender.includes('vendor@example.com'), 'parser should extract sender');
  assert(parsed.parsedCommandHints.type === 'task', 'parser should extract task command');

  const hints = parseCommandHints('Fwd', '#followup #owner:Jared #due:2026-04-08');
  assert(hints.type === 'followup', 'hashtag followup command should parse');
  assert(hints.owner === 'Jared', 'owner command should parse');

  const duplicateRouted = routeForwardedEmail(parsed, {
    rules: getDefaultForwardedRules(),
    ledger: [{
      id: 'l1', forwardedEmailId: 'old', dedupeSignature: parsed.dedupeSignature, normalizedSubject: parsed.normalizedSubject, sender: parsed.originalSender, sentAt: parsed.originalSentAt, sourceMessageIds: [], lastRoutingDecision: 'review', evaluatedAt: parsed.receivedAt,
    }],
    items: [],
    tasks: [],
    candidates: [],
    internalDomains: ['followuphq.com'],
  });
  assert(duplicateRouted.decision !== 'auto-task', 'duplicate should not auto-create task');

  const followup = parseForwardedProviderPayload(payload({ subject: 'Fwd: waiting [followup] p:B880', text: 'From: owner@example.com\n\n#followup #project:B880' }));
  const followupRouted = routeForwardedEmail(followup, {
    rules: getDefaultForwardedRules(), ledger: [], items: [], tasks: [], candidates: [], internalDomains: ['followuphq.com'],
  });
  assert(['review', 'auto-followup'].includes(followupRouted.decision), 'followup command should route to follow-up review/auto');

  const weak = parseForwardedProviderPayload(payload({ text: '' }));
  const weakRouted = routeForwardedEmail(weak, {
    rules: getDefaultForwardedRules(), ledger: [], items: [], tasks: [], candidates: [], internalDomains: ['followuphq.com'],
  });
  assert(['reference', 'review', 'ignore'].includes(weakRouted.decision), 'weak parse should avoid live creation');

  const newsletter = parseForwardedProviderPayload(payload({ subject: 'Fwd: Newsletter digest', text: 'From: noreply@service.com\n\nunsubscribe digest' }));
  const newsletterRouted = routeForwardedEmail(newsletter, {
    rules: getDefaultForwardedRules(), ledger: [], items: [], tasks: [], candidates: [], internalDomains: ['followuphq.com'],
  });
  assert(['ignore', 'blocked'].includes(newsletterRouted.decision), 'newsletter should be ignored/blocked');
}


try {
  runForwardedIntakeSelfChecks();
  console.log('forwarded intake self-checks passed');
} catch (error) {
  console.error('forwarded intake self-checks failed');
  throw error;
}
