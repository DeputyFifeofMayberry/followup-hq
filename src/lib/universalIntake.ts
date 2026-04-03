import * as XLSX from 'xlsx';
import type {
  IntakeAssetKind,
  IntakeAssetRecord,
  IntakeBatchRecord,
  IntakeCandidateType,
  IntakeEvidence,
  IntakeExistingMatch,
  IntakeWorkCandidate,
  TaskItem,
  FollowUpItem,
} from '../types';
import { createId, todayIso } from './utils';

const emailRegex = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g;
const dueRegex = /\b(?:due|deadline|by)\s*[:\-]?\s*([A-Za-z]{3,9}\s+\d{1,2}(?:,\s*\d{4})?|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i;
const explicitDateRegex = /\b(\d{4}-\d{2}-\d{2})\b/;

function arrayBufferToText(buffer: ArrayBuffer): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer);
}

export function detectAssetKind(fileName: string, fileType: string): IntakeAssetKind {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.eml') || lower.endsWith('.msg')) return 'email';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) return 'spreadsheet';
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'document';
  if (lower.endsWith('.pptx')) return 'presentation';
  if (lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.html') || lower.endsWith('.htm')) return 'html';
  if (fileType.includes('message')) return 'email';
  if (fileType.includes('sheet') || fileType.includes('excel')) return 'spreadsheet';
  return 'unknown';
}

function extractDocxText(buffer: ArrayBuffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' }) as XLSX.WorkBook & { files?: Record<string, { content?: string }> };
    const maybeXml = Object.keys(workbook.files ?? {})
      .filter((name) => name.includes('word/document.xml'))
      .map((name) => {
        const payload = workbook.files?.[name];
        return typeof payload?.content === 'string' ? payload.content : '';
      })
      .join(' ');
    return maybeXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  } catch {
    return '';
  }
}

function parseSpreadsheet(buffer: ArrayBuffer): { text: string; refs: string[]; metadata: Record<string, string | number | boolean | null> } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const refs: string[] = [];
  const chunks: string[] = [];
  const metadata: Record<string, string | number | boolean | null> = { sheetCount: wb.SheetNames.length };

  wb.SheetNames.forEach((sheetName) => {
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    rows.slice(0, 120).forEach((row, idx) => {
      const values = Object.entries(row)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(' | ')
        .trim();
      if (!values) return;
      refs.push(`${sheetName}#row${idx + 2}`);
      chunks.push(`[${sheetName} row ${idx + 2}] ${values}`);
    });
  });

  return { text: chunks.join('\n'), refs, metadata };
}

function normalizeText(raw: string, kind: IntakeAssetKind): string {
  if (kind === 'html') {
    return raw.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return raw.replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export async function parseIntakeFile(file: File, batchId: string): Promise<IntakeAssetRecord> {
  const uploadedAt = todayIso();
  const kind = detectAssetKind(file.name, file.type);
  const buffer = await file.arrayBuffer();
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
    contentHash: `${file.name}-${file.size}-${file.lastModified}`,
  };

  try {
    let text = '';
    let refs: string[] = [];
    const metadata: Record<string, string | number | boolean | null> = { lastModified: file.lastModified };

    if (kind === 'spreadsheet' || kind === 'csv') {
      const parsed = parseSpreadsheet(buffer);
      text = parsed.text;
      refs = parsed.refs;
      Object.assign(metadata, parsed.metadata);
    } else if (kind === 'document') {
      text = extractDocxText(buffer);
      if (!text) {
        text = normalizeText(arrayBufferToText(buffer), kind);
        base.warnings.push('DOCX parser fell back to plain text decode.');
      }
    } else {
      text = normalizeText(arrayBufferToText(buffer), kind);
    }

    if (!text) {
      return {
        ...base,
        parseStatus: 'failed',
        parseQuality: 'failed',
        errors: ['Unable to extract readable text from file.'],
      };
    }

    const quality = text.length > 240 ? 'strong' : text.length > 80 ? 'partial' : 'weak';
    return {
      ...base,
      metadata,
      parseStatus: quality === 'strong' ? 'parsed' : 'review_needed',
      parseQuality: quality,
      extractedText: text.slice(0, 150000),
      extractedPreview: text.slice(0, 600),
      sourceRefs: refs,
    };
  } catch (error) {
    return {
      ...base,
      parseStatus: 'failed',
      parseQuality: 'failed',
      errors: [error instanceof Error ? error.message : 'Unknown parse error'],
    };
  }
}

function inferCandidateType(text: string): { type: IntakeCandidateType; reasons: string[] } {
  const lower = text.toLowerCase();
  const reasons: string[] = [];
  if (/\b(waiting on|awaiting|pending response|follow up)\b/.test(lower)) {
    reasons.push('Detected waiting/response language.');
    return { type: 'followup', reasons };
  }
  if (/\b(action item|todo|to do|please|need to|assign|owner|due)\b/.test(lower)) {
    reasons.push('Detected explicit action language.');
    return { type: 'task', reasons };
  }
  if (/\b(update|revised|status changed|closed)\b/.test(lower)) {
    reasons.push('Detected update/change language.');
    return { type: 'update_existing_followup', reasons };
  }
  reasons.push('No clear action language; safer as reference.');
  return { type: 'reference', reasons };
}

function extractEvidence(text: string, field: string, pattern: RegExp, sourceRef: string): IntakeEvidence[] {
  const out: IntakeEvidence[] = [];
  const matches = text.match(pattern);
  if (!matches?.length) return out;
  matches.slice(0, 2).forEach((value) => {
    out.push({ id: createId('EVD'), field, snippet: value.slice(0, 180), sourceRef });
  });
  return out;
}

function findMatches(title: string, project: string | undefined, items: FollowUpItem[], tasks: TaskItem[]): IntakeExistingMatch[] {
  const titleKey = title.toLowerCase();
  const scored: IntakeExistingMatch[] = [];

  items.forEach((item) => {
    let score = 0;
    if (item.title.toLowerCase().includes(titleKey) || titleKey.includes(item.title.toLowerCase())) score += 0.65;
    if (project && item.project.toLowerCase() === project.toLowerCase()) score += 0.25;
    if (score >= 0.55) {
      scored.push({ id: item.id, recordType: 'followup', title: item.title, project: item.project, score: Number(score.toFixed(2)), reason: 'Similar title/project match' });
    }
  });

  tasks.forEach((task) => {
    let score = 0;
    if (task.title.toLowerCase().includes(titleKey) || titleKey.includes(task.title.toLowerCase())) score += 0.65;
    if (project && task.project.toLowerCase() === project.toLowerCase()) score += 0.25;
    if (score >= 0.55) {
      scored.push({ id: task.id, recordType: 'task', title: task.title, project: task.project, score: Number(score.toFixed(2)), reason: 'Similar title/project match' });
    }
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 3);
}

export function buildCandidatesFromAsset(asset: IntakeAssetRecord, items: FollowUpItem[], tasks: TaskItem[]): IntakeWorkCandidate[] {
  if (!asset.extractedText) return [];
  const lines = asset.extractedText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const chunks = asset.kind === 'spreadsheet' || asset.kind === 'csv'
    ? lines.slice(0, 80)
    : [lines.slice(0, 24).join(' ')];

  return chunks.slice(0, 20).map((chunk, index) => {
    const { type, reasons } = inferCandidateType(chunk);
    const evidence: IntakeEvidence[] = [
      { id: createId('EVD'), field: 'summary', snippet: chunk.slice(0, 220), sourceRef: asset.sourceRefs[index] || asset.fileName },
      ...extractEvidence(chunk, 'owner', emailRegex, asset.fileName),
      ...extractEvidence(chunk, 'dueDate', dueRegex, asset.fileName),
      ...extractEvidence(chunk, 'dueDate', explicitDateRegex, asset.fileName),
    ];

    const title = chunk.slice(0, 88) || `${asset.fileName} candidate ${index + 1}`;
    const project = /project\s*[:\-]\s*([A-Za-z0-9\- ]{2,30})/i.exec(chunk)?.[1]?.trim();
    const dueDate = explicitDateRegex.exec(chunk)?.[1];
    const confidenceBase = asset.parseQuality === 'strong' ? 0.86 : asset.parseQuality === 'partial' ? 0.7 : 0.55;
    const confidence = Math.min(0.98, Number((confidenceBase + (type === 'reference' ? -0.12 : 0.05)).toFixed(2)));
    const existing = findMatches(title, project, items, tasks);
    const suggestedAction = existing[0]?.score && existing[0].score >= 0.85
      ? 'update_existing'
      : existing[0]?.score && existing[0].score >= 0.65
        ? 'link_existing'
        : type === 'reference'
          ? 'reference_only'
          : 'create_new';

    return {
      id: createId('CAN'),
      batchId: asset.batchId,
      assetId: asset.id,
      candidateType: suggestedAction === 'update_existing' && existing[0]?.recordType === 'task' ? 'update_existing_task' : suggestedAction === 'update_existing' ? 'update_existing_followup' : type,
      suggestedAction,
      confidence,
      title,
      project,
      owner: evidence.find((entry) => entry.field === 'owner')?.snippet,
      assignee: undefined,
      dueDate,
      nextStep: chunk.slice(0, 120),
      waitingOn: /waiting on\s+([^.,;]+)/i.exec(chunk)?.[1],
      priority: /urgent|critical|asap/i.test(chunk) ? 'High' : 'Medium',
      statusHint: type === 'followup' ? 'Waiting on external' : type === 'reference' ? 'In progress' : 'Needs action',
      summary: chunk,
      tags: ['intake', asset.kind],
      explanation: reasons,
      evidence,
      warnings: asset.parseQuality === 'weak' ? ['Low parse quality: keep this in review.'] : [],
      duplicateMatches: existing.filter((entry) => entry.score >= 0.85),
      existingRecordMatches: existing,
      approvalStatus: 'pending',
      createdAt: todayIso(),
      updatedAt: todayIso(),
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
