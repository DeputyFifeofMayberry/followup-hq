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
  if (lower.includes('tomorrow')) return addDaysIso(todayIso(), 1);
  if (lower.includes('today')) return todayIso();
  const weekday = Object.keys(weekdayMap).find((name) => lower.includes(name));
  if (!weekday) return undefined;
  const now = new Date();
  const day = weekdayMap[weekday];
  const diff = (day - now.getDay() + 7) % 7 || 7;
  return addDaysIso(todayIso(), diff);
}

function parsePriority(input: string): FollowUpPriority {
  const lower = input.toLowerCase();
  if (lower.includes('critical')) return 'Critical';
  if (lower.includes('high')) return 'High';
  if (lower.includes('low')) return 'Low';
  return 'Medium';
}

export function parseUniversalCapture(input: string): UniversalCaptureDraft {
  const clean = input.trim();
  const lower = clean.toLowerCase();

  const kind: CaptureKind = lower.includes('task') ? 'task' : 'followup';
  const inferredKind: CaptureKind = /follow\s*-?up|waiting on/.test(lower) ? 'followup' : kind;

  const project = clean.match(/\b([A-Z]{1,5}-?\d{1,4})\b/)?.[1];
  const waitingOn = clean.match(/waiting on\s+([a-zA-Z][a-zA-Z .'-]+)/i)?.[1]?.trim();
  const withOwner = clean.match(/\bwith\s+([a-zA-Z][a-zA-Z .'-]+)/i)?.[1]?.trim();
  const owner = clean.match(/\bfor\s+([a-zA-Z][a-zA-Z .'-]+)$/i)?.[1]?.trim();

  const dueDate = parseDueDate(clean);
  const priority = parsePriority(clean);

  const stripped = clean
    .replace(/\b(task|follow\s*-?up|waiting on)\b/gi, '')
    .replace(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(low|medium|high|critical)\s+priority\b/gi, '')
    .replace(/\b(low|medium|high|critical)\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\bwith\s+[a-zA-Z][a-zA-Z .'-]+/gi, '')
    .replace(/\bwaiting on\s+[a-zA-Z][a-zA-Z .'-]+/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    kind: inferredKind,
    rawText: clean,
    title: stripped || clean,
    project,
    owner: owner || withOwner,
    waitingOn,
    dueDate,
    priority,
    status: inferredKind === 'task' ? 'To do' : waitingOn ? 'Waiting on external' : 'Needs action',
    nextAction: inferredKind === 'followup' ? stripped || 'Follow up and confirm next step.' : undefined,
    nextStep: inferredKind === 'task' ? stripped || 'Complete the task.' : undefined,
  };
}
