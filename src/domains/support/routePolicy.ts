import type { SupportLensKey, SupportPressureSummary, SupportRouteAction } from './types';

export function recommendSupportRoute(input: {
  lens: SupportLensKey;
  recordId: string;
  projectName?: string;
  pressure: SupportPressureSummary;
}): SupportRouteAction {
  const { lens, pressure, recordId } = input;
  const preferTasks = pressure.blockedPressure > 0 || (lens === 'projects' && pressure.openTaskPressure >= pressure.openFollowUpPressure);
  const lane = preferTasks ? 'tasks' : 'followups';
  const section = lane === 'tasks'
    ? (pressure.blockedPressure > 0 ? 'blocked' : 'now')
    : (pressure.closeoutPressure > 0 ? 'ready_to_close' : pressure.waitingPressure > 0 ? 'triage' : 'quick_route');

  const reason = lane === 'tasks'
    ? pressure.blockedPressure > 0
      ? `${pressure.blockedPressure} blocked tasks need tactical unblocking.`
      : 'Task execution pressure is dominant.'
    : pressure.waitingPressure > 0
      ? `${pressure.waitingPressure} waiting follow-ups need coordination.`
      : pressure.overduePressure > 0
        ? `${pressure.overduePressure} overdue commitments need follow-up routing.`
        : 'Follow-up coordination is the fastest next move.';

  return {
    id: `${lens}-${recordId}-${lane}`,
    lane,
    section,
    reason,
    intentLabel: lens === 'projects' ? `project pressure: ${lane}` : `coordination pressure: ${lane}`,
    origin: {
      source: lens,
      sourceRecordId: recordId,
      lens,
    },
  };
}

export function buildSupportRouteActions(input: {
  lens: SupportLensKey;
  recordId: string;
  pressure: SupportPressureSummary;
}): SupportRouteAction[] {
  const primary = recommendSupportRoute(input);
  const secondaryLane = primary.lane === 'followups' ? 'tasks' : 'followups';
  return [
    primary,
    {
      ...primary,
      id: `${primary.id}-secondary`,
      lane: secondaryLane,
      section: secondaryLane === 'tasks' ? 'now' : 'triage',
      intentLabel: `${input.lens} alternate route: ${secondaryLane}`,
      reason: secondaryLane === 'tasks' ? 'Open tasks for execution detail.' : 'Open follow-ups for coordination detail.',
    },
  ];
}
