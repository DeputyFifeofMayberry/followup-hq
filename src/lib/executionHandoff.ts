import type { ExecutionIntent, ExecutionIntentSource } from '../types';

export const executionSourceLabel: Record<ExecutionIntentSource, string> = {
  overview: 'Overview',
  outlook: 'Intake',
  projects: 'Projects',
  relationships: 'Relationships',
};

export function describeExecutionIntent(intent: ExecutionIntent): string {
  const source = intent.source ? executionSourceLabel[intent.source] : 'Overview';
  const intentLabel = intent.intentLabel ? ` • ${intent.intentLabel}` : '';
  const section = intent.section ? ` • ${intent.section.replace('_', ' ')}` : '';
  return `Opened from ${source}${intentLabel}${section}.`;
}
