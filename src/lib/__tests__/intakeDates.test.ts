import { buildDateSignalSet, normalizeDetectedDate, toDateInputValue } from '../intakeDates';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

assert(normalizeDetectedDate('2026-04-09').iso === '2026-04-09', 'ISO date should pass through');
assert(normalizeDetectedDate('4/9/2026').iso === '2026-04-09', 'common US date should normalize');
assert(normalizeDetectedDate('Apr 9, 2026').iso === '2026-04-09', 'month-name date should normalize');
assert(!!normalizeDetectedDate('someday').warning, 'unknown date should warn');
assert(!!normalizeDetectedDate('13/40/2026').warning, 'ambiguous out-of-range date should reject');
const mixed = buildDateSignalSet({ dueDate: '2026-04-10', promisedDate: '2026-04-12', nextTouchDate: '2026-04-15' });
assert(mixed.warnings.some((w) => /multiple distinct schedule dates/i.test(w)), 'different due/promised/next-touch should be informational');
const conflict = buildDateSignalSet({ dueDate: '4/10/2026', promisedDate: '4/10/2026' });
assert(!conflict.warnings.some((w) => /conflict/i.test(w)), 'same meaning values should not false-conflict');
assert(toDateInputValue('04/10/2026') === '', 'non-iso date should be blocked from date input value');
