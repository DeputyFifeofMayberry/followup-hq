import { AlertTriangle, CheckCircle2, Cloud, CloudCog, Edit3, Loader2 } from 'lucide-react';
import type { DirtyRecordRef } from '../../store/persistenceQueue';
import { selectRecordSaveStatus } from '../../store/recordSaveStatus';
import { useAppStore } from '../../store/useAppStore';
import { AppBadge } from '../ui/AppPrimitives';

export function RecordSaveStatus({
  record,
  editing = false,
  compact = false,
}: {
  record: Pick<DirtyRecordRef, 'type' | 'id'>;
  editing?: boolean;
  compact?: boolean;
}) {
  const model = useAppStore((state) => selectRecordSaveStatus(state, record, { editingOverride: editing }));

  const icon = model.stage === 'needs-attention'
    ? <AlertTriangle className="h-3.5 w-3.5" />
    : model.stage === 'cloud-verified'
      ? <CheckCircle2 className="h-3.5 w-3.5" />
      : model.stage === 'cloud-confirmed'
        ? <Cloud className="h-3.5 w-3.5" />
        : model.stage === 'queued-for-cloud' || model.stage === 'verification-stale'
          ? <CloudCog className="h-3.5 w-3.5" />
          : model.stage === 'saving'
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Edit3 className="h-3.5 w-3.5" />;

  if (compact) {
    return <AppBadge tone={model.tone}>{model.label}</AppBadge>;
  }

  return (
    <div className="flex items-center gap-2 text-xs text-slate-600" role="status" aria-live="polite">
      <AppBadge tone={model.tone}><span className="inline-flex items-center gap-1">{icon}{model.label}</span></AppBadge>
      <span>{model.detail}</span>
      {model.timestamp ? <span className="text-slate-500">• {new Date(model.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span> : null}
    </div>
  );
}
