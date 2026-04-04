import type { CaptureCleanupReason, ContactRecord, FollowUpPriority, FollowUpStatus, ProjectRecord, TaskPriority, TaskStatus } from '../types';
import { addDaysIso, todayIso } from './utils';

export type CaptureKind = 'followup' | 'task';
export type CaptureFieldStatus = 'explicit' | 'matched' | 'inferred' | 'contextual' | 'missing' | 'conflicting';

export interface CaptureFieldEvidence {
  field: 'kind' | 'title' | 'project' | 'owner' | 'dueDate' | 'priority' | 'waitingOn' | 'nextAction' | 'nextStep';
  status: CaptureFieldStatus;
  confidence: number;
  source: 'explicit_token' | 'known_match' | 'context' | 'heuristic' | 'derived' | 'missing' | 'conflict';
  value?: string;
  reasons: string[];
}

export interface ParseUniversalCaptureOptions {
  knownProjects?: Pick<ProjectRecord, 'id' | 'name' | 'aliases'>[];
  knownOwners?: Pick<ContactRecord, 'id' | 'name' | 'aliases'>[];
  contextProject?: string;
  contextOwner?: string;
  recentProject?: string;
  recentOwner?: string;
  referenceDate?: Date;
}

export interface UniversalCaptureDraft {
  kind: CaptureKind;
  rawText: string;
  title: string;
  project?: string;
  projectId?: string;
  owner?: string;
  assigneeDisplayName?: string;
  waitingOn?: string;
  dueDate?: string;
  priority: FollowUpPriority | TaskPriority;
  status?: FollowUpStatus | TaskStatus;
  nextAction?: string;
  nextStep?: string;
  linkedFollowUpId?: string;
  contextNote?: string;
  companyId?: string;
  contactId?: string;
  confidence: number;
  cleanupReasons: CaptureCleanupReason[];
  fieldEvidence?: Record<CaptureFieldEvidence['field'], CaptureFieldEvidence>;
  normalizedTokens?: string[];
  parserNotes?: string[];
}

interface ExplicitTokens {
  project?: string;
  owner?: string;
  due?: string;
  priority?: string;
  wait?: string;
  kind?: CaptureKind;
}

interface MatchResult {
  value?: string;
  id?: string;
  status: CaptureFieldStatus;
  confidence: number;
  source: CaptureFieldEvidence['source'];
  reasons: string[];
}

const weekdayMap: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

const FOLLOWUP_PATTERNS = /(follow\s*-?up|check\s+on|waiting\s+on|nudge|ping|confirm\s+response|see\s+if|replied|reply|response)/i;
const TASK_PATTERNS = /(update|draft|send|submit|revise|build|close\s*out|review|deliver|call\s+vendor|confirm\s+delivery|complete|finish)/i;

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeCaptureInput(input: string): { rawText: string; normalizedText: string; normalizedTokens: string[] } {
  const rawText = input.trim();
  const normalizedText = rawText
    .replace(/[“”]/g, '"')
    .replace(/[’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  const normalizedTokens = normalizedText.toLowerCase().match(/[a-z0-9#:/-]+/g) ?? [];
  return { rawText, normalizedText, normalizedTokens };
}

export function extractExplicitTokens(input: string): ExplicitTokens {
  const readToken = (keys: string[]): string | undefined => {
    for (const key of keys) {
      const match = input.match(new RegExp(`(?:^|\\s)${key}\\s*:\\s*([^#]+?)(?=\\s+[a-z]+\\s*:|\\s+#|$)`, 'i'));
      if (match?.[1]) return match[1].trim();
    }
    return undefined;
  };

  const kind = /#task\b/i.test(input)
    ? 'task'
    : /#followup\b/i.test(input)
      ? 'followup'
      : undefined;

  return {
    project: readToken(['p', 'project']),
    owner: readToken(['o', 'owner']),
    due: readToken(['d', 'due', 'by']),
    priority: readToken(['pri', 'priority']),
    wait: readToken(['wait', 'waiting']),
    kind,
  };
}

export function matchKnownProject(input: string | undefined, options: ParseUniversalCaptureOptions): MatchResult {
  if (!input?.trim()) {
    if (options.contextProject?.trim()) {
      return { value: options.contextProject.trim(), status: 'contextual', confidence: 0.62, source: 'context', reasons: ['Project inherited from current workspace context.'] };
    }
    if (options.recentProject?.trim()) {
      return { value: options.recentProject.trim(), status: 'contextual', confidence: 0.44, source: 'context', reasons: ['Project inherited from recent entry context.'] };
    }
    return { status: 'missing', confidence: 0.12, source: 'missing', reasons: ['No project token or match found.'] };
  }

  const target = input.trim();
  const targetNorm = normalizeForMatch(target);
  const known = options.knownProjects ?? [];
  const exact = known.find((project) => [project.name, ...(project.aliases ?? [])].some((candidate) => normalizeForMatch(candidate) === targetNorm));
  if (exact) {
    return { value: exact.name, id: exact.id, status: 'matched', confidence: 0.92, source: 'known_match', reasons: ['Project matched existing project directory.'] };
  }

  const fuzzy = known
    .map((project) => ({
      project,
      score: [project.name, ...(project.aliases ?? [])].reduce((best, candidate) => {
        const normalized = normalizeForMatch(candidate);
        if (!normalized) return best;
        if (normalized.includes(targetNorm) || targetNorm.includes(normalized)) return Math.max(best, normalized.length / Math.max(targetNorm.length, normalized.length));
        return best;
      }, 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (fuzzy && fuzzy.score >= 0.68) {
    return { value: fuzzy.project.name, id: fuzzy.project.id, status: 'matched', confidence: 0.72, source: 'known_match', reasons: ['Project fuzzy-matched to known project.'] };
  }

  return { value: target, status: 'inferred', confidence: 0.55, source: 'heuristic', reasons: ['Project detected from text but no known match found.'] };
}

export function matchKnownOwner(input: string | undefined, options: ParseUniversalCaptureOptions): MatchResult {
  if (!input?.trim()) {
    if (options.contextOwner?.trim()) {
      return { value: options.contextOwner.trim(), status: 'contextual', confidence: 0.6, source: 'context', reasons: ['Owner inherited from current workspace context.'] };
    }
    if (options.recentOwner?.trim()) {
      return { value: options.recentOwner.trim(), status: 'contextual', confidence: 0.42, source: 'context', reasons: ['Owner inherited from recent entry context.'] };
    }
    return { status: 'missing', confidence: 0.12, source: 'missing', reasons: ['No owner token or owner phrase found.'] };
  }

  const target = input.trim();
  const targetNorm = normalizeForMatch(target);
  const known = options.knownOwners ?? [];
  const exact = known.find((owner) => [owner.name, ...(owner.aliases ?? [])].some((candidate) => normalizeForMatch(candidate) === targetNorm));
  if (exact) {
    return { value: exact.name, id: exact.id, status: 'matched', confidence: 0.9, source: 'known_match', reasons: ['Owner matched known contact.'] };
  }

  const fuzzy = known
    .map((owner) => ({
      owner,
      score: [owner.name, ...(owner.aliases ?? [])].reduce((best, candidate) => {
        const normalized = normalizeForMatch(candidate);
        if (normalized.startsWith(targetNorm) || targetNorm.startsWith(normalized)) return Math.max(best, 0.72);
        if (normalized.includes(targetNorm) || targetNorm.includes(normalized)) return Math.max(best, 0.66);
        return best;
      }, 0),
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (fuzzy && fuzzy.score >= 0.66) {
    return { value: fuzzy.owner.name, id: fuzzy.owner.id, status: 'matched', confidence: 0.7, source: 'known_match', reasons: ['Owner fuzzy-matched to known contact.'] };
  }

  return { value: target, status: 'inferred', confidence: 0.52, source: 'heuristic', reasons: ['Owner detected in text without strong known match.'] };
}

export function inferCaptureKind(input: string, tokens: ExplicitTokens): MatchResult {
  if (tokens.kind) {
    return { value: tokens.kind, status: 'explicit', confidence: 0.97, source: 'explicit_token', reasons: ['Kind set by explicit #task/#followup token.'] };
  }
  const lower = input.toLowerCase();
  const followSignals = Number(FOLLOWUP_PATTERNS.test(lower)) + Number(/\b(waiting for|waiting on|pending response|check in|check on)\b/.test(lower));
  const taskSignals = Number(TASK_PATTERNS.test(lower)) + Number(/\b(task|todo|to do|deliverable|work item)\b/.test(lower));

  if (followSignals > taskSignals) {
    return { value: 'followup', status: 'inferred', confidence: clamp(0.62 + (followSignals - taskSignals) * 0.1), source: 'heuristic', reasons: ['Follow-up language outweighed task-delivery language.'] };
  }
  if (taskSignals > followSignals) {
    return { value: 'task', status: 'inferred', confidence: clamp(0.62 + (taskSignals - followSignals) * 0.1), source: 'heuristic', reasons: ['Task action verbs outweighed communication/follow-through language.'] };
  }
  return { value: 'followup', status: 'conflicting', confidence: 0.38, source: 'conflict', reasons: ['Task vs follow-up intent was ambiguous. Routed toward review-safe default.'] };
}

export function inferDueDate(input: string, tokenDue?: string, referenceDate = new Date()): MatchResult {
  const lower = (tokenDue || input).toLowerCase();
  const today = todayIso();
  const toIsoDate = (yyyyMmDd: string) => new Date(`${yyyyMmDd}T12:00:00`).toISOString();
  const setWeekday = (weekday: number) => {
    const diff = (weekday - referenceDate.getDay() + 7) % 7 || 7;
    return addDaysIso(today, diff);
  };

  const isoMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return { value: toIsoDate(isoMatch[1]), status: tokenDue ? 'explicit' : 'inferred', confidence: tokenDue ? 0.94 : 0.8, source: tokenDue ? 'explicit_token' : 'heuristic', reasons: ['Detected ISO due date format.'] };

  const shortMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
  if (shortMatch) {
    const year = shortMatch[3] ? Number(shortMatch[3].length === 2 ? `20${shortMatch[3]}` : shortMatch[3]) : referenceDate.getFullYear();
    const month = shortMatch[1].padStart(2, '0');
    const day = shortMatch[2].padStart(2, '0');
    return { value: toIsoDate(`${year}-${month}-${day}`), status: tokenDue ? 'explicit' : 'inferred', confidence: tokenDue ? 0.88 : 0.74, source: tokenDue ? 'explicit_token' : 'heuristic', reasons: ['Detected short date format and normalized to ISO timestamp.'] };
  }

  if (/\btoday\b/.test(lower)) return { value: today, status: tokenDue ? 'explicit' : 'inferred', confidence: 0.84, source: tokenDue ? 'explicit_token' : 'heuristic', reasons: ['Detected "today" timing language.'] };
  if (/\btomorrow\b/.test(lower)) return { value: addDaysIso(today, 1), status: tokenDue ? 'explicit' : 'inferred', confidence: 0.86, source: tokenDue ? 'explicit_token' : 'heuristic', reasons: ['Detected "tomorrow" timing language.'] };
  if (/\bnext week\b/.test(lower)) return { value: addDaysIso(today, 7), status: 'inferred', confidence: 0.55, source: 'heuristic', reasons: ['Detected "next week" (kept broad and lower confidence).'] };
  if (/\b(eow|end of week)\b/.test(lower)) return { value: addDaysIso(today, Math.max(1, 5 - referenceDate.getDay())), status: 'inferred', confidence: 0.58, source: 'heuristic', reasons: ['Detected end-of-week target (weekday precision only).'] };
  if (/\bthis afternoon\b/.test(lower)) return { value: today, status: 'inferred', confidence: 0.5, source: 'heuristic', reasons: ['Detected "this afternoon"; normalized to today with lower certainty.'] };

  const weekdayMatch = lower.match(/\b(?:by|due|before|on)?\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    return { value: setWeekday(weekdayMap[weekdayMatch[1]]), status: 'inferred', confidence: /\bby|due|before\b/.test(lower) ? 0.72 : 0.64, source: 'heuristic', reasons: [`Detected weekday target: ${weekdayMatch[1]}.`] };
  }

  if (/\basap\b/.test(lower)) {
    return { status: 'inferred', confidence: 0.45, source: 'heuristic', reasons: ['Detected ASAP urgency; mapped to priority signal without forcing exact due date.'] };
  }

  return { status: 'missing', confidence: 0.18, source: 'missing', reasons: ['No deterministic due-date signal detected.'] };
}

export function inferPriority(input: string, tokenPriority?: string): MatchResult {
  const lower = `${tokenPriority ? `pri:${tokenPriority}` : ''} ${input}`.toLowerCase();
  if (/\b(critical|urgent|red flag|hot|pri:critical|asap)\b/.test(lower)) return { value: 'Critical', status: tokenPriority ? 'explicit' : 'inferred', confidence: tokenPriority ? 0.94 : 0.78, source: tokenPriority ? 'explicit_token' : 'heuristic', reasons: ['Urgency language indicates critical priority.'] };
  if (/\b(high|important|priority|pri:high)\b/.test(lower)) return { value: 'High', status: tokenPriority ? 'explicit' : 'inferred', confidence: tokenPriority ? 0.92 : 0.72, source: tokenPriority ? 'explicit_token' : 'heuristic', reasons: ['Priority language indicates high urgency.'] };
  if (/\b(low|later|someday|pri:low)\b/.test(lower)) return { value: 'Low', status: tokenPriority ? 'explicit' : 'inferred', confidence: tokenPriority ? 0.9 : 0.68, source: tokenPriority ? 'explicit_token' : 'heuristic', reasons: ['Priority language indicates low urgency.'] };
  return { value: 'Medium', status: 'inferred', confidence: 0.52, source: 'derived', reasons: ['Priority defaulted to Medium due to no explicit urgency signal.'] };
}

export function deriveCaptureTitle(input: string): MatchResult {
  const cleaned = input
    .replace(/(?:^|\s)(?:p|project|o|owner|d|due|pri|priority|wait|waiting|by)\s*:[^#]+?(?=\s+[a-z]+\s*:|\s+#|$)/gi, ' ')
    .replace(/#(?:task|followup|blocked|email)\b/gi, ' ')
    .replace(/\b(?:for|on|about)\s+[A-Z][a-z]+\b$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) {
    return { value: 'Untitled capture', status: 'missing', confidence: 0.1, source: 'missing', reasons: ['Unable to derive a usable title from the capture text.'] };
  }
  if (cleaned.length < 8 || /^(today|tomorrow|waiting on|project\s+\w+)$/i.test(cleaned)) {
    return { value: cleaned, status: 'inferred', confidence: 0.34, source: 'heuristic', reasons: ['Derived title is short/generic and should be reviewed.'] };
  }
  return { value: cleaned[0].toUpperCase() + cleaned.slice(1), status: 'inferred', confidence: 0.82, source: 'derived', reasons: ['Title cleaned by stripping capture tokens and metadata phrases.'] };
}

export function deriveFollowUpNextAction(title: string, waitingOn?: string): MatchResult {
  if (waitingOn) {
    return { value: `Follow up on ${waitingOn}`, status: 'inferred', confidence: 0.78, source: 'derived', reasons: ['Waiting-on signal converted into follow-up action phrasing.'] };
  }
  return { value: title, status: 'inferred', confidence: 0.7, source: 'derived', reasons: ['Follow-up next action derived from parsed title.'] };
}

export function deriveTaskNextStep(title: string): MatchResult {
  return { value: title, status: 'inferred', confidence: title.length > 10 ? 0.74 : 0.5, source: 'derived', reasons: ['Task next step derived from cleaned title.'] };
}

export function buildCaptureFieldEvidence(input: {
  kind: MatchResult;
  title: MatchResult;
  project: MatchResult;
  owner: MatchResult;
  dueDate: MatchResult;
  priority: MatchResult;
  waitingOn: MatchResult;
  nextAction: MatchResult;
  nextStep: MatchResult;
}): Record<CaptureFieldEvidence['field'], CaptureFieldEvidence> {
  const toEvidence = (field: CaptureFieldEvidence['field'], match: MatchResult): CaptureFieldEvidence => ({
    field,
    status: match.status,
    confidence: clamp(match.confidence),
    source: match.source,
    value: match.value,
    reasons: match.reasons,
  });

  return {
    kind: toEvidence('kind', input.kind),
    title: toEvidence('title', input.title),
    project: toEvidence('project', input.project),
    owner: toEvidence('owner', input.owner),
    dueDate: toEvidence('dueDate', input.dueDate),
    priority: toEvidence('priority', input.priority),
    waitingOn: toEvidence('waitingOn', input.waitingOn),
    nextAction: toEvidence('nextAction', input.nextAction),
    nextStep: toEvidence('nextStep', input.nextStep),
  };
}

export function calculateCaptureConfidence(fieldEvidence: Record<CaptureFieldEvidence['field'], CaptureFieldEvidence>): { confidence: number; cleanupReasons: CaptureCleanupReason[]; parserNotes: string[] } {
  const requiredKeys: CaptureFieldEvidence['field'][] = ['kind', 'title', 'project', 'owner', 'dueDate'];
  const average = Object.values(fieldEvidence).reduce((sum, field) => sum + field.confidence, 0) / Object.values(fieldEvidence).length;
  const requiredPenalty = requiredKeys.reduce((penalty, key) => penalty + (fieldEvidence[key].confidence < 0.45 ? 0.08 : 0), 0);
  const conflictPenalty = Object.values(fieldEvidence).some((field) => field.status === 'conflicting') ? 0.16 : 0;
  const confidence = clamp(average - requiredPenalty - conflictPenalty);

  const cleanupReasons: CaptureCleanupReason[] = [];
  if (!fieldEvidence.project.value) cleanupReasons.push('missing_project');
  if (!fieldEvidence.owner.value) cleanupReasons.push('missing_owner');
  if (!fieldEvidence.dueDate.value) cleanupReasons.push('missing_due_date');
  if ((fieldEvidence.title.value || '').trim().length < 8 || fieldEvidence.title.confidence < 0.5) cleanupReasons.push('low_confidence_title');
  if (fieldEvidence.kind.confidence < 0.5 || fieldEvidence.kind.status === 'conflicting') cleanupReasons.push('unclear_type');

  const parserNotes = [
    `Overall parser confidence ${confidence.toFixed(2)}.`,
    ...Object.values(fieldEvidence).flatMap((field) => field.reasons.slice(0, 1)).slice(0, 8),
  ];

  return { confidence, cleanupReasons, parserNotes };
}

export function parseUniversalCapture(input: string, options: ParseUniversalCaptureOptions = {}): UniversalCaptureDraft {
  const { rawText, normalizedText, normalizedTokens } = normalizeCaptureInput(input);
  const explicitTokens = extractExplicitTokens(normalizedText);

  const projectHint = explicitTokens.project
    || normalizedText.match(/\b(?:project|job|on)\s*[:#-]?\s*([A-Za-z0-9][a-zA-Z0-9 .&-]{2,60})/i)?.[1]?.trim();
  const ownerHint = explicitTokens.owner
    || normalizedText.match(/\b(?:owner|assign(?:ed)?\s+to|for)\s*[:-]?\s*([a-zA-Z][a-zA-Z .'-]{1,40})/i)?.[1]?.trim();
  const waitingOn = explicitTokens.wait
    || normalizedText.match(/\bwaiting on\s+([a-zA-Z0-9][a-zA-Z0-9 .&'-]{1,60})/i)?.[1]?.trim()
    || normalizedText.match(/\bfrom\s+([A-Z][a-zA-Z0-9 .&'-]{1,50})/)?.[1]?.trim();

  const projectMatch = explicitTokens.project
    ? { ...matchKnownProject(explicitTokens.project, options), status: 'explicit' as const, confidence: 0.96, source: 'explicit_token' as const, reasons: ['Project set with explicit token.'] }
    : matchKnownProject(projectHint, options);
  const ownerMatch = explicitTokens.owner
    ? { ...matchKnownOwner(explicitTokens.owner, options), status: 'explicit' as const, confidence: 0.95, source: 'explicit_token' as const, reasons: ['Owner set with explicit token.'] }
    : matchKnownOwner(ownerHint, options);

  const kindMatch = inferCaptureKind(normalizedText, explicitTokens);
  const dueDateMatch = inferDueDate(normalizedText, explicitTokens.due, options.referenceDate);
  const priorityMatch = inferPriority(normalizedText, explicitTokens.priority);
  const titleMatch = deriveCaptureTitle(normalizedText);
  const waitingOnMatch: MatchResult = waitingOn
    ? { value: waitingOn, status: explicitTokens.wait ? 'explicit' : 'inferred', confidence: explicitTokens.wait ? 0.92 : 0.66, source: explicitTokens.wait ? 'explicit_token' : 'heuristic', reasons: [explicitTokens.wait ? 'Waiting-on value set with explicit token.' : 'Waiting-on phrase found in free text.'] }
    : { status: 'missing', confidence: 0.2, source: 'missing', reasons: ['No waiting-on entity found.'] };

  const followUpAction = deriveFollowUpNextAction(titleMatch.value || normalizedText, waitingOnMatch.value);
  const taskStep = deriveTaskNextStep(titleMatch.value || normalizedText);

  const nextActionMatch = kindMatch.value === 'followup' ? followUpAction : { status: 'missing' as const, confidence: 0.2, source: 'missing' as const, reasons: ['Next action is only used for follow-ups.'] };
  const nextStepMatch = kindMatch.value === 'task' ? taskStep : { status: 'missing' as const, confidence: 0.2, source: 'missing' as const, reasons: ['Next step is only used for tasks.'] };

  const fieldEvidence = buildCaptureFieldEvidence({
    kind: kindMatch,
    title: titleMatch,
    project: projectMatch,
    owner: ownerMatch,
    dueDate: dueDateMatch,
    priority: priorityMatch,
    waitingOn: waitingOnMatch,
    nextAction: nextActionMatch,
    nextStep: nextStepMatch,
  });

  const confidencePackage = calculateCaptureConfidence(fieldEvidence);
  const kind = (kindMatch.value as CaptureKind) || 'followup';

  return {
    kind,
    rawText,
    title: titleMatch.value || rawText,
    project: projectMatch.value,
    projectId: projectMatch.id,
    owner: ownerMatch.value,
    waitingOn: waitingOnMatch.value,
    dueDate: dueDateMatch.value,
    priority: (priorityMatch.value as FollowUpPriority) || 'Medium',
    status: kind === 'task' ? 'To do' : waitingOnMatch.value ? 'Waiting on external' : 'Needs action',
    nextAction: kind === 'followup' ? (nextActionMatch.value || titleMatch.value) : undefined,
    nextStep: kind === 'task' ? (nextStepMatch.value || titleMatch.value) : undefined,
    confidence: confidencePackage.confidence,
    cleanupReasons: confidencePackage.cleanupReasons,
    fieldEvidence,
    normalizedTokens,
    parserNotes: confidencePackage.parserNotes,
  };
}
