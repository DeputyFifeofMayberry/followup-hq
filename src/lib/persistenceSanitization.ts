import type { PersistedPayload } from './persistence';

const DISALLOWED_CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export interface SanitizedFieldIssue {
  path: string;
  removedControlChars: number;
  originalLength: number;
  sanitizedLength: number;
  sample?: string;
}

export interface PersistenceSanitizationReport {
  fieldCount: number;
  removedControlCharCount: number;
  issues: SanitizedFieldIssue[];
  entityBreakdown: Record<string, number>;
  touchedEntityTypes: string[];
}

export interface SanitizedPayloadResult {
  payload: PersistedPayload;
  report: PersistenceSanitizationReport;
}

function countMatches(value: string, pattern: RegExp): number {
  const matches = value.match(pattern);
  return matches ? matches.length : 0;
}

function summarizeEntity(path: string): string {
  if (path.startsWith('items[')) return 'items';
  if (path.startsWith('tasks[')) return 'tasks';
  if (path.startsWith('projects[')) return 'projects';
  if (path.startsWith('contacts[')) return 'contacts';
  if (path.startsWith('companies[')) return 'companies';
  if (path.startsWith('auxiliary.')) return 'auxiliary';
  return 'unknown';
}

export function sanitizePersistenceString(value: string): { value: string; removedControlChars: number } {
  const normalized = value.replace(/\r\n/g, '\n');
  const removedControlChars = countMatches(normalized, DISALLOWED_CONTROL_CHARS);
  if (removedControlChars === 0) return { value: normalized, removedControlChars: 0 };
  return {
    value: normalized.replace(DISALLOWED_CONTROL_CHARS, ''),
    removedControlChars,
  };
}

function sanitizeUnknown(value: unknown, path: string, issues: SanitizedFieldIssue[]): unknown {
  if (typeof value === 'string') {
    const sanitized = sanitizePersistenceString(value);
    if (sanitized.removedControlChars > 0) {
      issues.push({
        path,
        removedControlChars: sanitized.removedControlChars,
        originalLength: value.length,
        sanitizedLength: sanitized.value.length,
        sample: value.slice(0, 120),
      });
    }
    return sanitized.value;
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => sanitizeUnknown(entry, `${path}[${index}]`, issues));
  }

  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nested]) => {
      const nextPath = path ? `${path}.${key}` : key;
      return [key, sanitizeUnknown(nested, nextPath, issues)] as const;
    });
    return Object.fromEntries(entries);
  }

  return value;
}

export function sanitizePersistedPayload(input: PersistedPayload): SanitizedPayloadResult {
  const issues: SanitizedFieldIssue[] = [];
  const payload = sanitizeUnknown(input, '', issues) as PersistedPayload;
  const entityBreakdown = issues.reduce<Record<string, number>>((acc, issue) => {
    const entity = summarizeEntity(issue.path);
    acc[entity] = (acc[entity] ?? 0) + 1;
    return acc;
  }, {});

  return {
    payload,
    report: {
      fieldCount: issues.length,
      removedControlCharCount: issues.reduce((sum, issue) => sum + issue.removedControlChars, 0),
      issues,
      entityBreakdown,
      touchedEntityTypes: Object.keys(entityBreakdown),
    },
  };
}
