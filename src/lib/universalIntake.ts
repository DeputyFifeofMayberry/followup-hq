import * as XLSX from 'xlsx';
import type {
  IntakeAssetKind,
  IntakeAssetRecord,
  IntakeBatchRecord,
  IntakeCandidateType,
  IntakeEvidence,
  IntakeWorkCandidate,
  TaskItem,
  FollowUpItem,
} from '../types';
import { createId, todayIso } from './utils';
import { resolveCandidateMatches } from './intake/reviewPipeline';
import { getIntakeFileCapability, getIntakeFileExtension } from './intakeFileCapabilities';
import { buildDateSignalSet } from './intakeDates';
import { buildIntakeRetrySource } from './intakeRetryCache';

const emailRegex = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const explicitDateRegex = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?)\b/;
const actionSignalRegex = /\b(action item|todo|to do|please|need to|assign|owner|due|follow up|waiting on|respond)\b/i;
const nonContentRegex = /\b(confidentiality notice|this message and any attachments|unsubscribe|view in browser|click here)\b/i;

interface ExtractionChunk {
  text: string;
  sourceRef: string;
  kind: 'email_header' | 'email_body' | 'pdf_page' | 'docx_paragraph' | 'sheet_row' | 'text';
  fields?: Partial<Record<'title' | 'project' | 'owner' | 'dueDate' | 'waitingOn' | 'priority' | 'statusHint' | 'summary' | 'nextStep', string>>;
  quality?: number;
  sheetName?: string;
  rowNumber?: number;
  rowContext?: string[];
}

interface AttachmentPayload {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}

interface ParsedEmail {
  subject?: string;
  from?: string;
  to: string[];
  cc: string[];
  sentDate?: string;
  bodyText: string;
  headers: Record<string, string>;
  attachments: AttachmentPayload[];
  warnings: string[];
}

interface DateRoleMap {
  sourceDate?: string;
  dueDate?: string;
  promisedDate?: string;
  nextTouchDate?: string;
  historicalDates: string[];
}

interface Stage2Extraction {
  text: string;
  chunks: ExtractionChunk[];
  refs: string[];
  metadata: Record<string, string | number | boolean | null>;
  warnings: string[];
  attachments: AttachmentPayload[];
  confidence: number;
}

interface ParseOptions {
  parentAssetId?: string;
  rootAssetId?: string;
  seen?: Set<string>;
}

function stripQuotedThreadAndSignature(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^on .+wrote:$/i.test(trimmed)) break;
    if (/^(from|sent|to|cc|subject):/i.test(trimmed) && out.length > 3) break;
    if (/^[-_]{2,}\s*$/.test(trimmed) || /^sent from my/i.test(trimmed)) break;
    if (trimmed.startsWith('>')) continue;
    out.push(line);
  }
  return out.join('\n');
}

export function sanitizeIntakeText(raw: string): string {
  return raw
    .replace(/\u0000/g, ' ')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\uFFFD/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function htmlToReadableText(raw: string): string {
  return raw
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n');
}

function normalizeText(raw: string, kind: IntakeAssetKind): string {
  const printable = sanitizeIntakeText(raw.replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\uFFFF]/g, ' '));
  if (kind === 'html') {
    return sanitizeIntakeText(stripQuotedThreadAndSignature(htmlToReadableText(printable)));
  }
  return sanitizeIntakeText(stripQuotedThreadAndSignature(printable.replace(/\r/g, '\n')));
}

function arrayBufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
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
    if (current.trim().length >= 4) strings.push(sanitizeIntakeText(current));
    current = '';
  }
  if (current.trim().length >= 4) strings.push(sanitizeIntakeText(current));
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
    if (current.trim().length >= 6) strings.push(sanitizeIntakeText(current));
    current = '';
  }
  if (current.trim().length >= 6) strings.push(sanitizeIntakeText(current));
  return strings;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function detectAssetKind(fileName: string, fileType: string): IntakeAssetKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.eml')) return 'email';
  if (lower.endsWith('.msg')) return 'email';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'spreadsheet';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.doc')) return 'document';
  if (lower.endsWith('.docx')) return 'document';
  if (lower.endsWith('.pptx')) return 'presentation';
  if (lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (fileType.includes('message')) return 'email';
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'spreadsheet';
  if (fileType.includes('word')) return 'document';
  if (fileType.includes('pdf')) return 'pdf';
  return 'unknown';
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

function scoreMsgSubjectCandidate(value: string): number {
  if (!value || value.length < 5 || value.length > 180) return -100;
  if (/__substg1\.0|IPM\.|message class|content-type|smtp|transport/i.test(value)) return -50;
  if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value)) return -20;
  let score = 0;
  if (/\s/.test(value)) score += 4;
  if (/[A-Za-z]/.test(value)) score += 4;
  if (!/[\\/]/.test(value)) score += 2;
  if (value.length >= 12 && value.length <= 120) score += 3;
  if (/re:|fw:|fwd:|navfac|shop|weld|chiller|rfi|quote|follow up|action|project/i.test(value)) score += 4;
  return score;
}

function extractMsg(buffer: ArrayBuffer): Stage2Extraction {
  const warnings: string[] = ['Outlook .msg parsing is best-effort; verify fields before approval.'];
  const bytes = new Uint8Array(buffer);
  const strings = uniqueStrings([...extractUtf16LeStrings(bytes), ...extractAsciiStrings(bytes)]);
  const refs: string[] = [];
  const chunks: ExtractionChunk[] = [];
  const subject = findLabeledValue(strings, ['subject', 'conversation topic'])
    || [...strings].sort((left, right) => scoreMsgSubjectCandidate(right) - scoreMsgSubjectCandidate(left))[0];
  const from = findLabeledValue(strings, ['from', 'sender', 'sender email address', 'sent representing email address']);
  const sentDate = findLabeledValue(strings, ['date', 'delivery time', 'sent']);
  const joined = strings.join('\n');
  const emailMatches = uniqueStrings((joined.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? []).slice(0, 16));
  const to = emailMatches.filter((entry) => entry.toLowerCase() !== (from || '').toLowerCase()).slice(0, 8);
  const body = strings
    .filter((value) => value.length >= 40)
    .filter((value) => !/__substg1\.0|IPM\.|Content-Type|SMTP|X-MS|MAPI|transport|\\x00/i.test(value))
    .filter((value) => /[A-Za-z]{4,}/.test(value))
    .sort((left, right) => right.length - left.length)[0];

  if (subject) {
    refs.push('msg:subject');
    chunks.push({ text: subject, sourceRef: 'msg:subject', kind: 'email_header', fields: { title: subject }, quality: 0.74 });
  }
  if (from || emailMatches[0]) {
    refs.push('msg:from');
    chunks.push({ text: from || emailMatches[0], sourceRef: 'msg:from', kind: 'email_header', fields: { owner: from || emailMatches[0] }, quality: 0.66 });
  }
  if (sentDate) {
    refs.push('msg:date');
    chunks.push({ text: sentDate, sourceRef: 'msg:date', kind: 'email_header', quality: 0.56 });
  }
  if (body) {
    refs.push('msg:body');
    chunks.push({ text: normalizeText(body, 'text'), sourceRef: 'msg:body', kind: 'email_body', quality: 0.54 });
  }
  if (!body) warnings.push('Could not recover a reliable message body from .msg file.');
  const attachmentMentions = strings.filter((value) => /attachment|\.pdf\b|\.docx?\b|\.xlsx?\b|\.pptx?\b/i.test(value)).slice(0, 8);
  if (attachmentMentions.length) warnings.push('Attachment references were detected but embedded attachment extraction is not guaranteed for .msg.');

  return {
    text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
    chunks,
    refs,
    metadata: {
      subject: subject ?? null,
      from: from ?? emailMatches[0] ?? null,
      sentDate: sentDate ?? null,
      recipients: to.join(', ') || null,
      attachmentHintCount: attachmentMentions.length,
      extractionMode: 'msg_best_effort',
    },
    warnings,
    attachments: [],
    confidence: body ? 0.52 : 0.36,
  };
}

function extractLegacyDoc(buffer: ArrayBuffer): Stage2Extraction {
  const warnings: string[] = ['Legacy .doc extraction is best-effort and always requires manual review.'];
  const bytes = new Uint8Array(buffer);
  const strings = uniqueStrings([...extractUtf16LeStrings(bytes), ...extractAsciiStrings(bytes)])
    .filter((entry) => entry.length >= 16)
    .filter((entry) => !/^(timesnewroman|calibri|arial|normal|microsoft office|worddocument|msword)$/i.test(entry))
    .slice(0, 180);
  const chunks = strings.map((text, index) => ({ text, sourceRef: `doc:string${index + 1}`, kind: 'text' as const, quality: Math.min(0.55, text.length / 260) }));
  if (!chunks.length) warnings.push('No readable text recovered from legacy .doc binary.');
  return {
    text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
    chunks,
    refs: chunks.map((chunk) => chunk.sourceRef),
    metadata: { extractionMode: 'legacy_doc_string_scan', recoveredStrings: chunks.length },
    warnings,
    attachments: [],
    confidence: chunks.length ? 0.44 : 0.22,
  };
}

function extractPresentation(buffer: ArrayBuffer): Stage2Extraction {
  const warnings: string[] = ['PowerPoint extraction is slide-text only; verify context in manual review.'];
  try {
    const workbook = XLSX.read(buffer, { type: 'array' }) as XLSX.WorkBook & { files?: Record<string, { content?: string }> };
    const xmlEntries = Object.entries(workbook.files ?? {})
      .filter(([name]) => name.startsWith('ppt/slides/') && name.endsWith('.xml'))
      .map(([name, payload]) => ({ name, content: payload?.content ?? '' }));
    const chunks: ExtractionChunk[] = [];
    xmlEntries.forEach((entry) => {
      const textRuns = [...entry.content.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => sanitizeIntakeText(match[1]));
      const notes = [...entry.content.matchAll(/<p:ph[^>]*type=\"body\"[\s\S]*?<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((match) => sanitizeIntakeText(match[1]));
      const merged = [...textRuns, ...notes].filter(Boolean).slice(0, 80);
      merged.forEach((text, index) => {
        chunks.push({ text, sourceRef: `${entry.name} text ${index + 1}`, kind: 'text', quality: Math.min(0.58, text.length / 250) });
      });
    });
    if (!chunks.length) warnings.push('No readable slide text recovered from .pptx.');
    return {
      text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
      chunks,
      refs: chunks.map((chunk) => chunk.sourceRef),
      metadata: { extractionMode: 'pptx_slide_text', slideParts: xmlEntries.length, recoveredBlocks: chunks.length },
      warnings,
      attachments: [],
      confidence: chunks.length ? 0.49 : 0.24,
    };
  } catch (error) {
    return {
      text: '',
      chunks: [],
      refs: [],
      metadata: {},
      warnings: [...warnings, `PowerPoint extractor failed: ${error instanceof Error ? error.message : 'unknown error'}`],
      attachments: [],
      confidence: 0.15,
    };
  }
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
  return { headerText: normalized.slice(0, divider), bodyText: normalized.slice(divider + 2) };
}

function decodeQuotedPrintable(value: string): string {
  const softBreakStripped = value.replace(/=\r?\n/g, '');
  return softBreakStripped.replace(/=([A-Fa-f0-9]{2})/g, (_full, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function resolveDecoder(charset?: string): TextDecoder {
  const normalized = (charset || 'utf-8').toLowerCase();
  try {
    return new TextDecoder(normalized, { fatal: false });
  } catch {
    return new TextDecoder('utf-8', { fatal: false });
  }
}

function decodeBodyByEncoding(content: string, encoding?: string, charset?: string): string {
  const normalizedEncoding = encoding?.toLowerCase();
  const decoder = resolveDecoder(charset);
  if (normalizedEncoding === 'base64') {
    try {
      const compact = content.replace(/\s+/g, '');
      const decoded = atob(compact);
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      return decoder.decode(bytes);
    } catch {
      return content;
    }
  }
  if (normalizedEncoding === 'quoted-printable') return decodeQuotedPrintable(content);
  return content;
}

function parseAddressList(value?: string): string[] {
  if (!value) return [];
  const matches = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  if (matches?.length) return [...new Set(matches.map((entry) => entry.toLowerCase()))];
  return value.split(/[;,]/).map((entry) => entry.trim()).filter(Boolean);
}

function decodeMimeWords(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_full, charset, encoding, text) => {
    try {
      if (String(encoding).toUpperCase() === 'B') {
        const decoded = atob(text);
        const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
        return resolveDecoder(charset).decode(bytes);
      }
      return decodeQuotedPrintable(text.replace(/_/g, ' '));
    } catch {
      return text;
    }
  });
}

function parseMultipartEml(rawText: string): ParsedEmail {
  const { headerText, bodyText } = splitHeaderAndBody(rawText);
  const headers = normalizeHeaderMap(headerText);
  const contentType = headers['content-type'] ?? '';
  const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);
  const warnings: string[] = [];
  const attachments: AttachmentPayload[] = [];
  let bodyPlain = '';

  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = bodyText.split(`--${boundary}`).map((part) => part.trim()).filter((part) => part && part !== '--');
    for (const part of parts) {
      const { headerText: partHeadersRaw, bodyText: partBody } = splitHeaderAndBody(part);
      const partHeaders = normalizeHeaderMap(partHeadersRaw);
      const disposition = partHeaders['content-disposition']?.toLowerCase() ?? '';
      const partType = partHeaders['content-type']?.toLowerCase() ?? '';
      const partCharset = /charset="?([^";]+)"?/i.exec(partHeaders['content-type'] ?? '')?.[1];
      const decoded = decodeBodyByEncoding(partBody, partHeaders['content-transfer-encoding'], partCharset);

      if (disposition.includes('attachment')) {
        const nameMatch = /filename\*?="?([^";]+)"?/i.exec(partHeaders['content-disposition'] ?? '') ?? /name\*?="?([^";]+)"?/i.exec(partHeaders['content-type'] ?? '');
        const fileName = nameMatch?.[1] ?? `attachment-${attachments.length + 1}`;
        const bytes = partHeaders['content-transfer-encoding']?.toLowerCase() === 'base64'
          ? Uint8Array.from(atob(partBody.replace(/\s+/g, '')), (char) => char.charCodeAt(0))
          : new TextEncoder().encode(decoded);
        attachments.push({ fileName, contentType: partType || 'application/octet-stream', bytes });
        continue;
      }

      if (!bodyPlain && partType.includes('text/plain')) bodyPlain = normalizeText(decoded, 'text');
      if (!bodyPlain && partType.includes('text/html')) bodyPlain = normalizeText(decoded, 'html');
    }
  }

  if (!bodyPlain) {
    const charset = /charset="?([^";]+)"?/i.exec(headers['content-type'] ?? '')?.[1];
    const fallback = decodeBodyByEncoding(bodyText, headers['content-transfer-encoding'], charset);
    bodyPlain = normalizeText(fallback, contentType.includes('text/html') ? 'html' : 'text');
  }

  if (!bodyPlain.trim()) warnings.push('Email body is weak or empty.');

  return {
    subject: headers.subject ? decodeMimeWords(headers.subject) : headers.subject,
    from: headers.from ? decodeMimeWords(headers.from) : headers.from,
    to: parseAddressList(headers.to),
    cc: parseAddressList(headers.cc),
    sentDate: headers.date,
    bodyText: bodyPlain,
    headers,
    attachments,
    warnings,
  };
}

function decodePdfLiteral(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
}

function extractPdf(buffer: ArrayBuffer): Stage2Extraction {
  const warnings: string[] = [];
  const raw = arrayBufferToText(buffer);
  const refs: string[] = [];
  const chunks: ExtractionChunk[] = [];

  const pageSplit = raw.split(/\/Type\s*\/Page\b/).slice(1);
  const pages = pageSplit.length ? pageSplit : [raw];

  pages.slice(0, 120).forEach((pageRaw, index) => {
    const btSections = pageRaw.match(/BT[\s\S]*?ET/g) ?? [];
    const textParts: string[] = [];
    btSections.forEach((section) => {
      const literals = [...section.matchAll(/\(([^()]*)\)\s*T[Jj]/g)].map((match) => decodePdfLiteral(match[1]));
      const arrays = [...section.matchAll(/\[([^\]]+)\]\s*TJ/g)].flatMap((match) => [...match[1].matchAll(/\(([^()]*)\)/g)].map((inner) => decodePdfLiteral(inner[1])));
      textParts.push(...literals, ...arrays);
    });

    const text = textParts.join(' ').replace(/\s+/g, ' ').trim();
    if (!text) return;
    const sourceRef = `page ${index + 1}`;
    refs.push(sourceRef);
    chunks.push({ text, sourceRef, kind: 'pdf_page', quality: Math.min(1, text.length / 450) });
  });

  if (!chunks.length) {
    const fallback = normalizeText(raw.replace(/[^\x20-\x7E\n]/g, ' '), 'text').slice(0, 6000);
    if (fallback) {
      chunks.push({ text: fallback, sourceRef: 'page 1', kind: 'pdf_page', quality: 0.25 });
      refs.push('page 1');
    }
    warnings.push('PDF appears image-like or encoded; extraction confidence lowered.');
  }

  const fullText = chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n');
  const confidence = chunks.length === 0 ? 0.15 : Math.min(0.86, fullText.length / 4200 + 0.3);
  return { text: fullText, chunks, refs, metadata: { pageCountEstimate: Math.max(chunks.length, pages.length) }, warnings, attachments: [], confidence };
}

function extractDocx(buffer: ArrayBuffer): Stage2Extraction {
  const warnings: string[] = [];
  try {
    const workbook = XLSX.read(buffer, { type: 'array' }) as XLSX.WorkBook & { files?: Record<string, { content?: string }> };
    const xmlEntries = Object.entries(workbook.files ?? {})
      .filter(([name]) => name.startsWith('word/') && name.endsWith('.xml'))
      .map(([name, payload]) => ({ name, content: payload?.content ?? '' }));

    const chunks: ExtractionChunk[] = [];
    xmlEntries.forEach((entry) => {
      const paragraphMatches = [...entry.content.matchAll(/<w:p[\s\S]*?<\/w:p>/g)].map((match) => match[0]);
      paragraphMatches.forEach((paragraph, index) => {
        const text = [...paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join(' ').replace(/\s+/g, ' ').trim();
        if (!text) return;
        chunks.push({ text, sourceRef: `${entry.name} paragraph ${index + 1}`, kind: 'docx_paragraph', quality: Math.min(1, text.length / 220) });
      });

      const tableCells = [...entry.content.matchAll(/<w:tc[\s\S]*?<\/w:tc>/g)].map((match) => [...match[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((inner) => inner[1]).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
      tableCells.slice(0, 100).forEach((cell, index) => {
        chunks.push({ text: cell, sourceRef: `${entry.name} table cell ${index + 1}`, kind: 'docx_paragraph', quality: Math.min(1, cell.length / 180) });
      });
    });

    if (!chunks.length) {
      warnings.push('DOCX XML contained little readable text.');
      const fallback = normalizeText(arrayBufferToText(buffer), 'text').slice(0, 3000);
      if (fallback) chunks.push({ text: fallback, sourceRef: 'document fallback', kind: 'docx_paragraph', quality: 0.2 });
    }

    return {
      text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
      chunks: chunks.slice(0, 320),
      refs: chunks.slice(0, 320).map((chunk) => chunk.sourceRef),
      metadata: { xmlParts: xmlEntries.length, paragraphCount: chunks.length },
      warnings,
      attachments: [],
      confidence: chunks.length ? 0.78 : 0.2,
    };
  } catch (error) {
    warnings.push(`DOCX extractor failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    return { text: '', chunks: [], refs: [], metadata: {}, warnings, attachments: [], confidence: 0.1 };
  }
}

function inferHeaderRow(rows: string[][]): { headerIndex: number; headers: string[] } {
  let bestIndex = 0;
  let bestScore = -1;
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const row = rows[index] ?? [];
    const nonEmpty = row.filter((cell) => String(cell ?? '').trim().length > 0);
    if (nonEmpty.length < 3) continue;
    const lexical = nonEmpty.filter((cell) => /[A-Za-z]/.test(cell));
    const score = lexical.length * 2 + new Set(nonEmpty.map((entry) => entry.toLowerCase())).size;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return { headerIndex: bestIndex, headers: (rows[bestIndex] ?? []).map((header, i) => String(header || `col_${i + 1}`).trim()) };
}

function normalizeColumn(header: string): keyof NonNullable<ExtractionChunk['fields']> | undefined {
  const lower = header.toLowerCase();
  if (/title|subject|issue|item|task|description/.test(lower)) return 'title';
  if (/project|job|contract|site/.test(lower)) return 'project';
  if (/owner|by|requested by/.test(lower)) return 'owner';
  if (/assignee|assigned/.test(lower)) return 'owner';
  if (/due|deadline|target/.test(lower)) return 'dueDate';
  if (/waiting|blocked|dependency/.test(lower)) return 'waitingOn';
  if (/priority|severity/.test(lower)) return 'priority';
  if (/status|state/.test(lower)) return 'statusHint';
  if (/note|comment|summary/.test(lower)) return 'summary';
  if (/next|action/.test(lower)) return 'nextStep';
  return undefined;
}

function extractSpreadsheet(buffer: ArrayBuffer): Stage2Extraction {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const refs: string[] = [];
  const chunks: ExtractionChunk[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames.slice(0, 12)) {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, defval: '' })
      .map((row) => row.map((cell) => String(cell ?? '').trim()));
    if (!rows.length) continue;
    const { headerIndex, headers } = inferHeaderRow(rows);
    const columnMap = headers.map((header) => normalizeColumn(header));

    for (let rowIdx = headerIndex + 1; rowIdx < Math.min(rows.length, 320); rowIdx += 1) {
      const row = rows[rowIdx] ?? [];
      const values = headers.map((header, colIdx) => ({ header, value: row[colIdx] ?? '' })).filter((entry) => entry.value.trim());
      if (values.length < 2) continue;
      if (values.every((entry) => /^[-–—_ ]+$/.test(entry.value))) continue;
      if (values.some((entry) => /subtotal|total|grand total/i.test(entry.value)) && values.length < 3) continue;
      if (values.some((entry) => /notes?|legend|key|metadata/i.test(entry.header)) && values.length <= 2) continue;
      if (values.join(' ').length < 20) continue;

      const sourceRef = `${sheetName}#row${rowIdx + 1}`;
      const fields: ExtractionChunk['fields'] = {};
      values.forEach((entry, colIdx) => {
        const mapped = columnMap[colIdx];
        if (mapped && !fields[mapped]) fields[mapped] = entry.value;
      });
      const text = values.map((entry) => `${entry.header}: ${entry.value}`).join(' | ');
      const quality = Math.min(1, values.length / 6 + (fields.title ? 0.2 : 0) + (fields.dueDate ? 0.1 : 0) + (fields.owner ? 0.08 : 0));
      const rowContext = [rows[rowIdx - 1], rows[rowIdx + 1]]
        .filter((neighbor): neighbor is string[] => Array.isArray(neighbor))
        .map((neighbor) => neighbor.map((cell, index) => `${headers[index] || `col_${index + 1}`}: ${cell || ''}`).filter((cell) => !cell.endsWith(': ')).join(' | '))
        .filter(Boolean)
        .slice(0, 2);
      refs.push(sourceRef);
      chunks.push({ text, sourceRef, kind: 'sheet_row', fields, quality, sheetName, rowNumber: rowIdx + 1, rowContext });
    }
  }

  if (!chunks.length) warnings.push('Spreadsheet rows were mostly empty or not row-tracker shaped.');
  return {
    text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
    chunks,
    refs,
    metadata: { sheetCount: wb.SheetNames.length, rowCandidates: chunks.length },
    warnings,
    attachments: [],
    confidence: chunks.length ? 0.82 : 0.3,
  };
}

function extractEmail(buffer: ArrayBuffer): Stage2Extraction {
  const raw = arrayBufferToText(buffer);
  const parsed = parseMultipartEml(raw);
  const refs: string[] = [];
  const chunks: ExtractionChunk[] = [];

  const subject = parsed.subject?.trim();
  if (subject) {
    refs.push('email:subject');
    chunks.push({ text: subject, sourceRef: 'email:subject', kind: 'email_header', fields: { title: subject }, quality: 0.9 });
  }
  if (parsed.from) {
    refs.push('email:from');
    chunks.push({ text: parsed.from, sourceRef: 'email:from', kind: 'email_header', fields: { owner: parsed.from }, quality: 0.8 });
  }
  if (parsed.sentDate) {
    refs.push('email:date');
    chunks.push({ text: parsed.sentDate, sourceRef: 'email:date', kind: 'email_header', fields: {}, quality: 0.7 });
  }
  if (parsed.bodyText) {
    refs.push('email:body');
    chunks.push({ text: parsed.bodyText, sourceRef: 'email:body', kind: 'email_body', quality: Math.min(1, parsed.bodyText.length / 500) });
  }

  return {
    text: chunks.map((chunk) => `[${chunk.sourceRef}] ${chunk.text}`).join('\n'),
    chunks,
    refs,
    metadata: {
      subject: subject ?? null,
      from: parsed.from ?? null,
      sentDate: parsed.sentDate ?? null,
      recipients: [...parsed.to, ...parsed.cc].slice(0, 12).join(', ') || null,
      attachmentCount: parsed.attachments.length,
    },
    warnings: parsed.warnings,
    attachments: parsed.attachments,
    confidence: parsed.bodyText.length > 120 ? 0.9 : 0.66,
  };
}

async function runStage2(kind: IntakeAssetKind, buffer: ArrayBuffer, fileName: string): Promise<Stage2Extraction> {
  const extension = getIntakeFileExtension(fileName);
  if (kind === 'pdf') return extractPdf(buffer);
  if (kind === 'document') return extension === '.doc' ? extractLegacyDoc(buffer) : extractDocx(buffer);
  if (kind === 'presentation') return extractPresentation(buffer);
  if (kind === 'spreadsheet' || kind === 'csv') return extractSpreadsheet(buffer);
  if (kind === 'email') return extension === '.msg' ? extractMsg(buffer) : extractEmail(buffer);

  const text = normalizeText(arrayBufferToText(buffer), kind);
  const sourceRef = 'text:body';
  return {
    text,
    chunks: text ? [{ text, sourceRef, kind: 'text', quality: Math.min(1, text.length / 500) }] : [],
    refs: text ? [sourceRef] : [],
    metadata: {},
    warnings: text ? [] : ['Unable to decode readable text.'],
    attachments: [],
    confidence: text.length > 160 ? 0.72 : 0.45,
  };
}

function inferCandidateType(text: string): { type: IntakeCandidateType; reasons: string[]; intent: 'new_work' | 'update' | 'reference' } {
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  if (/\b(waiting on|awaiting|pending response|follow up)\b/.test(lower)) {
    reasons.push('Detected waiting/response language.');
    return { type: 'followup', reasons, intent: 'new_work' };
  }
  if (/\b(update|revised|status changed|closed|continuation|latest status)\b/.test(lower)) {
    reasons.push('Detected update/continuation language.');
    return { type: 'update_existing_followup', reasons, intent: 'update' };
  }
  if (actionSignalRegex.test(lower)) {
    reasons.push('Detected explicit action language.');
    return { type: 'task', reasons, intent: 'new_work' };
  }
  reasons.push('No clear action language; classified as reference.');
  return { type: 'reference', reasons, intent: 'reference' };
}

function cleanCandidateTitle(raw: string, fallback: string): string {
  const cleaned = sanitizeIntakeText(raw.replace(/^(re|fw|fwd)\s*:\s*/i, '').replace(/^(subject|title)\s*:\s*/i, '').replace(/[|]+/g, ' ').replace(/\s+/g, ' ')).trim();
  if (!cleaned) return fallback;
  const sentence = cleaned.split(/[.!?]\s/)[0] || cleaned;
  const compact = sentence.slice(0, 96).trim();
  return compact.length < 8 ? fallback : compact;
}

function classifyDateRoles(text: string, metadata: IntakeAssetRecord['metadata'], chunk: ExtractionChunk): DateRoleMap {
  const mentions = (text.match(explicitDateRegex) ?? []).map((entry) => entry.trim());
  const historicalDates: string[] = [];
  let dueDate: string | undefined;
  let promisedDate: string | undefined;
  let nextTouchDate: string | undefined;
  mentions.forEach((entry) => {
    const lower = text.toLowerCase();
    if (!dueDate && new RegExp(`(due|deadline|by)\\s+${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lower)) dueDate = entry;
    else if (!promisedDate && new RegExp(`(promise|target|commit)\\w*\\s+(for\\s+)?${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lower)) promisedDate = entry;
    else if (!nextTouchDate && new RegExp(`(follow up|check in|touch base).{0,25}${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(lower)) nextTouchDate = entry;
    else historicalDates.push(entry);
  });
  return {
    sourceDate: String(metadata.sentDate || metadata.lastModified || '') || undefined,
    dueDate: dueDate || chunk.fields?.dueDate,
    promisedDate,
    nextTouchDate,
    historicalDates: historicalDates.slice(0, 4),
  };
}

function detectProject(text: string): { project?: string; confidence: number; reason: string } {
  const patterns = [
    /\b(project|job|site|contract)\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9 .\-#/]{2,38})/i,
    /\b([A-Z]{1,3}-\d{2,6})\b/,
    /\b(B\d{3,6})\b/i,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const value = (match[2] ?? match[1]).trim();
      if (value.length >= 3) return { project: value, confidence: 0.78, reason: 'Project/job token detected.' };
    }
  }
  return { confidence: 0.28, reason: 'No clear project marker.' };
}

function extractOwnerSignals(text: string, chunk: ExtractionChunk): { owner?: string; requestedParty?: string; confidence: number; warning?: string } {
  const requestedParty = /(?:assign(?:ed)? to|owner|responsible|please have)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/.exec(text)?.[1];
  const emailOwner = (text.match(emailRegex) ?? [])[0];
  const owner = chunk.fields?.owner || requestedParty || emailOwner;
  if (!owner) return { confidence: 0.2 };
  const multiplePeople = (text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g) ?? []).length > 2;
  return {
    owner,
    requestedParty,
    confidence: requestedParty ? 0.84 : emailOwner ? 0.62 : 0.55,
    warning: multiplePeople ? 'Multiple possible owners found.' : undefined,
  };
}

function scoreDueDateSignals(values: string[]): { picked?: string; confidence: number; warning?: string } {
  const normalized = values.map((entry) => entry.trim()).filter(Boolean);
  if (!normalized.length) return { confidence: 0 };
  const unique = [...new Set(normalized)];
  if (unique.length === 1) return { picked: unique[0], confidence: 0.86 };
  return { picked: unique[0], confidence: 0.45, warning: 'Conflicting due dates detected in source.' };
}

function buildEvidence(asset: IntakeAssetRecord, chunks: ExtractionChunk[], field: string, regex: RegExp): IntakeEvidence[] {
  const out: IntakeEvidence[] = [];
  for (const chunk of chunks.slice(0, 80)) {
    const match = chunk.text.match(regex);
    if (!match?.length) continue;
    for (const value of match.slice(0, 2)) {
      out.push({
        id: createId('EVD'),
        field,
        snippet: value.slice(0, 220),
        sourceRef: `${asset.fileName} • ${chunk.sourceRef}`,
        assetId: asset.id,
        locator: chunk.sourceRef,
        sourceType: chunk.kind,
        score: Number((chunk.quality ?? 0.6).toFixed(2)),
      });
    }
    if (out.length >= 8) break;
  }
  return out;
}

function chunksForCandidate(kind: IntakeAssetKind, chunks: ExtractionChunk[]): ExtractionChunk[] {
  if (kind === 'spreadsheet' || kind === 'csv') return chunks.slice(0, 140).filter((chunk) => (chunk.quality ?? 0) >= 0.45);
  if (kind === 'document') return chunks.filter((chunk) => /^[-*•]|\d+\.|action|owner|due/i.test(chunk.text)).slice(0, 50);
  if (kind === 'email') return chunks.filter((chunk) => chunk.kind === 'email_body' || chunk.kind === 'email_header').slice(0, 8);
  return chunks.slice(0, 18);
}

function buildCandidateFromChunk(asset: IntakeAssetRecord, chunk: ExtractionChunk, index: number, items: FollowUpItem[], tasks: TaskItem[]): IntakeWorkCandidate {
  const parsedType = inferCandidateType(chunk.text);
  const fallbackTitle = `${asset.fileName.replace(/\.[^.]+$/, '')} item ${index + 1}`;
  const title = cleanCandidateTitle(chunk.fields?.title || chunk.text.split(/[\n|]/)[0].trim(), fallbackTitle);
  const projectSignal = detectProject(`${chunk.text}\n${String(asset.metadata.subject || '')}`);
  const project = chunk.fields?.project || projectSignal.project;
  const dateRoles = classifyDateRoles(chunk.text, asset.metadata, chunk);
  const dueCandidates = [dateRoles.dueDate, ...((chunk.text.match(explicitDateRegex) ?? []).slice(0, 3))].filter(Boolean) as string[];
  const due = scoreDueDateSignals(dueCandidates);
  const { signals: dateSignals, warnings: dateWarnings } = buildDateSignalSet({
    sourceDate: dateRoles.sourceDate,
    dueDate: due.picked || dateRoles.dueDate,
    promisedDate: dateRoles.promisedDate,
    nextTouchDate: dateRoles.nextTouchDate,
    historicalDates: dateRoles.historicalDates,
  });
  const ownerSignals = extractOwnerSignals(chunk.text, chunk);
  const waitingOn = chunk.fields?.waitingOn || /waiting on\s+([^.,;\n]+)/i.exec(chunk.text)?.[1];

  const evidence: IntakeEvidence[] = [
    {
      id: createId('EVD'),
      field: 'summary',
      snippet: chunk.text.slice(0, 260),
      sourceRef: `${asset.fileName} • ${chunk.sourceRef}`,
      assetId: asset.id,
      locator: chunk.sourceRef,
      sourceType: chunk.kind,
      score: Number((chunk.quality ?? 0.6).toFixed(2)),
    },
  ];
  evidence.push(...buildEvidence(asset, [chunk], 'owner', emailRegex));
  evidence.push(...buildEvidence(asset, [chunk], 'dueDate', explicitDateRegex));
  if (project) {
    evidence.push({
      id: createId('EVD'),
      field: 'project',
      snippet: project,
      sourceRef: `${asset.fileName} • ${chunk.sourceRef}`,
      assetId: asset.id,
      locator: chunk.sourceRef,
      sourceType: chunk.kind,
      score: projectSignal.confidence,
    });
  }

  const existing = resolveCandidateMatches({
    id: createId('CANPRE'),
    batchId: asset.batchId,
    assetId: asset.id,
    sourceAssetIds: [asset.id],
    candidateType: parsedType.type,
    suggestedAction: 'create_new',
    confidence: 0.5,
    title,
    project,
    dueDate: due.picked,
    waitingOn,
    priority: 'Medium',
    summary: chunk.text,
    tags: [],
    explanation: [],
    evidence: [],
    warnings: [],
    duplicateMatches: [],
    existingRecordMatches: [],
    approvalStatus: 'pending',
    createdAt: todayIso(),
    updatedAt: todayIso(),
  }, items, tasks);

  const suggestedAction = existing[0]?.strategy === 'duplicate'
    ? 'ignore_duplicate'
    : existing[0]?.strategy === 'update'
      ? 'update_existing'
      : existing[0]
        ? 'link_existing'
        : parsedType.type === 'reference'
          ? 'reference_only'
          : 'create_new';

  const confidence = Number(Math.max(0.2, Math.min(0.98,
    (asset.extractionConfidence ?? 0.6) * 0.48
    + (chunk.quality ?? 0.5) * 0.28
    + (actionSignalRegex.test(chunk.text) ? 0.12 : 0)
    + (due.confidence * 0.12)
    + (project ? 0.06 : -0.04)
    + (ownerSignals.owner ? 0.05 : -0.05)
    - (nonContentRegex.test(chunk.text) ? 0.2 : 0)
    - (due.warning ? 0.12 : 0)
  )).toFixed(2));

  const warnings = [
    ...(asset.parseQuality === 'weak' ? ['Low parse quality: keep in review.'] : []),
    ...(due.warning ? [due.warning] : []),
    ...(ownerSignals.warning ? [ownerSignals.warning] : []),
    ...(!project ? ['Project uncertain.'] : []),
    ...(due.picked && !dateRoles.dueDate ? ['Due date inferred from body text.'] : []),
    ...(asset.kind === 'email' && /on .+wrote:/i.test(chunk.text) ? ['Email thread may contain multiple action items.'] : []),
    ...(asset.kind === 'spreadsheet' && (chunk.quality ?? 0) < 0.55 ? ['Spreadsheet row context weak.'] : []),
    ...dateWarnings,
  ];

  return {
    id: createId('CAN'),
    batchId: asset.batchId,
    assetId: asset.id,
    sourceAssetIds: [asset.id],
    candidateType: suggestedAction === 'update_existing' && existing[0]?.recordType === 'task' ? 'update_existing_task' : suggestedAction === 'update_existing' ? 'update_existing_followup' : parsedType.type,
    suggestedAction,
    intent: parsedType.intent,
    confidence,
    title,
    project,
    owner: ownerSignals.owner,
    assignee: undefined,
    dueDate: due.picked || dateRoles.dueDate,
    dateSignals,
    nextStep: chunk.fields?.nextStep || cleanCandidateTitle(chunk.text, title).slice(0, 120),
    waitingOn,
    priority: /critical|urgent|asap/.test(chunk.text.toLowerCase()) ? 'High' : /low priority/.test(chunk.text.toLowerCase()) ? 'Low' : 'Medium',
    statusHint: chunk.fields?.statusHint || (parsedType.type === 'followup' ? 'Waiting on external' : parsedType.type === 'reference' ? 'In progress' : 'Needs action'),
    summary: chunk.text,
    tags: ['intake', asset.kind],
    explanation: [...parsedType.reasons, projectSignal.reason, `Source ${chunk.sourceRef}`],
    evidence,
    fieldConfidence: {
      title: Number((chunk.quality ?? 0.6).toFixed(2)),
      dueDate: due.confidence,
      project: projectSignal.confidence,
      owner: ownerSignals.confidence,
      sourceDate: dateRoles.sourceDate ? 0.9 : 0.2,
      promisedDate: dateRoles.promisedDate ? 0.68 : 0.15,
      nextTouchDate: dateRoles.nextTouchDate ? 0.64 : 0.12,
    },
    warnings,
    duplicateMatches: existing.filter((entry) => entry.strategy === 'duplicate'),
    existingRecordMatches: existing,
    suspectedDuplicateGroupId: undefined,
    approvalStatus: 'pending',
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}

export async function parseIntakeFile(file: File, batchId: string, options: ParseOptions = {}): Promise<IntakeAssetRecord[]> {
  const uploadedAt = todayIso();
  const capability = getIntakeFileCapability(file.name);
  const extension = getIntakeFileExtension(file.name);
  const kind = detectAssetKind(file.name, file.type);
  const retryInfo = await buildIntakeRetrySource(file);
  const buffer = await file.arrayBuffer();
  const seen = options.seen ?? new Set<string>();
  const contentHash = `${file.name}-${file.size}-${file.lastModified}`;
  if (seen.has(contentHash)) return [];
  seen.add(contentHash);

  const assetId = createId('AST');
  const base: IntakeAssetRecord = {
    id: assetId,
    batchId,
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    kind,
    source: 'drop',
    uploadedAt,
    parseStatus: 'reading',
    parseQuality: 'partial',
    metadata: {},
    extractedText: '',
    extractedPreview: '',
    warnings: [],
    errors: [],
    attachmentIds: [],
    sourceRefs: [],
    contentHash,
    parentAssetId: options.parentAssetId,
    rootAssetId: options.rootAssetId,
    parserStages: ['stage1-route', 'stage2-extract'],
    retrySource: retryInfo.retrySource,
    retryUnavailableReason: retryInfo.reason,
  };

  if (capability.state === 'blocked') {
    return [{
      ...base,
      parseStatus: 'failed',
      parseQuality: 'failed',
      errors: [capability.reason || 'Unsupported file type for intake.'],
      warnings: [capability.reason || 'Unsupported file type for intake.', 'Use a supported format or paste the key text manually.'],
      metadata: { ...base.metadata, capabilityState: 'blocked', fileExtension: extension || null },
      parserStages: [...(base.parserStages ?? []), 'stage1-blocked'],
    }];
  }

  try {
    const extracted = await runStage2(kind, buffer, file.name);
    const quality = extracted.confidence >= 0.82 ? 'strong' : extracted.confidence >= 0.55 ? 'partial' : 'weak';
    const baseStatus = extracted.text ? (quality === 'strong' ? 'parsed' : 'review_needed') : 'failed';
    const parseStatus = capability.state === 'manual_review_only' && baseStatus !== 'failed' ? 'review_needed' : baseStatus;
    const parseQuality = parseStatus === 'failed' ? 'failed' : capability.state === 'manual_review_only' ? 'weak' : quality;
    const warnings = [
      ...(capability.state === 'manual_review_only' ? [capability.reason || 'This format is accepted only with manual review.'] : []),
      ...extracted.warnings,
    ];

    const asset: IntakeAssetRecord = {
      ...base,
      metadata: { ...extracted.metadata, lastModified: file.lastModified, capabilityState: capability.state, fileExtension: extension || null },
      parseStatus,
      parseQuality,
      extractedText: extracted.text.slice(0, 160000),
      extractedPreview: extracted.text.slice(0, 700),
      sourceRefs: extracted.refs,
      warnings,
      extractionConfidence: Number(extracted.confidence.toFixed(2)),
      extractionChunks: extracted.chunks.map((chunk, index) => ({
        id: createId(`CHK${index}`),
        sourceRef: chunk.sourceRef,
        locator: chunk.sourceRef,
        kind: chunk.kind,
        text: chunk.text,
        fieldHints: chunk.fields,
        quality: chunk.quality,
        confidence: chunk.quality,
        sheetName: chunk.sheetName ?? (chunk.sourceRef.includes('#row') ? chunk.sourceRef.split('#row')[0] : undefined),
        rowNumber: chunk.rowNumber ?? (chunk.sourceRef.includes('#row') ? Number(chunk.sourceRef.split('#row')[1]) || undefined : undefined),
        rowContext: chunk.rowContext,
      })),
      parserStages: [...(base.parserStages ?? []), 'stage3-semantic-ready', 'stage4-validated'],
    };

    const assets: IntakeAssetRecord[] = [asset];
    for (const attachment of extracted.attachments.slice(0, 15)) {
      const attachmentType = attachment.contentType || 'application/octet-stream';
      const attachmentBytes = attachment.bytes instanceof Uint8Array ? new Uint8Array(attachment.bytes) : new Uint8Array(attachment.bytes);
      const attachmentFile = new File([attachmentBytes], attachment.fileName, { type: attachmentType, lastModified: file.lastModified });
      const childAssets = await parseIntakeFile(attachmentFile, batchId, {
        seen,
        parentAssetId: asset.id,
        rootAssetId: options.rootAssetId ?? asset.id,
      });
      if (childAssets.length) {
        asset.attachmentIds.push(...childAssets.map((entry) => entry.id));
        assets.push(...childAssets);
      }
    }

    return assets;
  } catch (error) {
    return [{
      ...base,
      parseStatus: 'failed',
      parseQuality: 'failed',
      errors: [error instanceof Error ? error.message : 'Unknown parse error'],
      parserStages: [...(base.parserStages ?? []), 'stage2-failed'],
    }];
  }
}

function chunkSignature(candidate: IntakeWorkCandidate, chunk: ExtractionChunk): string {
  const summaryKey = candidate.summary.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 64);
  const due = candidate.dueDate || candidate.dateSignals?.dueDateRaw || '';
  const rowIdentity = chunk.sourceRef.includes('#row') ? chunk.sourceRef : '';
  return [candidate.title.toLowerCase(), (candidate.project || '').toLowerCase(), due, rowIdentity, summaryKey].join('|');
}

export function buildCandidatesFromAsset(asset: IntakeAssetRecord, items: FollowUpItem[], tasks: TaskItem[]): IntakeWorkCandidate[] {
  const chunkSource = (asset.extractionChunks ?? []).map((chunk) => ({
    text: chunk.text,
    sourceRef: chunk.sourceRef || chunk.locator || asset.fileName,
    kind: chunk.kind,
    fields: chunk.fieldHints,
    quality: chunk.quality,
  } as ExtractionChunk));
  if (!chunkSource.length && !asset.extractedText) return [];
  const fallbackChunks = chunkSource.length ? chunkSource : [{ text: asset.extractedText, sourceRef: asset.fileName, kind: 'text', quality: 0.4 } as ExtractionChunk];

  const generated = chunksForCandidate(asset.kind, fallbackChunks)
    .map((chunk, index) => ({ candidate: buildCandidateFromChunk(asset, chunk, index, items, tasks), chunk }))
    .filter(({ candidate }, index) => {
      const strongEnough = candidate.confidence >= (asset.kind === 'spreadsheet' || asset.kind === 'csv' ? 0.55 : 0.5);
      const hasSignal = candidate.title.length >= 8 && !!candidate.summary && !nonContentRegex.test(candidate.summary);
      return strongEnough && hasSignal && index < (asset.kind === 'spreadsheet' || asset.kind === 'csv' ? 60 : 16);
    });

  const signatures = generated.map(({ candidate, chunk }) => chunkSignature(candidate, chunk));
  const counts = signatures.reduce((acc, sig) => { acc.set(sig, (acc.get(sig) ?? 0) + 1); return acc; }, new Map<string, number>());
  return generated.map(({ candidate }, index) => {
    const signature = signatures[index];
    return {
      ...candidate,
      suspectedDuplicateGroupId: (counts.get(signature) ?? 0) > 1 ? `dup-${signature}` : undefined,
    };
  });
}

export function buildBatchRecord(assetIds: string[]): IntakeBatchRecord {
  return {
    id: createId('BAT'),
    createdAt: todayIso(),
    source: 'drop',
    assetIds,
    status: 'review',
    stats: {
      filesProcessed: assetIds.length,
      candidatesCreated: 0,
      highConfidence: 0,
      failedParses: 0,
      duplicatesFlagged: 0,
    },
  };
}
