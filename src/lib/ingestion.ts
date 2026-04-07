import type { IngestionPreset, IntakeSignal, SourceType } from '../types';
import { createId } from './utils';
import { sanitizePersistenceString } from './persistenceSanitization';

const urgencyWords = ['urgent', 'asap', 'overdue', 'late', 'critical', 'risk', 'need today'];
const actionWords = ['follow up', 'send', 'confirm', 'review', 'update', 'call', 'coordinate', 'submit', 'verify', 'ask'];

function detectUrgency(text: string): IntakeSignal['urgency'] {
  const safeText = sanitizePersistenceString(text).value;
  const lower = safeText.toLowerCase();
  if (urgencyWords.some((word) => lower.includes(word))) return 'High';
  if (actionWords.some((word) => lower.includes(word))) return 'Medium';
  return 'Low';
}

function inferSource(preset: IngestionPreset): SourceType {
  switch (preset) {
    case 'Email thread':
      return 'Email';
    case 'Issue log':
      return 'Excel';
    case 'Meeting notes':
      return 'Notes';
    default:
      return 'To-do';
  }
}

function cleanLine(line: string): string {
  return line.replace(/^[-*\d.)\s]+/, '').trim();
}

export function parseIngestionText(raw: string, preset: IngestionPreset): IntakeSignal[] {
  const source = inferSource(preset);
  const lines = sanitizePersistenceString(raw).value
    .split(/\r?\n/)
    .map(cleanLine)
    .filter((line) => line.length >= 8);

  const selected = preset === 'Email thread'
    ? lines.filter((line) => /subject:|from:|follow up|please|request|awaiting/i.test(line))
    : preset === 'Issue log'
      ? lines.filter((line) => /overdue|issue|row|owner|due|status/i.test(line))
      : lines.filter((line) => actionWords.some((word) => line.toLowerCase().includes(word)) || /need to|action|owner|due/i.test(line));

  const candidates = (selected.length > 0 ? selected : lines).slice(0, 20);

  return candidates.map((line, index) => ({
    id: createId('SIG'),
    source,
    title: line.length > 78 ? `${line.slice(0, 75)}...` : line,
    detail: `${preset} ingestion line ${index + 1}: ${line}`,
    urgency: detectUrgency(line),
  }));
}
