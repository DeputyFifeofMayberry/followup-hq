import type { ExecutionIntentSource, ExecutionSectionKey } from '../../types';

export type SupportLensKey = 'projects' | 'relationships';
export type SupportRecordType = 'project' | 'contact' | 'company' | 'relationship_summary';
export type SupportPressureTier = 'low' | 'moderate' | 'high' | 'critical';
export type SupportPressureSignal = 'overdue' | 'blocked' | 'waiting' | 'stale' | 'closeout' | 'at_risk' | 'doc_review';

export interface SupportPressureSummary {
  score: number;
  tier: SupportPressureTier;
  openFollowUpPressure: number;
  openTaskPressure: number;
  overduePressure: number;
  blockedPressure: number;
  waitingPressure: number;
  stalePressure: number;
  closeoutPressure: number;
  riskPressure: number;
  topSignals: SupportPressureSignal[];
  whyNow: string;
}

export interface SupportRouteAction {
  id: string;
  lane: 'followups' | 'tasks';
  section: ExecutionSectionKey;
  intentLabel: string;
  reason: string;
  origin: {
    source: ExecutionIntentSource;
    sourceRecordId: string;
    lens: SupportLensKey;
  };
}

export interface SupportLinkedWorkPreview {
  followUps: { totalOpen: number; overdue: number; waiting: number; previewIds: string[] };
  tasks: { totalOpen: number; blocked: number; overdue: number; previewIds: string[] };
}

export interface SupportMaintenanceCapability {
  canDeleteSafely: boolean;
  canReassignChildren: boolean;
  canMerge: boolean;
  supportsRelationshipReassignment: boolean;
}

export interface SupportRecordSurface {
  id: string;
  lens: SupportLensKey;
  recordType: SupportRecordType;
  title: string;
  subtitle: string;
  internalOwner: string;
  activeProjectCount: number;
  openWorkCount: number;
  riskTier: 'Low' | 'Medium' | 'High' | 'Critical';
  pressure: SupportPressureSummary;
  linkedWorkPreview: SupportLinkedWorkPreview;
  recommendedRoute: SupportRouteAction;
  contextSummary: string;
  maintenance: SupportMaintenanceCapability;
}

export interface SupportSelectedContext {
  identity: { title: string; subtitle: string; owner: string; riskTier: string };
  whyItMattersNow: string;
  recommendedNextMove: string;
  routeActions: SupportRouteAction[];
  linkedWork: SupportLinkedWorkPreview;
  supportingContext: string[];
  maintenance: SupportMaintenanceCapability;
}

export interface SupportSummaryStripMetrics {
  underPressure: number;
  overdue: number;
  blocked: number;
  waiting: number;
}

export interface SupportWorkspaceSessionState {
  selectedRecordId: string | null;
  searchQuery: string;
  sortKey: string;
  lastRouteTarget: 'followups' | 'tasks' | null;
  lastRouteReason: string | null;
  lastLinkedSubset: 'followups' | 'tasks' | null;
}
