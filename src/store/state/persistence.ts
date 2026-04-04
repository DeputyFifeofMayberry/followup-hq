import type { PersistedPayload } from '../../lib/persistence';
import type { FollowUpAdvancedFilters, FollowUpColumnKey, SavedFollowUpCustomView, SavedExecutionView } from '../../types';
import type { AppBusinessState } from './types';

export type PersistableAppState = Pick<AppBusinessState, 'items' | 'contacts' | 'companies' | 'projects' | 'tasks' | 'intakeSignals' | 'intakeDocuments' | 'dismissedDuplicatePairs' | 'droppedEmailImports' | 'outlookConnection' | 'outlookMessages' | 'forwardedEmails' | 'forwardedRules' | 'forwardedCandidates' | 'forwardedLedger' | 'forwardedRoutingAudit' | 'intakeCandidates' | 'intakeAssets' | 'intakeBatches' | 'intakeWorkCandidates' | 'intakeReviewerFeedback'> & {
  savedExecutionViews: SavedExecutionView[];
  followUpFilters: FollowUpAdvancedFilters;
  followUpColumns: FollowUpColumnKey[];
  savedFollowUpViews: SavedFollowUpCustomView[];
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
      followUpColumns: state.followUpColumns,
      savedFollowUpViews: state.savedFollowUpViews,
    },
  };
}
