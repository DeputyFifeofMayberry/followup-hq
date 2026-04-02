import type { FollowUpPriority, FollowUpStatus, TaskPriority, TaskStatus } from '../types';
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
  if (lower.includes('eow')) return addDaysIso(todayIso(), 4);
  const weekday = Object.keys(weekdayMap).find((name) => lower.includes(name));
  if (!weekday) return undefined;
  const now = new Date();
  const day = weekdayMap[weekday];
  const diff = (day - now.getDay() + 7) % 7 || 7;
  return addDaysIso(todayIso(), diff);
}

function parsePriority(input: string): FollowUpPriority {
  const lower = input.toLowerCase();
  if (/\b(critical|urgent|red flag|hot)\b/.test(lower)) return 'Critical';
  if (/\b(high|important|priority)\b/.test(lower)) return 'High';
  if (/\b(low|later|someday)\b/.test(lower)) return 'Low';
  return 'Medium';
}

function pullMatch(input: string, pattern: RegExp): string | undefined {
  return input.match(pattern)?.[1]?.trim();
}

export function parseUniversalCapture(input: string): UniversalCaptureDraft {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const hasTaskLanguage = /\b(task|todo|to do|action item|need to)\b/.test(lower);
  const hasFollowUpLanguage = /\b(follow\s*-?up|waiting on|check in|nudge)\b/.test(lower);
  const inferredKind: CaptureKind = hasTaskLanguage && !hasFollowUpLanguage ? 'task' : 'followup';

  const owner = pullMatch(clean, /\b(?:owner|assign(?:ed)? to|for)\s*[:-]?\s*([a-zA-Z][a-zA-Z .'-]{1,40})/i)
    || pullMatch(clean, /\bwith\s+([a-zA-Z][a-zA-Z .'-]{1,40})(?:\s+(?:on|about|for|by)\b|$)/i);
  const waitingOn = pullMatch(clean, /\bwaiting on\s+([a-zA-Z0-9][a-zA-Z0-9 .&'-]{1,60})/i);
  const project = pullMatch(clean, /\b(?:project|job|on)\s*[:#-]?\s*([A-Z]{1,6}-?\d{1,5}|[A-Z][a-zA-Z0-9 .&-]{2,40})/);
  const dueDate = parseDueDate(clean);
  const priority = parsePriority(clean);

  const title = clean
    .replace(/\b(task|todo|to do|follow\s*-?up|waiting on|owner|assign(?:ed)? to|project|job|due|priority)\b/gi, '')
    .replace(/\b(today|tomorrow|next week|this week|eow|asap|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(low|medium|high|critical|urgent)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || clean;

  const confidence = Math.min(1,
    (title.length > 10 ? 0.35 : 0.2)
    + (owner ? 0.2 : 0)
    + (project ? 0.2 : 0)
    + (dueDate ? 0.15 : 0)
    + ((hasTaskLanguage || hasFollowUpLanguage) ? 0.15 : 0));

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
    nextAction: inferredKind === 'followup' ? title || 'Follow up and confirm next step.' : undefined,
    nextStep: inferredKind === 'task' ? title || 'Complete the task.' : undefined,
    confidence,
  };
}
