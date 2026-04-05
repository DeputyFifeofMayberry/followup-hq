import { AppShellCard, SectionHeader, WorkspacePage, WorkspacePrimaryLayout, WorkspaceTopStack } from './ui/AppPrimitives';
import type { AppMode } from '../types';
import { OverviewStartStrip } from './overview/OverviewStartStrip';
import { OverviewSignalCards } from './overview/OverviewSignalCards';
import { OverviewTriageList } from './overview/OverviewTriageList';
import { OverviewRouteInspector } from './overview/OverviewRouteInspector';
import { useOverviewTriageViewModel } from '../domains/overview/hooks/useOverviewTriageViewModel';

type WorkspaceKey = 'overview' | 'queue' | 'tracker' | 'followups' | 'tasks' | 'outlook' | 'projects' | 'relationships';

interface OverviewPageProps {
  onOpenWorkspace: (workspace: WorkspaceKey) => void;
  personalMode?: boolean;
  appMode?: AppMode;
}

export function OverviewPage({ onOpenWorkspace, personalMode = false, appMode = personalMode ? 'personal' : 'team' }: OverviewPageProps) {
  void appMode;
  const { stats, triageRows, selected, signalCards, openCreateFromCapture, setSelectedId, routeToLane, openSelectedDetail } = useOverviewTriageViewModel();

  return (
    <WorkspacePage>
      <WorkspaceTopStack>
        <OverviewStartStrip
          stats={stats}
          onOpenIntake={() => onOpenWorkspace('outlook')}
          onRouteFollowUps={() => {
            routeToLane('followups', { section: 'triage', intentLabel: 'overview start strip: route follow-ups' });
            onOpenWorkspace('followups');
          }}
          onRouteTasks={() => {
            routeToLane('tasks', { section: 'now', intentLabel: 'overview start strip: route tasks' });
            onOpenWorkspace('tasks');
          }}
          onQuickAdd={() => openCreateFromCapture({
            kind: 'followup',
            rawText: '',
            title: '',
            priority: 'Medium',
            confidence: 1,
            cleanupReasons: [],
          })}
        />
      </WorkspaceTopStack>

      <WorkspacePrimaryLayout inspectorWidth="320px" className="overview-primary-layout">
        <AppShellCard className="overview-main-panel" surface="data">
          <SectionHeader title="Overview triage" subtitle="Primary triage queue for selecting what to route next." compact />

          <div className="overview-signal-support">
            <OverviewSignalCards
              cards={signalCards}
              onRouteCard={(card) => {
                routeToLane(card.lane, { section: card.section, intentLabel: card.intentLabel });
                onOpenWorkspace(card.lane);
              }}
            />
          </div>

          <div className="overview-triage-main">
            <OverviewTriageList rows={triageRows} selectedId={selected?.id || null} onSelect={setSelectedId} />
          </div>
        </AppShellCard>

        <AppShellCard className="overview-inspector-shell" surface="inspector">
          <SectionHeader title="Route inspector" subtitle="Decide where to handle the selected item next." compact />
          <OverviewRouteInspector
            selected={selected}
            onRouteDestination={(destination) => {
              routeToLane(destination, {
                record: selected,
                section: destination === 'tasks' ? 'now' : 'triage',
                intentLabel: `route selected overview item to ${destination}`,
              });
              onOpenWorkspace(destination);
            }}
            onOpenDetail={openSelectedDetail}
            onOpenIntake={() => onOpenWorkspace('outlook')}
          />
        </AppShellCard>
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
