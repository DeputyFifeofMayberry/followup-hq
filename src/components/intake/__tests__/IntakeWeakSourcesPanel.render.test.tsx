import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { IntakeWeakSourcesPanel } from '../IntakeWeakSourcesPanel';
import { INTAKE_GOLDEN_CASES } from '../../../lib/__tests__/fixtures/intakeGoldenCases';
import { buildCandidatesFromAsset } from '../../../lib/universalIntake';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function runWeakSourcePanelRenderCheck() {
  const weakAssets = INTAKE_GOLDEN_CASES
    .filter((entry) => entry.asset.parserReceipt?.weakSourceRoute === 'weak_source_review' || entry.asset.parserReceipt?.weakSourceRoute === 'blocked_source')
    .map((entry) => entry.asset);

  const weakCandidates = INTAKE_GOLDEN_CASES
    .filter((entry) => entry.id === 'weak-degraded-email' || entry.id === 'pdf-partial-trust')
    .flatMap((entry) => buildCandidatesFromAsset(entry.asset, entry.existingFollowups, entry.existingTasks));

  const html = renderToStaticMarkup(<IntakeWeakSourcesPanel intakeAssets={weakAssets} intakeWorkCandidates={weakCandidates} />);

  assert(html.includes('Degraded source routing'), 'weak source panel should render heading for degraded routing');
  assert(html.includes('weak/degraded intake source'), 'weak source panel should render summary copy for weak sources');
  assert(html.includes('Pending weak candidates'), 'weak source panel should include weak candidate count chip');
  assert(html.includes('legacy-thread.msg'), 'weak source panel should render a representative degraded source file');
  assert(html.includes('meeting-notes.pdf'), 'weak source panel should render a representative partial-trust PDF file');
}

runWeakSourcePanelRenderCheck();
