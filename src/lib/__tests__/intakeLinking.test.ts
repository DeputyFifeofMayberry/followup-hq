import { enrichFollowUpFromIntakeLink, enrichTaskFromIntakeLink } from '../intakeLinking';
import type { FollowUpItem, IntakeWorkCandidate, TaskItem } from '../../types';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const candidate: IntakeWorkCandidate = {
  id: 'c1', batchId: 'b1', assetId: 'a1', candidateType: 'followup', suggestedAction: 'link_existing', confidence: 0.88, title: 'Close issue', project: 'Bridge', owner: 'Alex', priority: 'High', summary: 'Context from intake.', tags: [], explanation: [], evidence: [], warnings: [], duplicateMatches: [], existingRecordMatches: [], approvalStatus: 'pending', createdAt: '2026-04-09', updatedAt: '2026-04-09',
};
const followup: FollowUpItem = {
  id: 'f1', title: 'Existing', source: 'Notes', project: 'Bridge', owner: 'Alex', status: 'Needs action', priority: 'Medium', dueDate: '2026-04-12', lastTouchDate: '2026-04-09', nextTouchDate: '2026-04-10', nextAction: 'Do work', summary: 's', tags: [], sourceRef: 'manual', sourceRefs: [], mergedItemIds: [], notes: '', timeline: [], category: 'Coordination', owesNextAction: 'Unknown', escalationLevel: 'None', cadenceDays: 3,
};
const task: TaskItem = { id: 't1', title: 'Existing task', project: 'Bridge', owner: 'Alex', status: 'To do', priority: 'Medium', summary: 's', nextStep: 'step', notes: '', tags: [], createdAt: '2026-04-09', updatedAt: '2026-04-09' };

const linkedFollowup = enrichFollowUpFromIntakeLink(followup, candidate);
assert(linkedFollowup.sourceRefs.some((entry) => entry.includes('Intake asset a1')), 'follow-up should retain intake source reference');
assert(linkedFollowup.timeline.length === 1, 'follow-up should append intake timeline event');
const linkedTask = enrichTaskFromIntakeLink(task, candidate);
assert(!!linkedTask.contextNote?.includes('Intake link'), 'task should include context note from intake');
