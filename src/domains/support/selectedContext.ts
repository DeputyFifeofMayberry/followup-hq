import { buildSupportRouteActions } from './routePolicy';
import type { SupportRecordSurface, SupportSelectedContext } from './types';

export function buildSupportSelectedContext(surface: SupportRecordSurface): SupportSelectedContext {
  const routeActions = buildSupportRouteActions({
    lens: surface.lens,
    recordId: surface.id,
    pressure: surface.pressure,
  });

  const recommendedNextMove = routeActions[0]?.reason ?? 'Review linked work and route intentionally.';

  return {
    identity: {
      title: surface.title,
      subtitle: surface.subtitle,
      owner: surface.internalOwner,
      riskTier: surface.riskTier,
    },
    whyItMattersNow: surface.pressure.whyNow,
    recommendedNextMove,
    routeActions,
    linkedWork: surface.linkedWorkPreview,
    supportingContext: [
      `${surface.openWorkCount} open work items`,
      `${surface.activeProjectCount} active project links`,
      `Pressure tier: ${surface.pressure.tier}`,
    ],
    maintenance: surface.maintenance,
  };
}
