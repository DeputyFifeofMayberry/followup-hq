import { deriveFollowUpRecommendedAction, deriveTaskRecommendedAction } from './recommendedAction';
import type { FollowUpItem, TaskItem } from '../../../types';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

const baseFollowUp: FollowUpItem = {
  id: 'FU-1',
  title: 'Follow up with vendor',
  source: 'Email',
  project: 'Tower',
  owner: 'Alex',
  status: 'Needs action',
  priority: 'High',
  dueDate: '2026-04-08T00:00:00.000Z',
  lastTouchDate: '2026-04-05T00:00:00.000Z',
  nextTouchDate: '2026-04-08T00:00:00.000Z',
  nextAction: 'Send reminder',
  summary: 'Need pricing update',
  tags: [],
  sourceRef: 'mail',
  sourceRefs: [],
  mergedItemIds: [],
  notes: '',
  timeline: [],
  category: 'General',
  owesNextAction: 'Vendor',
  escalationLevel: 'None',
  cadenceDays: 3,
  actionState: 'Draft created',
};

const baseTask: TaskItem = {
  id: 'TSK-1',
  title: 'Send permit packet',
  project: 'Tower',
  owner: 'Alex',
  status: 'To do',
  priority: 'High',
  summary: '',
  nextStep: 'Send packet',
  notes: '',
  tags: [],
  createdAt: '2026-04-05T00:00:00.000Z',
  updatedAt: '2026-04-05T00:00:00.000Z',
};

(function run() {
  const closeAction = deriveFollowUpRecommendedAction(baseFollowUp, {
    nextMove: null,
    attentionSignal: null,
    closeoutReady: true,
    hasDuplicateAttention: false,
    linkedBlocked: false,
  });
  assert(closeAction.id === 'close', `expected close action, got ${closeAction.id}`);

  const snoozeAction = deriveFollowUpRecommendedAction({ ...baseFollowUp, status: 'Waiting internal' }, {
    nextMove: null,
    attentionSignal: null,
    closeoutReady: false,
    hasDuplicateAttention: false,
    linkedBlocked: false,
  });
  assert(snoozeAction.id === 'snooze', `expected snooze action, got ${snoozeAction.id}`);

  const unblockAction = deriveTaskRecommendedAction({ ...baseTask, status: 'Blocked', blockReason: 'Waiting on permit' });
  assert(unblockAction.id === 'unblock', `expected unblock action, got ${unblockAction.id}`);

  const completeAction = deriveTaskRecommendedAction({ ...baseTask, dueDate: '2020-01-01T00:00:00.000Z' });
  assert(completeAction.id === 'complete', `expected complete action for overdue task, got ${completeAction.id}`);
})();
