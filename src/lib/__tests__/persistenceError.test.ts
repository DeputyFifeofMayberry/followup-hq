import {
  formatPersistenceErrorMessage,
  normalizePersistenceError,
  safeSerializeUnknownError,
  classifyPersistenceFailure,
} from '../persistenceError';

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function testSupabaseShapeFormatting() {
  const normalized = normalizePersistenceError({
    message: 'permission denied for table follow_up_items',
    code: '42501',
    details: 'new row violates row-level security policy',
    hint: 'check RLS policy',
    status: 403,
  }, { stage: 'follow_up_items', operation: 'load', table: 'follow_up_items' });
  const formatted = formatPersistenceErrorMessage(normalized);
  assert(formatted.includes('permission denied for table follow_up_items'), 'should keep primary message');
  assert(formatted.includes('code: 42501'), 'should include code');
  assert(formatted.includes('status: 403'), 'should include status');
  assert(!formatted.includes('[object Object]'), 'should not include object-object');
}

function testUnknownObjectFormatting() {
  const normalized = normalizePersistenceError({ foo: 'bar', nested: { a: 1 } });
  const formatted = formatPersistenceErrorMessage(normalized);
  assert(formatted.length > 0, 'unknown object should format to non-empty string');
  assert(!formatted.includes('[object Object]'), 'unknown object should avoid object-object');
}

function testCircularSerialization() {
  const circular: Record<string, unknown> = { type: 'circular' };
  circular.self = circular;
  const summary = safeSerializeUnknownError(circular);
  assert(summary.includes('Circular'), 'circular serializer should remain stable');
  assert(!summary.includes('[object Object]'), 'circular serializer should avoid object-object');
}

function testErrorPreservesMessage() {
  const normalized = normalizePersistenceError(new Error('network timeout'));
  assert(normalized.message === 'network timeout', 'Error message should be preserved');
}


function testPayloadInvalidClassification() {
  const normalized = normalizePersistenceError({
    message: 'unsupported Unicode escape sequence',
    code: '22P05',
    details: '\u0000 cannot be converted to text.',
  });
  const classified = classifyPersistenceFailure({ normalized });
  assert(classified.failureClass === 'payload-invalid', `expected payload-invalid, got ${classified.failureClass}`);
  assert(classified.nonRetryable, 'payload-invalid should be non-retryable');
}

(function run() {
  testSupabaseShapeFormatting();
  testUnknownObjectFormatting();
  testCircularSerialization();
  testErrorPreservesMessage();
  testPayloadInvalidClassification();
})();
