import { Sparkles } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { buildSmartFollowUpDefaults, buildSmartTaskDefaults, getRecentWorkMode, rememberFollowUpDefaults, rememberTaskDefaults } from '../lib/dataEntryDefaults';
import { createId, fromDateInputValue, toDateInputValue } from '../lib/utils';
import { useAppStore } from '../store/useAppStore';
import type { ActionLifecycleState, FollowUpFormInput, FollowUpItem, TaskFormInput, TaskItem } from '../types';
import { EntityCombobox } from './EntityCombobox';
import { createRecordEditorSession, followUpEditorAdapter, taskEditorAdapter, updateRecordEditorDraft, type FollowUpSavePayload, type RecordEditorSession, type TaskSavePayload } from '../domains/editor';
import { AppModal, AppModalBody, AppModalFooter, AppModalHeader, RecordEditorFooter, SegmentedControl } from './ui/AppPrimitives';

type WorkMode = 'followup' | 'task';
type EditorMode = 'quick' | 'full';
type SectionKey = 'core' | 'schedule' | 'relationships' | 'notes' | 'advanced';

type EntityOptions = {
  projectOptions: Array<{ id: string; label: string }>;
  contactOptions: Array<{ id: string; label: string; meta?: string }>;
  companyOptions: Array<{ id: string; label: string; meta?: string }>;
};

const SECTION_LABELS: Array<{ key: SectionKey; label: string }> = [
  { key: 'core', label: 'Core' },
  { key: 'schedule', label: 'Schedule' },
  { key: 'relationships', label: 'Relationships' },
  { key: 'notes', label: 'Notes' },
  { key: 'advanced', label: 'Advanced' },
];

const followUpPresets: Array<{ id: string; label: string; apply: (draft: FollowUpFormInput) => FollowUpFormInput }> = [
  { id: 'followup-owner', label: 'Follow-up with owner', apply: (d) => ({ ...d, status: 'Needs action', owesNextAction: 'Internal', priority: 'Medium', category: 'Coordination', nextAction: d.nextAction || 'Confirm owner next step and due date.' }) },
  { id: 'waiting-sub', label: 'Waiting on sub', apply: (d) => ({ ...d, status: 'Waiting on external', owesNextAction: 'Subcontractor', category: 'Submittal', cadenceDays: 2, waitingOn: d.waitingOn || 'Subcontractor PM', nextAction: d.nextAction || 'Request response and confirm committed delivery date.' }) },
  { id: 'internal-coordination', label: 'Internal coordination', apply: (d) => ({ ...d, status: 'In progress', owesNextAction: 'Internal', category: 'Coordination', priority: 'Medium', nextAction: d.nextAction || 'Coordinate internal owners and publish next update.' }) },
  { id: 'procurement', label: 'Procurement item', apply: (d) => ({ ...d, category: 'Procurement', priority: 'High', owesNextAction: 'Vendor', status: 'Waiting on external', nextAction: d.nextAction || 'Confirm procurement lead time and shipping date.' }) },
  { id: 'closeout', label: 'Closeout item', apply: (d) => ({ ...d, category: 'Closeout', status: 'In progress', escalationLevel: 'Watch', nextAction: d.nextAction || 'Collect outstanding closeout deliverables.' }) },
];

const taskPresets: Array<{ id: string; label: string; apply: (draft: TaskFormInput) => TaskFormInput }> = [
  { id: 'quick-task', label: 'Quick task', apply: (d) => ({ ...d, status: 'To do', priority: 'Medium', nextStep: d.nextStep || d.title || 'Define immediate next step.' }) },
  { id: 'blocked-task', label: 'Blocked task', apply: (d) => ({ ...d, status: 'Blocked', priority: 'High', blockReason: d.blockReason || 'Awaiting upstream input', nextStep: d.nextStep || 'Identify unblock path and owner.' }) },
  { id: 'procurement-task', label: 'Procurement item', apply: (d) => ({ ...d, status: 'In progress', priority: 'High', linkedProjectContext: d.linkedProjectContext || 'Procurement', nextStep: d.nextStep || 'Issue procurement action and track vendor commitment.' }) },
];

function toTaskDraft(base: TaskItem): TaskItem {
  return { ...base, id: base.id || createId('TSK') };
}

function buildCreateSessions(projectFilter?: string) {
  const followUpDefaults = buildSmartFollowUpDefaults({ projectFilter });
  const taskDefaults = toTaskDraft(buildSmartTaskDefaults({ projectFilter }));

  const followUpSession = updateRecordEditorDraft(
    createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: 'new-followup' }, mode: 'create', sourceSurface: 'full_editor' }),
    followUpEditorAdapter,
    () => followUpDefaults,
  );
  const taskSession = updateRecordEditorDraft(
    createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: 'new-task' }, mode: 'create', sourceSurface: 'full_editor' }),
    taskEditorAdapter,
    () => taskDefaults,
  );

  return { followUpSession, taskSession, followUpDefaults, taskDefaults };
}

function parseTags(value: string) {
  return value.split(',').map((entry) => entry.trim()).filter(Boolean).slice(0, 12);
}

function formatTags(tags: string[]) {
  return tags.join(', ');
}

function toFieldIssueMap(issues: Array<{ field: string; message: string }>) {
  return issues.reduce<Record<string, string>>((map, issue) => {
    if (!map[issue.field]) map[issue.field] = issue.message;
    return map;
  }, {});
}

function FieldHint({ text, error }: { text?: string; error?: string }) {
  if (!text && !error) return null;
  return <p className={error ? 'field-help field-help-error' : 'field-help'}>{error ?? text}</p>;
}

function getStoredPreference<T extends string>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  return (value as T) || fallback;
}

export function CreateWorkModal() {
  const {
    itemModal,
    taskModal,
    createWorkDraft,
    items,
    tasks,
    projects,
    contacts,
    companies,
    projectFilter,
    addItem,
    updateItem,
    addTask,
    updateTask,
    addProject,
    addContact,
    addCompany,
    pushToast,
    closeItemModal,
    closeTaskModal,
  } = useAppStore(useShallow((s) => ({
    itemModal: s.itemModal,
    taskModal: s.taskModal,
    createWorkDraft: s.createWorkDraft,
    items: s.items,
    tasks: s.tasks,
    projects: s.projects,
    contacts: s.contacts,
    companies: s.companies,
    projectFilter: s.projectFilter,
    addItem: s.addItem,
    updateItem: s.updateItem,
    addTask: s.addTask,
    updateTask: s.updateTask,
    addProject: s.addProject,
    addContact: s.addContact,
    addCompany: s.addCompany,
    pushToast: s.pushToast,
    closeItemModal: s.closeItemModal,
    closeTaskModal: s.closeTaskModal,
  })));

  const open = itemModal.open || taskModal.open;
  const followUpEditing = itemModal.mode === 'edit';
  const taskEditing = taskModal.mode === 'edit';
  const creating = !(followUpEditing || taskEditing);
  const currentItem = useMemo(() => items.find((entry) => entry.id === itemModal.itemId) ?? null, [items, itemModal.itemId]);
  const currentTask = useMemo(() => tasks.find((entry) => entry.id === taskModal.taskId) ?? null, [tasks, taskModal.taskId]);

  const [mode, setMode] = useState<WorkMode>(getRecentWorkMode());
  const [saveAndContinue, setSaveAndContinue] = useState(true);
  const [followUpSession, setFollowUpSession] = useState<RecordEditorSession<FollowUpItem, FollowUpFormInput, FollowUpSavePayload> | null>(null);
  const [taskSession, setTaskSession] = useState<RecordEditorSession<TaskItem, TaskFormInput, TaskSavePayload> | null>(null);
  const [editorMode, setEditorMode] = useState<EditorMode>('quick');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [expandedAdvanced, setExpandedAdvanced] = useState<Record<SectionKey, boolean>>({ core: true, schedule: true, relationships: true, notes: true, advanced: true });
  const [activeSection, setActiveSection] = useState<SectionKey>('core');

  const scrollRegionRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<SectionKey, HTMLElement | null>>({ core: null, schedule: null, relationships: null, notes: null, advanced: null });

  const followUpForm = followUpSession?.draft ?? buildSmartFollowUpDefaults({ projectFilter });
  const taskForm = taskSession?.draft ?? buildSmartTaskDefaults({ projectFilter });

  const setFollowUpForm = (draft: FollowUpFormInput) => setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => draft) : session);
  const setTaskForm = (draft: TaskFormInput) => setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => draft) : session);

  useEffect(() => {
    if (!open) return;
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, [open]);

  useEffect(() => {
    if (!open) return;

    if (currentItem) {
      setMode('followup');
      setSaveAndContinue(false);
      setEditorMode('full');
      setShowAdvanced(true);
      setFollowUpSession(createRecordEditorSession({ adapter: followUpEditorAdapter, recordRef: { type: 'followup', id: currentItem.id }, mode: 'edit', record: currentItem }));
      return;
    }

    if (currentTask) {
      setMode('task');
      setSaveAndContinue(false);
      setEditorMode('full');
      setShowAdvanced(true);
      setTaskSession(createRecordEditorSession({ adapter: taskEditorAdapter, recordRef: { type: 'task', id: currentTask.id }, mode: 'edit', record: currentTask }));
      return;
    }

    setSaveAndContinue(true);
    const { followUpSession: freshFollowUpSession, taskSession: freshTaskSession, followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);

    if (createWorkDraft) {
      const projectMatch = createWorkDraft.project
        ? projects.find((project) => project.name.toLowerCase() === createWorkDraft.project?.toLowerCase() || project.id === createWorkDraft.project)
        : undefined;

      setMode(createWorkDraft.kind);

      const followUpDraft: FollowUpFormInput = {
        ...followUpDefaults,
        title: createWorkDraft.title || followUpDefaults.title,
        owner: createWorkDraft.owner || followUpDefaults.owner,
        assigneeDisplayName: createWorkDraft.owner || followUpDefaults.owner,
        project: projectMatch?.name ?? createWorkDraft.project ?? followUpDefaults.project,
        projectId: projectMatch?.id ?? followUpDefaults.projectId,
        dueDate: createWorkDraft.dueDate || followUpDefaults.dueDate,
        nextTouchDate: createWorkDraft.dueDate || followUpDefaults.nextTouchDate,
        nextAction: createWorkDraft.nextAction || createWorkDraft.waitingOn || followUpDefaults.nextAction,
        waitingOn: createWorkDraft.waitingOn || followUpDefaults.waitingOn,
        summary: createWorkDraft.rawText || followUpDefaults.summary,
        notes: createWorkDraft.contextNote || followUpDefaults.notes,
        priority: createWorkDraft.priority,
        contactId: createWorkDraft.contactId || followUpDefaults.contactId,
        companyId: createWorkDraft.companyId || followUpDefaults.companyId,
      };

      const taskDraft: TaskFormInput = {
        ...taskDefaults,
        title: createWorkDraft.title || taskDefaults.title,
        owner: createWorkDraft.owner || taskDefaults.owner,
        assigneeDisplayName: createWorkDraft.assigneeDisplayName || createWorkDraft.owner || taskDefaults.assigneeDisplayName,
        project: projectMatch?.name ?? createWorkDraft.project ?? taskDefaults.project,
        projectId: projectMatch?.id ?? createWorkDraft.projectId ?? taskDefaults.projectId,
        dueDate: createWorkDraft.dueDate || taskDefaults.dueDate,
        nextStep: createWorkDraft.nextStep || createWorkDraft.title || taskDefaults.nextStep,
        summary: createWorkDraft.rawText,
        contextNote: createWorkDraft.contextNote,
        priority: createWorkDraft.priority,
        linkedFollowUpId: createWorkDraft.linkedFollowUpId || taskDefaults.linkedFollowUpId,
        contactId: createWorkDraft.contactId || taskDefaults.contactId,
        companyId: createWorkDraft.companyId || taskDefaults.companyId,
      };

      setFollowUpSession(updateRecordEditorDraft(freshFollowUpSession, followUpEditorAdapter, () => followUpDraft));
      setTaskSession(updateRecordEditorDraft(freshTaskSession, taskEditorAdapter, () => taskDraft));
    } else {
      setMode(itemModal.open ? 'followup' : taskModal.open ? 'task' : getRecentWorkMode());
      setFollowUpSession(freshFollowUpSession);
      setTaskSession(freshTaskSession);
    }

    const preferenceMode: WorkMode = currentItem ? 'followup' : currentTask ? 'task' : createWorkDraft?.kind ?? (itemModal.open ? 'followup' : taskModal.open ? 'task' : getRecentWorkMode());
    const defaultMode = getStoredPreference<EditorMode>(`followup-hq:create-mode:${preferenceMode}`, 'quick');
    const defaultAdvanced = getStoredPreference<'true' | 'false'>(`followup-hq:show-advanced:${preferenceMode}`, 'false') === 'true';
    setEditorMode(defaultMode);
    setShowAdvanced(defaultAdvanced);
  }, [open, currentItem, currentTask, createWorkDraft, projectFilter, projects, itemModal.open, taskModal.open]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`followup-hq:create-mode:${mode}`, editorMode);
  }, [mode, editorMode, open]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(`followup-hq:show-advanced:${mode}`, String(showAdvanced));
  }, [mode, showAdvanced, open]);

  useEffect(() => {
    const root = scrollRegionRef.current;
    if (!root) return;

    const observer = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
      if (visible[0]?.target) {
        const id = visible[0].target.getAttribute('data-section-key') as SectionKey | null;
        if (id) setActiveSection(id);
      }
    }, { root, threshold: [0.2, 0.5, 0.75] });

    SECTION_LABELS.forEach((section) => {
      const node = sectionRefs.current[section.key];
      if (node) observer.observe(node);
    });

    return () => observer.disconnect();
  }, [editorMode, showAdvanced, mode, open]);

  if (!open) return null;

  const close = () => {
    closeItemModal();
    closeTaskModal();
  };

  const entityOptions: EntityOptions = {
    projectOptions: projects.map((project) => ({ id: project.id, label: project.name })),
    contactOptions: contacts.map((contact) => ({ id: contact.id, label: contact.name, meta: contact.role || contact.email })),
    companyOptions: companies.map((company) => ({ id: company.id, label: company.name, meta: company.type })),
  };

  const canSave = mode === 'followup' ? Boolean(followUpSession?.validation.valid) : Boolean(taskSession?.validation.valid);
  const validationIssues = mode === 'followup' ? (followUpSession?.validation.issues ?? []) : (taskSession?.validation.issues ?? []);
  const issuesByField = toFieldIssueMap(validationIssues as Array<{ field: string; message: string }>);
  const dirty = mode === 'followup' ? Boolean(followUpSession?.dirty) : Boolean(taskSession?.dirty);

  const requiredChecklist = mode === 'followup'
    ? [
      { label: 'Title', done: Boolean(followUpForm.title.trim()) },
      { label: 'Project', done: Boolean(followUpForm.project.trim()) },
      { label: 'Owner', done: Boolean(followUpForm.owner.trim()) },
      { label: 'Due date', done: Boolean(followUpForm.dueDate) },
      { label: 'Next move', done: Boolean(followUpForm.nextAction.trim()) },
      { label: 'Status', done: Boolean(followUpForm.status) },
      { label: 'Priority', done: Boolean(followUpForm.priority) },
    ]
    : [
      { label: 'Title', done: Boolean(taskForm.title.trim()) },
      { label: 'Project', done: Boolean(taskForm.project.trim()) },
      { label: 'Owner', done: Boolean(taskForm.owner.trim()) },
      { label: 'Next step', done: Boolean(taskForm.nextStep.trim()) },
      { label: 'Status', done: Boolean(taskForm.status) },
      { label: 'Priority', done: Boolean(taskForm.priority) },
      { label: 'Due date', done: Boolean(taskForm.dueDate) },
    ];

  const completedCount = requiredChecklist.filter((item) => item.done).length;

  const save = (forceAddAnother?: boolean) => {
    if (!canSave) return;

    if (mode === 'followup') {
      if (!followUpSession?.savePayload) return;
      const payload = followUpSession.savePayload.payload;
      rememberFollowUpDefaults(followUpSession.draft);
      if (payload.action === 'update' && payload.recordId) updateItem(payload.recordId, payload.record);
      else addItem(payload.record);
      pushToast({ tone: 'success', title: payload.action === 'update' ? 'Follow-up updated' : 'Follow-up created', message: `Saved "${payload.record.title}" with full execution context.`, recordType: 'followup', recordIds: [payload.record.id] });
    } else {
      if (!taskSession?.savePayload) return;
      const payload = taskSession.savePayload.payload;
      rememberTaskDefaults(taskSession.draft as TaskItem);
      const taskId = payload.record.id || createId('TSK');
      if (payload.action === 'update' && payload.recordId) updateTask(payload.recordId, payload.record);
      else addTask({ ...payload.record, id: taskId });
      pushToast({ tone: 'success', title: payload.action === 'update' ? 'Task updated' : 'Task created', message: `Saved "${payload.record.title}" and kept workflow metadata attached.`, recordType: 'task', recordIds: [taskId] });
    }

    const shouldAddAnother = forceAddAnother ?? (saveAndContinue && creating);
    if (!shouldAddAnother) {
      close();
      return;
    }

    const { followUpDefaults, taskDefaults } = buildCreateSessions(projectFilter);
    setFollowUpSession((session) => session ? updateRecordEditorDraft(session, followUpEditorAdapter, () => followUpDefaults) : session);
    setTaskSession((session) => session ? updateRecordEditorDraft(session, taskEditorAdapter, () => taskDefaults) : session);
  };

  const linkedFollowUpOptions = items
    .filter((item) => !taskEditing || item.id !== taskModal.taskId)
    .slice(0, 200)
    .map((item) => ({ id: item.id, label: `${item.title} · ${item.project}` }));

  const scrollToSection = (key: SectionKey) => {
    const root = scrollRegionRef.current;
    const target = sectionRefs.current[key];
    if (!root || !target) return;
    root.scrollTo({ top: target.offsetTop - 12, behavior: 'smooth' });
    setActiveSection(key);
  };

  const toggleAdvancedSection = (key: SectionKey) => setExpandedAdvanced((prev) => ({ ...prev, [key]: !prev[key] }));
  const waitingStatus = mode === 'followup' && (followUpForm.status === 'Waiting on external' || followUpForm.status === 'Waiting internal');
  const blockedTask = mode === 'task' && taskForm.status === 'Blocked';
  const deferredTask = mode === 'task' && Boolean(taskForm.deferredUntil);

  const maybeRenderAdvancedToggle = (
    <button type="button" className="action-btn create-work-inline-control" onClick={() => setShowAdvanced((prev) => !prev)}>
      {showAdvanced ? 'Hide advanced details' : 'Show advanced details'}
    </button>
  );

  const quickMode = editorMode === 'quick' && creating;

  return (
    <AppModal size="wide" ariaLabel="Create or edit work item">
      <div className="create-work-modal" onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          save(false);
        }
      }}>
        <AppModalHeader
          title={followUpEditing ? 'Edit follow-up' : taskEditing ? 'Edit task' : 'Create work item'}
          subtitle={quickMode
            ? 'Quick create captures essentials first. Switch to full editor any time.'
            : 'Structured workflow editor with section navigation and conditional guidance.'}
          onClose={close}
        />
        <AppModalBody scrollable={false} className="create-work-modal-body">
          <div className="create-work-topbar">
            <div className="create-work-controls-group">
              <label className="create-work-controls-label">Work type</label>
              <SegmentedControl
                value={mode}
                onChange={setMode}
                ariaLabel="Work type selector"
                className="create-work-segmented"
                options={[{ value: 'followup', label: 'Follow-up' }, { value: 'task', label: 'Task' }]}
              />
            </div>
            <div className="create-work-controls-group">
              <label className="create-work-controls-label">Entry mode</label>
              <SegmentedControl
                value={quickMode ? 'quick' : 'full'}
                onChange={(value) => setEditorMode(value as EditorMode)}
                ariaLabel="Entry mode selector"
                options={[{ value: 'quick', label: 'Quick create' }, { value: 'full', label: 'Full editor' }]}
              />
            </div>
            {creating ? maybeRenderAdvancedToggle : null}
            {creating ? (
              <label className="create-work-toggle">
                <input type="checkbox" checked={saveAndContinue} onChange={(event) => setSaveAndContinue(event.target.checked)} />
                <span>Save and start another</span>
              </label>
            ) : null}
          </div>

          <div className="create-work-summary-strip" role="status" aria-live="polite">
            <span>{completedCount}/{requiredChecklist.length} essentials complete</span>
            <span>• {validationIssues.length ? `${validationIssues.length} issue${validationIssues.length > 1 ? 's' : ''}` : 'Ready to save'}</span>
            <span>• {dirty ? 'Unsaved changes' : 'Saved state'}</span>
            <span>• Save shortcut: Ctrl/⌘ + Enter</span>
          </div>

          <div className="create-work-shell">
            {!quickMode ? (
              <nav className="create-work-section-nav" aria-label="Form sections">
                {SECTION_LABELS.filter((section) => showAdvanced || (section.key !== 'relationships' && section.key !== 'notes' && section.key !== 'advanced')).map((section) => (
                  <button
                    key={section.key}
                    type="button"
                    onClick={() => scrollToSection(section.key)}
                    className={activeSection === section.key ? 'create-work-section-link create-work-section-link-active' : 'create-work-section-link'}
                    aria-current={activeSection === section.key ? 'true' : undefined}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            ) : null}

            <div className="create-work-editor-scroll" ref={scrollRegionRef}>
              <div className="create-work-inline-actions">
                <span className={canSave ? 'workspace-meta-pill workspace-meta-pill-info' : 'workspace-meta-pill workspace-meta-pill-warn'}>
                  {canSave ? 'Ready to save' : 'Missing required fields'}
                </span>
                <button className="action-btn" onClick={() => save(false)} disabled={!canSave}>Save now</button>
              </div>
              {validationIssues.length > 0 ? (
                <div className="create-work-alert" role="alert">
                  <div className="font-semibold">Resolve these before save:</div>
                  <ul className="mt-1 list-disc pl-4">
                    {validationIssues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}
                  </ul>
                </div>
              ) : null}

              <section id="create-work-core" data-section-key="core" ref={(node) => { sectionRefs.current.core = node; }} className="create-work-form-section">
                <h3>Core</h3>
                <div className="form-grid-two">
                  <div className="field-block">
                    <label className="field-label">Title *</label>
                    <input autoFocus value={mode === 'followup' ? followUpForm.title : taskForm.title} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, title: e.target.value }) : setTaskForm({ ...taskForm, title: e.target.value })} className="field-input" placeholder="What needs to happen?" />
                    <FieldHint error={issuesByField.title} />
                  </div>
                  <EntityCombobox label="Project *" valueId={mode === 'followup' ? followUpForm.projectId : taskForm.projectId} valueLabel={mode === 'followup' ? followUpForm.project : taskForm.project} options={entityOptions.projectOptions} placeholder="Select or create project" hideMeta onSelect={(option) => {
                    if (mode === 'followup') setFollowUpForm({ ...followUpForm, project: option.label, projectId: option.id });
                    else setTaskForm({ ...taskForm, project: option.label, projectId: option.id });
                  }} onCreate={(label) => {
                    const id = addProject({ name: label, owner: mode === 'followup' ? followUpForm.owner : taskForm.owner, status: 'Active', notes: '', tags: [] });
                    if (mode === 'followup') setFollowUpForm({ ...followUpForm, project: label, projectId: id });
                    else setTaskForm({ ...taskForm, project: label, projectId: id });
                  }} />
                  <div className="field-block">
                    <label className="field-label">Owner / assignee *</label>
                    <input value={mode === 'followup' ? followUpForm.owner : taskForm.owner} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, owner: e.target.value, assigneeDisplayName: e.target.value }) : setTaskForm({ ...taskForm, owner: e.target.value, assigneeDisplayName: e.target.value })} className="field-input" placeholder="Who is accountable?" />
                    <FieldHint error={issuesByField.owner} />
                  </div>
                  <div className="field-block">
                    <label className="field-label">Status *</label>
                    {mode === 'followup' ? (
                      <select value={followUpForm.status} onChange={(e) => setFollowUpForm({ ...followUpForm, status: e.target.value as FollowUpFormInput['status'] })} className="field-input"><option>Needs action</option><option>Waiting on external</option><option>Waiting internal</option><option>In progress</option><option>At risk</option><option>Closed</option></select>
                    ) : (
                      <select value={taskForm.status} onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskItem['status'] })} className="field-input"><option>To do</option><option>In progress</option><option>Blocked</option><option>Done</option></select>
                    )}
                  </div>
                  <div className="field-block">
                    <label className="field-label">Priority *</label>
                    {mode === 'followup' ? (
                      <select value={followUpForm.priority} onChange={(e) => setFollowUpForm({ ...followUpForm, priority: e.target.value as FollowUpFormInput['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                    ) : (
                      <select value={taskForm.priority} onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value as TaskItem['priority'] })} className="field-input"><option>Low</option><option>Medium</option><option>High</option><option>Critical</option></select>
                    )}
                  </div>
                  <div className="field-block">
                    <label className="field-label">Due date {mode === 'followup' ? '*' : ''}</label>
                    <input type="date" value={toDateInputValue(mode === 'followup' ? followUpForm.dueDate : taskForm.dueDate)} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : '' }) : setTaskForm({ ...taskForm, dueDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" />
                    <FieldHint error={issuesByField.dueDate} />
                  </div>
                  <div className="field-block field-block-span-2">
                    <label className="field-label">{mode === 'followup' ? 'Next move *' : 'Next step *'}</label>
                    <textarea value={mode === 'followup' ? followUpForm.nextAction : taskForm.nextStep} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, nextAction: e.target.value }) : setTaskForm({ ...taskForm, nextStep: e.target.value })} className="field-textarea" placeholder={mode === 'followup' ? 'Explicit next action to keep movement.' : 'Most immediate executable step.'} />
                    <FieldHint error={issuesByField[mode === 'followup' ? 'nextAction' : 'nextStep']} />
                  </div>
                </div>

                {creating && mode === 'followup' ? (
                  <div className="create-work-preset-row">
                    <span className="create-work-preset-label">Presets</span>
                    {followUpPresets.map((preset) => <button key={preset.id} type="button" className="action-btn create-work-preset-btn" onClick={() => setFollowUpForm(preset.apply(followUpForm))}>{preset.label}</button>)}
                  </div>
                ) : null}
                {creating && mode === 'task' ? (
                  <div className="create-work-preset-row">
                    <span className="create-work-preset-label">Presets</span>
                    {taskPresets.map((preset) => <button key={preset.id} type="button" className="action-btn create-work-preset-btn" onClick={() => setTaskForm(preset.apply(taskForm))}>{preset.label}</button>)}
                  </div>
                ) : null}
              </section>

              <section id="create-work-schedule" data-section-key="schedule" ref={(node) => { sectionRefs.current.schedule = node; }} className="create-work-form-section">
                <h3>Schedule</h3>
                <div className="form-grid-two">
                  {mode === 'followup' ? (
                    <>
                      <div className="field-block"><label className="field-label">Next touch date</label><input type="date" value={toDateInputValue(followUpForm.nextTouchDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, nextTouchDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
                      <div className="field-block"><label className="field-label">Promised date</label><input type="date" value={toDateInputValue(followUpForm.promisedDate)} onChange={(e) => setFollowUpForm({ ...followUpForm, promisedDate: e.target.value ? fromDateInputValue(e.target.value) : '' })} className="field-input" /></div>
                      <div className="field-block"><label className="field-label">Cadence days</label><input type="number" min={1} max={30} value={followUpForm.cadenceDays} onChange={(e) => setFollowUpForm({ ...followUpForm, cadenceDays: Number(e.target.value || 1) })} className="field-input" /><FieldHint error={issuesByField.cadenceDays} /></div>
                      <div className="field-block"><label className="field-label">Escalation</label><select value={followUpForm.escalationLevel} onChange={(e) => setFollowUpForm({ ...followUpForm, escalationLevel: e.target.value as FollowUpFormInput['escalationLevel'] })} className="field-input"><option>None</option><option>Watch</option><option>Escalate</option><option>Critical</option></select></div>
                    </>
                  ) : (
                    <>
                      <div className="field-block"><label className="field-label">Start date</label><input type="date" value={toDateInputValue(taskForm.startDate)} onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
                      <div className="field-block"><label className="field-label">Next review</label><input type="date" value={toDateInputValue(taskForm.nextReviewAt)} onChange={(e) => setTaskForm({ ...taskForm, nextReviewAt: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /></div>
                      <div className="field-block"><label className="field-label">Deferred until</label><input type="date" value={toDateInputValue(taskForm.deferredUntil)} onChange={(e) => setTaskForm({ ...taskForm, deferredUntil: e.target.value ? fromDateInputValue(e.target.value) : undefined })} className="field-input" /><FieldHint text="Use for intentional deferral windows." error={issuesByField.deferredUntil} /></div>
                      <div className="field-block"><label className="field-label">Completion impact</label><select value={taskForm.completionImpact || 'none'} onChange={(e) => setTaskForm({ ...taskForm, completionImpact: e.target.value as TaskFormInput['completionImpact'] })} className="field-input"><option value="none">None</option><option value="advance_parent">Advance parent</option><option value="close_parent">Close parent</option></select></div>
                    </>
                  )}
                </div>
                {waitingStatus ? (
                  <div className="field-block field-block-highlight"><label className="field-label">Waiting on *</label><input value={followUpForm.waitingOn || ''} onChange={(e) => setFollowUpForm({ ...followUpForm, waitingOn: e.target.value })} className="field-input" placeholder="Person, company, or team you are waiting on" /><FieldHint text="Waiting statuses require this field so handoffs stay clear." error={issuesByField.waitingOn} /></div>
                ) : null}
                {blockedTask ? (
                  <div className="field-block field-block-highlight"><label className="field-label">Block reason *</label><input value={taskForm.blockReason || ''} onChange={(e) => setTaskForm({ ...taskForm, blockReason: e.target.value })} className="field-input" placeholder="Why this cannot move" /><FieldHint text="Blocked tasks need an explicit blocker for escalation and unblock routing." error={issuesByField.blockReason} /></div>
                ) : null}
                {deferredTask ? <FieldHint text="This task is currently deferred; confirm the deferred-until date stays realistic." /> : null}
              </section>

              {!quickMode && showAdvanced ? (
                <>
                  <section id="create-work-relationships" data-section-key="relationships" ref={(node) => { sectionRefs.current.relationships = node; }} className="create-work-form-section">
                    <button type="button" className="create-work-section-toggle" onClick={() => toggleAdvancedSection('relationships')}>{expandedAdvanced.relationships ? 'Hide' : 'Show'} relationships</button>
                    {expandedAdvanced.relationships ? (
                      <div className="form-grid-two">
                        {mode === 'task' ? (
                          <div className="field-block field-block-span-2"><label className="field-label">Linked follow-up</label><select className="field-input" value={taskForm.linkedFollowUpId || ''} onChange={(e) => setTaskForm({ ...taskForm, linkedFollowUpId: e.target.value || undefined })}><option value="">None</option>{linkedFollowUpOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
                        ) : null}
                        <EntityCombobox label="External contact" valueId={mode === 'followup' ? followUpForm.contactId : taskForm.contactId} valueLabel={(mode === 'followup' ? entityOptions.contactOptions.find((contact) => contact.id === followUpForm.contactId)?.label : entityOptions.contactOptions.find((contact) => contact.id === taskForm.contactId)?.label)} options={entityOptions.contactOptions} onSelect={(option) => {
                          if (mode === 'followup') setFollowUpForm({ ...followUpForm, contactId: option.id });
                          else setTaskForm({ ...taskForm, contactId: option.id });
                        }} onCreate={(label) => {
                          const id = addContact({ name: label, role: 'PM', notes: '', tags: [] });
                          if (mode === 'followup') setFollowUpForm({ ...followUpForm, contactId: id });
                          else setTaskForm({ ...taskForm, contactId: id });
                        }} />
                        <EntityCombobox label="Company" valueId={mode === 'followup' ? followUpForm.companyId : taskForm.companyId} valueLabel={(mode === 'followup' ? entityOptions.companyOptions.find((company) => company.id === followUpForm.companyId)?.label : entityOptions.companyOptions.find((company) => company.id === taskForm.companyId)?.label)} options={entityOptions.companyOptions} onSelect={(option) => {
                          if (mode === 'followup') setFollowUpForm({ ...followUpForm, companyId: option.id });
                          else setTaskForm({ ...taskForm, companyId: option.id });
                        }} onCreate={(label) => {
                          const id = addCompany({ name: label, type: 'Other', notes: '', tags: [] });
                          if (mode === 'followup') setFollowUpForm({ ...followUpForm, companyId: id });
                          else setTaskForm({ ...taskForm, companyId: id });
                        }} />
                        {mode === 'task' ? <div className="field-block field-block-span-2"><label className="field-label">Linked project context</label><input value={taskForm.linkedProjectContext || ''} onChange={(e) => setTaskForm({ ...taskForm, linkedProjectContext: e.target.value })} className="field-input" placeholder="Where this task fits in the larger project context" /></div> : null}
                      </div>
                    ) : null}
                  </section>

                  <section id="create-work-notes" data-section-key="notes" ref={(node) => { sectionRefs.current.notes = node; }} className="create-work-form-section">
                    <button type="button" className="create-work-section-toggle" onClick={() => toggleAdvancedSection('notes')}>{expandedAdvanced.notes ? 'Hide' : 'Show'} notes & handoff</button>
                    {expandedAdvanced.notes ? (
                      <div className="form-grid-two">
                        <div className="field-block field-block-span-2"><label className="field-label">Summary</label><textarea value={mode === 'followup' ? followUpForm.summary : taskForm.summary} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, summary: e.target.value }) : setTaskForm({ ...taskForm, summary: e.target.value })} className="field-textarea" /></div>
                        <div className="field-block field-block-span-2"><label className="field-label">Notes</label><textarea value={mode === 'followup' ? followUpForm.notes : taskForm.notes} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, notes: e.target.value }) : setTaskForm({ ...taskForm, notes: e.target.value })} className="field-textarea" /></div>
                        {(mode === 'followup' && followUpForm.status === 'Closed') || (mode === 'task' && taskForm.status === 'Done') ? (
                          <div className="field-block field-block-span-2"><label className="field-label">Completion note</label><textarea value={mode === 'followup' ? followUpForm.completionNote || '' : taskForm.completionNote || ''} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, completionNote: e.target.value }) : setTaskForm({ ...taskForm, completionNote: e.target.value })} className="field-textarea" placeholder="Capture outcome and what matters for audit/handoff" /></div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <section id="create-work-advanced" data-section-key="advanced" ref={(node) => { sectionRefs.current.advanced = node; }} className="create-work-form-section create-work-form-section-last">
                    <button type="button" className="create-work-section-toggle" onClick={() => toggleAdvancedSection('advanced')}>{expandedAdvanced.advanced ? 'Hide' : 'Show'} advanced metadata</button>
                    {expandedAdvanced.advanced ? (
                      <div className="form-grid-two">
                        {mode === 'followup' ? (
                          <>
                            <div className="field-block"><label className="field-label">Source</label><select value={followUpForm.source} onChange={(e) => setFollowUpForm({ ...followUpForm, source: e.target.value as FollowUpFormInput['source'] })} className="field-input"><option>Email</option><option>Notes</option><option>To-do</option><option>Excel</option></select></div>
                            <div className="field-block"><label className="field-label">Source reference</label><input value={followUpForm.sourceRef} onChange={(e) => setFollowUpForm({ ...followUpForm, sourceRef: e.target.value })} className="field-input" placeholder="Email id, report name, meeting context" /></div>
                            <div className="field-block"><label className="field-label">Thread key</label><input value={followUpForm.threadKey || ''} onChange={(e) => setFollowUpForm({ ...followUpForm, threadKey: e.target.value })} className="field-input" /></div>
                            <div className="field-block"><label className="field-label">Action lifecycle</label><select value={followUpForm.actionState || ''} onChange={(e) => setFollowUpForm({ ...followUpForm, actionState: (e.target.value || undefined) as ActionLifecycleState | undefined })} className="field-input"><option value="">Not set</option><option>Draft created</option><option>Ready to send</option><option>Sent (confirmed)</option><option>Waiting for reply</option><option>Reply received</option><option>Complete</option></select></div>
                            <div className="field-block field-block-span-2"><label className="field-label">Draft follow-up</label><textarea value={followUpForm.draftFollowUp || ''} onChange={(e) => setFollowUpForm({ ...followUpForm, draftFollowUp: e.target.value })} className="field-textarea" placeholder="Optional message draft for quick send workflows" /></div>
                            <div className="field-block"><label className="field-label">Category</label><select value={followUpForm.category} onChange={(e) => setFollowUpForm({ ...followUpForm, category: e.target.value as FollowUpFormInput['category'] })} className="field-input"><option>General</option><option>RFI</option><option>Submittal</option><option>Procurement</option><option>Issue</option><option>Coordination</option><option>Closeout</option></select></div>
                            <div className="field-block"><label className="field-label">Owes next action</label><select value={followUpForm.owesNextAction} onChange={(e) => setFollowUpForm({ ...followUpForm, owesNextAction: e.target.value as FollowUpFormInput['owesNextAction'] })} className="field-input"><option>Internal</option><option>Client</option><option>Government</option><option>Vendor</option><option>Subcontractor</option><option>Consultant</option><option>Unknown</option></select></div>
                          </>
                        ) : (
                          <>
                            <div className="field-block field-block-span-2"><label className="field-label">Context note</label><textarea value={taskForm.contextNote || ''} onChange={(e) => setTaskForm({ ...taskForm, contextNote: e.target.value })} className="field-textarea" /></div>
                          </>
                        )}
                        <div className="field-block field-block-span-2"><label className="field-label">Tags</label><input value={formatTags(mode === 'followup' ? followUpForm.tags : taskForm.tags)} onChange={(e) => mode === 'followup' ? setFollowUpForm({ ...followUpForm, tags: parseTags(e.target.value) }) : setTaskForm({ ...taskForm, tags: parseTags(e.target.value) })} className="field-input" placeholder="comma, separated, tags" /></div>
                      </div>
                    ) : null}
                  </section>
                </>
              ) : null}

              {quickMode ? (
                <div className="create-work-quick-footnote"><Sparkles size={14} /> Need relationships, notes, source metadata, waiting/blocked context, or lifecycle tracking? Switch to Full editor.</div>
              ) : null}
            </div>
          </div>
        </AppModalBody>
        <AppModalFooter className="create-work-modal-footer">
          <RecordEditorFooter>
            <button onClick={close} className="action-btn">Cancel</button>
            {creating ? <button onClick={() => save(true)} className="action-btn">Save and create another</button> : null}
            <button onClick={() => save(false)} disabled={!canSave} className="primary-btn disabled:cursor-not-allowed disabled:opacity-50">
              {followUpEditing || taskEditing ? 'Save changes' : 'Save work item'}
            </button>
          </RecordEditorFooter>
        </AppModalFooter>
      </div>
    </AppModal>
  );
}
