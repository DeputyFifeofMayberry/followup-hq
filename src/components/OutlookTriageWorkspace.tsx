import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Badge } from './Badge';
import { useAppStore } from '../store/useAppStore';

export function OutlookTriageWorkspace() {
  const {
    outlookTriageCandidates,
    outlookTriageRules,
    items,
    approveTriageCandidate,
    rejectTriageCandidate,
    linkTriageCandidateToExisting,
    addOutlookRuleFromCandidate,
    updateOutlookRule,
    deleteOutlookRule,
    addManualOutlookRule,
  } = useAppStore(useShallow((s) => ({
    outlookTriageCandidates: s.outlookTriageCandidates,
    outlookTriageRules: s.outlookTriageRules,
    items: s.items,
    approveTriageCandidate: s.approveTriageCandidate,
    rejectTriageCandidate: s.rejectTriageCandidate,
    linkTriageCandidateToExisting: s.linkTriageCandidateToExisting,
    addOutlookRuleFromCandidate: s.addOutlookRuleFromCandidate,
    updateOutlookRule: s.updateOutlookRule,
    deleteOutlookRule: s.deleteOutlookRule,
    addManualOutlookRule: s.addManualOutlookRule,
  })));

  const [newSubjectContains, setNewSubjectContains] = useState('');

  const pending = outlookTriageCandidates.filter((candidate) => candidate.status === 'pending');

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Outlook triage review queue</h3>
          <Badge variant="warn">{pending.length} pending</Badge>
        </div>
        <div className="space-y-3">
          {pending.map((candidate) => (
            <div key={candidate.id} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{candidate.sourceMessageSubject}</div>
                  <div className="text-xs text-slate-500">{candidate.sourceMessageFrom} • {candidate.sourceMessageFolder} • confidence {candidate.confidence}</div>
                </div>
                <Badge variant={candidate.suggestedType === 'follow-up' ? 'blue' : 'green'}>{candidate.suggestedType}</Badge>
              </div>
              <ul className="mt-2 list-disc pl-5 text-xs text-slate-600">
                {candidate.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              {candidate.blockingReasons.length ? <div className="mt-2 text-xs text-rose-700">{candidate.blockingReasons.join(' • ')}</div> : null}
              {candidate.duplicateInfo.length ? <div className="mt-1 text-xs text-amber-700">{candidate.duplicateInfo.join(' • ')}</div> : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="action-btn" onClick={() => approveTriageCandidate(candidate.id, 'task')}>Approve as task</button>
                <button className="action-btn" onClick={() => approveTriageCandidate(candidate.id, 'follow-up')}>Approve as follow-up</button>
                <button className="action-btn" onClick={() => rejectTriageCandidate(candidate.id)}>Reject</button>
                <button className="action-btn" onClick={() => addOutlookRuleFromCandidate(candidate.id, 'ignore')}>Ignore sender/domain like this</button>
                <button className="action-btn" onClick={() => addOutlookRuleFromCandidate(candidate.id, 'review-task')}>Always review like this</button>
                <button className="action-btn" onClick={() => addOutlookRuleFromCandidate(candidate.id, 'auto-follow-up')}>Auto-create like this in future</button>
                {items[0] ? <button className="action-btn" onClick={() => linkTriageCandidateToExisting(candidate.id, items[0].id)}>Link to existing item</button> : null}
              </div>
            </div>
          ))}
          {pending.length === 0 ? <div className="text-sm text-slate-500">No pending candidates.</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 p-4">
        <div className="mb-3 text-sm font-semibold text-slate-900">Rule management</div>
        <div className="mb-3 flex gap-2">
          <input className="field-input" value={newSubjectContains} onChange={(event) => setNewSubjectContains(event.target.value)} placeholder="subject contains" />
          <button
            className="action-btn"
            onClick={() => {
              if (!newSubjectContains.trim()) return;
              addManualOutlookRule({
                name: `Manual rule: ${newSubjectContains}`,
                enabled: true,
                priority: (outlookTriageRules.at(-1)?.priority ?? 100) + 10,
                conditions: { subjectContains: newSubjectContains.trim() },
                action: 'review-task',
                confidenceBoost: 0,
              });
              setNewSubjectContains('');
            }}
          >
            Add manual rule
          </button>
        </div>
        <div className="space-y-2">
          {outlookTriageRules
            .slice()
            .sort((a, b) => a.priority - b.priority)
            .map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{rule.name}</div>
                    <div className="text-xs text-slate-500">{rule.action} • priority {rule.priority} • {rule.source}</div>
                  </div>
                  <div className="flex gap-2">
                    <button className="action-btn" onClick={() => updateOutlookRule(rule.id, { enabled: !rule.enabled })}>{rule.enabled ? 'Disable' : 'Enable'}</button>
                    <button className="action-btn" onClick={() => updateOutlookRule(rule.id, { priority: Math.max(1, rule.priority - 10) })}>Raise priority</button>
                    <button className="action-btn action-btn-danger" onClick={() => deleteOutlookRule(rule.id)}>Delete</button>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
