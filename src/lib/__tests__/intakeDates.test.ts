import { buildDateSignalSet, normalizeDetectedDate, toDateInputValue } from '../intakeDates';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

assert(normalizeDetectedDate('2026-04-09').iso === '2026-04-09', 'ISO date should pass through');
assert(normalizeDetectedDate('4/9/2026').iso === '2026-04-09', 'common US date should normalize');
assert(!!normalizeDetectedDate('someday').warning, 'unknown date should warn');
const conflict = buildDateSignalSet({ dueDate: '2026-04-10', promisedDate: '2026-04-12' });
assert(conflict.warnings.some((w) => /conflict/i.test(w)), 'conflicting date signals should warn');
assert(toDateInputValue('04/10/2026') === '', 'non-iso date should be blocked from date input value');
