import { useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Inbox, MailPlus, PlusCircle, Trash2, Upload } from 'lucide-react';
import { Badge } from './Badge';
import { buildDroppedEmailPreview, parseDroppedEmailFiles } from '../lib/emailDrop';
import { formatDateTime, sourceTone } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import { useShallow } from 'zustand/react/shallow';
import type { IntakeDocumentKind } from '../types';
import { addDaysIso, buildTouchEvent, createId, todayIso } from '../lib/utils';

function detectDocumentKind(fileName: string): IntakeDocumentKind {
  if (/\.(xlsx|xls|csv)$/i.test(fileName)) return 'Spreadsheet';
  if (/\.(docx|doc|rtf)$/i.test(fileName)) return 'Document';
  if (/\.pdf$/i.test(fileName)) return 'PDF';
  if (/\.(ppt|pptx)$/i.test(fileName)) return 'Presentation';
  if (/\.(txt|md)$/i.test(fileName)) return 'Text';
  return 'Other';
}

export function IntakePanel() {
  const {
    intakeSignals,
    convertSignalToItem,
    droppedEmailImports,
    addDroppedEmailImports,
    removeDroppedEmailImport,
    clearDroppedEmailImports,
    convertDroppedEmailToItem,
    intakeDocuments,
    addIntakeDocument,
    updateIntakeDocument,
    setIntakeDocumentDisposition,
    deleteIntakeDocument,
    addItem,
    addTask,
    projects,
  } = useAppStore(useShallow((s) => ({
    intakeSignals: s.intakeSignals,
    convertSignalToItem: s.convertSignalToItem,
    droppedEmailImports: s.droppedEmailImports,
    addDroppedEmailImports: s.addDroppedEmailImports,
    removeDroppedEmailImport: s.removeDroppedEmailImport,
    clearDroppedEmailImports: s.clearDroppedEmailImports,
    convertDroppedEmailToItem: s.convertDroppedEmailToItem,
    intakeDocuments: s.intakeDocuments,
    addIntakeDocument: s.addIntakeDocument,
    updateIntakeDocument: s.updateIntakeDocument,
    setIntakeDocumentDisposition: s.setIntakeDocumentDisposition,
    deleteIntakeDocument: s.deleteIntakeDocument,
    addItem: s.addItem,
    addTask: s.addTask,
    projects: s.projects,
  })));
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList).filter((file) => /\.(eml|msg|txt|html?)$/i.test(file.name));
    if (files.length === 0) {
      setErrors(['Drop an .eml, .msg, .txt, or .html email file to import it.']);
      return;
    }
    setBusy(true);
    try {
      const result = await parseDroppedEmailFiles(files);
      addDroppedEmailImports(result.imports);
      setErrors(result.errors);
    } finally {
      setBusy(false);
    }
  }

  function handleDocs(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    files.forEach((file) => {
      addIntakeDocument({
        name: file.name,
        kind: detectDocumentKind(file.name),
        project: 'General',
        owner: 'Jared',
        sourceRef: `Uploaded file: ${file.name}`,
        notes: 'Uploaded through intake document tray.',
        tags: ['Uploaded'],
      });
    });
  }

  const unprocessedDocs = intakeDocuments.filter((doc) => doc.disposition === 'Unprocessed');

  const convertDocToFollowUp = (docId: string) => {
    const doc = intakeDocuments.find((entry) => entry.id === docId);
    if (!doc) return;
    const project = projects.find((entry) => entry.id === doc.projectId);
    const now = todayIso();
    const followUpId = createId();
    addItem({
      id: followUpId,
      title: `Review ${doc.name}`,
      source: doc.kind === 'Spreadsheet' ? 'Excel' : 'Notes',
      project: project?.name ?? doc.project ?? 'General',
      projectId: doc.projectId,
      owner: doc.owner || 'Unassigned',
      status: 'Needs action',
      priority: 'Medium',
      dueDate: addDaysIso(now, 2),
      lastTouchDate: now,
      nextTouchDate: addDaysIso(now, 1),
      nextAction: `Open ${doc.name}, extract decisions, and route actions.`,
      summary: doc.notes || `Generated from intake document ${doc.name}.`,
      tags: [...doc.tags, 'Intake'],
      sourceRef: doc.sourceRef || `Intake:${doc.id}`,
      sourceRefs: [doc.sourceRef || `Intake:${doc.id}`],
      mergedItemIds: [],
      notes: doc.notes || '',
      timeline: [buildTouchEvent(`Converted intake document ${doc.name} into follow-up.`, 'imported')],
      category: 'General',
      owesNextAction: 'Internal',
      escalationLevel: 'None',
      cadenceDays: 3,
      draftFollowUp: '',
    });
    setIntakeDocumentDisposition(doc.id, 'Converted to follow-up', followUpId);
  };

  const convertDocToTask = (docId: string) => {
    const doc = intakeDocuments.find((entry) => entry.id === docId);
    if (!doc) return;
    const project = projects.find((entry) => entry.id === doc.projectId);
    addTask({
      id: createId('TSK'),
      title: `Process ${doc.name}`,
      project: project?.name ?? doc.project ?? 'General',
      projectId: doc.projectId,
      owner: doc.owner || 'Unassigned',
      status: 'To do',
      priority: 'Medium',
      dueDate: addDaysIso(todayIso(), 2),
      summary: doc.notes || 'Task created from intake triage.',
      nextStep: 'Extract actions and distribute to owners.',
      notes: `Created from intake document ${doc.name}.`,
      tags: [...doc.tags, 'Intake'],
      createdAt: todayIso(),
      updatedAt: todayIso(),
    });
    setIntakeDocumentDisposition(doc.id, 'Reference only');
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Unified intake</h2>
          <p className="mt-1 text-sm text-slate-500">Triage emails, documents, and intake signals into tracked work, reference files, or archived records.</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-2 text-slate-700">
          <Inbox className="h-5 w-5" />
        </div>
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-4 xl:grid-cols-2">
          <div
            className={`email-dropzone ${dragActive ? 'email-dropzone-active' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={(event) => { event.preventDefault(); setDragActive(false); }}
            onDrop={async (event) => {
              event.preventDefault();
              setDragActive(false);
              if (event.dataTransfer?.files?.length) await handleFiles(event.dataTransfer.files);
            }}
          >
            <div className="email-dropzone-header">
              <div className="rounded-2xl bg-sky-100 p-2 text-sky-700"><MailPlus className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Drag and drop email files</div>
                <div className="text-sm text-slate-500">Supports .eml plus Outlook .msg best-effort parsing. Files stay local in the app.</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="action-btn" disabled={busy}><Upload className="h-4 w-4" />{busy ? 'Parsing files…' : 'Choose email files'}</button>
              {droppedEmailImports.length > 0 ? <button onClick={clearDroppedEmailImports} className="action-btn"><Trash2 className="h-4 w-4" />Clear queue</button> : null}
            </div>
            <input ref={fileInputRef} type="file" accept=".eml,.msg,.txt,.html,.htm" multiple className="hidden-file-input" onChange={async (event) => {
              const files = event.target.files;
              if (files?.length) await handleFiles(files);
              event.currentTarget.value = '';
            }} />
          </div>

          <div className="email-dropzone">
            <div className="email-dropzone-header">
              <div className="rounded-2xl bg-emerald-100 p-2 text-emerald-700"><Upload className="h-5 w-5" /></div>
              <div>
                <div className="text-sm font-semibold text-slate-900">Upload other project documents</div>
                <div className="text-sm text-slate-500">Use this for Excel, Word, PDF, presentations, text files, and other intake support docs.</div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={() => docInputRef.current?.click()} className="action-btn"><Upload className="h-4 w-4" />Choose documents</button>
              <Badge variant="neutral">{unprocessedDocs.length} unprocessed</Badge>
            </div>
            <input ref={docInputRef} type="file" multiple className="hidden-file-input" onChange={(event) => {
              const files = event.target.files;
              if (files?.length) handleDocs(files);
              event.currentTarget.value = '';
            }} />
          </div>
        </div>

        {errors.length > 0 ? <div className="import-error">{errors.map((error) => <div key={error}>{error}</div>)}</div> : null}

        {droppedEmailImports.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-900">Dropped email queue</div>
                <div className="text-sm text-slate-500">Review preview, then convert the email into a tracked follow-up.</div>
              </div>
              <Badge variant="blue">{droppedEmailImports.length} queued</Badge>
            </div>
            {droppedEmailImports.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="blue">Email File</Badge>
                      <Badge variant={entry.parseQuality === 'best-effort' ? 'warn' : 'success'}>{entry.parseQuality === 'best-effort' ? 'Best effort' : 'Structured'}</Badge>
                      <Badge variant="neutral">{entry.format.toUpperCase()}</Badge>
                      <Badge variant="neutral">{entry.projectHint}</Badge>
                    </div>
                    <div className="text-sm font-medium text-slate-900">{entry.subject}</div>
                    <div className="text-sm text-slate-600">{buildDroppedEmailPreview(entry)}</div>
                    <div className="text-xs text-slate-500">{entry.fileName}{entry.sentAt ? ` • ${formatDateTime(entry.sentAt)}` : ''}</div>
                    {entry.parseWarnings.length > 0 ? <div className="text-xs text-amber-700">{entry.parseWarnings.join(' ')}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => convertDroppedEmailToItem(entry.id)} className="primary-btn"><PlusCircle className="h-4 w-4" />Convert to follow-up</button>
                    <button onClick={() => removeDroppedEmailImport(entry.id)} className="action-btn"><Trash2 className="h-4 w-4" />Remove</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="rounded-2xl border border-slate-200 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-900">Document triage</div>
              <div className="text-sm text-slate-500">Assign a project, owner, and final disposition so intake does not become a dump pile.</div>
            </div>
            <Badge variant="neutral">{intakeDocuments.length} total docs</Badge>
          </div>
          <div className="space-y-3">
            {intakeDocuments.map((doc) => (
              <div key={doc.id} className="rounded-2xl border border-slate-200 p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{doc.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{doc.kind} • {doc.disposition} • Uploaded {formatDateTime(doc.uploadedAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => convertDocToFollowUp(doc.id)} className="action-btn"><PlusCircle className="h-4 w-4" />To follow-up</button>
                    <button onClick={() => convertDocToTask(doc.id)} className="action-btn"><PlusCircle className="h-4 w-4" />To task</button>
                    <button onClick={() => setIntakeDocumentDisposition(doc.id, 'Reference only')} className="action-btn"><CheckCircle2 className="h-4 w-4" />Reference</button>
                    <button onClick={() => setIntakeDocumentDisposition(doc.id, 'Archived')} className="action-btn"><Archive className="h-4 w-4" />Archive</button>
                    <button onClick={() => { if (window.confirm('Delete this intake document record?')) deleteIntakeDocument(doc.id); }} className="action-btn action-btn-danger"><Trash2 className="h-4 w-4" />Delete</button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <select value={doc.projectId ?? ''} onChange={(e) => updateIntakeDocument(doc.id, { projectId: e.target.value, project: projects.find((project) => project.id === e.target.value)?.name ?? 'General' })} className="field-input">
                    <option value="">General</option>
                    {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
                  </select>
                  <input value={doc.owner} onChange={(e) => updateIntakeDocument(doc.id, { owner: e.target.value })} className="field-input" placeholder="Owner" />
                  <select value={doc.disposition} onChange={(e) => setIntakeDocumentDisposition(doc.id, e.target.value as typeof doc.disposition)} className="field-input">
                    <option>Unprocessed</option><option>Reference only</option><option>Archived</option><option>Converted to follow-up</option>
                  </select>
                </div>
                <textarea value={doc.notes} onChange={(e) => updateIntakeDocument(doc.id, { notes: e.target.value })} className="field-textarea mt-3" placeholder="Notes or handling direction" />
              </div>
            ))}
            {intakeDocuments.length === 0 ? <div className="text-sm text-slate-500">No documents in intake yet.</div> : null}
          </div>
        </div>

        <div className="space-y-3">
          {intakeSignals.map((signal) => (
            <div key={signal.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={sourceTone(signal.source)}>{signal.source}</Badge>
                  <Badge variant={signal.urgency === 'High' ? 'danger' : signal.urgency === 'Medium' ? 'warn' : 'neutral'}>{signal.urgency}</Badge>
                </div>
                <button onClick={() => convertSignalToItem(signal.id)} className="inline-flex items-center gap-2 rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                  <PlusCircle className="h-4 w-4" />Convert to follow-up
                </button>
              </div>
              <div className="mt-3 flex items-start gap-3">
                <div className="rounded-xl bg-slate-100 p-2 text-slate-700"><AlertTriangle className="h-4 w-4" /></div>
                <div>
                  <div className="text-sm font-medium text-slate-900">{signal.title}</div>
                  <div className="mt-1 text-sm text-slate-600">{signal.detail}</div>
                </div>
              </div>
            </div>
          ))}
          {intakeSignals.length === 0 && droppedEmailImports.length === 0 && intakeDocuments.length === 0 ? <div className="text-sm text-slate-500">No open intake signals right now.</div> : null}
        </div>
      </div>
    </section>
  );
}
