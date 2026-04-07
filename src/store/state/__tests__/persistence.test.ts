import { starterCompanies, starterContacts, starterItems, starterProjects, starterTasks } from '../../../lib/sample-data';
import { defaultFollowUpFilters } from '../../../lib/followUpSelectors';
import { buildPersistedPayload } from '../persistence';
import { initialBusinessState } from '../initialState';
import { DEFAULT_REMINDER_CENTER_SUMMARY, DEFAULT_REMINDER_PREFERENCES, DEFAULT_WORKSPACE_ATTENTION_COUNTS } from '../../../lib/reminders';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

export function runPersistenceChecks() {
  const payload = buildPersistedPayload({
    items: starterItems,
    contacts: starterContacts,
    companies: starterCompanies,
    projects: starterProjects,
    tasks: starterTasks,
    intakeSignals: [],
    intakeDocuments: [],
    dismissedDuplicatePairs: [],
    droppedEmailImports: [],
    outlookConnection: initialBusinessState.outlookConnection,
    outlookMessages: [],
    forwardedEmails: [],
    forwardedRules: [],
    forwardedCandidates: [],
    forwardedLedger: [],
    forwardedRoutingAudit: [],
    intakeCandidates: [],
    intakeAssets: [],
    intakeBatches: [],
    intakeWorkCandidates: [],
    intakeReviewerFeedback: [],
    savedExecutionViews: [],
    followUpFilters: defaultFollowUpFilters,
    followUpColumns: ['title'],
    savedFollowUpViews: [],
    followUpTableDensity: 'compact',
    followUpDuplicateModule: 'auto',
    reminderPreferences: DEFAULT_REMINDER_PREFERENCES,
    reminderLedger: [],
    reminderCenterSummary: DEFAULT_REMINDER_CENTER_SUMMARY,
    workspaceAttentionCounts: DEFAULT_WORKSPACE_ATTENTION_COUNTS,
  });

  assert(payload.items.length === starterItems.length, 'payload items should persist all follow-ups');
  assert(payload.tasks.length === starterTasks.length, 'payload tasks should persist all tasks');
  assert(payload.auxiliary.followUpFilters?.project === 'All', 'payload should keep follow-up filter defaults');
}

runPersistenceChecks();
