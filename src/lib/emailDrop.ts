import { createId, todayIso, uniqueStrings } from './utils';
import type { DroppedEmailImport } from '../types';

const PROJECT_HINT_RE = /\b(B\d{3,4}|BOSC|NAVFAC|PSNS|Shop\s*\d+|Weld\s*Shop|Chillers?)\b/i;

function cleanWhitespace(value: string): string {
  return value.replace(/\r/g, '').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

function collapsePreview(value: string, maxLength = 420): string {
  const cleaned = cleanWhitespace(value).replace(/\n/g, ' ');
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function decodeMimeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_full, _charset, encoding, text) => {
    try {
      if (String(encoding).toUpperCase() === 'B') {
        if (typeof atob === 'function') {
          const decoded = atob(text);
          const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
          return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        }
        return text;
      }
      const qp = text.replace(/_/g, ' ');
      return decodeQuotedPrintable(qp);
    } catch {
      return text;
    }
  });
}

function decodeQuotedPrintable(value: string): string {
  const softBreakStripped = value.replace(/=\r?\n/g, '');
  return softBreakStripped.replace(/=([A-Fa-f0-9]{2})/g, (_full, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripHtml(value: string): string {
  return cleanWhitespace(
    value
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"'),
  );
}

function parseAddressList(value?: string): string[] {
  if (!value) return [];
  const decoded = decodeMimeWords(value);
  const emailMatches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  if (emailMatches.length) return uniqueStrings(emailMatches);
  return uniqueStrings(decoded.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean));
}

function normalizeHeaderMap(rawHeaders: string): Record<string, string> {
  const unfolded = rawHeaders.replace(/\r\n/g, '\n').replace(/\n[ \t]+/g, ' ');
  const headers: Record<string, string> = {};
  unfolded.split('\n').forEach((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) return;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    headers[key] = headers[key] ? `${headers[key]}, ${value}` : value;
  });
  return headers;
}

function splitHeaderAndBody(rawText: string): { headerText: string; bodyText: string } {
  const normalized = rawText.replace(/\r\n/g, '\n');
  const divider = normalized.indexOf('\n\n');
  if (divider === -1) return { headerText: normalized, bodyText: '' };
  return {
    headerText: normalized.slice(0, divider),
    bodyText: normalized.slice(divider + 2),
  };
}

function decodeBodyByEncoding(content: string, encoding?: string): string {
  const normalizedEncoding = encoding?.toLowerCase();
  if (normalizedEncoding === 'base64') {
    try {
      const compact = content.replace(/\s+/g, '');
      if (typeof atob === 'function') {
        const decoded = atob(compact);
        const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
        return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
      }
    } catch {
      return content;
    }
  }
  if (normalizedEncoding === 'quoted-printable') {
    return decodeQuotedPrintable(content);
  }
  return content;
}

function extractBoundary(contentType?: string): string | undefined {
  const match = contentType?.match(/boundary="?([^";]+)"?/i);
  return match?.[1];
}

function pickMultipartBody(bodyText: string, contentType?: string): string {
  const boundary = extractBoundary(contentType);
  if (!boundary) return bodyText;
  const delimiter = `--${boundary}`;
  const rawParts = bodyText.split(delimiter)
    .map((part) => part.trim())
    .filter((part) => part && part !== '--');

  let textPlain = '';
  let textHtml = '';
  for (const part of rawParts) {
    const { headerText, bodyText: partBody } = splitHeaderAndBody(part);
    const headers = normalizeHeaderMap(headerText);
    const decodedPart = decodeBodyByEncoding(partBody, headers['content-transfer-encoding']);
    const partContentType = headers['content-type']?.toLowerCase() ?? '';
    if (!textPlain && partContentType.includes('text/plain')) textPlain = decodedPart;
    if (!textHtml && partContentType.includes('text/html')) textHtml = decodedPart;
  }

  if (textPlain) return textPlain;
  if (textHtml) return stripHtml(textHtml);
  return bodyText;
}

function extractProjectHint(subject: string, bodyPreview: string): string {
  const match = `${subject} ${bodyPreview}`.match(PROJECT_HINT_RE);
  return match ? match[0].trim() : 'General';
}

function coerceDate(value?: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function buildFileSourceRef(fileName: string): string {
  return `Dropped email file: ${fileName}`;
}

function parseEmlText(rawText: string, fileName: string, format: DroppedEmailImport['format']): DroppedEmailImport {
  const { headerText, bodyText } = splitHeaderAndBody(rawText);
  const headers = normalizeHeaderMap(headerText);
  const decodedBody = decodeBodyByEncoding(pickMultipartBody(bodyText, headers['content-type']), headers['content-transfer-encoding']);
  const contentType = headers['content-type']?.toLowerCase() ?? '';
  const bodyTextValue = contentType.includes('text/html') ? stripHtml(decodedBody) : cleanWhitespace(decodedBody);
  const subject = decodeMimeWords(headers['subject'] ?? fileName.replace(/\.[^.]+$/, '')) || '(no subject)';
  const from = decodeMimeWords(headers['from'] ?? '').trim() || 'Unknown sender';
  const toRecipients = parseAddressList(headers['to']);
  const ccRecipients = parseAddressList(headers['cc']);
  const sentAt = coerceDate(headers['date']);
  const parseWarnings: string[] = [];
  if (!bodyTextValue) parseWarnings.push('Email body could not be fully decoded.');

  return {
    id: createId('MAIL'),
    fileName,
    format,
    subject,
    from,
    toRecipients,
    ccRecipients,
    sentAt,
    bodyPreview: collapsePreview(bodyTextValue || bodyText),
    sourceRef: buildFileSourceRef(fileName),
    projectHint: extractProjectHint(subject, bodyTextValue),
    parseQuality: 'structured',
    parseWarnings,
  };
}

function extractUtf16LeStrings(bytes: Uint8Array): string[] {
  const strings: string[] = [];
  let current = '';
  for (let index = 0; index + 1 < bytes.length; index += 2) {
    const code = bytes[index] | (bytes[index + 1] << 8);
    const printable = (code >= 32 && code <= 126) || (code >= 160 && code <= 65533) || code === 10 || code === 13 || code === 9;
    if (printable) {
      current += String.fromCharCode(code);
      continue;
    }
    if (current.trim().length >= 4) strings.push(cleanWhitespace(current));
    current = '';
  }
  if (current.trim().length >= 4) strings.push(cleanWhitespace(current));
  return strings;
}

function extractAsciiStrings(bytes: Uint8Array): string[] {
  const strings: string[] = [];
  let current = '';
  for (const byte of bytes) {
    const printable = (byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13;
    if (printable) {
      current += String.fromCharCode(byte);
      continue;
    }
    if (current.trim().length >= 6) strings.push(cleanWhitespace(current));
    current = '';
  }
  if (current.trim().length >= 6) strings.push(cleanWhitespace(current));
  return strings;
}

function scoreMsgSubjectCandidate(value: string): number {
  if (!value || value.length < 5 || value.length > 180) return -100;
  if (/__substg1\.0|IPM\.|message class|content-type|smtp|transport/i.test(value)) return -50;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) return -20;
  let score = 0;
  if (/\s/.test(value)) score += 4;
  if (/[A-Za-z]/.test(value)) score += 4;
  if (!/[\\/]/.test(value)) score += 2;
  if (value.length >= 12 && value.length <= 120) score += 3;
  if (/re:|fw:|fwd:|navfac|shop|weld|chiller|rfi|quote|follow up/i.test(value)) score += 4;
  return score;
}

function pickBestMsgBody(strings: string[]): string {
  const candidates = strings
    .filter((value) => value.length >= 40)
    .filter((value) => !/__substg1\.0|IPM\.|Content-Type|SMTP|http:\/\//i.test(value))
    .filter((value) => /[A-Za-z]{4,}/.test(value))
    .sort((left, right) => right.length - left.length);
  return collapsePreview(candidates[0] ?? '');
}

function findLabeledValue(strings: string[], labels: string[]): string | undefined {
  for (const entry of strings) {
    const lower = entry.toLowerCase();
    for (const label of labels) {
      const marker = `${label.toLowerCase()}:`;
      const index = lower.indexOf(marker);
      if (index !== -1) return entry.slice(index + marker.length).trim();
    }
  }
  return undefined;
}


function parseLooseEmailText(rawText: string, fileName: string, format: DroppedEmailImport['format']): DroppedEmailImport {
  const lines = rawText.replace(/\r\n/g, '\n').split('\n');
  const subjectLine = lines.find((line) => /^subject:/i.test(line));
  const fromLine = lines.find((line) => /^from:/i.test(line));
  const toLine = lines.find((line) => /^to:/i.test(line));
  const ccLine = lines.find((line) => /^cc:/i.test(line));
  const dateLine = lines.find((line) => /^(date|sent):/i.test(line));
  const bodyPreview = collapsePreview(stripHtml(rawText));
  const subject = subjectLine ? subjectLine.replace(/^subject:\s*/i, '').trim() : fileName.replace(/\.[^.]+$/, '') || '(no subject)';
  const from = fromLine ? fromLine.replace(/^from:\s*/i, '').trim() : 'Unknown sender';
  return {
    id: createId('MAIL'),
    fileName,
    format,
    subject,
    from,
    toRecipients: parseAddressList(toLine?.replace(/^to:\s*/i, '')),
    ccRecipients: parseAddressList(ccLine?.replace(/^cc:\s*/i, '')),
    sentAt: coerceDate(dateLine?.replace(/^(date|sent):\s*/i, '')),
    bodyPreview,
    sourceRef: buildFileSourceRef(fileName),
    projectHint: extractProjectHint(subject, bodyPreview),
    parseQuality: 'best-effort',
    parseWarnings: ['Loose text/html email import detected. Review the preview before converting it into a tracked follow-up.'],
  };
}

function parseMsgBuffer(buffer: ArrayBuffer, fileName: string): DroppedEmailImport {
  const bytes = new Uint8Array(buffer);
  const strings = uniqueStrings([...extractUtf16LeStrings(bytes), ...extractAsciiStrings(bytes)]);
  const subjectLabeled = findLabeledValue(strings, ['subject', 'conversation topic']);
  const subject = subjectLabeled
    || [...strings].sort((left, right) => scoreMsgSubjectCandidate(right) - scoreMsgSubjectCandidate(left))[0]
    || fileName.replace(/\.[^.]+$/, '')
    || '(no subject)';
  const emailMatches = uniqueStrings((strings.join('\n').match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).slice(0, 12));
  const fromLabeled = findLabeledValue(strings, ['from', 'sender', 'sender email address', 'sent representing email address']);
  const from = fromLabeled || emailMatches[0] || 'Unknown sender';
  const toRecipients = emailMatches.filter((entry) => entry.toLowerCase() !== from.toLowerCase()).slice(0, 5);
  const ccRecipients = uniqueStrings(parseAddressList(findLabeledValue(strings, ['cc']))).slice(0, 5);
  const bodyPreview = pickBestMsgBody(strings);
  const sentAt = coerceDate(findLabeledValue(strings, ['date', 'delivery time', 'sent']))
    || coerceDate(strings.find((value) => /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),?\s+[A-Z][a-z]{2}\s+\d{1,2}\s+\d{4}/.test(value)));

  return {
    id: createId('MAIL'),
    fileName,
    format: 'msg',
    subject,
    from,
    toRecipients,
    ccRecipients,
    sentAt,
    bodyPreview,
    sourceRef: buildFileSourceRef(fileName),
    projectHint: extractProjectHint(subject, bodyPreview),
    parseQuality: 'best-effort',
    parseWarnings: ['Outlook .msg extraction uses best-effort parsing. Review the preview before converting it into a tracked follow-up.'],
  };
}

export async function parseDroppedEmailFile(file: File): Promise<DroppedEmailImport> {
  const fileName = file.name;
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith('.eml') || lowerName.endsWith('.txt') || lowerName.endsWith('.html') || lowerName.endsWith('.htm')) {
    const text = await file.text();
    const format = lowerName.endsWith('.eml') ? 'eml' : lowerName.endsWith('.html') || lowerName.endsWith('.htm') ? 'html' : 'txt';
    const looksStructuredEmail = /^subject:/im.test(text) || /^from:/im.test(text) || /^to:/im.test(text) || /^mime-version:/im.test(text);
    if (format === 'eml' || looksStructuredEmail) return parseEmlText(text, fileName, format);
    return parseLooseEmailText(text, fileName, format);
  }
  if (lowerName.endsWith('.msg')) {
    const buffer = await file.arrayBuffer();
    return parseMsgBuffer(buffer, fileName);
  }
  throw new Error(`Unsupported email file type: ${fileName}`);
}

export async function parseDroppedEmailFiles(files: File[]): Promise<{ imports: DroppedEmailImport[]; errors: string[] }> {
  const imports: DroppedEmailImport[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      imports.push(await parseDroppedEmailFile(file));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse dropped email file.';
      errors.push(`${file.name}: ${message}`);
    }
  }
  return { imports, errors };
}

export function buildDroppedEmailPreview(importItem: DroppedEmailImport): string {
  const recipients = importItem.toRecipients.slice(0, 3).join('; ');
  return [
    importItem.bodyPreview,
    importItem.from ? `From: ${importItem.from}` : '',
    recipients ? `To: ${recipients}` : '',
    importItem.sentAt ? `Date: ${new Date(importItem.sentAt).toLocaleString()}` : '',
  ].filter(Boolean).join(' • ');
}

export function buildFollowUpFromDroppedEmail(importItem: DroppedEmailImport) {
  const tags = uniqueStrings(['Dropped Email', importItem.format.toUpperCase(), importItem.parseQuality === 'best-effort' ? 'Review Needed' : 'Structured']);
  return {
    id: createId(),
    title: importItem.subject || '(no subject)',
    source: 'Email' as const,
    project: importItem.projectHint || 'General',
    owner: 'Jared',
    status: 'Needs action' as const,
    priority: importItem.parseQuality === 'best-effort' ? 'High' as const : 'Medium' as const,
    dueDate: importItem.sentAt ?? todayIso(),
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: new Date(Date.now() + 2 * 86400000).toISOString(),
    nextAction: 'Review the dropped email, confirm project/owner, and send the next follow-up.',
    summary: importItem.bodyPreview || `Dropped email imported from ${importItem.fileName}.`,
    tags,
    sourceRef: importItem.sourceRef,
    sourceRefs: uniqueStrings([
      importItem.sourceRef,
      importItem.fileName,
      importItem.from,
      ...importItem.toRecipients,
      ...importItem.ccRecipients,
    ]),
    mergedItemIds: [],
    waitingOn: importItem.toRecipients[0],
    notes: [
      `Dropped file: ${importItem.fileName}`,
      `Format: ${importItem.format.toUpperCase()}`,
      `From: ${importItem.from}`,
      importItem.toRecipients.length ? `To: ${importItem.toRecipients.join('; ')}` : '',
      importItem.ccRecipients.length ? `CC: ${importItem.ccRecipients.join('; ')}` : '',
      importItem.sentAt ? `Date: ${new Date(importItem.sentAt).toLocaleString()}` : '',
      importItem.parseWarnings.length ? `Warnings: ${importItem.parseWarnings.join(' | ')}` : '',
    ].filter(Boolean).join('\n'),
    category: 'Coordination' as const,
    owesNextAction: 'Unknown' as const,
    escalationLevel: importItem.parseQuality === 'best-effort' ? 'Watch' as const : 'None' as const,
    cadenceDays: 3,
    draftFollowUp: '',
  };
}

