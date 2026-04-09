import { buildIntakeRetrySource, fileFromIntakeRetrySource } from '../intakeRetryCache';

function assert(condition: boolean, message: string) { if (!condition) throw new Error(message); }

const original = new File(['Original payload for retry'], 'retry.txt', { type: 'text/plain', lastModified: 1710000000000 });
const out = await buildIntakeRetrySource(original);
assert(!!out.retrySource, 'retry source should be created for small files');
const reconstructed = fileFromIntakeRetrySource(out.retrySource!);
const text = await reconstructed.text();
assert(text === 'Original payload for retry', 'retry source should preserve original file content');
