import { parseUniversalCapture } from '../universalCapture';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function classifyUnderstanding(score: number): 'high' | 'medium' | 'low' {
  if (score >= 0.78) return 'high';
  if (score >= 0.56) return 'medium';
  return 'low';
}

function classifyImportReadiness(parsed: ReturnType<typeof parseUniversalCapture>) {
  const understanding = classifyUnderstanding(parsed.confidence);
  const hasCoreContext = Boolean(parsed.project && parsed.owner && parsed.dueDate);
  const unclearType = parsed.cleanupReasons.includes('unclear_type');
  if (understanding === 'high' && hasCoreContext && !unclearType) {
    return { readiness: 'ready' as const, reason: 'complete' };
  }
  if (understanding === 'low' || unclearType) {
    return { readiness: 'review_first' as const, reason: 'parser_unclear' };
  }
  return { readiness: 'needs_context' as const, reason: 'completeness_context' };
}

function runUniversalCaptureConfidenceChecks() {
  const cases = [
    { input: 'Complete black books by the end of the week', expectedKind: 'task' as const },
    { input: 'Send CPARS backup to Alex tomorrow', expectedKind: 'task' as const },
    { input: 'Revise blackbook forecast Friday', expectedKind: 'task' as const },
    { input: 'Follow up with vendor on valve lead time', expectedKind: 'followup' as const },
  ];

  for (const testCase of cases) {
    const parsed = parseUniversalCapture(testCase.input, {
      knownOwners: [{ id: 'o1', name: 'Alex', aliases: [] }],
      knownProjects: [{ id: 'p1', name: 'Blackbook', aliases: ['black books', 'blackbook'] }],
      defaultOwner: 'owner@setpoint.test',
      referenceDate: new Date('2026-04-07T12:00:00Z'),
    });
    const understanding = classifyUnderstanding(parsed.confidence);
    const readiness = classifyImportReadiness(parsed);

    assert(parsed.kind === testCase.expectedKind, `${testCase.input}: expected ${testCase.expectedKind}, got ${parsed.kind}`);
    assert(understanding !== 'low', `${testCase.input}: straightforward imperative should not be low-understanding`);
    if (testCase.input.includes('end of the week')) {
      assert(Boolean(parsed.dueDate), 'end-of-week phrase should infer a due date');
    }
    if (readiness.readiness !== 'ready') {
      assert(readiness.reason === 'completeness_context', `${testCase.input}: review path should be completeness/context based`);
      assert(!parsed.cleanupReasons.includes('unclear_type'), `${testCase.input}: should not be flagged as unclear type`);
    }
  }
}

runUniversalCaptureConfidenceChecks();
