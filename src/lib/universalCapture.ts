import type { CaptureCleanupReason, FollowUpPriority, FollowUpStatus, TaskPriority, TaskStatus } from '../types';
import { addDaysIso, todayIso } from './utils';

export type CaptureKind = 'followup' | 'task';

export interface UniversalCaptureDraft {
  kind: CaptureKind;
  rawText: string;
  title: string;
  project?: string;
  owner?: string;
  waitingOn?: string;
  dueDate?: string;
  priority: FollowUpPriority | TaskPriority;
  status?: FollowUpStatus | TaskStatus;
  nextAction?: string;
  nextStep?: string;
  confidence: number;
  cleanupReasons: CaptureCleanupReason[];
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

function parseDueDate(input: string): string | undefined {
  const lower = input.toLowerCase();
  const isoMatch = lower.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (isoMatch) return new Date(`${isoMatch[1]}T12:00:00`).toISOString();
  const shortMatch = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (shortMatch) {
    const year = new Date().getFullYear();
    const month = shortMatch[1].padStart(2, '0');
    const day = shortMatch[2].padStart(2, '0');
    return new Date(`${year}-${month}-${day}T12:00:00`).toISOString();
  }
  if (lower.includes('tomorrow')) return addDaysIso(todayIso(), 1);
  if (lower.includes('today') || lower.includes('asap')) return todayIso();
  if (lower.includes('next week')) return addDaysIso(todayIso(), 7);
  if (lower.includes('eow') || lower.includes('end of week')) return addDaysIso(todayIso(), Math.max(1, 5 - new Date().getDay()));
  const weekday = Object.keys(weekdayMap).find((name) => lower.includes(name));
  if (!weekday) return undefined;
  const now = new Date();
  const day = weekdayMap[weekday];
  const diff = (day - now.getDay() + 7) % 7 || 7;
  return addDaysIso(todayIso(), diff);
}

function parsePriority(input: string): FollowUpPriority {
  const lower = input.toLowerCase();
  if (/\b(critical|urgent|red flag|hot|pri:critical)\b/.test(lower)) return 'Critical';
  if (/\b(high|important|priority|pri:high)\b/.test(lower)) return 'High';
  if (/\b(low|later|someday|pri:low)\b/.test(lower)) return 'Low';
  return 'Medium';
}

function readToken(input: string, keys: string[]): string | undefined {
  for (const key of keys) {
    const match = input.match(new RegExp(`(?:^|\\s)${key}:([^\\s#]+)`, 'i'));
    if (match?.[1]) return match[1].trim();
  }
  return undefined;
}

function stripTokens(input: string): string {
  return input
    .replace(/(?:^|\s)(?:p|project|o|owner|d|due|pri|priority|wait|waiting)\s*:[^\s#]+/gi, ' ')
    .replace(/#(?:task|followup|blocked|email)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function parseUniversalCapture(input: string): UniversalCaptureDraft {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const tokenProject = readToken(clean, ['p', 'project']);
  const tokenOwner = readToken(clean, ['o', 'owner']);
  const tokenDue = readToken(clean, ['d', 'due']);
  const tokenPriority = readToken(clean, ['pri', 'priority']);
  const waitingOn = readToken(clean, ['wait', 'waiting'])
    || clean.match(/\bwaiting on\s+([a-zA-Z0-9][a-zA-Z0-9 .&'-]{1,60})/i)?.[1]?.trim()
    || clean.match(/\bfrom\s+([A-Z][a-zA-Z0-9 .&'-]{1,50})/)?.[1]?.trim();

  const hashTask = /#task\b/i.test(clean);
  const hashFollowup = /#followup\b/i.test(clean);
  const pmTaskPhrase = /\b(fix|submit|update|draft|build|close|review|ship|deliver|send)\b/.test(lower);
  const pmFollowPhrase = /\b(follow\s*-?up|waiting on|nudge|check in|ping)\b/.test(lower);
  const inferredKind: CaptureKind = hashTask || (pmTaskPhrase && !pmFollowPhrase && !hashFollowup) ? 'task' : 'followup';

  const dueDate = tokenDue ? parseDueDate(tokenDue) : parseDueDate(clean);
  const priority = parsePriority(tokenPriority ? `pri:${tokenPriority}` : clean);
  const project = tokenProject || clean.match(/\b(?:project|job|on)\s*[:#-]?\s*([A-Z]{1,6}-?\d{1,5}|[A-Z][a-zA-Z0-9 .&-]{2,40})/)?.[1];
  const owner = tokenOwner || clean.match(/\b(?:owner|assign(?:ed)? to|for)\s*[:-]?\s*([a-zA-Z][a-zA-Z .'-]{1,40})/i)?.[1];

  const normalized = stripTokens(clean);
  const title = normalized || clean;
  const confidence = Math.min(1,
    (title.length > 12 ? 0.35 : 0.2)
    + (owner ? 0.18 : 0)
    + (project ? 0.18 : 0)
    + (dueDate ? 0.12 : 0)
    + ((hashTask || hashFollowup) ? 0.17 : 0)
    + (waitingOn ? 0.1 : 0));

  const cleanupReasons: CaptureCleanupReason[] = [];
  if (!project) cleanupReasons.push('missing_project');
  if (!owner) cleanupReasons.push('missing_owner');
  if (!dueDate) cleanupReasons.push('missing_due_date');
  if (title.length < 6) cleanupReasons.push('low_confidence_title');
  if (!hashTask && !hashFollowup && !/\b(task|follow\s*-?up|nudge|waiting)\b/i.test(clean)) cleanupReasons.push('unclear_type');

  return {
    kind: inferredKind,
    rawText: clean,
    title,
    project,
    owner,
    waitingOn,
    dueDate,
    priority,
    status: inferredKind === 'task' ? 'To do' : waitingOn ? 'Waiting on external' : 'Needs action',
    nextAction: inferredKind === 'followup' ? title : undefined,
    nextStep: inferredKind === 'task' ? title : undefined,
    confidence,
    cleanupReasons,
  };
}
