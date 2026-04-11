import type { PersistedPayload } from '../../lib/persistence';
import type { FollowUpAdvancedFilters, FollowUpColumnKey, SavedFollowUpCustomView, SavedExecutionView, FollowUpTableDensity, FollowUpDuplicateModuleMode } from '../../types';
import type { AppBusinessState } from './types';

export type PersistableAppState = Pick<AppBusinessState, 'items' | 'contacts' | 'companies' | 'projects' | 'tasks' | 'intakeSignals' | 'intakeDocuments' | 'dismissedDuplicatePairs' | 'droppedEmailImports' | 'outlookConnection' | 'outlookMessages' | 'forwardedEmails' | 'forwardedRules' | 'forwardedCandidates' | 'forwardedLedger' | 'forwardedRoutingAudit' | 'intakeCandidates' | 'intakeAssets' | 'intakeBatches' | 'intakeWorkCandidates' | 'intakeReviewerFeedback'> & {
  savedExecutionViews: SavedExecutionView[];
  followUpFilters: FollowUpAdvancedFilters;
  taskWorkspaceSession: PersistedPayload['auxiliary']['taskWorkspaceSession'];
  followUpColumns: FollowUpColumnKey[];
  savedFollowUpViews: SavedFollowUpCustomView[];
  followUpTableDensity: FollowUpTableDensity;
  followUpDuplicateModule: FollowUpDuplicateModuleMode;
  reminderPreferences: PersistedPayload['auxiliary']['reminderPreferences'];
  reminderLedger: PersistedPayload['auxiliary']['reminderLedger'];
  reminderCenterSummary: PersistedPayload['auxiliary']['reminderCenterSummary'];
  workspaceAttentionCounts: PersistedPayload['auxiliary']['workspaceAttentionCounts'];
};

export function buildPersistedPayload(state: PersistableAppState): PersistedPayload {
  return {
    items: state.items,
    contacts: state.contacts,
    companies: state.companies,
    projects: state.projects,
    tasks: state.tasks,
    auxiliary: {
      intakeSignals: state.intakeSignals,
      intakeDocuments: state.intakeDocuments,
      dismissedDuplicatePairs: state.dismissedDuplicatePairs,
      droppedEmailImports: state.droppedEmailImports,
      outlookConnection: state.outlookConnection,
      outlookMessages: state.outlookMessages,
      forwardedEmails: state.forwardedEmails,
      forwardedRules: state.forwardedRules,
      forwardedCandidates: state.forwardedCandidates,
      forwardedLedger: state.forwardedLedger,
      forwardedRoutingAudit: state.forwardedRoutingAudit,
      intakeCandidates: state.intakeCandidates,
      intakeAssets: state.intakeAssets,
      intakeBatches: state.intakeBatches,
      intakeWorkCandidates: state.intakeWorkCandidates,
      intakeReviewerFeedback: state.intakeReviewerFeedback,
      savedExecutionViews: state.savedExecutionViews,
      followUpFilters: state.followUpFilters,
      taskWorkspaceSession: state.taskWorkspaceSession,
      followUpColumns: state.followUpColumns,
      savedFollowUpViews: state.savedFollowUpViews,
      followUpTableDensity: state.followUpTableDensity,
      followUpDuplicateModule: state.followUpDuplicateModule,
      reminderPreferences: state.reminderPreferences,
      reminderLedger: state.reminderLedger,
      reminderCenterSummary: state.reminderCenterSummary,
      workspaceAttentionCounts: state.workspaceAttentionCounts,
    },
  };
}
