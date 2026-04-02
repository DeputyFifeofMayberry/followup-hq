import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Inbox, Link2, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { formatDateTime } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ForwardedEmailProviderPayload, ForwardedRuleAction, ForwardedRuleCondition } from '../types';

const SAMPLE_PAYLOAD: ForwardedEmailProviderPayload = {
  provider: 'mock',
  forwardingAddress: 'jared+in@yourdomain.com',
  subject: 'Fwd: Vendor update [task] p:B995 o:Jared due:2026-04-10 pri:high',
  text: 'Forwarded message\nFrom: vendor@example.com\nTo: jared@yourdomain.com\nDate: Tue, 01 Apr 2026 10:15:00 -0700\nSubject: RFI response pending\n\nPlease review and send updated response by Friday. #task #project:B995',
};

const actionLabel: Record<ForwardedRuleAction, string> = {
  ignore: 'Ignore matching emails',
  'review-task': 'Send to review as task',
  'review-followup': 'Send to review as follow-up',
  'review-reference': 'Send to review as reference',
  'allow-auto-task': 'Auto-create task',
  'allow-auto-followup': 'Auto-create follow-up',
  'block-auto-create': 'Block auto-create',
  'boost-confidence': 'Boost parser confidence',
  'set-owner': 'Set owner',
  'set-project': 'Set project',
  'set-default-priority': 'Set default priority',
};

function describeConditions(conditions: ForwardedRuleCondition): string {
  const parts: string[] = [];
  if (conditions.forwardingAlias) parts.push(`alias is ${conditions.forwardingAlias}`);
  if (conditions.senderEmailContains) parts.push(`sender contains ${conditions.senderEmailContains}`);
  if (conditions.senderDomain) parts.push(`sender domain is ${conditions.senderDomain}`);
  if (conditions.subjectContains) parts.push(`subject contains "${conditions.subjectContains}"`);
  if (conditions.bodyContains) parts.push(`body contains "${conditions.bodyContains}"`);
  if (conditions.commandTag) parts.push(`command tag ${conditions.commandTag}`);
  if (conditions.projectHintPresent) parts.push('project hint is present');
  if (conditions.attachmentPresent) parts.push('has attachment');
  if (conditions.senderKind) parts.push(`sender is ${conditions.senderKind}`);
  if (conditions.minParserConfidence !== undefined) parts.push(`confidence ≥ ${conditions.minParserConfidence}`);
  if (conditions.maxRecipientCount !== undefined) parts.push(`recipients ≤ ${conditions.maxRecipientCount}`);
  if (conditions.threadSignatureContains) parts.push(`thread signature contains "${conditions.threadSignatureContains}"`);
  return parts.join(' • ') || 'Applies broadly (no specific conditions set).';
}

export function ForwardingIntakeWorkspace() {
  const {
    forwardedEmails,
    forwardedCandidates,
    forwardedRules,
    forwardedLedger,
    forwardedRoutingAudit,
    items,
    ingestForwardedEmailPayload,
    approveForwardedCandidate,
    rejectForwardedCandidate,
    saveForwardedCandidateAsReference,
    linkForwardedCandidateToExisting,
    addForwardRuleFromCandidate,
    updateForwardRule,
    deleteForwardRule,
    addManualForwardRule,
  } = useAppStore(useShallow((s) => ({
    forwardedEmails: s.forwardedEmails,
    forwardedCandidates: s.forwardedCandidates,
    forwardedRules: s.forwardedRules,
    forwardedLedger: s.forwardedLedger,
    forwardedRoutingAudit: s.forwardedRoutingAudit,
    items: s.items,
    ingestForwardedEmailPayload: s.ingestForwardedEmailPayload,
    approveForwardedCandidate: s.approveForwardedCandidate,
    rejectForwardedCandidate: s.rejectForwardedCandidate,
    saveForwardedCandidateAsReference: s.saveForwardedCandidateAsReference,
    linkForwardedCandidateToExisting: s.linkForwardedCandidateToExisting,
    addForwardRuleFromCandidate: s.addForwardRuleFromCandidate,
    updateForwardRule: s.updateForwardRule,
    deleteForwardRule: s.deleteForwardRule,
    addManualForwardRule: s.addManualForwardRule,
  })));

  const [payloadText, setPayloadText] = useState(JSON.stringify(SAMPLE_PAYLOAD, null, 2));
  const [manualRuleSubject, setManualRuleSubject] = useState('');
  const [candidateLinks, setCandidateLinks] = useState<Record<string, string>>({});

  const pending = forwardedCandidates.filter((candidate) => candidate.status === 'pending');
  const systemRules = forwardedRules.filter((rule) => rule.source === 'system').sort((a, b) => a.priority - b.priority);
  const userRules = forwardedRules.filter((rule) => rule.source === 'user').sort((a, b) => a.priority - b.priority);

  const status = useMemo(() => {
    const approved = forwardedCandidates.filter((candidate) => candidate.status === 'approved' || candidate.status === 'linked').length;
    const rejected = forwardedCandidates.filter((candidate) => candidate.status === 'rejected').length;
    const references = forwardedCandidates.filter((candidate) => candidate.status === 'reference').length;
    const lastIntake = forwardedEmails[0]?.receivedAt;
    const strong = forwardedEmails.filter((email) => email.parseQuality === 'strong').length;
    const partial = forwardedEmails.filter((email) => email.parseQuality === 'partial').length;
    const weak = forwardedEmails.filter((email) => email.parseQuality === 'weak').length;
    const blocked = forwardedRoutingAudit.filter((entry) => entry.result === 'blocked').length;
    const duplicateLike = forwardedRoutingAudit.filter((entry) => entry.reasons.some((reason) => /duplicate/i.test(reason))).length;

    return { approved, rejected, references, lastIntake, strong, partial, weak, blocked, duplicateLike };
  }, [forwardedCandidates, forwardedEmails, forwardedRoutingAudit]);

  const recentHistory = useMemo(
    () => forwardedLedger.slice(0, 8).map((entry) => ({
      ledger: entry,
      audit: forwardedRoutingAudit.find((auditEntry) => auditEntry.forwardedEmailId === entry.forwardedEmailId),
    })),
    [forwardedLedger, forwardedRoutingAudit],
  );

  const forwardingAddress = forwardedEmails[0]?.forwardingAddress ?? 'jared+in@yourdomain.com';

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Email intake (forwarding-first)</h3>
        <p className="mt-1 text-sm text-slate-600">
          Forward messages to <span className="font-semibold text-slate-900">{forwardingAddress}</span>. Each inbound email is parsed and safely routed to
          a review queue before anything is created.
        </p>
        <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-3"><span className="font-medium">Follow-ups</span> for active threads that need owner accountability.</div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><span className="font-medium">Tasks</span> for explicit work requests, due dates, or assignments.</div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><span className="font-medium">References</span> for useful context that should not enter active queues.</div>
          <div className="rounded-lg border border-slate-200 bg-white p-3"><span className="font-medium">Safety first:</span> uncertain or risky parses stay in review for human approval.</div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Intake health</div>
          <Badge variant="blue">Live pipeline</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Emails received</div><div className="text-lg font-semibold text-slate-900">{forwardedEmails.length}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Pending review</div><div className="text-lg font-semibold text-amber-700">{pending.length}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Approved / linked</div><div className="text-lg font-semibold text-emerald-700">{status.approved}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Rejected</div><div className="text-lg font-semibold text-rose-700">{status.rejected}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">References saved</div><div className="text-lg font-semibold text-slate-900">{status.references}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Last intake</div><div className="text-sm font-medium text-slate-900">{status.lastIntake ? formatDateTime(status.lastIntake) : 'No intake yet'}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Parse quality</div><div className="text-sm font-medium text-slate-900">Strong {status.strong} • Partial {status.partial} • Weak {status.weak}</div></div>
          <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Duplicate / blocked</div><div className="text-sm font-medium text-slate-900">{status.duplicateLike} duplicate flags • {status.blocked} blocked</div></div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Review queue</div>
          <div className="flex items-center gap-2">
            <button
              className="action-btn"
              onClick={() => pending.filter((candidate) => candidate.confidence >= 0.9).forEach((candidate) => approveForwardedCandidate(candidate.id, candidate.suggestedType === 'reference' ? 'followup' : candidate.suggestedType))}
            >
              Batch approve high-confidence
            </button>
            <Badge variant="warn">{pending.length} pending</Badge>
          </div>
        </div>
        <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
          Layout intent: left = pending list, center = parsed preview, right = confirmation actions. The review cards below preserve that flow in a compact single-column mode.
        </div>
        <div className="space-y-3">
          {pending.map((candidate) => (
            <div key={candidate.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{candidate.normalizedSubject || '(no subject)'}</div>
                  <div className="text-xs text-slate-500">From {candidate.originalSender} • alias {candidate.forwardingAlias} • suggested {candidate.suggestedType}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={candidate.parseQuality === 'strong' ? 'success' : candidate.parseQuality === 'partial' ? 'warn' : 'danger'}>{candidate.parseQuality} parse</Badge>
                  <Badge variant="blue">confidence {candidate.confidence}</Badge>
                </div>
              </div>

              {(candidate.warnings.length > 0 || candidate.duplicateWarnings.length > 0) ? (
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {candidate.warnings.slice(0, 3).map((warning) => <Badge key={warning} variant="warn">{warning}</Badge>)}
                  {candidate.duplicateWarnings.slice(0, 2).map((warning) => <Badge key={warning} variant="danger">{warning}</Badge>)}
                </div>
              ) : null}

              {candidate.reasons.length ? (
                <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                  {candidate.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
                </ul>
              ) : null}

              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                <div className="rounded-lg border border-slate-200 p-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approve</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="action-btn" onClick={() => approveForwardedCandidate(candidate.id, 'task')}>
                      <CheckCircle2 className="h-4 w-4" /> Approve as task
                    </button>
                    <button className="action-btn" onClick={() => approveForwardedCandidate(candidate.id, 'followup')}>
                      <ChevronRight className="h-4 w-4" /> Approve as follow-up
                    </button>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Task creates a work item; follow-up creates a thread-tracking item.</div>
                </div>
                <div className="rounded-lg border border-slate-200 p-2">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative actions</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button className="action-btn" onClick={() => saveForwardedCandidateAsReference(candidate.id)}>
                      <FileText className="h-4 w-4" /> Save as reference
                    </button>
                    <button className="action-btn" onClick={() => rejectForwardedCandidate(candidate.id)}>
                      <AlertTriangle className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'ignore')}>Create ignore rule</button>
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'review-task')}>Create review-as-task rule</button>
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'allow-auto-followup')}>Create auto-follow-up rule</button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={candidateLinks[candidate.id] ?? ''}
                  onChange={(event) => setCandidateLinks((current) => ({ ...current, [candidate.id]: event.target.value }))}
                  className="field-input min-w-64"
                >
                  <option value="">Choose an existing record to link…</option>
                  {items.slice(0, 100).map((item) => (
                    <option key={item.id} value={item.id}>{item.title} ({item.id})</option>
                  ))}
                </select>
                <button
                  className="action-btn"
                  disabled={!candidateLinks[candidate.id]}
                  onClick={() => {
                    const selected = candidateLinks[candidate.id];
                    if (!selected) return;
                    linkForwardedCandidateToExisting(candidate.id, selected);
                  }}
                >
                  <Link2 className="h-4 w-4" /> Link existing record
                </button>
              </div>
            </div>
          ))}
          {pending.length === 0 ? <div className="text-sm text-slate-500">No pending emails. New forwarded emails will appear here for approval when needed.</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Routing rules</div>
          <Badge variant="neutral">{forwardedRules.length} total</Badge>
        </div>

        <div className="mb-3 rounded-lg border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Create rule</div>
          <div className="flex flex-wrap gap-2">
            <input className="field-input min-w-72" value={manualRuleSubject} onChange={(event) => setManualRuleSubject(event.target.value)} placeholder="Subject contains…" />
            <button className="action-btn" onClick={() => {
              if (!manualRuleSubject.trim()) return;
              addManualForwardRule({
                name: `Subject match: ${manualRuleSubject}`,
                enabled: true,
                priority: (forwardedRules.at(-1)?.priority ?? 100) + 10,
                conditions: { subjectContains: manualRuleSubject.trim() },
                action: 'review-task',
                confidenceBoost: 0,
              });
              setManualRuleSubject('');
            }}>
              <Plus className="h-4 w-4" /> Add review rule
            </button>
          </div>
        </div>

        {systemRules.length > 0 ? (
          <div className="mb-3 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">System rules</div>
            {systemRules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{rule.name}</div>
                    <div className="text-xs text-slate-500">{actionLabel[rule.action]} • priority {rule.priority}</div>
                    <div className="mt-1 text-xs text-slate-600">{describeConditions(rule.conditions)}</div>
                  </div>
                  <Badge variant="blue">System</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">User rules</div>
          {userRules.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No custom rules yet. Create one to automate recurring routing decisions.</div> : null}
          {userRules.map((rule) => (
            <div key={rule.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{rule.name}</div>
                  <div className="text-xs text-slate-500">{actionLabel[rule.action]} • priority {rule.priority}</div>
                  <div className="mt-1 text-xs text-slate-600">{describeConditions(rule.conditions)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button className="action-btn" onClick={() => updateForwardRule(rule.id, { enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button>
                  <button className="action-btn" onClick={() => updateForwardRule(rule.id, { priority: Math.max(1, rule.priority - 10) })}>Increase priority</button>
                  <button className="action-btn action-btn-danger" onClick={() => deleteForwardRule(rule.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Recent intake history</div>
          <Inbox className="h-4 w-4 text-slate-500" />
        </div>
        <div className="space-y-2">
          {recentHistory.map(({ ledger, audit }) => (
            <div key={ledger.id} className="rounded-lg border border-slate-200 p-3 text-sm">
              <div className="font-medium text-slate-900">{ledger.normalizedSubject || '(no subject)'}</div>
              <div className="text-xs text-slate-500">{ledger.sender} • decision {ledger.lastRoutingDecision} • {formatDateTime(ledger.evaluatedAt)}</div>
              {audit ? <div className="mt-1 text-xs text-slate-600">Confidence {audit.confidence} • {audit.reasons.slice(0, 2).join(' • ') || 'No extra reasons'}</div> : null}
              <div className="mt-1 text-xs text-slate-600">
                {ledger.linkedTaskId ? `Created task ${ledger.linkedTaskId}` : ledger.linkedFollowUpId ? `Created follow-up ${ledger.linkedFollowUpId}` : 'No item created'}
              </div>
            </div>
          ))}
          {recentHistory.length === 0 ? <div className="text-sm text-slate-500">No intake history yet. Forwarded emails will appear here after processing.</div> : null}
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900"><Wrench className="h-4 w-4" /> Developer tools (mock payload ingest)</summary>
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mock inbound adapter payload</div>
          <textarea className="field-textarea" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="action-btn" onClick={() => {
              try {
                ingestForwardedEmailPayload(JSON.parse(payloadText) as ForwardedEmailProviderPayload);
              } catch {
                window.alert('Invalid JSON payload');
              }
            }}>
              <ShieldCheck className="h-4 w-4" /> Ingest mock payload
            </button>
            <Badge variant="neutral">For local testing only</Badge>
          </div>
        </div>
      </details>
    </div>
  );
}
