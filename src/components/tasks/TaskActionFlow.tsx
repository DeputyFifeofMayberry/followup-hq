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
  const subtitle = flowState?.kind === 'block'
    ? 'Capture why it is blocked and set the next review date.'
    : flowState?.kind === 'defer'
      ? 'Set when this task should return to active work.'
      : flowState?.kind === 'done'
        ? 'Confirm completion details before closing this task.'
        : 'Move this task back into active execution.';

  return (
    <StructuredActionFlow
      open={!!flowState}
      title={flowState?.kind === 'done' ? 'Complete task' : flowState?.kind === 'block' ? 'Block task' : flowState?.kind === 'unblock' ? 'Unblock task' : 'Defer task'}
      subtitle={subtitle}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="Apply"
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
