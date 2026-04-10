import type { IntakeDateSignalSet } from '../types';

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeDetectedDate(raw?: string): { iso?: string; warning?: string; raw?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (isoPattern.test(trimmed)) return { iso: trimmed, raw: trimmed };

  const mdy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { iso: `${year.toString().padStart(4, '0')}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`, raw: trimmed };
  }
  const monthNamed = /^(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})(?:,\s*|\s+)(\d{4})$/i.exec(trimmed);
  if (monthNamed) {
    const monthMap: Record<string, number> = { jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12 };
    const month = monthMap[monthNamed[1].toLowerCase()];
    const day = Number(monthNamed[2]);
    const year = Number(monthNamed[3]);
    if (month && day >= 1 && day <= 31) return { iso: `${year.toString().padStart(4, '0')}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`, raw: trimmed };
  }

  return { raw: trimmed, warning: `Could not safely normalize detected date "${trimmed}".` };
}

export function buildDateSignalSet(input: {
  sourceDate?: string;
  dueDate?: string;
  promisedDate?: string;
  nextTouchDate?: string;
  historicalDates?: string[];
}): { signals: IntakeDateSignalSet; warnings: string[] } {
  const warnings: string[] = [];
  const source = normalizeDetectedDate(input.sourceDate);
  const due = normalizeDetectedDate(input.dueDate);
  const promised = normalizeDetectedDate(input.promisedDate);
  const nextTouch = normalizeDetectedDate(input.nextTouchDate);

  [source.warning, due.warning, promised.warning, nextTouch.warning].filter(Boolean).forEach((w) => warnings.push(String(w)));

  const seen = new Set<string>();
  const historicalDates = (input.historicalDates ?? []).filter((d) => {
    const trimmed = d.trim();
    if (!trimmed || seen.has(trimmed)) return false;
    seen.add(trimmed);
    return true;
  }).slice(0, 8);

  const sameMeaningConflict = due.iso && due.raw && promised.iso && promised.raw && due.iso !== promised.iso && due.raw === promised.raw;
  if (sameMeaningConflict) warnings.push('Conflicting normalization for the same due/promised source value.');
  const nonConflictingDistinctDates = [due.iso, promised.iso, nextTouch.iso].filter(Boolean) as string[];
  if (new Set(nonConflictingDistinctDates).size > 1) warnings.push('Multiple distinct schedule dates detected (due/promised/next-touch).');

  return {
    signals: {
      sourceDate: source.iso,
      dueDate: due.iso,
      dueDateRaw: due.raw,
      promisedDate: promised.iso,
      promisedDateRaw: promised.raw,
      nextTouchDate: nextTouch.iso,
      nextTouchDateRaw: nextTouch.raw,
      historicalDates,
    },
    warnings,
  };
}

export function toDateInputValue(value?: string): string {
  return value && isoPattern.test(value) ? value : '';
}
