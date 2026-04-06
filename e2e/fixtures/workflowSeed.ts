import { starterCompanies, starterContacts, starterIntakeDocuments, starterItems, starterProjects, starterSignals, starterTasks } from '../../src/lib/sample-data';

const LOCAL_CACHE_KEY = 'followup_hq_entities_cache_v2';
const APP_MODE_KEY = 'followup-hq:app-mode';
const E2E_MODE_KEY = 'setpoint:e2e-mode';

export function buildWorkflowSeed() {
  const now = new Date().toISOString();
  return {
    entities: {
      items: starterItems,
      tasks: starterTasks,
      projects: starterProjects,
      contacts: starterContacts,
      companies: starterCompanies,
      auxiliary: {
        intakeSignals: starterSignals,
        intakeDocuments: starterIntakeDocuments,
        dismissedDuplicatePairs: [],
        droppedEmailImports: [],
        outlookConnection: {
          settings: {
            graphEnabled: false,
            includeRead: false,
            includeStarredOnly: false,
            includeSubjectKeywords: [],
            includeBodyKeywords: [],
            includeFromDomains: [],
            includeFromAddresses: [],
            includeThreadKeywords: [],
            lookbackDays: 14,
            maxMessages: 150,
            mailboxAddress: '',
            aliasAddresses: [],
          },
          mailboxLinked: false,
          syncStatus: 'idle',
          syncCursorByFolder: { inbox: {}, sentitems: {} },
        },
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
        savedFollowUpViews: [],
        followUpTableDensity: 'compact',
        followUpDuplicateModule: 'auto',
      },
    },
    updatedAt: now,
    cloudStatus: 'confirmed',
    lastCloudConfirmedAt: now,
  };
}

export function seedWorkflowLocalCache() {
  const payload = buildWorkflowSeed();
  window.localStorage.clear();
  window.localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(payload));
  window.localStorage.setItem(APP_MODE_KEY, 'personal');
  window.localStorage.setItem(E2E_MODE_KEY, '1');
  (window as Window & { __SETPOINT_E2E__?: boolean }).__SETPOINT_E2E__ = true;
}
