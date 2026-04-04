import { addDaysIso, buildTouchEvent, createId, normalizeItem, resolveProjectName, todayIso } from '../../lib/utils';
import type { FollowUpItem, ForwardedEmailRecord, ImportPreviewRow, OutlookMessage, ProjectRecord } from '../../types';

function projectCanonicalKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeItems(items: FollowUpItem[]): FollowUpItem[] {
  return items.map(normalizeItem).sort((a, b) => new Date(b.lastTouchDate).getTime() - new Date(a.lastTouchDate).getTime());
}

export function attachProjects(items: FollowUpItem[], projects: ProjectRecord[]): FollowUpItem[] {
  return normalizeItems(items.map((item) => {
    const name = resolveProjectName(item.projectId, item.project, projects);
    const project = item.projectId ? projects.find((entry) => entry.id === item.projectId) : projects.find((entry) => projectCanonicalKey(entry.name) === projectCanonicalKey(name));
    return normalizeItem({ ...item, projectId: project?.id ?? item.projectId, project: project?.name ?? name });
  }));
}

export function applyItemRules(item: FollowUpItem): FollowUpItem {
  const cadenceDays = item.cadenceDays && item.cadenceDays > 0 ? item.cadenceDays : item.status === 'Waiting on external' ? 3 : item.status === 'At risk' ? 1 : 4;
  const nextTouchDate = item.nextTouchDate || addDaysIso(item.lastTouchDate || todayIso(), cadenceDays);
  const escalationLevel = item.status === 'At risk' && item.escalationLevel === 'None' ? 'Watch' : item.escalationLevel;
  const owesNextAction = item.status === 'Waiting on external' && item.owesNextAction === 'Unknown' ? 'Client' : item.owesNextAction;
  return normalizeItem({ ...item, cadenceDays, nextTouchDate, escalationLevel, owesNextAction });
}

export function syncProjectNamePatch(patch: Partial<FollowUpItem>, projects: ProjectRecord[]): Partial<FollowUpItem> {
  const projectName = resolveProjectName(patch.projectId, patch.project, projects);
  return { ...patch, project: projectName };
}

export function withItemUpdate(items: FollowUpItem[], id: string, updater: (item: FollowUpItem) => FollowUpItem): FollowUpItem[] {
  return normalizeItems(items.map((item) => (item.id === id ? updater(item) : item)));
}

export function buildFollowUpFromForwarded(record: ForwardedEmailRecord, owner = 'Jared', project = 'General', projectId?: string): FollowUpItem {
  return normalizeItem({
    id: createId(),
    title: record.originalSubject || '(no subject)',
    source: 'Email',
    project,
    projectId,
    owner,
    status: record.parsedCommandHints.type === 'followup' ? 'Waiting on external' : 'Needs action',
    priority: (record.parsedCommandHints.priority as FollowUpItem['priority']) ?? 'Medium',
    dueDate: record.parsedCommandHints.dueDate ?? addDaysIso(todayIso(), 2),
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(todayIso(), 1),
    nextAction: record.parsedCommandHints.type === 'followup' ? `Follow up with ${record.parsedCommandHints.waitingOn ?? record.originalSender}` : 'Review forwarded email and assign next action.',
    summary: record.bodyText.slice(0, 280),
    tags: ['Forwarded Intake', ...record.parsedCommandHints.tags],
    sourceRef: `Forwarded/${record.id}`,
    sourceRefs: [`Forwarded/${record.id}`, ...record.sourceMessageIdentifiers],
    mergedItemIds: [],
    waitingOn: record.parsedCommandHints.waitingOn,
    notes: [`Forwarded alias: ${record.forwardingAlias}`, `Sender: ${record.originalSender}`].join('\n'),
    timeline: [buildTouchEvent('Created from forwarded email intake.', 'imported')],
    category: 'Coordination',
    owesNextAction: record.parsedCommandHints.type === 'followup' ? 'Client' : 'Internal',
    escalationLevel: 'None',
    cadenceDays: 3,
    draftFollowUp: '',
  });
}

export function buildImportedItem(row: ImportPreviewRow): FollowUpItem {
  return normalizeItem({
    id: createId(),
    title: row.title,
    source: row.source,
    project: row.project,
    projectId: row.projectId,
    owner: row.owner,
    status: row.status,
    priority: row.priority,
    dueDate: row.dueDate,
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(row.dueDate, -1),
    nextAction: row.nextAction,
    summary: row.summary,
    tags: row.tags,
    sourceRef: row.sourceRef,
    sourceRefs: [row.sourceRef],
    mergedItemIds: [],
    waitingOn: undefined,
    notes: row.notes,
    timeline: [buildTouchEvent('Imported through the CSV / Excel intake wizard.', 'imported')],
    category: row.source === 'Excel' ? 'Issue' : row.source === 'Email' ? 'Coordination' : 'General',
    owesNextAction: row.source === 'Excel' ? 'Internal' : 'Unknown',
    escalationLevel: row.priority === 'Critical' ? 'Critical' : 'None',
    cadenceDays: 3,
    draftFollowUp: '',
  });
}

export function nextEscalation(current: FollowUpItem['escalationLevel']): FollowUpItem['escalationLevel'] {
  switch (current) {
    case 'None':
      return 'Watch';
    case 'Watch':
      return 'Escalate';
    case 'Escalate':
      return 'Critical';
    default:
      return 'None';
  }
}

export function buildFollowUpFromOutlookImport(message: OutlookMessage, owner: string, project: string, projectId?: string): FollowUpItem {
  const dueDateBase = message.receivedDateTime ?? message.sentDateTime ?? todayIso();
  return normalizeItem({
    id: createId(),
    title: message.subject || '(no subject)',
    source: 'Email',
    project,
    projectId,
    owner,
    status: message.folder === 'sentitems' ? 'Waiting on external' : 'Needs action',
    priority: message.flagStatus === 'flagged' || message.importance === 'high' ? 'High' : 'Medium',
    dueDate: dueDateBase,
    promisedDate: undefined,
    lastTouchDate: todayIso(),
    nextTouchDate: addDaysIso(todayIso(), 2),
    nextAction: message.folder === 'sentitems' ? 'Review thread status and send a follow-up if no reply has come in.' : 'Read the message and assign ownership.',
    summary: message.bodyPreview,
    tags: ['Outlook', message.folder === 'sentitems' ? 'Sent' : 'Inbox', ...(message.categories ?? [])],
    sourceRef: message.sourceRef,
    sourceRefs: [message.sourceRef, message.webLink ?? '', message.conversationId ?? '', message.internetMessageId ?? ''].filter(Boolean),
    mergedItemIds: [],
    waitingOn: message.folder === 'sentitems' ? message.toRecipients[0] || 'Email response' : undefined,
    notes: [`Outlook conversation: ${message.conversationId ?? 'n/a'}`, `From: ${message.from}`].join('\n'),
    timeline: [buildTouchEvent('Created from Outlook mailbox import.', 'imported')],
    category: 'Coordination',
    owesNextAction: message.folder === 'sentitems' ? 'Client' : 'Internal',
    escalationLevel: 'None',
    cadenceDays: 3,
    threadKey: message.conversationId,
    draftFollowUp: '',
  });
}
