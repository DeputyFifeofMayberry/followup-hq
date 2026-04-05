import type { ExecutionIntent } from '../../../types';
import type { ExecutionRouteHandoff } from './types';

export function executionIntentToHandoff(intent: ExecutionIntent): ExecutionRouteHandoff | null {
  if (intent.target === 'overview') return null;
  return {
    source: intent.source ?? 'overview',
    targetLane: intent.target,
    targetSection: intent.section,
    targetRecordId: intent.recordId,
    targetRecordType: intent.recordType,
    targetProject: intent.project,
    intentLabel: intent.intentLabel,
    reason: intent.intentLabel,
    routeKind: intent.kind === 'open_record' ? 'review' : intent.kind === 'open_section' ? 'action' : 'context',
    createdAt: intent.createdAt,
  };
}
