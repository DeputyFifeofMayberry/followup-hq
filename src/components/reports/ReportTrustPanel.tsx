import { AlertTriangle, Shield, ShieldCheck } from 'lucide-react';
import type { ReportTrustSummary } from '../../lib/reports';
import { AppShellCard, SectionHeader } from '../ui/AppPrimitives';

function confidenceTone(tier: ReportTrustSummary['confidence']['tier']) {
  if (tier === 'high') return 'text-emerald-700 bg-emerald-50';
  if (tier === 'moderate') return 'text-amber-700 bg-amber-50';
  return 'text-rose-700 bg-rose-50';
}

function ConfidenceIcon({ tier }: { tier: ReportTrustSummary['confidence']['tier'] }) {
  if (tier === 'high') return <ShieldCheck className="h-4 w-4" />;
  if (tier === 'moderate') return <Shield className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

export function ReportTrustPanel({ trust }: { trust: ReportTrustSummary }) {
  const { scopeReceipt, confidence } = trust;

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <AppShellCard surface="command" className="space-y-3">
        <SectionHeader title="Report scope summary" subtitle="What this report includes, what was excluded, and how dependable the picture is." compact />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Scope mode</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{scopeReceipt.modeLabel}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Included</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{scopeReceipt.includedCount}</div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <div className="text-xs uppercase tracking-[0.12em] text-slate-500">Excluded</div>
            <div className="mt-1 text-2xl font-semibold text-slate-950">{scopeReceipt.excludedCount}</div>
          </div>
          <div className={`rounded-xl p-3 ${confidenceTone(confidence.tier)}`}>
            <div className="flex items-center gap-1 text-xs uppercase tracking-[0.12em]">
              <ConfidenceIcon tier={confidence.tier} />
              Confidence
            </div>
            <div className="mt-1 text-sm font-semibold">{confidence.label}</div>
          </div>
        </div>
        {trust.topExclusions.length ? (
          <div className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-700">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Top exclusion reasons</div>
            <ul className="mt-2 space-y-1">
              {trust.topExclusions.map((bucket) => (
                <li key={bucket.reasonKey} className="flex items-start justify-between gap-3">
                  <span>{bucket.label}</span>
                  <strong>{bucket.count}</strong>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">No exclusions under the current scope filters.</div>
        )}
      </AppShellCard>

      <AppShellCard surface="inspector" className="space-y-3">
        <SectionHeader title="Why this report looks this way" subtitle="Interpretation guide grounded in the active scope receipt." compact />
        <div className="text-sm text-slate-700">{scopeReceipt.modeDescription}</div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Included rules</div>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {scopeReceipt.includedRules.map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Excluded rules</div>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {scopeReceipt.excludedRules.map((rule) => <li key={rule}>• {rule}</li>)}
          </ul>
        </div>
        <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <strong>Confidence caveat:</strong> {confidence.caveat}
        </div>
      </AppShellCard>
    </div>
  );
}
