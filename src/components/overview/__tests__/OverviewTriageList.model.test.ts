import { overviewRowTypeBadge } from '../OverviewTriageList';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

(function run() {
  const taskBadge = overviewRowTypeBadge('task');
  const followUpBadge = overviewRowTypeBadge('followup');
  assert(taskBadge.label === 'Task' && taskBadge.variant === 'purple', 'task rows should render a distinct Task badge');
  assert(followUpBadge.label === 'Follow-up' && followUpBadge.variant === 'blue', 'follow-up rows should render a distinct Follow-up badge');
})();
