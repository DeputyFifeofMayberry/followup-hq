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

const emailRegex = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const explicitDateRegex = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|[A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?)\b/;
const actionSignalRegex = /\b(action item|todo|to do|please|need to|assign|owner|due|follow up|waiting on|respond)\b/i;

interface ExtractionChunk {
  text: string;
  sourceRef: string;
  kind: 'email_header' | 'email_body' | 'pdf_page' | 'docx_paragraph' | 'sheet_row' | 'text';
  fields?: Partial<Record<'title' | 'project' | 'owner' | 'dueDate' | 'waitingOn' | 'priority' | 'statusHint' | 'summary' | 'nextStep', string>>;
  quality?: number;
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

function normalizeText(raw: string, kind: IntakeAssetKind): string {
  if (kind === 'html') {
    return raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function arrayBufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

export function detectAssetKind(fileName: string, fileType: string): IntakeAssetKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.eml') || lower.endsWith('.msg')) return 'email';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'spreadsheet';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx') || lower.endsWith('.doc')) return 'document';
  if (lower.endsWith('.pptx')) return 'presentation';
  if (lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (fileType.includes('message')) return 'email';
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'spreadsheet';
  if (fileType.includes('word')) return 'document';
  if (fileType.includes('pdf')) return 'pdf';
  return 'unknown';
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

function decodeBodyByEncoding(content: string, encoding?: string): string {
  const normalizedEncoding = encoding?.toLowerCase();
  if (normalizedEncoding === 'base64') {
    try {
      const compact = content.replace(/\s+/g, '');
      const decoded = atob(compact);
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
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
      const decoded = decodeBodyByEncoding(partBody, partHeaders['content-transfer-encoding']);

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
    const fallback = decodeBodyByEncoding(bodyText, headers['content-transfer-encoding']);
    bodyPlain = normalizeText(fallback, contentType.includes('text/html') ? 'html' : 'text');
  }

  if (!bodyPlain.trim()) warnings.push('Email body is weak or empty.');

  return {
    subject: headers.subject,
    from: headers.from,
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

      const sourceRef = `${sheetName}#row${rowIdx + 1}`;
      const fields: ExtractionChunk['fields'] = {};
      values.forEach((entry, colIdx) => {
        const mapped = columnMap[colIdx];
        if (mapped && !fields[mapped]) fields[mapped] = entry.value;
      });
      const text = values.map((entry) => `${entry.header}: ${entry.value}`).join(' | ');
      const quality = Math.min(1, values.length / 6 + (fields.title ? 0.2 : 0));
      refs.push(sourceRef);
      chunks.push({ text, sourceRef, kind: 'sheet_row', fields, quality });
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
    chunks.push({ text: parsed.sentDate, sourceRef: 'email:date', kind: 'email_header', fields: { dueDate: parsed.sentDate }, quality: 0.5 });
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
    confidence: parsed.bodyText.length > 120 ? 0.86 : 0.62,
  };
}

async function runStage2(kind: IntakeAssetKind, buffer: ArrayBuffer): Promise<Stage2Extraction> {
  if (kind === 'pdf') return extractPdf(buffer);
  if (kind === 'document') return extractDocx(buffer);
  if (kind === 'spreadsheet' || kind === 'csv') return extractSpreadsheet(buffer);
  if (kind === 'email') return extractEmail(buffer);

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
  const title = chunk.fields?.title || chunk.text.split(/[\n|]/)[0].trim().slice(0, 110) || `${asset.fileName} candidate ${index + 1}`;
  const project = chunk.fields?.project || /project\s*[:-]\s*([A-Za-z0-9- ]{2,40})/i.exec(chunk.text)?.[1]?.trim();
  const dueCandidates = [chunk.fields?.dueDate, ...((chunk.text.match(explicitDateRegex) ?? []).slice(0, 3))].filter(Boolean) as string[];
  const due = scoreDueDateSignals(dueCandidates);
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

  const confidence = Number(Math.max(0.25, Math.min(0.98,
    (asset.extractionConfidence ?? 0.6) * 0.48
    + (chunk.quality ?? 0.5) * 0.28
    + (actionSignalRegex.test(chunk.text) ? 0.12 : 0)
    + (due.confidence * 0.12)
    - (due.warning ? 0.12 : 0)
  )).toFixed(2));

  const warnings = [
    ...(asset.parseQuality === 'weak' ? ['Low parse quality: keep in review.'] : []),
    ...(due.warning ? [due.warning] : []),
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
    owner: chunk.fields?.owner || evidence.find((entry) => entry.field === 'owner')?.snippet,
    assignee: undefined,
    dueDate: due.picked,
    nextStep: chunk.fields?.nextStep || chunk.text.slice(0, 120),
    waitingOn,
    priority: /critical|urgent|asap/.test(chunk.text.toLowerCase()) ? 'High' : /low priority/.test(chunk.text.toLowerCase()) ? 'Low' : 'Medium',
    statusHint: chunk.fields?.statusHint || (parsedType.type === 'followup' ? 'Waiting on external' : parsedType.type === 'reference' ? 'In progress' : 'Needs action'),
    summary: chunk.text,
    tags: ['intake', asset.kind],
    explanation: [...parsedType.reasons, `Source ${chunk.sourceRef}`],
    evidence,
    fieldConfidence: { title: Number((chunk.quality ?? 0.6).toFixed(2)), dueDate: due.confidence },
    warnings,
    duplicateMatches: existing.filter((entry) => entry.strategy === 'duplicate'),
    existingRecordMatches: existing,
    approvalStatus: 'pending',
    createdAt: todayIso(),
    updatedAt: todayIso(),
  };
}

export async function parseIntakeFile(file: File, batchId: string, options: ParseOptions = {}): Promise<IntakeAssetRecord[]> {
  const uploadedAt = todayIso();
  const kind = detectAssetKind(file.name, file.type);
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
  };

  try {
    const extracted = await runStage2(kind, buffer);
    const quality = extracted.confidence >= 0.82 ? 'strong' : extracted.confidence >= 0.55 ? 'partial' : 'weak';
    const parseStatus = extracted.text ? (quality === 'strong' ? 'parsed' : 'review_needed') : 'failed';

    const asset: IntakeAssetRecord = {
      ...base,
      metadata: { ...extracted.metadata, lastModified: file.lastModified },
      parseStatus,
      parseQuality: parseStatus === 'failed' ? 'failed' : quality,
      extractedText: extracted.text.slice(0, 160000),
      extractedPreview: extracted.text.slice(0, 700),
      sourceRefs: extracted.refs,
      warnings: extracted.warnings,
      extractionConfidence: Number(extracted.confidence.toFixed(2)),
      parserStages: [...(base.parserStages ?? []), 'stage3-semantic-ready', 'stage4-validated'],
    };

    const assets: IntakeAssetRecord[] = [asset];
    for (const attachment of extracted.attachments.slice(0, 15)) {
      const attachmentType = attachment.contentType || 'application/octet-stream';
      const attachmentFile = new File([attachment.bytes], attachment.fileName, { type: attachmentType, lastModified: file.lastModified });
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

export function buildCandidatesFromAsset(asset: IntakeAssetRecord, items: FollowUpItem[], tasks: TaskItem[]): IntakeWorkCandidate[] {
  if (!asset.extractedText) return [];
  const chunks: ExtractionChunk[] = asset.extractedText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const locatorMatch = /^\[([^\]]+)\]\s*/.exec(line);
      const sourceRef = locatorMatch?.[1] ?? asset.fileName;
      const text = line.replace(/^\[[^\]]+\]\s*/, '').trim();
      let kind: ExtractionChunk['kind'] = 'text';
      if (sourceRef.startsWith('page')) kind = 'pdf_page';
      else if (sourceRef.startsWith('paragraph')) kind = 'docx_paragraph';
      else if (sourceRef.includes('#row')) kind = 'sheet_row';
      else if (sourceRef.startsWith('email:')) kind = sourceRef === 'email:body' ? 'email_body' : 'email_header';
      return { text, sourceRef, kind, quality: Math.min(1, text.length / 200) };
    });

  return chunksForCandidate(asset.kind, chunks)
    .map((chunk, index) => buildCandidateFromChunk(asset, chunk, index, items, tasks))
    .filter((candidate, index, arr) => candidate.confidence >= 0.38 && index < (asset.kind === 'spreadsheet' || asset.kind === 'csv' ? 80 : 18) && arr.findIndex((entry) => entry.title.toLowerCase() === candidate.title.toLowerCase()) === index);
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
