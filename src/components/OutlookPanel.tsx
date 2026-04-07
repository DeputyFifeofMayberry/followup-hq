import { UniversalIntakeWorkspace } from './UniversalIntakeWorkspace';
import { AppShellCard, SectionHeader } from './ui/AppPrimitives';

export function OutlookPanel() {
  return (
    <AppShellCard className="space-y-4" surface="command">
      <SectionHeader
        title="Intake"
        subtitle="Manual drag-and-drop ingestion workspace for project documents and messages."
        compact
      />
      <UniversalIntakeWorkspace />
    </AppShellCard>
  );
}
