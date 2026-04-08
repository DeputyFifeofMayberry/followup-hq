import { memo } from 'react';
import { BlockReasonSection, CompletionNoteSection, DateSection, StructuredActionFlow } from '../actions/StructuredActionFlow';

type FlowState = { kind: 'done' | 'block' | 'unblock' | 'defer'; taskId: string } | null;

type TaskActionFlowProps = {
  flowState: FlowState;
  flowWarnings: string[];
  flowBlockers: string[];
  flowResult: { tone: 'success' | 'warn' | 'danger'; message: string } | null;
  completionNoteDraft: string;
  blockReasonDraft: string;
  deferDateDraft: string;
  nextReviewDraft: string;
  onCancel: () => void;
  onConfirm: () => void;
  onCompletionNoteChange: (value: string) => void;
  onBlockReasonChange: (value: string) => void;
  onDeferDateChange: (value: string) => void;
  onNextReviewChange: (value: string) => void;
};

export const TaskActionFlow = memo(function TaskActionFlow({
  flowState,
  flowWarnings,
  flowBlockers,
  flowResult,
  completionNoteDraft,
  blockReasonDraft,
  deferDateDraft,
  nextReviewDraft,
  onCancel,
  onConfirm,
  onCompletionNoteChange,
  onBlockReasonChange,
  onDeferDateChange,
  onNextReviewChange,
}: TaskActionFlowProps) {
  return (
    <StructuredActionFlow
      open={!!flowState}
      title={flowState?.kind === 'done' ? 'Mark task done' : flowState?.kind === 'block' ? 'Block task' : flowState?.kind === 'unblock' ? 'Resume task' : 'Defer task'}
      subtitle="Structured task transition with validation and in-app feedback."
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Apply action"
      warnings={flowWarnings}
      blockers={flowBlockers}
      result={flowResult}
    >
      {flowState?.kind === 'done' ? <CompletionNoteSection value={completionNoteDraft} onChange={onCompletionNoteChange} /> : null}
      {flowState?.kind === 'block' ? <BlockReasonSection value={blockReasonDraft} onChange={onBlockReasonChange} /> : null}
      {flowState?.kind === 'block' ? <DateSection label="Next review date" value={nextReviewDraft} onChange={onNextReviewChange} /> : null}
      {flowState?.kind === 'defer' ? <DateSection label="Deferred until" value={deferDateDraft} onChange={onDeferDateChange} /> : null}
    </StructuredActionFlow>
  );
});
