import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { useAppStore } from '../store/useAppStore';
import type { ForwardedEmailProviderPayload } from '../types';

const SAMPLE_PAYLOAD: ForwardedEmailProviderPayload = {
  provider: 'mock',
  forwardingAddress: 'jared+in@yourdomain.com',
  subject: 'Fwd: Vendor update [task] p:B995 o:Jared due:2026-04-10 pri:high',
  text: 'Forwarded message\nFrom: vendor@example.com\nTo: jared@yourdomain.com\nDate: Tue, 01 Apr 2026 10:15:00 -0700\nSubject: RFI response pending\n\nPlease review and send updated response by Friday. #task #project:B995',
};

export function ForwardingIntakeWorkspace() {
  const {
    forwardedEmails,
    forwardedCandidates,
    forwardedRules,
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

  const pending = (forwardedCandidates ?? []).filter((candidate) => candidate.status === 'pending');

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-900">Forwarding intake pipeline</h3>
        <p className="text-sm text-slate-500">Core workflow: forward email to <span className="font-medium">jared+in@yourdomain.com</span> and route safely.</p>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Mock inbound adapter (provider payload)</div>
        <textarea className="field-textarea" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} />
        <div className="mt-2 flex gap-2">
          <button className="action-btn" onClick={() => {
            try {
              ingestForwardedEmailPayload(JSON.parse(payloadText) as ForwardedEmailProviderPayload);
            } catch {
              window.alert('Invalid JSON payload');
            }
          }}>Ingest payload</button>
          <Badge variant="neutral">{(forwardedEmails ?? []).length} received</Badge>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-semibold text-slate-900">Forwarded review queue</div>
          <Badge variant="warn">{pending.length} pending</Badge>
        </div>
        <div className="space-y-3">
          {pending.map((candidate) => (
            <div key={candidate.id} className="rounded-xl border border-slate-200 p-3">
              <div className="text-sm font-medium text-slate-900">{candidate.normalizedSubject}</div>
              <div className="text-xs text-slate-500">{candidate.originalSender} • alias {candidate.forwardingAlias} • confidence {candidate.confidence} • {candidate.parseQuality}</div>
              <div className="mt-1 text-xs text-slate-600">Commands: {candidate.parsedCommands.join(', ') || 'none'}</div>
              <div className="mt-1 text-xs text-amber-700">{candidate.warnings.join(' • ')}</div>
              <div className="mt-1 text-xs text-rose-700">{candidate.duplicateWarnings.join(' • ')}</div>
              <ul className="mt-1 list-disc pl-5 text-xs text-slate-600">{candidate.reasons.slice(0, 4).map((r) => <li key={r}>{r}</li>)}</ul>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="action-btn" onClick={() => approveForwardedCandidate(candidate.id, 'task')}>Approve task</button>
                <button className="action-btn" onClick={() => approveForwardedCandidate(candidate.id, 'followup')}>Approve follow-up</button>
                <button className="action-btn" onClick={() => saveForwardedCandidateAsReference(candidate.id)}>Save reference</button>
                <button className="action-btn" onClick={() => rejectForwardedCandidate(candidate.id)}>Reject</button>
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'ignore')}>Always ignore like this</button>
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'review-task')}>Always review like this</button>
                <button className="action-btn" onClick={() => addForwardRuleFromCandidate(candidate.id, 'allow-auto-followup')}>Auto-create like this</button>
                {items[0] ? <button className="action-btn" onClick={() => linkForwardedCandidateToExisting(candidate.id, items[0].id)}>Link existing</button> : null}
              </div>
            </div>
          ))}
          {pending.length === 0 ? <div className="text-sm text-slate-500">No pending forwarded candidates.</div> : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 p-3">
        <div className="mb-2 text-sm font-semibold text-slate-900">Forwarded intake rules</div>
        <div className="mb-2 flex gap-2">
          <input className="field-input" value={manualRuleSubject} onChange={(event) => setManualRuleSubject(event.target.value)} placeholder="subject contains" />
          <button className="action-btn" onClick={() => {
            if (!manualRuleSubject.trim()) return;
            addManualForwardRule({
              name: `Manual subject rule: ${manualRuleSubject}`,
              enabled: true,
              priority: (forwardedRules.at(-1)?.priority ?? 100) + 10,
              conditions: { subjectContains: manualRuleSubject.trim() },
              action: 'review-task',
              confidenceBoost: 0,
            });
            setManualRuleSubject('');
          }}>Add rule</button>
        </div>
        <div className="space-y-2">
          {(forwardedRules ?? []).slice().sort((a, b) => a.priority - b.priority).map((rule) => (
            <div key={rule.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm"><span className="font-medium text-slate-900">{rule.name}</span><span className="text-slate-500"> • {rule.action} • p{rule.priority}</span></div>
                <div className="flex gap-2">
                  <button className="action-btn" onClick={() => updateForwardRule(rule.id, { enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button>
                  <button className="action-btn" onClick={() => updateForwardRule(rule.id, { priority: Math.max(1, rule.priority - 10) })}>Raise</button>
                  <button className="action-btn action-btn-danger" onClick={() => deleteForwardRule(rule.id)}>Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
