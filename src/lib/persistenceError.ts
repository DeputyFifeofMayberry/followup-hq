export interface PersistenceErrorContext {
  stage?: string;
  operation?: string;
  table?: string;
}

export type NormalizedPersistenceError = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number | string;
  name?: string;
  stage?: string;
  operation?: string;
  table?: string;
  rawSummary?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

function pickFirstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asNonEmptyString(record[key]);
    if (value) return value;
  }
  return undefined;
}

export function safeSerializeUnknownError(error: unknown): string {
  if (typeof error === 'string') return error.trim() || 'Unknown persistence error';
  if (error === null || error === undefined) return 'Unknown persistence error';
  if (typeof error === 'number' || typeof error === 'boolean' || typeof error === 'bigint') {
    return String(error);
  }
  if (typeof error === 'function') return '[function thrown as error]';
  if (typeof error === 'symbol') return error.toString();

  const seen = new WeakSet<object>();
  try {
    const serialized = JSON.stringify(
      error,
      (_key, value) => {
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) return '[Circular]';
          seen.add(value);
        }
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            code: (value as { code?: unknown }).code,
            cause: (value as { cause?: unknown }).cause,
          };
        }
        if (typeof value === 'function') return `[Function ${(value as Function).name || 'anonymous'}]`;
        if (typeof value === 'symbol') return value.toString();
        return value;
      },
    );
    if (serialized && serialized !== '{}' && serialized !== '[]') return serialized;
  } catch {
    // fallback below
  }

  try {
    const asString = String(error).trim();
    if (asString && asString !== '[object Object]' && asString !== 'undefined' && asString !== 'null') return asString;
  } catch {
    // fallback below
  }
  return 'Unknown persistence error';
}

export function normalizePersistenceError(
  error: unknown,
  context: PersistenceErrorContext = {},
): NormalizedPersistenceError {
  if (error instanceof Error) {
    const maybeCause = (error as Error & { cause?: unknown }).cause;
    const causeText = maybeCause ? normalizePersistenceError(maybeCause).message : undefined;
    const rawSummary = safeSerializeUnknownError(error);
    return {
      message: error.message?.trim() || error.name || 'Persistence operation failed',
      name: error.name || undefined,
      details: causeText && causeText !== error.message ? `cause: ${causeText}` : undefined,
      stage: context.stage,
      operation: context.operation,
      table: context.table,
      rawSummary,
    };
  }

  if (typeof error === 'string') {
    return {
      message: error.trim() || 'Persistence operation failed',
      stage: context.stage,
      operation: context.operation,
      table: context.table,
      rawSummary: safeSerializeUnknownError(error),
    };
  }

  if (isRecord(error)) {
    const message = pickFirstString(error, ['message', 'error_description', 'description', 'details', 'hint', 'code', 'status', 'statusCode', 'name']);
    const code = pickFirstString(error, ['code', 'error_code']);
    const details = pickFirstString(error, ['details', 'error_details']);
    const hint = pickFirstString(error, ['hint']);
    const status = asNonEmptyString(error.status) ?? asNonEmptyString(error.statusCode);
    const name = pickFirstString(error, ['name', 'error']);
    const rawSummary = safeSerializeUnknownError(error);

    return {
      message: message ?? rawSummary ?? 'Persistence operation failed',
      code,
      details,
      hint,
      status,
      name,
      stage: context.stage,
      operation: context.operation,
      table: context.table,
      rawSummary,
    };
  }

  const rawSummary = safeSerializeUnknownError(error);
  return {
    message: rawSummary || 'Persistence operation failed',
    stage: context.stage,
    operation: context.operation,
    table: context.table,
    rawSummary,
  };
}

export function formatPersistenceErrorMessage(normalized: NormalizedPersistenceError): string {
  const base = normalized.message?.trim();
  const baseMessage = (!base || base === '[object Object]' || base === 'undefined' || base === 'null')
    ? (normalized.rawSummary?.trim() || 'Persistence operation failed')
    : base;

  const location = normalized.table
    ? ` for table ${normalized.table}`
    : normalized.stage
      ? ` during ${normalized.stage}`
      : '';

  const suffix: string[] = [];
  if (normalized.code) suffix.push(`code: ${normalized.code}`);
  if (normalized.details && normalized.details !== baseMessage) suffix.push(`details: ${normalized.details}`);
  if (normalized.hint) suffix.push(`hint: ${normalized.hint}`);
  if (normalized.status) suffix.push(`status: ${normalized.status}`);

  const codeUpper = normalized.code?.toUpperCase();
  const looksMissingTable = codeUpper === 'PGRST205'
    || baseMessage.toLowerCase().includes('could not find the table')
    || (normalized.details ?? '').toLowerCase().includes('does not exist');
  const prefix = looksMissingTable
    ? `Supabase persistence table ${normalized.table ? `public.${normalized.table}` : 'in the configured schema'} was not found in the connected project`
    : `${baseMessage}${location}`.trim();
  if (suffix.length === 0) return prefix || 'Persistence operation failed';
  return `${prefix} (${suffix.join('; ')})`;
}
