export type IntakeFileCapabilityState = 'parse_supported' | 'manual_review_only' | 'blocked';

export interface IntakeFileCapability {
  extension: string;
  label: string;
  state: IntakeFileCapabilityState;
  acceptMime?: string[];
  reason?: string;
}

export const INTAKE_FILE_CAPABILITIES: IntakeFileCapability[] = [
  { extension: '.eml', label: 'Email message', state: 'parse_supported', acceptMime: ['message/rfc822'] },
  { extension: '.txt', label: 'Text', state: 'parse_supported', acceptMime: ['text/plain'] },
  { extension: '.html', label: 'HTML', state: 'parse_supported', acceptMime: ['text/html'] },
  { extension: '.htm', label: 'HTML', state: 'parse_supported', acceptMime: ['text/html'] },
  { extension: '.docx', label: 'Word document', state: 'parse_supported', acceptMime: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'] },
  { extension: '.pdf', label: 'PDF', state: 'parse_supported', acceptMime: ['application/pdf'] },
  { extension: '.csv', label: 'CSV', state: 'parse_supported', acceptMime: ['text/csv'] },
  { extension: '.xls', label: 'Excel workbook', state: 'parse_supported', acceptMime: ['application/vnd.ms-excel'] },
  { extension: '.xlsx', label: 'Excel workbook', state: 'parse_supported', acceptMime: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  { extension: '.msg', label: 'Outlook .msg email', state: 'blocked', reason: 'Client-side .msg parsing is not reliable yet. Save/export as .eml first.' },
  { extension: '.doc', label: 'Legacy Word .doc', state: 'blocked', reason: 'Legacy .doc parsing is not reliable in the browser. Convert to .docx first.' },
  { extension: '.pptx', label: 'PowerPoint', state: 'manual_review_only', reason: 'Text extraction is degraded. Review all fields manually before creating work.' },
];

const byExt = new Map(INTAKE_FILE_CAPABILITIES.map((cap) => [cap.extension, cap]));

export function getIntakeFileExtension(name: string): string {
  const lower = name.toLowerCase();
  const idx = lower.lastIndexOf('.');
  return idx >= 0 ? lower.slice(idx) : '';
}

export function getIntakeFileCapability(name: string): IntakeFileCapability {
  const ext = getIntakeFileExtension(name);
  return byExt.get(ext) ?? { extension: ext || '(none)', label: 'Unknown file', state: 'blocked', reason: 'Unsupported file type for intake parsing.' };
}

export function isIntakeFileAccepted(name: string): boolean {
  return getIntakeFileCapability(name).state !== 'blocked';
}

export function isIntakeFileParseSupported(name: string): boolean {
  return getIntakeFileCapability(name).state === 'parse_supported';
}

export function getIntakeFileInputAccept(): string {
  return INTAKE_FILE_CAPABILITIES.filter((cap) => cap.state !== 'blocked').map((cap) => cap.extension).join(',');
}

export function describeIntakeFileSupport(): string {
  const supported = INTAKE_FILE_CAPABILITIES.filter((cap) => cap.state === 'parse_supported').map((cap) => cap.extension).join(', ');
  const degraded = INTAKE_FILE_CAPABILITIES.filter((cap) => cap.state === 'manual_review_only').map((cap) => cap.extension).join(', ');
  return degraded ? `Supported parse: ${supported}. Accepted with manual-review warning: ${degraded}.` : `Supported parse: ${supported}.`;
}
