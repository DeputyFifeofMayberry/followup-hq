import fs from 'node:fs';

function read(file) {
  return fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
}

function assertIncludes(file, patterns) {
  const text = read(file);
  const missing = patterns.filter((pattern) => !text.includes(pattern));
  if (missing.length) {
    throw new Error(`UI contract failed for ${file}. Missing: ${missing.join(', ')}`);
  }
}

assertIncludes('src/components/ui/AppPrimitives.tsx', [
  'export function StatePanel',
  'export function NoMatchesState',
  'role="dialog"',
  'closeOnEscape = true',
]);

assertIncludes('src/components/actions/StructuredActionFlow.tsx', [
  'AppModal',
  'AppModalHeader',
  'AppModalFooter',
  'StatePanel',
]);

assertIncludes('src/App.tsx', [
  'StatePanel tone="loading"',
  'NoMatchesState',
]);

assertIncludes('src/main.tsx', [
  'StatePanel',
  'tone="error"',
]);

assertIncludes('src/components/DashboardBoard.tsx', [
  'tone="loading"',
  'tone="empty"',
]);

assertIncludes('src/components/RelationshipBoard.tsx', [
  'No linked follow-ups yet',
  'No linked tasks',
  'No linked projects',
]);

assertIncludes('src/components/SyncStatusControl.tsx', [
  'Save & sync trust center',
  'Recent sync activity',
  'Last failed sync attempt',
  'Signed in as',
  'Local/browser mode',
]);

console.log('UI contract checks passed.');
