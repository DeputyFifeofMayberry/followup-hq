import { isTaskDeferred, localDayDelta } from '../../lib/utils';
import type { TaskItem, TaskQueueView } from '../../types';
import { getTaskDueBucket, type TaskDueBucket } from './timing';

export type TaskLaneDefinition = {
  key: TaskQueueView;
  label: string;
  intent: string;
  operationalMeaning: string;
  allowsDoneItems: boolean;
  allowsReviewRequired: boolean;
  summaryHint: string;
};

const DAY_MS = 86400000;

function normalizeStatusValue(status: string | undefined | null): string {
  return (status || '').trim().toLowerCase().replace(/[^a-z]/g, '');
}

export function normalizeTaskStatus(status: TaskItem['status'] | string | undefined): TaskItem['status'] {
  const normalized = normalizeStatusValue(status);
  if (normalized === 'done' || normalized === 'completed' || normalized === 'complete' || normalized === 'closed') return 'Done';
  if (normalized === 'inprogress' || normalized === 'progress' || normalized === 'doing') return 'In progress';
  if (normalized === 'blocked' || normalized === 'onhold') return 'Blocked';
  return 'To do';
}

export const TASK_LANE_DEFINITIONS: Record<TaskQueueView, TaskLaneDefinition> = {
  today: {
    key: 'today',
    label: 'Now',
    intent: 'Immediate execution queue: execution-ready work due today or ready to pull now.',
    operationalMeaning: 'Open, execution-ready tasks that are not blocked, not deferred, not overdue, and either due today or undated.',
    allowsDoneItems: false,
    allowsReviewRequired: false,
    summaryHint: 'Focus on execution-ready work that should move right now.',
  },
  overdue: {
    key: 'overdue',
    label: 'Overdue',
    intent: 'Pressure-removal queue: late commitments that need a recovery move.',
    operationalMeaning: 'Open tasks whose due date is before today.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Reduce deadline risk by clearing late work first.',
  },
  upcoming: {
    key: 'upcoming',
    label: 'Upcoming',
    intent: 'Look-ahead queue: near-term due work for the next week.',
    operationalMeaning: 'Open tasks due tomorrow or later this week.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Plan near-term due work before it becomes urgent.',
  },
  blocked: {
    key: 'blocked',
    label: 'Blocked',
    intent: 'Unblock queue: work waiting on a constraint or dependency.',
    operationalMeaning: 'Open tasks with status Blocked.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Capture unblock steps and owners to resume execution.',
  },
  review: {
    key: 'review',
    label: 'Review needed',
    intent: 'Trust cleanup queue: tasks requiring integrity or readiness review.',
    operationalMeaning: 'Open tasks marked review-needed or not execution-ready.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Repair task integrity before relying on it in execution lanes.',
  },
  deferred: {
    key: 'deferred',
    label: 'Deferred',
    intent: 'Deferred queue: intentionally snoozed work not ready to execute yet.',
    operationalMeaning: 'Open tasks with deferred-until in the future.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Deferred tasks stay here until their defer date elapses.',
  },
  unlinked: {
    key: 'unlinked',
    label: 'Unlinked',
    intent: 'Coverage queue: open tasks missing a parent follow-up link.',
    operationalMeaning: 'Open tasks with no linked follow-up id.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Link these tasks to preserve context and reporting trust.',
  },
  recent: {
    key: 'recent',
    label: 'Done today',
    intent: 'Momentum queue: tasks completed today.',
    operationalMeaning: 'Done tasks with completion timestamp in the current local day.',
    allowsDoneItems: true,
    allowsReviewRequired: false,
    summaryHint: 'Use this to confirm daily completion momentum.',
  },
  all: {
    key: 'all',
    label: 'All open',
    intent: 'Full workload queue across all open execution states.',
    operationalMeaning: 'All open tasks regardless of timing, readiness, or linkage.',
    allowsDoneItems: false,
    allowsReviewRequired: true,
    summaryHint: 'Use this when you need full open workload visibility.',
  },
};

export const TASK_QUEUE_VIEWS: TaskQueueView[] = ['today', 'overdue', 'upcoming', 'blocked', 'review', 'deferred', 'unlinked', 'recent', 'all'];

type TaskLike = Pick<TaskItem, 'status' | 'dueDate' | 'deferredUntil' | 'linkedFollowUpId' | 'completedAt'>;

export type TaskLaneClassification = {
  normalizedStatus: TaskItem['status'];
  isOpen: boolean;
  isDone: boolean;
  isExecutionReady: boolean;
  needsReview: boolean;
  isBlocked: boolean;
  isDeferred: boolean;
  isDeferredReadyToReenter: boolean;
  dueBucket: TaskDueBucket;
  isOverdue: boolean;
  isDueToday: boolean;
  isUpcoming: boolean;
  isUnlinked: boolean;
  inLane: Record<TaskQueueView, boolean>;
  whyNowCategory: 'review' | 'blocked' | 'overdue' | 'due_today' | 'upcoming' | 'deferred' | 'ready_now' | 'done' | 'backlog';
};

export function classifyTaskIntoLanes<T extends TaskLike>(
  task: T,
  options: {
    now?: Date;
    isReviewNeeded?: (task: T) => boolean;
    isExecutionReady?: (task: T) => boolean;
  } = {},
): TaskLaneClassification {
  const now = options.now ?? new Date();
  const normalizedStatus = normalizeTaskStatus(task.status);
  const isDone = normalizedStatus === 'Done';
  const isOpen = !isDone;
  const dueBucket = getTaskDueBucket({ ...task, status: normalizedStatus }, now);
  const isBlocked = isOpen && normalizedStatus === 'Blocked';
  const isDeferred = isOpen && Boolean(task.deferredUntil) && isTaskDeferred({ deferredUntil: task.deferredUntil, status: normalizedStatus });
  const isDeferredReadyToReenter = isOpen && Boolean(task.deferredUntil) && !isDeferred;
  const inferredNeedsReview = options.isReviewNeeded ? options.isReviewNeeded(task) : false;
  const inferredExecutionReady = options.isExecutionReady ? options.isExecutionReady(task) : !inferredNeedsReview;
  const needsReview = Boolean(inferredNeedsReview || !inferredExecutionReady);
  const isOverdue = isOpen && dueBucket === 'overdue';
  const isDueToday = isOpen && dueBucket === 'today';
  const dueTs = task.dueDate ? new Date(task.dueDate).getTime() : null;
  const isUpcoming = isOpen
    && (dueBucket === 'tomorrow' || dueBucket === 'upcoming')
    && dueTs !== null
    && dueTs <= (now.getTime() + 7 * DAY_MS);
  const isUnlinked = isOpen && !task.linkedFollowUpId;
  const isDoneToday = isDone && Boolean(task.completedAt) && localDayDelta(now, task.completedAt as string) === 0;
  const readyNow = isOpen && inferredExecutionReady && !needsReview && !isBlocked && !isDeferred && !isOverdue && (isDueToday || dueBucket === 'none');

  const inLane: Record<TaskQueueView, boolean> = {
    today: readyNow,
    overdue: isOverdue,
    upcoming: isUpcoming,
    blocked: isBlocked,
    review: isOpen && needsReview,
    deferred: isDeferred,
    unlinked: isUnlinked,
    recent: isDoneToday,
    all: isOpen,
  };

  const whyNowCategory: TaskLaneClassification['whyNowCategory'] = isDone
    ? 'done'
    : needsReview
      ? 'review'
      : isBlocked
        ? 'blocked'
        : isOverdue
          ? 'overdue'
          : isDeferred
            ? 'deferred'
            : isDueToday
              ? 'due_today'
              : isUpcoming
                ? 'upcoming'
                : readyNow
                  ? 'ready_now'
                  : 'backlog';

  return {
    normalizedStatus,
    isOpen,
    isDone,
    isExecutionReady: inferredExecutionReady,
    needsReview,
    isBlocked,
    isDeferred,
    isDeferredReadyToReenter,
    dueBucket,
    isOverdue,
    isDueToday,
    isUpcoming,
    isUnlinked,
    inLane,
    whyNowCategory,
  };
}
