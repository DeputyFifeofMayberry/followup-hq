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
  if (lower.includes('tomorrow')) return addDaysIso(todayIso(), 1);
  if (lower.includes('today')) return todayIso();
  if (lower.includes('next week')) return addDaysIso(todayIso(), 7);
  if (lower.includes('this week')) return addDaysIso(todayIso(), 4);
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

  const hasTaskLanguage = /\btask\b/.test(lower);
  const hasFollowUpLanguage = /\bfollow\s*-?up\b|\bwaiting on\b/.test(lower);
  const inferredKind: CaptureKind = hasFollowUpLanguage ? 'followup' : hasTaskLanguage ? 'task' : 'followup';

  const project = clean.match(/\b(?:on|for)?\s*([A-Z]{1,5}-?\d{1,4})\b/)?.[1];
  const waitingOn = clean.match(/waiting on\s+([a-zA-Z][a-zA-Z .'-]+)/i)?.[1]?.trim();
  const withOwner = clean.match(/\bwith\s+([a-zA-Z][a-zA-Z .'-]*?)(?:\s+(?:on|about|for|by)\b|$)/i)?.[1]?.trim();
  const taskOwner = clean.match(/\btask\s+for\s+([a-zA-Z][a-zA-Z .'-]*?)(?:\s+to\b|$)/i)?.[1]?.trim();
  const owner = taskOwner || withOwner;

  const dueDate = parseDueDate(clean);
  const priority = parsePriority(clean);

  const stripped = clean
    .replace(/\b(task|follow\s*-?up|waiting on)\b/gi, '')
    .replace(/\b(tomorrow|today|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, '')
    .replace(/\b(low|medium|high|critical)\s+priority\b/gi, '')
    .replace(/\b(low|medium|high|critical)\b/gi, '')
    .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')
    .replace(/\bwith\s+[a-zA-Z][a-zA-Z .'-]*(?=\s+(?:on|about|for|by)\b|$)/gi, '')
    .replace(/\btask\s+for\s+[a-zA-Z][a-zA-Z .'-]*(?=\s+to\b|$)/gi, '')
    .replace(/\bwaiting on\s+[a-zA-Z][a-zA-Z .'-]+/gi, '')
    .replace(/\bon\s+[A-Z]{1,5}-?\d{1,4}\b/g, '')
    .replace(/\bfor\s+[a-zA-Z][a-zA-Z .'-]*\s+to\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  const title = stripped || clean;
  const confidence = Math.min(
    1,
    (hasTaskLanguage || hasFollowUpLanguage ? 0.3 : 0.15)
      + (title.length >= 6 ? 0.25 : 0)
      + (owner ? 0.2 : 0)
      + (project ? 0.15 : 0)
      + (dueDate ? 0.1 : 0),
  );

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
