import { Sparkles } from 'lucide-react';
import { useEffect } from 'react';
import type { AppMode } from '../../types';
import { useFollowUpsViewModel } from '../../domains/followups';
import { WorkspacePage, WorkspaceTopStack, WorkspaceSummaryStrip, SectionHeader, StatTile, WorkspacePrimaryLayout, AppShellCard } from '../ui/AppPrimitives';
import { ControlBar } from '../ControlBar';
import { TrackerTable } from '../TrackerTable';
import { DuplicateReviewPanel } from '../DuplicateReviewPanel';
import { ItemDetailPanel } from '../ItemDetailPanel';
import { describeExecutionIntent } from '../../lib/executionHandoff';

export function TrackerWorkspace({ personalMode, appMode }: { personalMode: boolean; appMode: AppMode }) {
  const { followUpStats, openTaskCount, openCreateModal, executionIntent, clearExecutionIntent, setSelectedId } = useFollowUpsViewModel();

  useEffect(() => {
    if (executionIntent?.target !== 'followups') return;
    if (executionIntent.recordType === 'followup' && executionIntent.recordId) {
      setSelectedId(executionIntent.recordId);
    }
    clearExecutionIntent();
  }, [executionIntent, clearExecutionIntent, setSelectedId]);

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <WorkspaceSummaryStrip className="overview-hero-card">
          <SectionHeader title="Follow-up execution lane" subtitle={personalMode ? 'Run follow-up commitments and close loops quickly.' : 'Run team follow-up commitments, nudges, and closeout decisions.'} actions={<button onClick={openCreateModal} className="primary-btn"><Sparkles className="h-4 w-4" />Add follow-up</button>} compact />
          <div className="overview-stat-grid overview-stat-grid-compact">
            <StatTile label="Visible follow-ups" value={followUpStats.total} helper="Current filtered queue" />
            <StatTile label="Overdue" value={followUpStats.overdue} helper="Past due date" tone={followUpStats.overdue ? 'warn' : 'default'} />
            <StatTile label="Needs nudge" value={followUpStats.needsNudge} helper="Touch timing drift" tone={followUpStats.needsNudge ? 'warn' : 'default'} />
            <StatTile label="Open tasks" value={openTaskCount} helper="Cross-workspace pressure" />
          </div>
          {executionIntent?.target === 'followups' ? <div className="text-xs text-slate-600">{describeExecutionIntent(executionIntent)}</div> : null}
          <div className="workspace-toolbar-row overview-support-row">
            <span className="overview-inline-guidance"><strong>Follow-up loop:</strong> Scan queue → run quick actions → finish decisions in inspector.</span>
            <span className="overview-inline-guidance">Bulk actions appear below filters whenever rows are selected.</span>
          </div>
        </WorkspaceSummaryStrip>
      </WorkspaceTopStack>
      <WorkspacePrimaryLayout className="tracker-main-grid" inspectorWidth="420px">
        <AppShellCard className="workspace-list-panel tracker-workspace-main" surface="data">
          <SectionHeader title="Follow-up queue" subtitle="Focused lane list with contextual bulk actions and inspector-first decisions." compact />
          <ControlBar compact />
          <TrackerTable personalMode={personalMode} appMode={appMode} embedded />
          <DuplicateReviewPanel />
        </AppShellCard>
        <ItemDetailPanel personalMode={personalMode} />
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
