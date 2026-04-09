import type { IntakeDateSignalSet } from '../types';

const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

function toIso(value: Date): string {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${value.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeDetectedDate(raw?: string): { iso?: string; warning?: string; raw?: string } {
  if (!raw) return {};
  const trimmed = raw.trim();
  if (!trimmed) return {};
  if (isoPattern.test(trimmed)) return { iso: trimmed, raw: trimmed };
  const asDate = new Date(trimmed);
  if (Number.isFinite(asDate.getTime())) return { iso: toIso(asDate), raw: trimmed };

  const mdy = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(trimmed);
  if (mdy) {
    const month = Number(mdy[1]);
    const day = Number(mdy[2]);
    const year = Number(mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) return { iso: `${year.toString().padStart(4, '0')}-${`${month}`.padStart(2, '0')}-${`${day}`.padStart(2, '0')}`, raw: trimmed };
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

  const isoSet = [due.iso, promised.iso, nextTouch.iso].filter(Boolean) as string[];
  if (new Set(isoSet).size > 1) warnings.push('Date signals conflict across due/promised/next-touch fields.');

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
