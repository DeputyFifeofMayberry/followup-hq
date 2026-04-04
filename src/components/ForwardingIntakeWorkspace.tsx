import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Inbox, Link2, Plus, ShieldCheck, Wrench } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { formatDateTime } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ForwardedEmailProviderPayload, ForwardedRuleAction, ForwardedRuleCondition } from '../types';
import { buildForwardedFieldReviews, summarizeFieldReviews } from '../lib/intakeEvidence';
import { FieldReviewRow, WeakFieldWarningGroup } from './intake/FieldReview';
import { buildForwardedReviewQueue, buildQueueBucketCounts, buildQueueMetrics, filterReviewQueue, sortReviewQueue, type IntakeQueueFilters, type IntakeReviewBucket, type IntakeReviewSort } from '../lib/intakeReviewQueue';
import { describeFinalizedOutcome, evaluateForwardedImportSafety } from '../lib/intakeImportSafety';
import { buildIntakeTuningInsights } from '../lib/intakeTuningInsights';

const SAMPLE_PAYLOAD: ForwardedEmailProviderPayload = {
  provider: 'mock',
  forwardingAddress: 'jared+in@yourdomain.com',
  subject: 'Fwd: Vendor update [task] p:B995 o:Jared due:2026-04-10 pri:high',
  text: 'Forwarded message\nFrom: vendor@example.com\nTo: jared@yourdomain.com\nDate: Tue, 01 Apr 2026 10:15:00 -0700\nSubject: RFI response pending\n\nPlease review and send updated response by Friday. #task #project:B995',
};

const actionLabel: Record<ForwardedRuleAction, string> = {
  ignore: 'Ignore matching emails',
  'review-task': 'Send to Review as task',
  'review-followup': 'Send to Review as follow-up',
  'review-reference': 'Send to Review as reference',
  'allow-auto-task': 'Auto-create task',
  'allow-auto-followup': 'Auto-create follow-up',
  'block-auto-create': 'Block auto-create',
  'boost-confidence': 'Boost parser confidence',
  'set-owner': 'Set owner',
  'set-project': 'Set project',
  'set-default-priority': 'Set default priority',
};

const bucketLabels: Record<IntakeReviewBucket, string> = {
  ready_to_approve: 'Ready to approve',
  needs_correction: 'Needs correction',
  link_duplicate_review: 'Link / duplicate review',
  reference_likely: 'Reference likely',
  finalized_history: 'Rejected / finalized history',
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
    intakeReviewerFeedback,
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
    intakeReviewerFeedback: s.intakeReviewerFeedback,
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
  const [activeBucket, setActiveBucket] = useState<IntakeReviewBucket | 'all'>('all');
  const [sortKey, setSortKey] = useState<IntakeReviewSort>('newest');
  const [queueFilters, setQueueFilters] = useState<IntakeQueueFilters>({ pendingState: 'pending', confidenceTier: 'any' });
  const [activeCandidateId, setActiveCandidateId] = useState<string | null>(null);
  const [guardedApproval, setGuardedApproval] = useState<{ candidateId: string; asType: 'task' | 'followup' } | null>(null);

  const queue = useMemo(() => buildForwardedReviewQueue(forwardedCandidates), [forwardedCandidates]);
  const metrics = useMemo(() => buildQueueMetrics(queue), [queue]);
  const bucketCounts = useMemo(() => buildQueueBucketCounts(queue), [queue]);
  const filteredQueue = useMemo(() => {
    const base = filterReviewQueue(queue, queueFilters);
    const bucketed = activeBucket === 'all' ? base : base.filter((item) => item.bucket === activeBucket);
    return sortReviewQueue(bucketed, sortKey);
  }, [queue, queueFilters, activeBucket, sortKey]);
  const pendingIds = useMemo(() => filteredQueue.filter((entry) => entry.status === 'pending').map((entry) => entry.id), [filteredQueue]);

  useEffect(() => {
    if (!pendingIds.includes(activeCandidateId || '')) setActiveCandidateId(pendingIds[0] ?? null);
  }, [pendingIds, activeCandidateId]);

  const systemRules = forwardedRules.filter((rule) => rule.source === 'system').sort((a, b) => a.priority - b.priority);
  const userRules = forwardedRules.filter((rule) => rule.source === 'user').sort((a, b) => a.priority - b.priority);

  const status = useMemo(() => {
    const approved = forwardedCandidates.filter((candidate) => candidate.status === 'approved' || candidate.status === 'linked').length;
    const rejected = forwardedCandidates.filter((candidate) => candidate.status === 'rejected').length;
    const references = forwardedCandidates.filter((candidate) => candidate.status === 'reference').length;
    const lastIntake = forwardedEmails[0]?.receivedAt;
    return { approved, rejected, references, lastIntake };
  }, [forwardedCandidates, forwardedEmails]);

  const recentHistory = useMemo(
    () => forwardedLedger.slice(0, 8).map((entry) => ({
      ledger: entry,
      audit: forwardedRoutingAudit.find((auditEntry) => auditEntry.forwardedEmailId === entry.forwardedEmailId),
    })),
    [forwardedLedger, forwardedRoutingAudit],
  );

  const forwardingAddress = forwardedEmails[0]?.forwardingAddress ?? 'jared+in@yourdomain.com';
  const tuningInsights = useMemo(() => buildIntakeTuningInsights({
    intakeWorkCandidates: [],
    forwardedCandidates,
    forwardedRules,
    forwardedRoutingAudit,
    feedback: intakeReviewerFeedback,
  }), [forwardedCandidates, forwardedRules, forwardedRoutingAudit, intakeReviewerFeedback]);
  const ruleInsightById = useMemo(() => Object.fromEntries(tuningInsights.ruleInsights.map((entry) => [entry.ruleId, entry])), [tuningInsights.ruleInsights]);

  const runAndNext = (candidateId: string, fn: () => void) => {
    const idx = pendingIds.indexOf(candidateId);
    const nextId = idx >= 0 ? pendingIds[idx + 1] ?? pendingIds[idx - 1] ?? null : pendingIds[0] ?? null;
    fn();
    setActiveCandidateId(nextId);
  };
  const requestApproval = (candidateId: string, asType: 'task' | 'followup') => {
    const candidate = forwardedCandidates.find((entry) => entry.id === candidateId);
    if (!candidate) return;
    const safety = evaluateForwardedImportSafety(candidate);
    if (safety.safeToCreateNew) {
      runAndNext(candidateId, () => approveForwardedCandidate(candidateId, asType));
      return;
    }
    setGuardedApproval({ candidateId, asType });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-base font-semibold text-slate-900">Email intake (forwarding-first)</h3>
        <p className="mt-1 text-sm text-slate-600">Forward messages to <span className="font-semibold text-slate-900">{forwardingAddress}</span>. Pending queue is primary; rules and history support review decisions.</p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Pending review</div><div className="text-lg font-semibold text-amber-700">{metrics.pendingCount}</div></div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Batch-safe</div><div className="text-lg font-semibold text-emerald-700">{metrics.batchSafeCount}</div></div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Duplicate / link review</div><div className="text-lg font-semibold text-rose-700">{metrics.duplicateReviewCount}</div></div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Needs correction</div><div className="text-lg font-semibold text-amber-700">{metrics.weakOrConflictingCount}</div></div>
        <div className="rounded-lg border border-slate-200 p-3 text-sm"><div className="text-slate-500">Finalized</div><div className="text-lg font-semibold text-slate-900">{metrics.finalizedCount}</div></div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="text-sm font-semibold text-slate-900">Forwarding tuning snapshot</div>
        <div className="mt-2 flex flex-wrap gap-1 text-xs">
          {tuningInsights.weakParseHotspots.map((chip) => <Badge key={chip.label} variant={chip.tone === 'danger' ? 'danger' : chip.tone === 'warn' ? 'warn' : 'neutral'}>{chip.label}: {chip.value}</Badge>)}
        </div>
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {tuningInsights.tuningSuggestions.slice(0, 3).map((suggestion) => <li key={suggestion}>• {suggestion}</li>)}
        </ul>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Review queue</div>
          <button className="action-btn" onClick={() => pendingIds.forEach((candidateId) => {
            const candidate = forwardedCandidates.find((entry) => entry.id === candidateId);
            if (!candidate) return;
            if (queue.find((entry) => entry.id === candidateId)?.batchSafe) {
              approveForwardedCandidate(candidate.id, candidate.suggestedType === 'reference' ? 'followup' : candidate.suggestedType);
            }
          })}>Batch approve batch-safe ({metrics.batchSafeCount})</button>
        </div>
        <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
          {(Object.keys(bucketLabels) as IntakeReviewBucket[]).map((bucket) => (
            <button key={bucket} className={`rounded-full border px-2 py-1 ${activeBucket === bucket ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket(bucket)}>{bucketLabels[bucket]} ({bucketCounts[bucket]})</button>
          ))}
          <button className={`rounded-full border px-2 py-1 ${activeBucket === 'all' ? 'border-sky-300 bg-sky-50 text-sky-700' : 'border-slate-200 text-slate-600'}`} onClick={() => setActiveBucket('all')}>All</button>
        </div>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 text-xs">
          <select className="field-input" value={queueFilters.confidenceTier ?? 'any'} onChange={(e) => setQueueFilters((f) => ({ ...f, confidenceTier: e.target.value as IntakeQueueFilters['confidenceTier'] }))}>
            <option value="any">Any confidence</option><option value="high">High confidence</option><option value="medium">Medium confidence</option><option value="low">Low confidence</option>
          </select>
          <select className="field-input" value={sortKey} onChange={(e) => setSortKey(e.target.value as IntakeReviewSort)}>
            <option value="newest">Newest first</option><option value="highest_confidence">Highest confidence first</option><option value="lowest_confidence">Weakest confidence first</option><option value="duplicate_risk_first">Duplicate risk first</option>
          </select>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.batchSafeOnly ?? false} onChange={(e) => setQueueFilters((f) => ({ ...f, batchSafeOnly: e.target.checked }))} />Batch-safe only</label>
          <label className="inline-flex items-center gap-1"><input type="checkbox" checked={queueFilters.duplicateRisk === 'only'} onChange={(e) => setQueueFilters((f) => ({ ...f, duplicateRisk: e.target.checked ? 'only' : 'all' }))} />Duplicate risk only</label>
        </div>

        <div className="space-y-3">
          {pendingIds.map((candidateId) => {
            const candidate = forwardedCandidates.find((entry) => entry.id === candidateId);
            const queueEntry = filteredQueue.find((entry) => entry.id === candidateId);
            if (!candidate || !queueEntry) return null;
            const fieldSummary = summarizeFieldReviews(buildForwardedFieldReviews(candidate));
            return (
              <div key={candidate.id} className={`rounded-xl border p-3 ${activeCandidateId === candidate.id ? 'border-sky-300 bg-sky-50' : 'border-slate-200'}`} onClick={() => setActiveCandidateId(candidate.id)}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{candidate.normalizedSubject || '(no subject)'}</div>
                    <div className="text-xs text-slate-500">From {candidate.originalSender} • alias {candidate.forwardingAlias}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="blue">{bucketLabels[queueEntry.bucket]}</Badge>
                    <Badge variant={queueEntry.batchSafe ? 'success' : 'warn'}>{queueEntry.batchSafe ? 'batch-safe' : 'manual review'}</Badge>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {queueEntry.alerts.slice(0, 4).map((alert) => <Badge key={alert.code} variant={alert.tone}>{alert.label}</Badge>)}
                </div>

                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Field confidence snapshot</div>
                  <WeakFieldWarningGroup fields={[...fieldSummary.weak, ...fieldSummary.missing, ...fieldSummary.conflicting]} />
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    {fieldSummary.priorityReviewFields.map((field) => <FieldReviewRow key={field.key} field={field} />)}
                  </div>
                </div>

                <div className="mt-3 grid gap-2 lg:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 p-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Approve</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="action-btn" onClick={() => requestApproval(candidate.id, 'task')}><CheckCircle2 className="h-4 w-4" /> Approve as task</button>
                      <button className="action-btn" onClick={() => requestApproval(candidate.id, 'followup')}><ChevronRight className="h-4 w-4" /> Approve as follow-up</button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Alternative actions</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="action-btn" onClick={() => runAndNext(candidate.id, () => saveForwardedCandidateAsReference(candidate.id))}><FileText className="h-4 w-4" /> Save as reference</button>
                      <button className="action-btn" onClick={() => runAndNext(candidate.id, () => rejectForwardedCandidate(candidate.id))}><AlertTriangle className="h-4 w-4" /> Reject</button>
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Create rule from this candidate:</span>
                  <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'ignore')}>Create ignore rule</button>
                  <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'review-task')}>Create review-as-task rule</button>
                  <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'allow-auto-followup')}>Create auto-follow-up rule</button>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select value={candidateLinks[candidate.id] ?? ''} onChange={(event) => setCandidateLinks((current) => ({ ...current, [candidate.id]: event.target.value }))} className="field-input min-w-64">
                    <option value="">Choose an existing record to link…</option>
                    {items.slice(0, 100).map((item) => <option key={item.id} value={item.id}>{item.title} ({item.id})</option>)}
                  </select>
                  <button className="action-btn" disabled={!candidateLinks[candidate.id]} onClick={() => runAndNext(candidate.id, () => {
                    const selected = candidateLinks[candidate.id];
                    if (!selected) return;
                    linkForwardedCandidateToExisting(candidate.id, selected);
                  })}><Link2 className="h-4 w-4" /> Link existing</button>
                </div>
                <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                  {(() => {
                    const safety = evaluateForwardedImportSafety(candidate);
                    return (
                      <>
                        <div className="font-semibold text-slate-700">Safe import checks</div>
                        <div className="mt-1 grid gap-1">
                          {safety.checklist.slice(0, 4).map((item) => <div key={item.key} className={item.pass ? 'text-emerald-700' : 'text-rose-700'}>{item.pass ? '✓' : '•'} {item.label}</div>)}
                        </div>
                        {safety.safeToCreateNew ? <div className="mt-1 text-emerald-700">Safe to create new.</div> : <div className="mt-1 text-rose-700">Strong duplicate/update risk: review existing links before create-new.</div>}
                      </>
                    );
                  })()}
                </div>
                {guardedApproval?.candidateId === candidate.id ? (
                  <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs">
                    <div className="font-semibold text-rose-700">Risky create-new path</div>
                    <div className="mt-1 text-rose-700">Choose Link existing, Save reference, Reject, or deliberate override.</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button className="action-btn" onClick={() => { setGuardedApproval(null); saveForwardedCandidateAsReference(candidate.id); }}>Save as reference</button>
                      <button className="action-btn" onClick={() => { setGuardedApproval(null); rejectForwardedCandidate(candidate.id); }}>Reject</button>
                      <button className="action-btn action-btn-danger" onClick={() => {
                        const asType = guardedApproval.asType;
                        setGuardedApproval(null);
                        runAndNext(candidate.id, () => approveForwardedCandidate(candidate.id, asType, { overrideUnsafeCreate: true }));
                      }}>Override and create anyway</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {pendingIds.length === 0 ? <div className="text-sm text-slate-500">No pending emails in this queue view.</div> : null}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Routing rules</div><Badge variant="neutral">{forwardedRules.length} total</Badge></div>
          <div className="mb-3 rounded-lg border border-slate-200 p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Create rule</div>
            <div className="flex flex-wrap gap-2">
              <input className="field-input min-w-72" value={manualRuleSubject} onChange={(event) => setManualRuleSubject(event.target.value)} placeholder="Subject contains…" />
              <button className="action-btn" onClick={() => {
                if (!manualRuleSubject.trim()) return;
                addManualForwardRule({ name: `Subject match: ${manualRuleSubject}`, enabled: true, priority: (forwardedRules.at(-1)?.priority ?? 100) + 10, conditions: { subjectContains: manualRuleSubject.trim() }, action: 'review-task', confidenceBoost: 0 });
                setManualRuleSubject('');
              }}><Plus className="h-4 w-4" /> Add review rule</button>
            </div>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
            {[...systemRules, ...userRules].map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{rule.name}</div>
                    <div className="text-xs text-slate-500">{actionLabel[rule.action]} • priority {rule.priority}</div>
                    <div className="mt-1 text-xs text-slate-600">{describeConditions(rule.conditions)}</div>
                    {ruleInsightById[rule.id] ? (
                      <div className="mt-2 flex flex-wrap gap-1 text-[11px]">
                        <Badge variant="neutral">Hits {ruleInsightById[rule.id].hits}</Badge>
                        <Badge variant="success">Approved {ruleInsightById[rule.id].approved}</Badge>
                        <Badge variant="warn">Noisy {ruleInsightById[rule.id].rejectedOrReference + ruleInsightById[rule.id].overrides}</Badge>
                        <Badge variant={ruleInsightById[rule.id].quality === 'strong' ? 'success' : ruleInsightById[rule.id].quality === 'noisy' ? 'danger' : 'warn'}>
                          {ruleInsightById[rule.id].quality}
                        </Badge>
                      </div>
                    ) : null}
                  </div>
                  {rule.source === 'user' ? <div className="flex gap-2"><button className="action-btn" onClick={() => updateForwardRule(rule.id, { enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button><button className="action-btn action-btn-danger" onClick={() => deleteForwardRule(rule.id)}>Delete</button></div> : <Badge variant="blue">System</Badge>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 p-3">
          <div className="mb-2 flex items-center justify-between"><div className="text-sm font-semibold text-slate-900">Recent intake history</div><Inbox className="h-4 w-4 text-slate-500" /></div>
          <div className="space-y-2 max-h-[300px] overflow-auto pr-1">
            {recentHistory.map(({ ledger, audit }) => (
              <div key={ledger.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <div className="font-medium text-slate-900">{ledger.normalizedSubject || '(no subject)'}</div>
                <div className="text-xs text-slate-500">{ledger.sender} • final {ledger.lastRoutingDecision} • {describeFinalizedOutcome({ status: ledger.lastRoutingDecision === 'reference' ? 'reference' : undefined })} • {formatDateTime(ledger.evaluatedAt)}</div>
                {audit ? <div className="mt-1 text-xs text-slate-600">Confidence {audit.confidence} • Rules: {audit.ruleIds.length ? audit.ruleIds.length : 'none'} • {audit.reasons.slice(0, 2).join(' • ') || 'No extra reasons'}</div> : null}
              </div>
            ))}
            {recentHistory.length === 0 ? <div className="text-sm text-slate-500">No intake history yet.</div> : null}
          </div>
        </div>
      </div>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900"><Wrench className="h-4 w-4" /> Developer tools (mock payload ingest)</summary>
        <div className="mt-3 rounded-xl border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mock inbound adapter payload</div>
          <textarea className="field-textarea" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
          <div className="mt-2 flex gap-2">
            <button className="action-btn" onClick={() => {
              try { ingestForwardedEmailPayload(JSON.parse(payloadText) as ForwardedEmailProviderPayload); } catch { window.alert('Invalid JSON payload'); }
            }}><ShieldCheck className="h-4 w-4" /> Ingest mock payload</button>
            <Badge variant="neutral">For local testing only</Badge>
          </div>
        </div>
      </details>

      <div className="text-xs text-slate-500">Outcomes: approved/linked {status.approved} • references {status.references} • rejected {status.rejected} • last intake {status.lastIntake ? formatDateTime(status.lastIntake) : 'none'}</div>
    </div>
  );
}
