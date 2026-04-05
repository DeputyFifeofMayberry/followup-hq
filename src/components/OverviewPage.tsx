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

      <WorkspacePrimaryLayout inspectorWidth="350px">
        <AppShellCard className="overview-main-panel" surface="data">
          <SectionHeader title="Overview triage" subtitle="Compact queue for selecting what to route next." compact />

          <OverviewSignalCards
            cards={signalCards}
            onRouteCard={(card) => {
              routeToLane(card.lane, { section: card.section, intentLabel: card.intentLabel });
              onOpenWorkspace(card.lane);
            }}
          />

          <div className="mt-3">
            <OverviewTriageList rows={triageRows} selectedId={selected?.id || null} onSelect={setSelectedId} />
          </div>
        </AppShellCard>

        <AppShellCard className="overview-inspector-shell" surface="inspector">
          <SectionHeader title="Route inspector" subtitle="Confirm context and launch execution in the right lane." compact />
          <OverviewRouteInspector
            selected={selected}
            onOpenFollowUps={() => {
              routeToLane('followups', { record: selected, section: 'triage', intentLabel: 'route selected overview item to follow-ups' });
              onOpenWorkspace('followups');
            }}
            onOpenTasks={() => {
              routeToLane('tasks', { record: selected, section: 'now', intentLabel: 'route selected overview item to tasks' });
              onOpenWorkspace('tasks');
            }}
            onOpenDetail={openSelectedDetail}
            onOpenIntake={selected?.queueFlags.cleanupRequired ? () => onOpenWorkspace('outlook') : undefined}
          />
        </AppShellCard>
      </WorkspacePrimaryLayout>
    </WorkspacePage>
  );
}
